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
  const selected = (body as { indexerIds?: unknown }).indexerIds
  if (!Array.isArray(selected) || !selected.every((id) => Number.isInteger(id))) {
    return NextResponse.json({ error: "indexerIds must be an array of ids" }, { status: 400 })
  }
  const connection = await loadConnection({}, auth)
  if ("response" in connection) return connection.response
  try {
    const indexers = await fetchProwlarrIndexers(connection.url, connection.apiKey, {
      allowPrivate: connection.allowPrivate,
    })
    const existing = await db
      .select({ registrySlug: trackers.registrySlug, baseUrl: trackers.baseUrl })
      .from(trackers)
    const { buildProwlarrPreview } = await import("@/lib/prowlarr")
    const preview = buildProwlarrPreview(indexers, existing)
    const selectedIds = new Set(selected as number[])
    const { getTrackerBySlug } = await import("@/data/tracker-registry")
    const { encrypt } = await import("@/lib/crypto")
    const created: number[] = []
    const createdSlugs = new Set<string>()
    const skipped: { indexerId: number; reason: string }[] = []
    for (const item of preview) {
      if (!selectedIds.has(item.indexerId)) continue
      if (item.status !== "ready" || !item.matchedSlug) {
        skipped.push({ indexerId: item.indexerId, reason: item.reason })
        continue
      }
      if (createdSlugs.has(item.matchedSlug)) {
        skipped.push({ indexerId: item.indexerId, reason: "Another selected indexer already imported this tracker" })
        continue
      }
      const entry = getTrackerBySlug(item.matchedSlug)
      if (!entry) {
        skipped.push({ indexerId: item.indexerId, reason: "Tracker registry entry disappeared" })
        continue
      }
      const [tracker] = await db
        .insert(trackers)
        .values({
          name: item.name,
          registrySlug: entry.slug,
          baseUrl: entry.url,
          apiPath: entry.apiPath,
          encryptedApiToken: encrypt("prowlarr-import-requires-credentials", connection.key),
          platformType: entry.platform,
          color: entry.color,
          isActive: false,
          lastError: "Configure tracker API credentials imported from Prowlarr",
          lastErrorAt: new Date(),
        })
        .returning({ id: trackers.id })
      created.push(tracker.id)
      createdSlugs.add(entry.slug)
    }
    return NextResponse.json({ created, skipped })
  } catch (err) {
    log.warn({ route: "POST /api/integrations/prowlarr/import", error: errMsg(err) }, "Prowlarr import failed")
    return NextResponse.json({ error: errMsg(err) }, { status: 502 })
  }
}
