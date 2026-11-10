// src/lib/tracker-platforms/__tests__/teamhd.test.ts
//
// The fixture follows the selectors PT-depiler's teamhd.ts documents for this
// site: the coloured glyphs in the welcome block, the /user/ profile tables and
// bprate.php. It has not been checked against a logged-in page, so these tests
// hold the parser to the documented shape.

import { describe, expect, it, vi } from "vitest"
import { parseBytes } from "@/lib/parser"
import {
  parseRussianDate,
  parseTeamhdCredentials,
  parseTeamhdHomepage,
  parseTeamhdProfile,
  parseTeamhdRates,
  TeamhdAdapter,
} from "../adapters/teamhd"
import { SessionExpiredError } from "../helpers/errors"

const HOME_HTML = `
<html><head><title>Главная::TeamHD</title></head>
<body>
<div class="col-8 mb-4">
  <font color="green">↑</font> 2.25 TB
  <font color="darkred">↓</font> 780 GB
  <font color="#1900D1">2.95</font>
</div>
<span id="message_box"><a href="messages.php"><font>3</font></a></span>
<a class="online" href="/mybonus.php">12,450</a>
<a href="/user/id7279">vasya</a>
<a href="logout.php">Выход</a>
</body></html>
`

const PROFILE_HTML = `
<html><body>
<a href="logout.php">Выход</a>
<table id="profile_right" class="inlay"><tbody>
  <tr><td>Присоединился</td><td>14 марта 2021 (5 years)</td></tr>
</tbody></table>
<div id="profile_left">
  <table><tbody>
    <tr><td>Статус</td><td><p><u><span>Power User</span></u></p></td></tr>
  </tbody></table>
</div>
</body></html>
`

const RATES_HTML = `
<html><body>
<a href="logout.php">Выход</a>
<table class="table"><tbody><tr><td>42</td><td>1.75 TB</td></tr></tbody></table>
</body></html>
`

const HOST = "teamhd.org"

describe("parseTeamhdHomepage", () => {
  it("reads the welcome-block totals, bonus and message count", () => {
    const { stats, profileId, profileName } = parseTeamhdHomepage(HOME_HTML, HOST)

    expect(stats.uploadedBytes).toBe(parseBytes("2.25 TiB"))
    expect(stats.downloadedBytes).toBe(parseBytes("780 GiB"))
    expect(stats.ratio).toBeCloseTo(2.95)
    expect(stats.seedbonus).toBe(12450)
    expect(stats.platformMeta).toMatchObject({ unreadMessages: 3 })
    expect(profileId).toBe("id7279")
    expect(profileName).toBe("vasya")
    expect(stats.username).toBe("vasya")
  })

  it("throws a session error when the login page comes back instead", () => {
    expect(() =>
      parseTeamhdHomepage("<html><body>Вход</body></html>", HOST)
    ).toThrow(SessionExpiredError)
  })

  it("names the missing field instead of reporting a zero total", () => {
    const html = HOME_HTML.replace('<font color="green">↑</font> 2.25 TB', "")
    expect(() => parseTeamhdHomepage(html, HOST)).toThrow(/missing uploaded total/)
  })
})

describe("parseRussianDate", () => {
  it("converts the profile's Russian date to a plain calendar date", () => {
    expect(parseRussianDate("14 марта 2021 (5 years)")).toBe("2021-03-14")
    expect(parseRussianDate("1 декабря 2024")).toBe("2024-12-01")
  })

  it("returns undefined for a date it cannot read", () => {
    expect(parseRussianDate("2024-01-01")).toBeUndefined()
    expect(parseRussianDate("14 foo 2021")).toBeUndefined()
  })
})

describe("parseTeamhdProfile", () => {
  it("reads the join date and the class", () => {
    expect(parseTeamhdProfile(PROFILE_HTML)).toMatchObject({
      group: "Power User",
      joinedDate: "2021-03-14",
    })
  })
})

describe("parseTeamhdRates", () => {
  it("reads the seeding count and seeding size", () => {
    expect(parseTeamhdRates(RATES_HTML)).toMatchObject({
      seedingCount: 42,
      platformMeta: { seedSizeBytes: Number(parseBytes("1.75 TiB")) },
    })
  })
})

describe("parseTeamhdCredentials", () => {
  it("rejects a blob that is not JSON", () => {
    expect(() => parseTeamhdCredentials("abc123")).toThrow(/must be a JSON object/)
  })
})

describe("TeamhdAdapter", () => {
  it("merges the profile and the seeding rates over the welcome block", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(HOME_HTML, { status: 200 }))
      .mockResolvedValueOnce(new Response(PROFILE_HTML, { status: 200 }))
      .mockResolvedValueOnce(new Response(RATES_HTML, { status: 200 }))

    const stats = await new TeamhdAdapter().fetchStats(
      "https://teamhd.org",
      JSON.stringify({ cookies: "c_secure_uid=1; c_secure_pass=abc", userAgent: "UA" }),
      "/index.php"
    )

    expect(stats.uploadedBytes).toBe(parseBytes("2.25 TiB"))
    expect(stats.group).toBe("Power User")
    expect(stats.joinedDate).toBe("2021-03-14")
    expect(stats.seedingCount).toBe(42)
    expect(stats.platformMeta).toMatchObject({
      unreadMessages: 3,
      seedSizeBytes: Number(parseBytes("1.75 TiB")),
    })
  })

  it("keeps the welcome-block totals when the enrichment pages fail", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(HOME_HTML, { status: 200 }))
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockRejectedValueOnce(new TypeError("fetch failed"))

    const stats = await new TeamhdAdapter().fetchStats(
      "https://teamhd.org",
      JSON.stringify({ cookies: "c_secure_uid=1; c_secure_pass=abc", userAgent: "UA" }),
      "/index.php"
    )

    expect(stats.uploadedBytes).toBe(parseBytes("2.25 TiB"))
    expect(stats.group).toBeNull()
    expect(stats.seedingCount).toBeNull()
  })

  it("reports one call per page, with the failing ones recorded rather than thrown", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(HOME_HTML, { status: 200 }))
      .mockResolvedValueOnce(new Response(PROFILE_HTML, { status: 200 }))
      .mockResolvedValueOnce(new Response("<html>Sign in</html>", { status: 200 }))

    const calls = await new TeamhdAdapter().fetchRaw(
      "https://teamhd.org",
      JSON.stringify({ cookies: "c_secure_uid=1; c_secure_pass=abc", userAgent: "UA" }),
      "/index.php"
    )

    expect(calls.map((call) => call.label)).toEqual(["Home Page", "Profile", "Seeding rates"])
    expect(calls.map((call) => call.endpoint)).toEqual(["/index.php", "/user/", "/bprate.php"])
    expect(calls[1]?.error).toBeNull()
    expect(calls[2]?.error).toEqual(expect.any(String))
  })
})
