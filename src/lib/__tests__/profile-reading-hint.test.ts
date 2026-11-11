import { describe, expect, it } from "vitest"
import { getTrackerBySlug } from "@/data/tracker-registry"
import {
  ladderUsesProfileMetrics,
  PROFILE_HINT_ADD_COOKIE,
  PROFILE_HINT_EXPIRED,
  PROFILE_HINT_PAGE_CHANGED,
  PROFILE_HINT_TURN_ON,
  PROFILE_HINT_WAITING,
  profileReadingHint,
} from "@/lib/profile-reading/hint"

const read = (record: Record<string, unknown>) => JSON.stringify({ profileRead: record })

describe("profileReadingHint", () => {
  const latteam = { registrySlug: "latteam" }

  it("asks to turn profile reading on when it is off", () => {
    expect(profileReadingHint(latteam, "seedSizeBytes")).toBe(PROFILE_HINT_TURN_ON)
    expect(profileReadingHint({ ...latteam, profileReadingEnabled: false }, "uploads")).toBe(
      PROFILE_HINT_TURN_ON
    )
  })

  it("asks for a cookie, a new cookie, or patience as the read state requires", () => {
    const on = { ...latteam, profileReadingEnabled: true }
    expect(profileReadingHint({ ...on, hasProfileCookie: false }, "seedSizeBytes")).toBe(
      PROFILE_HINT_ADD_COOKIE
    )
    expect(profileReadingHint({ ...on, hasProfileCookie: true }, "seedSizeBytes")).toBe(
      PROFILE_HINT_WAITING
    )
    expect(
      profileReadingHint(
        {
          ...on,
          hasProfileCookie: true,
          platformMeta: read({
            fetchedAt: "2026-11-10T00:00:00.000Z",
            attemptedAt: "2026-11-11T00:00:00.000Z",
            status: "session_expired",
            values: {},
          }),
        },
        "averageSeedTimeSeconds"
      )
    ).toBe(PROFILE_HINT_EXPIRED)
    expect(
      profileReadingHint(
        {
          ...on,
          hasProfileCookie: true,
          platformMeta: read({
            fetchedAt: null,
            attemptedAt: "2026-11-11T00:00:00.000Z",
            status: "page_changed",
            values: {},
          }),
        },
        "averageSeedTimeSeconds"
      )
    ).toBe(PROFILE_HINT_PAGE_CHANGED)
  })

  it("stays quiet once a read has succeeded", () => {
    expect(
      profileReadingHint(
        {
          ...latteam,
          profileReadingEnabled: true,
          hasProfileCookie: true,
          platformMeta: read({
            fetchedAt: "2026-11-11T00:00:00.000Z",
            attemptedAt: "2026-11-11T00:00:00.000Z",
            status: null,
            values: { seedSizeBytes: 1 },
          }),
        },
        "seedSizeBytes"
      )
    ).toBeNull()
  })

  it("says nothing for metrics or trackers profile reading cannot help with", () => {
    expect(profileReadingHint(latteam, "uploadedBytes")).toBeNull()
    expect(profileReadingHint(latteam, null)).toBeNull()
    expect(profileReadingHint({ registrySlug: "aither" }, "seedSizeBytes")).toBeNull()
    expect(profileReadingHint({ registrySlug: null }, "seedSizeBytes")).toBeNull()
  })
})

describe("ladderUsesProfileMetrics", () => {
  it("finds seed conditions anywhere on a ladder", () => {
    expect(ladderUsesProfileMetrics(getTrackerBySlug("latteam")?.userClasses ?? [])).toBe(true)
    expect(ladderUsesProfileMetrics(getTrackerBySlug("torrentleech")?.userClasses ?? [])).toBe(
      false
    )
    expect(ladderUsesProfileMetrics([])).toBe(false)
  })
})
