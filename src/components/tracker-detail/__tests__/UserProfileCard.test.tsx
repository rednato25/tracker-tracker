import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { UserProfileCard } from "@/components/tracker-detail/UserProfileCard"
import type { TrackerLatestStats, TrackerSummary } from "@/types/api"

const joined = new Date()
joined.setMonth(joined.getMonth() - 1)
const joinedAt = `${joined.getFullYear()}-${String(joined.getMonth() + 1).padStart(2, "0")}-${String(joined.getDate()).padStart(2, "0")}`

const tracker: TrackerSummary = {
  id: 1,
  name: "Upload.cx",
  baseUrl: "https://upload.cx",
  registrySlug: "uploadcx",
  platformType: "unit3d",
  isActive: true,
  lastPolledAt: new Date().toISOString(),
  lastError: null,
  lastErrorAt: null,
  consecutiveFailures: 0,
  pausedAt: null,
  userPausedAt: null,
  color: "#538dab",
  qbtTag: null,
  mouseholeUrl: null,
  hasMouseholeToken: false,
  useProxy: false,
  countCrossSeedUnsatisfied: false,
  hideUnreadBadges: false,
  isFavorite: false,
  sortOrder: 1,
  joinedAt,
  lastAccessAt: null,
  remoteUserId: null,
  platformMeta: null,
  createdAt: joinedAt,
  latestStats: null,
}

const stats: TrackerLatestStats = {
  ratio: 1,
  ratioIsInfinite: false,
  seedingCount: 0,
  leechingCount: 0,
  requiredRatio: 0.6,
  warned: false,
  freeleechTokens: null,
  hitAndRuns: 0,
  seedbonus: 0,
  shareScore: null,
  username: "member",
  group: "User",
  uploadedBytes: "0",
  downloadedBytes: "0",
  bufferBytes: "0",
}

describe("UserProfileCard anniversary marker", () => {
  it("moves the anniversary marker out of rank progression and beside the join date", () => {
    render(
      <UserProfileCard tracker={tracker} stats={stats} registryEntry={undefined} accentColor="#538dab" />
    )
    const marker = screen.getByText("1 month anniversary")
    expect(marker).toBeInTheDocument()
    expect(marker.closest("[data-anniversary-marker]")).not.toBeNull()
  })
})
