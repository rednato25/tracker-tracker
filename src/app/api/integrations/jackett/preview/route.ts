import { NextResponse } from "next/server"
import { authenticate, parseJsonBody } from "@/lib/api-helpers"
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
  const c = connection(body as Record<string, unknown>)
  if ("response" in c) return c.response
  try {
    const indexers = await fetchJackettIndexers(c.url, c.adminPassword, { allowPrivate: c.allowPrivate })
    const existing = await db.select({ registrySlug: trackers.registrySlug, baseUrl: trackers.baseUrl }).from(trackers)
    return NextResponse.json({ items: buildJackettPreview(indexers, existing) })
  } catch (err) {
    log.warn({ route: "POST /api/integrations/jackett/preview", error: errMsg(err) }, "Jackett preview failed")
    return NextResponse.json({ error: errMsg(err) }, { status: 502 })
  }
}
