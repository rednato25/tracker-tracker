// src/app/api/settings/rank-manual-values/route.ts
//
// P47 manual rank values. They live in the existing dashboardSettings JSON, so
// no migration is required. A manual value is used only when the tracker API
// has no observed value.

import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { authenticate, parseJsonBody } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { appSettings } from "@/lib/db/schema"
import {
  isRankMetricName,
  normalizeRankManualValue,
  normalizeRankManualValuesByTracker,
  type RankManualValue,
  type RankManualValuesByTracker,
} from "@/lib/rank-manual-values"

function parseDashboardSettings(raw: string | null): Record<string, unknown> {
  if (!raw) return {}
  try {
    const value: unknown = JSON.parse(raw)
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

function responseFor(values: RankManualValuesByTracker) {
  return NextResponse.json({ rankManualValues: values })
}

export async function GET() {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const [row] = await db
    .select({ dashboardSettings: appSettings.dashboardSettings })
    .from(appSettings)
    .limit(1)

  return responseFor(
    normalizeRankManualValuesByTracker(
      parseDashboardSettings(row?.dashboardSettings ?? null).rankManualValues
    )
  )
}

export async function PUT(request: Request) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const body = await parseJsonBody(request)
  if (body instanceof NextResponse) return body

  const trackerId = Number(body.trackerId)
  if (!Number.isInteger(trackerId) || trackerId < 1) {
    return NextResponse.json({ error: "trackerId must be a positive integer" }, { status: 400 })
  }
  const metric = body.metric
  if (!isRankMetricName(metric)) {
    return NextResponse.json({ error: "metric is not a rank metric" }, { status: 400 })
  }

  let manualValue: RankManualValue | null = null
  if (body.manualValue !== null && body.manualValue !== undefined) {
    manualValue = normalizeRankManualValue(metric, body.manualValue)
    if (!manualValue) {
      return NextResponse.json({ error: "manualValue is not valid" }, { status: 400 })
    }
  }

  const [row] = await db
    .select({ id: appSettings.id, dashboardSettings: appSettings.dashboardSettings })
    .from(appSettings)
    .limit(1)
  if (!row) {
    return NextResponse.json({ error: "Not configured" }, { status: 400 })
  }

  const settings = parseDashboardSettings(row.dashboardSettings)
  const values = normalizeRankManualValuesByTracker(settings.rankManualValues)
  const trackerValues = { ...(values[String(trackerId)] ?? {}) }
  if (manualValue) {
    trackerValues[metric] = manualValue
  } else {
    delete trackerValues[metric]
  }
  if (Object.keys(trackerValues).length > 0) {
    values[String(trackerId)] = trackerValues
  } else {
    delete values[String(trackerId)]
  }

  await db
    .update(appSettings)
    .set({ dashboardSettings: JSON.stringify({ ...settings, rankManualValues: values }) })
    .where(eq(appSettings.id, row.id))

  return responseFor(values)
}
