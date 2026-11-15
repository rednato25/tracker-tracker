// src/lib/tracker-platforms/adapters/hdspace.ts
//
// Functions: parseHdspaceCredentials, stripScriptsAndStyles, visibleText,
//            parseXbtitDate, dateAfterLabels, bytesAfterLabel, assertAuthenticated,
//            parseHdspaceProfile, fetchHtml, HdspaceAdapter
//
// HD-Space runs a customised xbtit codebase with no API, and the site sits
// behind a Cloudflare managed challenge that refuses server-side logins. The
// adapter therefore replays the browser session: the pasted Cookie header must
// include cf_clearance, and the captured User-Agent must be the one the cookie
// was issued to. One page is read per poll, the user control panel, whose
// header block carries every figure the registry needs.

import { computeBufferBytes, computeRatio } from "@/lib/data-transforms"
import { validateCookieHeader } from "@/lib/tracker-credentials/cookie-header"
import type { DebugApiCall, FetchOptions, TrackerAdapter, TrackerStats } from "../contract"
import { presentClass } from "../helpers/class-name"
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

const LABEL = "HD-Space"
const SESSION_EXPIRED = "Session expired. Browser cookies need to be refreshed"
const COOKIE_NAMES = ["cf_clearance", "PHPSESSID", "uid", "pass"] as const
const COOKIE_EXAMPLE = "cf_clearance=...; PHPSESSID=...; uid=...; pass=..."
// The user panel is part of the xbtit protocol, not a property of a stored
// row, so a stale persisted api_path self-heals instead of breaking the adapter.
const PANEL_PATH = "/index.php?page=usercp"

// ---------------------------------------------------------------------------
// Credential handling
// ---------------------------------------------------------------------------

interface HdspaceCredentials {
  cookies: string
  userAgent: string
}

export function parseHdspaceCredentials(apiToken: string): HdspaceCredentials {
  const { cookies, userAgent } = parseCredentialJson(apiToken, LABEL, [
    "cookies",
    "userAgent",
  ] as const)

  return {
    cookies: validateCookieHeader(cookies, {
      extraCookieNames: COOKIE_NAMES,
      example: COOKIE_EXAMPLE,
    }),
    userAgent: userAgent.trim(),
  }
}

// ---------------------------------------------------------------------------
// Panel page parser
//
// The header block xbtit prints on every authenticated page carries the
// totals; the panel below it adds the join date and the numeric user id. The
// page is table markup with unclosed cells, so the text is read as one
// whitespace-normalized string rather than through cell positions.
// ---------------------------------------------------------------------------

/**
 * Removes script and style elements without a regex. HTML filtering regexes
 * miss end tags with attributes or unusual whitespace, and a DOM walk would
 * drop the malformed cells xbtit emits in the very header block this reads.
 */
function stripScriptsAndStyles(html: string): string {
  const lower = html.toLowerCase()
  let out = ""
  let index = 0

  while (index < html.length) {
    const script = lower.indexOf("<script", index)
    const style = lower.indexOf("<style", index)
    const start = script === -1 ? style : style === -1 ? script : Math.min(script, style)
    if (start === -1) {
      out += html.slice(index)
      break
    }

    out += html.slice(index, start)
    const closeScript = lower.indexOf("</script", start)
    const closeStyle = lower.indexOf("</style", start)
    const close = lower.startsWith("<script", start) ? closeScript : closeStyle
    if (close === -1) break
    const end = lower.indexOf(">", close)
    if (end === -1) break
    index = end + 1
  }

  return out
}

/** Visible text with scripts and styles removed, for the header-block regexes. */
function visibleText(html: string): string {
  return normalizeWhitespace(
    stripScriptsAndStyles(html)
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
  )
}

const MONTHS: Record<string, string> = {
  january: "01",
  jan: "01",
  february: "02",
  feb: "02",
  march: "03",
  mar: "03",
  april: "04",
  apr: "04",
  may: "05",
  june: "06",
  jun: "06",
  july: "07",
  jul: "07",
  august: "08",
  aug: "08",
  september: "09",
  sep: "09",
  sept: "09",
  october: "10",
  oct: "10",
  november: "11",
  nov: "11",
  december: "12",
  dec: "12",
}

/**
 * The date shapes xbtit prints: "2026-09-03", "23/09/2026" and
 * "September 03, 2026". Returns YYYY-MM-DD, the shape the scheduler preserves
 * without a timezone conversion.
 */
export function parseXbtitDate(value: string): string | undefined {
  const text = normalizeWhitespace(value)
  const iso = datePrefix(text)
  if (iso) return iso

  const dayFirst = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/)
  if (dayFirst) {
    return `${dayFirst[3]}-${dayFirst[2].padStart(2, "0")}-${dayFirst[1].padStart(2, "0")}`
  }

  const monthFirst = text.match(/\b([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,\s*(\d{4})\b/i)
  if (monthFirst) {
    const month = MONTHS[monthFirst[1].toLowerCase()]
    if (month) return `${monthFirst[3]}-${month}-${monthFirst[2].padStart(2, "0")}`
  }

  const dayMonthYear = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})\b/i)
  if (dayMonthYear) {
    const month = MONTHS[dayMonthYear[2].toLowerCase()]
    if (month) return `${dayMonthYear[3]}-${month}-${dayMonthYear[1].padStart(2, "0")}`
  }

  return undefined
}

/**
 * The date printed after a label in the visible panel text. The label can be
 * "Joined on", "Joined" or "Join Date", and the value can be a month name or a
 * day-first date; parseXbtitDate decides whether the text is a date at all.
 */
function dateAfterLabels(text: string, labels: readonly string[]): string | undefined {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const match = text.match(
      new RegExp(`(?:^|\\s)${escaped}\\s*:?\\s*([A-Za-z0-9,./ -]{4,40})`, "i")
    )
    if (!match) continue
    const date = parseXbtitDate(match[1])
    if (date) return date
  }
  return undefined
}

/**
 * "UP: 22.01 GB" as xbtit prints it. The labels say GB/MB but the site divides
 * by 1024; tryParseSiteBytes maps them to the binary family, so the totals
 * match the site's own ratio.
 */
function bytesAfterLabel(text: string, label: "UP" | "DL", hostname: string): bigint {
  const match = text.match(new RegExp(`\\b${label}:\\s*([\\d.,]+\\s*[KMGT]?B)`, "i"))
  const bytes = match ? tryParseSiteBytes(match[1]) : undefined
  if (bytes === undefined) {
    throw new Error(
      `Unexpected response from ${hostname}: unreadable ${label === "UP" ? "uploaded" : "downloaded"} byte total`
    )
  }
  return bytes
}

function assertAuthenticated(html: string): void {
  if (isCloudflareChallenge(html)) {
    throw new Error("Cloudflare challenge detected on HD-Space. Refresh the cf_clearance cookie")
  }
  if (!html.includes("logout.php")) {
    throw new SessionExpiredError(SESSION_EXPIRED)
  }
}

export function parseHdspaceProfile(html: string, hostname: string): TrackerStats {
  assertAuthenticated(html)
  const text = visibleText(html)

  // "Welcome back deusx (Logout)" in the header; the panel repeats it as "User: deusx".
  const welcome = text.match(/Welcome back\s+(.+?)\s+\(Logout\)/i)
  const userRow = text.match(/\bUser:\s*(\S+)\s+Rank:/i)
  const username = (welcome?.[1] ?? userRow?.[1] ?? "").trim()
  if (!username) {
    throw new Error(
      `Unexpected response from ${hostname}: could not find the username on the HD-Space page. The page may not be authenticated`
    )
  }

  const uploadedBytes = bytesAfterLabel(text, "UP", hostname)
  const downloadedBytes = bytesAfterLabel(text, "DL", hostname)

  const rank = text.match(/\bRank:\s*([A-Za-z][A-Za-z. ]*?)\s+(?:UP:|DL:|Bonus:|Joined|Last|Active)/i)
  const group = presentClass(rank?.[1])

  const bonus = text.match(/\bBonus:\s*([\d,.]+)/i)
  const seedbonus = tryParseCount(bonus?.[1]) ?? null

  // "Active Torrents : <seed icon> 16 <leech icon> 0"; the icons leave two
  // integers once tags are stripped. One integer is a partial header, so the
  // missing side stays null rather than being reported as zero.
  const active = text.match(/Active Torrents\s*:\s*(\d[\d,]*)\s+(\d[\d,]*)/i)
  const seedingCount = tryParseCount(active?.[1]) ?? null
  const leechingCount = tryParseCount(active?.[2]) ?? null

  const joinedDate = dateAfterLabels(text, [
    "joined on",
    "joined",
    "join date",
    "registered",
    "registration date",
  ])
  const lastAccessDate = dateAfterLabels(text, [
    "last access",
    "last seen",
    "last active",
    "last login",
  ])

  const uidMatch = html.match(/page=usercp&(?:amp;)?uid=(\d+)/i)
  const remoteUserId = uidMatch ? Number.parseInt(uidMatch[1], 10) : undefined

  const stats: TrackerStats = {
    username,
    group,
    uploadedBytes,
    downloadedBytes,
    ratio: computeRatio(uploadedBytes, downloadedBytes),
    bufferBytes: computeBufferBytes(uploadedBytes, downloadedBytes),
    seedingCount,
    leechingCount,
    seedbonus,
    // xbtit has no hit-and-run system, warning flag, required ratio or tokens.
    hitAndRuns: null,
    requiredRatio: null,
    warned: null,
    freeleechTokens: null,
  }
  if (remoteUserId !== undefined) stats.remoteUserId = remoteUserId
  if (joinedDate) stats.joinedDate = joinedDate
  if (lastAccessDate) {
    stats.lastAccessDate = lastAccessDate
    stats.lastAccessField = "Last access"
  }
  return stats
}

// ---------------------------------------------------------------------------
// HTML fetcher
// ---------------------------------------------------------------------------

function fetchHtml(
  url: string,
  creds: HdspaceCredentials,
  proxyAgent?: FetchOptions["proxyAgent"]
): Promise<string> {
  return fetchTrackerHtml({
    url,
    cookies: creds.cookies,
    userAgent: creds.userAgent,
    proxyAgent,
    label: LABEL,
    sessionExpiredMessage: SESSION_EXPIRED,
    // xbtit can answer index.php with a redirect to itself. Only a bounce to
    // the login page means the session is gone.
    followRedirects: { loginPattern: /page=login/i },
  })
}

// ---------------------------------------------------------------------------
// Adapter class
// ---------------------------------------------------------------------------

export class HdspaceAdapter implements TrackerAdapter {
  async fetchStats(
    baseUrl: string,
    apiToken: string,
    _apiPath: string,
    options?: FetchOptions
  ): Promise<TrackerStats> {
    const creds = parseHdspaceCredentials(apiToken)
    const hostname = new URL(baseUrl).hostname
    const html = await fetchHtml(`${baseUrl}${PANEL_PATH}`, creds, options?.proxyAgent)
    return parseHdspaceProfile(html, hostname)
  }

  async fetchRaw(
    baseUrl: string,
    apiToken: string,
    _apiPath: string,
    options?: FetchOptions
  ): Promise<DebugApiCall[]> {
    const calls: DebugApiCall[] = []
    // Outside any try: bad credentials are a caller error, not a call entry.
    const creds = parseHdspaceCredentials(apiToken)
    const hostname = new URL(baseUrl).hostname
    const endpoint = PANEL_PATH

    try {
      const html = await fetchHtml(`${baseUrl}${endpoint}`, creds, options?.proxyAgent)
      const stats = parseHdspaceProfile(html, hostname)
      calls.push({ label: "User Control Panel", endpoint, data: stats, error: null })
    } catch (err) {
      calls.push({
        label: "User Control Panel",
        endpoint,
        data: null,
        error: err instanceof Error ? err.message : "Request failed",
      })
    }
    return calls
  }
}
