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
import { readProfilePageOnce } from "@/lib/profile-reading/read"
import { looksLikeLoginPage } from "@/lib/profile-reading/urls"
import type { ProfileReadRecord } from "@/lib/profile-reading/types"

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

const NOW = new Date("2026-10-31T00:00:00.000Z")

describe("UNIT3D profile layouts", () => {
  it("reads Upload.cx key-value rows without treating uploaded bytes as a count", () => {
    expect(parseUnit3dProfilePage(fixture("uploadcx-profile.html"))).toMatchObject({
      seedSizeBytes: 5.25 * TiB,
      averageSeedTimeSeconds: 63 * DAY,
      uploads: 184,
    })
  })

  it("reads OnlyEncodes table rows", () => {
    expect(parseUnit3dProfilePage(fixture("onlyencodes-profile.html"))).toMatchObject({
      seedSizeBytes: 1.75 * TiB,
      averageSeedTimeSeconds: 21 * DAY,
      uploads: 42,
    })
  })

  it("reads seedpool definition-list rows", () => {
    expect(parseUnit3dProfilePage(fixture("seedpool-profile.html"))).toMatchObject({
      seedSizeBytes: 900 * GiB,
      averageSeedTimeSeconds: 18 * DAY,
      uploads: 7,
    })
  })

  it("reads Yu-Scene's weighted average seedtime and upload count", () => {
    expect(parseUnit3dProfilePage(fixture("yuscene-profile.html"))).toMatchObject({
      seedSizeBytes: 2.5 * TiB,
      averageSeedTimeSeconds: 32 * DAY,
      uploads: 1204,
    })
  })

  it("reads Portugas' Portuguese labels", () => {
    expect(parseUnit3dProfilePage(fixture("portugas-profile.html"))).toMatchObject({
      seedSizeBytes: 750 * GiB,
      averageSeedTimeSeconds: 23 * DAY,
      uploads: 31,
    })
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
    expect(
      parseProfilePage("uploadcx", "<html><body>no stats here</body></html>")
    ).toBeNull()
  })
})
