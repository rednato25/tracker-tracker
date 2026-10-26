// DELETE /api/settings/integration-tokens/[id]
//
// Session-authenticated revocation. The row is kept with revokedAt set so a
// previously issued token stays recognizably revoked instead of becoming an
// unknown token.

import { and, eq, isNull } from "drizzle-orm"
import { NextResponse } from "next/server"
import { authenticate, parseRouteId, type RouteContext } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { integrationTokens } from "@/lib/db/schema"
import { errMsg } from "@/lib/error-utils"
import { log } from "@/lib/logger"

export async function DELETE(_request: Request, props: RouteContext) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const id = await parseRouteId(props.params, "token ID")
  if (id instanceof NextResponse) return id

  try {
    const [row] = await db
      .update(integrationTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(integrationTokens.id, id), isNull(integrationTokens.revokedAt)))
      .returning({ id: integrationTokens.id, revokedAt: integrationTokens.revokedAt })

    if (!row) {
      return NextResponse.json({ error: "Token not found" }, { status: 404 })
    }
    return NextResponse.json({
      revoked: true,
      id: row.id,
      revokedAt: row.revokedAt?.toISOString() ?? null,
    })
  } catch (err) {
    log.error(
      { route: "DELETE /api/settings/integration-tokens/[id]", tokenId: id, error: errMsg(err) },
      "Failed to revoke integration token"
    )
    return NextResponse.json({ error: "Token revocation failed" }, { status: 500 })
  }
}
