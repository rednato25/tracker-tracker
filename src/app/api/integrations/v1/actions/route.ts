// GET /api/integrations/v1/actions
//
// Runs the existing deterministic action evaluator against stored tracker and
// client state. It never polls, searches or talks to a tracker/client.

import { NextResponse } from "next/server"
import { errMsg } from "@/lib/error-utils"
import {
  buildIntegrationActions,
  loadIntegrationClients,
  loadIntegrationSettings,
  loadIntegrationTrackers,
} from "@/lib/integration-api"
import { authenticateIntegration as authenticate } from "@/lib/integration-auth"
import { log } from "@/lib/logger"

export async function GET(request: Request) {
  const auth = await authenticate(request, "actions:read")
  if (auth instanceof NextResponse) return auth

  try {
    const [settings, trackers, clients] = await Promise.all([
      loadIntegrationSettings(),
      loadIntegrationTrackers(),
      loadIntegrationClients(),
    ])
    return NextResponse.json(buildIntegrationActions({ trackers, clients }, settings, new Date()), {
      headers: { "Cache-Control": "no-store", Vary: "Authorization" },
    })
  } catch (err) {
    log.error(
      { route: "GET /api/integrations/v1/actions", tokenId: auth.tokenId, error: errMsg(err) },
      "Failed to build integration actions"
    )
    return NextResponse.json({ error: "Actions unavailable" }, { status: 500 })
  }
}
