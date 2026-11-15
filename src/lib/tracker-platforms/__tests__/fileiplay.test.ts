// src/lib/tracker-platforms/__tests__/fileiplay.test.ts

import { beforeEach, describe, expect, it, vi } from "vitest"
import { parseBytes } from "@/lib/parser"
import {
  FileiplayAdapter,
  parseFileiplayCredentials,
  parseFileiplayProfile,
  parseProfileHref,
  parseSiteDate,
} from "../adapters/fileiplay"

const LOGIN_HTML = `<!doctype html><html><head><title>Sign in · FileIplay</title></head><body>
<h1>Sign in to FileIplay</h1>
<form method="POST" action="https://fileiplay.org/login">
<input type="hidden" name="_token" value="csrf-token">
<input id="login-name" type="text" name="name">
<input id="login-password" type="password" name="password">
</form></body></html>`

const HOME_HTML = `<!doctype html><html><head><title>FileIplay</title></head><body>
<nav><a href="/torrents">Torrents</a><a href="/profile/testuser">testuser</a></nav>
</body></html>`

// Synthetic profile page. The card layout supplies the totals, the table the
// class and dates, and the markup is the shape the label scanner is built for.
const PROFILE_HTML = `<!doctype html><html><head><title>testuser · FileIplay</title></head><body>
<h1 class="profile-name">testuser</h1>
<div class="profile-role-badge">Power User</div>
<div class="transfer-grid">
  <div class="transfer-card uploaded"><div class="transfer-icon"></div><div class="transfer-content"><span>Uploaded</span><strong>1.5 TB</strong><small>since joining</small></div></div>
  <div class="transfer-card downloaded"><div class="transfer-icon"></div><div class="transfer-content"><span>Downloaded</span><strong>500 GB</strong><small>since joining</small></div></div>
  <div class="transfer-card ratio"><div class="transfer-icon"></div><div class="transfer-content"><span>Ratio</span><strong>3.07</strong><small>your ratio</small></div></div>
  <div class="transfer-card seeding"><div class="transfer-icon"></div><div class="transfer-content"><span>Seeding</span><strong>42</strong><small>active seeds</small></div></div>
</div>
<div class="stat"><span class="label">Leeching</span><span class="value">3</span></div>
<div class="stat"><span class="label">Bonus</span><span class="value">1,234.50</span></div>
<table>
<tr><td>Joined</td><td>September 3, 2026</td></tr>
<tr><td>Last seen</td><td>2026-11-01 12:00</td></tr>
<tr><td>Warned</td><td>No</td></tr>
<tr><td>Hit and runs</td><td>1</td></tr>
<tr><td>Required ratio</td><td>1.00</td></tr>
</table>
</body></html>`

const CREDS = JSON.stringify({ username: "testuser", password: "secret" })

interface MockResponse {
  status?: number
  body?: string
  setCookies?: string[]
  location?: string
}

function response({ status = 200, body = "", setCookies = [], location }: MockResponse): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 302 ? "Found" : status === 200 ? "OK" : "Unauthorized",
    headers: {
      get: (name: string) => (name.toLowerCase() === "location" ? (location ?? null) : null),
      getSetCookie: () => setCookies,
    },
    text: async () => body,
  } as unknown as Response
}

/** The four requests a successful poll makes: login form, login POST, home, profile. */
function mockSuccessfulPoll(fetchMock: ReturnType<typeof vi.fn>) {
  fetchMock
    .mockResolvedValueOnce(
      response({
        body: LOGIN_HTML,
        setCookies: ["XSRF-TOKEN=xsrf; Path=/", "fileiplay_session=anon; Path=/"],
      })
    )
    .mockResolvedValueOnce(
      response({
        status: 302,
        location: "https://fileiplay.org/",
        setCookies: ["fileiplay_session=auth; Path=/"],
      })
    )
    .mockResolvedValueOnce(response({ body: HOME_HTML }))
    .mockResolvedValueOnce(response({ body: PROFILE_HTML }))
}

describe("parseFileiplayProfile", () => {
  it("reads the totals, class, dates and bonus from the profile", () => {
    const stats = parseFileiplayProfile(PROFILE_HTML, "fileiplay.org", "testuser")
    expect(stats.username).toBe("testuser")
    expect(stats.group).toBe("Power User")
    expect(stats.uploadedBytes).toBe(parseBytes("1.5 TiB"))
    expect(stats.downloadedBytes).toBe(parseBytes("500 GiB"))
    expect(stats.ratio).toBeCloseTo(3.072)
    expect(stats.bufferBytes).toBe(parseBytes("1.5 TiB") - parseBytes("500 GiB"))
    expect(stats.seedingCount).toBe(42)
    expect(stats.leechingCount).toBe(3)
    expect(stats.seedbonus).toBeCloseTo(1234.5)
    expect(stats.hitAndRuns).toBe(1)
    expect(stats.requiredRatio).toBe(1)
    expect(stats.warned).toBe(false)
    expect(stats.joinedDate).toBe("2026-09-03")
    expect(stats.lastAccessDate).toBe("2026-11-01")
    expect(stats.lastAccessField).toBe("last seen")
    expect(stats.freeleechTokens).toBeNull()
  })

  it("reads a table-only profile layout", () => {
    const html = `<html><body><table>
      <tr><td>Uploaded</td><td>2.00 TB</td></tr>
      <tr><td>Downloaded</td><td>1.00 TB</td></tr>
    </table></body></html>`
    const stats = parseFileiplayProfile(html, "fileiplay.org", "testuser")
    expect(stats.uploadedBytes).toBe(parseBytes("2 TiB"))
    expect(stats.downloadedBytes).toBe(parseBytes("1 TiB"))
    expect(stats.group).toBeNull()
    expect(stats.seedingCount).toBeNull()
  })

  it("reads a cell that holds the label and the figure in one text node", () => {
    const html = `<html><body><table>
      <tr><td>Uploaded: 3.00 TB</td></tr>
      <tr><td>Downloaded: 1.00 TB</td></tr>
    </table></body></html>`
    const stats = parseFileiplayProfile(html, "fileiplay.org", "testuser")
    expect(stats.uploadedBytes).toBe(parseBytes("3 TiB"))
    expect(stats.downloadedBytes).toBe(parseBytes("1 TiB"))
  })

  it("treats the login page as an expired session", () => {
    expect(() => parseFileiplayProfile(LOGIN_HTML, "fileiplay.org", "testuser")).toThrow(
      /Session expired/
    )
  })

  it("recognises a Cloudflare challenge", () => {
    const html = `<html><head><title>Just a moment...</title></head><body>cf_chl_opt</body></html>`
    expect(() => parseFileiplayProfile(html, "fileiplay.org", "testuser")).toThrow(/Cloudflare/)
  })

  it("fails loudly when the page has no profile figures", () => {
    const html = `<html><body><h1>Profile</h1><p>Nothing here</p></body></html>`
    expect(() => parseFileiplayProfile(html, "fileiplay.org", "testuser")).toThrow(
      /Unexpected response from fileiplay\.org/
    )
  })

  it("reports a zero-download account as an infinite ratio", () => {
    const stats = parseFileiplayProfile(
      PROFILE_HTML.replace("500 GB", "0 KB"),
      "fileiplay.org",
      "testuser"
    )
    expect(stats.downloadedBytes).toBe(0n)
    expect(stats.ratio).toBe(Infinity)
  })
})

describe("parseProfileHref", () => {
  it("uses the signed-in member's profile link instead of assuming the login name", () => {
    expect(parseProfileHref(HOME_HTML, "someone@example.com")).toBe("/profile/testuser")
  })

  it("falls back to the username when the home page has no profile link", () => {
    expect(parseProfileHref("<html><body>no links</body></html>", "testuser")).toBe(
      "/profile/testuser"
    )
  })

  it("ignores profile settings links", () => {
    const html = `<a href="/profile/settings">Settings</a><a href="/profile/testuser">Me</a>`
    expect(parseProfileHref(html, "testuser")).toBe("/profile/testuser")
  })

  it("prefers the signed-in member's link over another member's", () => {
    const html = `<a href="/profile/other">Other</a><a href="/profile/testuser">Me</a>`
    expect(parseProfileHref(html, "testuser")).toBe("/profile/testuser")
  })
})

describe("parseSiteDate", () => {
  it.each([
    ["2026-09-03 12:00:00", "2026-09-03"],
    ["03/09/2026", "2026-09-03"],
    ["September 3, 2026", "2026-09-03"],
    ["Sep 3, 2026", "2026-09-03"],
    ["3 Sep 2026", "2026-09-03"],
    ["September 3rd, 2026", "2026-09-03"],
    ["3rd Sep 2026", "2026-09-03"],
  ])("reads %s as %s", (input, expected) => {
    expect(parseSiteDate(input)).toBe(expected)
  })

  it("returns undefined for an unrecognised shape", () => {
    expect(parseSiteDate("not a date")).toBeUndefined()
  })
})

describe("parseFileiplayCredentials", () => {
  it("trims the username and keeps the password exact", () => {
    expect(
      parseFileiplayCredentials(JSON.stringify({ username: "  testuser  ", password: " secret " }))
    ).toEqual({ username: "testuser", password: " secret " })
  })

  it("rejects a bare API key", () => {
    expect(() => parseFileiplayCredentials("abc123")).toThrow(/FileIplay credentials/)
  })

  it("rejects a blob without a password", () => {
    expect(() => parseFileiplayCredentials(JSON.stringify({ username: "testuser" }))).toThrow(
      /password/
    )
  })
})

describe("FileiplayAdapter", () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.restoreAllMocks()
    fetchMock.mockReset()
    vi.stubGlobal("fetch", fetchMock)
    // The session cache is process-wide, so one test's good login would
    // otherwise satisfy the next test's login attempt.
    ;(globalThis as { __trackerLoginSessions?: Map<string, string> }).__trackerLoginSessions?.clear()
  })

  it("logs in with the CSRF token, discovers the profile and reads it", async () => {
    mockSuccessfulPoll(fetchMock)

    const stats = await new FileiplayAdapter().fetchStats(
      "https://fileiplay.org",
      CREDS,
      "/profile"
    )

    expect(stats.username).toBe("testuser")
    expect(stats.uploadedBytes).toBe(parseBytes("1.5 TiB"))
    expect(fetchMock).toHaveBeenCalledTimes(4)

    const [getUrl, getInit] = fetchMock.mock.calls[0]
    expect(getUrl).toBe("https://fileiplay.org/login")
    expect(getInit.method).toBe("GET")

    const [postUrl, postInit] = fetchMock.mock.calls[1]
    expect(postUrl).toBe("https://fileiplay.org/login")
    expect(postInit.method).toBe("POST")
    expect(postInit.headers.Cookie).toBe("XSRF-TOKEN=xsrf; fileiplay_session=anon")
    expect(postInit.body).toContain("_token=csrf-token")
    expect(postInit.body).toContain("name=testuser")
    expect(postInit.body).toContain("password=secret")

    const [, homeInit] = fetchMock.mock.calls[2]
    expect(homeInit.headers.Cookie).toBe("XSRF-TOKEN=xsrf; fileiplay_session=auth")
    const [profileUrl, profileInit] = fetchMock.mock.calls[3]
    expect(profileUrl).toBe("https://fileiplay.org/profile/testuser")
    expect(profileInit.headers.Cookie).toBe("XSRF-TOKEN=xsrf; fileiplay_session=auth")
  })

  it("reports a refused login without trying the profile", async () => {
    fetchMock
      .mockResolvedValueOnce(
        response({
          body: LOGIN_HTML,
          setCookies: ["fileiplay_session=anon; Path=/"],
        })
      )
      .mockResolvedValueOnce(
        response({ status: 302, location: "https://fileiplay.org/login" })
      )

    await expect(
      new FileiplayAdapter().fetchStats("https://fileiplay.org", CREDS, "/profile")
    ).rejects.toThrow(/Invalid FileIplay username or password/)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("reports a two-factor account instead of a bad password", async () => {
    fetchMock
      .mockResolvedValueOnce(response({ body: LOGIN_HTML }))
      .mockResolvedValueOnce(
        response({ status: 302, location: "https://fileiplay.org/two-factor-challenge" })
      )

    await expect(
      new FileiplayAdapter().fetchStats("https://fileiplay.org", CREDS, "/profile")
    ).rejects.toThrow(/two-factor/)
  })

  it("fetchRaw returns the home and profile calls, or the login failure", async () => {
    mockSuccessfulPoll(fetchMock)
    const ok = await new FileiplayAdapter().fetchRaw("https://fileiplay.org", CREDS, "/profile")
    expect(ok.map((call) => call.label)).toEqual(["Home Page (profile lookup)", "Profile Page"])
    expect(ok.every((call) => call.error === null)).toBe(true)

    fetchMock.mockReset()
    ;(globalThis as { __trackerLoginSessions?: Map<string, string> }).__trackerLoginSessions?.clear()
    fetchMock.mockResolvedValueOnce(response({ status: 401, body: "denied" }))
    const bad = await new FileiplayAdapter().fetchRaw("https://fileiplay.org", CREDS, "/profile")
    expect(bad[0].label).toBe("Login")
    expect(bad[0].data).toBeNull()
    expect(bad[0].error).toMatch(/no login form/)
  })
})
