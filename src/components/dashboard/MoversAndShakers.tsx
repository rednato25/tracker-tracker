// src/components/dashboard/MoversAndShakers.tsx

"use client"

import { DataCell, H2 } from "@typography"
import clsx from "clsx"
import type { ReactNode } from "react"
import { MarqueeText } from "@/components/ui/MarqueeText"
import { Tooltip } from "@/components/ui/Tooltip"
import { formatBytesFromString } from "@/lib/formatters"
import type { TodayAtAGlance } from "@/types/api"

interface MoversAndShakersProps {
  movers: TodayAtAGlance["movers"]
}

interface TorrentRankListEntry {
  hash: string
  name: string
  qbtTag: string | null
  trackerColor: string | null
  clientName: string | null
  bytes: string
}

function buildTooltip(entry: TorrentRankListEntry): ReactNode {
  const lines: string[] = []
  if (entry.qbtTag) lines.push(`Tracker: ${entry.qbtTag}`)
  if (entry.clientName) lines.push(`Client: ${entry.clientName}`)
  if (entry.qbtTag?.toLowerCase().includes("cross-seed")) lines.push("Cross-seeded")
  if (lines.length === 0) return "Unknown tracker"
  return (
    <div className="flex flex-col gap-0.5">
      {lines.map((line) => (
        <span key={line}>{line}</span>
      ))}
    </div>
  )
}

function hasTransfer(bytes: string): boolean {
  try {
    return BigInt(bytes) > 0n
  } catch {
    return false
  }
}

function TorrentRankList({ label, entries }: { label: string; entries: TorrentRankListEntry[] }) {
  const withTransfer = entries.filter((entry) => hasTransfer(entry.bytes))
  return (
    <div className="nm-inset-sm rounded-nm-md p-4 overflow-hidden">
      <H2 className="uppercase tracking-wider mb-3">{label}</H2>
      {withTransfer.length === 0 ? (
        <p className="text-xs text-muted">No activity</p>
      ) : (
        <ul>
          {withTransfer.map((entry, index) => (
            <Tooltip key={entry.hash} content={buildTooltip(entry)}>
              <li
                className={clsx(
                  "grid grid-cols-[1fr_auto] items-center gap-3 py-1.5",
                  index < withTransfer.length - 1 && "border-b border-border"
                )}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="color-dot shrink-0"
                    style={{ backgroundColor: entry.trackerColor ?? "var(--color-accent)" }}
                    aria-hidden="true"
                  />
                  <div className="flex min-w-0 flex-col">
                    <MarqueeText className="text-xs font-mono text-primary">
                      {entry.name}
                    </MarqueeText>
                    <span
                      className="truncate text-2xs text-tertiary"
                      data-transfer-client={entry.clientName ?? "unknown"}
                    >
                      Client: {entry.clientName ?? "Unknown"}
                    </span>
                  </div>
                </div>
                <DataCell className="whitespace-nowrap">
                  {formatBytesFromString(entry.bytes)}
                </DataCell>
              </li>
            </Tooltip>
          ))}
        </ul>
      )}
    </div>
  )
}

export function MoversAndShakers({ movers }: MoversAndShakersProps) {
  const { topUploaders, topDownloaders, clientCount, unmatchedTorrents } = movers

  // No client means no torrent-level transfer data. Both lists are hidden,
  // not shown empty.
  if (clientCount === 0) return null

  if (topUploaders.length === 0 && topDownloaders.length === 0) {
    const message =
      unmatchedTorrents > 0
        ? `${unmatchedTorrents} torrent${unmatchedTorrents === 1 ? "" : "s"} found, but none ` +
          "belong to a tracked tracker. Check the tracker's URL, or set a qBittorrent tag on it."
        : "No torrent activity today"

    return <p className="text-xs font-mono text-muted p-4 text-center">{message}</p>
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <TorrentRankList
        label="Top Uploaders"
        entries={topUploaders.map((e) => ({ ...e, bytes: e.uploadedToday }))}
      />
      <TorrentRankList
        label="Top Downloaders"
        entries={topDownloaders.map((e) => ({ ...e, bytes: e.downloadedToday }))}
      />
    </div>
  )
}
