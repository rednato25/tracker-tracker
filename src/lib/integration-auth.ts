// src/lib/integration-auth.ts
//
// Bearer-token authentication for the P16 read-only integration API. The
// session-based admin API never imports this module. Tokens are high-entropy
// random values stored only as SHA-256 hashes; the plaintext exists only in the
// creation response and in the caller's Authorization header.
//
// Query-string credentials are rejected before the header is read, so a token
// accidentally pasted into a URL fails loudly instead of being silently
// accepted or logged.

import "server-only"

import { createHash, randomBytes } from "node:crypto"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { integrationTokens } from "@/lib/db/schema"
import {
  INTEGRATION_TOKEN_MAX_LENGTH,
  INTEGRATION_TOKEN_PATTERN,
  INTEGRATION_TOKEN_PREFIX,
  type IntegrationScope,
  isIntegrationScope,
} from "@/lib/integration-scopes"
import { log } from "@/lib/logger"

export interface IntegrationAuthContext {
  tokenId: number
  scopes: IntegrationScope[]
}

const FORBIDDEN_QUERY_KEYS = new Set([
  "token",
  "access_token",
  "api_token",
  "apikey",
  "api_key",
  "authorization",
  "bearer",
  "key",
])

const BEARER_RE = /^Bearer\s+(\S+)$/i

function unauthorized(): NextResponse {
  return NextResponse.json(
    { error: "Unauthorized" },
    { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="tracker-tracker"' } }
  )
}

export function integrationTokenHash(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex")
}

export function createIntegrationTokenValue(): string {
  return `${INTEGRATION_TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`
}

export function hasIntegrationScope(
  scopes: readonly string[],
  requiredScope: IntegrationScope
): boolean {
  return scopes.includes(requiredScope)
}

/**
 * Authenticate an integration request and enforce one scope.
 *
 * 400: a token-looking query parameter was supplied.
 * 401: no header, malformed header, unknown token, or revoked token.
 * 403: valid token without the endpoint's scope.
 */
export async function authenticateIntegration(
  request: Request,
  requiredScope: IntegrationScope
): Promise<NextResponse | IntegrationAuthContext> {
  const url = new URL(request.url)
  for (const key of url.searchParams.keys()) {
    if (FORBIDDEN_QUERY_KEYS.has(key.toLowerCase())) {
      return NextResponse.json(
        { error: "Tokens must be sent in the Authorization header, not the query string" },
        { status: 400 }
      )
    }
  }

  const header = request.headers.get("authorization")
  if (!header) return unauthorized()

  const match = BEARER_RE.exec(header)
  if (!match) return unauthorized()

  const token = match[1]
  if (token.length > INTEGRATION_TOKEN_MAX_LENGTH || !INTEGRATION_TOKEN_PATTERN.test(token)) {
    return unauthorized()
  }

  const [row] = await db
    .select({
      id: integrationTokens.id,
      scopes: integrationTokens.scopes,
      revokedAt: integrationTokens.revokedAt,
    })
    .from(integrationTokens)
    .where(eq(integrationTokens.tokenHash, integrationTokenHash(token)))
    .limit(1)

  if (!row || row.revokedAt !== null) return unauthorized()

  const scopes = Array.isArray(row.scopes) ? row.scopes.filter(isIntegrationScope) : []
  if (!hasIntegrationScope(scopes, requiredScope)) {
    return NextResponse.json(
      { error: "Forbidden", requiredScope },
      { status: 403, headers: { "WWW-Authenticate": 'Bearer realm="tracker-tracker"' } }
    )
  }

  try {
    await db
      .update(integrationTokens)
      .set({ lastUsedAt: new Date() })
      .where(eq(integrationTokens.id, row.id))
  } catch (err) {
    // Usage metadata is useful but must not turn an otherwise valid read into
    // an outage. The token is never part of this log entry.
    log.warn(
      { tokenId: row.id, error: err instanceof Error ? err.message : String(err) },
      "Failed to record integration token usage"
    )
  }

  return { tokenId: row.id, scopes }
}
