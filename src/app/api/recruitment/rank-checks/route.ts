// PUT /api/recruitment/rank-checks
//
// P41 stores the owner's own "Matches the site" / "Wrong" check in the existing
// recruitment-state JSON. The route reads the current state first so it never
// overwrites paths, goal links or pinned routes written by the Pathways page.

import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { authenticate, parseJsonBody } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { appSettings } from "@/lib/db/schema"
import { errMsg } from "@/lib/error-utils"
import { log } from "@/lib/logger"
import {
  normalizeRankCheck,
  normalizeRecruitmentState,
  serializeRecruitmentState,
} from "@/lib/recruitment-state"

export async function PUT(request: Request) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const body = await parseJsonBody(request)
  if (body instanceof NextResponse) return body
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Expected a JSON object" }, { status: 400 })
  }

  const { trackerId, check } = body as { trackerId?: unknown; check?: unknown }
  const id = typeof trackerId === "number" ? String(trackerId) : trackerId
  if (typeof id !== "string" || !/^[1-9]\d*$/.test(id)) {
    return NextResponse.json({ error: "trackerId must be a tracker id" }, { status: 400 })
  }
  const normalized = check === null ? null : normalizeRankCheck(check)
  if (check !== null && normalized === null) {
    return NextResponse.json(
      { error: "check must include matches/wrong, a checked date and an optional note" },
      { status: 400 }
    )
  }

  try {
    const [settings] = await db
      .select({ id: appSettings.id, recruitmentState: appSettings.recruitmentState })
      .from(appSettings)
      .limit(1)
    if (!settings) return NextResponse.json({ error: "Not configured" }, { status: 400 })

    const state = normalizeRecruitmentState(settings.recruitmentState)
    const rankChecks = { ...state.rankChecks }
    if (normalized) rankChecks[id] = normalized
    else delete rankChecks[id]

    await db
      .update(appSettings)
      .set({ recruitmentState: serializeRecruitmentState({ ...state, rankChecks }) })
      .where(eq(appSettings.id, settings.id))

    return NextResponse.json({ rankChecks })
  } catch (err) {
    log.error(
      { route: "PUT /api/recruitment/rank-checks", error: errMsg(err) },
      "Failed to save rank check"
    )
    return NextResponse.json({ error: "Failed to save rank check" }, { status: 500 })
  }
}
