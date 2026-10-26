import { createServer, type Server } from "node:http"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { buildJackettPreview, fetchJackettIndexers, type JackettIndexer } from "@/lib/jackett"

async function start(handler: (req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse) => void) {
  const server = createServer(handler)
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  if (!address || typeof address === "string") throw new Error("no address")
  return { server, url: `http://127.0.0.1:${address.port}` }
}
let servers: Server[] = []
beforeEach(() => { servers = [] })
afterEach(async () => { await Promise.all(servers.map((s) => new Promise<void>((r) => s.close(() => r())))) })

describe("Jackett read-only client", () => {
  it("logs in for a dashboard cookie and lists configured indexers", async () => {
    let cookie = ""
    const { server, url } = await start((req, res) => {
      if (req.url === "/UI/Dashboard" && req.method === "POST") {
        res.setHeader("set-cookie", "Jackett=session; Path=/")
        res.writeHead(302, { location: "/UI/Dashboard" })
        res.end()
        return
      }
      if (req.url === "/api/v2.0/indexers?configured=true") {
        cookie = String(req.headers.cookie ?? "")
        res.writeHead(200, { "content-type": "application/json" })
        res.end(JSON.stringify([{ id: "mam", name: "MyAnonaMouse", type: "MyAnonaMouse", site_link: "https://www.myanonamouse.net" }]))
        return
      }
      res.writeHead(404); res.end()
    })
    servers.push(server)
    const indexers = await fetchJackettIndexers(url, "admin", { allowPrivate: true })
    expect(cookie).toContain("Jackett=session")
    expect(indexers[0]).toMatchObject({ id: "mam", name: "MyAnonaMouse" })
  })

  it("rejects a failed login and private URL without opt-in", async () => {
    const { server, url } = await start((_req, res) => { res.writeHead(200); res.end("login") })
    servers.push(server)
    await expect(fetchJackettIndexers(url, "wrong", { allowPrivate: true })).rejects.toThrow(/admin password/)
    await expect(fetchJackettIndexers("http://127.0.0.1:9117", "admin")).rejects.toThrow(/private network/)
  })
})

describe("Jackett preview", () => {
  const indexer = (overrides: Partial<JackettIndexer> = {}): JackettIndexer => ({
    id: "mam", name: "MyAnonaMouse", type: "MyAnonaMouse", siteLink: "https://www.myanonamouse.net", alternativeSiteLinks: [], ...overrides,
  })
  it("matches, detects duplicates and keeps ambiguous/unsupported explicit", () => {
    const items = buildJackettPreview([
      indexer(),
      indexer({ id: "x", name: "DefinitelyNotATrackerXYZ", type: "Unknown", siteLink: "https://unknown.example" }),
      indexer({ id: "y", name: "MyAnonaMouse", siteLink: "https://redacted.sh" }),
    ], [{ registrySlug: "torrentleech", baseUrl: "https://trackerleech.example" }])
    expect(items[0].status).toBe("ready")
    expect(items[1].status).toBe("unsupported")
    expect(items[2].status).toBe("ambiguous")
    expect(items[0].credentialNote).toMatch(/not copied/)
    const duplicate = buildJackettPreview([indexer()], [{ registrySlug: "myanonamouse", baseUrl: "https://old.example" }])
    expect(duplicate[0].status).toBe("already-added")
  })
})
