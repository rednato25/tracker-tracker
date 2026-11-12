import { describe, expect, it } from "vitest"
import { canDetectLogin, loginDetectionNote, loginSourceFor } from "@/lib/login-detection"

describe("canDetectLogin", () => {
  it("recognises adapters that report a last-access date", () => {
    for (const platform of [
      "apime",
      "iptorrents",
      "luminance",
      "teamhd",
      "gazelle",
      "ggn",
      "nebulance",
      "avistaz",
      "digitalcore",
      "filelist",
      "mteam",
      "portugas",
      "carpt",
      "retrotoon",
      "tr4ker",
      "czteam",
    ]) {
      expect(canDetectLogin(platform)).toBe(true)
    }
  })

  it("flags adapters that never report a last-access date", () => {
    for (const platform of [
      "mam",
      "btn",
      "unit3d",
      "torrentleech",
      "hawke",
      "c411",
      "v3x",
      "custom",
    ]) {
      expect(canDetectLogin(platform)).toBe(false)
    }
  })
})

describe("loginSourceFor", () => {
  it("uses the stored source instead of guessing from the platform", () => {
    expect(loginSourceFor({ lastAccessAt: "2026-10-20", lastAccessSource: "manual" })).toBe(
      "manual"
    )
    expect(loginSourceFor({ lastAccessAt: "2026-10-20", lastAccessSource: "detected" })).toBe(
      "detected"
    )
    expect(loginSourceFor({ lastAccessAt: null, lastAccessSource: "manual" })).toBe("none")
  })

  it("treats a legacy row with no stored source as manual", () => {
    expect(loginSourceFor({ lastAccessAt: "2026-10-20" })).toBe("manual")
  })
})

describe("loginDetectionNote", () => {
  it("says a detecting platform updates on its own", () => {
    expect(loginDetectionNote({ platformType: "filelist" })).toMatch(/updates on its own/)
  })

  it("points a UNIT3D tracker with profile reading at that setting", () => {
    expect(
      loginDetectionNote({ platformType: "unit3d", registrySlug: "latteam", profileReadingEnabled: false })
    ).toMatch(/Read profile page daily/)
    expect(
      loginDetectionNote({ platformType: "unit3d", registrySlug: "latteam", profileReadingEnabled: true })
    ).toBe("Read from your profile page each day.")
  })

  it("asks for a manual mark where nothing reports a login", () => {
    expect(loginDetectionNote({ platformType: "unit3d", registrySlug: "aither" })).toBe(
      "This tracker doesn't report logins, so mark them here."
    )
    expect(loginDetectionNote({ platformType: "mam" })).toBe(
      "This tracker doesn't report logins, so mark them here."
    )
  })
})
