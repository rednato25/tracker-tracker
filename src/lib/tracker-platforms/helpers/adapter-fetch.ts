// src/lib/tracker-platforms/helpers/adapter-fetch.ts
//
// Functions: readJson, refuseRedirect, adapterRequest, adapterFetch

import { classifyFetchError, classifyProxyFetchError } from "@/lib/error-utils"
import { ADAPTER_FETCH_TIMEOUT_MS } from "@/lib/limits"
import { isRedirect } from "@/lib/network"
import { proxyFetch } from "@/lib/tunnel"
import { withDefaultUserAgent } from "@/lib/user-agent"
import type { FetchOptions } from "../contract"
import { isCloudflareChallengeResponse } from "./html-fetch"

/**
 * The proxied and direct transports normalized to one shape. proxyFetch
 * exposes buffer(), fetch exposes text(); callers should not care which ran.
 */
export interface AdapterResponse {
  ok: boolean
  status: number
  statusText: string
  json: <T>() => Promise<T>
  text: () => Promise<string>
}

/**
 * A SyntaxError means the tracker answered with something other than JSON, such
 * as a maintenance or challenge page, so it gets the shape wording
 * sanitizeNetworkError reads as an unexpected response, and not the parser's
 * message, which can quote the body. Anything else is the body read breaking,
 * which only the direct path can raise, and is classified like a failed fetch.
 *
 * A 2xx with a JSON scalar, null or array is not a tracker payload either. Every
 * adapter dereferences fields on it, which used to surface as a raw TypeError
 * that sanitizeNetworkError cannot classify, so the card said "Poll failed"
 * instead of naming the shape. Rejecting it here fixes all adapters at once.
 */
async function readJson<T>(read: () => Promise<unknown>, hostname: string): Promise<T> {
  let value: unknown
  try {
    value = await read()
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error(`Unexpected response from ${hostname}: body was not JSON`)
    }
    throw classifyFetchError(err, hostname)
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    const kind = value === null ? "null" : Array.isArray(value) ? "array" : typeof value
    throw new Error(`Unexpected response from ${hostname}: expected a JSON object, got ${kind}`)
  }

  return value as T
}

/**
 * Tracker APIs answer in place, so a redirect is refused on both transports, the
 * way the qBittorrent transport refuses one. Followed, it would carry a key in a
 * custom header (TR4KER's X-Api-Key) or a 307 or 308 body (BTN's) to whatever
 * host the Location names, since fetch strips only the standard credential
 * headers. The message never quotes the Location, which can echo a query key.
 */
function refuseRedirect(status: number, hostname: string): void {
  if (isRedirect(status)) {
    throw new Error(`${hostname} answered with a ${status} redirect, which is not followed`)
  }
}

/**
 * Every JSON tracker API request goes out through here. Picks proxied or direct
 * transport, applies the default User-Agent and shared timeout, and classifies
 * connection failures.
 *
 * Throws on a redirect (see refuseRedirect) and returns any other non-2xx, so
 * an adapter whose API reports errors in the body can read it. Use adapterFetch
 * for the happy path.
 */
async function adapterRequest(
  url: string,
  hostname: string,
  options?: FetchOptions,
  headers?: Record<string, string>,
  init?: { method?: "GET" | "POST"; body?: string }
): Promise<AdapterResponse> {
  const mergedHeaders = withDefaultUserAgent({ Accept: "application/json", ...headers })
  const method = init?.method ?? "GET"
  const body = method === "POST" ? (init?.body ?? "") : undefined

  if (options?.proxyAgent) {
    let result: Awaited<ReturnType<typeof proxyFetch>>
    try {
      result = await proxyFetch(url, options.proxyAgent, {
        headers: mergedHeaders,
        method,
        body,
        // Explicit so both transports share one constant. proxyFetch defaults
        // to its own 15s, which only happens to match today.
        timeoutMs: ADAPTER_FETCH_TIMEOUT_MS,
      })
    } catch (err) {
      throw classifyProxyFetchError(err, hostname)
    }
    refuseRedirect(result.status, hostname)

    return {
      ok: result.ok,
      status: result.status,
      statusText: result.statusText,
      json: <T>() => readJson<T>(() => result.json(), hostname),
      text: async () => (await result.buffer()).toString("utf8"),
    }
  }

  let response: Response
  try {
    response = await fetch(url, {
      method,
      headers: mergedHeaders,
      ...(body === undefined ? {} : { body }),
      redirect: "manual",
      signal: AbortSignal.timeout(ADAPTER_FETCH_TIMEOUT_MS),
    })
  } catch (err) {
    throw classifyFetchError(err, hostname)
  }
  if (isRedirect(response.status)) await response.body?.cancel().catch(() => {})
  refuseRedirect(response.status, hostname)

  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    json: <T>() => readJson<T>(() => response.json(), hostname),
    text: () => response.text(),
  }
}

/**
 * Fetches JSON and throws on any non-2xx. The common case.
 */
async function adapterFetch<T>(
  url: string,
  hostname: string,
  options?: FetchOptions,
  headers?: Record<string, string>,
  init?: { method?: "GET" | "POST"; body?: string }
): Promise<T> {
  const response = await adapterRequest(url, hostname, options, headers, init)

  if (!response.ok) {
    if (await isCloudflareChallengeResponse(response)) {
      throw new Error(`Cloudflare challenge detected on ${hostname}`)
    }
    throw new Error(`Tracker API error: ${response.status} ${response.statusText}`)
  }

  return response.json<T>()
}

export { adapterFetch, adapterRequest }
