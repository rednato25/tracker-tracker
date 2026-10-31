import { describe, expect, it } from "vitest"
import { getTrackerBySlug } from "@/data/tracker-registry"
import { compareClassGate } from "@/lib/rank-class-gate"

function classes(slug: string) {
  const entry = getTrackerBySlug(slug)
  if (!entry) throw new Error(`missing registry entry ${slug}`)
  return entry.userClasses
}

describe("compareClassGate", () => {
  it("reads PU as Power User when that class is on the ladder", () => {
    const gate = compareClassGate({
      texts: ["PU: 2 weeks, 5 torrents, 25GB upload, ratio>0.65"],
      classes: classes("redacted"),
      currentClass: "Power User",
    })
    expect(gate).toMatchObject({
      requiredClasses: ["Power User"],
      written: ["PU"],
      currentClass: "Power User",
      status: "met",
    })
  })

  it("shows not yet when the current class is below the named class", () => {
    const gate = compareClassGate({
      texts: ["Elite+: 18 months, 100 uploads, 5 TiB upload, ratio>=2.5"],
      classes: classes("luminarr"),
      currentClass: "Power User",
    })
    expect(gate?.status).toBe("not-yet")
    expect(gate?.detail).toContain("Elite+")
    expect(gate?.detail).toContain("Power User")
  })

  it("meets Elite+ when the current class is above Elite", () => {
    const gate = compareClassGate({
      texts: ["Elite+: 18 months, 100 uploads"],
      classes: classes("luminarr"),
      currentClass: "Archivist",
    })
    expect(gate?.status).toBe("met")
  })

  it("handles an OR gate and accepts a met class", () => {
    const gate = compareClassGate({
      texts: [
        "BluExtremist: 3 months, 20TiB upload, ratio>=0.4, or BluSeeder+: 1 month, 5TiB seedsize",
      ],
      classes: classes("blutopia"),
      currentClass: "BluSeeder",
    })
    expect(gate?.requiredClasses).toEqual(["BluExtremist", "BluSeeder"])
    expect(gate?.status).toBe("met")
  })

  it("prefers the longest class name", () => {
    const gate = compareClassGate({
      texts: ["Elite Torrent Master: 12 months, 100 uploads"],
      classes: classes("luminarr"),
      currentClass: "Elite",
    })
    expect(gate?.requiredClasses).toEqual(["Elite Torrent Master"])
    expect(gate?.status).toBe("not-yet")
  })

  it("returns null when the tracker's ladder is not in the registry", () => {
    const gate = compareClassGate({
      texts: ["Elite+: 6 months"],
      classes: [],
      currentClass: "Power User",
    })
    expect(gate).toBeNull()
  })

  it("returns null when the text names no class", () => {
    const gate = compareClassGate({
      texts: ["Invite forum access", "1TiB seedsize"],
      classes: classes("seedpool"),
      currentClass: "PowerPool",
    })
    expect(gate).toBeNull()
  })

  it("treats an unlisted current class as unknown rather than not yet", () => {
    const gate = compareClassGate({
      texts: ["SuperPool: 6 months, 1TiB seedsize, ratio>=1"],
      classes: classes("seedpool"),
      currentClass: "Mystery Pool",
    })
    expect(gate?.status).toBe("unknown")
    expect(gate?.detail).toContain("not on the registry ladder")
  })

  it("counts a class above the ladder as met", () => {
    const gate = compareClassGate({
      texts: ["PowerPool: 512 GiB seedsize"],
      classes: classes("seedpool"),
      currentClass: "FoundingPool",
    })
    expect(gate?.status).toBe("met")
  })

  it("does not treat a substring of a longer class name as a match", () => {
    const gate = compareClassGate({
      texts: ["PowerPool: 512 GiB seedsize"],
      classes: classes("seedpool"),
      currentClass: "Pool",
    })
    expect(gate?.status).toBe("not-yet")
    expect(gate?.requiredClasses).toEqual(["PowerPool"])
  })
})
