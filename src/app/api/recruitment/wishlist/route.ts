// GET/PUT /api/recruitment/wishlist
//
// Session-authenticated P18 wishlist state. Tracker references are registry
// slugs; route/dataset references may go stale and are resolved defensively by
// the UI. No tracker, client or dataset request is made here.

import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { authenticate, parseJsonBody } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { appSettings } from "@/lib/db/schema"
import { errMsg } from "@/lib/error-utils"
import { log } from "@/lib/logger"
import {
  normalizeRecruitmentState,
  serializeRecruitmentState,
} from "@/lib/recruitment-state"

async function readState() {
  const [settings] = await db
    .select({ id: appSettings.id, recruitmentState: appSettings.recruitmentState })
    .from(appSettings)
    .limit(1)
  return settings ?? null
}

export async function GET() {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  try {
    const settings = await readState()
    if (!settings) return NextResponse.json({ error: "Not configured" }, { status: 400 })
    return NextResponse.json({ state: normalizeRecruitmentState(settings.recruitmentState) })
  } catch (err) {
    log.error(
      { route: "GET /api/recruitment/wishlist", error: errMsg(err) },
      "Failed to read recruitment wishlist"
    )
    return NextResponse.json({ error: "Failed to load wishlist" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const body = await parseJsonBody(request)
  if (body instanceof NextResponse) return body

  const state = normalizeRecruitmentState(body.state)

  try {
    const settings = await readState()
    if (!settings) return NextResponse.json({ error: "Not configured" }, { status: 400 })
    await db
      .update(appSettings)
      .set({ recruitmentState: serializeRecruitmentState(state) })
      .where(eq(appSettings.id, settings.id))
    return NextResponse.json({ state })
  } catch (err) {
    log.error(
      { route: "PUT /api/recruitment/wishlist", error: errMsg(err) },
      "Failed to save recruitment wishlist"
    )
    return NextResponse.json({ error: "Failed to save wishlist" }, { status: 500 })
  }
}
