// src/components/dashboard/TrackerGrid.tsx

"use client"

import { ExternalLinkSmallIcon } from "@icons"
import clsx from "clsx"
import Link from "next/link"
import { CHART_THEME } from "@/components/charts/lib/theme"
import { Badge, PulseDot } from "@/components/ui"
import { RequirementBarTrack } from "@/components/ui/RequirementBarTrack"
import {
  formatAccountAge,
  formatBytesFromString,
  formatCount,
  formatRatioDisplay,
} from "@/lib/formatters"
import type { RankGoalSummary, RankSummaryBar } from "@/lib/rank-summary"
import { requirementBarGeometry, strictThresholdRequirement } from "@/lib/requirement-bar"
import { getSnapshotReadout } from "@/lib/snapshot-freshness"
import { getTrackerChecks } from "@/lib/tracker-checks"
import { getHealthLabel, getHealthPulseDot, getTrackerHealth } from "@/lib/tracker-status"
import type { TrackerSummary } from "@/types/api"
import { TrackerChecksStrip } from "./TrackerChecksStrip"

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
  marker = null,
  markerTitle,
}: {
  label: string
  value: string
  color: string
  unknown?: boolean
  marker?: "*" | "?" | null
  markerTitle?: string
}) {
  const effectiveMarker = unknown ? "?" : marker
  const markerLabel =
    effectiveMarker === "*" ? "stale snapshot" : effectiveMarker === "?" ? "value unknown" : undefined
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="font-cond text-xs font-semibold uppercase tracking-[0.1em] text-tertiary">
        {label}
      </span>
      <span
        className="truncate font-mono text-sm font-medium tabular-nums"
        style={{ color: unknown ? "var(--color-tertiary)" : color }}
      >
        {value}
        {effectiveMarker && (
          <span
            role="img"
            className="ml-1 text-xs text-warn"
            aria-label={markerLabel}
            title={markerTitle}
          >
            {effectiveMarker}
          </span>
        )}
      </span>
    </div>
  )
}
function RankBar({ bar }: { bar: RankSummaryBar }) {
  const geometry = requirementBarGeometry(bar)
  const requirementText = geometry.atStrictThreshold
    ? strictThresholdRequirement(bar.comparison, bar.current, bar.required)
    : null
  const stateLabel = bar.status === "met" ? "Met" : bar.status === "unmet" ? "Unmet" : "Unknown"
  const stateTone =
    bar.status === "met" ? "text-success" : bar.status === "unmet" ? "text-danger" : "text-warn"
  return (
    <div className="flex flex-col gap-1" data-rank-bar={bar.id}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate text-xs text-secondary">{bar.label}</span>
        <span className="flex shrink-0 items-baseline gap-2">
          <span className={clsx("font-cond text-2xs font-semibold uppercase tracking-[0.1em]", stateTone)}>
            {stateLabel}
          </span>
          <span className="font-mono text-xs tabular-nums text-tertiary">
            {bar.current} / {bar.required}
          </span>
        </span>
      </div>
      <RequirementBarTrack
        percent={geometry.percent}
        fillClassName={barTone(bar)}
        shortfall={geometry.atStrictThreshold}
      />
      {requirementText && (
        <p className="text-xs text-danger" data-strict-requirement>
          {requirementText}
        </p>
      )}
    </div>
  )
}function TrackerCard({
  tracker,
  summary,
  now,
}: {
  tracker: TrackerSummary
  summary: RankGoalSummary | undefined
  now: Date
}) {
  const health = getTrackerHealth(tracker)
  const stats = tracker.latestStats
  const bars = summary?.bars ?? []
  const visibleBars = bars.slice(0, 3)
  const targetRank = summary?.targetRank ?? summary?.automaticNextRank
  const checks = getTrackerChecks(tracker)
  const snapshot = getSnapshotReadout(tracker, now)
  const snapshotMarker = stats
    ? snapshot.state === "stale"
      ? "*"
      : snapshot.state === "unknown"
        ? "?"
        : null
    : null
  const needsChecking = Boolean(stats) && snapshot.state !== "fresh"
  const markerTitle =
    snapshot.state === "stale"
      ? `Snapshot polled ${snapshot.age ?? "some time"} ago and is stale (older than 2 hours).`
      : snapshot.state === "unknown"
        ? "Snapshot poll time is unknown, so freshness cannot be confirmed."
        : undefined

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
            <p className="break-words font-cond text-sm font-semibold tracking-[-0.01em] text-primary">
              {tracker.name}
            </p>
            <p className="truncate text-xs text-tertiary">{hostOf(tracker)}</p>
            <p className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs text-secondary">
              <span data-health-label>{getHealthLabel(health)}</span>
              <span className="text-tertiary">{"\u00b7"}</span>
              <span>{stats?.group ?? "Unknown class"}</span>
              <span className="text-tertiary">{"\u00b7"}</span>
              <span>{accountAge(tracker)}</span>
              {needsChecking && (
                <>
                  <span className="text-tertiary">{"\u00b7"}</span>
                  <span className="text-warn">Needs checking</span>
                </>
              )}
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
          marker={snapshotMarker}
          markerTitle={markerTitle}
        />
        <Metric
          label="Downloaded"
          value={stats ? formatBytesFromString(stats.downloadedBytes) : "—"}
          color={CHART_THEME.download}
          unknown={!stats}
          marker={snapshotMarker}
          markerTitle={markerTitle}
        />
        <Metric
          label="Buffer"
          value={bufferValue(tracker)}
          color={CHART_THEME.buffer}
          unknown={!stats}
          marker={snapshotMarker}
          markerTitle={markerTitle}
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
          color={CHART_THEME.ratio}
          unknown={!stats}
          marker={snapshotMarker}
          markerTitle={markerTitle}
        />
        <Metric
          label="Seeding"
          value={stats ? formatCount(stats.seedingCount) : "—"}
          color={CHART_THEME.seeding}
          unknown={!stats || stats.seedingCount === null}
          marker={snapshotMarker}
          markerTitle={markerTitle}
        />
        <Metric
          label="Bonus"
          value={stats ? formatCount(stats.seedbonus) : "—"}
          color={CHART_THEME.bonus}
          unknown={!stats || stats.seedbonus === null}
          marker={snapshotMarker}
          markerTitle={markerTitle}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="font-cond text-xs font-semibold uppercase tracking-[0.1em] text-secondary">
          Checks
        </span>
        <TrackerChecksStrip checks={checks} />
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
        {summary && summary.totalChecks > 0 && (
          <p className="font-mono text-xs text-tertiary">
            {summary.metCount} of {summary.totalChecks} requirements
          </p>
        )}
        {summary?.distanceText && (
          <p className="text-xs text-secondary">{summary.distanceText}</p>
        )}
        {visibleBars.length > 0 ? (
          <div className="flex flex-col gap-2">
            {visibleBars.map((bar) => (
              <RankBar key={bar.id} bar={bar} />
            ))}
            {bars.length > visibleBars.length && (
              <p className="text-xs text-tertiary">+{bars.length - visibleBars.length} more requirements</p>
            )}
          </div>
        ) : summary?.nextRankRequirements ? (
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-tertiary">
              From tracker rules (not tracked automatically)
            </span>
            <p className="text-xs text-secondary">{summary.nextRankRequirements}</p>
          </div>
        ) : (
          <p className="text-xs text-tertiary">
            {summary?.status === "unsupported"
              ? "No next-class requirements are published for this tracker."
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
        <h2 className="font-cond text-lg font-semibold leading-6 tracking-[-0.01em] text-primary">
          Trackers
        </h2>
        <p className="font-mono text-xs text-tertiary">
          {trackers.length} {trackers.length === 1 ? "account" : "accounts"} · as of{" "}
          {now.toISOString().slice(0, 10)}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {trackers.map((tracker) => (
          <TrackerCard key={tracker.id} tracker={tracker} summary={byId.get(tracker.id)} now={now} />
        ))}
      </div>
    </section>
  )
}
