// src/components/dashboard/__tests__/TrackerChecksStrip.test.tsx

import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { TrackerChecksStrip } from "@/components/dashboard/TrackerChecksStrip"
import { getTrackerChecks, readLoginWindow, type TrackerChecks } from "@/lib/tracker-checks"
import type { TrackerSummary } from "@/types/api"

const NOW = new Date("2026-10-28T12:00:00.000Z")
const GIB = 1024 ** 3

function stats() {
  return {
    ratio: 15.13,
    ratioIsInfinite: false,
    uploadedBytes: String(16 * GIB),
    downloadedBytes: String(GIB),
    bufferBytes: String(Math.round(84.63 * GIB)),
    seedingCount: 8,
    leechingCount: 1,
    requiredRatio: 1,
    warned: false,
    freeleechTokens: 0,
    hitAndRuns: 0,
    seedbonus: 1234,
    shareScore: null,
    username: "owner",
    group: "Power User",
  }
}

function tracker(overrides: Partial<TrackerSummary> = {}): TrackerSummary {
  return {
    id: 1,
    name: "TorrentLeech",
    baseUrl: "https://tl.invalid",
    registrySlug: "myanonamouse",
    platformType: "mam",
    isActive: true,
    lastPolledAt: "2026-10-28T11:00:00.000Z",
    lastError: null,
    lastErrorAt: null,
    consecutiveFailures: 0,
    pausedAt: null,
    userPausedAt: null,
    color: "#6d56eb",
    qbtTag: null,
    mouseholeUrl: null,
    hasMouseholeToken: false,
    useProxy: false,
    countCrossSeedUnsatisfied: false,
    hideUnreadBadges: false,
    isFavorite: false,
    sortOrder: 1,
    joinedAt: "2025-01-01T00:00:00.000Z",
    lastAccessAt: "2026-08-29",
    remoteUserId: null,
    platformMeta: null,
    createdAt: "2025-01-01T00:00:00.000Z",
    latestStats: stats(),
    ...overrides,
  }
}

function checksFor(source: TrackerSummary): TrackerChecks {
  return getTrackerChecks(source, readLoginWindow(source, NOW))
}

function triggers(container: HTMLElement): Element[] {
  return Array.from(container.querySelectorAll('[aria-hidden="true"] > span'))
}

async function expectTooltip(checks: TrackerChecks, index: number, expected: string) {
  const user = userEvent.setup()
  const { container, unmount } = render(<TrackerChecksStrip checks={checks} />)
  const trigger = triggers(container)[index]
  if (!trigger) throw new Error(`segment ${index} not found`)

  await user.hover(trigger)

  expect(screen.getByRole("tooltip")).toHaveTextContent(expected)
  unmount()
}

describe("TrackerChecksStrip tooltips", () => {
  it("names each passing check with its value and state", async () => {
    const checks = checksFor(tracker())

    await expectTooltip(checks, 0, "Ratio 15.13 (minimum 1.0) \u00b7 OK")
    await expectTooltip(checks, 1, "Buffer +84.63 GiB \u00b7 OK")
    await expectTooltip(checks, 2, "Seeding 8 torrents \u00b7 OK")
    await expectTooltip(checks, 3, "Login due in 60 days \u00b7 OK")
  })

  it("names the failure behind a critical check", async () => {
    const checks = checksFor(
      tracker({
        lastAccessAt: "2026-06-25",
        latestStats: {
          ...stats(),
          ratio: 0.5,
          bufferBytes: String(-1 * GIB),
          seedingCount: 0,
        },
      })
    )

    await expectTooltip(checks, 0, "Ratio 0.50 (minimum 1.0) \u00b7 Critical")
    await expectTooltip(checks, 1, "Buffer -1.00 GiB \u00b7 Critical")
    await expectTooltip(checks, 2, "Seeding 0 torrents \u00b7 Critical")
    await expectTooltip(checks, 3, "Login overdue by 5 days \u00b7 Critical")
  })

  it("says why a gray segment is unknown", async () => {
    const checks = checksFor(
      tracker({
        registrySlug: null,
        lastAccessAt: null,
        latestStats: { ...stats(), seedingCount: null },
      })
    )

    await expectTooltip(checks, 2, "No seeding data")
    await expectTooltip(checks, 3, "No login rule")
  })

  it("explains an all-gray strip when there are no stats yet", async () => {
    const checks = checksFor(tracker({ latestStats: null }))

    await expectTooltip(checks, 0, "No stats yet")
    await expectTooltip(checks, 3, "No stats yet")
  })
})
