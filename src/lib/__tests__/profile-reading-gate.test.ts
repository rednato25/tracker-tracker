// src/lib/__tests__/profile-reading-gate.test.ts
//
// P49 cadence: at most one attempt per tracker per 24 hours, and a stopped
// tracker stays stopped until the opt-in is saved again.

import { describe, expect, it } from "vitest"
import { formatProfileReadAge } from "@/lib/profile-reading/labels"
import { withPreservedProfileRead, withProfileReadRecord } from "@/lib/profile-reading/meta"
import {
  isProfileReadDue,
  isProfileReadFresh,
  PROFILE_READ_INTERVAL_MS,
  type ProfileReadRecord,
  readProfileReadRecord,
} from "@/lib/profile-reading/types"
import { profilePageUrl } from "@/lib/profile-reading/urls"

const NOW = new Date("2026-10-31T12:00:00.000Z")

function record(overrides: Partial<ProfileReadRecord> = {}): ProfileReadRecord {
  return {
    fetchedAt: "2026-10-31T06:00:00.000Z",
    attemptedAt: "2026-10-31T06:00:00.000Z",
    status: null,
    values: { seedSizeBytes: 1024 },
    ...overrides,
  }
}

describe("profile reading gate", () => {
  it("is due when no attempt has been recorded", () => {
    expect(isProfileReadDue(null, NOW)).toBe(true)
    expect(isProfileReadDue(record({ attemptedAt: null, fetchedAt: null }), NOW)).toBe(true)
  })

  it("is not due before 24 hours have passed", () => {
    expect(isProfileReadDue(record(), NOW)).toBe(false)
    expect(
      isProfileReadDue(record({ attemptedAt: "2026-10-30T12:00:01.000Z" }), NOW)
    ).toBe(false)
  })

  it("is due at 24 hours and after", () => {
    expect(isProfileReadDue(record({ attemptedAt: "2026-10-30T12:00:00.000Z" }), NOW)).toBe(true)
  })

  it("stays stopped after a session-expired or page-changed outcome", () => {
    for (const status of ["session_expired", "page_changed"] as const) {
      expect(
        isProfileReadDue(
          record({ status, attemptedAt: "2026-10-01T00:00:00.000Z", fetchedAt: "2026-10-01T00:00:00.000Z" }),
          NOW
        )
      ).toBe(false)
    }
  })

  it("uses the stored values for a day, then calls them stale", () => {
    expect(isProfileReadFresh(record(), NOW)).toBe(true)
    expect(
      isProfileReadFresh(record({ fetchedAt: "2026-10-30T11:00:00.000Z" }), NOW)
    ).toBe(false)
    expect(isProfileReadFresh(record({ status: "page_changed" }), NOW)).toBe(false)
  })

  it("uses the attempt time, not the last success, for the 24 hour gate", () => {
    const failed = record({
      fetchedAt: "2026-10-01T00:00:00.000Z",
      attemptedAt: "2026-10-31T11:00:00.000Z",
    })
    expect(isProfileReadDue(failed, NOW)).toBe(false)
    expect(PROFILE_READ_INTERVAL_MS).toBe(24 * 60 * 60 * 1000)
  })
})

describe("profile platformMeta merge", () => {
  it("keeps a stored profileRead when a normal poll writes fresh API metadata", () => {
    const existing = JSON.stringify({
      apiKeyExpiresAt: "2027-01-01T00:00:00.000Z",
      profileRead: record(),
    })
    const next = withPreservedProfileRead({ seeding: 5 }, existing)
    expect(next).toMatchObject({ seeding: 5, profileRead: record() })
  })

  it("leaves a tracker that never enabled reading untouched", () => {
    const next = { seeding: 5 }
    expect(withPreservedProfileRead(next, JSON.stringify({ seeding: 4 }))).toBe(next)
    expect(withPreservedProfileRead(next, null)).toBe(next)
  })

  it("keeps API metadata when a profile read writes its record", () => {
    const written = JSON.parse(
      withProfileReadRecord(JSON.stringify({ apiKeyExpiresAt: "x" }), record())
    )
    expect(written.apiKeyExpiresAt).toBe("x")
    expect(written.profileRead.values.seedSizeBytes).toBe(1024)
  })

  it("ignores a malformed stored platformMeta", () => {
    expect(readProfileReadRecord("{broken")).toBeNull()
    expect(JSON.parse(withProfileReadRecord("{broken", record())).profileRead.status).toBeNull()
  })
})

describe("profile read label", () => {
  it("prints the source and whole hours", () => {
    expect(formatProfileReadAge("2026-10-31T09:00:00.000Z", NOW)).toBe(
      "from profile page · 3 hours ago"
    )
    expect(formatProfileReadAge("2026-10-31T10:30:00.000Z", NOW)).toBe(
      "from profile page · 1 hour ago"
    )
    expect(formatProfileReadAge("2026-10-31T11:30:00.000Z", NOW)).toBe(
      "from profile page · less than an hour ago"
    )
  })
})

describe("profile page URLs", () => {  it("uses the groups page for Zenith and the user page for UNIT3D", () => {
    expect(profilePageUrl("zenith", "https://znth.cx/", "name")).toBe("https://znth.cx/groups")
    expect(profilePageUrl("uploadcx", "https://upload.cx", "some user")).toBe(
      "https://upload.cx/users/some%20user"
    )
    expect(profilePageUrl("onlyencodes", "https://onlyencodes.cc", "a")).toBe(
      "https://onlyencodes.cc/users/a"
    )
    expect(profilePageUrl("seedpool", "https://seedpool.org", "a")).toBe(
      "https://seedpool.org/users/a"
    )
    expect(profilePageUrl("yuscene", "https://yu-scene.net", "a")).toBe(
      "https://yu-scene.net/users/a"
    )
    expect(profilePageUrl("portugas", "https://portugas.org", "a")).toBe(
      "https://portugas.org/users/a"
    )
    expect(profilePageUrl("v3x", "https://v3x.club", "a")).toBe("https://v3x.club/u/a")
  })

  it("returns null for a tracker with no known profile layout", () => {
    expect(profilePageUrl("aither", "https://aither.cc", "a")).toBeNull()
  })
})
