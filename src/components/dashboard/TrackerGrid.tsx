// src/components/dashboard/TrackerGrid.tsx

"use client"

import { ExternalLinkSmallIcon } from "@icons"
import clsx from "clsx"
import Link from "next/link"
import { useEffect, useState } from "react"
import { CHART_THEME } from "@/components/charts/lib/theme"
import { Button, PulseDot } from "@/components/ui"
import { RequirementBarTrack } from "@/components/ui/RequirementBarTrack"
import {
  formatAccountAge,
  formatBytesFromString,
  formatClockTime,
  formatCount,
  formatDate,
  formatMemberSinceDate,
  formatRatioDisplay,
  localDateStr,
} from "@/lib/formatters"
import { canDetectLogin } from "@/lib/login-detection"
import type { RankGoalSummary, RankSummaryBar } from "@/lib/rank-summary"
import { requirementBarGeometry, strictThresholdRequirement } from "@/lib/requirement-bar"
import { getSnapshotReadout } from "@/lib/snapshot-freshness"
import { getTrackerChecks } from "@/lib/tracker-checks"
import {
  isLoginExpiredMessage,
  nextFailureRetryAt,
  plainPollError,
} from "@/lib/tracker-recovery"
import {
  getHealthLabel,
  getHealthPulseDot,
  getPauseState,
  getTrackerHealth,
} from "@/lib/tracker-status"
import type { TrackerSummary } from "@/types/api"
import { TrackerChecksStrip } from "./TrackerChecksStrip"

interface TrackerGridProps {
  trackers: TrackerSummary[]
  summaries: RankGoalSummary[]
  now?: Date
  onTrackerUpdated?: (tracker: TrackerSummary) => void
}

function hostOf(tracker: TrackerSummary): string {
  try {
    return new URL(tracker.baseUrl).hostname
  } catch {
    return tracker.baseUrl
  }
}

function accountAge(tracker: TrackerSummary, now: Date): string {
  return formatAccountAge(tracker.joinedAt, now) ?? "Unknown"
}

function memberSince(tracker: TrackerSummary): string {
  return formatMemberSinceDate(tracker.joinedAt) ?? "Unknown"
}

function cardStatusLabel(
  tracker: TrackerSummary,
  health: ReturnType<typeof getTrackerHealth>,
  snapshotState: "fresh" | "stale" | "unknown"
): string | null {
  if (isLoginExpiredMessage(tracker.lastError)) return "Login expired"
  if (getPauseState(tracker).isPaused) return "Paused"
  if (snapshotState === "stale") return "Stale"
  return health === "healthy" ? null : getHealthLabel(health)
}

function statusTone(label: string | null): string {
  if (label === "Login expired" || label === "Paused") return "text-danger"
  if (label === "Stale" || label === "Above Min" || label === "No Seeds") return "text-warn"
  return "text-secondary"
}

const DAY_MS = 24 * 60 * 60 * 1000

function startOfDay(value: Date): number {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime()
}

function loginDate(value: string): Date | null {
  const bare = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  const date = bare
    ? new Date(`${value}T00:00:00`)
    : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function lastLoginLabel(lastAccessAt: string | null, now: Date): string {
  if (!lastAccessAt) return "Last login: not recorded"
  const last = loginDate(lastAccessAt)
  if (!last) return "Last login: not recorded"
  const days = Math.max(0, Math.floor((startOfDay(now) - startOfDay(last)) / DAY_MS))
  if (days === 0) return "Last login: today"
  return `Last login: ${days} day${days === 1 ? "" : "s"} ago`
}

interface LoginMarkUndo {
  previous: string | null
}

function useLoginMarking(
  tracker: TrackerSummary,
  now: Date,
  onUpdated?: (tracker: TrackerSummary) => void
) {
  const [lastAccessAt, setLastAccessAt] = useState(tracker.lastAccessAt)
  const [undo, setUndo] = useState<LoginMarkUndo | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    setLastAccessAt(tracker.lastAccessAt)
  }, [tracker.lastAccessAt])

  useEffect(() => {
    if (!undo) return
    const timer = setTimeout(() => setUndo(null), 10_000)
    return () => clearTimeout(timer)
  }, [undo])

  async function patchLastAccess(value: string | null): Promise<TrackerSummary> {
    const res = await fetch(`/api/trackers/${tracker.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lastAccessAt: value }),
    })
    if (!res.ok) throw new Error("Could not record the login")
    return (await res.json()) as TrackerSummary
  }

  async function markLogin() {
    if (saving || undo) return
    const previous = lastAccessAt
    setSaving(true)
    setError(false)
    try {
      const updated = await patchLastAccess(localDateStr(now))
      setLastAccessAt(updated.lastAccessAt)
      setUndo({ previous })
      onUpdated?.(updated)
    } catch {
      setError(true)
    } finally {
      setSaving(false)
    }
  }

  async function undoMark() {
    if (saving || !undo) return
    const previous = undo.previous
    setSaving(true)
    setError(false)
    try {
      const updated = await patchLastAccess(previous)
      setLastAccessAt(updated.lastAccessAt)
      setUndo(null)
      onUpdated?.(updated)
    } catch {
      setError(true)
    } finally {
      setSaving(false)
    }
  }

  return { lastAccessAt, undo, saving, error, markLogin, undoMark }
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
  onTrackerUpdated,
}: {
  tracker: TrackerSummary
  summary: RankGoalSummary | undefined
  now: Date
  onTrackerUpdated?: (tracker: TrackerSummary) => void
}) {
  const health = getTrackerHealth(tracker)
  const pause = getPauseState(tracker)
  const failurePause = pause.isPaused && pause.reason === "failure"
  const retryAt = failurePause ? nextFailureRetryAt(tracker) : null
  const stats = tracker.latestStats
  const bars = summary?.bars ?? []
  const visibleBars = bars.slice(0, 3)
  const checks = getTrackerChecks(tracker)
  const snapshot = getSnapshotReadout(tracker, now)
  const statusLabel = cardStatusLabel(tracker, health, snapshot.state)
  const currentRankLabel = summary?.currentRankHidden
    ? "Hidden"
    : (summary?.currentRank ?? "Unknown")
  const savedTarget = summary?.targetRank ?? null
  const automaticTarget = summary?.automaticNextRank ?? null
  const targetRank = summary?.targetReached ? automaticTarget : (savedTarget ?? automaticTarget)
  const isAutomaticTarget = !savedTarget || Boolean(summary?.targetReached)
  const topOfLadder = !targetRank
  const manualLogin = !canDetectLogin(tracker.platformType)
  const loginMarking = useLoginMarking(tracker, now, onTrackerUpdated)
  const snapshotMarker = stats
    ? snapshot.state === "stale"
      ? "*"
      : snapshot.state === "unknown"
        ? "?"
        : null
    : null
  const markerTitle =
    snapshot.state === "stale"
      ? `Snapshot polled ${snapshot.age ?? "some time"} ago and is stale (older than 2 hours).`
      : snapshot.state === "unknown"
        ? "Snapshot poll time is unknown, so freshness cannot be confirmed."
        : undefined

  return (
    <article
      data-tracker-card={tracker.id}
      className="group flex min-w-0 flex-col border border-border border-t-2 bg-raised transition-colors duration-150 hover:border-border-emphasis hover:bg-elevated/40"
      style={{ borderTopColor: tracker.color }}
    >
      <Link
        href={`/trackers/${tracker.id}`}
        className="flex min-w-0 flex-1 flex-col gap-3 p-4"
      >
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
              <span>Member since {memberSince(tracker)}</span>
              <span className="text-tertiary">{"\u00b7"}</span>
              <span>{accountAge(tracker, now)}</span>
              {statusLabel && (
                <>
                  <span className="text-tertiary">{"\u00b7"}</span>
                  <span className={statusTone(statusLabel)} data-card-status>
                    {statusLabel}
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

      {failurePause && (
        <div data-failed-poll-pause className="border-t border-border pt-3 text-xs">
          <p className="text-danger">
            Paused after <span className="font-mono">{tracker.consecutiveFailures}</span> failed{" "}
            {tracker.consecutiveFailures === 1 ? "poll" : "polls"}
            {retryAt && (
              <>
                {" "}
                · next retry <span className="font-mono">{formatClockTime(retryAt)}</span>
              </>
            )}
          </p>
          <p className="mt-0.5 text-secondary">{plainPollError(tracker.lastError)}</p>
        </div>
      )}

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
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          {topOfLadder ? (
            <p className="min-w-0 break-words font-mono text-xs text-primary">
              <span className="font-medium">{currentRankLabel}</span>
              <span className="mx-1.5 text-tertiary">{"\u00b7"}</span>
              <span className="text-secondary">Highest automatic class reached</span>
            </p>
          ) : (
            <p className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5 font-mono text-xs">
              <span className="font-medium text-primary">{currentRankLabel}</span>
              <span aria-hidden="true" className="text-tertiary">
                {"\u2192"}
              </span>
              <span className="font-medium text-primary">{targetRank}</span>
              {isAutomaticTarget && (
                <span className="font-cond text-2xs font-semibold uppercase tracking-[0.1em] text-tertiary">
                  Automatic
                </span>
              )}
            </p>
          )}
          <p className="flex shrink-0 flex-wrap items-baseline gap-x-1.5 font-mono text-xs text-tertiary">
            {summary?.targetReached && summary.targetRank && (
              <>
                <span className="text-success">Target reached: {summary.targetRank}</span>
                {summary.totalChecks > 0 && <span>{"\u00b7"}</span>}
              </>
            )}
            {summary && summary.totalChecks > 0 && (
              <span>
                {summary.metCount} of {summary.totalChecks} met
              </span>
            )}
          </p>
        </div>
        {summary?.nextIsTextOnly && summary.nextRankName ? (
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-tertiary">
              From tracker rules (not tracked automatically)
            </span>
            <p className="text-xs text-secondary">
              {summary.nextRankName}
              {summary.nextRankRequirements ? `: ${summary.nextRankRequirements}` : ""}
            </p>
          </div>
        ) : visibleBars.length > 0 ? (
          <div className="flex flex-col gap-2">
            {visibleBars.map((bar) => (
              <RankBar key={bar.id} bar={bar} />
            ))}
            {bars.length > visibleBars.length && (
              <p className="text-xs text-tertiary">+{bars.length - visibleBars.length} more requirements</p>
            )}
          </div>
        ) : topOfLadder ? null : summary?.nextRankRequirements ? (
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-tertiary">
              From tracker rules (not tracked automatically)
            </span>
            <p className="text-xs text-secondary">{summary.nextRankRequirements}</p>
          </div>
        ) : summary?.targetReached ? null : (
          <p className="text-xs text-tertiary">
            {summary?.status === "unsupported"
              ? "No next-class requirements are published for this tracker."
              : "No structured requirement to show."}
          </p>
        )}
      </div>
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2.5">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <a
            href={tracker.baseUrl.startsWith("http") ? tracker.baseUrl : `https://${tracker.baseUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-1 text-xs text-secondary underline-offset-2 hover:text-accent hover:underline sm:min-h-9"
            data-card-site-link
          >
            Open site
            <ExternalLinkSmallIcon width="12" height="12" aria-hidden="true" />
          </a>
          {manualLogin && (
            <>
              <span className="text-tertiary">{"\u00b7"}</span>
              <span className="font-mono text-xs text-secondary" data-last-login>
                {lastLoginLabel(loginMarking.lastAccessAt, now)}
              </span>
            </>
          )}
        </div>
        {manualLogin && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {loginMarking.undo ? (
              <>
                <span className="font-mono text-xs text-success" role="status">
                  Logged in today
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void loginMarking.undoMark()}
                  disabled={loginMarking.saving}
                  className="min-h-11 sm:min-h-9"
                  data-login-undo
                >
                  Undo
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void loginMarking.markLogin()}
                disabled={loginMarking.saving}
                className="min-h-11 sm:min-h-9"
                data-login-button
              >
                {loginMarking.saving ? "Saving…" : "Logged in today"}
              </Button>
            )}
            {loginMarking.error && (
              <span className="text-xs text-danger" role="alert">
                Could not record login
              </span>
            )}
          </div>
        )}
      </div>
    </article>
  )
}

export function TrackerGrid({
  trackers,
  summaries,
  now = new Date(),
  onTrackerUpdated,
}: TrackerGridProps) {
  const byId = new Map(summaries.map((summary) => [summary.trackerId, summary]))
  return (
    <section className="flex flex-col gap-3" aria-label="Tracker cards" data-tracker-grid>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-cond text-lg font-semibold leading-6 tracking-[-0.01em] text-primary">
          Trackers
        </h2>
        <p className="font-mono text-xs text-tertiary">
          {trackers.length} {trackers.length === 1 ? "account" : "accounts"} · as of{" "}
          {formatDate(now)}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {trackers.map((tracker) => (
          <TrackerCard
            key={tracker.id}
            tracker={tracker}
            summary={byId.get(tracker.id)}
            now={now}
            onTrackerUpdated={onTrackerUpdated}
          />
        ))}
      </div>
    </section>
  )
}
