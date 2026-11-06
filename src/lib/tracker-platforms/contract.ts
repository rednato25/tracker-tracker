// src/lib/tracker-platforms/contract.ts
//
// The contract an adapter implements. The shapes it returns live in
// @/types/tracker-stats, which has no imports and is safe to read from a
// component; everything here is server-side.

import type { Agent as HttpAgent } from "node:http"
import type {
  GazelleAuthStyle,
  HeaderAuthStyle,
  NebulanceAuthParam,
  Unit3dAuthStyle,
} from "@/data/platform-types"
import type { DebugApiCall, TrackerStats } from "@/types/tracker-stats"

export type {
  GazelleAuthStyle,
  HeaderAuthStyle,
  NebulanceAuthParam,
  Unit3dAuthStyle,
} from "@/data/platform-types"
// The shapes an adapter returns live in @/types/tracker-stats so a component
// can read them without importing this module. Re-exported here so an
// adapter still takes its contract from one import.
export type * from "@/types/tracker-stats"

export interface FetchOptions {
  proxyAgent?: HttpAgent
  remoteUserId?: number
  authStyle?: GazelleAuthStyle
  unit3dAuthStyle?: Unit3dAuthStyle
  nebulanceAuthParam?: NebulanceAuthParam
  enrich?: boolean
  /**
   * How an adapter that reads a bare key from the Authorization header spells
   * it. APIME sites answer with `WWW-Authenticate: Bearer` but the upload tools
   * they document send the raw key, so raw is the default and bearer is the
   * opt-in. Ignored by adapters that use another header.
   */
  headerAuthStyle?: HeaderAuthStyle
  /** Numeric class id -> name, for an APIME site that reports an id. */
  apimeClassMap?: Record<string, string>
}

export interface TrackerAdapter {
  fetchStats(
    baseUrl: string,
    apiToken: string,
    apiPath: string,
    options?: FetchOptions
  ): Promise<TrackerStats>
  fetchRaw(
    baseUrl: string,
    apiToken: string,
    apiPath: string,
    options?: FetchOptions
  ): Promise<DebugApiCall[]>
}
