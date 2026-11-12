import type { RuleFreshness, RuleSource } from "@/data/tracker-registry"
import { registryEntryFor } from "@/data/tracker-registry"
import { isSatisfied, resolveSatisfaction } from "@/lib/satisfaction"
import { checkTrackerError } from "@/lib/tracker-events"
import { resolveTrackerRules } from "@/lib/tracker-rules"
import type { TrackerSummary } from "@/types/api"

export type ActionPriority = "critical" | "high" | "medium" | "low"
export type ActionStatus = "action-required" | "needs-verification"

export type ActionType =
  | "ratio-below-account"
  | "login-due"
  | "login-overdue"
  | "login-evidence-missing"
  | "stale-data"
  | "polling-paused"
  | "poll-error"
  | "auth-error"
  | "client-error"
  | "hit-and-run"
  | "seeding-obligation"
  | "verify-rules"
  | "verify-data"

export interface ActionEvidence {
  value?: number | null
  required?: number | null
  observedAt?: string | null
  verifiedAt?: string | null
  source?: RuleSource
  freshness?: RuleFreshness
  note?: string
}

export interface TrackerAction {
  key: string
  type: ActionType
  status: ActionStatus
  priority: ActionPriority
  trackerId: number | null
  trackerName: string
  clientId?: number
  torrentHash?: string
  reason: string
  nextAction: string
  /** Only set when the existing data proves the date. No generic ban deadline. */
  deadline: string | null
  evidence: ActionEvidence
  dismissible: boolean
}

export interface ActionClientInput {
  id: number
  name: string
  enabled: boolean
  lastError: string | null
}

export interface SeedObligationInput {
  trackerId: number
  hash: string
  name: string
  seedingTime: number
  ratio: number
}

export interface ActionInput {
  trackers: TrackerSummary[]
  clients?: ActionClientInput[]
  torrents?: SeedObligationInput[]
  now: Date
  /** Existing dashboard staleness threshold. */
  staleAfterMs?: number
  /** How early a login reminder appears. */
  loginReminderWindowMs?: number
}

const DAY_MS = 24 * 60 * 60 * 1000
const DEFAULT_STALE_MS = 2 * 60 * 60 * 1000
const DEFAULT_LOGIN_WINDOW_MS = 7 * DAY_MS

const PRIORITY_ORDER: Record<ActionPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

// Operator attention first: an overdue login, then one due inside the reminder
// window, then every other action by severity.
const LOGIN_ACTION_RANK: Partial<Record<ActionType, number>> = {
  "login-overdue": 0,
  "login-due": 1,
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function pushUnique(actions: Map<string, TrackerAction>, action: TrackerAction): void {
  const existing = actions.get(action.key)
  if (!existing) {
    actions.set(action.key, action)
    return
  }
  // Equivalent actions must collapse even if two upstream rows describe the
  // same condition. Keep the more severe copy; text does not create a new key.
  if (
    PRIORITY_ORDER[action.priority] < PRIORITY_ORDER[existing.priority] ||
    (action.priority === existing.priority &&
      action.deadline !== null &&
      (existing.deadline === null || action.deadline < existing.deadline))
  ) {
    actions.set(action.key, action)
  }
}

function compareActions(a: TrackerAction, b: TrackerAction): number {
  const loginRank = LOGIN_ACTION_RANK[a.type] ?? 2
  const otherLoginRank = LOGIN_ACTION_RANK[b.type] ?? 2
  if (loginRank !== otherLoginRank) return loginRank - otherLoginRank
  const priority = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
  if (priority !== 0) return priority
  if (a.deadline !== b.deadline) {
    if (a.deadline === null) return 1
    if (b.deadline === null) return -1
    return a.deadline.localeCompare(b.deadline)
  }
  return a.key.localeCompare(b.key)
}

/**
 * Deterministic P04 evaluator. It never performs I/O, never polls a tracker and
 * never reads the clock itself: `now` is injected by the caller. The same input
 * always produces the same ordered list.
 */
export function computeTrackerActions(input: ActionInput): TrackerAction[] {
  const actions = new Map<string, TrackerAction>()
  const staleAfterMs = input.staleAfterMs ?? DEFAULT_STALE_MS
  const loginWindowMs = input.loginReminderWindowMs ?? DEFAULT_LOGIN_WINDOW_MS

  for (const tracker of input.trackers) {
    if (!tracker.isActive) continue
    const entry = registryEntryFor(tracker)
    const rules = entry?.rules
    const resolved = resolveTrackerRules(rules, {
      liveRequiredAccountRatio: tracker.latestStats?.requiredRatio,
      snapshotAt: tracker.lastPolledAt,
      now: input.now,
      loginLastAccessAt: tracker.lastAccessAt,
    })
    const stats = tracker.latestStats

    const explicitlyUnknownRules =
      rules?.requiredAccountRatio === null || rules?.requiredTorrentRatio === null
    if (!rules || explicitlyUnknownRules) {
      pushUnique(actions, {
        key: `verify-rules:tracker:${tracker.id}`,
        type: "verify-rules",
        status: "needs-verification",
        priority: "medium",
        trackerId: tracker.id,
        trackerName: tracker.name,
        reason: "No ratio or seeding rules are saved for this tracker.",
        nextAction: "Check the rules on the site.",
        deadline: null,
        evidence: {
          source: resolved.provenance.accountRatio.source,
          freshness: resolved.provenance.accountRatio.freshness,
        },
        dismissible: true,
      })
    }

    const lastPolled = tracker.lastPolledAt ? new Date(tracker.lastPolledAt) : null
    const lastPolledValid = lastPolled !== null && !Number.isNaN(lastPolled.getTime())
    const stale = lastPolledValid
      ? input.now.getTime() - lastPolled.getTime() > staleAfterMs
      : false

    if (!stats) {
      pushUnique(actions, {
        key: `verify-data:tracker:${tracker.id}`,
        type: "verify-data",
        status: "needs-verification",
        priority: "medium",
        trackerId: tracker.id,
        trackerName: tracker.name,
        reason: "No stats collected yet.",
        nextAction: "Poll now, or check the tracker's settings.",
        deadline: null,
        evidence: { source: "unknown", freshness: "unknown" },
        dismissible: true,
      })
    } else if (stale && !tracker.pausedAt && !tracker.userPausedAt) {
      pushUnique(actions, {
        key: `stale-data:tracker:${tracker.id}`,
        type: "stale-data",
        status: "needs-verification",
        priority: "high",
        trackerId: tracker.id,
        trackerName: tracker.name,
        reason: "The last successful poll is older than expected.",
        nextAction: "Poll now, or check the tracker's settings.",
        deadline: null,
        evidence: {
          observedAt: tracker.lastPolledAt,
          source: "snapshot",
          freshness: "stale",
        },
        dismissible: true,
      })
    }

    if (!lastPolledValid && !stats) {
      // Already covered by verify-data; no invented deadline.
    } else if (!lastPolledValid) {
      pushUnique(actions, {
        key: `verify-data:tracker:${tracker.id}`,
        type: "verify-data",
        status: "needs-verification",
        priority: "medium",
        trackerId: tracker.id,
        trackerName: tracker.name,
        reason: "The last poll time is missing.",
        nextAction: "Poll now, or check the tracker's settings.",
        deadline: null,
        evidence: { source: "unknown", freshness: "unknown" },
        dismissible: true,
      })
    }

    const errorState = checkTrackerError(
      tracker.lastError,
      tracker.pausedAt,
      tracker.userPausedAt
    )
    if (errorState.paused && !errorState.pausedByUser) {
      pushUnique(actions, {
        key: `polling-paused:tracker:${tracker.id}`,
        type: "polling-paused",
        status: "action-required",
        priority: "high",
        trackerId: tracker.id,
        trackerName: tracker.name,
        reason: "Polling stopped after repeated failures.",
        nextAction: "Check the login details in the tracker's settings, then resume polling.",
        deadline: null,
        evidence: { observedAt: tracker.pausedAt, source: "manual" },
        dismissible: false,
      })
    }

    if (errorState.hasError) {
      // Only an explicit authentication status is safe to classify. A generic
      // message stays a local poll failure; it is not evidence of an expired
      // cookie or a tracker-wide outage.
      const authError =
        tracker.lastError !== null &&
        /\b(401|403)\b|unauthorized|forbidden|invalid (api )?(key|token)\b/i.test(
          tracker.lastError
        )
      pushUnique(actions, {
        key: `${authError ? "auth-error" : "poll-error"}:tracker:${tracker.id}`,
        type: authError ? "auth-error" : "poll-error",
        status: authError ? "action-required" : "needs-verification",
        priority: "high",
        trackerId: tracker.id,
        trackerName: tracker.name,
        reason: authError
          ? "The tracker rejected the saved login details."
          : "The last poll failed.",
        nextAction: authError
          ? "Update the login details in the tracker's settings."
          : "Poll again, or check the tracker's settings.",
        deadline: null,
        evidence: { observedAt: tracker.lastErrorAt, source: "manual" },
        dismissible: !authError,
      })
    }

    const ratioFresh = resolved.provenance.accountRatio.freshness !== "stale"
    if (
      stats &&
      lastPolledValid &&
      !stale &&
      ratioFresh &&
      finiteNumber(stats.ratio) &&
      resolved.requiredAccountRatio !== null &&
      resolved.requiredAccountRatio > 0
    ) {
      if (stats.ratio < resolved.requiredAccountRatio) {
        pushUnique(actions, {
          key: `ratio-below-account:tracker:${tracker.id}`,
          type: "ratio-below-account",
          status: "action-required",
          priority: "critical",
          trackerId: tracker.id,
          trackerName: tracker.name,
          reason: `Ratio ${stats.ratio.toFixed(2)} is below the minimum of ${resolved.requiredAccountRatio.toFixed(2)}.`,
          nextAction: "Seed more to raise the ratio before downloading.",
          deadline: null,
          evidence: {
            value: stats.ratio,
            required: resolved.requiredAccountRatio,
            observedAt: tracker.lastPolledAt,
            source: resolved.provenance.accountRatio.source,
            freshness: resolved.provenance.accountRatio.freshness,
            verifiedAt: resolved.provenance.accountRatio.verifiedAt,
          },
          dismissible: true,
        })
      }
    } else if (
      stats &&
      lastPolledValid &&
      !stale &&
      stats.ratio === null &&
      !stats.ratioIsInfinite &&
      resolved.requiredAccountRatio !== null &&
      resolved.requiredAccountRatio > 0
    ) {
      pushUnique(actions, {
        key: `verify-data:ratio:tracker:${tracker.id}`,
        type: "verify-data",
        status: "needs-verification",
        priority: "medium",
        trackerId: tracker.id,
        trackerName: tracker.name,
        reason: "The ratio is missing, and this tracker has a minimum.",
        nextAction: "Poll now, or check the ratio on the site.",
        deadline: null,
        evidence: { required: resolved.requiredAccountRatio, source: "unknown" },
        dismissible: true,
      })
    }

    const interval = resolved.loginIntervalDays
    if (interval !== null && interval > 0) {
      const lastAccess = tracker.lastAccessAt ? new Date(tracker.lastAccessAt) : null
      if (!lastAccess || Number.isNaN(lastAccess.getTime())) {
        pushUnique(actions, {
          key: `login-evidence-missing:tracker:${tracker.id}`,
          type: "login-evidence-missing",
          status: "needs-verification",
          priority: "medium",
          trackerId: tracker.id,
          trackerName: tracker.name,
          reason: "No login date is recorded.",
          nextAction: "Log in on the site, then mark today's login here.",
          deadline: null,
          evidence: { value: interval, source: "manual" },
          dismissible: true,
        })
      } else {
        const due = new Date(lastAccess.getTime() + interval * DAY_MS)
        if (input.now.getTime() >= due.getTime()) {
          pushUnique(actions, {
            key: `login-overdue:tracker:${tracker.id}`,
            type: "login-overdue",
            status: "action-required",
            priority: "critical",
            trackerId: tracker.id,
            trackerName: tracker.name,
            reason: `Login is overdue (log in every ${interval} days).`,
            nextAction: "Log in on the site, then mark today's login here.",
            deadline: isoDate(due),
            evidence: { value: interval, observedAt: tracker.lastAccessAt, source: "manual" },
            dismissible: true,
          })
        } else if (due.getTime() - input.now.getTime() <= loginWindowMs) {
          pushUnique(actions, {
            key: `login-due:tracker:${tracker.id}`,
            type: "login-due",
            status: "action-required",
            priority: "medium",
            trackerId: tracker.id,
            trackerName: tracker.name,
            reason: `Login is due soon (log in every ${interval} days).`,
            nextAction: "Log in on the site, then mark today's login here.",
            deadline: isoDate(due),
            evidence: { value: interval, observedAt: tracker.lastAccessAt, source: "manual" },
            dismissible: true,
          })
        }
      }
    }

    if (
      stats &&
      lastPolledValid &&
      !stale &&
      finiteNumber(stats.hitAndRuns) &&
      stats.hitAndRuns > 0
    ) {
      pushUnique(actions, {
        key: `hit-and-run:tracker:${tracker.id}`,
        type: "hit-and-run",
        status: "action-required",
        priority: "high",
        trackerId: tracker.id,
        trackerName: tracker.name,
        reason: `${stats.hitAndRuns} hit-and-run${stats.hitAndRuns === 1 ? "" : "s"} reported.`,
        nextAction: "Seed those torrents again where you can.",
        deadline: null,
        evidence: { value: stats.hitAndRuns, observedAt: tracker.lastPolledAt, source: "api" },
        dismissible: false,
      })
    }
  }

  for (const torrent of input.torrents ?? []) {
    const tracker = input.trackers.find((candidate) => candidate.id === torrent.trackerId)
    if (!tracker?.isActive) continue
    const rules = registryEntryFor(tracker)?.rules
    const requirement = resolveSatisfaction(rules)
    if (!requirement) continue
    if (isSatisfied({ seedingTime: torrent.seedingTime, ratio: torrent.ratio }, requirement)) {
      continue
    }
    pushUnique(actions, {
      key: `seeding-obligation:tracker:${tracker.id}:torrent:${torrent.hash}`,
      type: "seeding-obligation",
      status: "action-required",
      priority: "high",
      trackerId: tracker.id,
      trackerName: tracker.name,
      torrentHash: torrent.hash,
      reason: `"${torrent.name}" hasn't been seeded long enough yet.`,
      nextAction: "Keep it seeding until the rule is met.",
      deadline: null,
      evidence: {
        value: torrent.seedingTime,
        required: requirement.requiredSeedSeconds,
        source: "api",
        freshness: "unknown",
      },
      dismissible: false,
    })
  }

  for (const client of input.clients ?? []) {
    if (!client.enabled || !client.lastError) continue
    pushUnique(actions, {
      key: `client-error:client:${client.id}`,
      type: "client-error",
      status: "action-required",
      priority: "high",
      trackerId: null,
      trackerName: client.name,
      clientId: client.id,
      reason: "The download client reported an error.",
      nextAction: "Check the client's address and login in Settings.",
      deadline: null,
      evidence: { source: "manual" },
      dismissible: false,
    })
  }

  return [...actions.values()].sort(compareActions)
}
