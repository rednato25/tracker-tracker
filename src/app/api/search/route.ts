// POST /api/search
//
// Explicit read-only search through Prowlarr. One request is made per selected
// indexer so a transport failure or timeout cannot hide successful results from
// the others. No download URL, magnet, info URL, guid or API key is returned.

import { NextResponse } from "next/server"
import { authenticate, decodeKey, parseJsonBody } from "@/lib/api-helpers"
import { decrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { appSettings } from "@/lib/db/schema"
import { errMsg } from "@/lib/error-utils"
import { log } from "@/lib/logger"
import { fetchProwlarrIndexers, normalizeProwlarrUrl } from "@/lib/prowlarr"
import {
  buildProwlarrSearchIndexers,
  PROWLARR_SEARCH_MAX_INDEXERS,
  PROWLARR_SEARCH_MAX_LIMIT,
  PROWLARR_SEARCH_MAX_OFFSET,
  searchProwlarrIndexers,
} from "@/lib/prowlarr-search"
import { getTrackerListForDashboard } from "@/lib/server-data"

const QUERY_MAX = 200

function integerInRange(value: unknown, fallback: number | null, min: number, max: number) {
  if (value === undefined && fallback !== null) return fallback
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) {
    return null
  }
  return value
}

export async function POST(request: Request) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const body = await parseJsonBody(request)
  if (body instanceof NextResponse) return body

  const rawQuery = typeof body.query === "string" ? body.query.trim() : ""
  const hasControlChars = [...rawQuery].some((char) => {
    const code = char.codePointAt(0) ?? 0
    return code < 0x20 || code === 0x7f
  })
  if (!rawQuery || rawQuery.length > QUERY_MAX || hasControlChars) {
    return NextResponse.json(
      { error: `query must be between 1 and ${QUERY_MAX} printable characters` },
      { status: 400 }
    )
  }

  const rawIds = body.indexerIds
  if (
    !Array.isArray(rawIds) ||
    rawIds.length === 0 ||
    rawIds.length > PROWLARR_SEARCH_MAX_INDEXERS ||
    !rawIds.every((id) => typeof id === "number" && Number.isSafeInteger(id) && id > 0)
  ) {
    return NextResponse.json(
      { error: `indexerIds must contain 1-${PROWLARR_SEARCH_MAX_INDEXERS} positive ids` },
      { status: 400 }
    )
  }
  const indexerIds = [...new Set(rawIds as number[])]
  if (indexerIds.length !== rawIds.length) {
    return NextResponse.json({ error: "indexerIds must not contain duplicates" }, { status: 400 })
  }

  const limit = integerInRange(body.limit, 10, 1, PROWLARR_SEARCH_MAX_LIMIT)
  const offset = integerInRange(body.offset, 0, 0, PROWLARR_SEARCH_MAX_OFFSET)
  if (limit === null || offset === null) {
    return NextResponse.json(
      { error: `limit/offset must be bounded integers (limit <= ${PROWLARR_SEARCH_MAX_LIMIT})` },
      { status: 400 }
    )
  }

  const [settings] = await db.select().from(appSettings).limit(1)
  if (!settings?.prowlarrUrl || !settings.encryptedProwlarrApiKey) {
    return NextResponse.json(
      { error: "Prowlarr is not configured", code: "not-configured" },
      { status: 400 }
    )
  }

  try {
    const url = normalizeProwlarrUrl(settings.prowlarrUrl)
    const apiKey = decrypt(settings.encryptedProwlarrApiKey, decodeKey(auth))
    const [indexers, trackers] = await Promise.all([
      fetchProwlarrIndexers(url, apiKey, { allowPrivate: settings.prowlarrAllowPrivate }),
      getTrackerListForDashboard(),
    ])
    const choices = buildProwlarrSearchIndexers(
      indexers,
      trackers.map((tracker) => ({
        id: tracker.id,
        name: tracker.name,
        registrySlug: tracker.registrySlug,
        userPausedAt: tracker.userPausedAt,
        hasStats: tracker.latestStats !== null,
      }))
    )
    const selected = choices.filter((choice) => indexerIds.includes(choice.indexerId))
    if (selected.length !== indexerIds.length) {
      return NextResponse.json(
        { error: "One or more selected indexers are no longer available in Prowlarr" },
        { status: 400 }
      )
    }

    const batch = await searchProwlarrIndexers({
      baseUrl: url,
      apiKey,
      allowPrivate: settings.prowlarrAllowPrivate,
      indexers: selected,
      query: rawQuery,
      limit,
      offset,
    })
    const byId = new Map(choices.map((choice) => [choice.indexerId, choice]))
    const failures = batch.failures
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      results: batch.releases.map((release) => ({
        ...release,
        indexer: byId.get(release.indexerId) ?? null,
      })),
      coverage: {
        selected: batch.selected,
        responded: batch.responded,
        failed: failures.length,
        failures,
        partial: failures.length > 0 && batch.responded > 0,
        allFailed: failures.length > 0 && batch.responded === 0,
        hasMore: batch.hasMore,
        limit,
        offset,
      },
    })
  } catch (err) {
    log.warn(
      { route: "POST /api/search", error: errMsg(err), queryLength: rawQuery.length },
      "Prowlarr search failed"
    )
    return NextResponse.json({ error: "Prowlarr search failed" }, { status: 502 })
  }
}
