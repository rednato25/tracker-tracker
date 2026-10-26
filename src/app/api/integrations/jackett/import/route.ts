import { NextResponse } from "next/server"
import { authenticate, decodeKey, parseJsonBody } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { trackers } from "@/lib/db/schema"
import { errMsg } from "@/lib/error-utils"
import { buildJackettPreview, fetchJackettIndexers, normalizeJackettUrl } from "@/lib/jackett"
import { log } from "@/lib/logger"

function connection(body: Record<string, unknown>) {
  const rawUrl = typeof body.jackettUrl === "string" ? body.jackettUrl : ""
  const supplied = typeof body.jackettPassword === "string" ? body.jackettPassword : ""
  if (!rawUrl.trim()) return { response: NextResponse.json({ error: "Jackett URL is required" }, { status: 400 }) }
  if (supplied.trim().length === 0) return { response: NextResponse.json({ error: "Jackett admin password is required" }, { status: 400 }) }
  try {
    return { url: normalizeJackettUrl(rawUrl), adminPassword: supplied, allowPrivate: body.jackettAllowPrivate === true }
  } catch (err) {
    return { response: NextResponse.json({ error: errMsg(err) }, { status: 400 }) }
  }
}

export async function POST(request: Request) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth
  const body = await parseJsonBody(request)
  if (body instanceof NextResponse) return body
  const selected = (body as { indexerIds?: unknown }).indexerIds
  if (!Array.isArray(selected) || !selected.every((id) => typeof id === "string")) {
    return NextResponse.json({ error: "indexerIds must be an array of ids" }, { status: 400 })
  }
  const c = connection(body as Record<string, unknown>)
  if ("response" in c) return c.response
  try {
    const indexers = await fetchJackettIndexers(c.url, c.adminPassword, { allowPrivate: c.allowPrivate })
    const existing = await db.select({ registrySlug: trackers.registrySlug, baseUrl: trackers.baseUrl }).from(trackers)
    const preview = buildJackettPreview(indexers, existing)
    const selectedIds = new Set(selected as string[])
    const { getTrackerBySlug } = await import("@/data/tracker-registry")
    const { encrypt } = await import("@/lib/crypto")
    const created: number[] = []
    const createdSlugs = new Set<string>()
    const skipped: { indexerId: string; reason: string }[] = []
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
      const [tracker] = await db.insert(trackers).values({
        name: item.name,
        registrySlug: entry.slug,
        baseUrl: entry.url,
        apiPath: entry.apiPath,
        encryptedApiToken: encrypt("jackett-import-requires-credentials", decodeKey(auth)),
        platformType: entry.platform,
        color: entry.color,
        isActive: true,
        userPausedAt: new Date(),
        lastError: "Configure tracker API credentials imported from Jackett",
        lastErrorAt: new Date(),
      }).returning({ id: trackers.id })
      created.push(tracker.id)
      createdSlugs.add(entry.slug)
    }
    return NextResponse.json({ created, skipped })
  } catch (err) {
    log.warn({ route: "POST /api/integrations/jackett/import", error: errMsg(err) }, "Jackett import failed")
    return NextResponse.json({ error: errMsg(err) }, { status: 502 })
  }
}
