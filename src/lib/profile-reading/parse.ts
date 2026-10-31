// src/lib/profile-reading/parse.ts
//
// P49 layout parsers. Pure functions over a saved page, so the tests can use
// stored HTML fixtures and no adapter ever contacts a tracker here.
//
// UNIT3D (Upload.cx, OnlyEncodes, seedpool, Yu-Scene) and Portugas share the
// key-value profile layout. Zenith prints its current values after "You:" on
// the groups page. V3X puts level and XP on the profile page when it shows them.

import { parse as parseHtml } from "node-html-parser"
import { localDateStr, trackerDateStr } from "@/lib/formatters"
import type { ProfileReadValues } from "@/lib/profile-reading/types"
import {
  normalizeWhitespace,
  tryParseCount,
  tryParseSiteBytes,
} from "@/lib/tracker-platforms/helpers/html-parse"

type HtmlDocument = ReturnType<typeof parseHtml>

export interface ProfilePageRead {
  layout: "unit3d" | "zenith" | "v3x"
  values: ProfileReadValues
}

const DURATION_UNITS: Record<string, number> = {
  s: 1,
  sec: 1,
  secs: 1,
  second: 1,
  seconds: 1,
  m: 60,
  min: 60,
  mins: 60,
  minute: 60,
  minutes: 60,
  h: 3600,
  hr: 3600,
  hrs: 3600,
  hour: 3600,
  hours: 3600,
  d: 86_400,
  day: 86_400,
  days: 86_400,
  w: 7 * 86_400,
  week: 7 * 86_400,
  weeks: 7 * 86_400,
  mo: 30 * 86_400,
  month: 30 * 86_400,
  months: 30 * 86_400,
  y: 365 * 86_400,
  year: 365 * 86_400,
  years: 365 * 86_400,
  semana: 7 * 86_400,
  semanas: 7 * 86_400,
  dia: 86_400,
  dias: 86_400,
  hora: 3600,
  horas: 3600,
  minuto: 60,
  minutos: 60,
  mes: 30 * 86_400,
  meses: 30 * 86_400,
  ano: 365 * 86_400,
  anos: 365 * 86_400,
}

/** "3 weeks, 2 days" and "1 month" become seconds. Unknown text is undefined. */
export function parseDurationSeconds(raw: string): number | undefined {
  const text = normalizeWhitespace(raw).toLowerCase()
  if (!text) return undefined
  const clock = text.match(/^(\d+):(\d{2})(?::(\d{2}))?$/)
  if (clock) {
    const [hours, minutes, seconds] = clock.slice(1).map((part) => Number(part))
    return hours * 3600 + minutes * 60 + (seconds ?? 0)
  }

  const pattern = /(\d+(?:[.,]\d+)?)\s*([a-z]+)/g
  let total = 0
  let matched = false
  for (const match of text.matchAll(pattern)) {
    const amount = Number.parseFloat(match[1].replace(",", "."))
    const unit = DURATION_UNITS[match[2]]
    if (!Number.isFinite(amount) || unit === undefined) continue
    total += amount * unit
    matched = true
  }
  return matched ? Math.round(total) : undefined
}

function parseSafeBytes(raw: string): number | undefined {
  const bytes = tryParseSiteBytes(raw)
  if (bytes === undefined || bytes > BigInt(Number.MAX_SAFE_INTEGER)) return undefined
  return Number(bytes)
}

function addCount(target: ProfileReadValues, key: "uploads" | "level" | "xp", raw: string): void {
  const value = tryParseCount(raw.replace(/\s/g, ""))
  if (value === undefined || !Number.isInteger(value) || value < 0) return
  target[key] = value
}

interface LabelValue {
  label: string
  value: string
}

function pushPair(pairs: LabelValue[], label: string | undefined, value: string | undefined): void {
  if (!label || !value) return
  const normalizedLabel = normalizeWhitespace(label)
  const normalizedValue = normalizeWhitespace(value)
  if (!normalizedLabel || !normalizedValue) return
  pairs.push({ label: normalizedLabel, value: normalizedValue })
}

/** dt/dd groups, dl pairs and two-column table rows, de-duplicated. */
function collectLabelValues(doc: HtmlDocument): LabelValue[] {
  const pairs: LabelValue[] = []
  for (const group of doc.querySelectorAll(".key-value__group")) {
    pushPair(
      pairs,
      group.querySelector("dt")?.textContent,
      group.querySelector("dd")?.textContent
    )
  }
  for (const term of doc.querySelectorAll("dt")) {
    const sibling = term.nextElementSibling
    if (sibling?.rawTagName?.toLowerCase() === "dd") {
      pushPair(pairs, term.textContent, sibling.textContent)
    }
  }
  for (const row of doc.querySelectorAll("tr")) {
    const cells = row.querySelectorAll("td, th")
    if (cells.length < 2) continue
    pushPair(
      pairs,
      cells[0].textContent,
      cells
        .slice(1)
        .map((cell) => cell.textContent)
        .join(" ")
    )
  }

  const seen = new Set<string>()
  return pairs.filter((pair) => {
    const key = `${pair.label.toLowerCase()}=${pair.value}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function foldLabel(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function isSeedSizeLabel(label: string): boolean {
  const lower = foldLabel(label)
  return (
    (lower.includes("seed size") ||
      lower.includes("seedsize") ||
      lower.includes("tamanho das sementes") ||
      lower.includes("tamanho do seed")) &&
    !lower.includes("average")
  )
}

function isAverageSeedTimeLabel(label: string): boolean {
  const lower = foldLabel(label).replace(/[.]/g, "")
  return (
    ((lower.includes("seed time") || lower.includes("seedtime")) &&
      (lower.includes("average") || lower.includes("avg") || lower.includes("weighted"))) ||
    (lower.includes("tempo") && lower.includes("seed") && lower.includes("medio"))
  )
}

function isUploadCountLabel(label: string): boolean {
  const lower = foldLabel(label)
  if (lower.includes("uploaded") && !lower.includes("torrent")) return false
  return (
    lower === "uploads" ||
    lower === "upload count" ||
    lower.includes("uploaded torrents") ||
    lower.includes("upload count") ||
    lower.includes("envios") ||
    lower.includes("torrentes enviados")
  )
}

function isLastLoginLabel(label: string): boolean {
  const lower = foldLabel(label).replace(/\s+/g, " ").trim()
  return lower === "last login" || lower === "ultimo login" || lower === "last login time"
}

const DAY_MS = 86_400_000

/**
 * A profile row can print a timestamp or a relative phrase ("9 minutes ago").
 * `now` makes the relative form testable and keeps the result a calendar date,
 * which is what the deadline ring counts in.
 */
export function parseProfileLoginDate(raw: string, now: Date = new Date()): string | undefined {
  const text = normalizeWhitespace(raw)
  if (!text) return undefined
  const lower = text.toLowerCase()
  if (/^(never|n\/a|unknown|desconhecido|nunca)$/i.test(lower)) return undefined

  const absolute = trackerDateStr(text)
  if (absolute) return absolute

  if (/^(just now|a moment ago|moments? ago)$/.test(lower)) return localDateStr(now)
  if (lower === "today") return localDateStr(now)
  if (lower === "yesterday") return localDateStr(new Date(now.getTime() - DAY_MS))

  if (/\bago$/.test(lower)) {
    const seconds = parseDurationSeconds(lower.replace(/\bago$/, ""))
    if (seconds !== undefined) {
      return localDateStr(new Date(now.getTime() - seconds * 1000))
    }
  }
  return undefined
}

function valuesFromLabels(
  pairs: LabelValue[],
  uploadsFallback: boolean,
  now: Date
): ProfileReadValues {
  const values: ProfileReadValues = {}
  for (const { label, value } of pairs) {
    const lowerLabel = label.toLowerCase()
    if (values.seedSizeBytes === undefined && isSeedSizeLabel(label)) {
      values.seedSizeBytes = parseSafeBytes(value)
    }
    if (values.averageSeedTimeSeconds === undefined && isAverageSeedTimeLabel(label)) {
      values.averageSeedTimeSeconds = parseDurationSeconds(value)
    }
    if (values.lastLoginAt === undefined && isLastLoginLabel(label)) {
      values.lastLoginAt = parseProfileLoginDate(value, now)
    }
    // "Uploaded" is bytes on a profile page, but some groups layouts use it as
    // the count. Only the unitless form is a count, so bytes can never slip in.
    const uploadIsCount =
      isUploadCountLabel(label) ||
      (uploadsFallback && lowerLabel === "uploaded") ||
      (lowerLabel === "uploaded" && parseSafeBytes(value) === undefined)
    if (values.uploads === undefined && uploadIsCount) {
      addCount(values, "uploads", value)
    }
  }
  return values
}

export function parseUnit3dProfilePage(html: string, now: Date = new Date()): ProfileReadValues {
  return valuesFromLabels(collectLabelValues(parseHtml(html)), false, now)
}

function findLeafYouElements(doc: HtmlDocument): ReturnType<HtmlDocument["querySelectorAll"]> {
  const candidates = doc
    .querySelectorAll("td, th, li, dd, div, span, p")
    .filter((element) => normalizeWhitespace(element.textContent).includes("You:"))
  // Keep the innermost match so an ancestor row is not counted again.
  return candidates.filter(
    (element) =>
      !element
        .querySelectorAll("*")
        .some((child) => normalizeWhitespace(child.textContent).includes("You:"))
  )
}

function rowLabelFor(element: ReturnType<HtmlDocument["querySelector"]>): string | undefined {
  if (!element) return undefined
  const container = element.closest("tr, li, .key-value__group")
  if (!container) return undefined
  const firstCell = container.querySelector("td, th, dt")
  const label = normalizeWhitespace(firstCell?.textContent ?? "")
  if (!label || label.includes("You:")) return undefined
  return label
}

export function parseZenithGroupsPage(html: string): ProfileReadValues {
  const values: ProfileReadValues = {}
  const doc = parseHtml(html)

  for (const element of findLeafYouElements(doc)) {
    const text = normalizeWhitespace(element.textContent)
    const you = text.slice(text.toLowerCase().indexOf("you:") + 4).trim()
    const label = rowLabelFor(element)
    if (!label) continue
    const lower = label.toLowerCase().replace(/[.]/g, "")
    if (values.seedSizeBytes === undefined && isSeedSizeLabel(lower)) {
      values.seedSizeBytes = parseSafeBytes(you)
    } else if (
      values.averageSeedTimeSeconds === undefined &&
      (lower.includes("seed time") || lower.includes("seedtime"))
    ) {
      values.averageSeedTimeSeconds = parseDurationSeconds(you)
    } else if (
      values.uploads === undefined &&
      (lower === "uploaded" || isUploadCountLabel(lower) || lower.includes("uploaded torrent"))
    ) {
      addCount(values, "uploads", you)
    }
  }

  return values
}

function levelOrXp(label: string): "level" | "xp" | null {
  const lower = label.toLowerCase()
  if (/^(level|niveau|lvl)\b/.test(lower)) return "level"
  if (/^(xp|experience|exp)\b/.test(lower)) return "xp"
  return null
}

export function parseV3xProfilePage(html: string): ProfileReadValues {
  const values: ProfileReadValues = {}
  const doc = parseHtml(html)

  for (const { label, value } of collectLabelValues(doc)) {
    const key = levelOrXp(label)
    if (key === "level" && values.level === undefined) addCount(values, "level", value)
    if (key === "xp" && values.xp === undefined) addCount(values, "xp", value)
  }

  // Some V3X builds render the values as a sentence or a card rather than a
  // definition list. Only these two known labels are read this way.
  const text = normalizeWhitespace(doc.textContent)
  if (values.level === undefined) {
    const match = text.match(/(?:level|niveau|lvl)\s*:?\s*(\d+)/i)
    if (match) addCount(values, "level", match[1])
  }
  if (values.xp === undefined) {
    const match = text.match(/\bXP\s*:?\s*(\d[\d\s.,]*)/i)
    if (match) addCount(values, "xp", match[1])
  }

  return values
}

export function parseProfilePage(
  registrySlug: string | null | undefined,
  html: string,
  now: Date = new Date()
): ProfilePageRead | null {
  if (registrySlug === "zenith") {
    const values = parseZenithGroupsPage(html)
    return Object.keys(values).length > 0 ? { layout: "zenith", values } : null
  }
  if (registrySlug === "v3x") {
    const values = parseV3xProfilePage(html)
    return Object.keys(values).length > 0 ? { layout: "v3x", values } : null
  }
  const values = parseUnit3dProfilePage(html, now)
  return Object.keys(values).length > 0 ? { layout: "unit3d", values } : null
}
