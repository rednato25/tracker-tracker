// GET /api/search/indexers
//
// Loads the Prowlarr indexer list and maps it to the tracker registry and owned
// account rows. This is metadata only: it does not run a search.

import { NextResponse } from "next/server"
import { authenticate, decodeKey } from "@/lib/api-helpers"
import { decrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { appSettings } from "@/lib/db/schema"
import { errMsg } from "@/lib/error-utils"
import { log } from "@/lib/logger"
import { fetchProwlarrIndexers, normalizeProwlarrUrl } from "@/lib/prowlarr"
import { buildProwlarrSearchIndexers } from "@/lib/prowlarr-search"
import { getTrackerListForDashboard } from "@/lib/server-data"

export async function GET() {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const [settings] = await db.select().from(appSettings).limit(1)
  if (!settings?.prowlarrUrl || !settings.encryptedProwlarrApiKey) {
    return NextResponse.json(
      { error: "Prowlarr is not configured", code: "not-configured" },
      { status: 400 }
    )
  }

  let url: string
  try {
    url = normalizeProwlarrUrl(settings.prowlarrUrl)
  } catch (err) {
    return NextResponse.json({ error: errMsg(err) }, { status: 400 })
  }

  try {
    const apiKey = decrypt(settings.encryptedProwlarrApiKey, decodeKey(auth))
    const [indexers, trackers] = await Promise.all([
      fetchProwlarrIndexers(url, apiKey, { allowPrivate: settings.prowlarrAllowPrivate }),
      getTrackerListForDashboard(),
    ])
    return NextResponse.json({
      indexers: buildProwlarrSearchIndexers(
        indexers,
        trackers.map((tracker) => ({
          id: tracker.id,
          name: tracker.name,
          registrySlug: tracker.registrySlug,
          userPausedAt: tracker.userPausedAt,
          hasStats: tracker.latestStats !== null,
        }))
      ),
    })
  } catch (err) {
    log.warn(
      { route: "GET /api/search/indexers", error: errMsg(err) },
      "Failed to load Prowlarr search indexers"
    )
    return NextResponse.json({ error: "Could not load Prowlarr indexers" }, { status: 502 })
  }
}
