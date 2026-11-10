// src/lib/tracker-platforms/adapters/teamhd.ts
//
// Functions: parseTeamhdCredentials, assertAuthenticated, valueAfterGlyph,
//            countAfterImage, countWithGroupingSpaces, parseRussianDate,
//            parseDottedDate, readHeadRows, parseTeamhdHomepage,
//            parseTeamhdProfile, parseTeamhdRates, mergeMeta, errorMessage,
//            TeamhdAdapter
//
// TeamHD is a custom NexusPHP fork with no user API and a reCAPTCHA on its
// login page (Jackett's teamhd.yml uses the cookie method for the same reason),
// so this adapter reads the logged-in pages:
//
//   /index.php  the welcome block: totals, bonus, seeding and leeching counts
//   /user/      the profile: registration date, last activity and class
//   /bprate.php the seeding size, which no other page prints
//
// The welcome block marks each figure with a coloured glyph and leaves the
// number in the following text node, which is why the values are read by
// walking past the <font> rather than by label.

import { parse as parseHtml } from "node-html-parser"
import { computeBufferBytes, computeRatio } from "@/lib/data-transforms"
import { validateCookieHeader } from "@/lib/tracker-credentials/cookie-header"
import type {
  DebugApiCall,
  FetchOptions,
  TeamhdPlatformMeta,
  TrackerAdapter,
  TrackerStats,
} from "../contract"
import { parseCredentialJson } from "../helpers/cookie-credentials"
import { SessionExpiredError } from "../helpers/errors"
import { fetchTrackerHtml } from "../helpers/html-fetch"
import { normalizeWhitespace, tryParseCount, tryParseSiteBytes } from "../helpers/html-parse"

const LABEL = "TeamHD"
const SESSION_EXPIRED = "Session expired. Browser cookies need to be refreshed"
const COOKIE_NAMES = ["c_secure_uid", "c_secure_pass", "c_secure_login", "PHPSESSID"] as const

type HtmlNode = ReturnType<typeof parseHtml>

export interface TeamhdCredentials {
  cookies: string
  userAgent: string
}

export function parseTeamhdCredentials(apiToken: string): TeamhdCredentials {
  const { cookies, userAgent } = parseCredentialJson(apiToken, LABEL, [
    "cookies",
    "userAgent",
  ] as const)

  return {
    cookies: validateCookieHeader(cookies, {
      extraCookieNames: COOKIE_NAMES,
      example: "c_secure_uid=...; c_secure_pass=...; PHPSESSID=...",
    }),
    userAgent,
  }
}

/**
 * Every logged-in page links to logout.php, and the login page does not. The
 * site answers a dead session with the login page and a 200, so the status code
 * alone would parse as an empty account.
 */
function assertAuthenticated(html: string): void {
  if (
    html.includes("<title>Just a moment...</title>") ||
    html.includes("cf_chl_opt") ||
    html.includes("challenges.cloudflare.com/turnstile")
  ) {
    throw new Error("Cloudflare challenge detected. Cookies need refreshing")
  }
  if (!html.includes("logout.php")) {
    throw new SessionExpiredError(SESSION_EXPIRED)
  }
}

/**
 * The number the welcome block prints after a coloured glyph. The site marks
 * upload green, download dark red, ratio and torrent counts blue, each with the
 * figure as a sibling text node rather than inside the <font> element.
 */
function valueAfterGlyph(root: HtmlNode, colors: readonly string[]): string | undefined {
  for (const font of root.querySelectorAll("font")) {
    const color = (font.getAttribute("color") ?? "").toLowerCase()
    if (!colors.includes(color)) continue
    const text = normalizeWhitespace(font.nextSibling?.textContent ?? "")
    if (text) return text
  }
  return undefined
}

const UPLOAD_GLYPHS = ["green", "#008000", "#00b300"]
const DOWNLOAD_GLYPHS = ["darkred", "#8b0000", "#b30000"]
const RATIO_GLYPHS = ["#1900d1", "blue", "#0000ff"]

/** The count printed after an icon, as in `<img alt="Раздаёт">&nbsp;1`. */
function countAfterImage(root: HtmlNode, alt: string): number | undefined {
  const image = root.querySelector(`img[alt="${alt}"]`)
  return tryParseCount(image?.nextSibling?.textContent)
}

/**
 * `29 686` -> 29686. The bonus field groups thousands with a space, where the
 * shared count reader stops at the first group.
 */
function countWithGroupingSpaces(value: string | undefined): number | undefined {
  const match = value?.match(/\d{1,3}(?:[\s\u00a0]\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/)
  if (!match) return undefined
  const parsed = Number.parseFloat(match[0].replace(/[\s\u00a0]/g, ""))
  return Number.isFinite(parsed) ? parsed : undefined
}

/** Russian month names as the profile prints them, in the genitive case. */
const RU_MONTHS: Record<string, string> = {
  января: "01",
  февраля: "02",
  марта: "03",
  апреля: "04",
  мая: "05",
  июня: "06",
  июля: "07",
  августа: "08",
  сентября: "09",
  октября: "10",
  ноября: "11",
  декабря: "12",
}

/** `29 сентября 2026 (6 недель назад)` -> `2026-09-29`. */
export function parseRussianDate(value: string): string | undefined {
  const text = normalizeWhitespace(value).split("(")[0] ?? ""
  const match = text.match(/^(\d{1,2})\s+([А-Яа-яЁё]+)\s+(\d{4})/)
  if (!match) return undefined
  const month = RU_MONTHS[match[2].toLowerCase()]
  if (!month) return undefined
  return `${match[3]}-${month}-${match[1].padStart(2, "0")}`
}

/** `10-11-2026 23:51:07` -> `2026-11-10`. Undefined for any other shape. */
export function parseDottedDate(value: string | undefined): string | undefined {
  const match = value?.match(/(\d{1,2})-(\d{1,2})-(\d{4})/)
  if (!match) return undefined
  return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`
}

/**
 * The profile's label/value table. A row is a `<td class="rowhead">` with its
 * value in the next cell; the label is matched rather than the row position,
 * since TeamHD has moved these rows between releases.
 */
function readHeadRows(doc: HtmlNode): Map<string, string> {
  const rows = new Map<string, string>()
  for (const row of doc.querySelectorAll("tr")) {
    const cells = row.querySelectorAll("td")
    if (cells.length < 2) continue
    const key = normalizeWhitespace(cells[0]?.textContent ?? "")
      .toLowerCase()
      .replace(/\s*:\s*$/, "")
    if (!key || rows.has(key)) continue
    rows.set(key, normalizeWhitespace(cells[1]?.textContent ?? ""))
  }
  return rows
}

export interface TeamhdHomeReadout {
  stats: TrackerStats
  /** The profile path segment ("id7279"), not an integer. */
  profileId?: string
  profileName?: string
}

export function parseTeamhdHomepage(html: string, hostname: string): TeamhdHomeReadout {
  assertAuthenticated(html)
  const doc = parseHtml(html)

  // The welcome block, when the theme still uses the documented one.
  const block = doc.querySelector("div.col-8.mb-4") ?? doc

  const profileLink = doc.querySelector("a[href*='/user/']")
  const profileHref = profileLink?.getAttribute("href") ?? ""
  const profileName = normalizeWhitespace(profileLink?.textContent ?? "")
  const profileId = profileHref.split("/").filter(Boolean).at(-1)
  // The site keeps the class in the username link's title: title="720p".
  const group = normalizeWhitespace(profileLink?.querySelector("span")?.getAttribute("title") ?? "")

  const uploadedBytes = tryParseSiteBytes(valueAfterGlyph(block, UPLOAD_GLYPHS) ?? "")
  const downloadedBytes = tryParseSiteBytes(valueAfterGlyph(block, DOWNLOAD_GLYPHS) ?? "")
  const ratio = tryParseCount(valueAfterGlyph(block, RATIO_GLYPHS))

  if (uploadedBytes === undefined) {
    throw new Error(`Unexpected response from ${hostname}: missing uploaded total`)
  }
  if (downloadedBytes === undefined) {
    throw new Error(`Unexpected response from ${hostname}: missing downloaded total`)
  }

  const seedbonus = countWithGroupingSpaces(
    doc.querySelector("a.online[href='/mybonus.php']")?.textContent ??
      doc.querySelector("a[href*='mybonus.php']")?.textContent
  )
  const unreadMessages = tryParseCount(
    doc.querySelector("#message_box a font")?.textContent ?? undefined
  )
  // The tracker prints its torrent counts after two icons rather than labels.
  const seedingCount = countAfterImage(block, "Раздаёт")
  const leechingCount = countAfterImage(block, "Качает")

  const meta: TeamhdPlatformMeta = {}
  if (unreadMessages !== undefined) meta.unreadMessages = unreadMessages

  return {
    profileId,
    profileName,
    stats: {
      username: profileName,
      group: group || null,
      uploadedBytes,
      downloadedBytes,
      ratio: ratio ?? computeRatio(uploadedBytes, downloadedBytes),
      bufferBytes: computeBufferBytes(uploadedBytes, downloadedBytes),
      seedingCount: seedingCount ?? null,
      leechingCount: leechingCount ?? null,
      seedbonus: seedbonus ?? null,
      hitAndRuns: null,
      requiredRatio: null,
      warned: null,
      freeleechTokens: null,
      platformMeta: Object.keys(meta).length > 0 ? meta : undefined,
    },
  }
}

/** The account's own profile page: registration date, last activity and class. */
export function parseTeamhdProfile(html: string): Partial<TrackerStats> {
  assertAuthenticated(html)
  const doc = parseHtml(html)
  const rows = readHeadRows(doc)

  const joinedDate =
    parseRussianDate(rows.get("регистрация") ?? "") ??
    parseRussianDate(
      doc.querySelector("#profile_right table.inlay tr td:nth-child(2)")?.textContent ?? ""
    )

  const lastAccessDate = parseDottedDate(rows.get("активность"))

  // The class is the title on the username span ("720p"), with the same value
  // repeated as the first small line under the avatar.
  const group =
    normalizeWhitespace(doc.querySelector("#profile_left h4 span")?.getAttribute("title") ?? "") ||
    normalizeWhitespace(doc.querySelector("#profile_left p.small")?.textContent ?? "") ||
    null

  return {
    group,
    joinedDate,
    lastAccessDate,
    lastAccessField: lastAccessDate ? "Активность" : undefined,
  }
}

/** bprate.php: the seeding size the welcome block does not print. */
export function parseTeamhdRates(html: string): Partial<TrackerStats> {
  assertAuthenticated(html)
  const doc = parseHtml(html)
  const table = doc.querySelector("table.table")
  const firstRow = table?.querySelector("tbody tr")

  const seedingCount = tryParseCount(firstRow?.querySelector("td:nth-child(1)")?.textContent)
  const seedingSize = tryParseSiteBytes(
    firstRow?.querySelector("td:nth-child(2)")?.textContent ?? ""
  )

  const meta: TeamhdPlatformMeta = {}
  if (seedingSize !== undefined) meta.seedSizeBytes = Number(seedingSize)

  return {
    seedingCount: seedingCount ?? null,
    platformMeta: Object.keys(meta).length > 0 ? meta : undefined,
  }
}

function mergeMeta(
  first: TrackerStats["platformMeta"],
  second: TrackerStats["platformMeta"]
): TeamhdPlatformMeta | undefined {
  const merged = {
    ...(first as TeamhdPlatformMeta | undefined),
    ...(second as TeamhdPlatformMeta | undefined),
  }
  return Object.keys(merged).length > 0 ? merged : undefined
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Request failed"
}

export class TeamhdAdapter implements TrackerAdapter {
  async fetchStats(
    baseUrl: string,
    apiToken: string,
    _apiPath: string,
    options?: FetchOptions
  ): Promise<TrackerStats> {
    const creds = parseTeamhdCredentials(apiToken)
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

    const home = parseTeamhdHomepage(await fetchPage(`${baseUrl}/index.php`), hostname)
    const stats = home.stats

    // Registration date, class and seeding size are enrichment. A page that
    // fails leaves those fields unknown rather than discarding the totals.
    try {
      const profile = parseTeamhdProfile(await fetchPage(`${baseUrl}/user/`))
      if (profile.group) stats.group = profile.group
      if (profile.joinedDate) stats.joinedDate = profile.joinedDate
      if (profile.lastAccessDate) {
        stats.lastAccessDate = profile.lastAccessDate
        stats.lastAccessField = profile.lastAccessField
      }
    } catch {
      // Keep the welcome-block figures.
    }

    try {
      const rates = parseTeamhdRates(await fetchPage(`${baseUrl}/bprate.php`))
      // The welcome block already prints the seed count; bprate is only a
      // fallback for it and the sole source of the seeding size.
      if (stats.seedingCount === null && typeof rates.seedingCount === "number") {
        stats.seedingCount = rates.seedingCount
      }
      stats.platformMeta = mergeMeta(stats.platformMeta, rates.platformMeta)
    } catch {
      // Keep the welcome-block figures.
    }

    return stats
  }

  async fetchRaw(
    baseUrl: string,
    apiToken: string,
    _apiPath: string,
    options?: FetchOptions
  ): Promise<DebugApiCall[]> {
    const creds = parseTeamhdCredentials(apiToken)
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

    try {
      const home = parseTeamhdHomepage(await fetchPage(`${baseUrl}/index.php`), hostname)
      calls.push({ label: "Home Page", endpoint: "/index.php", data: home.stats, error: null })
    } catch (err) {
      calls.push({ label: "Home Page", endpoint: "/index.php", data: null, error: errorMessage(err) })
      return calls
    }

    for (const [label, endpoint, parse] of [
      ["Profile", "/user/", parseTeamhdProfile],
      ["Seeding rates", "/bprate.php", parseTeamhdRates],
    ] as const) {
      try {
        calls.push({
          label,
          endpoint,
          data: parse(await fetchPage(`${baseUrl}${endpoint}`)),
          error: null,
        })
      } catch (err) {
        calls.push({ label, endpoint, data: null, error: errorMessage(err) })
      }
    }

    return calls
  }
}
