// src/lib/integration-api.ts
//
// Response contract for the P16 read-only integration API. Everything here
// reads already-stored data or existing pure evaluators. There is no fetch, no
// scheduler call and no tracker/client I/O in this module.

import "server-only"

import type { TrackerAction } from "@/lib/actions"
import { computeTrackerActions } from "@/lib/actions"
import { computeAggregateStats } from "@/lib/dashboard"
import { db } from "@/lib/db"
import { appSettings, downloadClients } from "@/lib/db/schema"
import {
  type IntegrationIdentityMode,
  normalizeIntegrationIdentityMode,
} from "@/lib/integration-scopes"
import { isRedacted } from "@/lib/privacy"
import { getTrackerListForDashboard } from "@/lib/server-data"
import { getTrackerHealth, type TrackerHealth } from "@/lib/tracker-status"
import { ISO_8601_RE } from "@/lib/validators"
import type { TrackerSummary } from "@/types/api"

export const INTEGRATION_API_VERSION = "v1"

export const INTEGRATION_MAX_SUMMARY_TRACKERS = 200
export const INTEGRATION_MAX_ACTIONS = 200
export const INTEGRATION_HISTORY_DEFAULT_DAYS = 7
export const INTEGRATION_HISTORY_MAX_DAYS = 90
export const INTEGRATION_HISTORY_DEFAULT_LIMIT = 100
export const INTEGRATION_HISTORY_MAX_LIMIT = 500
export const INTEGRATION_STALE_AFTER_MS = 2 * 60 * 60 * 1000

const STATUS_KEYS: Record<TrackerHealth, keyof StatusCounts> = {
  healthy: "healthy",
  warning: "warning",
  "no-seeds": "noSeeds",
  critical: "critical",
  error: "error",
  paused: "paused",
  "paused-user": "pausedUser",
  offline: "offline",
}

interface StatusCounts {
  healthy: number
  warning: number
  noSeeds: number
  critical: number
  error: number
  paused: number
  pausedUser: number
  offline: number
}

export interface IntegrationPrivacy {
  trackerIdentity: IntegrationIdentityMode
  usernamesIncluded: boolean
}

export interface IntegrationLatestStats {
  ratio: number | null
  ratioIsInfinite: boolean
  uploadedBytes: string | null
  downloadedBytes: string | null
  bufferBytes: string | null
  seeding: number | null
  leeching: number | null
  requiredRatio: number | null
  warned: boolean | null
  hitAndRuns: number | null
  freeleechTokens: number | null
  seedbonus: number | null
  username?: string
}

export interface IntegrationSummaryTracker {
  trackerId: number
  name?: string
  status: TrackerHealth
  dataState: "current" | "stale" | "unknown"
  isActive: boolean
  isPaused: boolean
  isUserPaused: boolean
  lastPolledAt: string | null
  lastAccessAt?: string | null
  latestStats: IntegrationLatestStats | null
}

export interface IntegrationSummary {
  apiVersion: typeof INTEGRATION_API_VERSION
  generatedAt: string
  privacy: IntegrationPrivacy
  counts: {
    total: number
    active: number
    paused: number
    unknownData: number
    byStatus: StatusCounts
  }
  totals: {
    uploadedBytes: string
    downloadedBytes: string
    bufferBytes: string
    avgRatio: number | null
    seeding: number
    leeching: number
    hitAndRuns: { total: number; reportingTrackers: number }
  }
  trackers: IntegrationSummaryTracker[]
  truncated: boolean
}

export interface IntegrationActionEvidence {
  value?: number | null
  required?: number | null
  observedAt?: string | null
  verifiedAt?: string | null
  source?: string
  freshness?: string
  note?: string
}

export interface IntegrationAction {
  key: string
  type: string
  status: "action-required" | "needs-verification"
  priority: "critical" | "high" | "medium" | "low"
  trackerId: number | null
  trackerName?: string
  reason: string
  nextAction: string
  deadline: string | null
  evidence: IntegrationActionEvidence
}

export interface IntegrationActions {
  apiVersion: typeof INTEGRATION_API_VERSION
  generatedAt: string
  privacy: IntegrationPrivacy
  counts: {
    total: number
    returned: number
    actionRequired: number
    needsVerification: number
    truncated: boolean
  }
  actions: IntegrationAction[]
}

export interface IntegrationHistoryItem {
  trackerId: number
  polledAt: string
  uploadedBytes: string
  downloadedBytes: string
  ratio: number | null
  bufferBytes: string | null
  seeding: number | null
  leeching: number | null
  isManual: boolean
}

export interface IntegrationHistory {
  apiVersion: typeof INTEGRATION_API_VERSION
  generatedAt: string
  range: {
    days: number
    maxDays: number
    limit: number
    maxLimit: number
    trackerId: number | null
    before: string | null
  }
  items: IntegrationHistoryItem[]
  truncated: boolean
  nextBefore: string | null
}

export interface IntegrationSettings {
  identityMode: IntegrationIdentityMode
  storeUsernames: boolean
}

function dataState(lastPolledAt: string | null, hasStats: boolean, now: Date): IntegrationSummaryTracker["dataState"] {
  if (!hasStats || !lastPolledAt) return "unknown"
  const polled = new Date(lastPolledAt)
  if (Number.isNaN(polled.getTime())) return "unknown"
  return now.getTime() - polled.getTime() > INTEGRATION_STALE_AFTER_MS ? "stale" : "current"
}

function mayRevealName(identityMode: IntegrationIdentityMode): boolean {
  return identityMode === "trackers" || identityMode === "full"
}

function mayRevealUsername(identityMode: IntegrationIdentityMode, storeUsernames: boolean): boolean {
  return identityMode === "full" && storeUsernames
}

export function buildIntegrationSummary(
  trackers: TrackerSummary[],
  settings: IntegrationSettings,
  now: Date
): IntegrationSummary {
  const identityMode = normalizeIntegrationIdentityMode(settings.identityMode)
  const usernamesIncluded = mayRevealUsername(identityMode, settings.storeUsernames)
  const byStatus: StatusCounts = {
    healthy: 0,
    warning: 0,
    noSeeds: 0,
    critical: 0,
    error: 0,
    paused: 0,
    pausedUser: 0,
    offline: 0,
  }

  let active = 0
  let paused = 0
  let unknownData = 0
  const serialized: IntegrationSummaryTracker[] = []

  for (const tracker of trackers) {
    const status = getTrackerHealth(tracker)
    byStatus[STATUS_KEYS[status]]++
    if (tracker.isActive) active++
    if (status === "paused" || status === "paused-user") paused++
    if (!tracker.latestStats) unknownData++

    const latest = tracker.latestStats
    const item: IntegrationSummaryTracker = {
      trackerId: tracker.id,
      status,
      dataState: dataState(tracker.lastPolledAt, latest !== null, now),
      isActive: tracker.isActive,
      isPaused: Boolean(tracker.pausedAt || tracker.userPausedAt),
      isUserPaused: Boolean(tracker.userPausedAt),
      lastPolledAt: tracker.lastPolledAt,
      latestStats: latest
        ? {
            ratio: latest.ratio,
            ratioIsInfinite: latest.ratioIsInfinite,
            uploadedBytes: latest.uploadedBytes,
            downloadedBytes: latest.downloadedBytes,
            bufferBytes: latest.bufferBytes,
            seeding: latest.seedingCount,
            leeching: latest.leechingCount,
            requiredRatio: latest.requiredRatio,
            warned: latest.warned,
            hitAndRuns: latest.hitAndRuns,
            freeleechTokens: latest.freeleechTokens,
            seedbonus: latest.seedbonus,
          }
        : null,
    }

    if (mayRevealName(identityMode)) item.name = tracker.name
    if (mayRevealUsername(identityMode, settings.storeUsernames)) {
      item.lastAccessAt = tracker.lastAccessAt
      const username = latest?.username
      if (item.latestStats && username && !isRedacted(username)) {
        item.latestStats.username = username
      }
    }

    serialized.push(item)
  }

  const aggregate = computeAggregateStats(trackers)
  return {
    apiVersion: INTEGRATION_API_VERSION,
    generatedAt: now.toISOString(),
    privacy: { trackerIdentity: identityMode, usernamesIncluded },
    counts: {
      total: trackers.length,
      active,
      paused,
      unknownData,
      byStatus,
    },
    totals: {
      uploadedBytes: aggregate.totalUploaded,
      downloadedBytes: aggregate.totalDownloaded,
      bufferBytes: aggregate.totalBuffer,
      avgRatio: aggregate.avgRatio,
      seeding: aggregate.totalSeeding,
      leeching: aggregate.totalLeeching,
      hitAndRuns: {
        total: aggregate.totalHitAndRuns,
        reportingTrackers: aggregate.hitAndRunReportingTrackers,
      },
    },
    trackers: serialized.slice(0, INTEGRATION_MAX_SUMMARY_TRACKERS),
    truncated: serialized.length > INTEGRATION_MAX_SUMMARY_TRACKERS,
  }
}

function serializeEvidence(action: TrackerAction): IntegrationActionEvidence {
  const evidence: IntegrationActionEvidence = {}
  if (action.evidence.value !== undefined) evidence.value = action.evidence.value
  if (action.evidence.required !== undefined) evidence.required = action.evidence.required
  if (action.evidence.observedAt !== undefined) evidence.observedAt = action.evidence.observedAt
  if (action.evidence.verifiedAt !== undefined) evidence.verifiedAt = action.evidence.verifiedAt
  if (action.evidence.source !== undefined) evidence.source = action.evidence.source
  if (action.evidence.freshness !== undefined) evidence.freshness = action.evidence.freshness
  if (action.evidence.note !== undefined) evidence.note = action.evidence.note
  return evidence
}

export function buildIntegrationActions(
  input: { trackers: TrackerSummary[]; clients: { id: number; name: string; enabled: boolean; lastError: string | null }[] },
  settings: IntegrationSettings,
  now: Date
): IntegrationActions {
  const identityMode = normalizeIntegrationIdentityMode(settings.identityMode)
  const all = computeTrackerActions({
    trackers: input.trackers,
    clients: input.clients,
    now,
  })
  const actions = all.slice(0, INTEGRATION_MAX_ACTIONS).map((action): IntegrationAction => {
    const item: IntegrationAction = {
      key: action.key,
      type: action.type,
      status: action.status,
      priority: action.priority,
      trackerId: action.trackerId,
      reason: action.reason,
      nextAction: action.nextAction,
      deadline: action.deadline,
      evidence: serializeEvidence(action),
    }
    // A client action also carries the client's name in trackerName. That is
    // private configuration, so only tracker actions can opt into a name.
    if (
      action.trackerId !== null &&
      mayRevealName(identityMode) &&
      Number.isFinite(action.trackerId)
    ) {
      item.trackerName = action.trackerName
    }
    return item
  })

  return {
    apiVersion: INTEGRATION_API_VERSION,
    generatedAt: now.toISOString(),
    privacy: {
      trackerIdentity: identityMode,
      usernamesIncluded: mayRevealUsername(identityMode, settings.storeUsernames),
    },
    counts: {
      total: all.length,
      returned: actions.length,
      actionRequired: all.filter((action) => action.status === "action-required").length,
      needsVerification: all.filter((action) => action.status === "needs-verification").length,
      truncated: all.length > INTEGRATION_MAX_ACTIONS,
    },
    actions,
  }
}

export async function loadIntegrationSettings(): Promise<IntegrationSettings> {
  const [row] = await db
    .select({
      identityMode: appSettings.integrationIdentityMode,
      storeUsernames: appSettings.storeUsernames,
    })
    .from(appSettings)
    .limit(1)
  return {
    identityMode: normalizeIntegrationIdentityMode(row?.identityMode),
    storeUsernames: row?.storeUsernames ?? true,
  }
}

export async function loadIntegrationTrackers(): Promise<TrackerSummary[]> {
  return getTrackerListForDashboard(INTEGRATION_MAX_SUMMARY_TRACKERS + 1)
}

export async function loadIntegrationClients() {
  return db
    .select({
      id: downloadClients.id,
      name: downloadClients.name,
      enabled: downloadClients.enabled,
      lastError: downloadClients.lastError,
    })
    .from(downloadClients)
    .limit(INTEGRATION_MAX_SUMMARY_TRACKERS)
}
export interface HistoryQuery {
  days: number
  limit: number
  trackerId: number | null
  before: string | null
}

export type HistoryQueryResult = { ok: true; query: HistoryQuery } | { ok: false; error: string }

function optionalStrictInt(
  raw: string | null,
  min: number,
  max: number,
  label: string,
  defaultValue: number
): number | string {
  if (raw === null) return defaultValue
  if (!/^\d+$/.test(raw)) return `${label} must be an integer between ${min} and ${max}`
  const value = Number(raw)
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    return `${label} must be an integer between ${min} and ${max}`
  }
  return value
}

export function parseHistoryQuery(url: URL): HistoryQueryResult {
  const days = optionalStrictInt(
    url.searchParams.get("days"),
    1,
    INTEGRATION_HISTORY_MAX_DAYS,
    "days",
    INTEGRATION_HISTORY_DEFAULT_DAYS
  )
  if (typeof days === "string") return { ok: false, error: days }

  const limit = optionalStrictInt(
    url.searchParams.get("limit"),
    1,
    INTEGRATION_HISTORY_MAX_LIMIT,
    "limit",
    INTEGRATION_HISTORY_DEFAULT_LIMIT
  )
  if (typeof limit === "string") return { ok: false, error: limit }

  const rawTrackerId = url.searchParams.get("trackerId")
  const trackerId =
    rawTrackerId === null
      ? null
      : optionalStrictInt(rawTrackerId, 1, 2_147_483_647, "trackerId", 1)
  if (typeof trackerId === "string") return { ok: false, error: trackerId }

  const rawBefore = url.searchParams.get("before")
  if (rawBefore !== null && !ISO_8601_RE.test(rawBefore)) {
    return { ok: false, error: "before must be an ISO-8601 UTC timestamp" }
  }
  if (rawBefore !== null && Number.isNaN(new Date(rawBefore).getTime())) {
    return { ok: false, error: "before must be a valid ISO-8601 timestamp" }
  }

  return { ok: true, query: { days, limit, trackerId, before: rawBefore } }
}
export function buildIntegrationHistory(
  query: HistoryQuery,
  rows: IntegrationHistoryItem[],
  truncated: boolean,
  now: Date
): IntegrationHistory {
  return {
    apiVersion: INTEGRATION_API_VERSION,
    generatedAt: now.toISOString(),
    range: {
      days: query.days,
      maxDays: INTEGRATION_HISTORY_MAX_DAYS,
      limit: query.limit,
      maxLimit: INTEGRATION_HISTORY_MAX_LIMIT,
      trackerId: query.trackerId,
      before: query.before,
    },
    items: rows,
    truncated,
    nextBefore: truncated && rows.length > 0 ? rows[0].polledAt : null,
  }
}
