import { createServer, type Server } from "node:http"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  buildProwlarrPreview,
  fetchProwlarrIndexers,
  normalizeProwlarrUrl,
  type ProwlarrIndexer,
} from "@/lib/prowlarr"

const KEY = "prowlarr-secret-key"

async function startServer(handler: (req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse) => void) {
  const server = createServer(handler)
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  if (!address || typeof address === "string") throw new Error("no address")
  return { server, url: `http://127.0.0.1:${address.port}` }
}

let servers: Server[] = []
beforeEach(() => { servers = [] })
afterEach(async () => {
  await Promise.all(servers.map((server) => new Promise<void>((resolve) => server.close(() => resolve()))))
})

describe("Prowlarr read-only client", () => {
  it("lists indexers with X-Api-Key and redacts the key from errors", async () => {
    let auth = ""
    const { server, url } = await startServer((req, res) => {
      auth = String(req.headers["x-api-key"] ?? "")
      res.writeHead(200, { "content-type": "application/json" })
      res.end(JSON.stringify([{ id: 1, name: "TorrentLeech", implementation: "TorrentLeech", fields: [] }]))
    })
    servers.push(server)
    const indexers = await fetchProwlarrIndexers(url, KEY, { allowPrivate: true })
    expect(auth).toBe(KEY)
    expect(indexers).toHaveLength(1)
    expect(indexers[0].name).toBe("TorrentLeech")

    const unauthorized = await startServer((_req, res) => {
      res.writeHead(401, { "content-type": "application/json" })
      res.end(JSON.stringify({ error: KEY }))
    })
    servers.push(unauthorized.server)
    await expect(fetchProwlarrIndexers(unauthorized.url, KEY, { allowPrivate: true })).rejects.toThrow(
      "Prowlarr rejected the API key"
    )
  })

  it("rejects private URLs without the explicit opt-in and invalid responses", async () => {
    expect(() => normalizeProwlarrUrl("ftp://prowlarr.local")).toThrow()
    await expect(fetchProwlarrIndexers("http://127.0.0.1:9696", KEY)).rejects.toThrow(/private network/)
    const bad = await startServer((_req, res) => {
      res.writeHead(200, { "content-type": "application/json" })
      res.end("{not json")
    })
    servers.push(bad.server)
    await expect(fetchProwlarrIndexers(bad.url, KEY, { allowPrivate: true })).rejects.toThrow(/invalid JSON/)
  })
})

describe("Prowlarr preview", () => {
  function indexer(overrides: Partial<ProwlarrIndexer> = {}): ProwlarrIndexer {
    return { id: 1, name: "TorrentLeech", implementation: "TorrentLeech", fields: [], ...overrides }
  }

  it("matches supported trackers, existing entries and unsupported/ambiguous names", () => {
    const items = buildProwlarrPreview(
      [
        indexer(),
        indexer({ id: 2, name: "Mystery", implementation: "Unknown" }),
        indexer({ id: 3, name: "TorrentLeech", fields: [{ name: "baseUrl", value: "https://redacted.sh" }] }),
      ],
      [{ registrySlug: "myanonamouse", baseUrl: "https://www.myanonamouse.net" }]
    )
    expect(items[0]).toMatchObject({ status: "ready", matchedSlug: "torrentleech" })
    expect(items[1].status).toBe("unsupported")
    expect(items[2].status).toBe("ambiguous")
    expect(items[0].credentialNote).toMatch(/not copied/)
  })

  it("marks existing slugs as already added", () => {
    const items = buildProwlarrPreview([indexer()], [
      { registrySlug: "torrentleech", baseUrl: "https://old.example" },
    ])
    expect(items[0].status).toBe("already-added")
  })
})
