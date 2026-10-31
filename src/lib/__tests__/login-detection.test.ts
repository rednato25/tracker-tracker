import { describe, expect, it } from "vitest"
import { canDetectLogin, loginDetectingPlatformLabels, loginSourceFor } from "@/lib/login-detection"

describe("canDetectLogin", () => {
  it("recognises adapters that report a last-access date", () => {
    for (const platform of [
      "unit3d",
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
    ]) {
      expect(canDetectLogin(platform)).toBe(true)
    }
  })

  it("flags adapters that never report a last-access date", () => {
    for (const platform of [
      "mam",
      "btn",
      "iptorrents",
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
    expect(
      loginSourceFor({
        lastAccessAt: "2026-10-20",
        lastAccessSource: "manual",
        platformType: "unit3d",
      })
    ).toBe("manual")
    expect(
      loginSourceFor({
        lastAccessAt: "2026-10-20",
        lastAccessSource: "detected",
        platformType: "mam",
      })
    ).toBe("detected")
    expect(
      loginSourceFor({ lastAccessAt: null, lastAccessSource: "manual", platformType: "mam" })
    ).toBe("none")
  })

  it("falls back to adapter capability for rows written before the source column", () => {
    expect(
      loginSourceFor({ lastAccessAt: "2026-10-20", platformType: "unit3d" })
    ).toBe("detected")
    expect(
      loginSourceFor({ lastAccessAt: "2026-10-20", platformType: "mam" })
    ).toBe("manual")
  })
})

describe("loginDetectingPlatformLabels", () => {
  it("lists every adapter that reports a last-access value", () => {
    expect(loginDetectingPlatformLabels()).toEqual([
      "AvistaZ",
      "CarPT",
      "DigitalCore",
      "FileList",
      "Gazelle",
      "GazelleGames",
      "M-Team",
      "Nebulance",
      "Portugas",
      "RetroToon",
      "Tr4ker",
      "Unit3D",
    ])
  })
})