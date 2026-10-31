// src/components/dashboard/__tests__/RankProgress.test.tsx
//
// P47 progression rows. The detail page shows one row per earned ladder or
// path, the shared start once, per-class met counts and target selection with
// Undo. Staff and off-ladder classes stay hidden until asked for.

import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { RankProgress } from "@/components/dashboard/RankProgress"
import type { TrackerRankPath, TrackerUserClass } from "@/data/tracker-registry"
import type { RankObservationMap } from "@/lib/rank-goals"
import { checkAnniversaryMilestone } from "@/lib/tracker-events"
import type { Snapshot } from "@/types/api"

const classes: TrackerUserClass[] = [
  { name: "Leech", requirements: "Ratio below 0.4", outsideLadder: "below" },
  {
    name: "User",
    requirements: "Ratio at or above 0.4",
    structured: {
      mode: "all",
      conditions: [
        {
          kind: "numeric",
          id: "user-ratio",
          metric: "accountRatio",
          comparison: "gte",
          requiredValue: 0.4,
          label: "Ratio at or above 0.4",
        },
      ],
    },
  },
  {
    name: "Power User",
    requirements: "1 TiB uploaded",
    structured: {
      mode: "all",
      conditions: [
        {
          kind: "numeric",
          id: "power-upload",
          metric: "uploadedBytes",
          comparison: "gte",
          requiredValue: 1024 ** 4,
          label: "At least 1 TiB uploaded",
        },
      ],
    },
  },
  { name: "Uploader", requirements: "Staff", outsideLadder: "above" },
]

const observations: RankObservationMap = {
  accountRatio: { value: 1.2, freshness: "fresh", source: "api" },
  uploadedBytes: { value: 2 * 1024 ** 4, freshness: "fresh", source: "api" },
}

const uploadcx: TrackerUserClass[] = [
  { name: "Leech", requirements: "Ratio below 0.6", outsideLadder: "below" },
  { name: "User", requirements: "Ratio at or above 0.6" },
  {
    name: "Seeder",
    path: "seed",
    structured: {
      mode: "all",
      conditions: [
        {
          kind: "numeric",
          id: "seeder-upload",
          metric: "uploadedBytes",
          comparison: "gte",
          requiredValue: 10 * 1024 ** 4,
          label: "At least 10 TiB uploaded",
        },
        {
          kind: "numeric",
          id: "seeder-size",
          metric: "seedSizeBytes",
          comparison: "gte",
          requiredValue: 5 * 1024 ** 4,
          label: "Seed size at least 5 TiB",
        },
      ],
    },
  },
  { name: "Sharer", path: "upload-count" },
  { name: "Adept", path: "combined" },
  { name: "Parked", requirements: "Staff-assigned", outsideLadder: "below" },
  { name: "Uploader", requirements: "Staff", outsideLadder: "above" },
  { name: "Moderator", requirements: "Staff", outsideLadder: "above" },
]

const uploadcxPaths: TrackerRankPath[] = [
  { id: "seed", label: "Seed ladder", description: "Upload, ratio and seed size" },
  { id: "upload-count", label: "Upload-count ladder", description: "Uploaded torrents" },
  { id: "combined", label: "Combined ladder", description: "Every seed condition plus uploads" },
]

const baseSnapshot: Snapshot = {
  polledAt: "2026-08-13T12:00:00.000Z",
  ratio: null,
  ratioIsInfinite: false,
  uploadedBytes: "0",
  downloadedBytes: "0",
  bufferBytes: "0",
  seedingCount: null,
  leechingCount: null,
  requiredRatio: null,
  warned: null,
  freeleechTokens: null,
  hitAndRuns: null,
  seedbonus: null,
  shareScore: null,
  username: null,
  group: null,
  isManual: false,
}

function renderPills(currentRank: string) {
  return render(
    <RankProgress
      userClasses={classes}
      currentRank={currentRank}
      snapshots={[]}
      observations={observations}
    />
  )
}

describe("RankProgress rows", () => {
  it("renders one left-aligned row for a single ladder", () => {
    const { container } = renderPills("User")
    expect(container.querySelectorAll("[data-rank-ladder-row]")).toHaveLength(1)
    expect(screen.getByText("Class ladder")).toBeInTheDocument()
    expect(container.querySelector("[data-rank-progression]")).toBeInTheDocument()
  })

  it("shows x/y met and counts unknown conditions separately", () => {
    render(
      <RankProgress
        userClasses={uploadcx}
        rankPaths={uploadcxPaths}
        currentRank="User"
        snapshots={[]}
          observations={{
          uploadedBytes: { value: 12 * 1024 ** 4, freshness: "fresh", source: "api" },
        }}
      />
    )
    expect(screen.getByText("1/2 met")).toBeInTheDocument()
    expect(screen.getByText(/1 unknown/)).toBeInTheDocument()
  })

  it("shows the shared start once instead of repeating it on every path", () => {
    const { container } = render(
      <RankProgress
        userClasses={uploadcx}
        rankPaths={uploadcxPaths}
        currentRank="User"
        snapshots={[]}
        />
    )
    expect(container.querySelector("[data-rank-shared-start]")).toBeInTheDocument()
    expect(screen.getAllByText("User")).toHaveLength(1)
    expect(container.querySelectorAll("[data-rank-ladder-row]")).toHaveLength(3)
  })

  it("highlights the current class and outlines the saved target", () => {
    const { container } = render(
      <RankProgress
        userClasses={classes}
        currentRank="User"
        savedTargetRank="Power User"
        snapshots={[]}
          observations={observations}
      />
    )
    const current = container.querySelector('[data-rank-class="User"]')
    const target = container.querySelector('[data-rank-class="Power User"]')
    expect(current).toHaveAttribute("data-current-class", "true")
    expect(target).toHaveAttribute("data-target-class", "true")
    expect(target?.className).toContain("outline")
  })

  it("saves a clicked class as the target and offers Undo", async () => {
    const user = userEvent.setup()
    const onSetTarget = vi.fn().mockResolvedValue(undefined)
    render(
      <RankProgress
        userClasses={classes}
        currentRank="User"
        snapshots={[]}
          observations={observations}
        onSetTarget={onSetTarget}
      />
    )
    await user.click(screen.getByRole("button", { name: /^Power User:/ }))
    expect(onSetTarget).toHaveBeenCalledWith("Power User")
    expect(screen.getByText(/Target set to/)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Undo" }))
    expect(onSetTarget).toHaveBeenLastCalledWith(null)
  })

  it("hides staff and off-ladder classes behind Show all classes", async () => {
    const user = userEvent.setup()
    render(
      <RankProgress
        userClasses={uploadcx}
        rankPaths={uploadcxPaths}
        currentRank="User"
        snapshots={[]}
        />
    )
    expect(screen.queryByText("Uploader")).not.toBeInTheDocument()
    expect(screen.queryByText("Parked")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Show all classes" }))
    expect(screen.getByText("Uploader")).toBeInTheDocument()
    expect(screen.getByText("Parked")).toBeInTheDocument()
  })

  it("keeps the anniversary marker out of the progression section", () => {
    const joined = new Date()
    joined.setMonth(joined.getMonth() - 1)
    const joinedAt = `${joined.getFullYear()}-${String(joined.getMonth() + 1).padStart(2, "0")}-${String(joined.getDate()).padStart(2, "0")}`
    expect(checkAnniversaryMilestone(joinedAt)).not.toBeNull()
    render(
      <RankProgress
        userClasses={classes}
        currentRank="User"
        snapshots={[]}
          joinedAt={joinedAt}
      />
    )
    expect(screen.queryByText("1 month anniversary")).not.toBeInTheDocument()
  })

  it("does not overflow horizontally at 390px", () => {
    const { container } = render(
      <RankProgress
        userClasses={uploadcx}
        rankPaths={uploadcxPaths}
        currentRank="User"
        snapshots={[]}
        />
    )
    const rows = container.querySelector("[data-rank-progression]")
    expect(rows?.className).not.toContain("overflow-x-auto")
  })
})

function renderChange(from: string, to: string) {
  return render(
    <RankProgress
      userClasses={uploadcx}
      currentRank={null}
      snapshots={[
        { ...baseSnapshot, group: from },
        { ...baseSnapshot, polledAt: "2026-08-14T12:00:00.000Z", group: to },
      ]}
    />
  )
}

const zenithClasses: TrackerUserClass[] = [
  { name: "User" },
  { name: "Explorer" },
  { name: "Bulker", path: "upload" },
  { name: "Force", path: "upload" },
  { name: "Climber", path: "seedsize" },
  { name: "Builder", path: "seedsize" },
]

const zenithPaths: TrackerRankPath[] = [
  { id: "upload", label: "Upload path" },
  { id: "seedsize", label: "Seedsize path" },
]

function renderPathChange(from: string, to: string) {
  return render(
    <RankProgress
      userClasses={zenithClasses}
      rankPaths={zenithPaths}
      currentRank={null}
      snapshots={[
        { ...baseSnapshot, group: from },
        { ...baseSnapshot, polledAt: "2026-08-14T12:00:00.000Z", group: to },
      ]}
    />
  )
}

describe("RankProgress timeline direction", () => {
  it("reads a drop from the top rung into a below state as a demotion", () => {
    const { container } = renderChange("Adept", "Parked")
    expect(container.querySelector('[data-direction="demotion"]')).toBeInTheDocument()
    expect(container.querySelector('[data-direction="promotion"]')).not.toBeInTheDocument()
  })

  it("reads a drop from the first rung into a below state as a demotion", () => {
    const { container } = renderChange("User", "Leech")
    expect(container.querySelector('[data-direction="demotion"]')).toBeInTheDocument()
    expect(container.querySelector('[data-direction="promotion"]')).not.toBeInTheDocument()
  })

  it("reads a move between two above classes as neither promotion nor demotion", () => {
    const { container } = renderChange("Uploader", "Moderator")
    expect(container.querySelector('[data-direction="promotion"]')).not.toBeInTheDocument()
    expect(container.querySelector('[data-direction="demotion"]')).not.toBeInTheDocument()
  })

  it("reads a move from a rung into an above class as neither promotion nor demotion", () => {
    const { container } = renderChange("User", "Uploader")
    expect(container.querySelector('[data-direction="promotion"]')).not.toBeInTheDocument()
    expect(container.querySelector('[data-direction="demotion"]')).not.toBeInTheDocument()
  })

  it("reads a move from the shared prefix into a branch as a promotion", () => {
    const { container } = renderPathChange("Explorer", "Bulker")
    expect(container.querySelector('[data-direction="promotion"]')).toBeInTheDocument()
    expect(container.querySelector('[data-direction="demotion"]')).not.toBeInTheDocument()
  })

  it("reads a drop inside a branch as a demotion", () => {
    const { container } = renderPathChange("Force", "Bulker")
    expect(container.querySelector('[data-direction="demotion"]')).toBeInTheDocument()
    expect(container.querySelector('[data-direction="promotion"]')).not.toBeInTheDocument()
  })

  it("reads a move between branches as neither promotion nor demotion", () => {
    const { container } = renderPathChange("Bulker", "Climber")
    expect(container.querySelector('[data-direction="promotion"]')).not.toBeInTheDocument()
    expect(container.querySelector('[data-direction="demotion"]')).not.toBeInTheDocument()
  })

  it("reads a move from a branch back to the shared prefix as a demotion", () => {
    const { container } = renderPathChange("Bulker", "Explorer")
    expect(container.querySelector('[data-direction="demotion"]')).toBeInTheDocument()
    expect(container.querySelector('[data-direction="promotion"]')).not.toBeInTheDocument()
  })
})
