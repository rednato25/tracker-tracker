// GET /api/integrations/v1/summary
//
// Stored-data summary for a read-only integration token. No poll, search,
// download or other external operation is triggered.

import { NextResponse } from "next/server"
import { errMsg } from "@/lib/error-utils"
import {
  buildIntegrationSummary,
  loadIntegrationSettings,
  loadIntegrationTrackers,
} from "@/lib/integration-api"
import { authenticateIntegration as authenticate } from "@/lib/integration-auth"
import { log } from "@/lib/logger"

export async function GET(request: Request) {
  const auth = await authenticate(request, "summary:read")
  if (auth instanceof NextResponse) return auth

  try {
    const [settings, trackers] = await Promise.all([
      loadIntegrationSettings(),
      loadIntegrationTrackers(),
    ])
    return NextResponse.json(buildIntegrationSummary(trackers, settings, new Date()), {
      headers: { "Cache-Control": "no-store", Vary: "Authorization" },
    })
  } catch (err) {
    log.error(
      { route: "GET /api/integrations/v1/summary", tokenId: auth.tokenId, error: errMsg(err) },
      "Failed to build integration summary"
    )
    return NextResponse.json({ error: "Summary unavailable" }, { status: 500 })
  }
}
