// src/lib/tracker-platforms/adapters/teamhd.ts
//
// Functions: parseTeamhdCredentials, assertAuthenticated, valueAfterGlyph,
//            parseTeamhdHomepage, parseRussianDate, parseTeamhdProfile,
//            parseTeamhdRates, mergeMeta, errorMessage, TeamhdAdapter
//
// TeamHD is a custom NexusPHP fork with no user API and a reCAPTCHA on its
// login page (Jackett's teamhd.yml uses the cookie method for the same reason),
// so this adapter reads the logged-in pages:
//
//   /index.php  the welcome block: upload, download, ratio, bonus
//   /user/      the account's own profile: join date and class
//   /bprate.php seeding count and seeding size
//
// The selectors follow PT-depiler's teamhd.ts, which documents this site's
// markup. They have NOT been checked against a live logged-in page here, so
// each page's figures are enrichment: a page that does not parse leaves its
// fields unknown rather than failing the poll.

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
import {
  normalizeWhitespace,
  tryParseCount,
  tryParseSiteBytes,
} from "../helpers/html-parse"

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
 * upload green, download dark red and ratio blue, with the figure as a sibling
 * text node rather than inside the <font> element.
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

export interface TeamhdHomeReadout {
  stats: TrackerStats
  /** The profile path segment ("id7279"), not an integer. */
  profileId?: string
  profileName?: string
}

export function parseTeamhdHomepage(html: string, hostname: string): TeamhdHomeReadout {
  assertAuthenticated(html)
  const doc = parseHtml(html)

  // The header block, when the theme still uses the documented one.
  const block = doc.querySelector("div.col-8.mb-4") ?? doc

  const profileLink = doc.querySelector("a[href*='/user/']")
  const profileHref = profileLink?.getAttribute("href") ?? ""
  const profileName = normalizeWhitespace(profileLink?.textContent ?? "")
  const profileId = profileHref.split("/").filter(Boolean).at(-1)

  const uploadedBytes = tryParseSiteBytes(valueAfterGlyph(block, UPLOAD_GLYPHS) ?? "")
  const downloadedBytes = tryParseSiteBytes(valueAfterGlyph(block, DOWNLOAD_GLYPHS) ?? "")
  const ratio = tryParseCount(valueAfterGlyph(block, RATIO_GLYPHS))

  if (uploadedBytes === undefined) {
    throw new Error(`Unexpected response from ${hostname}: missing uploaded total`)
  }
  if (downloadedBytes === undefined) {
    throw new Error(`Unexpected response from ${hostname}: missing downloaded total`)
  }

  const seedbonus = tryParseCount(
    doc.querySelector("a.online[href='/mybonus.php']")?.textContent ??
      doc.querySelector("a[href*='mybonus.php']")?.textContent
  )
  const unreadMessages = tryParseCount(
    doc.querySelector("#message_box a font")?.textContent ?? undefined
  )

  const meta: TeamhdPlatformMeta = {}
  if (unreadMessages !== undefined) meta.unreadMessages = unreadMessages

  return {
    profileId,
    profileName,
    stats: {
      username: profileName,
      group: null,
      uploadedBytes,
      downloadedBytes,
      ratio: ratio ?? computeRatio(uploadedBytes, downloadedBytes),
      bufferBytes: computeBufferBytes(uploadedBytes, downloadedBytes),
      seedingCount: null,
      leechingCount: null,
      seedbonus: seedbonus ?? null,
      hitAndRuns: null,
      requiredRatio: null,
      warned: null,
      freeleechTokens: null,
      platformMeta: Object.keys(meta).length > 0 ? meta : undefined,
    },
  }
}

/** Russian month names as the profile prints them, in the nominative case. */
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

/** `14 марта 2021` -> `2021-03-14`. Undefined when the shape is not that one. */
export function parseRussianDate(value: string): string | undefined {
  const text = normalizeWhitespace(value).split("(")[0] ?? ""
  const match = text.match(/^(\d{1,2})\s+([А-Яа-яЁё]+)\s+(\d{4})/)
  if (!match) return undefined
  const month = RU_MONTHS[match[2].toLowerCase()]
  if (!month) return undefined
  return `${match[3]}-${month}-${match[1].padStart(2, "0")}`
}

/** The account's own profile page: join date and class. */
export function parseTeamhdProfile(html: string): Partial<TrackerStats> {
  assertAuthenticated(html)
  const doc = parseHtml(html)

  const joinedCell = doc.querySelector(
    "#profile_right table.inlay tbody tr:nth-child(1) td:nth-child(2)"
  )
  // The theme has moved these rows between releases, so the label is matched in
  // the page text when the documented selector no longer fires. The marker is
  // either the site's own Russian label or the English one.
  const joinedMarker = normalizeWhitespace(doc.textContent).match(
    /(?:Присоединил\w*|Зарегистрирован\w*|Дата регистрации|Joined|Join date|Registered on)\W*(\d{1,2}\s+[А-Яа-яЁё]+\s+\d{4})/
  )
  const joinedDate =
    (joinedCell ? parseRussianDate(joinedCell.textContent) : undefined) ??
    parseRussianDate(joinedMarker?.[1] ?? "")

  const classCell = doc.querySelector(
    "#profile_left table tr td:nth-child(2) p:nth-child(1) u span"
  )
  const group = classCell ? normalizeWhitespace(classCell.textContent).split("(")[0]?.trim() : null

  return {
    group: group || null,
    joinedDate,
  }
}

/** bprate.php: the seeding totals the welcome block does not print. */
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

    // Join date, class and seeding totals are enrichment. A page that fails
    // leaves those fields unknown rather than discarding the totals.
    try {
      const profile = parseTeamhdProfile(await fetchPage(`${baseUrl}/user/`))
      if (profile.group) stats.group = profile.group
      if (profile.joinedDate) stats.joinedDate = profile.joinedDate
    } catch {
      // Keep the welcome-block figures.
    }

    try {
      const rates = parseTeamhdRates(await fetchPage(`${baseUrl}/bprate.php`))
      if (rates.seedingCount !== undefined && rates.seedingCount !== null) {
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
        calls.push({ label, endpoint, data: parse(await fetchPage(`${baseUrl}${endpoint}`)), error: null })
      } catch (err) {
        calls.push({ label, endpoint, data: null, error: errorMessage(err) })
      }
    }

    return calls
  }
}
