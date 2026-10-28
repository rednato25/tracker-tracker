"use client"

import { H2 } from "@typography"
import { useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Notice } from "@/components/ui/Notice"
import { pilotRankDefinition } from "@/data/rank-goals"
import type { TrackerRankPath, TrackerUserClass } from "@/data/tracker-registry"
import { formatBytesNum, formatRatio } from "@/lib/formatters"
import { estimateUploadCompletion } from "@/lib/rank-eta"
import {
  evaluateRankGoal,
  evaluateRequirementGroup,
  type RankConditionResult,
  type RankGoalInput,
  type RankGroupResult,
  type RankNumericCondition,
  type RankObservationMap,
  type RankRequirementGroup,
} from "@/lib/rank-goals"
import type { Snapshot, TrackerLatestStats } from "@/types/api"

interface RankGoalPanelProps {
  trackerId: number
  registrySlug: string | null
  userClasses: TrackerUserClass[]
  rankPaths?: TrackerRankPath[]
  currentRank: string | null
  stats: TrackerLatestStats | null
  snapshots: Snapshot[]
  joinedAt: string | null
  lastPolledAt: string | null
  accentColor: string
}

const STALE_MS = 24 * 60 * 60 * 1000

function findUploadCondition(
  goal: RankRequirementGroup
): RankNumericCondition | null {
  for (const condition of goal.conditions) {
    if ("conditions" in condition) {
      const found = findUploadCondition(condition)
      if (found) return found
    } else if (
      condition.kind === "numeric" &&
      condition.metric === "uploadedBytes" &&
      condition.scope !== "per-torrent"
    ) {
      return condition
    }
  }
  return null
}

function findAgeCondition(goal: RankRequirementGroup): RankNumericCondition | null {
  for (const condition of goal.conditions) {
    if ("conditions" in condition) {
      const found = findAgeCondition(condition)
      if (found) return found
    } else if (condition.kind === "numeric" && condition.metric === "accountAgeDays") {
      return condition
    }
  }
  return null
}

function formatValue(
  metric: RankNumericCondition["metric"],
  value: number | null
): string {
  if (value === null) return "Unknown"
  if (metric === "uploadedBytes" || metric === "downloadedBytes" || metric === "bufferBytes") {
    return formatBytesNum(value)
  }
  if (metric === "accountAgeDays") return `${value} day${value === 1 ? "" : "s"}`
  if (metric === "accountRatio") return formatRatio(value)
  return String(value)
}

function statusLabel(status: "met" | "unmet" | "unknown"): string {
  return status === "met" ? "Met" : status === "unmet" ? "Unmet" : "Unknown"
}

function ConditionRow({ condition }: { condition: RankConditionResult }) {
  const statusClass =
    condition.status === "met"
      ? "text-success"
      : condition.status === "unmet"
        ? "text-danger"
        : "text-warn"
  return (
    <li className="border-t border-border py-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-xs text-primary">{condition.label}</span>
        <span className={`font-mono text-3xs uppercase tracking-[0.1em] ${statusClass}`}>
          {statusLabel(condition.status)}
        </span>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 font-mono text-4xs text-secondary">
        <span>
          current {formatValue(condition.metric ?? "accountRatio", condition.observedValue)}
        </span>
        <span>
          required {formatValue(condition.metric ?? "accountRatio", condition.requiredValue)}
        </span>
        {condition.remaining !== null && (
          <span>
            remaining{" "}
            {formatValue(condition.metric ?? "accountRatio", condition.remaining)}
          </span>
        )}
      </div>
      {condition.status === "unknown" && condition.reason && (
        <p className="mt-1 font-mono text-4xs text-warn">{condition.reason}</p>
      )}
      <details className="mt-1">
        <summary className="cursor-pointer font-mono text-4xs text-muted">Evidence</summary>
        <p className="mt-1 font-mono text-4xs text-tertiary">
          source={condition.source} · freshness={condition.freshness}
        </p>
      </details>
    </li>
  )
}

function groupConditions(
  result: RankGroupResult | null
): RankConditionResult[] {
  if (!result) return []
  return result.conditions.flatMap((condition) =>
    "conditions" in condition ? groupConditions(condition) : [condition]
  )
}

export function RankGoalPanel({
  trackerId,
  registrySlug,
  userClasses,
  rankPaths,
  currentRank,
  stats,
  snapshots,
  joinedAt,
  lastPolledAt,
  accentColor,
}: RankGoalPanelProps) {
  const pilot = useMemo(() => pilotRankDefinition(registrySlug), [registrySlug])
  const targetOptions = useMemo(() => Object.keys(pilot?.goals ?? {}), [pilot])
  const [target, setTarget] = useState<string | null>(null)
  const [savedGoals, setSavedGoals] = useState<Record<string, { targetRank: string }>>({})
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    fetch("/api/settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { rankGoals?: string | null } | null) => {
        let parsed: Record<string, { targetRank: string }> = {}
        try {
          if (data?.rankGoals) {
            parsed = JSON.parse(data.rankGoals) as Record<string, { targetRank: string }>
          }
        } catch {
          parsed = {}
        }
        setSavedGoals(parsed)
        const saved = parsed[String(trackerId)]?.targetRank
        setTarget(saved && targetOptions.includes(saved) ? saved : null)
      })
      .catch(() => setTarget(null))
      .finally(() => setLoaded(true))
  }, [trackerId, targetOptions])

  const observationMap = useMemo<RankObservationMap>(() => {
    if (!stats) return {}
    const last = lastPolledAt ? new Date(lastPolledAt) : null
    const freshness =
      last && !Number.isNaN(last.getTime()) && Date.now() - last.getTime() <= STALE_MS
        ? "fresh"
        : "stale"
    const source = "api" as const
    return {
      accountRatio: {
        value: stats.ratioIsInfinite ? null : stats.ratio,
        freshness,
        source,
        observedAt: lastPolledAt,
      },
      uploadedBytes: {
        value: stats.uploadedBytes === null ? null : Number(stats.uploadedBytes),
        freshness,
        source,
        observedAt: lastPolledAt,
      },
      seedbonus: { value: stats.seedbonus, freshness, source, observedAt: lastPolledAt },
      seedingCount: { value: stats.seedingCount, freshness, source, observedAt: lastPolledAt },
      hitAndRuns: { value: stats.hitAndRuns, freshness, source, observedAt: lastPolledAt },
    }
  }, [stats, lastPolledAt])

  const savedTarget = savedGoals[String(trackerId)]?.targetRank ?? null
  const targetInvalid = Boolean(savedTarget && !targetOptions.includes(savedTarget))
  const goalInput = useMemo<RankGoalInput>(
    () => ({
      userClasses,
      rankPaths,
      currentRank,
      observations: observationMap,
      now: now ?? new Date(0),
      joinedAt,
      structuredGoals: pilot?.goals,
    }),
    [userClasses, rankPaths, currentRank, observationMap, now, joinedAt, pilot]
  )
  const goal = target ? pilot?.goals[target] : undefined
  const result = goal && now ? evaluateRequirementGroup(goal, goalInput) : null
  const suggestion = !target && now ? evaluateRankGoal(goalInput).nextRank : null
  const conditions = groupConditions(result)
  const upload = goal ? findUploadCondition(goal) : null
  const age = goal ? findAgeCondition(goal) : null
  const uploadUnresolved = upload?.verification === "unresolved"
  const uploadEstimate =
    goal && upload && !uploadUnresolved && stats && now
      ? estimateUploadCompletion(
          snapshots,
          upload.requiredValue,
          stats.uploadedBytes === null ? Number.NaN : Number(stats.uploadedBytes),
          now
        )
      : null
  const joined = joinedAt ? new Date(joinedAt) : null
  const ageDate =
    age && joined && now && !Number.isNaN(joined.getTime())
      ? new Date(joined.getTime() + age.requiredValue * 86_400_000)
          .toISOString()
          .slice(0, 10)
      : null
  const counts = result?.progress ?? { met: 0, unmet: 0, unknown: 0, total: 0 }
  const eligible = result?.status === "met"

  async function chooseTarget(nextTarget: string) {
    const previous = target
    setTarget(nextTarget)
    setSaving(true)
    setError(null)
    try {
      const updated = {
        ...savedGoals,
        [String(trackerId)]: { targetRank: nextTarget },
      }
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rankGoals: updated }),
      })
      if (!res.ok) {
        setTarget(previous)
        setError("Could not save the selected rank goal")
        return
      }
      setSavedGoals(updated)
    } catch {
      setTarget(previous)
      setError("Network error. Could not save the selected rank goal")
    } finally {
      setSaving(false)
    }
  }

  async function clearTarget() {
    if (!savedTarget) {
      setTarget(null)
      return
    }
    const updated = { ...savedGoals }
    delete updated[String(trackerId)]
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rankGoals: updated }),
      })
      if (!res.ok) {
        setError("Could not clear the selected rank goal")
        return
      }
      setSavedGoals(updated)
      setTarget(null)
    } catch {
      setError("Network error. Could not clear the selected rank goal")
    } finally {
      setSaving(false)
    }
  }

  if (!pilot || targetOptions.length === 0) {
    return (
      <section id="rank-goal" className="border border-border bg-raised p-4">
        <H2 className="uppercase tracking-wider">Rank goal</H2>
        <p className="mt-2 text-xs text-secondary">
          Structured rank progress is unavailable for this tracker. The existing ladder and free-text
          requirements above remain the source of truth.
        </p>
      </section>
    )
  }

  return (
    <section
      id="rank-goal"
      className="border border-border bg-raised p-4"
      style={{ borderTopColor: accentColor }}
      data-rank-goal-panel
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <H2 className="uppercase tracking-wider">Rank goal</H2>
          <p className="mt-1 font-mono text-4xs text-tertiary">
            Observed current rank: {currentRank ?? "unknown"}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="font-cond text-4xs uppercase tracking-[0.12em] text-secondary">
              Target rank
            </span>
            <select
              className="border border-border bg-field px-3 py-2 font-mono text-xs text-primary"
              value={target ?? ""}
              onChange={(e) => {
                if (e.target.value) void chooseTarget(e.target.value)
              }}
              disabled={saving || !loaded}
              aria-label="Target rank"
            >
              <option value="">Choose a target</option>
              {targetOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          {savedTarget && (
            <Button
              size="sm"
              variant="ghost"
              text="Clear target"
              onClick={() => void clearTarget()}
              disabled={saving}
            />
          )}
        </div>
      </div>

      {!loaded || !now ? (
        <p className="mt-3 font-mono text-xs text-secondary" role="status">
          Loading rank evidence…
        </p>
      ) : !target ? (
        <div className="mt-3 flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="default">Choose a target</Badge>
            <span className="font-mono text-4xs text-secondary">
              No saved target for this tracker.
            </span>
          </div>
          {targetInvalid && savedTarget && (
            <p className="font-mono text-4xs text-warn">
              Saved target "{savedTarget}" is no longer available in this ladder. Clear it or
              choose another.
            </p>
          )}
          {suggestion && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-4xs text-secondary">
                Suggested next rank: {suggestion} (not saved).
              </span>
              <Button
                size="sm"
                variant="secondary"
                text={`Use ${suggestion} as target`}
                onClick={() => void chooseTarget(suggestion)}
                disabled={saving}
              />
            </div>
          )}
          <p className="font-mono text-4xs text-tertiary">
            Selecting a suggestion saves it explicitly; no automatic target is persisted.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant={eligible ? "success" : "default"}>
              {counts.met} met · {counts.unmet} unmet · {counts.unknown} unknown
            </Badge>
            {eligible && (
              <span className="font-mono text-4xs text-secondary">
                Thresholds met; promotion still depends on tracker/manual rules.
              </span>
            )}
          </div>
          {uploadUnresolved && (
            <p className="mt-2 font-mono text-4xs text-warn">
              Upload requirement is unknown: the official source does not establish binary vs decimal units.
            </p>
          )}
          <ul className="mt-2">
            {conditions.map((condition) => (
              <ConditionRow key={condition.id} condition={condition} />
            ))}
          </ul>
          <div className="mt-3 grid gap-2 border-t border-border pt-2 font-mono text-4xs text-secondary sm:grid-cols-2">
            <p>
              Account-age threshold date: {ageDate ?? "unavailable"}
            </p>
            <p>
              Upload estimate:{" "}
              {uploadUnresolved
                ? "unavailable — unit unresolved"
                : uploadEstimate
                  ? `${uploadEstimate.date} · ${uploadEstimate.daysRemaining.toFixed(0)} days at the recent ${uploadEstimate.basisDays}-day trend`
                  : "unavailable — insufficient, stale or non-positive history"}
            </p>
          </div>
          <p className="mt-1 font-mono text-4xs text-muted">
            An upload estimate is not a promotion date; bonuses, donations and manual rules can change it.
          </p>
          <details className="mt-2 border-t border-border pt-2">
            <summary className="cursor-pointer font-mono text-4xs text-tertiary">
              Source and verification
            </summary>
            <div className="mt-1 space-y-1 font-mono text-4xs text-tertiary">
              <p>{pilot.source.title}</p>
              <p>
                accessed {pilot.source.accessedAt ?? "not available"} · page modified{" "}
                {pilot.source.sourceLastModified ?? "unknown"}
              </p>
              <p>{pilot.source.note}</p>
              {pilot.unresolved.map((item) => (
                <p key={item} className="text-warn">
                  unresolved: {item}
                </p>
              ))}
            </div>
          </details>
          <Notice message={error} />
        </>
      )}
    </section>
  )
}
