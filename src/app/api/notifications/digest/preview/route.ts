// GET /api/notifications/digest/preview
//
// Session-only local preview. It uses the same buildDigestForData path as the
// scheduled delivery but never sends or mutates digest state.

import { NextResponse } from "next/server"
import { computeTrackerActions } from "@/lib/actions"
import { authenticate } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { appSettings } from "@/lib/db/schema"
import {
  buildDigestForData,
  digestConfigFromSettings,
  isDigestDue,
} from "@/lib/digest"
import { errMsg } from "@/lib/error-utils"
import { log } from "@/lib/logger"
import { getTrackerListForDashboard } from "@/lib/server-data"

export async function GET() {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  try {
    const [settings] = await db.select().from(appSettings).limit(1)
    if (!settings) return NextResponse.json({ error: "Not configured" }, { status: 400 })
    const now = new Date()
    const trackers = await getTrackerListForDashboard()
    const actions = computeTrackerActions({ trackers, now })
    const config = digestConfigFromSettings(settings)
    const { key } = isDigestDue(config, undefined, now)
    const baseUrl = process.env.BASE_URL
    const dashboardUrl =
      baseUrl?.toLowerCase().startsWith("https://") ? `${baseUrl.replace(/\/$/, "")}/` : null
    const text = buildDigestForData(settings, trackers, actions, now, key, dashboardUrl)
    return NextResponse.json({
      text,
      sent: false,
      includeMonitoring: config.includeMonitoring,
      emptyBehavior: config.emptyBehavior,
      dateKey: key,
    })
  } catch (err) {
    log.error(
      { route: "GET /api/notifications/digest/preview", error: errMsg(err) },
      "Failed to build digest preview"
    )
    return NextResponse.json({ error: "Could not build digest preview" }, { status: 500 })
  }
}
