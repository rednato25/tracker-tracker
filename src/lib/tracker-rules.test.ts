// src/lib/tracker-rules.test.ts
//
// P03 acceptance: missing, zero and stale are distinct; an account ratio never
// decides torrent satisfaction by itself; a manual login marker is not an
// automatic login; contradictory sources resolve explicitly.

import { describe, expect, it } from "vitest"
import type { TrackerRules } from "@/data/tracker-registry"
import { resolveSatisfaction } from "@/lib/satisfaction"
import { resolveAccountRatio, resolveTrackerRules } from "@/lib/tracker-rules"

const NOW = new Date("2026-01-02T00:00:00.000Z")

function rules(overrides: Partial<TrackerRules> = {}): TrackerRules {
  return { minimumRatio: 0, seedTimeHours: 0, loginIntervalDays: 0, ...overrides }
}

describe("resolveTrackerRules", () => {
  it("keeps an absent rule set unknown instead of inventing zeros", () => {
    const resolved = resolveTrackerRules(undefined)
    expect(resolved.requiredAccountRatio).toBeNull()
    expect(resolved.requiredTorrentRatio).toBeNull()
    expect(resolved.seedTimeHours).toBeNull()
    expect(resolved.satisfactionMode).toBeNull()
    expect(resolved.loginIntervalDays).toBeNull()
    expect(resolved.provenance.accountRatio).toEqual({
      source: "unknown",
      verifiedAt: null,
      timestampKind: "unknown",
      freshness: "unknown",
    })
  })

  it("preserves an explicit manual confirmation instead of inventing a date", () => {
    const resolved = resolveTrackerRules(
      rules({
        minimumRatio: 1,
        provenance: {
          accountRatio: {
            source: "manual",
            verifiedAt: "2026-01-01T00:00:00.000Z",
            timestampKind: "metric",
            freshness: "fresh",
          },
        },
      })
    )
    expect(resolved.provenance.accountRatio).toMatchObject({
      source: "manual",
      verifiedAt: "2026-01-01T00:00:00.000Z",
      timestampKind: "metric",
      freshness: "fresh",
    })
    expect(resolved.provenance.torrentRatio).toMatchObject({
      source: "unknown",
      verifiedAt: null,
    })
  })

  it("distinguishes a known zero from an unknown requirement", () => {
    const zero = resolveTrackerRules(rules({ minimumRatio: 0 }))
    expect(zero.requiredAccountRatio).toBe(0)
    expect(zero.requiredTorrentRatio).toBeNull()

    const unknown = resolveTrackerRules(rules({ requiredAccountRatio: null }))
    expect(unknown.requiredAccountRatio).toBeNull()
    expect(unknown.provenance.accountRatio.note).toMatch(/Explicitly unknown/)
  })

  it("maps legacy minimumRatio to account only unless a mode was declared", () => {
    const accountOnly = resolveTrackerRules(rules({ minimumRatio: 1.0 }))
    expect(accountOnly.requiredAccountRatio).toBe(1.0)
    expect(accountOnly.requiredTorrentRatio).toBeNull()

    const legacyMode = resolveTrackerRules(
      rules({ minimumRatio: 1.0, seedTimeHours: 240, satisfactionMode: "any" })
    )
    expect(legacyMode.requiredAccountRatio).toBe(1.0)
    expect(legacyMode.requiredTorrentRatio).toBe(1.0)
    expect(legacyMode.provenance.torrentRatio.note).toMatch(/Legacy minimumRatio/)
  })

  it("uses explicit ratios over the legacy field", () => {
    const resolved = resolveTrackerRules(
      rules({
        minimumRatio: 0.5,
        requiredAccountRatio: 1.5,
        requiredTorrentRatio: 2,
        seedTimeHours: 48,
        satisfactionMode: "all",
      })
    )
    expect(resolved.requiredAccountRatio).toBe(1.5)
    expect(resolved.requiredTorrentRatio).toBe(2)
    expect(resolved.satisfactionMode).toBe("all")
  })

  it("treats an explicit zero torrent ratio as no ratio route", () => {
    const resolved = resolveTrackerRules(
      rules({ requiredTorrentRatio: 0, seedTimeHours: 48, satisfactionMode: "all" })
    )
    expect(resolved.requiredTorrentRatio).toBe(0)
    expect(resolveSatisfaction(rules({ requiredTorrentRatio: 0, seedTimeHours: 48 }))).toEqual({
      requiredSeedSeconds: 48 * 3600,
      requiredRatio: null,
      mode: "all",
    })
  })

  it("lets a live account ratio win over the registry, including zero", () => {
    const live = resolveTrackerRules(rules({ minimumRatio: 1.0 }), {
      liveRequiredAccountRatio: 0,
      snapshotAt: "2026-01-01T12:00:00.000Z",
      now: NOW,
    })
    expect(live.requiredAccountRatio).toBe(0)
    expect(live.provenance.accountRatio).toMatchObject({
      source: "api",
      timestampKind: "snapshot",
      freshness: "fresh",
      verifiedAt: null,
    })

    const fallback = resolveTrackerRules(rules({ minimumRatio: 1.0 }), {
      liveRequiredAccountRatio: null,
    })
    expect(fallback.requiredAccountRatio).toBe(1.0)
  })

  it("marks an old snapshot stale without claiming a per-metric timestamp", () => {
    const resolved = resolveTrackerRules(rules({ minimumRatio: 0.5 }), {
      snapshotAt: "2025-12-20T00:00:00.000Z",
      now: NOW,
    })
    expect(resolved.provenance.accountedTransfer).toMatchObject({
      source: "snapshot",
      timestampKind: "snapshot",
      freshness: "stale",
      verifiedAt: null,
    })
    expect(resolved.provenance.accountedTransfer.note).toMatch(/not an independent/)
  })

  it("keeps a tracker without a ratio seed-only", () => {
    const resolved = resolveTrackerRules(
      rules({ requiredAccountRatio: null, requiredTorrentRatio: null, seedTimeHours: 72 })
    )
    expect(resolved.requiredAccountRatio).toBeNull()
    expect(resolved.requiredTorrentRatio).toBeNull()
    expect(resolved.satisfactionMode).toBe("all")
    expect(resolveSatisfaction(rules({ seedTimeHours: 72 }))).toEqual({
      requiredSeedSeconds: 72 * 3600,
      requiredRatio: null,
      mode: "all",
    })
  })

  it("does not turn a snapshot or API poll into a website login", () => {
    const noLogin = resolveTrackerRules(rules({ loginIntervalDays: 30 }), {
      snapshotAt: "2026-01-01T23:00:00.000Z",
      now: NOW,
      loginLastAccessAt: null,
    })
    expect(noLogin.loginIntervalDays).toBe(30)
    expect(noLogin.loginEvidence).toBe("none")
    expect(noLogin.provenance.login.note).toMatch(/does not prove/)

    const manual = resolveTrackerRules(rules({ loginIntervalDays: 30 }), {
      loginLastAccessAt: "2026-01-01",
    })
    expect(manual.loginEvidence).toBe("manual")
    expect(manual.provenance.login.note).toMatch(/Manual login marker/)
  })

  it("resolves account ratio without consulting torrent rules", () => {
    expect(resolveAccountRatio(0.8, rules({ requiredTorrentRatio: 2 }))).toBe(0.8)
    expect(resolveAccountRatio(null, rules({ minimumRatio: 1 }))).toBe(1)
    expect(resolveAccountRatio(undefined, rules({ requiredAccountRatio: null }))).toBeNull()
  })

  it("keeps an account ratio from satisfying a torrent on its own", () => {
    const accountOnly = resolveSatisfaction(rules({ minimumRatio: 2.0, seedTimeHours: 0 }))
    expect(accountOnly).toBeNull()

    const explicit = resolveSatisfaction(
      rules({ requiredAccountRatio: 2.0, requiredTorrentRatio: 2.0, seedTimeHours: 0 })
    )
    expect(explicit).toEqual({
      requiredSeedSeconds: null,
      requiredRatio: 2.0,
      mode: "all",
    })
  })
})
