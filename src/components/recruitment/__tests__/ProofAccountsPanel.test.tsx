import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ProofAccountsPanel } from "@/components/recruitment/ProofAccountsPanel"
import type { TrackerSummary } from "@/types/api"

const NOW = new Date("2026-10-31T12:00:00.000Z")

let clipboardStub: { writeText: ReturnType<typeof vi.fn> }

function installClipboardStub() {
  Object.defineProperty(navigator, "clipboard", {
    value: clipboardStub,
    configurable: true,
    writable: true,
  })
}

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

const aither = tracker({
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
})

beforeEach(() => {
  clipboardStub = { writeText: vi.fn().mockResolvedValue(undefined) }
  installClipboardStub()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("ProofAccountsPanel", () => {
  it("lists every account with class, age, ratio and a profile link", () => {
    const { container } = render(
      <ProofAccountsPanel
        trackers={[
          tracker(),
          aither,
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
        requirementTexts={[]}
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

    const aitherRow = container.querySelector('[data-proof-account="2"]') as HTMLElement
    expect(aitherRow.querySelector("[data-proof-profile-link]")).toHaveAttribute(
      "href",
      "https://aither.example/users/alice"
    )

    const custom = container.querySelector('[data-proof-account="3"]') as HTMLElement
    expect(custom).toHaveTextContent("Unknown class")
    expect(custom.querySelector("[data-proof-profile-link]")).toBeNull()
  })

  it("prefills the age filter from the route and dates the next qualifying account", () => {
    const { container } = render(
      <ProofAccountsPanel
        trackers={[tracker(), aither]}
        now={NOW}
        requirementTexts={["3x 6 months old profile links"]}
      />
    )

    const ageFilter = screen.getByLabelText("Minimum account age (months)")
    expect(ageFilter).toHaveValue(6)
    expect(screen.getByLabelText("Minimum ratio")).toHaveValue(0)

    const requirement = container.querySelector("[data-proof-requirement]") as HTMLElement
    expect(requirement).toHaveTextContent("3 needed")
    expect(requirement).toHaveTextContent("1 qualifies now")
    expect(requirement).toHaveTextContent(/next on [A-Z][a-z]{2} \d{1,2}, \d{4}/)

    const tl = container.querySelector('[data-proof-account="1"]') as HTMLElement
    expect(tl).toHaveAttribute("data-qualifies", "true")
    expect(tl).toHaveTextContent("Qualifies")

    const young = container.querySelector('[data-proof-account="2"]') as HTMLElement
    expect(young).toHaveAttribute("data-qualifies", "false")
    expect(young).toHaveTextContent(/Qualifies in \d+ days/)

    fireEvent.change(ageFilter, { target: { value: "0" } })
    expect(requirement).toHaveTextContent("2 qualify now")
    expect(container.querySelector('[data-proof-account="2"]')).toHaveAttribute(
      "data-qualifies",
      "true"
    )
  })

  it("filters on ratio and marks accounts that fail it", () => {
    const { container } = render(
      <ProofAccountsPanel trackers={[tracker(), aither]} now={NOW} requirementTexts={[]} />
    )

    fireEvent.change(screen.getByLabelText("Minimum ratio"), { target: { value: "2" } })

    const tl = container.querySelector('[data-proof-account="1"]') as HTMLElement
    expect(tl).toHaveAttribute("data-qualifies", "true")
    const young = container.querySelector('[data-proof-account="2"]') as HTMLElement
    expect(young).toHaveAttribute("data-qualifies", "false")
    expect(within(young).getByText(/Ratio below 2x/)).toBeInTheDocument()
  })

  it("copies a Markdown summary of the qualifying accounts only", async () => {
    render(<ProofAccountsPanel trackers={[tracker(), aither]} now={NOW} requirementTexts={[]} />)

    fireEvent.click(screen.getByRole("button", { name: "Copy application summary" }))

    await waitFor(() => expect(clipboardStub.writeText).toHaveBeenCalledTimes(1))
    const markdown = clipboardStub.writeText.mock.calls[0]?.[0] as string
    expect(markdown).toContain("**TorrentLeech** — Power User")
    expect(markdown).toContain("member since Jan 31, 2024")
    expect(markdown).toContain("ratio 2.50x")
    expect(markdown).toContain("https://tl.example/profile/owner")
    expect(markdown).toContain("**Aither** — Zeus")
    expect(markdown).not.toMatch(/token|cookie|passkey/i)
    expect(markdown).not.toMatch(/@/)
    expect(screen.getByRole("status")).toHaveTextContent("Copied application summary.")
  })

  it("does not offer a summary when nothing qualifies", () => {
    render(<ProofAccountsPanel trackers={[tracker()]} now={NOW} requirementTexts={[]} />)

    fireEvent.change(screen.getByLabelText("Minimum ratio"), { target: { value: "9" } })

    expect(screen.getByRole("button", { name: "Copy application summary" })).toBeDisabled()
  })
})
