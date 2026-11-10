// src/lib/tracker-platforms/adapters/czteam.ts
//
// Functions: parseCzteamCredentials, assertAuthenticated, canonicalLabel,
//            labelGroup, readLabelValues, escapeRegExp, readInlineValues,
//            parseCzteamHeader, parseCzteamProfile, mergeMeta, errorMessage,
//            CzteamAdapter
//
// CZTeam runs a customised NexusPHP build. Its api.php is torrent search only
// (Prowlarr's czteam-api.yml documents latest-torrents, search-torrents and
// download, no user action), so the account totals come from the logged-in
// pages the way carpt.ts reads them: the welcome block on index.php and the
// userdetails.php profile table.
//
// The selectors are taken from the site's own public markup (the header CSS in
// login.php names every class used below) and from stock NexusPHP profile
// tables. They have NOT been checked against a live logged-in page, which is
// why the two readers overlap: the header fills what the profile omits and the
// profile fills what the header omits.

import { parse as parseHtml } from "node-html-parser"
import { computeBufferBytes, computeRatio } from "@/lib/data-transforms"
import { validateCookieHeader } from "@/lib/tracker-credentials/cookie-header"
import type {
  CzteamPlatformMeta,
  DebugApiCall,
  FetchOptions,
  TrackerAdapter,
  TrackerStats,
} from "../contract"
import { parseCredentialJson } from "../helpers/cookie-credentials"
import { SessionExpiredError } from "../helpers/errors"
import { fetchTrackerHtml } from "../helpers/html-fetch"
import {
  datePrefix,
  isCloudflareChallenge,
  normalizeWhitespace,
  tryParseCount,
  tryParseSiteBytes,
} from "../helpers/html-parse"

const LABEL = "CZTeam"
const SESSION_EXPIRED = "Session expired. Browser cookies need to be refreshed"
const COOKIE_NAMES = [
  "c_secure_uid",
  "c_secure_pass",
  "c_secure_login",
  "cf_clearance",
  "PHPSESSID",
] as const

type HtmlNode = ReturnType<typeof parseHtml>

export interface CzteamCredentials {
  cookies: string
  userAgent: string
}

export function parseCzteamCredentials(apiToken: string): CzteamCredentials {
  const { cookies, userAgent } = parseCredentialJson(apiToken, LABEL, [
    "cookies",
    "userAgent",
  ] as const)

  return {
    cookies: validateCookieHeader(cookies, {
      extraCookieNames: COOKIE_NAMES,
      example: "c_secure_uid=...; c_secure_pass=...; cf_clearance=...; PHPSESSID=...",
    }),
    userAgent,
  }
}

/**
 * A logged-in CZTeam page either carries the sign-out link or names the account
 * in its header. The login page is served with a 200, so a status check alone
 * would parse it as an empty account.
 */
function assertAuthenticated(html: string): void {
  if (isCloudflareChallenge(html)) {
    throw new Error("Cloudflare challenge detected. Cookies need refreshing")
  }
  if (!html.includes("logout.php") && !html.includes("userdetails.php?id=")) {
    throw new SessionExpiredError(SESSION_EXPIRED)
  }
}

// ---------------------------------------------------------------------------
// Label lookup
//
// NexusPHP labels are translated per site and the theme is bilingual (English
// and Romanian), so each figure is matched against a short list rather than one
// exact string. Labels are compared lowercased with the trailing colon dropped.
// ---------------------------------------------------------------------------

const LABELS = {
  uploaded: ["uploaded", "upload", "total uploaded", "încărcat", "incarcat"],
  downloaded: ["downloaded", "download", "total downloaded", "descărcat", "descarcat"],
  ratio: ["ratio", "rată", "rata", "share ratio"],
  bonus: ["bonus", "bonus points", "points", "puncte", "seedbonus"],
  className: ["class", "user class", "clasă", "clasa", "rank"],
  joined: ["joined", "join date", "registered", "registered on", "înregistrat", "inregistrat"],
  lastAccess: [
    "last seen",
    "last visit",
    "last activity",
    "ultima vizită",
    "ultima vizita",
    "ultima activitate",
  ],
  seeding: ["seeding", "seeding torrents", "seeds", "seeding count"],
  leeching: ["leeching", "leeching torrents", "leeches"],
  seedingSize: ["seeding size", "seed size", "total size", "seed size total"],
  invites: ["invites", "invitations", "invitații", "invitatii"],
} as const

function canonicalLabel(text: string): string {
  return normalizeWhitespace(text)
    .toLowerCase()
    .replace(/\s*:\s*$/, "")
    .trim()
}

/** The first label group the text belongs to, or null. */
function labelGroup(text: string): keyof typeof LABELS | null {
  const label = canonicalLabel(text)
  if (!label) return null
  for (const group of Object.keys(LABELS) as (keyof typeof LABELS)[]) {
    if (LABELS[group].some((candidate) => label === candidate)) return group
  }
  return null
}

interface LabelValues {
  values: Map<keyof typeof LABELS, string>
}

/**
 * Every label/value pair on the page, from any of the three shapes this build
 * uses: a table row of `<td>Label</td><td>Value</td>`, a definition list of
 * `dt`/`dd`, or one cell printing `Label: Value | Label: Value`. The first
 * occurrence of a label wins, since the header repeats what the profile table
 * states.
 */
function readLabelValues(doc: HtmlNode): LabelValues {
  const values = new Map<keyof typeof LABELS, string>()

  const record = (labelText: string, valueText: string) => {
    const group = labelGroup(labelText)
    if (!group) return
    const value = normalizeWhitespace(valueText)
    if (!value || values.has(group)) return
    values.set(group, value)
  }

  // Inline pairs first: a cell that prints several of them would otherwise lose
  // all but its first to the cell-pair pass below.
  for (const [group, value] of readInlineValues(doc.textContent)) values.set(group, value)

  for (const row of doc.querySelectorAll("tr")) {
    const cells = row.querySelectorAll("td")
    for (let i = 0; i < cells.length - 1; i++) {
      record(cells[i]?.textContent ?? "", cells[i + 1]?.textContent ?? "")
    }
  }

  for (const term of doc.querySelectorAll("dt")) {
    const definition = term.nextElementSibling
    if (!definition) continue
    record(term.textContent, definition.textContent)
  }

  return { values }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * The groups whose value always starts with a digit. Restricting the inline
 * pass to them keeps it from reading a class name as a total.
 */
const INLINE_GROUPS = [
  "uploaded",
  "downloaded",
  "ratio",
  "bonus",
  "seeding",
  "seedingSize",
  "leeching",
  "invites",
] as const

/**
 * `Label: 1.2 TB` pairs inside running text, where splitting on a delimiter
 * would also cut through the words before the first label.
 */
function readInlineValues(text: string): Map<keyof typeof LABELS, string> {
  const values = new Map<keyof typeof LABELS, string>()
  const flat = normalizeWhitespace(text)

  for (const group of INLINE_GROUPS) {
    for (const alias of LABELS[group]) {
      // The boundary keeps "upload" from matching inside "uploaded" and
      // "bonus" from matching inside "seedbonus".
      const pattern = new RegExp(
        `(?:^|[\\s|>\\u2022])\\s*${escapeRegExp(alias)}\\s*:?\\s*([0-9][0-9.,]*(?:\\s*[A-Za-z]{1,3})?)`,
        "i"
      )
      const match = flat.match(pattern)
      if (!match?.[1]) continue
      values.set(group, normalizeWhitespace(match[1]))
      break
    }
  }

  return values
}

interface CzteamHeader {
  stats: TrackerStats
  uid?: string
}

/** The account block every logged-in page repeats. */
export function parseCzteamHeader(html: string, hostname: string): CzteamHeader {
  assertAuthenticated(html)
  const doc = parseHtml(html)

  const header = doc.querySelector(".cz-userinfo")
  const greeting = header?.querySelector(".cz-greet a") ?? doc.querySelector(".cz-greet a")
  const username = normalizeWhitespace(greeting?.textContent ?? "")

  // The class is printed beside the name as "Class: Power User". The colon sits
  // inside that element, so the cell-pair pass cannot split it.
  const classText = normalizeWhitespace(
    header?.querySelector(".cz-class")?.textContent ??
      doc.querySelector(".cz-class")?.textContent ??
      ""
  )

  const uid = doc
    .querySelector("a[href*='userdetails.php?id=']")
    ?.getAttribute("href")
    ?.match(/userdetails\.php\?id=(\d+)/)?.[1]

  // The chips carry only a number, so they are read structurally rather than by
  // label. Both are optional: a member with no offences and no tokens may have
  // no chip at all.
  const hnrActive = tryParseCount(
    header?.querySelector(".cz-sl-hnr")?.textContent ?? doc.querySelector(".cz-sl-hnr")?.textContent
  )
  const freeleechTokens = tryParseCount(
    header?.querySelector(".cz-sl-fl")?.textContent ?? doc.querySelector(".cz-sl-fl")?.textContent
  )

  // The header block is the densest label/value region on the page, so read it
  // on its own as well: index.php does not carry the profile table.
  const headerValues = header ? readLabelValues(header) : null

  const fallback = readLabelValues(doc)
  const value = (group: keyof typeof LABELS): string | undefined =>
    headerValues?.values.get(group) ?? fallback.values.get(group)

  const uploadedBytes = tryParseSiteBytes(value("uploaded") ?? "")
  const downloadedBytes = tryParseSiteBytes(value("downloaded") ?? "")

  if (uploadedBytes === undefined) {
    throw new Error(`Unexpected response from ${hostname}: missing uploaded total`)
  }
  if (downloadedBytes === undefined) {
    throw new Error(`Unexpected response from ${hostname}: missing downloaded total`)
  }

  const ratio = tryParseCount(value("ratio"))
  const seedingCount = tryParseCount(value("seeding"))
  const leechingCount = tryParseCount(value("leeching"))
  const seedbonus = tryParseCount(value("bonus"))
  const seedingSize = tryParseSiteBytes(value("seedingSize") ?? "")
  const group = classText.replace(/^[^:]{0,20}:\s*/, "") || value("className") || null

  const meta: CzteamPlatformMeta = {}
  if (hnrActive !== undefined) meta.hnrActive = hnrActive
  if (freeleechTokens !== undefined) meta.freeleechTokens = freeleechTokens
  if (seedingSize !== undefined) meta.seedSizeBytes = Number(seedingSize)

  return {
    uid,
    stats: {
      username,
      group,
      uploadedBytes,
      downloadedBytes,
      ratio: ratio ?? computeRatio(uploadedBytes, downloadedBytes),
      bufferBytes: computeBufferBytes(uploadedBytes, downloadedBytes),
      seedingCount: seedingCount ?? null,
      leechingCount: leechingCount ?? null,
      seedbonus: seedbonus ?? null,
      hitAndRuns: hnrActive ?? null,
      requiredRatio: null,
      warned: null,
      freeleechTokens: freeleechTokens ?? null,
      remoteUserId: uid ? Number.parseInt(uid, 10) : undefined,
      joinedDate: undefined,
      lastAccessDate: undefined,
      platformMeta: Object.keys(meta).length > 0 ? meta : undefined,
    },
  }
}

/**
 * The userdetails.php row table: class, join date, last activity and, on this
 * build, the seeding size the header chip does not carry.
 */
export function parseCzteamProfile(html: string): Partial<TrackerStats> {
  assertAuthenticated(html)
  const doc = parseHtml(html)
  const { values } = readLabelValues(doc)

  const joinedDate = datePrefix(values.get("joined") ?? "")
  const lastAccessDate = datePrefix(values.get("lastAccess") ?? "")
  const group = values.get("className") ?? null
  const seedbonus = tryParseCount(values.get("bonus"))
  const seedingSize = tryParseSiteBytes(values.get("seedingSize") ?? "")

  const meta: CzteamPlatformMeta = {}
  if (seedingSize !== undefined) meta.seedSizeBytes = Number(seedingSize)

  const stats: Partial<TrackerStats> = {
    group,
    joinedDate,
    lastAccessDate,
    lastAccessField: lastAccessDate ? "Last activity" : undefined,
  }
  if (seedbonus !== undefined) stats.seedbonus = seedbonus
  if (Object.keys(meta).length > 0) stats.platformMeta = meta
  return stats
}

function mergeMeta(
  first: TrackerStats["platformMeta"],
  second: TrackerStats["platformMeta"]
): CzteamPlatformMeta | undefined {
  const merged = {
    ...(first as CzteamPlatformMeta | undefined),
    ...(second as CzteamPlatformMeta | undefined),
  }
  return Object.keys(merged).length > 0 ? merged : undefined
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Request failed"
}

export class CzteamAdapter implements TrackerAdapter {
  async fetchStats(
    baseUrl: string,
    apiToken: string,
    _apiPath: string,
    options?: FetchOptions
  ): Promise<TrackerStats> {
    const creds = parseCzteamCredentials(apiToken)
    const hostname = new URL(baseUrl).hostname
    const fetchPage = (url: string) =>
      fetchTrackerHtml({
        url,
        cookies: creds.cookies,
        userAgent: creds.userAgent,
        label: LABEL,
        sessionExpiredMessage: SESSION_EXPIRED,
        proxyAgent: options?.proxyAgent,
      })

    const header = parseCzteamHeader(await fetchPage(`${baseUrl}/index.php`), hostname)
    const stats = header.stats

    // The profile is enrichment. Its failure leaves the class, join date and
    // seeding size unknown instead of discarding totals that already parsed.
    // Copies field by field rather than spreading, because a field the profile
    // could not read comes back null and would overwrite the header's figure.
    const uid = header.uid ?? (options?.remoteUserId ? String(options.remoteUserId) : undefined)
    if (uid) {
      try {
        const profile = parseCzteamProfile(await fetchPage(`${baseUrl}/userdetails.php?id=${uid}`))
        if (profile.group) stats.group = profile.group
        if (profile.joinedDate) stats.joinedDate = profile.joinedDate
        if (profile.lastAccessDate) {
          stats.lastAccessDate = profile.lastAccessDate
          stats.lastAccessField = profile.lastAccessField
        }
        if (typeof profile.seedbonus === "number") stats.seedbonus = profile.seedbonus
        stats.platformMeta = mergeMeta(stats.platformMeta, profile.platformMeta)
      } catch {
        // Keep the header totals.
      }
    }

    return stats
  }

  async fetchRaw(
    baseUrl: string,
    apiToken: string,
    _apiPath: string,
    options?: FetchOptions
  ): Promise<DebugApiCall[]> {
    const creds = parseCzteamCredentials(apiToken)
    const hostname = new URL(baseUrl).hostname
    const calls: DebugApiCall[] = []
    const fetchPage = (url: string) =>
      fetchTrackerHtml({
        url,
        cookies: creds.cookies,
        userAgent: creds.userAgent,
        label: LABEL,
        sessionExpiredMessage: SESSION_EXPIRED,
        proxyAgent: options?.proxyAgent,
      })

    let uid: string | undefined
    try {
      const header = parseCzteamHeader(await fetchPage(`${baseUrl}/index.php`), hostname)
      uid = header.uid
      calls.push({ label: "Home Page", endpoint: "/index.php", data: header.stats, error: null })
    } catch (err) {
      calls.push({ label: "Home Page", endpoint: "/index.php", data: null, error: errorMessage(err) })
      return calls
    }

    if (uid) {
      const endpoint = `/userdetails.php?id=${uid}`
      try {
        calls.push({
          label: "Profile",
          endpoint,
          data: parseCzteamProfile(await fetchPage(`${baseUrl}${endpoint}`)),
          error: null,
        })
      } catch (err) {
        calls.push({ label: "Profile", endpoint, data: null, error: errorMessage(err) })
      }
    }

    return calls
  }
}
