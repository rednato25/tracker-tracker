// src/lib/tracker-platforms/__tests__/czteam.test.ts
//
// The fixture follows CZTeam's own header markup (every class below appears in
// the stylesheet the public login page serves) plus stock NexusPHP profile
// rows. It has not been checked against a logged-in page, so these tests hold
// the parser to the documented shape rather than proving the live site matches.

import { describe, expect, it, vi } from "vitest"
import { parseBytes } from "@/lib/parser"
import {
  CzteamAdapter,
  parseCzteamCredentials,
  parseCzteamHeader,
  parseCzteamProfile,
} from "../adapters/czteam"
import { SessionExpiredError } from "../helpers/errors"

const HOME_HTML = `
<html><head><title>CZTeam Tracker :: Home</title></head>
<body>
<div class="cz-hdr">
  <a class="cz-logo" href="index.php"><span class="cz-logo-mark">Cz</span>Team</a>
  <table class="cz-userinfo"><tbody><tr>
    <td class="cz-avatar"><img src="pic/default_avatar.gif"></td>
    <td>
      <span class="cz-greet">
        <a href="userdetails.php?id=282901"><b>torrentzirro</b></a>
        <span class="cz-class"> Class: Power User</span>
        <a class="cz-sl cz-sl-hnr is-warn" href="hitandrun.php"><b>2</b></a>
        <a class="cz-sl cz-sl-fl" href="bonus.php"><b>7</b></a>
      </span>
    </td>
    <td class="cz-stats">Uploaded: 3.5 TB | Downloaded: 1.2 TB | Ratio: 2.92</td>
    <td class="cz-actions"><a href="logout.php">Log out</a></td>
  </tr></tbody></table>
</div>
</body></html>
`

const PROFILE_HTML = `
<html><body>
<a href="logout.php">Log out</a>
<table><tbody>
  <tr><td class="rowhead">Username</td><td class="rowfollow">torrentzirro</td></tr>
  <tr><td class="rowhead">Class</td><td class="rowfollow">Power User</td></tr>
  <tr><td class="rowhead">Join date</td><td class="rowfollow">2024-03-14 10:22:31 (2 years ago)</td></tr>
  <tr><td class="rowhead">Last activity</td><td class="rowfollow">2026-11-09 21:04:12</td></tr>
  <tr><td class="rowhead">Bonus points</td><td class="rowfollow">1,204.5</td></tr>
  <tr><td class="rowhead">Seeding size</td><td class="rowfollow">1.5 TB</td></tr>
</tbody></table>
</body></html>
`

const HOST = "czteam.me"

describe("parseCzteamHeader", () => {
  it("reads the totals, chips and account id from the welcome block", () => {
    const { stats, uid } = parseCzteamHeader(HOME_HTML, HOST)

    expect(uid).toBe("282901")
    expect(stats.username).toBe("torrentzirro")
    expect(stats.group).toBe("Power User")
    expect(stats.uploadedBytes).toBe(parseBytes("3.5 TiB"))
    expect(stats.downloadedBytes).toBe(parseBytes("1.2 TiB"))
    expect(stats.ratio).toBeCloseTo(2.92)
    expect(stats.hitAndRuns).toBe(2)
    expect(stats.freeleechTokens).toBe(7)
    expect(stats.remoteUserId).toBe(282901)
    expect(stats.platformMeta).toMatchObject({ hnrActive: 2, freeleechTokens: 7 })
  })

  it("throws a session error on the login page", () => {
    expect(() => parseCzteamHeader("<html><body>Sign in</body></html>", HOST)).toThrow(
      SessionExpiredError
    )
  })

  it("names the missing field instead of reporting a zero total", () => {
    const html = HOME_HTML.replace("Uploaded: 3.5 TB | ", "")
    expect(() => parseCzteamHeader(html, HOST)).toThrow(/missing uploaded total/)
  })
})

describe("parseCzteamProfile", () => {
  it("reads the class, join date, last activity and seeding size", () => {
    expect(parseCzteamProfile(PROFILE_HTML)).toMatchObject({
      group: "Power User",
      joinedDate: "2024-03-14",
      lastAccessDate: "2026-11-09",
      seedbonus: 1204.5,
      platformMeta: { seedSizeBytes: Number(parseBytes("1.5 TiB")) },
    })
  })
})

describe("parseCzteamCredentials", () => {
  it("rejects a blob that is not JSON", () => {
    expect(() => parseCzteamCredentials("abc123")).toThrow(/must be a JSON object/)
  })

  it("rejects a cookie header with no recognisable cookie", () => {
    expect(() =>
      parseCzteamCredentials(JSON.stringify({ cookies: "not a cookie", userAgent: "UA" }))
    ).toThrow()
  })
})

describe("CzteamAdapter", () => {
  it("merges the profile over the header totals", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(HOME_HTML, { status: 200 }))
      .mockResolvedValueOnce(new Response(PROFILE_HTML, { status: 200 }))

    const stats = await new CzteamAdapter().fetchStats(
      "https://czteam.me",
      JSON.stringify({ cookies: "c_secure_uid=1; c_secure_pass=abc", userAgent: "UA" }),
      "/userdetails.php"
    )

    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(stats.group).toBe("Power User")
    expect(stats.joinedDate).toBe("2024-03-14")
    expect(stats.uploadedBytes).toBe(parseBytes("3.5 TiB"))
    expect(stats.platformMeta).toMatchObject({ seedSizeBytes: Number(parseBytes("1.5 TiB")) })
  })

  it("keeps the header totals when the profile page fails", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(HOME_HTML, { status: 200 }))
      .mockResolvedValueOnce(new Response("<html>Sign in</html>", { status: 200 }))

    const stats = await new CzteamAdapter().fetchStats(
      "https://czteam.me",
      JSON.stringify({ cookies: "c_secure_uid=1; c_secure_pass=abc", userAgent: "UA" }),
      "/userdetails.php"
    )

    expect(stats.uploadedBytes).toBe(parseBytes("3.5 TiB"))
    expect(stats.joinedDate).toBeUndefined()
  })

  it("reports both pages, and fails the profile without losing the home readout", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(HOME_HTML, { status: 200 }))
      .mockResolvedValueOnce(new Response("<html>Sign in</html>", { status: 200 }))

    const calls = await new CzteamAdapter().fetchRaw(
      "https://czteam.me",
      JSON.stringify({ cookies: "c_secure_uid=1; c_secure_pass=abc", userAgent: "UA" }),
      "/userdetails.php"
    )

    expect(calls.map((call) => call.label)).toEqual(["Home Page", "Profile"])
    expect(calls[0]).toMatchObject({ endpoint: "/index.php", error: null })
    expect(calls[1]?.error).toEqual(expect.any(String))
    expect(calls[1]?.data).toBeNull()
  })

  it("keeps the header class when the profile table has no class row", async () => {
    const profileWithoutClass = PROFILE_HTML.replace(
      '<tr><td class="rowhead">Class</td><td class="rowfollow">Power User</td></tr>',
      ""
    )
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(HOME_HTML, { status: 200 }))
      .mockResolvedValueOnce(new Response(profileWithoutClass, { status: 200 }))

    const stats = await new CzteamAdapter().fetchStats(
      "https://czteam.me",
      JSON.stringify({ cookies: "c_secure_uid=1; c_secure_pass=abc", userAgent: "UA" }),
      "/userdetails.php"
    )

    expect(stats.group).toBe("Power User")
    expect(stats.joinedDate).toBe("2024-03-14")
  })
})
