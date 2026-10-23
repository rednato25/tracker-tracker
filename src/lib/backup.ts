// src/lib/backup.ts
//
// Functions: generateBackupPayload, validateBackupJson, encryptBackupPayload, decryptBackupPayload, resolveBackupPassword, pruneOldBackups

import { unlink } from "node:fs/promises"
import path from "node:path"
import { desc, inArray, isNotNull } from "drizzle-orm"
import { decrypt, deriveKey, encrypt, generateSalt } from "@/lib/crypto"
import { db } from "@/lib/db"
import {
  appCoverageGaps,
  appSettings,
  backupHistory,
  clientSnapshots,
  clientUptimeBuckets,
  dismissedAlerts,
  downloadClients,
  notificationDeliveryState,
  notificationTargets,
  tagGroupMembers,
  tagGroups,
  torrentDailyCheckpoints,
  trackerDailyCheckpoints,
  trackerOutages,
  trackerRoles,
  trackerSnapshots,
  trackers,
} from "@/lib/db/schema"
import { log } from "@/lib/logger"
import { isUnsafeNetworkHost } from "@/lib/network"
import { VALID_NOTIFICATION_TYPES } from "@/lib/notifications/types"
import { PROXY_HOST_PATTERN } from "@/lib/tunnel"
import { HEX_64_RE, ISO_8601_RE, isValidHex, isValidPort } from "@/lib/validators"
import packageJson from "../../package.json"

// v1 is the historical contract. v2 adds durable notification delivery state
// and the two daily checkpoint tables. New exports are always v2; v1 stays
// importable without fabricating the history it never carried.
export const CURRENT_BACKUP_VERSION = 2
export const LEGACY_BACKUP_VERSION = 1
export const SUPPORTED_BACKUP_VERSIONS = [LEGACY_BACKUP_VERSION, CURRENT_BACKUP_VERSION] as const

/**
 * Fields that only a v2 backup may carry. Their absence in v1 means "history
 * was not recorded", which is different from an explicit v2 empty array.
 */
export const BACKUP_V2_HISTORY_FIELDS = [
  "notificationDeliveryState",
  "trackerDailyCheckpoints",
  "torrentDailyCheckpoints",
] as const

export type BackupVersion = (typeof SUPPORTED_BACKUP_VERSIONS)[number]

export interface BackupManifest {
  version: BackupVersion
  appVersion: string
  instanceUrl: string | null
  createdAt: string
  encrypted: boolean
  counts: Record<string, number>
}

export interface BackupPayload {
  manifest: BackupManifest
  settings: Record<string, unknown>
  trackers: Record<string, unknown>[]
  trackerSnapshots: Record<string, unknown>[]
  trackerRoles: Record<string, unknown>[]
  downloadClients: Record<string, unknown>[]
  tagGroups: Record<string, unknown>[]
  tagGroupMembers: Record<string, unknown>[]
  clientSnapshots: Record<string, unknown>[]
  clientUptimeBuckets?: Record<string, unknown>[]
  appCoverageGaps?: Record<string, unknown>[]
  trackerOutages?: Record<string, unknown>[]
  dismissedAlerts?: Record<string, unknown>[]
  notificationTargets?: Record<string, unknown>[]
  // v2-only durable history. Undefined is the v1 sentinel, not "empty".
  notificationDeliveryState?: Record<string, unknown>[]
  trackerDailyCheckpoints?: Record<string, unknown>[]
  torrentDailyCheckpoints?: Record<string, unknown>[]
}

/**
 * Durable history normalized for restore. `null` means the source backup
 * predates the table, so the destination must not invent rows for it.
 */
export interface NormalizedBackupHistory {
  version: BackupVersion
  notificationDeliveryState: Record<string, unknown>[] | null
  trackerDailyCheckpoints: Record<string, unknown>[] | null
  torrentDailyCheckpoints: Record<string, unknown>[] | null
}

export function normalizeBackupHistory(payload: BackupPayload): NormalizedBackupHistory {
  if (payload.manifest.version === LEGACY_BACKUP_VERSION) {
    return {
      version: LEGACY_BACKUP_VERSION,
      notificationDeliveryState: null,
      trackerDailyCheckpoints: null,
      torrentDailyCheckpoints: null,
    }
  }

  return {
    version: CURRENT_BACKUP_VERSION,
    notificationDeliveryState: payload.notificationDeliveryState ?? [],
    trackerDailyCheckpoints: payload.trackerDailyCheckpoints ?? [],
    torrentDailyCheckpoints: payload.torrentDailyCheckpoints ?? [],
  }
}

export interface EncryptedBackupEnvelope {
  format: "tracker-tracker-encrypted-backup"
  version: 1
  createdAt: string
  encryptionSalt: string
  ciphertext: string
}

// Serialize a single value. Converts BigInt to decimal string and Date to ISO 8601.
function serializeValue(value: unknown): unknown {
  if (typeof value === "bigint") {
    return value.toString()
  }
  if (value instanceof Date) {
    return value.toISOString()
  }
  return value
}

// Walk a plain object returned by Drizzle and serialize all leaf values.
function serializeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(row)) {
    out[key] = serializeValue(row[key])
  }
  return out
}

/**
 * Columns a backup carries for each download client
 */
export const BACKUP_CLIENT_COLUMNS = {
  id: downloadClients.id,
  name: downloadClients.name,
  type: downloadClients.type,
  enabled: downloadClients.enabled,
  host: downloadClients.host,
  port: downloadClients.port,
  useSsl: downloadClients.useSsl,
  authMethod: downloadClients.authMethod,
  encryptedUsername: downloadClients.encryptedUsername,
  encryptedPassword: downloadClients.encryptedPassword,
  encryptedApiKey: downloadClients.encryptedApiKey,
  encryptedUrlPath: downloadClients.encryptedUrlPath,
  pollIntervalSeconds: downloadClients.pollIntervalSeconds,
  isDefault: downloadClients.isDefault,
  crossSeedTags: downloadClients.crossSeedTags,
  errorSince: downloadClients.errorSince,
  createdAt: downloadClients.createdAt,
  updatedAt: downloadClients.updatedAt,
} as const

export async function generateBackupPayload(): Promise<BackupPayload> {
  const now = new Date().toISOString()

  const [
    [rawSettings],
    rawTrackers,
    rawSnapshots,
    rawRoles,
    rawClients,
    rawTagGroups,
    rawTagGroupMembers,
    rawClientSnapshots,
    rawUptimeBuckets,
    rawCoverageGaps,
    rawTrackerOutages,
    rawDismissedAlerts,
    allNotificationTargets,
    rawNotificationDeliveryState,
    rawTrackerDailyCheckpoints,
    rawTorrentDailyCheckpoints,
  ] = await Promise.all([
    db.select().from(appSettings).limit(1),
    db.select().from(trackers).orderBy(trackers.id),
    db.select().from(trackerSnapshots).orderBy(trackerSnapshots.id),
    db.select().from(trackerRoles).orderBy(trackerRoles.id),
    db.select(BACKUP_CLIENT_COLUMNS).from(downloadClients).orderBy(downloadClients.id),
    db.select().from(tagGroups).orderBy(tagGroups.id),
    db.select().from(tagGroupMembers).orderBy(tagGroupMembers.id),
    db.select().from(clientSnapshots).orderBy(clientSnapshots.id),
    db.select().from(clientUptimeBuckets).orderBy(clientUptimeBuckets.id),
    // app_coverage_gaps travels with the backup: it explains the snapshots
    // sitting next to it, and a restored history without its explanations reads
    // as "these zeroes were real".
    //
    // app_liveness stays out. It is one mutable row meaning "the live process
    // was here at this instant", and restoring an old lastSeenAt would make the
    // next touchAppLiveness() write one enormous fabricated outage across every
    // chart.
    db.select().from(appCoverageGaps).orderBy(appCoverageGaps.id),
    // tracker_outages travels for the same reason as app_coverage_gaps, and as
    // closed history it cannot fabricate an outage on restore.
    db.select().from(trackerOutages).orderBy(trackerOutages.id),
    db.select().from(dismissedAlerts).orderBy(dismissedAlerts.id),
    db.select().from(notificationTargets).orderBy(notificationTargets.id),
    // Durable cooldown history, not a delivery log. It is restored so a backup
    // does not reset every notification snooze.
    db.select().from(notificationDeliveryState).orderBy(notificationDeliveryState.id),
    db.select().from(trackerDailyCheckpoints).orderBy(trackerDailyCheckpoints.id),
    db.select().from(torrentDailyCheckpoints).orderBy(torrentDailyCheckpoints.id),
  ])

  const settingsPayload: Record<string, unknown> = {}
  if (rawSettings) {
    const {
      id: _id,
      passwordHash: _passwordHash,
      failedLoginAttempts: _failedLoginAttempts,
      encryptedSchedulerKey: _encryptedSchedulerKey,
      createdAt: _createdAt,
      ...rest
    } = rawSettings
    for (const key of Object.keys(rest) as Array<keyof typeof rest>) {
      settingsPayload[key] = serializeValue(rest[key])
    }
  }

  // trackers, exclude transient runtime state
  const trackersPayload = rawTrackers.map((t) => {
    const {
      lastPolledAt: _lpa,
      lastError: _le,
      lastErrorAt: _lea,
      consecutiveFailures: _cf,
      pausedAt: _pa,
      ...rest
    } = t
    return serializeRow(rest as Record<string, unknown>)
  })

  const snapshotsPayload = rawSnapshots.map((s) => serializeRow(s as Record<string, unknown>))
  const rolesPayload = rawRoles.map((r) => serializeRow(r as Record<string, unknown>))

  // downloadClients, cachedTorrents/cachedTorrentsAt/lastPolledAt/lastError excluded at query level
  const clientsPayload = rawClients.map((c) => serializeRow(c as Record<string, unknown>))

  const tagGroupsPayload = rawTagGroups.map((g) => serializeRow(g as Record<string, unknown>))
  const tagGroupMembersPayload = rawTagGroupMembers.map((m) =>
    serializeRow(m as Record<string, unknown>)
  )
  const clientSnapshotsPayload = rawClientSnapshots.map((cs) =>
    serializeRow(cs as Record<string, unknown>)
  )
  const uptimeBucketsPayload = rawUptimeBuckets.map((ub) =>
    serializeRow(ub as Record<string, unknown>)
  )
  const coverageGapsPayload = rawCoverageGaps.map((cg) =>
    serializeRow(cg as Record<string, unknown>)
  )
  const trackerOutagesPayload = rawTrackerOutages.map((o) =>
    serializeRow(o as Record<string, unknown>)
  )
  const dismissedAlertsPayload = rawDismissedAlerts.map((a) =>
    serializeRow(a as Record<string, unknown>)
  )
  const backupNotificationTargets = allNotificationTargets.map(
    ({ lastDeliveryStatus, lastDeliveryAt, lastDeliveryError, ...rest }) =>
      serializeRow(rest as Record<string, unknown>)
  )
  const notificationDeliveryStatePayload = rawNotificationDeliveryState.map((row) =>
    serializeRow(row as Record<string, unknown>)
  )
  const trackerDailyCheckpointsPayload = rawTrackerDailyCheckpoints.map((row) =>
    serializeRow(row as Record<string, unknown>)
  )
  const torrentDailyCheckpointsPayload = rawTorrentDailyCheckpoints.map((row) =>
    serializeRow(row as Record<string, unknown>)
  )

  const counts: Record<string, number> = {
    trackers: trackersPayload.length,
    trackerSnapshots: snapshotsPayload.length,
    trackerRoles: rolesPayload.length,
    downloadClients: clientsPayload.length,
    tagGroups: tagGroupsPayload.length,
    tagGroupMembers: tagGroupMembersPayload.length,
    clientSnapshots: clientSnapshotsPayload.length,
    clientUptimeBuckets: uptimeBucketsPayload.length,
    appCoverageGaps: coverageGapsPayload.length,
    trackerOutages: trackerOutagesPayload.length,
    dismissedAlerts: dismissedAlertsPayload.length,
    notificationTargets: backupNotificationTargets.length,
    notificationDeliveryState: notificationDeliveryStatePayload.length,
    trackerDailyCheckpoints: trackerDailyCheckpointsPayload.length,
    torrentDailyCheckpoints: torrentDailyCheckpointsPayload.length,
  }

  const manifest: BackupManifest = {
    version: CURRENT_BACKUP_VERSION,
    appVersion: packageJson.version,
    instanceUrl: process.env.BASE_URL || null,
    createdAt: now,
    encrypted: false,
    counts,
  }

  return {
    manifest,
    settings: settingsPayload,
    trackers: trackersPayload,
    trackerSnapshots: snapshotsPayload,
    trackerRoles: rolesPayload,
    downloadClients: clientsPayload,
    tagGroups: tagGroupsPayload,
    tagGroupMembers: tagGroupMembersPayload,
    clientSnapshots: clientSnapshotsPayload,
    clientUptimeBuckets: uptimeBucketsPayload,
    appCoverageGaps: coverageGapsPayload,
    trackerOutages: trackerOutagesPayload,
    dismissedAlerts: dismissedAlertsPayload,
    notificationTargets: backupNotificationTargets,
    notificationDeliveryState: notificationDeliveryStatePayload,
    trackerDailyCheckpoints: trackerDailyCheckpointsPayload,
    torrentDailyCheckpoints: torrentDailyCheckpointsPayload,
  }
}

// ─── Validation helpers ───────────────────────────────────────────────────────

export const VALID_BACKUP_FREQUENCIES = new Set(["daily", "weekly", "monthly"])

function assertString(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string") {
    throw new Error(`Backup validation: ${label} must be a string`)
  }
}

function assertNumber(value: unknown, label: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Backup validation: ${label} must be a number`)
  }
}

function assertArray(value: unknown, label: string): asserts value is unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`Backup validation: ${label} must be an array`)
  }
}

function assertValidIso(value: unknown, label: string): void {
  assertString(value, label)
  if (!ISO_8601_RE.test(value)) {
    throw new Error(`Backup validation: ${label} must be a valid ISO 8601 string`)
  }
}

function assertNullableIso(value: unknown, label: string): void {
  if (value === null || value === undefined) return
  assertValidIso(value, label)
}

function assertInteger(value: unknown, label: string): asserts value is number {
  assertNumber(value, label)
  if (!Number.isInteger(value)) {
    throw new Error(`Backup validation: ${label} must be an integer`)
  }
}

function assertPositiveId(value: unknown, label: string): asserts value is number {
  assertInteger(value, label)
  if (value < 1) {
    throw new Error(`Backup validation: ${label} must be a positive integer`)
  }
}

function assertNonNegativeInteger(value: unknown, label: string): void {
  assertInteger(value, label)
  if (value < 0) {
    throw new Error(`Backup validation: ${label} must be a non-negative integer`)
  }
}

function assertDateOnly(value: unknown, label: string): void {
  assertString(value, label)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Backup validation: ${label} must be a YYYY-MM-DD date`)
  }
}

function assertBigIntString(value: unknown, label: string): void {
  assertString(value, label)
  try {
    BigInt(value)
  } catch {
    throw new Error(`Backup validation: ${label} must be parseable as BigInt`)
  }
}

// ─── Relationship and durable-history validation ──────────────────────────────

function requiredBackupIds(
  rows: Record<string, unknown>[],
  label: string,
  isV2: boolean
): Set<number> {
  const ids = new Set<number>()
  for (let i = 0; i < rows.length; i++) {
    const id = rows[i].id
    // Real v1 exports already carried ids (restore has always remapped on
    // them). v2 additionally depends on them for delivery-state and scope
    // remapping, so it rejects a missing id rather than building an
    // undefined-keyed map.
    if (isV2 || id !== undefined) assertPositiveId(id, `${label}[${i}].id`)
    if (id === undefined) continue
    const numericId = id as number
    if (ids.has(numericId)) {
      throw new Error(`Backup validation: duplicate ${label} id ${numericId}`)
    }
    ids.add(numericId)
  }
  return ids
}

function assertReference(
  present: Set<number>,
  value: unknown,
  label: string,
  field: string
): void {
  assertPositiveId(value, `${label}.${field}`)
  if (!present.has(value)) {
    throw new Error(`Backup validation: ${label}.${field} references a missing row`)
  }
}

function assertUniqueComposite(
  seen: Set<string>,
  key: string,
  label: string
): void {
  if (seen.has(key)) {
    throw new Error(`Backup validation: duplicate ${label}`)
  }
  seen.add(key)
}

function validateV2History(payload: Record<string, unknown>): void {
  const trackersRows = payload.trackers as Record<string, unknown>[]
  const clientsRows = payload.downloadClients as Record<string, unknown>[]
  const targetRows = payload.notificationTargets as Record<string, unknown>[]
  const trackerIds = requiredBackupIds(trackersRows, "trackers", true)
  const clientIds = requiredBackupIds(clientsRows, "downloadClients", true)
  const targetIds = requiredBackupIds(targetRows, "notificationTargets", true)

  // Every child reference must resolve inside the backup. The v1 path keeps its
  // historical "skip orphaned children" behavior; v2 fails before any delete.
  for (let i = 0; i < (payload.trackerSnapshots as unknown[]).length; i++) {
    const row = (payload.trackerSnapshots as Record<string, unknown>[])[i]
    assertReference(trackerIds, row.trackerId, `trackerSnapshots[${i}]`, "trackerId")
  }
  for (let i = 0; i < (payload.trackerRoles as unknown[]).length; i++) {
    const row = (payload.trackerRoles as Record<string, unknown>[])[i]
    assertReference(trackerIds, row.trackerId, `trackerRoles[${i}]`, "trackerId")
  }
  for (let i = 0; i < ((payload.trackerOutages as unknown[]) ?? []).length; i++) {
    const row = (payload.trackerOutages as Record<string, unknown>[])[i]
    assertReference(trackerIds, row.trackerId, `trackerOutages[${i}]`, "trackerId")
  }
  for (let i = 0; i < (payload.clientSnapshots as unknown[]).length; i++) {
    const row = (payload.clientSnapshots as Record<string, unknown>[])[i]
    assertReference(clientIds, row.clientId, `clientSnapshots[${i}]`, "clientId")
  }
  for (let i = 0; i < ((payload.clientUptimeBuckets as unknown[]) ?? []).length; i++) {
    const row = (payload.clientUptimeBuckets as Record<string, unknown>[])[i]
    assertReference(clientIds, row.clientId, `clientUptimeBuckets[${i}]`, "clientId")
  }

  const tagGroupIds = requiredBackupIds(
    payload.tagGroups as Record<string, unknown>[],
    "tagGroups",
    true
  )
  for (let i = 0; i < (payload.tagGroupMembers as unknown[]).length; i++) {
    const row = (payload.tagGroupMembers as Record<string, unknown>[])[i]
    assertReference(tagGroupIds, row.groupId, `tagGroupMembers[${i}]`, "groupId")
  }

  for (let i = 0; i < targetRows.length; i++) {
    const scope = targetRows[i].scope
    if (scope === null || scope === undefined) continue
    assertArray(scope, `notificationTargets[${i}].scope`)
    for (let s = 0; s < scope.length; s++) {
      assertReference(
        trackerIds,
        scope[s],
        `notificationTargets[${i}].scope[${s}]`,
        "trackerId"
      )
    }
  }

  // notification_delivery_state: durable cooldown history. It is not an
  // in-flight lease, so every row is preserved; its relationships must be
  // resolvable or the whole restore is rejected.
  const deliverySeen = new Set<string>()
  const deliveryRows = payload.notificationDeliveryState as Record<string, unknown>[]
  for (let i = 0; i < deliveryRows.length; i++) {
    const row = deliveryRows[i]
    const label = `notificationDeliveryState[${i}]`
    assertReference(targetIds, row.targetId, label, "targetId")
    if (row.trackerId !== null && row.trackerId !== undefined) {
      assertReference(trackerIds, row.trackerId, label, "trackerId")
    }
    assertString(row.eventType, `${label}.eventType`)
    if (row.eventType.length === 0 || row.eventType.length > 50) {
      throw new Error(`Backup validation: ${label}.eventType must be 1..50 characters`)
    }
    assertValidIso(row.lastNotifiedAt, `${label}.lastNotifiedAt`)
    assertNullableIso(row.snoozedUntil, `${label}.snoozedUntil`)
    assertUniqueComposite(
      deliverySeen,
      `${row.targetId}:${row.trackerId ?? "null"}:${row.eventType}`,
      "notificationDeliveryState row"
    )
  }

  const trackerCheckpointSeen = new Set<string>()
  const trackerCheckpointRows = payload.trackerDailyCheckpoints as Record<string, unknown>[]
  for (let i = 0; i < trackerCheckpointRows.length; i++) {
    const row = trackerCheckpointRows[i]
    const label = `trackerDailyCheckpoints[${i}]`
    assertReference(trackerIds, row.trackerId, label, "trackerId")
    assertDateOnly(row.checkpointDate, `${label}.checkpointDate`)
    assertBigIntString(row.uploadedBytesEnd, `${label}.uploadedBytesEnd`)
    assertBigIntString(row.downloadedBytesEnd, `${label}.downloadedBytesEnd`)
    if (row.bufferBytesEnd !== null && row.bufferBytesEnd !== undefined) {
      assertBigIntString(row.bufferBytesEnd, `${label}.bufferBytesEnd`)
    }
    if (row.ratioEnd !== null && row.ratioEnd !== undefined) {
      assertNumber(row.ratioEnd, `${label}.ratioEnd`)
    }
    if (row.seedbonusEnd !== null && row.seedbonusEnd !== undefined) {
      assertNumber(row.seedbonusEnd, `${label}.seedbonusEnd`)
    }
    assertNonNegativeInteger(row.snapshotCount, `${label}.snapshotCount`)
    assertUniqueComposite(
      trackerCheckpointSeen,
      `${row.trackerId}:${row.checkpointDate}`,
      "trackerDailyCheckpoints row"
    )
  }

  const torrentCheckpointSeen = new Set<string>()
  const torrentCheckpointRows = payload.torrentDailyCheckpoints as Record<string, unknown>[]
  for (let i = 0; i < torrentCheckpointRows.length; i++) {
    const row = torrentCheckpointRows[i]
    const label = `torrentDailyCheckpoints[${i}]`
    assertReference(clientIds, row.clientId, label, "clientId")
    assertString(row.hash, `${label}.hash`)
    if (row.hash.length === 0 || row.hash.length > 64) {
      throw new Error(`Backup validation: ${label}.hash must be 1..64 characters`)
    }
    assertString(row.name, `${label}.name`)
    assertDateOnly(row.checkpointDate, `${label}.checkpointDate`)
    assertBigIntString(row.uploadedStart, `${label}.uploadedStart`)
    assertBigIntString(row.downloadedStart, `${label}.downloadedStart`)
    assertUniqueComposite(
      torrentCheckpointSeen,
      `${row.clientId}:${row.hash}:${row.checkpointDate}`,
      "torrentDailyCheckpoints row"
    )
  }

  const countObject = (payload.manifest as Record<string, unknown>).counts as Record<
    string,
    unknown
  >
  for (const [field, rows] of [
    ["trackers", payload.trackers],
    ["trackerSnapshots", payload.trackerSnapshots],
    ["trackerRoles", payload.trackerRoles],
    ["downloadClients", payload.downloadClients],
    ["tagGroups", payload.tagGroups],
    ["tagGroupMembers", payload.tagGroupMembers],
    ["clientSnapshots", payload.clientSnapshots],
    ["clientUptimeBuckets", payload.clientUptimeBuckets],
    ["appCoverageGaps", payload.appCoverageGaps],
    ["trackerOutages", payload.trackerOutages],
    ["dismissedAlerts", payload.dismissedAlerts],
    ["notificationTargets", payload.notificationTargets],
    ["notificationDeliveryState", payload.notificationDeliveryState],
    ["trackerDailyCheckpoints", payload.trackerDailyCheckpoints],
    ["torrentDailyCheckpoints", payload.torrentDailyCheckpoints],
  ] as const) {
    if (countObject[field] !== (rows as unknown[]).length) {
      throw new Error(
        `Backup validation: manifest.counts.${field} must equal the ${field} array length`
      )
    }
  }
}

// ─── Public validation ────────────────────────────────────────────────────────

export function validateBackupJson(payload: unknown): asserts payload is BackupPayload {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("Backup validation: payload must be an object")
  }

  const p = payload as Record<string, unknown>

  // manifest
  if (typeof p.manifest !== "object" || p.manifest === null) {
    throw new Error("Backup validation: manifest must be an object")
  }
  const manifest = p.manifest as Record<string, unknown>

  if (
    manifest.version !== LEGACY_BACKUP_VERSION &&
    manifest.version !== CURRENT_BACKUP_VERSION
  ) {
    throw new Error(
      `Backup validation: unsupported backup version ${String(manifest.version)} (supported: ${SUPPORTED_BACKUP_VERSIONS.join(", ")})`
    )
  }
  const isV2 = manifest.version === CURRENT_BACKUP_VERSION

  assertValidIso(manifest.createdAt, "manifest.createdAt")

  if (
    typeof manifest.counts !== "object" ||
    manifest.counts === null ||
    Array.isArray(manifest.counts)
  ) {
    throw new Error("Backup validation: manifest.counts must be an object")
  }
  for (const [k, v] of Object.entries(manifest.counts as Record<string, unknown>)) {
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0) {
      throw new Error(`Backup validation: manifest.counts.${k} must be a non-negative integer`)
    }
  }

  // settings
  if (typeof p.settings !== "object" || p.settings === null) {
    throw new Error("Backup validation: settings must be an object")
  }
  const settings = p.settings as Record<string, unknown>

  assertString(settings.encryptionSalt, "settings.encryptionSalt")
  if (!HEX_64_RE.test(settings.encryptionSalt)) {
    throw new Error("Backup validation: settings.encryptionSalt must be exactly 64 hex characters")
  }

  if (settings.backupScheduleFrequency !== undefined) {
    assertString(settings.backupScheduleFrequency, "settings.backupScheduleFrequency")
    if (!VALID_BACKUP_FREQUENCIES.has(settings.backupScheduleFrequency)) {
      throw new Error(
        `Backup validation: settings.backupScheduleFrequency must be one of: ${[...VALID_BACKUP_FREQUENCIES].join(", ")}`
      )
    }
  }

  if (settings.backupRetentionCount !== undefined) {
    assertNumber(settings.backupRetentionCount, "settings.backupRetentionCount")
    if (
      !Number.isInteger(settings.backupRetentionCount) ||
      settings.backupRetentionCount < 1 ||
      settings.backupRetentionCount > 365
    ) {
      throw new Error(
        "Backup validation: settings.backupRetentionCount must be an integer between 1 and 365"
      )
    }
  }

  // array fields
  assertArray(p.trackers, "trackers")
  assertArray(p.trackerSnapshots, "trackerSnapshots")
  assertArray(p.trackerRoles, "trackerRoles")
  assertArray(p.downloadClients, "downloadClients")
  assertArray(p.tagGroups, "tagGroups")
  assertArray(p.tagGroupMembers, "tagGroupMembers")
  assertArray(p.clientSnapshots, "clientSnapshots")

  // v2 history presence is explicit. A v1 payload carrying v2 fields is
  // malformed rather than silently reinterpreted, and a v2 payload missing a
  // field cannot be mistaken for an older export with no history.
  for (const field of BACKUP_V2_HISTORY_FIELDS) {
    if (isV2) {
      assertArray(p[field], field)
    } else if (p[field] !== undefined) {
      throw new Error(`Backup validation: version 1 backup must not contain ${field}`)
    }
  }
  // clientUptimeBuckets is optional for backward compatibility with older backups
  if (isV2 || p.clientUptimeBuckets !== undefined) {
    assertArray(p.clientUptimeBuckets, "clientUptimeBuckets")
    for (let i = 0; i < p.clientUptimeBuckets.length; i++) {
      const ub = p.clientUptimeBuckets[i] as Record<string, unknown>
      const prefix = `clientUptimeBuckets[${i}]`
      assertNumber(ub.clientId, `${prefix}.clientId`)
      assertValidIso(ub.bucketTs, `${prefix}.bucketTs`)
      assertNumber(ub.ok, `${prefix}.ok`)
      assertNumber(ub.fail, `${prefix}.fail`)
    }
  }
  // trackerOutages is optional for backward compatibility with older backups
  if (isV2 || p.trackerOutages !== undefined) {
    assertArray(p.trackerOutages, "trackerOutages")
    for (let i = 0; i < p.trackerOutages.length; i++) {
      const o = p.trackerOutages[i] as Record<string, unknown>
      const prefix = `trackerOutages[${i}]`
      assertString(o.startedAt, `${prefix}.startedAt`)
      assertString(o.endedAt, `${prefix}.endedAt`)
      assertValidIso(o.startedAt, `${prefix}.startedAt`)
      assertValidIso(o.endedAt, `${prefix}.endedAt`)
      assertString(o.reason, `${prefix}.reason`)
      // Closed intervals only, same as coverage gaps. A zero-length row is
      // legitimate here (one observed failure) so only inversion is rejected.
      if (new Date(o.endedAt).getTime() < new Date(o.startedAt).getTime()) {
        throw new Error(`Backup validation: ${prefix}.endedAt must not precede startedAt`)
      }
    }
  }
  // appCoverageGaps is optional for backward compatibility with older backups
  if (isV2 || p.appCoverageGaps !== undefined) {
    assertArray(p.appCoverageGaps, "appCoverageGaps")
    for (let i = 0; i < p.appCoverageGaps.length; i++) {
      const cg = p.appCoverageGaps[i] as Record<string, unknown>
      const prefix = `appCoverageGaps[${i}]`
      assertString(cg.startedAt, `${prefix}.startedAt`)
      assertString(cg.endedAt, `${prefix}.endedAt`)
      assertValidIso(cg.startedAt, `${prefix}.startedAt`)
      assertValidIso(cg.endedAt, `${prefix}.endedAt`)
      assertString(cg.reason, `${prefix}.reason`)
      // Closed intervals only, an inverted or open-ended gap would band the
      // chart backwards or band the present.
      if (new Date(cg.endedAt).getTime() < new Date(cg.startedAt).getTime()) {
        throw new Error(`Backup validation: ${prefix}.endedAt must not precede startedAt`)
      }
    }
  }
  // dismissedAlerts is optional for backward compatibility with older backups
  if (isV2 || p.dismissedAlerts !== undefined) {
    assertArray(p.dismissedAlerts, "dismissedAlerts")
  }
  // notificationTargets is optional for backward compatibility with older backups
  if (isV2 || p.notificationTargets !== undefined) {
    assertArray(p.notificationTargets, "notificationTargets")
    for (let i = 0; i < p.notificationTargets.length; i++) {
      const nt = p.notificationTargets[i] as Record<string, unknown>
      const prefix = `notificationTargets[${i}]`
      assertString(nt.name, `${prefix}.name`)
      assertString(nt.encryptedConfig, `${prefix}.encryptedConfig`)
      assertString(nt.type, `${prefix}.type`)
      if (
        !VALID_NOTIFICATION_TYPES.includes(nt.type as (typeof VALID_NOTIFICATION_TYPES)[number])
      ) {
        throw new Error(
          `Backup validation: ${prefix}.type must be one of: ${VALID_NOTIFICATION_TYPES.join(", ")}`
        )
      }
    }
  }

  // tracker entries
  for (let i = 0; i < p.trackers.length; i++) {
    const t = p.trackers[i] as Record<string, unknown>
    const prefix = `trackers[${i}]`

    assertString(t.name, `${prefix}.name`)
    if (t.name.length === 0 || t.name.length > 100) {
      throw new Error(`Backup validation: ${prefix}.name must be between 1 and 100 characters`)
    }

    assertString(t.baseUrl, `${prefix}.baseUrl`)
    let parsedUrl: URL
    try {
      parsedUrl = new URL(t.baseUrl)
    } catch {
      throw new Error(`Backup validation: ${prefix}.baseUrl is not a valid URL`)
    }
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      throw new Error(`Backup validation: ${prefix}.baseUrl must use http or https`)
    }
    if (isUnsafeNetworkHost(parsedUrl.hostname)) {
      throw new Error(
        `Backup validation: ${prefix}.baseUrl must not target localhost or a private network address`
      )
    }

    assertString(t.encryptedApiToken, `${prefix}.encryptedApiToken`)
    // Empty token is valid, happens after a restore clears encrypted fields

    // Optional: backups predating the column carry no slug, and a pre-registry
    // custom site legitimately carries null. Only the type is checked here;
    // registryEntryFor returns undefined for an unknown slug on read.
    if (t.registrySlug !== null && t.registrySlug !== undefined) {
      assertString(t.registrySlug, `${prefix}.registrySlug`)
    }

    if (t.color !== null && t.color !== undefined) {
      assertString(t.color, `${prefix}.color`)
      if (!isValidHex(t.color, true)) {
        throw new Error(`Backup validation: ${prefix}.color must be a valid hex color or null`)
      }
    }
  }

  // trackerSnapshot entries
  for (let i = 0; i < p.trackerSnapshots.length; i++) {
    const s = p.trackerSnapshots[i] as Record<string, unknown>
    const prefix = `trackerSnapshots[${i}]`

    assertNumber(s.trackerId, `${prefix}.trackerId`)

    assertString(s.uploadedBytes, `${prefix}.uploadedBytes`)
    try {
      BigInt(s.uploadedBytes)
    } catch {
      throw new Error(`Backup validation: ${prefix}.uploadedBytes must be parseable as BigInt`)
    }

    assertString(s.downloadedBytes, `${prefix}.downloadedBytes`)
    try {
      BigInt(s.downloadedBytes)
    } catch {
      throw new Error(`Backup validation: ${prefix}.downloadedBytes must be parseable as BigInt`)
    }

    assertValidIso(s.polledAt, `${prefix}.polledAt`)
  }

  // downloadClient entries
  for (let i = 0; i < p.downloadClients.length; i++) {
    const c = p.downloadClients[i] as Record<string, unknown>
    const prefix = `downloadClients[${i}]`

    assertString(c.host, `${prefix}.host`)
    // Restore is the third writer of downloadClients.host. Both API routes
    // gate it on PROXY_HOST_PATTERN; without the same gate here a restored
    // backup could seed a host the routes would have refused. Their
    // validateClientHost is left out on purpose: it guards a mistake that only
    // breaks polling, and here one such row would refuse the whole backup.
    if (!PROXY_HOST_PATTERN.test(c.host as string)) {
      throw new Error(`Backup validation: ${prefix}.host contains invalid characters`)
    }

    assertNumber(c.port, `${prefix}.port`)
    if (!isValidPort(c.port)) {
      throw new Error(`Backup validation: ${prefix}.port must be an integer between 1 and 65535`)
    }

    assertString(c.encryptedUsername, `${prefix}.encryptedUsername`)
    // Empty credentials are valid, happens after a restore clears encrypted fields
    assertString(c.encryptedPassword, `${prefix}.encryptedPassword`)

    // Both absent in backups written before API-key auth existed, so these are
    // presence-guarded, but when present they are read as strings and must be.
    if (typeof c.authMethod !== "undefined") assertString(c.authMethod, `${prefix}.authMethod`)
    if (typeof c.encryptedApiKey !== "undefined") {
      assertString(c.encryptedApiKey, `${prefix}.encryptedApiKey`)
    }
    if (typeof c.encryptedUrlPath !== "undefined") {
      assertString(c.encryptedUrlPath, `${prefix}.encryptedUrlPath`)
    }
  }

  // tagGroupMember entries
  for (let i = 0; i < p.tagGroupMembers.length; i++) {
    const m = p.tagGroupMembers[i] as Record<string, unknown>
    const prefix = `tagGroupMembers[${i}]`

    assertNumber(m.groupId, `${prefix}.groupId`)
    assertString(m.tag, `${prefix}.tag`)
    assertString(m.label, `${prefix}.label`)
  }

  if (isV2) validateV2History(p)
}

// ─── Encryption wrappers ──────────────────────────────────────────────────────

export async function encryptBackupPayload(
  payload: BackupPayload,
  password: string
): Promise<EncryptedBackupEnvelope> {
  const encryptionSalt = generateSalt()
  const encryptionKey = await deriveKey(password, encryptionSalt)
  const jsonString = JSON.stringify(payload)
  const ciphertext = encrypt(jsonString, encryptionKey)
  return {
    format: "tracker-tracker-encrypted-backup",
    version: 1,
    createdAt: new Date().toISOString(),
    encryptionSalt,
    ciphertext,
  }
}

export function decryptBackupPayload(
  envelope: EncryptedBackupEnvelope,
  encryptionKey: Buffer
): BackupPayload {
  if (envelope.format !== "tracker-tracker-encrypted-backup") {
    throw new Error(
      `Invalid backup envelope format: expected "tracker-tracker-encrypted-backup", got "${envelope.format}"`
    )
  }
  const jsonString = decrypt(envelope.ciphertext, encryptionKey)
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonString)
  } catch {
    throw new Error(
      "Failed to parse decrypted backup. The data may be corrupted, or the wrong key was used"
    )
  }
  validateBackupJson(parsed)
  return parsed
}

/**
 * Decrypts the stored backup password if encryption is enabled.
 * Returns null if encryption is not enabled or no password is stored.
 * Throws on decrypt failure (callers handle errors differently).
 */
export function resolveBackupPassword(
  encryptionEnabled: boolean,
  encryptedPassword: string | null,
  key: Buffer
): string | null {
  if (!encryptionEnabled || !encryptedPassword) return null
  return decrypt(encryptedPassword, key)
}

// ─── Pruning ──────────────────────────────────────────────────────────────────

export async function pruneOldBackups(retentionCount: number, basePath: string): Promise<number> {
  const allStored = await db
    .select()
    .from(backupHistory)
    .where(isNotNull(backupHistory.storagePath))
    .orderBy(desc(backupHistory.createdAt))

  if (allStored.length <= retentionCount) {
    return 0
  }

  const toDelete = allStored.slice(retentionCount)

  for (const row of toDelete) {
    if (row.storagePath !== null) {
      const resolved = path.resolve(row.storagePath)
      const base = path.resolve(basePath)
      if (!resolved.startsWith(base + path.sep)) {
        log.error(`Backup prune: path ${resolved} is outside base ${base}, skipping file deletion`)
      } else {
        try {
          await unlink(resolved)
        } catch (err) {
          log.error(err, `Backup prune: failed to delete file ${resolved}`)
        }
      }
    }
  }

  const idsToDelete = toDelete.map((row) => row.id)
  if (idsToDelete.length > 0) {
    await db.delete(backupHistory).where(inArray(backupHistory.id, idsToDelete))
  }

  return idsToDelete.length
}
