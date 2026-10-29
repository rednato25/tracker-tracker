// src/components/dashboard/DashboardTotals.tsx

"use client"

import { useMemo } from "react"
import { CHART_THEME } from "@/components/charts/lib/theme"
import { Sparkline } from "@/components/ui/Sparkline"
import type { AggregateStats } from "@/lib/dashboard"
import { buildTotalsSeries } from "@/lib/dashboard-series"
import { formatBytesFromString, formatRatioDisplay } from "@/lib/formatters"
import type { Snapshot, TrackerSummary } from "@/types/api"

interface DashboardTotalsProps {
  trackers: TrackerSummary[]
  aggregateStats: AggregateStats
  attentionCount: number
  snapshotMap: Map<number, Snapshot[]>
  now?: Date
}

const SNAPSHOT_STALE_MS = 2 * 60 * 60 * 1000

function tileValue(value: string, unknown = false): string {
  if (unknown) return "—"
  return value
}

function Spark({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null
  return <Sparkline data={data} color={color} width={104} height={28} />
}

export function DashboardTotals({
  trackers,
  aggregateStats,
  attentionCount,
  snapshotMap,
  now = new Date(),
}: DashboardTotalsProps) {
  const series = useMemo(
    () => buildTotalsSeries(trackers, snapshotMap),
    [trackers, snapshotMap]
  )
  const included = trackers.filter((tracker) => tracker.latestStats)
  const missing = trackers.length - included.length
  const stale = included.some((tracker) => {
    if (!tracker.lastPolledAt) return true
    return now.getTime() - new Date(tracker.lastPolledAt).getTime() > SNAPSHOT_STALE_MS
  })
  const noTrackers = included.length === 0

  return (
    <section className="flex flex-col gap-2" aria-label="Fleet totals" data-dashboard-totals>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
        <Tile
          label="Uploaded"
          value={noTrackers ? "—" : formatBytesFromString(aggregateStats.totalUploaded)}
          color={CHART_THEME.upload}
          data={series.uploaded}
          meta={`${included.length} of ${trackers.length} trackers`}
        />
        <Tile
          label="Downloaded"
          value={noTrackers ? "—" : formatBytesFromString(aggregateStats.totalDownloaded)}
          color={CHART_THEME.download}
          data={series.downloaded}
          meta={`${included.length} of ${trackers.length} trackers`}
        />
        <Tile
          label="Buffer"
          value={noTrackers ? "—" : formatBuffer(aggregateStats.totalBuffer)}
          color={CHART_THEME.buffer}
          data={series.buffer}
          meta="Uploaded minus downloaded"
        />
        <Tile
          label="Overall ratio"
          value={aggregateStats.avgRatio === null ? "—" : formatRatioDisplay(aggregateStats.avgRatio)}
          color={CHART_THEME.ratio}
          data={series.ratio.filter((value): value is number => value !== null)}
          meta="Fleet total"
          unknown={aggregateStats.avgRatio === null}
        />
        <Tile
          label="Need attention"
          value={String(attentionCount)}
          color={attentionCount > 0 ? CHART_THEME.danger : CHART_THEME.success}
          data={[]}
          meta={
            attentionCount > 0
              ? "Action required"
              : missing > 0 || stale
                ? "No known actions · coverage incomplete"
                : "All clear"
          }
        />
      </div>
      {(missing > 0 || stale) && (
        <p className="font-mono text-xs text-tertiary">
          {missing > 0
            ? `Totals from ${included.length} of ${trackers.length} trackers with a snapshot.`
            : `Totals from ${trackers.length} trackers.`}
          {stale && (
            <>
              {" "}
              <span className="text-warn" title="One or more included snapshots are older than two hours.">
                * Needs checking
              </span>
            </>
          )}
        </p>
      )}
    </section>
  )
}

function formatBuffer(raw: string): string {
  if (!raw) return "—"
  const value = BigInt(raw)
  const formatted = formatBytesFromString(raw)
  if (value > 0n && !formatted.startsWith("+")) return `+${formatted}`
  return formatted
}

function Tile({
  label,
  value,
  color,
  data,
  meta,
  unknown = false,
}: {
  label: string
  value: string
  color: string
  data: number[]
  meta: string
  unknown?: boolean
}) {
  return (
    <article
      className="relative flex min-h-[116px] flex-col justify-between overflow-hidden border border-border bg-raised p-3.5"
      data-total-tile={label.toLowerCase().replace(/\s+/g, "-")}
    >
      <span className="absolute inset-x-0 top-0 h-0.5" style={{ backgroundColor: color }} />
      <div className="flex flex-col gap-1">
        <span className="font-cond text-xs font-semibold uppercase tracking-[0.12em] text-secondary">
          {label}
        </span>
        <span
          className="whitespace-nowrap font-mono text-[20px] font-semibold leading-none tracking-[-0.03em] sm:text-xl"
          style={{ color }}
        >
          {tileValue(value, unknown)}
          {unknown && (
            <span className="ml-1 text-xs text-tertiary" aria-hidden="true">
              ?
            </span>
          )}
        </span>
        <span className="text-xs text-tertiary">{meta}</span>
      </div>
      <div className="mt-2 flex justify-end">
        <Spark data={data} color={color} />
      </div>
    </article>
  )
}
