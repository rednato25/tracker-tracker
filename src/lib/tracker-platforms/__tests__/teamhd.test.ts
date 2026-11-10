// src/lib/tracker-platforms/__tests__/teamhd.test.ts
//
// The fixtures below are trimmed copies of the real logged-in pages. Two
// details only the live markup shows: the class sits in the username link's
// title attribute, and the bonus groups thousands with a space ("29 686"),
// which the shared count reader stops at.

import { describe, expect, it, vi } from "vitest"
import { parseBytes } from "@/lib/parser"
import {
  parseDottedDate,
  parseRussianDate,
  parseTeamhdCredentials,
  parseTeamhdHomepage,
  parseTeamhdProfile,
  parseTeamhdRates,
  TeamhdAdapter,
} from "../adapters/teamhd"
import { SessionExpiredError } from "../helpers/errors"

const HOME_HTML = `
<html><head><title>TeamHD</title></head>
<body>
<div class="col-8 mb-4">
	<a href="/user/id7279"><span style="color:#000000" title="720p">khazzTHD</span></a></b> &nbsp;[<a href="my.php">Настройки</a>]&nbsp;[<a href="/logout.php">Выход!</a>]
	<br><font color=#1900D1>Рейтинг:</font> Inf.&nbsp;&nbsp;
	<font color=green>Раздал:</font> 34.67 GiB&nbsp;&nbsp;
	<font color=darkred>Скачал:</font> 0.00 KiB</font>&nbsp;&nbsp;
	<font color=darkblue>Бонус:</font> <a href="/mybonus.php" class="online" title="Потратить">29 686</a>&nbsp;&nbsp;
	<font color=#1900D1>Торренты:</font>
	<img alt="Раздаёт" title="Раздаёт" src="/themes/teamhd_web/images/arrowup.gif">&nbsp;1&nbsp;&nbsp;
	<img alt="Качает" title="Качает" src="/themes/teamhd_web/images/arrowdown.gif">&nbsp;0</div>
</body></html>
`

const PROFILE_HTML = `
<html><head><title>Просмотр профиля khazzTHD::TeamHD</title></head>
<body>
<a href="/logout.php">Выход!</a>
<div id="profile_container">
  <div id="profile_left"><h4><span style="color:#000000" title="720p">khazzTHD</span></h4>
    <table class="inlay" width="100%">
      <tr valign="top">
        <td width="150px"><img src="/pic/default_avatar.gif" alt="Avatar" /></td>
        <td>
          <p class=small>720p</p>
          <p class=small><b>Скачал:</b> 0.00&nbsp;KiB</p>
          <p class=small><b>Раздал:</b> 34.67&nbsp;GiB</p>
        </td>
      </tr>
    </table>
  </div>
  <div id="profile_right"><h4>Информация</h4>
    <table class="inlay" width="100%">
      <tr><td class="rowhead" width="40%">Регистрация:</td><td align="left" width="60%">29 сентября 2026 (6 недель назад)</td></tr>
      <tr><td class="rowhead" width="40%">Активность:</td><td align="left" width="60%">10-11-2026 23:51:07 (&lt; 1 минуты назад)</td></tr>
      <tr><td class="rowhead" width="40%">Пол:</td><td align="left" width="60%"><img src="https://teamhd.org/pic/male.gif" alt="Парень"></td></tr>
    </table>
  </div>
</div>
</body></html>
`

const RATES_HTML = `
<html><body>
<a href="logout.php">Выход!</a>
<table class="table"><tbody><tr><td>1</td><td>1.75 TB</td></tr></tbody></table>
</body></html>
`

const HOST = "teamhd.org"

describe("parseTeamhdHomepage", () => {
  it("reads the welcome block, the class and the torrent counts", () => {
    const { stats, profileId, profileName } = parseTeamhdHomepage(HOME_HTML, HOST)

    expect(profileId).toBe("id7279")
    expect(profileName).toBe("khazzTHD")
    expect(stats.username).toBe("khazzTHD")
    expect(stats.group).toBe("720p")
    expect(stats.uploadedBytes).toBe(parseBytes("34.67 GiB"))
    expect(stats.downloadedBytes).toBe(0n)
    expect(stats.ratio).toBe(Number.POSITIVE_INFINITY)
    // "29 686" groups its thousands with a space.
    expect(stats.seedbonus).toBe(29686)
    expect(stats.seedingCount).toBe(1)
    expect(stats.leechingCount).toBe(0)
  })

  it("throws a session error when the login page comes back instead", () => {
    expect(() => parseTeamhdHomepage("<html><body>Вход</body></html>", HOST)).toThrow(
      SessionExpiredError
    )
  })

  it("names the missing field instead of reporting a zero total", () => {
    const html = HOME_HTML.replace("<font color=green>Раздал:</font> 34.67 GiB", "")
    expect(() => parseTeamhdHomepage(html, HOST)).toThrow(/missing uploaded total/)
  })
})

describe("parseRussianDate", () => {
  it("converts the profile date to a plain calendar date", () => {
    expect(parseRussianDate("29 сентября 2026 (6 недель назад)")).toBe("2026-09-29")
    expect(parseRussianDate("1 декабря 2024")).toBe("2024-12-01")
  })

  it("returns undefined for a date it cannot read", () => {
    expect(parseRussianDate("2024-01-01")).toBeUndefined()
    expect(parseRussianDate("14 foo 2021")).toBeUndefined()
  })
})

describe("parseDottedDate", () => {
  it("reads the day-first activity timestamp", () => {
    expect(parseDottedDate("10-11-2026 23:51:07 (< 1 минуты назад)")).toBe("2026-11-10")
    expect(parseDottedDate("5-03-2026 01:02:03")).toBe("2026-03-05")
  })

  it("returns undefined when there is no date", () => {
    expect(parseDottedDate("нет")).toBeUndefined()
    expect(parseDottedDate(undefined)).toBeUndefined()
  })
})

describe("parseTeamhdProfile", () => {
  it("reads the registration date, last activity and class", () => {
    expect(parseTeamhdProfile(PROFILE_HTML)).toMatchObject({
      group: "720p",
      joinedDate: "2026-09-29",
      lastAccessDate: "2026-11-10",
    })
  })
})

describe("parseTeamhdRates", () => {
  it("reads the seeding size and count", () => {
    expect(parseTeamhdRates(RATES_HTML)).toMatchObject({
      seedingCount: 1,
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
  const creds = JSON.stringify({ cookies: "c_secure_uid=1; c_secure_pass=abc", userAgent: "UA" })

  it("merges the profile and the seeding rates over the welcome block", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(HOME_HTML, { status: 200 }))
      .mockResolvedValueOnce(new Response(PROFILE_HTML, { status: 200 }))
      .mockResolvedValueOnce(new Response(RATES_HTML, { status: 200 }))

    const stats = await new TeamhdAdapter().fetchStats("https://teamhd.org", creds, "/index.php")

    expect(stats.uploadedBytes).toBe(parseBytes("34.67 GiB"))
    expect(stats.group).toBe("720p")
    expect(stats.joinedDate).toBe("2026-09-29")
    expect(stats.lastAccessDate).toBe("2026-11-10")
    expect(stats.seedingCount).toBe(1)
    expect(stats.platformMeta).toMatchObject({
      seedSizeBytes: Number(parseBytes("1.75 TiB")),
    })
  })

  it("keeps the welcome block when the enrichment pages fail", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(HOME_HTML, { status: 200 }))
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockRejectedValueOnce(new TypeError("fetch failed"))

    const stats = await new TeamhdAdapter().fetchStats("https://teamhd.org", creds, "/index.php")

    expect(stats.uploadedBytes).toBe(parseBytes("34.67 GiB"))
    expect(stats.seedingCount).toBe(1)
    expect(stats.joinedDate).toBeUndefined()
  })

  it("reports one call per page, with the failing ones recorded rather than thrown", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(HOME_HTML, { status: 200 }))
      .mockResolvedValueOnce(new Response(PROFILE_HTML, { status: 200 }))
      .mockResolvedValueOnce(new Response("<html>Sign in</html>", { status: 200 }))

    const calls = await new TeamhdAdapter().fetchRaw("https://teamhd.org", creds, "/index.php")

    expect(calls.map((call) => call.label)).toEqual(["Home Page", "Profile", "Seeding rates"])
    expect(calls.map((call) => call.endpoint)).toEqual(["/index.php", "/user/", "/bprate.php"])
    expect(calls[1]?.error).toBeNull()
    expect(calls[2]?.error).toEqual(expect.any(String))
  })
})
