import { createServer, type Server } from "node:http"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/logger", () => ({
  log: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

const TOKEN = "123456:ABCdefGHIjklMNOpqrsTUVwxyz123456789"
const CHAT = "-1001234567890"
const TARGET = 77

async function startServer(
  handler: (req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse) => void
): Promise<{ server: Server; base: string }> {
  const server = createServer(handler)
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  if (!address || typeof address === "string") throw new Error("no address")
  return { server, base: `http://127.0.0.1:${address.port}` }
}

describe("deliverTelegramMessage", () => {
  let deliverTelegramMessage: typeof import("@/lib/notifications/deliver").deliverTelegramMessage
  let resetCircuitBreaker: typeof import("@/lib/notifications/deliver").resetCircuitBreaker
  let getCircuitState: typeof import("@/lib/notifications/deliver").getCircuitState
  let servers: Server[] = []

  beforeEach(async () => {
    vi.resetModules()
    const g = globalThis as typeof globalThis & { __notificationCircuits?: unknown }
    delete g.__notificationCircuits
    const mod = await import("@/lib/notifications/deliver")
    deliverTelegramMessage = mod.deliverTelegramMessage
    resetCircuitBreaker = mod.resetCircuitBreaker
    getCircuitState = mod.getCircuitState
    servers = []
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    await Promise.all(
      servers.map((server) => new Promise<void>((resolve) => server.close(() => resolve())))
    )
  })

  it("delivers a message through a local fake Telegram service", async () => {
    let body = ""
    let path = ""
    const { server, base } = await startServer((req, res) => {
      path = req.url ?? ""
      req.on("data", (chunk) => (body += chunk))
      req.on("end", () => {
        res.writeHead(200, { "content-type": "application/json" })
        res.end(JSON.stringify({ ok: true, result: { message_id: 1 } }))
      })
    })
    servers.push(server)

    const result = await deliverTelegramMessage(TARGET, TOKEN, CHAT, "Hello <&> **world**", base)
    expect(result).toEqual({ success: true, status: "delivered" })
    expect(path).toContain("/sendMessage")
    expect(path).toContain(encodeURIComponent(TOKEN))
    expect(JSON.parse(body)).toEqual({ chat_id: CHAT, text: "Hello <&> **world**" })
  })

  it("maps 429 to rate_limited and respects retry_after", async () => {
    const { server, base } = await startServer((_req, res) => {
      res.writeHead(429, { "content-type": "application/json", "retry-after": "1" })
      res.end(JSON.stringify({ ok: false, error_code: 429, parameters: { retry_after: 1 } }))
    })
    servers.push(server)

    const result = await deliverTelegramMessage(TARGET, TOKEN, CHAT, "hello", base)
    expect(result).toMatchObject({ success: false, status: "rate_limited" })
    expect(result.error).toBe("Rate limited by Telegram")
    expect(result.error).not.toContain(TOKEN)
    expect(getCircuitState(TARGET).failures).toBe(1)
  })

  it("does not retry an explicit authentication rejection", async () => {
    const { server, base } = await startServer((_req, res) => {
      res.writeHead(401, { "content-type": "application/json" })
      res.end(JSON.stringify({ ok: false, error_code: 401, description: "Unauthorized" }))
    })
    servers.push(server)

    const result = await deliverTelegramMessage(TARGET, TOKEN, CHAT, "hello", base)
    expect(result).toEqual({
      success: false,
      status: "failed",
      error: "Telegram rejected the bot token",
    })
    expect(result.error).not.toContain(TOKEN)
  })

  it("handles API-level ok:false responses", async () => {
    const { server, base } = await startServer((_req, res) => {
      res.writeHead(200, { "content-type": "application/json" })
      res.end(JSON.stringify({ ok: false, error_code: 400, description: "Bad Request" }))
    })
    servers.push(server)

    const result = await deliverTelegramMessage(TARGET, TOKEN, CHAT, "hello", base)
    expect(result).toEqual({ success: false, status: "failed", error: "Telegram delivery failed" })
  })

  it("reports a timeout without leaking the token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(Object.assign(new Error(`fetch ${TOKEN}`), { name: "AbortError" }))
    )
    const result = await deliverTelegramMessage(TARGET, TOKEN, CHAT, "hello")
    expect(result).toEqual({ success: false, status: "failed", error: "Telegram delivery timed out" })
    expect(result.error).not.toContain(TOKEN)
  })

  it("opens the shared circuit after repeated failures", async () => {
    const { server, base } = await startServer((_req, res) => {
      res.writeHead(500, { "content-type": "application/json" })
      res.end(JSON.stringify({ ok: false, error_code: 500 }))
    })
    servers.push(server)

    await deliverTelegramMessage(TARGET, TOKEN, CHAT, "one", base)
    await deliverTelegramMessage(TARGET, TOKEN, CHAT, "two", base)
    await deliverTelegramMessage(TARGET, TOKEN, CHAT, "three", base)
    expect(getCircuitState(TARGET).openUntil).not.toBeNull()
    const skipped = await deliverTelegramMessage(TARGET, TOKEN, CHAT, "four", base)
    expect(skipped.error).toBe("Circuit breaker open, skipping delivery")
    resetCircuitBreaker(TARGET)
  })
})
