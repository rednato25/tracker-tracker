// src/lib/tracker-platforms/__tests__/czteam.test.ts
//
// The fixtures below are trimmed copies of the real logged-in pages, including
// the site-wide Tracker statistics card that once got read as the account's own
// total. Both traps are pinned here: reading "Uploaded 79,84 PB" out of the
// page body, and treating the decimal comma in "1,26 TB" as a grouping
// separator.

import { describe, expect, it, vi } from "vitest"
import { parseBytes } from "@/lib/parser"
import {
  CzteamAdapter,
  durationSeconds,
  parseCzteamCredentials,
  parseCzteamHeader,
  parseCzteamProfile,
} from "../adapters/czteam"
import { SessionExpiredError } from "../helpers/errors"

const HOME_HTML = `
<html><head><title>CZTeam Tracker</title></head>
<body>
<div class="cz-hdr">
  <a class="cz-logo" href="index.php" title="Home"><span class="cz-logo-mark">Cz</span>Team</a>
  <table class="cz-userinfo">
    <tr>
      <td class="cz-avatar" rowspan="3"><span class="cz-initial">K</span></td>
      <td class="cz-greet">
        Hello, <a href="userdetails.php?id=282901">khazzCZT</a>
        <span class="cz-class">[User]</span>
        <a href="classes.php" class="cz-class-link" title="View class progression">&#128640;</a>
        <a class="cz-sl cz-sl-up" href="myactivity.php?tab=seeding" title="Currently seeding"><span class="cz-sl-arrow">&#9650;</span><b>161</b></a>
        <a class="cz-sl cz-sl-down" href="myactivity.php?tab=leeching" title="Currently leeching"><span class="cz-sl-arrow">&#9660;</span><b>0</b></a>
        <a class="cz-sl cz-sl-hnr" href="hitandrun.php" title="Active Hit &amp; Runs"><span class="cz-sl-arrow">&#9888;</span><b>0</b></a>
        <a class="cz-sl cz-sl-fl" href="bonus.php" title="Freeleech tokens"><span class="cz-sl-arrow">&#127903;</span><b>10</b></a>
      </td>
    </tr>
    <tr>
      <td class="cz-actions">
        <a href="invite.php" title="Invites">Invites: <b>0</b></a>
        <a href="logout.php" title="Log out">Logout</a>
      </td>
    </tr>
    <tr>
      <td class="cz-stats">
        Ratio: <b>Inf.</b>
        &middot; Up: <b>1,26 TB</b>
        &middot; Down: <b>0,00 KB</b>
        &middot; <a href="bonus.php" title="Bonus points">&#129689; <b>4,485.33</b></a>
        &middot; <a href="myactivity.php?tab=snatched">Snatchlist</a>
      </td>
    </tr>
  </table>
</div>

<section class="card stats-card">
  <div class="stats-grid">
    <div class="stat-group">
      <div class="stat-row"><span class="stat-label">S/L ratio</span><span class="stat-value">13059%</span></div>
      <div class="stat-row"><span class="stat-label">Downloaded</span><span class="stat-value">15,79 PB</span></div>
      <div class="stat-row"><span class="stat-label">Uploaded</span><span class="stat-value">79,84 PB</span></div>
    </div>
  </div>
</section>
</body></html>
`

const PROFILE_HTML = `
<html><head><title>CZTeam Tracker :: Details for: khazzCZT</title></head>
<body>
<table class="cz-userinfo">
  <tr>
    <td class="cz-greet">
      Hello, <a href="userdetails.php?id=282901">khazzCZT</a>
      <span class="cz-class">[User]</span>
    </td>
  </tr>
  <tr><td class="cz-stats">Ratio: <b>Inf.</b> &middot; Up: <b>1,26 TB</b> &middot; Down: <b>0,00 KB</b></td></tr>
</table>
<div class="ud-page">
  <div class="ud-name-row">
    <span class="ucuser">khazzCZT</span>
    <span class="post-author-class ucuser">User</span>
  </div>
  <aside class="ud-side">
    <div class="ud-side-card">
      <div class="ud-side-stats">
        <div class="ud-side-stat"><span class="k">Registered</span><span class="v">2026-10-12 <small>4 Saptamani ago</small></span></div>
        <div class="ud-side-stat"><span class="k">Last access</span><span class="v">2026-11-10 22:44 <small>6 Minute ago</small></span></div>
        <div class="ud-side-stat"><span class="k">Uploaded</span><span class="v">1,259 TB <small>42,97 GB / day</small></span></div>
        <div class="ud-side-stat"><span class="k">Downloaded</span><span class="v">0,000 KB <small>0,00 KB / day</small></span></div>
        <div class="ud-side-stat"><span class="k">Ratio</span><span class="v"><span style="color:#80d090">Inf.</span></span></div>
        <div class="ud-side-stat"><span class="k">Total seedtime</span><span class="v">867 days 6 hours 36 minutes</span></div>
        <div class="ud-side-stat"><span class="k">Avg seedtime</span><span class="v">37 days 16 hours 58 minutes</span></div>
        <div class="ud-side-stat"><span class="k">Completed seeds</span><span class="v">1</span></div>
        <div class="ud-side-stat"><span class="k">Bonus points</span><span class="v"><a href="bonus.php">4,485.33</a> <small>+9.00/hr</small></span></div>
      </div>
    </div>
  </aside>
  <details class="ud-activity-section">
    <summary>
      <span>Activity</span>
      <span class="ud-activity-summary-meta">161 seeding &middot; 0 leeching &middot; 1 snatched &middot; 136 uploads &middot; 0 invited</span>
    </summary>
  </details>
  <a href="logout.php">Log out</a>
</div>
</body></html>
`

const HOST = "czteam.me"

describe("parseCzteamHeader", () => {
  it("reads the account totals from the header, not the site-wide statistics card", () => {
    const { stats, uid } = parseCzteamHeader(HOME_HTML, HOST)

    expect(uid).toBe("282901")
    expect(stats.username).toBe("khazzCZT")
    expect(stats.group).toBe("User")
    expect(stats.uploadedBytes).toBe(parseBytes("1.26 TiB"))
    expect(stats.downloadedBytes).toBe(0n)
    // The bug this fixture exists for: the page body prints "Uploaded 79,84 PB".
    expect(stats.uploadedBytes).not.toBe(parseBytes("7984 PiB"))
    expect(stats.ratio).toBe(Number.POSITIVE_INFINITY)
    expect(stats.seedingCount).toBe(161)
    expect(stats.leechingCount).toBe(0)
    expect(stats.hitAndRuns).toBe(0)
    expect(stats.freeleechTokens).toBe(10)
    expect(stats.seedbonus).toBe(4485.33)
    expect(stats.remoteUserId).toBe(282901)
  })

  it("throws a session error on a signed-out page, including its stylesheet", () => {
    expect(() => parseCzteamHeader("<html><body>Sign in</body></html>", HOST)).toThrow(
      SessionExpiredError
    )
    // The login page ships the header's CSS, so the class name in a stylesheet
    // must not read as a logged-in page.
    expect(() =>
      parseCzteamHeader("<html><style>.cz-userinfo { color: red }</style></html>", HOST)
    ).toThrow(SessionExpiredError)
  })

  it("names the missing field instead of reporting a zero total", () => {
    const html = HOME_HTML.replace("&middot; Up: <b>1,26 TB</b>", "")
    expect(() => parseCzteamHeader(html, HOST)).toThrow(/missing uploaded total/)
  })
})

describe("parseCzteamProfile", () => {
  it("reads the sidebar rows, with the decimal comma read as a fraction", () => {
    expect(parseCzteamProfile(PROFILE_HTML)).toMatchObject({
      group: "User",
      joinedDate: "2026-10-12",
      lastAccessDate: "2026-11-10",
      uploadedBytes: parseBytes("1.259 TiB"),
      downloadedBytes: 0n,
      ratio: Number.POSITIVE_INFINITY,
      seedbonus: 4485.33,
      platformMeta: {
        avgSeedTimeSeconds: 37 * 86_400 + 16 * 3_600 + 58 * 60,
        totalSeedTimeSeconds: 867 * 86_400 + 6 * 3_600 + 36 * 60,
        completedSeeds: 1,
        uploads: 136,
      },
    })
  })
})

describe("durationSeconds", () => {
  it("adds the parts the sidebar prints", () => {
    expect(durationSeconds("37 days 16 hours 58 minutes")).toBe(3_257_880)
    expect(durationSeconds("1 day")).toBe(86_400)
    expect(durationSeconds("6 hours 36 minutes")).toBe(23_760)
  })

  it("returns undefined when there is no duration to read", () => {
    expect(durationSeconds("-")).toBeUndefined()
    expect(durationSeconds(undefined)).toBeUndefined()
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
  const creds = JSON.stringify({ cookies: "c_secure_uid=1; c_secure_pass=abc", userAgent: "UA" })

  it("prefers the profile totals, which carry three decimals", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(HOME_HTML, { status: 200 }))
      .mockResolvedValueOnce(new Response(PROFILE_HTML, { status: 200 }))

    const stats = await new CzteamAdapter().fetchStats(
      "https://czteam.me",
      creds,
      "/userdetails.php"
    )

    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(stats.uploadedBytes).toBe(parseBytes("1.259 TiB"))
    expect(stats.joinedDate).toBe("2026-10-12")
    expect(stats.lastAccessDate).toBe("2026-11-10")
    expect(stats.seedingCount).toBe(161)
    expect(stats.platformMeta).toMatchObject({ avgSeedTimeSeconds: 3_257_880, uploads: 136 })
  })

  it("keeps the header totals when the profile page fails", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(HOME_HTML, { status: 200 }))
      .mockResolvedValueOnce(new Response("<html>Sign in</html>", { status: 200 }))

    const stats = await new CzteamAdapter().fetchStats(
      "https://czteam.me",
      creds,
      "/userdetails.php"
    )

    expect(stats.uploadedBytes).toBe(parseBytes("1.26 TiB"))
    expect(stats.seedingCount).toBe(161)
    expect(stats.joinedDate).toBeUndefined()
  })

  it("reports both pages, and fails the profile without losing the home readout", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(HOME_HTML, { status: 200 }))
      .mockResolvedValueOnce(new Response("<html>Sign in</html>", { status: 200 }))

    const calls = await new CzteamAdapter().fetchRaw(
      "https://czteam.me",
      creds,
      "/userdetails.php"
    )

    expect(calls.map((call) => call.label)).toEqual(["Home Page", "Profile"])
    expect(calls[0]).toMatchObject({ endpoint: "/index.php", error: null })
    expect(calls[1]?.error).toEqual(expect.any(String))
    expect(calls[1]?.data).toBeNull()
  })
})
