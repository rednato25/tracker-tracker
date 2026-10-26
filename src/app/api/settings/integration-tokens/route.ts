// GET/POST /api/settings/integration-tokens
//
// Session-authenticated management for read-only integration tokens. The
// plaintext token is returned by POST exactly once; GET only ever lists
// metadata. Integration bearer tokens cannot reach this route because it uses
// the normal session gate and the proxy still requires the session cookie.

import { desc, isNull, sql } from "drizzle-orm"
import { NextResponse } from "next/server"
import { authenticate, parseJsonBody } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { integrationTokens } from "@/lib/db/schema"
import { errMsg } from "@/lib/error-utils"
import { createIntegrationTokenValue, integrationTokenHash } from "@/lib/integration-auth"
import {
  INTEGRATION_MAX_ACTIVE_TOKENS,
  INTEGRATION_SCOPES,
  INTEGRATION_TOKEN_NAME_MAX,
  type IntegrationScope,
  isIntegrationScope,
} from "@/lib/integration-scopes"
import { log } from "@/lib/logger"

function serializeToken(row: {
  id: number
  name: string
  scopes: string[]
  createdAt: Date
  lastUsedAt: Date | null
  revokedAt: Date | null
}) {
  return {
    id: row.id,
    name: row.name,
    scopes: row.scopes.filter(isIntegrationScope),
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
  }
}

export async function GET() {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  try {
    const rows = await db
      .select({
        id: integrationTokens.id,
        name: integrationTokens.name,
        scopes: integrationTokens.scopes,
        createdAt: integrationTokens.createdAt,
        lastUsedAt: integrationTokens.lastUsedAt,
        revokedAt: integrationTokens.revokedAt,
      })
      .from(integrationTokens)
      .where(isNull(integrationTokens.revokedAt))
      .orderBy(desc(integrationTokens.createdAt))

    return NextResponse.json({ tokens: rows.map(serializeToken) })
  } catch (err) {
    log.error(
      { route: "GET /api/settings/integration-tokens", error: errMsg(err) },
      "Failed to list integration tokens"
    )
    return NextResponse.json({ error: "Failed to load integration tokens" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const body = await parseJsonBody(request)
  if (body instanceof NextResponse) return body

  const name = typeof body.name === "string" ? body.name.trim() : ""
  if (!name || name.length > INTEGRATION_TOKEN_NAME_MAX) {
    return NextResponse.json(
      { error: `Name must be between 1 and ${INTEGRATION_TOKEN_NAME_MAX} characters` },
      { status: 400 }
    )
  }

  if (!Array.isArray(body.scopes) || body.scopes.length === 0) {
    return NextResponse.json({ error: "At least one scope is required" }, { status: 400 })
  }
  if (body.scopes.some((scope) => !isIntegrationScope(scope))) {
    return NextResponse.json(
      { error: `scopes must contain only: ${INTEGRATION_SCOPES.join(", ")}` },
      { status: 400 }
    )
  }

  // Stable order and no duplicates, so the stored contract is predictable.
  const requested = new Set(body.scopes as IntegrationScope[])
  const scopes = INTEGRATION_SCOPES.filter((scope) => requested.has(scope))
  if (scopes.length === 0) {
    return NextResponse.json({ error: "At least one scope is required" }, { status: 400 })
  }

  try {
    const [active] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(integrationTokens)
      .where(isNull(integrationTokens.revokedAt))
      .limit(1)
    if ((active?.count ?? 0) >= INTEGRATION_MAX_ACTIVE_TOKENS) {
      return NextResponse.json(
        { error: `Revoke an existing token before creating more than ${INTEGRATION_MAX_ACTIVE_TOKENS}` },
        { status: 400 }
      )
    }

    const token = createIntegrationTokenValue()
    const [row] = await db
      .insert(integrationTokens)
      .values({
        name,
        tokenHash: integrationTokenHash(token),
        scopes,
      })
      .returning({
        id: integrationTokens.id,
        name: integrationTokens.name,
        scopes: integrationTokens.scopes,
        createdAt: integrationTokens.createdAt,
        lastUsedAt: integrationTokens.lastUsedAt,
        revokedAt: integrationTokens.revokedAt,
      })

    if (!row) {
      return NextResponse.json({ error: "Token creation failed" }, { status: 500 })
    }

    // The only place the plaintext is ever returned.
    return NextResponse.json({ token, record: serializeToken(row) }, { status: 201 })
  } catch (err) {
    log.error(
      { route: "POST /api/settings/integration-tokens", error: errMsg(err) },
      "Failed to create integration token"
    )
    return NextResponse.json({ error: "Token creation failed" }, { status: 500 })
  }
}
