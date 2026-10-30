import { describe, expect, it } from "vitest"
import { buildRankOverviewMarkdown } from "@/lib/rank-markdown"
import { buildRankOverviews } from "@/lib/rank-overview"
import type { TrackerLatestStats, TrackerSummary } from "@/types/api"

const NOW = new Date("2026-10-30T12:00:00.000Z")
const TIB = 1024 ** 4

const BASE_STATS: TrackerLatestStats = {
  ratio: 2.4,
  ratioIsInfinite: false,
  uploadedBytes: String(2 * TIB),
  downloadedBytes: String(1 * TIB),
  bufferBytes: String(1 * TIB),
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

function tracker(overrides: Partial<TrackerSummary> = {}): TrackerSummary {
  return {
    id: 1,
    name: "TorrentLeech",
    baseUrl: "https://tl.invalid",
    registrySlug: "torrentleech",
    platformType: "unit3d",
    isActive: true,
    lastPolledAt: "2026-10-30T11:00:00.000Z",
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
    joinedAt: "2026-01-01T00:00:00.000Z",
    lastAccessAt: null,
    remoteUserId: null,
    platformMeta: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    latestStats: BASE_STATS,
    ...overrides,
  }
}

describe("buildRankOverviewMarkdown", () => {
  it("includes the whole overview, every condition and my check with its note", () => {
    const trackers = [tracker()]
    const overviews = buildRankOverviews(trackers, { "1": { targetRank: "Super User" } }, NOW)
    const markdown = buildRankOverviewMarkdown(overviews, {
      "1": { verdict: "wrong", note: "Site says 200 GiB", checkedAt: "2026-10-30" },
    })

    expect(markdown).toContain("# Rank overview")
    expect(markdown).toContain("Checked 1 \u00b7 Wrong 1 \u00b7 Not checked 0")
    expect(markdown).toContain("## TorrentLeech")
    expect(markdown).toContain("- Current class: Power User")
    expect(markdown).toContain("- Target: Super User (saved target)")
    expect(markdown).toContain(
      "| At least 12 weeks registered | 302 days | 84 days | Met | \u2014 |"
    )
    expect(markdown).toContain(
      "- My check: Wrong \u2014 Site says 200 GiB (checked Oct 30, 2026)"
    )
    expect(markdown).toContain("TorrentLeech Wiki - User Classes")
    expect(markdown).toContain("https://wiki.torrentleech.org/doku.php/user_classes")
    expect(markdown).toContain("Registry text: 12 weeks registered")
  })

  it("escapes pipes and backslashes so the table cannot break", () => {
    const base = buildRankOverviews(
      [tracker()],
      { "1": { targetRank: "Super User" } },
      NOW
    )[0]
    const overview = {
      ...base,
      conditions: [{ ...base.conditions[0], requirement: "A | B \\ C" }],
    }
    const markdown = buildRankOverviewMarkdown([overview], {})
    expect(markdown).toContain("| A \\| B \\\\ C |")
  })

  it("includes unchecked trackers and the no-structured-conditions line", () => {
    const overviews = buildRankOverviews(
      [
        tracker({
          id: 2,
          name: "Aither",
          registrySlug: "aither",
          latestStats: { ...BASE_STATS, group: "Phobos" },
        }),
      ],
      {},
      NOW
    )
    const markdown = buildRankOverviewMarkdown(overviews, {})
    expect(markdown).toContain("Checked 0 \u00b7 Wrong 0 \u00b7 Not checked 1")
    expect(markdown).toContain("- My check: Not checked yet")
    expect(markdown).toContain("- Conditions: No structured conditions published")
  })
})
