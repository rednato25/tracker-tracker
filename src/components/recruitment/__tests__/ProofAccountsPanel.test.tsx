import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ProofAccountsPanel } from "@/components/recruitment/ProofAccountsPanel"
import type { TrackerSummary } from "@/types/api"

const NOW = new Date("2026-10-31T12:00:00.000Z")

function tracker(overrides: Partial<TrackerSummary> = {}): TrackerSummary {
  return {
    id: 1,
    name: "TorrentLeech",
    baseUrl: "https://tl.example",
    registrySlug: "torrentleech",
    platformType: "unit3d",
    isActive: true,
    lastPolledAt: "2026-10-26T10:00:00.000Z",
    lastError: null,
    lastErrorAt: null,
    consecutiveFailures: 0,
    pausedAt: null,
    userPausedAt: null,
    color: "#123456",
    qbtTag: null,
    mouseholeUrl: null,
    hasMouseholeToken: false,
    useProxy: false,
    countCrossSeedUnsatisfied: false,
    hideUnreadBadges: false,
    isFavorite: false,
    sortOrder: 1,
    joinedAt: "2024-01-31T12:00:00.000Z",
    lastAccessAt: null,
    remoteUserId: null,
    platformMeta: null,
    createdAt: "2024-01-31T12:00:00.000Z",
    latestStats: {
      ratio: 2.5,
      ratioIsInfinite: false,
      uploadedBytes: "1000000000",
      downloadedBytes: "400000000",
      bufferBytes: "600000000",
      seedingCount: 3,
      leechingCount: 0,
      requiredRatio: 1,
      warned: false,
      freeleechTokens: 0,
      hitAndRuns: 0,
      seedbonus: 100,
      shareScore: null,
      username: "owner",
      group: "Power User",
    },
    ...overrides,
  }
}

const BASE_STATS = tracker().latestStats as NonNullable<TrackerSummary["latestStats"]>

describe("ProofAccountsPanel", () => {
  it("lists every account with class, age, ratio and a profile link", () => {
    const { container } = render(
      <ProofAccountsPanel
        trackers={[
          tracker(),
          tracker({
            id: 2,
            name: "Aither",
            baseUrl: "https://aither.example",
            registrySlug: "aither",
            joinedAt: "2026-08-15T12:00:00.000Z",
            latestStats: {
              ...BASE_STATS,
              ratio: 1.2,
              username: "alice",
              group: "Zeus",
            },
          }),
          tracker({
            id: 3,
            name: "Custom",
            baseUrl: "https://custom.example",
            registrySlug: null,
            joinedAt: "2025-05-15T12:00:00.000Z",
            latestStats: null,
          }),
        ]}
        now={NOW}
      />
    )

    expect(screen.getByRole("heading", { name: "Your proof accounts" })).toBeInTheDocument()
    const rows = [...container.querySelectorAll("[data-proof-account]")]
    expect(rows).toHaveLength(3)

    const tl = container.querySelector('[data-proof-account="1"]') as HTMLElement
    expect(tl).toHaveTextContent("TorrentLeech")
    expect(tl).toHaveTextContent("Power User")
    expect(tl).toHaveTextContent("ratio 2.50x")
    expect(tl.querySelector("[data-proof-profile-link]")).toHaveAttribute(
      "href",
      "https://tl.example/profile/owner"
    )

    const aither = container.querySelector('[data-proof-account="2"]') as HTMLElement
    expect(aither.querySelector("[data-proof-profile-link]")).toHaveAttribute(
      "href",
      "https://aither.example/users/alice"
    )

    const custom = container.querySelector('[data-proof-account="3"]') as HTMLElement
    expect(custom).toHaveTextContent("Unknown class")
    expect(custom.querySelector("[data-proof-profile-link]")).toBeNull()
  })
})
