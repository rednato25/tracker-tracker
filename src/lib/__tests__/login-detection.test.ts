import { describe, expect, it } from "vitest"
import { canDetectLogin } from "@/lib/login-detection"

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
