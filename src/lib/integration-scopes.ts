// src/lib/integration-scopes.ts
//
// Client-safe vocabulary for the P16 read-only integration API. This module
// deliberately has no server-only import so the Settings UI can render the same
// scopes the route handlers validate.

export const INTEGRATION_SCOPES = ["summary:read", "actions:read", "history:read"] as const

export type IntegrationScope = (typeof INTEGRATION_SCOPES)[number]

export const INTEGRATION_IDENTITY_MODES = ["none", "trackers", "full"] as const

export type IntegrationIdentityMode = (typeof INTEGRATION_IDENTITY_MODES)[number]

export const DEFAULT_INTEGRATION_IDENTITY_MODE: IntegrationIdentityMode = "none"

export const INTEGRATION_TOKEN_PREFIX = "tt_int_"

/** 32 random bytes encoded as unpadded base64url. */
export const INTEGRATION_TOKEN_PATTERN = /^tt_int_[A-Za-z0-9_-]{43}$/

export const INTEGRATION_TOKEN_MAX_LENGTH = 64

export const INTEGRATION_TOKEN_NAME_MAX = 100

export const INTEGRATION_MAX_ACTIVE_TOKENS = 20

export function isIntegrationScope(value: unknown): value is IntegrationScope {
  return typeof value === "string" && (INTEGRATION_SCOPES as readonly string[]).includes(value)
}

export function isIntegrationIdentityMode(value: unknown): value is IntegrationIdentityMode {
  return (
    typeof value === "string" &&
    (INTEGRATION_IDENTITY_MODES as readonly string[]).includes(value)
  )
}

export function normalizeIntegrationIdentityMode(value: unknown): IntegrationIdentityMode {
  return isIntegrationIdentityMode(value) ? value : DEFAULT_INTEGRATION_IDENTITY_MODE
}

export const INTEGRATION_SCOPE_LABELS: Record<IntegrationScope, string> = {
  "summary:read": "Summary",
  "actions:read": "Actions",
  "history:read": "History",
}

export const INTEGRATION_SCOPE_DESCRIPTIONS: Record<IntegrationScope, string> = {
  "summary:read": "Tracker health, aggregate totals and the latest stored snapshot.",
  "actions:read": "Attention actions derived from the existing evaluator.",
  "history:read": "Bounded stored tracker snapshot history. No live poll is triggered.",
}
