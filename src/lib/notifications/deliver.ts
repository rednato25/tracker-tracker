// src/lib/notifications/deliver.ts

import { sanitizeNetworkError } from "@/lib/error-utils"
import { NOTIFICATION_COOLDOWN_MAX_MS } from "@/lib/limits"
import { log } from "@/lib/logger"
import type { NtfyConfig } from "@/lib/notifications/types"
import type { DiscordEmbed } from "./payload"

export interface CircuitState {
  failures: number
  openUntil: Date | null
}

// HMR-safe circuit breaker state. One per notification target.
const g = globalThis as typeof globalThis & {
  __notificationCircuits?: Map<number, CircuitState>
}
function getCircuits(): Map<number, CircuitState> {
  if (!g.__notificationCircuits) g.__notificationCircuits = new Map<number, CircuitState>()
  return g.__notificationCircuits
}

const MAX_FAILURES = 3
const DEFAULT_COOLDOWN_MS = 60_000

export function getCircuitState(targetId: number): CircuitState {
  return getCircuits().get(targetId) ?? { failures: 0, openUntil: null }
}

export function resetCircuitBreaker(targetId: number): void {
  getCircuits().delete(targetId)
}

function isCircuitOpen(targetId: number): boolean {
  const state = getCircuitState(targetId)
  if (!state.openUntil) return false
  if (new Date() > state.openUntil) {
    resetCircuitBreaker(targetId)
    return false
  }
  return true
}

function recordFailure(targetId: number, retryAfterMs?: number): void {
  const circuits = getCircuits()
  const state = circuits.get(targetId) ?? { failures: 0, openUntil: null }
  state.failures++
  if (state.failures >= MAX_FAILURES) {
    const cooldown = retryAfterMs ?? DEFAULT_COOLDOWN_MS
    state.openUntil = new Date(Date.now() + cooldown)
    log.warn(`Notification circuit breaker opened for target ${targetId}, ${cooldown}ms cooldown`)
  }
  circuits.set(targetId, state)
}

function recordSuccess(targetId: number): void {
  resetCircuitBreaker(targetId)
}

export interface DeliveryResult {
  success: boolean
  status: "delivered" | "failed" | "rate_limited"
  error?: string
}

export async function deliverNtfyMessage(
  targetId: number,
  config: NtfyConfig,
  title: string,
  message: string
): Promise<DeliveryResult> {
  if (isCircuitOpen(targetId)) {
    return { success: false, status: "failed", error: "Circuit breaker open, skipping delivery" }
  }

  // The topic and token are never logged. Publish as JSON so the topic is not
  // placed in a URL or a redirect-visible path.
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (config.authToken) headers.Authorization = `Bearer ${config.authToken}`

  try {
    const res = await fetch(config.serverUrl, {
      // Never follow a redirect with the Authorization header attached.
      redirect: "error",
      method: "POST",
      headers,
      body: JSON.stringify({
        topic: config.topic,
        title: title.slice(0, 128),
        message: message.slice(0, 4096),
        priority: 3,
      }),
      signal: AbortSignal.timeout(5_000),
    })

    const body = await res.text()
    if (body.length > 16_384) {
      log.error({ targetId }, "ntfy response too large")
      recordFailure(targetId)
      return { success: false, status: "failed", error: "ntfy response too large" }
    }

    if (res.ok) {
      recordSuccess(targetId)
      return { success: true, status: "delivered" }
    }

    const retryAfterRaw = Number(res.headers.get("Retry-After") ?? "60")
    if (res.status === 429) {
      const retryAfter = Math.min(
        Number.isFinite(retryAfterRaw) ? retryAfterRaw * 1000 : 60_000,
        NOTIFICATION_COOLDOWN_MAX_MS
      )
      recordFailure(targetId, retryAfter)
      log.warn({ targetId, retryAfterMs: retryAfter }, "ntfy rate limit, delivery deferred")
      return { success: false, status: "rate_limited", error: "Rate limited by ntfy" }
    }

    if (res.status === 401 || res.status === 403) {
      log.warn({ targetId }, "ntfy rejected the configured access token")
      recordFailure(targetId)
      return { success: false, status: "failed", error: "ntfy rejected the access token" }
    }

    log.error({ targetId, httpStatus: res.status }, "ntfy delivery failed")
    recordFailure(targetId)
    return { success: false, status: "failed", error: "ntfy delivery failed" }
  } catch (err) {
    const timedOut =
      err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError")
    const messageText = timedOut ? "ntfy delivery timed out" : "ntfy delivery failed"
    log.error({ targetId, timedOut }, "ntfy delivery failed")
    recordFailure(targetId)
    return { success: false, status: "failed", error: messageText }
  }
}

export async function deliverTelegramMessage(
  targetId: number,
  botToken: string,
  chatId: string,
  text: string,
  apiBaseUrl = "https://api.telegram.org"
): Promise<DeliveryResult> {
  if (isCircuitOpen(targetId)) {
    return { success: false, status: "failed", error: "Circuit breaker open, skipping delivery" }
  }

  // The token is part of the Telegram path, never the query string or a log
  // field. Never include the URL or raw fetch error in a result/log.
  const endpoint = `${apiBaseUrl.replace(/\/$/, "")}/bot${encodeURIComponent(botToken)}/sendMessage`

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 4096) }),
      signal: AbortSignal.timeout(5_000),
      redirect: "error",
    })

    type TelegramPayload = {
      ok?: boolean
      error_code?: number
      parameters?: { retry_after?: number }
    }
    let payload: TelegramPayload | null = null
    try {
      payload = (await res.json()) as TelegramPayload
    } catch {
      payload = null
    }

    if (res.ok && payload?.ok === true) {
      recordSuccess(targetId)
      return { success: true, status: "delivered" }
    }

    const retryAfterRaw = Number(
      payload?.parameters?.retry_after ?? res.headers.get("Retry-After") ?? "60"
    )
    if (res.status === 429 || payload?.error_code === 429) {
      const retryAfter = Math.min(
        Number.isFinite(retryAfterRaw) ? retryAfterRaw * 1000 : 60_000,
        NOTIFICATION_COOLDOWN_MAX_MS
      )
      recordFailure(targetId, retryAfter)
      log.warn(
        { targetId, retryAfterMs: retryAfter },
        "Telegram rate limit, delivery deferred"
      )
      return { success: false, status: "rate_limited", error: "Rate limited by Telegram" }
    }

    if (payload?.error_code === 401 || payload?.error_code === 403) {
      log.warn({ targetId }, "Telegram rejected the configured bot credential")
      recordFailure(targetId)
      return { success: false, status: "failed", error: "Telegram rejected the bot token" }
    }

    log.error({ targetId, httpStatus: res.status }, "Telegram delivery failed")
    recordFailure(targetId)
    return { success: false, status: "failed", error: "Telegram delivery failed" }
  } catch (err) {
    const timedOut =
      err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError")
    const message = timedOut ? "Telegram delivery timed out" : "Telegram delivery failed"
    log.error({ targetId, timedOut }, "Telegram delivery failed")
    recordFailure(targetId)
    return { success: false, status: "failed", error: message }
  }
}

export async function deliverDiscordWebhook(
  targetId: number,
  webhookUrl: string,
  embeds: DiscordEmbed[]
): Promise<DeliveryResult> {
  if (isCircuitOpen(targetId)) {
    return { success: false, status: "failed", error: "Circuit breaker open, skipping delivery" }
  }

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds }),
      signal: AbortSignal.timeout(5_000),
      redirect: "error",
    })

    if (res.ok) {
      recordSuccess(targetId)
      return { success: true, status: "delivered" }
    }

    if (res.status === 429) {
      const rawRetryAfter = Number(res.headers.get("Retry-After") ?? "60")
      const retryAfter = Math.min(
        Number.isFinite(rawRetryAfter) ? rawRetryAfter * 1000 : 60_000,
        NOTIFICATION_COOLDOWN_MAX_MS
      ) // cap at 5 min
      recordFailure(targetId, retryAfter)
      log.warn(`Discord rate limit for target ${targetId}, retry after ${retryAfter}ms`)
      return { success: false, status: "rate_limited", error: "Rate limited by Discord" }
    }

    const raw = `Webhook API error: ${res.status} ${res.statusText}`
    log.error(`Notification delivery failed for target ${targetId}: ${raw}`)
    recordFailure(targetId)
    return { success: false, status: "failed", error: sanitizeNetworkError(raw, "Delivery failed") }
  } catch (err) {
    const raw = err instanceof Error ? err.message : "Unknown error"
    log.error(`Notification delivery failed for target ${targetId}: ${raw}`)
    recordFailure(targetId)
    return { success: false, status: "failed", error: sanitizeNetworkError(raw, "Delivery failed") }
  }
}
