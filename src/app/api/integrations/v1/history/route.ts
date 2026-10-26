// GET /api/integrations/v1/history
//
// Bounded read-only snapshot history. The query never calls a tracker; it reads
// rows the normal poller already stored.

import { and, desc, eq, gte, lt, type SQL } from "drizzle-orm"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { trackerSnapshots } from "@/lib/db/schema"
import { errMsg } from "@/lib/error-utils"
import {
  buildIntegrationHistory,
  type IntegrationHistoryItem,
  parseHistoryQuery,
} from "@/lib/integration-api"
import { authenticateIntegration as authenticate } from "@/lib/integration-auth"
import { log } from "@/lib/logger"

const MS_PER_DAY = 24 * 60 * 60 * 1000

export async function GET(request: Request) {
  const auth = await authenticate(request, "history:read")
  if (auth instanceof NextResponse) return auth

  const parsed = parseHistoryQuery(new URL(request.url))
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const { days, limit, trackerId, before } = parsed.query
  const now = new Date()
  const conditions: SQL[] = [
    gte(trackerSnapshots.polledAt, new Date(now.getTime() - days * MS_PER_DAY)),
  ]
  if (trackerId !== null) conditions.push(eq(trackerSnapshots.trackerId, trackerId))
  if (before !== null) conditions.push(lt(trackerSnapshots.polledAt, new Date(before)))

  try {
    const rows = await db
      .select({
        trackerId: trackerSnapshots.trackerId,
        polledAt: trackerSnapshots.polledAt,
        uploadedBytes: trackerSnapshots.uploadedBytes,
        downloadedBytes: trackerSnapshots.downloadedBytes,
        ratio: trackerSnapshots.ratio,
        bufferBytes: trackerSnapshots.bufferBytes,
        seeding: trackerSnapshots.seedingCount,
        leeching: trackerSnapshots.leechingCount,
        isManual: trackerSnapshots.isManual,
      })
      .from(trackerSnapshots)
      .where(and(...conditions))
      .orderBy(desc(trackerSnapshots.polledAt))
      .limit(limit + 1)

    const truncated = rows.length > limit
    const page: IntegrationHistoryItem[] = rows.slice(0, limit).map((row) => ({
      trackerId: row.trackerId,
      polledAt: row.polledAt.toISOString(),
      uploadedBytes: row.uploadedBytes.toString(),
      downloadedBytes: row.downloadedBytes.toString(),
      ratio: row.ratio,
      bufferBytes: row.bufferBytes?.toString() ?? null,
      seeding: row.seeding,
      leeching: row.leeching,
      isManual: row.isManual,
    }))
    // The SQL order is newest-first for the cursor; the response is oldest-first
    // so a chart can plot it without reversing it again.
    page.reverse()

    return NextResponse.json(buildIntegrationHistory(parsed.query, page, truncated, now), {
      headers: { "Cache-Control": "no-store", Vary: "Authorization" },
    })
  } catch (err) {
    log.error(
      { route: "GET /api/integrations/v1/history", tokenId: auth.tokenId, error: errMsg(err) },
      "Failed to read integration history"
    )
    return NextResponse.json({ error: "History unavailable" }, { status: 500 })
  }
}
