// src/lib/tracker-platforms/adapters/fileiplay.ts
//
// Functions: parseFileiplayCredentials, parseLoginToken, isLoginPage, mergeCookies,
//            cookieHeader, pathOf, refuseNoVerdict, login, fetchHtml, withSession,
//            parseProfileHref, normalizedLabel, textOf, transferValue, profileName,
//            classBadge, findLabelValue, visibleText, findBytesLabel, findCountLabel,
//            findDateLabel, bytesFromText, parseSiteDate, findUsername,
//            parseFileiplayProfile, readProfile, FileiplayAdapter
//
// FileIplay is a Laravel tracker with a small upload API but no stats API, so
// the adapter logs in with the username and password, then reads the profile
// page. The login page is a standard form protected by a Laravel CSRF token:
// the token is read from the form, the session cookie from the same answer, and
// both are replayed on the POST. Sessions are cached per credential set, and a
// profile request that lands on the login page renews the session once.

import { type HTMLElement as ParsedElement, parse as parseHtml } from "node-html-parser"
import { computeBufferBytes, computeRatio } from "@/lib/data-transforms"
import { isRedirect } from "@/lib/network"
import { validateTrackerUsername } from "@/lib/tracker-credentials/tracker-username"
import type { DebugApiCall, FetchOptions, TrackerAdapter, TrackerStats } from "../contract"
import { presentClass } from "../helpers/class-name"
import { parseCredentialJson } from "../helpers/cookie-credentials"
import { SessionExpiredError } from "../helpers/errors"
import { fetchTrackerHtml } from "../helpers/html-fetch"
import {
  datePrefix,
  isCloudflareChallenge,
  isCloudflareInterstitial,
  normalizeWhitespace,
  tryParseCount,
  tryParseSiteBytes,
} from "../helpers/html-parse"
import { type LoginResponse, loginRequest, withLoginSession } from "../helpers/login-session"

const LABEL = "FileIplay"
const LOGIN_PATH = "/login"
const SESSION_EXPIRED =
  "Session expired. Check the stored FileIplay username and password if this persists"
const ACCEPT_HTML = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"

// ---------------------------------------------------------------------------
// Credential handling
// ---------------------------------------------------------------------------

interface FileiplayCredentials {
  username: string
  password: string
}

export function parseFileiplayCredentials(apiToken: string): FileiplayCredentials {
  const { username, password } = parseCredentialJson(apiToken, LABEL, [
    "username",
    "password",
  ] as const)

  // Never trimmed: leading or trailing spaces are part of the secret.
  return { username: validateTrackerUsername(username), password }
}

// ---------------------------------------------------------------------------
// Login
//
// A refused login is a 302 back to /login; a good one redirects anywhere else.
// The site can answer a stale CSRF token with 419, so one retry reads a fresh
// form and session before giving up.
// ---------------------------------------------------------------------------

function parseLoginToken(html: string): string | null {
  return parseHtml(html).querySelector('input[name="_token"]')?.getAttribute("value") || null
}

function isLoginPage(html: string): boolean {
  const doc = parseHtml(html)
  // A profile page can carry a hidden login form in a shell; the profile's own
  // landmarks win so a signed-in page is never mistaken for the login page.
  if (doc.querySelector(".profile-name, .profile-hero, .transfer-card")) return false
  if (doc.querySelector('form[action*="/login"] input[name="name"]')) return true
  const heading = normalizeWhitespace(doc.querySelector("h1")?.textContent ?? "")
  return heading.toLowerCase().includes("sign in to fileiplay")
}

function mergeCookies(jar: Map<string, string>, setCookies: string[]): void {
  for (const raw of setCookies) {
    const pair = raw.split(";")[0]?.trim() ?? ""
    const eq = pair.indexOf("=")
    if (eq > 0) jar.set(pair.slice(0, eq), pair.slice(eq + 1))
  }
}

function cookieHeader(jar: Map<string, string>): string {
  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ")
}

/** The path a redirect names, or undefined when it cannot be read. */
function pathOf(location: string, baseUrl: string): string | undefined {
  try {
    return new URL(location, baseUrl).pathname
  } catch {
    return undefined
  }
}

/**
 * A challenge, a proxy refusal, a 429 or a 5xx is no verdict on the
 * credentials, so it is reported before anything is read from the answer. The
 * challenge comes first because one can arrive with a 503.
 */
function refuseNoVerdict(res: LoginResponse, body: string): void {
  if (isCloudflareInterstitial(body)) {
    throw new Error("Cloudflare challenge detected on the FileIplay login page")
  }
  if (res.status === 407 || res.status === 429 || res.status >= 500) {
    throw new Error(`Tracker API error: ${res.status} ${res.statusText}`)
  }
}

async function login(
  baseUrl: string,
  creds: FileiplayCredentials,
  proxyAgent?: FetchOptions["proxyAgent"]
): Promise<string> {
  const hostname = new URL(baseUrl).hostname
  const loginUrl = `${baseUrl}${LOGIN_PATH}`
  const jar = new Map<string, string>()

  for (let attempt = 0; attempt < 2; attempt++) {
    const form = await loginRequest(
      loginUrl,
      { method: "GET", headers: { Accept: ACCEPT_HTML } },
      proxyAgent
    )
    const formHtml = await form.text()
    refuseNoVerdict(form, formHtml)
    mergeCookies(jar, form.setCookies)
    const token = parseLoginToken(formHtml)
    if (!token) {
      throw new Error(`Unexpected response from ${hostname}: no login form`)
    }

    const body = new URLSearchParams({
      _token: token,
      name: creds.username,
      password: creds.password,
    }).toString()
    const res = await loginRequest(
      loginUrl,
      {
        method: "POST",
        headers: {
          Accept: ACCEPT_HTML,
          "Content-Type": "application/x-www-form-urlencoded",
          Cookie: cookieHeader(jar),
        },
        body,
      },
      proxyAgent
    )
    const resBody = isRedirect(res.status) ? "" : await res.text()
    refuseNoVerdict(res, resBody)
    mergeCookies(jar, res.setCookies)

    if (res.status === 419 && attempt === 0) continue

    if (isRedirect(res.status)) {
      const location = res.location()
      if (!location) {
        throw new Error(`Unexpected response from ${hostname}: redirect with no Location`)
      }
      const path = pathOf(location, baseUrl)
      if (path === LOGIN_PATH) {
        throw new Error("Invalid FileIplay username or password")
      }
      if (path?.includes("two-factor") || path?.includes("2fa")) {
        throw new Error(
          "FileIplay account uses two-factor login, which this adapter cannot complete"
        )
      }
      return cookieHeader(jar)
    }

    if (res.status === 401 || res.status === 403 || res.status === 422) {
      throw new Error("Invalid FileIplay username or password")
    }
    if (isLoginPage(resBody)) {
      throw new Error("Invalid FileIplay username or password")
    }
    // A 200 that is not the login page is accepted, like the login helper's
    // posture for a site that answers success without a redirect.
    if (jar.size > 0) return cookieHeader(jar)
    throw new Error(`Unexpected response from ${hostname}: the login answered without a session`)
  }

  throw new Error(`Unexpected response from ${hostname}: the login form expired before it was accepted`)
}

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

function fetchHtml(
  url: string,
  cookies: string,
  options?: FetchOptions
): Promise<string> {
  return fetchTrackerHtml({
    url,
    cookies,
    proxyAgent: options?.proxyAgent,
    label: LABEL,
    sessionExpiredMessage: SESSION_EXPIRED,
    followRedirects: { loginPattern: /\/login(?:\?|$)/i },
  })
}

async function withSession<T>(
  baseUrl: string,
  creds: FileiplayCredentials,
  options: FetchOptions | undefined,
  work: (page: (url: string) => Promise<string>) => Promise<T>
): Promise<T> {
  return withLoginSession(
    baseUrl,
    [creds.username, creds.password],
    () => login(baseUrl, creds, options?.proxyAgent),
    (cookies) => work((url) => fetchHtml(url, cookies, options))
  )
}

// ---------------------------------------------------------------------------
// Profile page parser
//
// FileIplay has shipped more than one profile layout, so a figure is located by
// its label rather than by a fixed selector. Table rows, definition lists and
// label/value card pairs are all read; a visible-text regex is the fallback for
// a cell that holds the label and the value in one text node.
// ---------------------------------------------------------------------------

/**
 * The link to the signed-in member's profile on the home page. Reading it
 * instead of assuming `/profile/<login>` also handles a member who signs in
 * with an email address, which is not the profile slug.
 */
export function parseProfileHref(html: string, username: string): string {
  const doc = parseHtml(html)
  const wanted = username.toLowerCase()
  let fallback: string | undefined
  for (const link of doc.querySelectorAll("a[href]")) {
    const href = link.getAttribute("href") ?? ""
    let path: string
    try {
      path = href.startsWith("http") ? new URL(href).pathname : href
    } catch {
      continue
    }
    const match = path.match(/^\/profile\/([^/?#]+)\/?$/)
    if (!match) continue
    const slug = decodeURIComponent(match[1]).toLowerCase()
    if (["edit", "settings", "delete", "notifications", "preferences"].includes(slug)) continue
    const hrefValue = `/profile/${match[1]}`
    // Prefer the signed-in member's own link; a sidebar can carry another
    // member's profile link first.
    if (slug === wanted || normalizeWhitespace(link.textContent).toLowerCase().includes(wanted)) {
      return hrefValue
    }
    fallback ??= hrefValue
  }
  return fallback ?? `/profile/${encodeURIComponent(username)}`
}

function normalizedLabel(text: string): string {
  return normalizeWhitespace(text).toLowerCase().replace(/:\s*$/, "")
}

function textOf(doc: ParsedElement, selector: string): string {
  return normalizeWhitespace(doc.querySelector(selector)?.textContent ?? "")
}

/**
 * The profile's transfer cards. The site's public profile stylesheet names the
 * four modifiers (uploaded, downloaded, ratio, seeding) and puts the figure in
 * a <strong> under .transfer-content, so these are read by class before the
 * label scan is tried.
 */
function transferValue(doc: ParsedElement, kind: string): string | undefined {
  return (
    textOf(doc, `.transfer-card.${kind} .transfer-content strong`) ||
    textOf(doc, `.transfer-card.${kind} strong`) ||
    undefined
  )
}

function profileName(doc: ParsedElement): string | undefined {
  return textOf(doc, ".profile-name") || undefined
}

function classBadge(doc: ParsedElement): string | undefined {
  return textOf(doc, ".profile-role-badge") || undefined
}

interface LabelMatch {
  label: string
  value: string
}

/**
 * Finds a label and the value beside it. `accept` rejects a candidate that is
 * not the right kind of figure, so a nav link named "Upload" with a count
 * cannot shadow the profile's real byte total further down the page.
 */
function findLabelValue(
  doc: ParsedElement,
  labels: readonly string[],
  accept?: (value: string) => boolean
): LabelMatch | undefined {
  const accepts = (value: string) => !accept || accept(value)

  // Table rows: label cell first, value in the next cell with text.
  for (const row of doc.querySelectorAll("tr")) {
    const cells = row.querySelectorAll("td, th")
    if (cells.length < 2) continue
    const label = normalizedLabel(cells[0]?.textContent ?? "")
    if (!labels.includes(label)) continue
    for (let i = 1; i < cells.length; i++) {
      const value = normalizeWhitespace(cells[i]?.textContent ?? "")
      if (value && accepts(value)) return { label, value }
    }
  }

  // Definition lists.
  for (const dt of doc.querySelectorAll("dt")) {
    const label = normalizedLabel(dt.textContent ?? "")
    if (!labels.includes(label)) continue
    const dd = dt.nextElementSibling
    if (dd?.tagName === "DD") {
      const value = normalizeWhitespace(dd.textContent ?? "")
      if (value && accepts(value)) return { label, value }
    }
  }

  // Cards and inline label/value pairs: a short element whose whole text is
  // the label, with the figure in the next element or text node.
  for (const el of doc.querySelectorAll("span, div, strong, b, label, p, td, th, li, h3, h4")) {
    const text = normalizeWhitespace(el.textContent ?? "")
    const label = normalizedLabel(text)
    if (!labels.includes(label) || text.length > 60) continue
    const candidates = [
      el.nextElementSibling?.textContent,
      el.nextSibling?.textContent,
      el.parentNode?.nextElementSibling?.textContent,
      el.parentNode?.textContent?.replace(el.textContent ?? "", " "),
    ]
    for (const raw of candidates) {
      const value = normalizeWhitespace(raw ?? "")
      if (!value || labels.includes(normalizedLabel(value)) || !accepts(value)) continue
      return { label, value }
    }
  }

  return undefined
}

/** Visible text with scripts and styles removed, for the one-cell fallbacks. */
function visibleText(html: string): string {
  const doc = parseHtml(html)
  for (const el of doc.querySelectorAll("script, style")) el.remove()
  return normalizeWhitespace(doc.textContent)
}

/**
 * The fallback for a cell that holds "Uploaded: 1.2 TB" in one text node. Only
 * a byte figure is read here; a count or a class is too easy to confuse with
 * another label on the same line.
 */
function findBytesLabel(
  text: string,
  labels: readonly string[]
): LabelMatch | undefined {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const match = text.match(
      new RegExp(`(?:^|\\s)${escaped}\\s*:?\\s*([\\d.,]+\\s*[KMGT]i?B|B)\\b`, "i")
    )
    if (match) return { label, value: match[1] }
  }
  return undefined
}

/**
 * A count printed in one text node with its label, such as "Bonus 1,234.50".
 * Used only after the label/value scan, and only for figures whose labels are
 * specific enough that a nav link cannot satisfy them.
 */
function findCountLabel(
  text: string,
  labels: readonly string[]
): LabelMatch | undefined {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const match = text.match(
      new RegExp(`(?:^|\\s)${escaped}\\s*:?\\s*(-?[\\d,]+(?:\\.\\d+)?)`, "i")
    )
    if (match) return { label, value: match[1] }
  }
  return undefined
}

/**
 * A date printed in one text node with its label, such as
 * "Joined September 3, 2026". The candidate is returned only when it parses, so
 * a nav link that happens to contain the word cannot become a date.
 */
function findDateLabel(
  text: string,
  labels: readonly string[]
): LabelMatch | undefined {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const match = text.match(
      new RegExp(`(?:^|\\s)${escaped}\\s*:?\\s*([A-Za-z0-9,./ -]{4,40})`, "i")
    )
    if (match && parseSiteDate(match[1])) return { label, value: match[1] }
  }
  return undefined
}

/** The first "number unit" pair in a value, so "UP: 1.2 TB" and "1.2 TB" both read. */
function bytesFromText(value: string): bigint | undefined {
  const match = value.match(/([\d.,]+)\s*([KMGT]i?B|B)\b/i)
  if (!match) return undefined
  return tryParseSiteBytes(`${match[1]} ${match[2]}`)
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

/** A date on the profile as YYYY-MM-DD, or undefined for an unrecognised shape. */
export function parseSiteDate(value: string | undefined): string | undefined {
  if (!value) return undefined
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

function findUsername(doc: ParsedElement, fallback: string): string {
  const named = profileName(doc)
  if (named && named.length <= 50) return named

  const generic = new Set([
    "profile",
    "my profile",
    "account",
    "user profile",
    "dashboard",
    "fileiplay",
  ])
  for (const selector of ["h1", "h2"]) {
    const text = normalizeWhitespace(doc.querySelector(selector)?.textContent ?? "")
    if (text && text.length <= 50 && !generic.has(text.toLowerCase())) {
      return text
    }
  }
  return fallback
}

export function parseFileiplayProfile(
  html: string,
  hostname: string,
  username: string
): TrackerStats {
  if (isCloudflareChallenge(html)) {
    throw new Error("Cloudflare challenge detected on FileIplay")
  }
  if (isLoginPage(html)) {
    throw new SessionExpiredError(SESSION_EXPIRED)
  }

  const doc = parseHtml(html)
  const uploadedLabels = ["uploaded", "upload", "uploaded data", "total uploaded"] as const
  const downloadedLabels = [
    "downloaded",
    "download",
    "downloaded data",
    "total downloaded",
  ] as const
  const text = visibleText(html)
  const acceptBytes = (value: string) => bytesFromText(value) !== undefined
  const acceptCount = (value: string) => tryParseCount(value) !== undefined
  const acceptDate = (value: string) => parseSiteDate(value) !== undefined
  const uploadedCard = transferValue(doc, "uploaded")
  const downloadedCard = transferValue(doc, "downloaded")
  const uploadedMatch =
    (uploadedCard && acceptBytes(uploadedCard)
      ? { label: "uploaded", value: uploadedCard }
      : undefined) ??
    findLabelValue(doc, uploadedLabels, acceptBytes) ??
    findBytesLabel(text, uploadedLabels)
  const downloadedMatch =
    (downloadedCard && acceptBytes(downloadedCard)
      ? { label: "downloaded", value: downloadedCard }
      : undefined) ??
    findLabelValue(doc, downloadedLabels, acceptBytes) ??
    findBytesLabel(text, downloadedLabels)

  if (!uploadedMatch && !downloadedMatch) {
    throw new Error(
      `Unexpected response from ${hostname}: could not find profile stats on the FileIplay page. The page may not be authenticated`
    )
  }

  const uploadedBytes = uploadedMatch ? bytesFromText(uploadedMatch.value) : undefined
  const downloadedBytes = downloadedMatch ? bytesFromText(downloadedMatch.value) : undefined
  if (uploadedBytes === undefined) {
    throw new Error(`Unexpected response from ${hostname}: unreadable uploaded byte total`)
  }
  if (downloadedBytes === undefined) {
    throw new Error(`Unexpected response from ${hostname}: unreadable downloaded byte total`)
  }

  const groupMatch = findLabelValue(doc, ["class", "rank", "user class", "group", "member class"])
  // A card's parent text can carry the whole row; only a short value is a class.
  const groupValue = normalizeWhitespace(classBadge(doc) ?? groupMatch?.value ?? "")
  const group = presentClass(groupValue.length <= 40 ? groupValue : undefined)

  const bonusLabels = ["bonus", "seedbonus", "seed bonus", "bonus points", "credits"] as const
  const bonusMatch =
    findLabelValue(doc, bonusLabels, acceptCount) ??
    findCountLabel(text, ["bonus points", "seedbonus", "seed bonus", "bonus", "credits"])
  const seedbonus = tryParseCount(bonusMatch?.value) ?? null

  const activeMatch = findLabelValue(
    doc,
    ["active torrents", "active downloads"],
    (value) => Boolean(value.match(/\d[\d,]*/g)?.length)
  )
  const activeCounts = activeMatch?.value.match(/\d[\d,]*/g) ?? []
  const seedingLabels = [
    "seeding",
    "seeding torrents",
    "torrents seeding",
    "seeding count",
  ] as const
  const leechingLabels = [
    "leeching",
    "leeching torrents",
    "torrents leeching",
    "downloading",
    "active downloads",
  ] as const
  const seedingMatch =
    findLabelValue(doc, seedingLabels, acceptCount) ?? findCountLabel(text, seedingLabels)
  const leechingMatch =
    findLabelValue(doc, leechingLabels, acceptCount) ?? findCountLabel(text, leechingLabels)
  const seedingCount =
    tryParseCount(transferValue(doc, "seeding")) ??
    tryParseCount(activeCounts[0]) ??
    tryParseCount(seedingMatch?.value) ??
    null
  const leechingCount =
    tryParseCount(activeCounts[1]) ?? tryParseCount(leechingMatch?.value) ?? null

  const hnrLabels = ["hit and runs", "hit and run", "hnr", "h&r"] as const
  const hnrMatch = findLabelValue(doc, hnrLabels, acceptCount) ?? findCountLabel(text, hnrLabels)
  const hitAndRuns = tryParseCount(hnrMatch?.value) ?? null

  const requiredRatioLabels = ["required ratio", "ratio required"] as const
  const requiredRatioMatch =
    findLabelValue(doc, requiredRatioLabels, acceptCount) ??
    findCountLabel(text, requiredRatioLabels)
  const requiredRatio = tryParseCount(requiredRatioMatch?.value) ?? null

  const warnedMatch = findLabelValue(
    doc,
    ["warned", "warning", "warnings"],
    (value) => /^(yes|no|true|false|warned|not warned|none)$/i.test(normalizeWhitespace(value))
  )
  let warned: boolean | null = null
  const warnedText = normalizeWhitespace(warnedMatch?.value ?? "").toLowerCase()
  if (/^(yes|true|warned)$/.test(warnedText)) warned = true
  else if (/^(no|false|not warned|none)$/.test(warnedText)) warned = false

  const tokensLabels = ["freeleech tokens", "fl tokens"] as const
  const tokensMatch =
    findLabelValue(doc, tokensLabels, acceptCount) ?? findCountLabel(text, tokensLabels)
  const freeleechTokens = tryParseCount(tokensMatch?.value) ?? null

  const joinedLabels = [
    "joined",
    "join date",
    "joined on",
    "registered",
    "registration date",
    "member since",
  ] as const
  const joinedMatch =
    findLabelValue(doc, joinedLabels, acceptDate) ?? findDateLabel(text, joinedLabels)
  const joinedDate = parseSiteDate(joinedMatch?.value)

  const lastAccessLabels = ["last seen", "last access", "last active", "last login"] as const
  const lastAccessMatch =
    findLabelValue(doc, lastAccessLabels, acceptDate) ?? findDateLabel(text, lastAccessLabels)
  const lastAccessDate = parseSiteDate(lastAccessMatch?.value)

  const stats: TrackerStats = {
    username: findUsername(doc, username),
    group,
    uploadedBytes,
    downloadedBytes,
    ratio: computeRatio(uploadedBytes, downloadedBytes),
    bufferBytes: computeBufferBytes(uploadedBytes, downloadedBytes),
    seedingCount,
    leechingCount,
    seedbonus,
    hitAndRuns,
    requiredRatio,
    warned,
    freeleechTokens,
  }
  if (joinedDate) stats.joinedDate = joinedDate
  if (lastAccessDate) {
    stats.lastAccessDate = lastAccessDate
    stats.lastAccessField = lastAccessMatch?.label ?? "Last access"
  }
  return stats
}

async function readProfile(
  page: (url: string) => Promise<string>,
  baseUrl: string,
  username: string,
  hostname: string,
  progress: { endpoint: string }
): Promise<TrackerStats> {
  const home = await page(`${baseUrl}/`)
  if (isLoginPage(home)) throw new SessionExpiredError(SESSION_EXPIRED)
  progress.endpoint = parseProfileHref(home, username)
  return parseFileiplayProfile(await page(`${baseUrl}${progress.endpoint}`), hostname, username)
}

// ---------------------------------------------------------------------------
// Adapter class
// ---------------------------------------------------------------------------

export class FileiplayAdapter implements TrackerAdapter {
  async fetchStats(
    baseUrl: string,
    apiToken: string,
    _apiPath: string,
    options?: FetchOptions
  ): Promise<TrackerStats> {
    const creds = parseFileiplayCredentials(apiToken)
    const hostname = new URL(baseUrl).hostname
    return withSession(baseUrl, creds, options, (page) =>
      readProfile(page, baseUrl, creds.username, hostname, { endpoint: `/profile/${creds.username}` })
    )
  }

  async fetchRaw(
    baseUrl: string,
    apiToken: string,
    _apiPath: string,
    options?: FetchOptions
  ): Promise<DebugApiCall[]> {
    const calls: DebugApiCall[] = []
    // Outside any try: bad credentials are a caller error, not a call entry.
    const creds = parseFileiplayCredentials(apiToken)
    const hostname = new URL(baseUrl).hostname
    const progress = { endpoint: `/profile/${encodeURIComponent(creds.username)}` }
    let stage: "login" | "home" | "profile" = "login"

    try {
      await withSession(baseUrl, creds, options, async (page) => {
        stage = "home"
        const home = await page(`${baseUrl}/`)
        if (isLoginPage(home)) throw new SessionExpiredError(SESSION_EXPIRED)
        progress.endpoint = parseProfileHref(home, creds.username)
        calls.push({
          label: "Home Page (profile lookup)",
          endpoint: "/",
          data: { profileEndpoint: progress.endpoint },
          error: null,
        })

        stage = "profile"
        const stats = parseFileiplayProfile(
          await page(`${baseUrl}${progress.endpoint}`),
          hostname,
          creds.username
        )
        calls.push({
          label: "Profile Page",
          endpoint: progress.endpoint,
          data: stats,
          error: null,
        })
        return stats
      })
    } catch (err) {
      const error = err instanceof Error ? err.message : "Request failed"
      if (stage === "login") {
        calls.push({ label: "Login", endpoint: LOGIN_PATH, data: null, error })
      } else if (stage === "home") {
        calls.push({
          label: "Home Page (profile lookup)",
          endpoint: "/",
          data: null,
          error,
        })
      } else {
        calls.push({
          label: "Profile Page",
          endpoint: progress.endpoint,
          data: null,
          error,
        })
      }
    }
    return calls
  }
}
