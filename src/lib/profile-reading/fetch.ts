// src/lib/profile-reading/fetch.ts
//
// P49 daily profile reads. One request per tracker per 24 hours, separate from
// the normal poll cycle. The page is read with the user's pasted session cookie
// and nothing here touches a tracker that did not opt in.

import "server-only"

import { and, desc, eq, isNotNull } from "drizzle-orm"
import { decrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { appSettings, trackerSnapshots, trackers } from "@/lib/db/schema"
import { errMsg } from "@/lib/error-utils"
import { trackerDateStr } from "@/lib/formatters"
import { log } from "@/lib/logger"
import { withProfileReadRecord } from "@/lib/profile-reading/meta"
import { profileReadFailed, profileReadStopped, readProfilePageOnce } from "@/lib/profile-reading/read"
import { supportsProfileReading } from "@/lib/profile-reading/support"
import {
  isProfileReadDue,
  type ProfileReadRecord,
  readProfileReadRecord,
} from "@/lib/profile-reading/types"
import { profilePageUrl } from "@/lib/profile-reading/urls"
import { SessionExpiredError } from "@/lib/tracker-platforms/helpers/errors"
import { fetchTrackerHtml } from "@/lib/tracker-platforms/helpers/html-fetch"
import { buildProxyAgentFromSettings } from "@/lib/tunnel"

const LOGIN_PATTERN = /\/(login|signin|sign-in|auth\/login|connexion)(?:[/?#]|$)/i

const g = globalThis as typeof globalThis & {
  __profileReadInFlight?: boolean
}

/**
 * Reads every enabled tracker whose last attempt is at least 24 hours old and
 * whose last outcome did not stop reading. Sequential on purpose: this is one
 * request per tracker, not a fan-out, and a daily cadence has no latency goal.
 */
export async function runProfileReads(
  encryptionKey: Buffer,
  now: Date = new Date()
): Promise<void> {
  if (g.__profileReadInFlight) return
  g.__profileReadInFlight = true
  try {
    const rows = await db
      .select({
        id: trackers.id,
        name: trackers.name,
        baseUrl: trackers.baseUrl,
        registrySlug: trackers.registrySlug,
        platformType: trackers.platformType,
        platformMeta: trackers.platformMeta,
        lastAccessAt: trackers.lastAccessAt,
        encryptedProfileCookie: trackers.encryptedProfileCookie,
      })
      .from(trackers)
      .where(
        and(
          eq(trackers.isActive, true),
          eq(trackers.profileReadingEnabled, true),
          isNotNull(trackers.encryptedProfileCookie)
        )
      )

    const candidates = rows.filter((row) => supportsProfileReading(row))
    if (candidates.length === 0) return

    const [settings] = await db
      .select({
        proxyEnabled: appSettings.proxyEnabled,
        proxyType: appSettings.proxyType,
        proxyHost: appSettings.proxyHost,
        proxyPort: appSettings.proxyPort,
        proxyUsername: appSettings.proxyUsername,
        encryptedProxyPassword: appSettings.encryptedProxyPassword,
      })
      .from(appSettings)
      .limit(1)

    const proxyAgent = settings ? buildProxyAgentFromSettings(settings, encryptionKey) : undefined

    for (const row of candidates) {
      const previous = readProfileReadRecord(row.platformMeta)
      if (!isProfileReadDue(previous, now)) continue

      const [latest] = await db
        .select({ username: trackerSnapshots.username })
        .from(trackerSnapshots)
        .where(eq(trackerSnapshots.trackerId, row.id))
        .orderBy(desc(trackerSnapshots.polledAt), desc(trackerSnapshots.id))
        .limit(1)

      const username = latest?.username?.trim()
      const url =
        username && row.registrySlug
          ? profilePageUrl(row.registrySlug, row.baseUrl, username)
          : null
      if (!url) {
        const next = profileReadFailed(
          previous,
          now.toISOString(),
          "No profile username is known for this tracker yet."
        )
        await persist(row.id, row.platformMeta, next.record)
        continue
      }

      let cookie: string
      try {
        cookie = decrypt(row.encryptedProfileCookie as string, encryptionKey)
      } catch {
        const next = profileReadStopped(
          previous,
          now.toISOString(),
          "session_expired",
          "Session expired. Paste a new profile cookie."
        )
        await persist(row.id, row.platformMeta, next.record)
        continue
      }

      try {
        const html = await fetchTrackerHtml({
          url,
          cookies: cookie,
          label: row.name,
          sessionExpiredMessage: "Session expired. Paste a new profile cookie.",
          followRedirects: { loginPattern: LOGIN_PATTERN },
          proxyAgent,
        })
        const next = readProfilePageOnce({
          registrySlug: row.registrySlug as string,
          html,
          previous,
          now,
        })
        await persist(
          row.id,
          row.platformMeta,
          next.record,
          detectedLoginFor(row, next.record)
        )
        log.info(
          {
            trackerId: row.id,
            status: next.record.status ?? "ok",
            values: Object.keys(next.record.values),
          },
          "profile page read"
        )
      } catch (err) {
        const next =
          err instanceof SessionExpiredError
            ? profileReadStopped(
                previous,
                now.toISOString(),
                "session_expired",
                "Session expired. Paste a new profile cookie."
              )
            : profileReadFailed(previous, now.toISOString(), errMsg(err))
        await persist(row.id, row.platformMeta, next.record)
        log.warn({ trackerId: row.id, error: errMsg(err) }, "profile page read failed")
      }
    }
  } finally {
    g.__profileReadInFlight = false
  }
}

/**
 * A profile read only becomes a detected login on a UNIT3D tracker, and only
 * when its "Last login" is not older than the date already stored. The latter
 * keeps a manual mark made after the page was fetched from being rolled back.
 */
function detectedLoginFor(
  row: { platformType: string; lastAccessAt: string | null },
  record: ProfileReadRecord
): string | undefined {
  if (row.platformType !== "unit3d" || record.status || !record.values.lastLoginAt) {
    return undefined
  }
  const date = trackerDateStr(record.values.lastLoginAt)
  if (!date) return undefined
  if (row.lastAccessAt && date < row.lastAccessAt) return undefined
  return date
}

async function persist(
  trackerId: number,
  currentMeta: string | null,
  record: ProfileReadRecord,
  detectedLoginAt?: string
): Promise<void> {
  const values: {
    platformMeta: string
    lastAccessAt?: string
    lastAccessSource?: "detected"
  } = {
    platformMeta: withProfileReadRecord(currentMeta, record),
  }
  if (detectedLoginAt) {
    values.lastAccessAt = detectedLoginAt
    values.lastAccessSource = "detected"
  }
  await db.update(trackers).set(values).where(eq(trackers.id, trackerId))
}
