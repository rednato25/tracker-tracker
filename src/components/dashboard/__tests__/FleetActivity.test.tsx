// src/components/dashboard/__tests__/FleetActivity.test.tsx
//
// P51: fleet deltas and torrent movers must not imply a single bonus currency,
// must name the download client, and must disappear when no client exists.

import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { FleetBonusChanges } from "@/components/dashboard/FleetBonusChanges"
import { FleetHeadline } from "@/components/dashboard/FleetHeadline"
import { MoversAndShakers } from "@/components/dashboard/MoversAndShakers"
import { TodayAtAGlance } from "@/components/dashboard/TodayAtAGlance"
import type { TodayAtAGlance as TodayData } from "@/types/api"

// MarqueeText builds a ResizeObserver in an effect and jsdom has none.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}

function fleet(): TodayData["fleet"] {
  return {
    uploadDelta: String(2n * 1024n ** 3n),
    downloadDelta: String(1024n ** 3n),
    bufferDelta: String(1024n ** 3n),
    ratioChange: 0.25,
    uploadDeltaYesterday: null,
    downloadDeltaYesterday: null,
    bufferDeltaYesterday: null,
  }
}

function data(overrides: Partial<TodayData> = {}): TodayData {
  return {
    fleet: fleet(),
    trackers: [
      {
        id: 1,
        name: "seedpool",
        color: "#22c55e",
        uploadDelta: String(512n * 1024n ** 3n),
        downloadDelta: "0",
        bufferDelta: String(512n * 1024n ** 3n),
        seedbonusChange: 1200,
      },
      {
        id: 2,
        name: "TorrentLeech",
        color: "#3b82f6",
        uploadDelta: "0",
        downloadDelta: "0",
        bufferDelta: "0",
        seedbonusChange: 40,
      },
    ],
    activity: { addedToday: 0, completedToday: 0 },
    movers: {
      clientCount: 1,
      unmatchedTorrents: 0,
      topUploaders: [
        {
          hash: "a",
          name: "Seeding Movie",
          qbtTag: "seedpool",
          trackerColor: "#22c55e",
          clientName: "qBittorrent",
          uploadedToday: String(10n * 1024n ** 3n),
        },
        {
          hash: "b",
          name: "Zero Upload",
          qbtTag: "seedpool",
          trackerColor: "#22c55e",
          clientName: "qBittorrent",
          uploadedToday: "0",
        },
      ],
      topDownloaders: [
        {
          hash: "c",
          name: "Downloading Show",
          qbtTag: "torrentleech",
          trackerColor: "#3b82f6",
          clientName: "Transmission",
          downloadedToday: String(2n * 1024n ** 3n),
        },
      ],
    },
    trackerLastUpdated: null,
    clientLastUpdated: null,
    ...overrides,
  }
}

describe("fleet bonus changes", () => {
  it("does not render a summed bonus tile", () => {
    render(<FleetHeadline fleet={fleet()} />)
    expect(screen.queryByText("Bonus gained")).not.toBeInTheDocument()
    expect(screen.getByText("Upload gained")).toBeInTheDocument()
    expect(screen.getByText("Download gained")).toBeInTheDocument()
    expect(screen.getByText("Buffer change")).toBeInTheDocument()
    expect(screen.getByText("Ratio change")).toBeInTheDocument()
  })

  it("lists each tracker's bonus change and never a total", () => {
    const { container } = render(<FleetBonusChanges trackers={data().trackers} />)
    const rows = [...container.querySelectorAll("[data-bonus-change]")]
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent("seedpool")
    expect(rows[0]).toHaveTextContent("+1,200")
    expect(rows[1]).toHaveTextContent("TorrentLeech")
    expect(rows[1]).toHaveTextContent("+40")
    expect(container).not.toHaveTextContent("+1,240")
  })

  it("hides the bonus block when every tracker has no change", () => {
    const { container } = render(
      <FleetBonusChanges
        trackers={data().trackers.map((tracker) => ({ ...tracker, seedbonusChange: null }))}
      />
    )
    expect(container).toBeEmptyDOMElement()
  })
})

describe("torrent movers", () => {
  it("names the download client on every row", () => {
    render(<MoversAndShakers movers={data().movers} />)
    expect(screen.getAllByText("Client: qBittorrent")).toHaveLength(1)
    expect(screen.getByText("Client: Transmission")).toBeInTheDocument()
  })

  it("hides rows whose transfer is zero", () => {
    render(<MoversAndShakers movers={data().movers} />)
    expect(screen.queryByText("Zero Upload")).not.toBeInTheDocument()
    expect(screen.getByText("Seeding Movie")).toBeInTheDocument()
  })

  it("hides both lists when no download client is connected", () => {
    const { container } = render(
      <MoversAndShakers
        movers={{
          ...data().movers,
          clientCount: 0,
          topUploaders: [],
          topDownloaders: [],
        }}
      />
    )
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByText("Top Uploaders")).not.toBeInTheDocument()
    expect(screen.queryByText("Top Downloaders")).not.toBeInTheDocument()
  })
})

describe("Today at a glance", () => {
  it("labels the period and uses per-tracker bonus changes", () => {
    const { container } = render(<TodayAtAGlance data={data()} />)
    expect(screen.getByText("Today, since 00:00")).toBeInTheDocument()
    expect(screen.queryByText("Bonus gained")).not.toBeInTheDocument()
    const rows = [...container.querySelectorAll("[data-bonus-change]")]
    expect(rows).toHaveLength(2)
    expect(within(rows[0] as HTMLElement).getByText("+1,200")).toBeInTheDocument()
    // A torrent can transfer without being added or completed today.
    expect(screen.queryByText("No fleet activity today")).not.toBeInTheDocument()
    expect(screen.getByText("Torrent transfer today")).toBeInTheDocument()
  })

  it("does not render torrent lists without a download client", () => {
    render(
      <TodayAtAGlance
        data={data({
          movers: {
            clientCount: 0,
            unmatchedTorrents: 0,
            topUploaders: [],
            topDownloaders: [],
          },
        })}
      />
    )
    expect(screen.queryByText("Top Uploaders")).not.toBeInTheDocument()
    expect(screen.queryByText("Top Downloaders")).not.toBeInTheDocument()
  })
})
