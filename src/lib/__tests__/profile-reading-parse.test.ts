// src/lib/__tests__/profile-reading-parse.test.ts
//
// P49 layout fixtures. Every page below is a saved HTML file and no test makes
// a network request.

import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  parseDurationSeconds,
  parseProfilePage,
  parseUnit3dProfilePage,
  parseV3xProfilePage,
  parseZenithGroupsPage,
} from "@/lib/profile-reading/parse"
import { joinedAtFor, readProfilePageOnce } from "@/lib/profile-reading/read"
import type { ProfileReadRecord } from "@/lib/profile-reading/types"
import { looksLikeLoginPage } from "@/lib/profile-reading/urls"

const TiB = 1024 ** 4
const GiB = 1024 ** 3
const DAY = 86_400

function fixture(name: string): string {
  return readFileSync(
    join(process.cwd(), "src/lib/profile-reading/__tests__/fixtures", name),
    "utf8"
  )
}

const previous: ProfileReadRecord = {
  fetchedAt: "2026-10-30T00:00:00.000Z",
  attemptedAt: "2026-10-30T00:00:00.000Z",
  status: null,
  values: { seedSizeBytes: 1024 },
}

const NOW = new Date("2026-10-31T12:00:00.000Z")

describe("UNIT3D profile layouts", () => {
  it("reads Upload.cx key-value rows without treating uploaded bytes as a count", () => {
    expect(parseUnit3dProfilePage(fixture("uploadcx-profile.html"), NOW)).toMatchObject({
      seedSizeBytes: 5.25 * TiB,
      averageSeedTimeSeconds: 63 * DAY,
      uploads: 184,
      lastLoginAt: "2026-10-31",
    })
  })

  it("reads OnlyEncodes table rows", () => {
    expect(parseUnit3dProfilePage(fixture("onlyencodes-profile.html"), NOW)).toMatchObject({
      seedSizeBytes: 1.75 * TiB,
      averageSeedTimeSeconds: 21 * DAY,
      uploads: 42,
    })
  })

  it("reads seedpool definition-list rows", () => {
    expect(parseUnit3dProfilePage(fixture("seedpool-profile.html"), NOW)).toMatchObject({
      seedSizeBytes: 900 * GiB,
      averageSeedTimeSeconds: 18 * DAY,
      uploads: 7,
    })
  })

  it("reads Yu-Scene's weighted average seedtime, upload count and Last login", () => {
    expect(parseUnit3dProfilePage(fixture("yuscene-profile.html"), NOW)).toMatchObject({
      seedSizeBytes: 2.5 * TiB,
      averageSeedTimeSeconds: 32 * DAY,
      uploads: 1204,
      lastLoginAt: "2026-10-31",
    })
  })

  it("reads Portugas' Portuguese labels", () => {
    expect(parseUnit3dProfilePage(fixture("portugas-profile.html"), NOW)).toMatchObject({
      seedSizeBytes: 750 * GiB,
      averageSeedTimeSeconds: 23 * DAY,
      uploads: 31,
    })
  })

  it("reads NordicQuality's Seeding Size and Average Seedtime, not Total Seedtime", () => {
    const values = parseUnit3dProfilePage(
      fixture("nordicq-profile.html"),
      new Date("2026-11-11T18:30:00.000Z")
    )
    expect(values.seedSizeBytes).toBe(Math.round(5.14 * GiB))
    expect(values.averageSeedTimeSeconds).toBe(8 * DAY + 15 * 3600 + 28 * 60 + 54)
    expect(values.lastLoginAt).toBe("2026-11-11")
    // Total uploads (Non-Anonymous) 0 + (Anonymous) 0.
    expect(values.uploads).toBe(0)
  })

  it("reads Lat-Team's Spanish labels and relative last login", () => {
    const values = parseUnit3dProfilePage(
      fixture("latteam-profile.html"),
      new Date("2026-11-11T17:30:00.000Z")
    )
    expect(values.seedSizeBytes).toBe(Math.round(59.52 * GiB))
    expect(values.averageSeedTimeSeconds).toBe(6 * DAY + 10 * 3600 + 58 * 60 + 33)
    expect(values.lastLoginAt).toBe("2026-11-11")
  })

  it("reads DreadVault's month-long average seedtime as days, not minutes", () => {
    const values = parseUnit3dProfilePage(
      fixture("dreadvault-profile.html"),
      new Date("2026-11-11T22:00:00.000Z")
    )
    expect(values.averageSeedTimeSeconds).toBe(31 * DAY + 15 * 3600 + 22 * 60 + 24)
    expect(values.seedSizeBytes).toBe(Math.round(51.81 * GiB))
    expect(values.uploads).toBe(0)
    expect(values.lastLoginAt).toBe("2026-11-11")
  })

  it("adds RetroMoviesClub's public and anonymous upload counts", () => {
    const values = parseUnit3dProfilePage(
      fixture("retromoviesclub-profile.html"),
      new Date("2026-11-11T22:00:00.000Z")
    )
    expect(values.uploads).toBe(38)
    expect(values.seedSizeBytes).toBe(Math.round(1.08 * TiB))
    expect(values.averageSeedTimeSeconds).toBe(4 * DAY + 17 * 3600 + 60 + 58)
  })

  it("takes SeedCore's unique seeding size and its exact last login over '1 month ago'", () => {
    const values = parseUnit3dProfilePage(
      fixture("seedcore-profile.html"),
      new Date("2026-11-11T22:00:00.000Z")
    )
    expect(values.seedSizeBytes).toBe(Math.round(212.08 * GiB))
    expect(values.averageSeedTimeSeconds).toBe(35 * DAY + 18 * 3600 + 6 * 60 + 58)
    // "1 month ago" alone would give 2026-10-12, two weeks late.
    expect(values.lastLoginAt).toBe("2026-09-28")
  })

  it("reads the registration date from UNIT3D's profile__registration timestamp", () => {
    expect(parseUnit3dProfilePage(fixture("nordicq-profile.html")).joinedAt).toBe("2026-09-30")
    expect(parseUnit3dProfilePage(fixture("latteam-profile.html")).joinedAt).toBe("2026-10-21")
    expect(parseUnit3dProfilePage(fixture("seedcore-profile.html")).joinedAt).toBe("2026-08-26")
    expect(parseUnit3dProfilePage(fixture("uploadcx-profile.html")).joinedAt).toBeUndefined()
  })

  it("falls back to the relative text when the last login has no timestamp", () => {
    const html =
      '<div class="key-value__group"><dt>Last login</dt><dd>2 days ago</dd></div>'
    expect(parseUnit3dProfilePage(html, new Date("2026-11-11T12:00:00.000Z")).lastLoginAt).toBe(
      "2026-11-09"
    )
  })

  it("takes Last login over Last action and ignores Last action on its own", () => {
    const both = `<div class="key-value__group"><dt>Last login</dt><dd>9 minutes ago</dd></div>
      <div class="key-value__group"><dt>Last action</dt><dd>2020-01-01 00:00:00</dd></div>`
    expect(parseUnit3dProfilePage(both, NOW).lastLoginAt).toBe("2026-10-31")

    const actionOnly = `<div class="key-value__group"><dt>Last action</dt><dd>9 minutes ago</dd></div>`
    expect(parseUnit3dProfilePage(actionOnly, NOW).lastLoginAt).toBeUndefined()
  })

  it("treats a unitless Uploaded value as a count and bytes as not-a-count", () => {
    expect(
      parseUnit3dProfilePage(
        '<div class="key-value__group"><dt>Uploaded</dt><dd>88</dd></div>'
      ).uploads
    ).toBe(88)
    expect(
      parseUnit3dProfilePage(
        '<div class="key-value__group"><dt>Uploaded</dt><dd>12.5 TiB</dd></div>'
      ).uploads
    ).toBeUndefined()
  })
})

describe("Zenith groups layout", () => {
  it("reads the You: values", () => {
    expect(parseZenithGroupsPage(fixture("zenith-groups.html"))).toMatchObject({
      seedSizeBytes: 2.25 * TiB,
      averageSeedTimeSeconds: 23 * DAY,
      uploads: 412,
    })
  })
})

describe("V3X profile layout", () => {
  it("reads level and XP when the profile shows them", () => {
    expect(parseV3xProfilePage(fixture("v3x-profile.html"))).toEqual({
      level: 25,
      xp: 100128,
    })
  })

  it("leaves both absent when the profile hides them", () => {
    expect(parseV3xProfilePage("<html><body><h1>Profil</h1></body></html>")).toEqual({})
  })
})

describe("duration parsing", () => {
  it("adds every component and reads a clock value", () => {
    expect(parseDurationSeconds("1 month 2 days 3 hours")).toBe(
      32 * DAY + 3 * 3600
    )
    expect(parseDurationSeconds("12:34:56")).toBe(12 * 3600 + 34 * 60 + 56)
    expect(parseDurationSeconds("never")).toBeUndefined()
  })

  it("reads UNIT3D's capital calendar units as months, weeks and days, not minutes", () => {
    expect(parseDurationSeconds("1M 2W 1D 15h 28m 54s")).toBe(
      30 * DAY + 14 * DAY + DAY + 15 * 3600 + 28 * 60 + 54
    )
    // Spanish builds print S (semana) for a week.
    expect(parseDurationSeconds("1M 1S 1D 17h 51m 18s")).toBe(
      30 * DAY + 7 * DAY + DAY + 17 * 3600 + 51 * 60 + 18
    )
    expect(parseDurationSeconds("1Y 2D")).toBe(367 * DAY)
    expect(parseDurationSeconds("3 Days 4 hours")).toBe(3 * DAY + 4 * 3600)
    expect(parseDurationSeconds("2 días")).toBe(2 * DAY)
    // Spanish builds print A (año) for a year.
    expect(parseDurationSeconds("1A 2S")).toBe(365 * DAY + 14 * DAY)
  })
})

describe("one page, one decision", () => {
  it("stores the fetch time on success", () => {
    const result = readProfilePageOnce({
      registrySlug: "zenith",
      html: fixture("zenith-groups.html"),
      previous,
      now: NOW,
    })
    expect(result.fetched).toBe(true)
    expect(result.record).toMatchObject({
      fetchedAt: NOW.toISOString(),
      attemptedAt: NOW.toISOString(),
      status: null,
    })
    expect(result.record.values.uploads).toBe(412)
  })

  it("stores the profile's Last login as a calendar date", () => {
    const result = readProfilePageOnce({
      registrySlug: "yuscene",
      html: fixture("yuscene-profile.html"),
      previous,
      now: NOW,
    })
    expect(result.record.values.lastLoginAt).toBe("2026-10-31")
  })

  it("stops on a login page and keeps the last values", () => {
    const html = fixture("login.html")
    expect(looksLikeLoginPage(html)).toBe(true)
    const result = readProfilePageOnce({
      registrySlug: "uploadcx",
      html,
      previous,
      now: NOW,
    })
    expect(result.fetched).toBe(false)
    expect(result.record.status).toBe("session_expired")
    expect(result.record.values).toEqual(previous.values)
    expect(result.record.fetchedAt).toBe(previous.fetchedAt)
  })

  it("stops on a changed layout and keeps the last values", () => {
    const result = readProfilePageOnce({
      registrySlug: "uploadcx",
      html: "<html><body><main><h1>Redesigned</h1></main></body></html>",
      previous,
      now: NOW,
    })
    expect(result.fetched).toBe(false)
    expect(result.record.status).toBe("page_changed")
    expect(result.record.values).toEqual(previous.values)
  })

  it("does not treat a profile with a password form and no login action as a login page", () => {
    const html = `<html><head><title>Profile</title></head><body>
      <form action="/settings/password"><input name="password" type="password"></form>
    </body></html>`
    expect(looksLikeLoginPage(html)).toBe(false)
  })

  it("dispatches each fixture to its layout", () => {
    expect(parseProfilePage("zenith", fixture("zenith-groups.html"))?.layout).toBe("zenith")
    expect(parseProfilePage("v3x", fixture("v3x-profile.html"))?.layout).toBe("v3x")
    expect(parseProfilePage("uploadcx", fixture("uploadcx-profile.html"))?.layout).toBe(
      "unit3d"
    )
    expect(parseProfilePage("nordicq", fixture("nordicq-profile.html"))?.layout).toBe("unit3d")
    expect(parseProfilePage("latteam", fixture("latteam-profile.html"))?.layout).toBe("unit3d")
    for (const slug of ["dreadvault", "retromoviesclub", "seedcore"]) {
      expect(parseProfilePage(slug, fixture(`${slug}-profile.html`))?.layout).toBe("unit3d")
    }
    expect(
      parseProfilePage("uploadcx", "<html><body>no stats here</body></html>")
    ).toBeNull()
  })
})

describe("join date from the profile read", () => {
  const read = (joinedAt?: string, status: ProfileReadRecord["status"] = null): ProfileReadRecord => ({
    fetchedAt: "2026-11-11T00:00:00.000Z",
    attemptedAt: "2026-11-11T00:00:00.000Z",
    status,
    values: joinedAt ? { joinedAt } : {},
  })

  it("fills an empty join date", () => {
    expect(joinedAtFor({ joinedAt: null }, read("2026-09-30"))).toBe("2026-09-30")
  })

  it("never overwrites a stored join date, and ignores a stopped read", () => {
    expect(joinedAtFor({ joinedAt: "2026-10-01" }, read("2026-09-30"))).toBeUndefined()
    expect(joinedAtFor({ joinedAt: null }, read("2026-09-30", "session_expired"))).toBeUndefined()
    expect(joinedAtFor({ joinedAt: null }, read())).toBeUndefined()
  })

  it("keeps the registration date when the stored record is read back", () => {
    const html = fixture("nordicq-profile.html")
    const next = readProfilePageOnce({ registrySlug: "nordicq", html, previous: null, now: NOW })
    expect(next.record.values.joinedAt).toBe("2026-09-30")
  })
})
