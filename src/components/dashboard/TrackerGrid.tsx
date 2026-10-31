// src/components/dashboard/TrackerGrid.tsx

"use client"

import { ExternalLinkSmallIcon } from "@icons"
import clsx from "clsx"
import Link from "next/link"
import { useEffect, useState } from "react"
import { CHART_THEME } from "@/components/charts/lib/theme"
import { Button, PulseDot } from "@/components/ui"
import { DeadlineRing } from "@/components/ui/DeadlineRing"
import { EyeIcon, UserIcon } from "@/components/ui/Icons"
import { RequirementBarTrack } from "@/components/ui/RequirementBarTrack"
import { Tooltip } from "@/components/ui/Tooltip"
import { registryEntryFor } from "@/data/tracker-registry"
import {
  formatAccountAge,
  formatBytesFromString,
  formatClockTime,
  formatCount,
  formatDate,
  formatDateTime,
  formatMemberSinceDate,
  formatRatioDisplay,
  localDateStr,
} from "@/lib/formatters"
import { type LoginDeadline, readLoginDeadline } from "@/lib/login-deadline"
import { loginSourceFor } from "@/lib/login-detection"
import type { RankGoalSummary, RankSummaryBar } from "@/lib/rank-summary"
import { requirementBarGeometry, strictThresholdRequirement } from "@/lib/requirement-bar"
import { getSnapshotReadout } from "@/lib/snapshot-freshness"
import { getTrackerChecks, readLoginWindow } from "@/lib/tracker-checks"
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
  /** Defaults to on; the dashboard passes the saved setting. */
  markLoginOnSiteOpen?: boolean
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

interface LoginMarkUndo {
  previous: string | null
}

function useLoginMarking(
  tracker: TrackerSummary,
  now: Date,
  onUpdated?: (tracker: TrackerSummary) => void
) {
  const [lastAccessAt, setLastAccessAt] = useState(tracker.lastAccessAt)
  const [lastAccessSource, setLastAccessSource] = useState(tracker.lastAccessSource ?? null)
  const [lastAccessField, setLastAccessField] = useState(tracker.lastAccessField ?? null)
  const [lastAccessUpdatedAt, setLastAccessUpdatedAt] = useState(
    tracker.lastAccessUpdatedAt ?? null
  )
  const [undo, setUndo] = useState<LoginMarkUndo | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    setLastAccessAt(tracker.lastAccessAt)
    setLastAccessSource(tracker.lastAccessSource ?? null)
    setLastAccessField(tracker.lastAccessField ?? null)
    setLastAccessUpdatedAt(tracker.lastAccessUpdatedAt ?? null)
  }, [
    tracker.lastAccessAt,
    tracker.lastAccessSource,
    tracker.lastAccessField,
    tracker.lastAccessUpdatedAt,
  ])

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
      setLastAccessSource(updated.lastAccessSource ?? null)
      setLastAccessField(updated.lastAccessField ?? null)
      setLastAccessUpdatedAt(updated.lastAccessUpdatedAt ?? null)
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
      setLastAccessSource(updated.lastAccessSource ?? null)
      setLastAccessField(updated.lastAccessField ?? null)
      setLastAccessUpdatedAt(updated.lastAccessUpdatedAt ?? null)
      setUndo(null)
      onUpdated?.(updated)
    } catch {
      setError(true)
    } finally {
      setSaving(false)
    }
  }

  return {
    lastAccessAt,
    lastAccessSource,
    lastAccessField,
    lastAccessUpdatedAt,
    undo,
    saving,
    error,
    markLogin,
    undoMark,
  }
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
}

function LoginProvenance({
  source,
  field,
  updatedAt,
}: {
  source: "detected" | "manual"
  field: string | null
  updatedAt: string | null
}) {
  return (
    <span className="flex flex-col gap-0.5" data-login-provenance>
      <span className="font-medium text-primary">
        {source === "detected" ? "Detected from the tracker" : "Marked by you"}
      </span>
      <span>Field: {field ?? "unknown"}</span>
      <span>Last updated: {updatedAt ? formatDateTime(updatedAt) : "unknown"}</span>
    </span>
  )
}

function LoginDeadlineReadout({
  deadline,
  source,
  field,
  updatedAt,
}: {
  deadline: LoginDeadline
  source: "detected" | "manual"
  field: string | null
  updatedAt: string | null
}) {
  if (!deadline.hasRule) {
    return (
      <span className="text-xs text-tertiary" data-login-no-rule>
        No login rule
      </span>
    )
  }

  if (deadline.dueAt === null || deadline.lastLoginDays === null) {
    return (
      <span className="text-xs text-tertiary" data-login-unknown>
        No login recorded
      </span>
    )
  }

  const overdueDays = deadline.overdueDays
  const intervalDays = deadline.intervalDays ?? 0
  const progress = intervalDays > 0 ? deadline.lastLoginDays / intervalDays : 0
  const daysLeft = deadline.dueInDays ?? 0
  const dueDate = formatDate(deadline.dueAt)
  const daysLabel = daysLeft === 1 ? "day" : "days"
  const overdueLabel = overdueDays === 1 ? "day" : "days"
  const color =
    overdueDays !== null
      ? "var(--color-danger)"
      : deadline.tone === "warn"
        ? "var(--color-warn)"
        : "var(--color-success)"
  const ariaLabel =
    overdueDays !== null
      ? `Login overdue by ${overdueDays} ${overdueDays === 1 ? "day" : "days"}, due by ${dueDate}`
      : `Login due in ${daysLeft} ${daysLabel}, by ${dueDate}`

  return (
    <div className="flex min-w-0 items-center gap-1.5" data-login-ring data-login-tone={deadline.tone}>
      <Tooltip content={<LoginProvenance source={source} field={field} updatedAt={updatedAt} />}>
        <span className="inline-flex shrink-0">
          <DeadlineRing
            progress={progress}
            color={color}
            ariaLabel={ariaLabel}
            size={40}
            strokeWidth={4}
          >
            {overdueDays !== null ? (
              <span
                className="font-mono text-[14px] font-semibold leading-none"
                style={{ color }}
                data-ring-value
              >
                !
              </span>
            ) : (
              <span
                className="font-mono text-[13px] font-semibold leading-none tabular-nums"
                style={{ color }}
                data-ring-value
              >
                {daysLeft}
              </span>
            )}
          </DeadlineRing>
        </span>
      </Tooltip>
      <span
        className={clsx(
          "min-w-0 font-mono text-xs",
          overdueDays !== null ? "text-danger" : "text-tertiary"
        )}
        data-login-by
      >
        {overdueDays !== null ? (
          <>
            overdue by{" "}
            <span className="whitespace-nowrap">
              {overdueDays} {overdueLabel}
            </span>
          </>
        ) : (
          <span className="whitespace-nowrap">by&nbsp;{dueDate}</span>
        )}
      </span>
    </div>
  )
}

function LoginSourceIcon({ source }: { source: "detected" | "manual" }) {
  const label = source === "detected" ? "Detected from the tracker" : "Marked by you"
  const Icon = source === "detected" ? EyeIcon : UserIcon
  return (
    <Tooltip content={label}>
      <button
        type="button"
        aria-label={label}
        data-login-source={source}
        className="inline-flex h-11 w-11 items-center justify-center rounded-nm-sm text-tertiary transition-colors duration-150 hover:text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-focus)] focus-visible:ring-offset-1 focus-visible:ring-offset-base sm:h-5 sm:w-5"
      >
        <Icon width="12" height="12" aria-hidden="true" />
      </button>
    </Tooltip>
  )
}

function TrackerCard({
  tracker,
  summary,
  now,
  onTrackerUpdated,
  markLoginOnSiteOpen = true,
}: {
  tracker: TrackerSummary
  summary: RankGoalSummary | undefined
  now: Date
  onTrackerUpdated?: (tracker: TrackerSummary) => void
  markLoginOnSiteOpen?: boolean
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
  const loginMarking = useLoginMarking(tracker, now, onTrackerUpdated)
  const loginWindow = readLoginWindow(
    { ...tracker, lastAccessAt: loginMarking.lastAccessAt },
    now
  )
  const loginDeadline = readLoginDeadline({
    lastAccessAt: loginMarking.lastAccessAt,
    intervalDays: registryEntryFor(tracker)?.rules?.loginIntervalDays,
    now,
  })
  const loginDueSoon = loginWindow.tone === "warn" || loginWindow.tone === "crit"
  const loginSource = loginSourceFor({
    lastAccessAt: loginMarking.lastAccessAt,
    lastAccessSource: loginMarking.lastAccessSource,
  })
  const manualLogin = loginSource !== "detected"
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

      <div
        className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-2 border-t border-border px-4 py-2.5"
        data-card-footer
      >
        <div className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-1 xl:flex-1 xl:flex-nowrap">
          <LoginDeadlineReadout
            deadline={loginDeadline}
            source={loginSource === "detected" ? "detected" : "manual"}
            field={loginMarking.lastAccessField}
            updatedAt={loginMarking.lastAccessUpdatedAt}
          />
          {loginSource === "none" || !loginDeadline.hasRule ? null : (
            <LoginSourceIcon source={loginSource} />
          )}
        </div>
        <div
          className="flex w-full flex-wrap items-center gap-1 sm:ml-auto sm:w-auto sm:justify-end"
          data-card-footer-actions
        >
          <a
            href={tracker.baseUrl.startsWith("http") ? tracker.baseUrl : `https://${tracker.baseUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-1 text-xs text-secondary underline-offset-2 hover:text-accent hover:underline sm:min-h-9"
            onClick={() => {
              if (manualLogin && markLoginOnSiteOpen) void loginMarking.markLogin()
            }}
            data-card-site-link
            aria-label={`Open ${tracker.name} site`}
          >
            Open site
            <ExternalLinkSmallIcon width="12" height="12" aria-hidden="true" />
          </a>
          {manualLogin && (
            <>
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
                  variant={loginDueSoon ? "primary" : "secondary"}
                  onClick={() => void loginMarking.markLogin()}
                  disabled={loginMarking.saving}
                  className="min-h-11 sm:min-h-9"
                  data-login-button
                  data-login-due={loginDueSoon ? "true" : undefined}
                >
                  {loginMarking.saving ? "Saving…" : "Logged in today"}
                </Button>
              )}
              {loginMarking.error && (
                <span className="text-xs text-danger" role="alert">
                  Could not record login
                </span>
              )}
            </>
          )}
        </div>
      </div>
    </article>
  )
}

export function TrackerGrid({
  trackers,
  summaries,
  now = new Date(),
  onTrackerUpdated,
  markLoginOnSiteOpen = true,
}: TrackerGridProps) {
  const byId = new Map(summaries.map((summary) => [summary.trackerId, summary]))
  return (
    <section className="flex flex-col gap-3" aria-label="Tracker cards" data-tracker-grid>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
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
            markLoginOnSiteOpen={markLoginOnSiteOpen}
          />
        ))}
      </div>
    </section>
  )
}
