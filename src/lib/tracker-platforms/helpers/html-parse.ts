// src/lib/tracker-platforms/helpers/html-parse.ts
//
// Functions: normalizeWhitespace, datePrefix, tryParseCount, tryParseSiteBytes

import { parseBytes } from "@/lib/parser"

// ---------------------------------------------------------------------------
// Shared text helpers for the scraping adapters. html-fetch.ts gets an
// authenticated page; this reads the strings out of one.
// ---------------------------------------------------------------------------

/**
 * Collapses runs of whitespace to single spaces. JS `\s` matches U+00A0, which
 * is the point: labels carry "Join&nbsp;date", so exact matches need this first.
 */
export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

/** `2026-08-20 19:05:17 (1 week ago)` -> `2026-08-20`. */
export function datePrefix(value: string): string | undefined {
  return value.match(/^(\d{4}-\d{2}-\d{2})/)?.[1]
}

/**
 * The first number in site text ("0", "1,234", "12.5"), or undefined when there
 * is none. Commas are stripped; a leading minus and decimals are kept.
 *
 * Undefined rather than null: platformMeta is JSON.stringify'd into the
 * trackers row, which drops an undefined member and stores a null one, so a
 * null here would write the key back on every poll. TrackerStats fields
 * coalesce with `?? null` where they are assigned.
 */
export function tryParseCount(value: string | null | undefined): number | undefined {
  const match = value?.match(/-?[\d,]+(?:\.\d+)?/)
  if (!match) return undefined
  const parsed = Number.parseFloat(match[0].replace(/,/g, ""))
  return Number.isFinite(parsed) ? parsed : undefined
}

/**
 * parseBytes' unit table is case-sensitive and mixes cases across families
 * ("KB" but "KiB"), so a site printing "kB" or "gib" misses it. Uppercasing the
 * whole unit fixes the decimal family and breaks the binary one, since "GiB"
 * becomes "GIB" and matches nothing.
 *
 * Tracker pages divide by 1024 at every step but label the result kB, MB, GB
 * and TB. Those are IEC units wearing decimal labels: TBDev mksize() and
 * NexusPHP both do this, and AvistaZ proves it with a paired column ("97.30 GB
 * (99,637 MB)"). Reading the labels as decimal understates a GB by about 7%
 * and a TB by about 10%. No site in this app prints decimal units, so page
 * labels map to the binary family. An explicit IEC label keeps its own unit.
 */
const SITE_UNITS: Record<string, string> = {
  b: "B",
  kb: "KiB",
  mb: "MiB",
  gb: "GiB",
  tb: "TiB",
  pb: "PiB",
  kib: "KiB",
  mib: "MiB",
  gib: "GiB",
  tib: "TiB",
  pib: "PiB",
}

/**
 * `parseBytes` for site-printed totals, returning undefined instead of throwing
 * so one odd cell cannot abort a whole profile parse. Grouping commas are
 * stripped and the unit is mapped to its binary spelling, so both "1,024 kB"
 * and "1 GiB" parse as 1 KiB and 1 GiB.
 */
export function tryParseSiteBytes(value: string): bigint | undefined {
  const match = value.trim().match(/^([\d,.]+)\s*([A-Za-z]+)$/)
  if (!match) return undefined
  const unit = SITE_UNITS[match[2].toLowerCase()]
  if (!unit) return undefined
  try {
    return parseBytes(`${match[1].replace(/,/g, "")} ${unit}`)
  } catch {
    return undefined
  }
}
