// src/lib/tracker-platforms/adapters/czteam.ts
//
// Functions: parseCzteamCredentials, assertAuthenticated, headerNumber,
//            czSize, firstSize, durationSeconds, parseCzteamHeader,
//            readSideStats, parseCzteamProfile, mergeMeta, errorMessage,
//            CzteamAdapter
//
// CZTeam runs a heavily customised NexusPHP build. Its api.php is torrent
// search only (Prowlarr's czteam-api.yml documents latest-torrents,
// search-torrents and download, no user action), so the account figures come
// from the logged-in pages:
//
//   index.php         the .cz-userinfo block: chips and the Up/Down line
//   userdetails.php   the .ud-side-stat rows: dates, totals, seedtime
//
// Two traps this reader is built around, both confirmed against a live page:
//
//  - The home page also prints site-wide traffic ("Uploaded 79,84 PB" in its
//    Tracker statistics card). Reading labels from the whole document picks
//    that up as the account's own total, so every figure here is read from
//    inside the account header only.
//  - Sizes use the Romanian decimal comma ("1,26 TB", "0,000 KB"). Stripping
//    the comma as a grouping separator multiplies the value by ten per digit,
//    so sizes go through tryParseCommaDecimalBytes.

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
  tryParseCommaDecimalBytes,
  tryParseCount,
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
 * The signed-out pages ship the header's CSS but not the header itself, so the
 * login page is detected by the markup of the account block rather than by the
 * share of the stylesheet it also carries.
 */
function assertAuthenticated(html: string): void {
  if (isCloudflareChallenge(html)) {
    throw new Error("Cloudflare challenge detected. Cookies need refreshing")
  }
  if (!html.includes('class="cz-userinfo"') && !html.includes("logout.php")) {
    throw new SessionExpiredError(SESSION_EXPIRED)
  }
}

/** The number inside a chip such as `<a class="cz-sl-up"><b>161</b></a>`. */
function headerNumber(root: HtmlNode, selector: string): number | undefined {
  return tryParseCount(root.querySelector(selector)?.textContent)
}

/** `1,26 TB` -> bytes, with the comma read as a decimal separator. */
function czSize(value: string | undefined): bigint | undefined {
  if (!value) return undefined
  return tryParseCommaDecimalBytes(normalizeWhitespace(value))
}

/** The first size-looking token in a row that also carries a rate and notes. */
function firstSize(value: string | undefined): bigint | undefined {
  if (!value) return undefined
  const match = normalizeWhitespace(value).match(/([\d.,]+\s*(?:B|KB|MB|GB|TB|PB))/i)
  return match ? czSize(match[1]) : undefined
}

/** `37 days 16 hours 58 minutes` -> seconds. Undefined when no part matches. */
export function durationSeconds(value: string | undefined): number | undefined {
  if (!value) return undefined
  const text = normalizeWhitespace(value).toLowerCase()
  const parts: [RegExp, number][] = [
    [/(\d+)\s*days?/, 86_400],
    [/(\d+)\s*hours?/, 3_600],
    [/(\d+)\s*minutes?/, 60],
    [/(\d+)\s*seconds?/, 1],
  ]
  let total = 0
  let matched = false
  for (const [pattern, seconds] of parts) {
    const match = text.match(pattern)
    if (!match) continue
    total += Number.parseInt(match[1], 10) * seconds
    matched = true
  }
  return matched ? total : undefined
}

interface CzteamHeader {
  stats: TrackerStats
  uid?: string
}

/**
 * The account block every logged-in page repeats.
 *
 * `cz-stats` prints "Ratio: Inf. · Up: 1,26 TB · Down: 0,00 KB · <bonus>", with
 * the labels shortened to Up and Down rather than spelled out.
 */
export function parseCzteamHeader(html: string, hostname: string): CzteamHeader {
  assertAuthenticated(html)
  const doc = parseHtml(html)

  const header = doc.querySelector(".cz-userinfo")
  if (!header) {
    throw new Error(`Unexpected response from ${hostname}: missing the account header`)
  }

  const greeting = header.querySelector(".cz-greet a")
  const username = normalizeWhitespace(greeting?.textContent ?? "")
  const uid = greeting
    ?.getAttribute("href")
    ?.match(/userdetails\.php\?id=(\d+)/)?.[1]

  // The site prints the class in brackets: "[User]".
  const group =
    normalizeWhitespace(header.querySelector(".cz-class")?.textContent ?? "")
      .replace(/^[[(]|[)\]]$/g, "")
      .trim() || null

  const statsLine = normalizeWhitespace(header.querySelector(".cz-stats")?.textContent ?? "")
  const uploadedBytes = czSize(statsLine.match(/Up:\s*([\d.,]+\s*[A-Za-z]+)/i)?.[1])
  const downloadedBytes = czSize(statsLine.match(/Down:\s*([\d.,]+\s*[A-Za-z]+)/i)?.[1])
  const printedRatio = tryParseCount(statsLine.match(/Ratio:\s*([\d.,]+)/i)?.[1])
  const seedbonus = headerNumber(header, '.cz-stats a[href*="bonus.php"] b')

  if (uploadedBytes === undefined) {
    throw new Error(`Unexpected response from ${hostname}: missing uploaded total`)
  }
  if (downloadedBytes === undefined) {
    throw new Error(`Unexpected response from ${hostname}: missing downloaded total`)
  }

  const seedingCount = headerNumber(header, ".cz-sl-up")
  const leechingCount = headerNumber(header, ".cz-sl-down")
  const hitAndRuns = headerNumber(header, ".cz-sl-hnr")
  const freeleechTokens = headerNumber(header, ".cz-sl-fl")

  return {
    uid,
    stats: {
      username,
      group,
      uploadedBytes,
      downloadedBytes,
      // "Inf." is what the site prints for uploads with no downloads.
      ratio: printedRatio ?? computeRatio(uploadedBytes, downloadedBytes),
      bufferBytes: computeBufferBytes(uploadedBytes, downloadedBytes),
      seedingCount: seedingCount ?? null,
      leechingCount: leechingCount ?? null,
      seedbonus: seedbonus ?? null,
      hitAndRuns: hitAndRuns ?? null,
      requiredRatio: null,
      warned: null,
      freeleechTokens: freeleechTokens ?? null,
      remoteUserId: uid ? Number.parseInt(uid, 10) : undefined,
    },
  }
}

/**
 * The userdetails.php sidebar. Each figure is a `.ud-side-stat` row of a `.k`
 * label and a `.v` value, and a value can carry a `<small>` note ("42,97 GB /
 * day"), which is why sizes are read by shape rather than by whole-cell
 * equality.
 */
function readSideStats(doc: HtmlNode): Map<string, string> {
  const rows = new Map<string, string>()
  for (const row of doc.querySelectorAll(".ud-side-stat")) {
    const key = normalizeWhitespace(row.querySelector(".k")?.textContent ?? "").toLowerCase()
    if (!key || rows.has(key)) continue
    rows.set(key, normalizeWhitespace(row.querySelector(".v")?.textContent ?? ""))
  }
  return rows
}

export function parseCzteamProfile(html: string): Partial<TrackerStats> {
  assertAuthenticated(html)
  const doc = parseHtml(html)
  const rows = readSideStats(doc)

  const uploadedBytes = firstSize(rows.get("uploaded"))
  const downloadedBytes = firstSize(rows.get("downloaded"))
  const printedRatio = tryParseCount(rows.get("ratio"))

  const meta: CzteamPlatformMeta = {}
  const avgSeedTimeSeconds = durationSeconds(rows.get("avg seedtime"))
  const totalSeedTimeSeconds = durationSeconds(rows.get("total seedtime"))
  const completedSeeds = tryParseCount(rows.get("completed seeds"))
  if (avgSeedTimeSeconds !== undefined) meta.avgSeedTimeSeconds = avgSeedTimeSeconds
  if (totalSeedTimeSeconds !== undefined) meta.totalSeedTimeSeconds = totalSeedTimeSeconds
  if (completedSeeds !== undefined) meta.completedSeeds = completedSeeds

  // The activity summary prints "161 seeding · 0 leeching · 1 snatched · 136
  // uploads · 0 invited", the only upload count on the page.
  const activity = normalizeWhitespace(
    doc.querySelector(".ud-activity-summary-meta")?.textContent ?? ""
  )
  const uploads = tryParseCount(activity.match(/(\d+)\s+uploads?/)?.[1])
  if (uploads !== undefined) meta.uploads = uploads

  const seedbonus = tryParseCount(rows.get("bonus points"))

  const stats: Partial<TrackerStats> = {
    group: normalizeWhitespace(doc.querySelector(".post-author-class")?.textContent ?? "") || null,
    joinedDate: datePrefix(rows.get("registered") ?? ""),
    lastAccessDate: datePrefix(rows.get("last access") ?? ""),
    lastAccessField: rows.has("last access") ? "Last access" : undefined,
    platformMeta: Object.keys(meta).length > 0 ? meta : undefined,
  }

  if (uploadedBytes !== undefined) stats.uploadedBytes = uploadedBytes
  if (downloadedBytes !== undefined) {
    stats.downloadedBytes = downloadedBytes
    // A buffer needs both totals; deriving one from an unread side would write
    // a measured-looking zero.
    if (uploadedBytes !== undefined) {
      stats.bufferBytes = computeBufferBytes(uploadedBytes, downloadedBytes)
    }
  }
  if (printedRatio !== undefined) {
    stats.ratio = printedRatio
  } else if (uploadedBytes !== undefined && downloadedBytes !== undefined) {
    stats.ratio = computeRatio(uploadedBytes, downloadedBytes)
  }
  if (seedbonus !== undefined) stats.seedbonus = seedbonus

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

    const home = parseCzteamHeader(await fetchPage(`${baseUrl}/index.php`), hostname)
    const stats = home.stats

    // The profile is enrichment, but its sidebar carries the same totals to
    // three decimals, so a figure it does read replaces the header's. A field
    // it could not read is left alone rather than written back as null.
    const uid = home.uid ?? (options?.remoteUserId ? String(options.remoteUserId) : undefined)
    if (uid) {
      try {
        const profile = parseCzteamProfile(await fetchPage(`${baseUrl}/userdetails.php?id=${uid}`))
        if (profile.group) stats.group = profile.group
        if (profile.joinedDate) stats.joinedDate = profile.joinedDate
        if (profile.lastAccessDate) {
          stats.lastAccessDate = profile.lastAccessDate
          stats.lastAccessField = profile.lastAccessField
        }
        if (profile.uploadedBytes !== undefined) stats.uploadedBytes = profile.uploadedBytes
        if (profile.downloadedBytes !== undefined) {
          stats.downloadedBytes = profile.downloadedBytes
          stats.bufferBytes = profile.bufferBytes ?? stats.bufferBytes
        }
        if (typeof profile.ratio === "number") stats.ratio = profile.ratio
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
