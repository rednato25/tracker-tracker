import { describe, expect, it } from "vitest"
import { getTrackerBySlug } from "@/data/tracker-registry"
import {
  ladderUsesProfileMetrics,
  PROFILE_HINT_ADD_COOKIE,
  PROFILE_HINT_EXPIRED,
  PROFILE_HINT_PAGE_CHANGED,
  PROFILE_HINT_TURN_ON,
  PROFILE_HINT_WAITING,
  profileReadAgeText,
  profileReadingHint,
  profileReadingStaleNotice,
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

describe("profileReadingStaleNotice", () => {
  const now = new Date("2026-11-17T12:00:00.000Z")
  const stale = (extra: Record<string, unknown> = {}) =>
    JSON.stringify({
      profileRead: {
        fetchedAt: "2026-11-02T12:00:00.000Z",
        attemptedAt: "2026-11-17T11:00:00.000Z",
        status: null,
        values: { seedSizeBytes: 1 },
        ...extra,
      },
    })
  const tracker = {
    registrySlug: "onlyencodes",
    profileReadingEnabled: true,
    hasProfileCookie: true,
  }

  it("names the failure and the age of the last successful read", () => {
    const notice = profileReadingStaleNotice(
      {
        ...tracker,
        platformMeta: stale({ message: "Cloudflare challenge detected on OnlyEncodes" }),
      },
      now
    )
    expect(notice).toContain("The last profile read failed.")
    expect(notice).toContain("Cloudflare challenge blocked the request.")
    expect(notice).toContain("15 days ago")
    expect(notice).toContain("session cookie")
  })

  it("says only that the last read is old when no failure was stored", () => {
    const notice = profileReadingStaleNotice({ ...tracker, platformMeta: stale() }, now)
    expect(notice).toBe(
      "The last profile read was 15 days ago, so the values below may be out of date. Save this tracker's settings to try again."
    )
  })

  it("stays quiet while the read is fresh or a stop notice already explains it", () => {
    expect(
      profileReadingStaleNotice(
        {
          ...tracker,
          platformMeta: read({
            fetchedAt: "2026-11-17T00:00:00.000Z",
            attemptedAt: "2026-11-17T00:00:00.000Z",
            status: null,
            values: {},
          }),
        },
        now
      )
    ).toBeNull()
    expect(
      profileReadingStaleNotice(
        { ...tracker, platformMeta: stale({ status: "session_expired" }) },
        now
      )
    ).toBeNull()
  })

  it("stays quiet when the turn-on or add-cookie hints already cover the tracker", () => {
    expect(
      profileReadingStaleNotice(
        { ...tracker, profileReadingEnabled: false, platformMeta: stale() },
        now
      )
    ).toBeNull()
    expect(
      profileReadingStaleNotice({ ...tracker, hasProfileCookie: false, platformMeta: stale() }, now)
    ).toBeNull()
  })

  it("formats hours and days in plain words", () => {
    expect(profileReadAgeText("2026-11-17T11:30:00.000Z", now)).toBe("less than an hour ago")
    expect(profileReadAgeText("2026-11-17T09:00:00.000Z", now)).toBe("3 hours ago")
    expect(profileReadAgeText("2026-11-16T12:00:00.000Z", now)).toBe("1 day ago")
    expect(profileReadAgeText("2026-11-02T12:00:00.000Z", now)).toBe("15 days ago")
  })
})
