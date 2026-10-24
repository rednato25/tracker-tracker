import { createServer, type Server } from "node:http"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { NtfyConfig } from "@/lib/notifications/types"

vi.mock("@/lib/logger", () => ({
  log: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

const TOPIC = "synthetic_topic"
const TOKEN = "tk_synthetic_secret"
const TARGET = 88

async function startServer(
  handler: (req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse) => void
): Promise<{ server: Server; base: string }> {
  const server = createServer(handler)
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  if (!address || typeof address === "string") throw new Error("no address")
  return { server, base: `http://127.0.0.1:${address.port}` }
}

function config(base: string, extra: Partial<NtfyConfig> = {}): NtfyConfig {
  return {
    serverUrl: base,
    topic: TOPIC,
    authToken: TOKEN,
    allowPrivateNetwork: true,
    ...extra,
  }
}

describe("deliverNtfyMessage", () => {
  let deliverNtfyMessage: typeof import("@/lib/notifications/deliver").deliverNtfyMessage
  let getCircuitState: typeof import("@/lib/notifications/deliver").getCircuitState
  let servers: Server[] = []

  beforeEach(async () => {
    vi.resetModules()
    const g = globalThis as typeof globalThis & { __notificationCircuits?: unknown }
    delete g.__notificationCircuits
    const mod = await import("@/lib/notifications/deliver")
    deliverNtfyMessage = mod.deliverNtfyMessage
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

  it("publishes JSON to a local fake ntfy server with bearer auth", async () => {
    let body = ""
    let authorization = ""
    let path = ""
    const { server, base } = await startServer((req, res) => {
      path = req.url ?? ""
      authorization = String(req.headers.authorization ?? "")
      req.on("data", (chunk) => (body += chunk))
      req.on("end", () => {
        res.writeHead(200, { "content-type": "application/json" })
        res.end(JSON.stringify({ id: "synthetic" }))
      })
    })
    servers.push(server)

    const result = await deliverNtfyMessage(TARGET, config(base), "Ratio Drop", "Ratio <&> changed")
    expect(result).toEqual({ success: true, status: "delivered" })
    expect(path).toBe("/")
    expect(authorization).toBe(`Bearer ${TOKEN}`)
    expect(JSON.parse(body)).toEqual({
      topic: TOPIC,
      title: "Ratio Drop",
      message: "Ratio <&> changed",
      priority: 3,
    })
  })

  it("does not follow a redirect with the access token", async () => {
    let calls = 0
    const { server, base } = await startServer((_req, res) => {
      calls += 1
      res.writeHead(302, { location: "https://evil.example.test/steal" })
      res.end()
    })
    servers.push(server)

    const result = await deliverNtfyMessage(TARGET, config(base), "Title", "Message")
    expect(result).toEqual({ success: false, status: "failed", error: "ntfy delivery failed" })
    expect(calls).toBe(1)
    expect(result.error).not.toContain(TOKEN)
  })

  it("maps 401 to an authentication failure without leaking the token", async () => {
    const { server, base } = await startServer((_req, res) => {
      res.writeHead(401, { "content-type": "application/json" })
      res.end(JSON.stringify({ code: 401, error: "unauthorized" }))
    })
    servers.push(server)

    const result = await deliverNtfyMessage(TARGET, config(base), "Title", "Message")
    expect(result).toEqual({
      success: false,
      status: "failed",
      error: "ntfy rejected the access token",
    })
    expect(result.error).not.toContain(TOKEN)
  })

  it("maps 429 to rate_limited", async () => {
    const { server, base } = await startServer((_req, res) => {
      res.writeHead(429, { "retry-after": "2" })
      res.end()
    })
    servers.push(server)

    const result = await deliverNtfyMessage(TARGET, config(base), "Title", "Message")
    expect(result).toMatchObject({ success: false, status: "rate_limited" })
    expect(result.error).toBe("Rate limited by ntfy")
    expect(getCircuitState(TARGET).failures).toBe(1)
  })

  it("reports timeout and opens the shared circuit after repeated failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(Object.assign(new Error(`fetch ${TOKEN}`), { name: "AbortError" }))
    )
    const timedOut = await deliverNtfyMessage(TARGET, config("http://127.0.0.1:1"), "Title", "Message")
    expect(timedOut.error).toBe("ntfy delivery timed out")
    expect(timedOut.error).not.toContain(TOKEN)
  })
})
