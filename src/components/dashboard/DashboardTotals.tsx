// src/components/dashboard/DashboardTotals.tsx

"use client"

import { useMemo } from "react"
import { CHART_THEME } from "@/components/charts/lib/theme"
import { Sparkline } from "@/components/ui/Sparkline"
import type { AggregateStats } from "@/lib/dashboard"
import { buildTotalsSeries } from "@/lib/dashboard-series"
import { formatBytesFromString, formatRatioDisplay } from "@/lib/formatters"
import { getSnapshotReadout } from "@/lib/snapshot-freshness"
import { getTrackerHealth } from "@/lib/tracker-status"
import type { Snapshot, TrackerSummary } from "@/types/api"

interface DashboardTotalsProps {
  trackers: TrackerSummary[]
  aggregateStats: AggregateStats
  attentionCount: number
  verificationCount?: number
  snapshotMap: Map<number, Snapshot[]>
  now?: Date
}

function tileValue(value: string, unknown = false): string {
  if (unknown) return "\u2014"
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
  verificationCount = 0,
  snapshotMap,
  now = new Date(),
}: DashboardTotalsProps) {
  const series = useMemo(
    () => buildTotalsSeries(trackers, snapshotMap),
    [trackers, snapshotMap]
  )
  const included = trackers.filter((tracker) => tracker.latestStats)
  const missing = trackers.length - included.length
  const offline = trackers.filter((tracker) => getTrackerHealth(tracker) === "offline").length
  const staleCount = included.filter(
    (tracker) => getSnapshotReadout(tracker, now).state === "stale"
  ).length
  const unverifiedCount = included.filter(
    (tracker) => getSnapshotReadout(tracker, now).state === "unknown"
  ).length
  const coverageIncomplete =
    missing > 0 || staleCount > 0 || unverifiedCount > 0 || verificationCount > 0
  const coverageParts = [
    offline > 0 ? `${offline} offline` : null,
    staleCount > 0 ? `${staleCount} stale` : null,
    unverifiedCount > 0 ? `${unverifiedCount} unverified` : null,
    verificationCount > 0
      ? `${verificationCount} ${verificationCount === 1 ? "needs" : "need"} verification`
      : null,
  ].filter((part): part is string => part !== null)
  const coverageText = coverageParts.join(" \u00b7 ") || "coverage incomplete"
  const actionLabel = `${attentionCount} ${attentionCount === 1 ? "action" : "actions"}`
  const attentionMeta = coverageIncomplete
    ? `${actionLabel} \u00b7 ${coverageText}`
    : attentionCount > 0
      ? "Action required"
      : "All clear"
  const attentionTone = attentionCount > 0 ? "danger" : coverageIncomplete ? "warn" : "success"
  const noTrackers = included.length === 0

  return (
    <section className="flex flex-col gap-2" aria-label="Fleet totals" data-dashboard-totals>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
        <Tile
          label="Uploaded"
          value={noTrackers ? "\u2014" : formatBytesFromString(aggregateStats.totalUploaded)}
          color={CHART_THEME.upload}
          data={series.uploaded}
          meta={`${included.length} of ${trackers.length} trackers`}
        />
        <Tile
          label="Downloaded"
          value={noTrackers ? "\u2014" : formatBytesFromString(aggregateStats.totalDownloaded)}
          color={CHART_THEME.download}
          data={series.downloaded}
          meta={`${included.length} of ${trackers.length} trackers`}
        />
        <Tile
          label="Buffer"
          value={noTrackers ? "\u2014" : formatBuffer(aggregateStats.totalBuffer)}
          color={CHART_THEME.buffer}
          data={series.buffer}
          meta="Uploaded minus downloaded"
        />
        <Tile
          label="Overall ratio"
          value={aggregateStats.avgRatio === null ? "\u2014" : formatRatioDisplay(aggregateStats.avgRatio)}
          color={CHART_THEME.ratio}
          data={series.ratio.filter((value): value is number => value !== null)}
          meta="Fleet total"
          unknown={aggregateStats.avgRatio === null}
        />
        <Tile
          label="Need attention"
          value={String(attentionCount)}
          color={
            attentionTone === "danger"
              ? CHART_THEME.danger
              : attentionTone === "warn"
                ? CHART_THEME.warn
                : CHART_THEME.success
          }
          data={[]}
          meta={attentionMeta}
          tone={attentionTone}
        />
      </div>
      {(missing > 0 || staleCount > 0 || unverifiedCount > 0) && (
        <p className="font-mono text-xs text-tertiary">
          {missing > 0
            ? `Totals from ${included.length} of ${trackers.length} trackers with a snapshot.`
            : `Totals from ${trackers.length} trackers.`}
          {(staleCount > 0 || unverifiedCount > 0) && (
            <>
              {" "}
              <span className="text-warn" title="One or more included snapshots are older than two hours or have no confirmed poll time.">
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
  if (!raw) return "\u2014"
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
  tone,
  unknown = false,
}: {
  label: string
  value: string
  color: string
  data: number[]
  meta: string
  tone?: string
  unknown?: boolean
}) {
  return (
    <article
      className="relative flex min-h-[116px] flex-col justify-between overflow-hidden border border-border bg-raised p-3.5"
      data-total-tile={label.toLowerCase().replace(/\s+/g, "-")}
      data-total-tone={tone}
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