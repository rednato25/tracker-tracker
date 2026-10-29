// src/components/dashboard/TrackerGrid.tsx

"use client"

import { ExternalLinkSmallIcon } from "@icons"
import clsx from "clsx"
import Link from "next/link"
import { CHART_THEME } from "@/components/charts/lib/theme"
import { Badge, PulseDot } from "@/components/ui"
import { registryEntryFor } from "@/data/tracker-registry"
import {
  formatAccountAge,
  formatBytesFromString,
  formatCount,
  formatRatioDisplay,
} from "@/lib/formatters"
import type { RankGoalSummary, RankSummaryBar } from "@/lib/rank-summary"
import { resolveAccountRatio } from "@/lib/tracker-rules"
import { getHealthLabel, getHealthPulseDot, getTrackerHealth } from "@/lib/tracker-status"
import type { TrackerSummary } from "@/types/api"

interface TrackerGridProps {
  trackers: TrackerSummary[]
  summaries: RankGoalSummary[]
  now?: Date
}

function hostOf(tracker: TrackerSummary): string {
  try {
    return new URL(tracker.baseUrl).hostname
  } catch {
    return tracker.baseUrl
  }
}

function accountAge(tracker: TrackerSummary): string {
  return formatAccountAge(tracker.joinedAt) ?? "Unknown"
}

function bufferValue(tracker: TrackerSummary): string {
  const raw = tracker.latestStats?.bufferBytes
  if (!raw) return "—"
  try {
    const value = BigInt(raw)
    const formatted = formatBytesFromString(raw)
    return value > 0n && !formatted.startsWith("+") ? `+${formatted}` : formatted
  } catch {
    return formatBytesFromString(raw)
  }
}

function ratioColor(tracker: TrackerSummary): string {
  const stats = tracker.latestStats
  if (!stats || stats.ratio === null) return CHART_THEME.neutral
  if (stats.ratioIsInfinite) return CHART_THEME.success
  const required = resolveAccountRatio(stats.requiredRatio, registryEntryFor(tracker)?.rules) ?? 1
  if (stats.ratio >= required) return CHART_THEME.success
  return stats.ratio >= 1 ? CHART_THEME.warn : CHART_THEME.danger
}

function barFraction(bar: RankSummaryBar): number {
  if (bar.currentValue === null || bar.requiredValue <= 0) return 0
  if (bar.comparison === "lte" || bar.comparison === "lt") {
    return Math.min(1, bar.requiredValue / Math.max(bar.currentValue, 1))
  }
  if (bar.comparison === "eq") return bar.status === "met" ? 1 : 0
  return Math.min(1, bar.currentValue / bar.requiredValue)
}

function barTone(bar: RankSummaryBar): string {
  if (bar.status === "unmet") return "bg-danger"
  if (bar.status === "unknown") return "bg-warn"
  return "bg-success"
}

function Metric({
  label,
  value,
  color,
  unknown = false,
}: {
  label: string
  value: string
  color: string
  unknown?: boolean
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="font-cond text-xs font-semibold uppercase tracking-[0.1em] text-tertiary">
        {label}
      </span>
      <span className="truncate font-mono text-sm font-medium tabular-nums" style={{ color }}>
        {value}
        {unknown && (
          <span className="ml-1 text-xs text-tertiary" aria-hidden="true">
            ?
          </span>
        )}
      </span>
    </div>
  )
}

function RankBar({ bar }: { bar: RankSummaryBar }) {
  const percent = Math.round(barFraction(bar) * 100)
  return (
    <div className="flex flex-col gap-1" data-rank-bar={bar.id}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate text-xs text-secondary">{bar.label}</span>
        <span className="shrink-0 font-mono text-xs tabular-nums text-tertiary">
          {bar.current} / {bar.required}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden bg-elevated" aria-hidden="true">
        <span className={clsx("block h-full", barTone(bar))} style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

function TrackerCard({
  tracker,
  summary,
}: {
  tracker: TrackerSummary
  summary: RankGoalSummary | undefined
}) {
  const health = getTrackerHealth(tracker)
  const stats = tracker.latestStats
  const bars = summary?.bars ?? []
  const visibleBars = bars.slice(0, 3)
  const currentRank = summary?.currentRankHidden
    ? "Hidden"
    : (summary?.currentRank ?? stats?.group ?? "Unknown")
  const targetRank = summary?.targetRank ?? summary?.automaticNextRank

  return (
    <Link
      href={`/trackers/${tracker.id}`}
      data-tracker-card={tracker.id}
      className="group flex min-w-0 flex-col gap-3 border border-border border-t-2 bg-raised p-4 transition-colors duration-150 hover:border-border-emphasis hover:bg-elevated/40"
      style={{ borderTopColor: tracker.color }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <PulseDot
            status={getHealthPulseDot(health)}
            size="sm"
            className="mt-1"
            aria-label={getHealthLabel(health)}
          />
          <div className="min-w-0">
            <p className="truncate font-cond text-sm font-semibold tracking-[-0.01em] text-primary">
              {tracker.name}
            </p>
            <p className="truncate text-xs text-tertiary">{hostOf(tracker)}</p>
            <p className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs text-secondary">
              <span>{stats?.group ?? "Unknown class"}</span>
              <span className="text-tertiary">·</span>
              <span>{accountAge(tracker)}</span>
            </p>
          </div>
        </div>
        <ExternalLinkSmallIcon
          width="13"
          height="13"
          className="mt-0.5 shrink-0 text-tertiary transition-colors group-hover:text-accent"
        />
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-border pt-3">
        <Metric
          label="Uploaded"
          value={stats ? formatBytesFromString(stats.uploadedBytes) : "—"}
          color={CHART_THEME.upload}
          unknown={!stats}
        />
        <Metric
          label="Downloaded"
          value={stats ? formatBytesFromString(stats.downloadedBytes) : "—"}
          color={CHART_THEME.download}
          unknown={!stats}
        />
        <Metric
          label="Buffer"
          value={bufferValue(tracker)}
          color={CHART_THEME.buffer}
          unknown={!stats}
        />
        <Metric
          label="Ratio"
          value={
            stats
              ? stats.ratioIsInfinite
                ? "∞"
                : formatRatioDisplay(stats.ratio)
              : "—"
          }
          color={ratioColor(tracker)}
          unknown={!stats}
        />
        <Metric
          label="Seeding"
          value={stats ? formatCount(stats.seedingCount) : "—"}
          color={CHART_THEME.seeding}
          unknown={!stats || stats.seedingCount === null}
        />
        <Metric
          label="Bonus"
          value={stats ? formatCount(stats.seedbonus) : "—"}
          color={CHART_THEME.bonus}
          unknown={!stats || stats.seedbonus === null}
        />
      </div>

      <div className="flex flex-col gap-2 border-t border-border pt-3">
        <div className="flex items-center justify-between gap-2">
          <span className="font-cond text-xs font-semibold uppercase tracking-[0.1em] text-secondary">
            Rank target
          </span>
          <Badge variant={summary?.targetRank ? "accent" : "default"}>
            {targetRank ?? "No target"}
          </Badge>
        </div>
        <p className="font-mono text-xs text-tertiary">
          Current: {currentRank}
          {targetRank ? ` · Target: ${targetRank}` : ""}
        </p>
        {visibleBars.length > 0 ? (
          <div className="flex flex-col gap-2">
            {visibleBars.map((bar) => (
              <RankBar key={bar.id} bar={bar} />
            ))}
            {bars.length > visibleBars.length && (
              <p className="text-xs text-tertiary">+{bars.length - visibleBars.length} more checks</p>
            )}
          </div>
        ) : (
          <p className="text-xs text-tertiary">
            {summary?.status === "unsupported"
              ? "Structured rank progress is unavailable."
              : "No structured requirement to show."}
          </p>
        )}
      </div>
    </Link>
  )
}

export function TrackerGrid({ trackers, summaries, now = new Date() }: TrackerGridProps) {
  const byId = new Map(summaries.map((summary) => [summary.trackerId, summary]))
  return (
    <section className="flex flex-col gap-3" aria-label="Tracker cards" data-tracker-grid>
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="font-cond text-3xl font-semibold leading-none tracking-[-0.02em] text-primary">
          Trackers
        </h1>
        <p className="font-mono text-xs text-tertiary">
          {trackers.length} {trackers.length === 1 ? "account" : "accounts"} · as of{" "}
          {now.toISOString().slice(0, 10)}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {trackers.map((tracker) => (
          <TrackerCard key={tracker.id} tracker={tracker} summary={byId.get(tracker.id)} />
        ))}
      </div>
    </section>
  )
}
