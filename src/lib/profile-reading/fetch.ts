// src/lib/profile-reading/fetch.ts
//
// P49 daily profile reads. One request per tracker per 24 hours, separate from
// the normal poll cycle. The page is read with the user's pasted session cookie
// and nothing here touches a tracker that did not opt in.

import "server-only"

import { and, desc, eq, isNotNull } from "drizzle-orm"
import { db } from "@/lib/db"
import { appSettings, trackerSnapshots, trackers } from "@/lib/db/schema"
import { errMsg } from "@/lib/error-utils"
import { log } from "@/lib/logger"
import { withProfileReadRecord } from "@/lib/profile-reading/meta"
import { parseProfilePage } from "@/lib/profile-reading/parse"
import { looksLikeLoginPage, profilePageUrl } from "@/lib/profile-reading/urls"
import { supportsProfileReading } from "@/lib/profile-reading/support"
import {
  isProfileReadDue,
  readProfileReadRecord,
  type ProfileReadRecord,
  type ProfileReadStatus,
  type ProfileReadValues,
} from "@/lib/profile-reading/types"
import { buildProxyAgentFromSettings } from "@/lib/tunnel"
import { decrypt } from "@/lib/crypto"
import { SessionExpiredError } from "@/lib/tracker-platforms/helpers/errors"
import { fetchTrackerHtml } from "@/lib/tracker-platforms/helpers/html-fetch"

const LOGIN_PATTERN = /\/(login|signin|sign-in|auth\/login|connexion)(?:[/?#]|$)/i

export { looksLikeLoginPage, profilePageUrl } from "@/lib/profile-reading/urls"

export interface ProfileReadOutcome {
  record: ProfileReadRecord
  /** True when the fetch itself succeeded, even if no value was parsed. */
  fetched: boolean
}

function stopped(
  previous: ProfileReadRecord | null,
  attemptedAt: string,
  status: ProfileReadStatus,
  message: string
): ProfileReadOutcome {
  return {
    fetched: false,
    record: {
      fetchedAt: previous?.fetchedAt ?? null,
      attemptedAt,
      status,
      values: previous?.values ?? {},
      message,
    },
  }
}

function failed(
  previous: ProfileReadRecord | null,
  attemptedAt: string,
  message: string
): ProfileReadOutcome {
  return {
    fetched: false,
    record: {
      fetchedAt: previous?.fetchedAt ?? null,
      attemptedAt,
      status: null,
      values: previous?.values ?? {},
      message,
    },
  }
}

function succeeded(
  attemptedAt: string,
  values: ProfileReadValues
): ProfileReadOutcome {
  return {
    fetched: true,
    record: {
      fetchedAt: attemptedAt,
      attemptedAt,
      status: null,
      values,
    },
  }
}

/** Reads one tracker once. Exported for the unit tests' injected HTML. */
export function readProfilePageOnce(input: {
  registrySlug: string
  html: string
  previous: ProfileReadRecord | null
  now: Date
}): ProfileReadOutcome {
  const attemptedAt = input.now.toISOString()
  if (looksLikeLoginPage(input.html)) {
    return stopped(
      input.previous,
      attemptedAt,
      "session_expired",
      "Session expired. Paste a new profile cookie."
    )
  }
  const parsed = parseProfilePage(input.registrySlug, input.html)
  if (!parsed) {
    return stopped(
      input.previous,
      attemptedAt,
      "page_changed",
      "Page changed. The tracker layout no longer matches."
    )
  }
  return succeeded(attemptedAt, parsed.values)
}

const g = globalThis as typeof globalThis & {
  __profileReadInFlight?: boolean
}

/** Exposed for the scheduler tests; the runner is deliberately single-flight. */
export function isProfileReadingRunning(): boolean {
  return g.__profileReadInFlight ?? false
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
        const next = failed(
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
        const next = stopped(
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
        await persist(row.id, row.platformMeta, next.record)
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
            ? stopped(
                previous,
                now.toISOString(),
                "session_expired",
                "Session expired. Paste a new profile cookie."
              )
            : failed(previous, now.toISOString(), errMsg(err))
        await persist(row.id, row.platformMeta, next.record)
        log.warn({ trackerId: row.id, error: errMsg(err) }, "profile page read failed")
      }
    }
  } finally {
    g.__profileReadInFlight = false
  }
}

async function persist(
  trackerId: number,
  currentMeta: string | null,
  record: ProfileReadRecord
): Promise<void> {
  await db
    .update(trackers)
    .set({ platformMeta: withProfileReadRecord(currentMeta, record) })
    .where(eq(trackers.id, trackerId))
}
