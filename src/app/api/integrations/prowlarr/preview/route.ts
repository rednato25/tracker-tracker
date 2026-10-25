import { NextResponse } from "next/server"
import { authenticate, decodeKey, parseJsonBody } from "@/lib/api-helpers"
import { decrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { appSettings, trackers } from "@/lib/db/schema"
import { errMsg } from "@/lib/error-utils"
import { log } from "@/lib/logger"
import { fetchProwlarrIndexers, normalizeProwlarrUrl } from "@/lib/prowlarr"

async function loadConnection(body: Record<string, unknown>, auth: Awaited<ReturnType<typeof authenticate>>) {
  if (auth instanceof NextResponse) return { response: auth }
  const [settings] = await db.select().from(appSettings).limit(1)
  const rawUrl = typeof body.prowlarrUrl === "string" ? body.prowlarrUrl : settings?.prowlarrUrl
  const allowPrivate =
    typeof body.prowlarrAllowPrivate === "boolean"
      ? body.prowlarrAllowPrivate
      : settings?.prowlarrAllowPrivate === true
  if (!rawUrl) return { response: NextResponse.json({ error: "Prowlarr URL is required" }, { status: 400 }) }
  let url: string
  try {
    url = normalizeProwlarrUrl(rawUrl)
  } catch (err) {
    return { response: NextResponse.json({ error: errMsg(err) }, { status: 400 }) }
  }
  let apiKey: string | null = typeof body.prowlarrApiKey === "string" ? body.prowlarrApiKey.trim() : null
  if (!apiKey && settings?.encryptedProwlarrApiKey) {
    apiKey = decrypt(settings.encryptedProwlarrApiKey, decodeKey(auth))
  }
  if (!apiKey) return { response: NextResponse.json({ error: "Prowlarr API key is required" }, { status: 400 }) }
  return { url, apiKey, allowPrivate, key: decodeKey(auth), settings }
}

export async function POST(request: Request) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth
  const body = await parseJsonBody(request)
  if (body instanceof NextResponse) return body
  const connection = await loadConnection(body as Record<string, unknown>, auth)
  if ("response" in connection) return connection.response
  try {
    const indexers = await fetchProwlarrIndexers(connection.url, connection.apiKey, {
      allowPrivate: connection.allowPrivate,
    })
    const existing = await db
      .select({ registrySlug: trackers.registrySlug, baseUrl: trackers.baseUrl })
      .from(trackers)
    const { buildProwlarrPreview } = await import("@/lib/prowlarr")
    return NextResponse.json({ items: buildProwlarrPreview(indexers, existing) })
  } catch (err) {
    log.warn({ route: "POST /api/integrations/prowlarr/preview", error: errMsg(err) }, "Prowlarr preview failed")
    return NextResponse.json({ error: errMsg(err) }, { status: 502 })
  }
}
