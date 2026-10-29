// src/components/dashboard/TrackerRegister.tsx
//
// The account register: one ruled sheet, one row per tracker, and a
// four-segment viability strip in the last column. This is the dashboard's
// primary read, not a grid of cards.

"use client"

import clsx from "clsx"
import Link from "next/link"
import { platformTypeLabel } from "@/data/platform-types"
import { registryEntryFor } from "@/data/tracker-registry"
import { type AggregateStats, computeAggregateStats } from "@/lib/dashboard"
import {
  formatAccountAge,
  formatBytesFromString,
  formatCount,
  formatRatioDisplay,
  formatTimeAgo,
} from "@/lib/formatters"
import { resolveAccountRatio } from "@/lib/tracker-rules"
import { getHealthLabel, getTrackerHealth, type TrackerHealth } from "@/lib/tracker-status"
import type { TrackerSummary } from "@/types/api"

type Tone = "ok" | "warn" | "crit" | "muted"

interface LoginWindow {
  days: number | null
  label: string
  tone: Tone
  reason: string
}

interface RegisterRow {
  tracker: TrackerSummary
  health: TrackerHealth
  statusTone: Tone
  ratio: string
  buffer: string
  seeding: string
  uploaded: MetricReadout
  downloaded: MetricReadout
  bonus: MetricReadout
  login: LoginWindow
  rank: string
  shortAge: string | null
  abbreviation: string
  statusLabel: string
  segments: Tone[]
  passed: number
}

interface MetricReadout {
  text: string
  title: string
  marker: "*" | "?" | null
}

interface SnapshotReadout {
  hasStats: boolean
  state: "fresh" | "stale" | "unknown"
  polledAt: string | null
  age: string | null
}

const SNAPSHOT_STALE_MS = 2 * 60 * 60 * 1000

const TONE_MARK: Record<Tone, string> = {
  ok: "bg-success",
  warn: "bg-warn",
  crit: "bg-danger",
  muted: "bg-muted",
}

function healthTone(health: TrackerHealth): Tone {
  if (health === "healthy") return "ok"
  if (health === "warning" || health === "no-seeds" || health === "paused-user") return "warn"
  if (health === "critical" || health === "error" || health === "paused") return "crit"
  return "muted"
}

function readLoginWindow(tracker: TrackerSummary): LoginWindow {
  const interval = registryEntryFor(tracker)?.rules?.loginIntervalDays
  if (interval === undefined) {
    return {
      days: null,
      label: "—",
      tone: "muted",
      reason: "No login interval is defined for this tracker.",
    }
  }
  if (interval === 0) {
    return {
      days: null,
      label: "—",
      tone: "muted",
      reason: "This tracker has no mandatory login interval.",
    }
  }
  if (!tracker.lastAccessAt) {
    return {
      days: null,
      label: "—",
      tone: "muted",
      reason: "The adapter has not captured a last-access date for this tracker.",
    }
  }
  const last = new Date(tracker.lastAccessAt).getTime()
  if (Number.isNaN(last)) {
    return {
      days: null,
      label: "—",
      tone: "muted",
      reason: "The captured last-access date could not be parsed.",
    }
  }
  const remaining = interval * 86_400_000 - (Date.now() - last)
  const days = Math.max(0, Math.floor(remaining / 86_400_000))
  const tone: Tone = days <= 2 ? "crit" : days <= 7 ? "warn" : "ok"
  if (remaining <= 0) {
    return { days: 0, label: "due", tone: "crit", reason: "The login window is overdue." }
  }
  if (days < 1) {
    return {
      days,
      label: `${Math.max(1, Math.floor(remaining / 3_600_000))}h`,
      tone,
      reason: `Next login is due in ${Math.max(1, Math.floor(remaining / 3_600_000))} hours.`,
    }
  }
  return { days, label: `${days}d`, tone, reason: `Next login is due in ${days} days.` }
}

function readBuffer(tracker: TrackerSummary): { display: string; tone: Tone } {
  const raw = tracker.latestStats?.bufferBytes
  if (!raw) return { display: "—", tone: "muted" }
  try {
    const value = BigInt(raw)
    const display = formatBytesFromString(raw)
    return {
      display: value > 0n && !display.startsWith("+") ? `+${display}` : display,
      tone: value > 0n ? "ok" : value < 0n ? "crit" : "warn",
    }
  } catch {
    return { display: formatBytesFromString(raw), tone: "muted" }
  }
}

function readSegments(tracker: TrackerSummary, login: LoginWindow): Tone[] {
  const stats = tracker.latestStats
  if (!stats) return ["muted", "muted", "muted", "muted"]

  const requirement =
    resolveAccountRatio(stats.requiredRatio, registryEntryFor(tracker)?.rules) ?? 1
  const ratioTone: Tone = stats.ratioIsInfinite
    ? "ok"
    : stats.ratio === null
      ? "muted"
      : stats.ratio >= 2 * requirement
        ? "ok"
        : stats.ratio >= requirement
          ? "warn"
          : "crit"

  const bufferTone = readBuffer(tracker).tone

  const seedTone: Tone =
    stats.seedingCount === null ? "muted" : stats.seedingCount > 0 ? "ok" : "crit"

  return [ratioTone, bufferTone, seedTone, login.tone]
}

function readSnapshot(tracker: TrackerSummary, now: Date): SnapshotReadout {
  if (!tracker.latestStats) {
    return { hasStats: false, state: "unknown", polledAt: null, age: null }
  }
  if (!tracker.lastPolledAt) {
    return { hasStats: true, state: "unknown", polledAt: null, age: null }
  }
  const polled = new Date(tracker.lastPolledAt)
  if (Number.isNaN(polled.getTime())) {
    return { hasStats: true, state: "unknown", polledAt: tracker.lastPolledAt, age: null }
  }
  const ageMs = Math.max(0, now.getTime() - polled.getTime())
  return {
    hasStats: true,
    state: ageMs > SNAPSHOT_STALE_MS ? "stale" : "fresh",
    polledAt: tracker.lastPolledAt,
    age: formatTimeAgo(tracker.lastPolledAt),
  }
}

function readMetric(
  value: string | number | null | undefined,
  format: (value: string | number) => string,
  snapshot: SnapshotReadout
): MetricReadout {
  if (value === null || value === undefined || value === "") {
    return {
      text: "\u2014",
      title: snapshot.hasStats
        ? "Not reported in the latest snapshot."
        : "No snapshot yet; this value is missing.",
      marker: "?",
    }
  }

  const text = format(value)
  const baseTitle = `${text} from the latest stored snapshot; this is not independent verification of the metric.`
  if (snapshot.state === "stale") {
    return {
      text,
      title: `${baseTitle} Snapshot polled ${snapshot.age ?? "some time"} ago and is stale (older than 2 hours).`,
      marker: "*",
    }
  }
  if (snapshot.state === "unknown") {
    return {
      text,
      title: `${baseTitle} Snapshot poll time is unknown, so freshness cannot be confirmed.`,
      marker: "?",
    }
  }
  return { text, title: baseTitle, marker: null }
}

function MetricValue({ readout }: { readout: MetricReadout }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-0.5 font-mono tabular-nums",
        readout.marker ? "text-secondary" : "text-primary"
      )}
      title={readout.title}
    >
      {readout.text}
      {readout.marker && (
        <span
          role="img"
          className="text-warn"
          aria-label={readout.marker === "*" ? "stale snapshot" : "snapshot age unknown"}
          title={readout.title}
        >
          {readout.marker}
        </span>
      )}
    </span>
  )
}

function compactAge(value: string | null): string | null {
  if (!value) return null
  return value
    .replace(/,\s*/g, " ")
    .replace(/\s*years?/g, "y")
    .replace(/\s*months?/g, "m")
    .replace(/\s*days?/g, "d")
    .replace(/\s+/g, " ")
    .trim()
}

function buildRows(trackers: TrackerSummary[], now: Date): RegisterRow[] {
  return trackers.map((tracker) => {
    const health = getTrackerHealth(tracker)
    const login = readLoginWindow(tracker)
    const segments: Tone[] =
      health === "paused" || health === "error" || health === "offline"
        ? ["muted", "muted", "muted", "muted"]
        : readSegments(tracker, login)
    const buffer = readBuffer(tracker)
    const abbreviation =
      registryEntryFor(tracker)?.abbreviation ?? platformTypeLabel(tracker.platformType)
    const ratio = formatRatioDisplay(tracker.latestStats?.ratio ?? null)
    const snapshot = readSnapshot(tracker, now)
    const stats = tracker.latestStats

    return {
      tracker,
      health,
      statusTone: healthTone(health),
      statusLabel: getHealthLabel(health),
      ratio: ratio.endsWith("x") ? `${ratio.slice(0, -1)}×` : ratio,
      buffer: buffer.display,
      seeding: formatCount(tracker.latestStats?.seedingCount),
      uploaded: readMetric(
        stats?.uploadedBytes,
        (value) => formatBytesFromString(String(value)),
        snapshot
      ),
      downloaded: readMetric(
        stats?.downloadedBytes,
        (value) => formatBytesFromString(String(value)),
        snapshot
      ),
      bonus: readMetric(stats?.seedbonus, (value) => formatCount(Number(value)), snapshot),
      login,
      rank: tracker.latestStats?.group ?? "Unknown",
      shortAge: compactAge(formatAccountAge(tracker.joinedAt)),
      abbreviation,
      segments,
      passed: segments.filter((segment) => segment === "ok").length,
    }
  })
}

function ViabilityStrip({ segments, passed }: { segments: Tone[]; passed: number }) {
  const known = segments.some((segment) => segment !== "muted")
  return (
    <span className="flex items-center gap-2" aria-label={known ? `Checks: ${passed} of 4` : "Checks unknown"} role="img">
      <span className="flex h-[7px] w-[92px] shrink-0 gap-[2px]" aria-hidden="true">
        {segments.map((tone, index) => (
          <span key={index} className={clsx("block h-full flex-1", TONE_MARK[tone])} />
        ))}
      </span>
      <span className="font-mono text-xs text-secondary">{known ? `${passed}/4` : "—"}</span>
    </span>
  )
}

function StatusMark({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap">
      <span className={clsx("h-1.5 w-1.5 shrink-0", TONE_MARK[tone])} aria-hidden="true" />
      <span className="font-cond text-xs font-semibold uppercase tracking-[0.12em] text-primary">
        {label}
      </span>
    </span>
  )
}

function AccountCell({ row }: { row: RegisterRow }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span
        className={clsx("h-1.5 w-1.5 shrink-0", TONE_MARK[row.statusTone])}
        aria-hidden="true"
      />
      <span className="min-w-0">
        <span className="block break-words text-sm font-semibold text-primary">
          {row.tracker.name}
        </span>
        <span className="mt-0.5 flex min-w-0 items-center gap-1.5 font-mono text-xs text-secondary">
          {row.statusTone !== "ok" && (
            <>
              <span className="hidden shrink-0 font-cond font-semibold uppercase tracking-[0.08em] text-primary md:inline">
                {row.statusLabel}
              </span>
              <span className="hidden shrink-0 md:inline">·</span>
            </>
          )}
          <span className="truncate">
            {row.abbreviation}
            {row.shortAge ? ` · ${row.shortAge}` : ""}
          </span>
        </span>
      </span>
    </span>
  )
}

function RegisterFoot({ rows }: { rows: RegisterRow[] }) {
  const windows = rows
    .filter((row) => row.login.days !== null)
    .sort((a, b) => (a.login.days ?? 0) - (b.login.days ?? 0))
    .slice(0, 4)

  const hnr = rows
    .filter((row) => (row.tracker.latestStats?.hitAndRuns ?? 0) > 0)
    .sort(
      (a, b) =>
        (b.tracker.latestStats?.hitAndRuns ?? 0) - (a.tracker.latestStats?.hitAndRuns ?? 0)
    )
    .slice(0, 4)

  const polled = rows.filter((row) => row.tracker.lastPolledAt)
  const latestPoll = polled
    .map((row) => row.tracker.lastPolledAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1)
  const errors = rows.filter((row) => row.tracker.lastError).length

  return (
    <div id="today" className="border-t border-border-emphasis bg-raised">
      <div className="flex items-center justify-between border-b border-border px-4 py-1.5">
        <span className="font-cond text-xs font-semibold uppercase tracking-[0.16em] text-secondary">
          Today
        </span>
        <span className="font-mono text-xs text-tertiary">login windows · H&amp;R · poll</span>
      </div>
      <div className="grid md:grid-cols-3">
      <section className="border-b border-border px-4 py-3 md:border-b-0 md:border-r">
        <h2 className="font-cond text-xs font-semibold uppercase tracking-[0.16em] text-secondary">
          Login windows
        </h2>
        {windows.length === 0 ? (
          <p className="mt-2 text-xs text-secondary">No login intervals on record.</p>
        ) : (
          <ul className="mt-1.5 flex flex-col">
            {windows.map((row) => (
              <li
                key={row.tracker.id}
                className="flex items-center justify-between gap-3 border-b border-border-soft py-1.5 last:border-b-0"
              >
                <Link
                  href={`/trackers/${row.tracker.id}`}
                  className="flex min-h-6 min-w-6 items-center truncate text-xs font-medium text-secondary hover:text-primary"
                >
                  {row.tracker.name}
                </Link>
                <span className="font-mono text-xs text-secondary">{row.login.label}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="border-b border-border px-4 py-3 md:border-b-0 md:border-r">
        <h2 className="font-cond text-xs font-semibold uppercase tracking-[0.16em] text-secondary">
          H&amp;R watch
        </h2>
        {hnr.length === 0 ? (
          <p className="mt-2 text-xs text-secondary">No open H&amp;R on the register.</p>
        ) : (
          <ul className="mt-1.5 flex flex-col">
            {hnr.map((row) => (
              <li
                key={row.tracker.id}
                className="flex items-center justify-between gap-3 border-b border-border-soft py-1.5 last:border-b-0"
              >
                <Link
                  href={`/trackers/${row.tracker.id}`}
                  className="flex min-h-6 min-w-6 items-center truncate text-xs font-medium text-secondary hover:text-primary"
                >
                  {row.tracker.name}
                </Link>
                <span className="font-mono text-xs text-danger">
                  {row.tracker.latestStats?.hitAndRuns} open
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="px-4 py-3">
        <h2 className="font-cond text-xs font-semibold uppercase tracking-[0.16em] text-secondary">
          Poll status
        </h2>
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
          <div>
            <dt className="font-mono text-xs text-secondary">Polled</dt>
            <dd className="font-mono text-sm text-primary">
              {polled.length}/{rows.length}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-xs text-secondary">Errors</dt>
            <dd className={clsx("font-mono text-sm", errors > 0 ? "text-danger" : "text-primary")}>
              {errors}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="font-mono text-xs text-secondary">Last poll</dt>
            <dd className="font-mono text-xs text-secondary">
              {latestPoll ? formatTimeAgo(latestPoll) : "Not polled yet"}
            </dd>
          </div>
        </dl>
      </section>
      </div>
    </div>
  )
}

function TrackerRegister({
  trackers,
  now = new Date(),
  aggregateStats,
  attentionCount = 0,
  showTotals = true,
}: {
  trackers: TrackerSummary[]
  now?: Date
  aggregateStats?: AggregateStats
  attentionCount?: number
  showTotals?: boolean
}) {
  const rows = buildRows(trackers, now)
  const aggregate = aggregateStats ?? computeAggregateStats(trackers)
  const included = trackers.filter((tracker) => tracker.latestStats)
  const missing = trackers.length - included.length
  const staleIncluded = included.some((tracker) => readSnapshot(tracker, now).state === "stale")
  const overallRatio = aggregate.avgRatio
  const uploadedDisplay = included.length === 0 ? "\u2014" : formatBytesFromString(aggregate.totalUploaded)
  const downloadedDisplay =
    included.length === 0 ? "\u2014" : formatBytesFromString(aggregate.totalDownloaded)
  const ratioDisplay = overallRatio === null ? "—" : formatRatioDisplay(overallRatio)

  return (
    <section id="register" className="flex scroll-mt-16 flex-col gap-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-cond text-4xl font-semibold leading-none tracking-[-0.01em] text-primary">
            Account register
          </h1>
          <p className="mt-2 font-mono text-xs text-secondary">
            {rows.length} {rows.length === 1 ? "tracker" : "trackers"} · last poll{" "}
            {rows
              .map((row) => row.tracker.lastPolledAt)
              .filter((value): value is string => Boolean(value))
              .sort()
              .at(-1)
              ? formatTimeAgo(
                  rows
                    .map((row) => row.tracker.lastPolledAt)
                    .filter((value): value is string => Boolean(value))
                    .sort()
                    .at(-1) as string
                )
              : "not yet"}
          </p>
        </div>
      </div>

      {showTotals && (
        <>
          <div className="grid grid-cols-2 border-y border-border-emphasis bg-raised md:grid-cols-4">
        <div className="border-b border-r border-border px-4 py-3 md:border-b-0">
          <span className="block font-mono text-2xl font-medium leading-none tracking-[-0.04em] text-primary">
            {uploadedDisplay}
          </span>
          <span className="mt-1.5 block font-cond text-xs font-semibold uppercase tracking-[0.16em] text-secondary">
            Total uploaded
          </span>
        </div>
        <div className="border-b border-border px-4 py-3 md:border-b-0 md:border-r">
          <span className="block font-mono text-2xl font-medium leading-none tracking-[-0.04em] text-download">
            {downloadedDisplay}
          </span>
          <span className="mt-1.5 block font-cond text-xs font-semibold uppercase tracking-[0.16em] text-secondary">
            Total downloaded
          </span>
        </div>
        <div className="border-r border-border px-4 py-3">
          <span className="block font-mono text-2xl font-medium leading-none tracking-[-0.04em] text-primary">
            {ratioDisplay}
          </span>
          <span className="mt-1.5 block font-cond text-xs font-semibold uppercase tracking-[0.16em] text-secondary">
            Overall ratio
          </span>
        </div>
        <div className="px-4 py-3">
          <span className="block font-mono text-2xl font-medium leading-none tracking-[-0.04em] text-primary">
            {String(attentionCount).padStart(2, "0")}
          </span>
          <span className="mt-1.5 block font-cond text-xs font-semibold uppercase tracking-[0.16em] text-secondary">
            Need attention
          </span>
        </div>
      </div>
      {(missing > 0 || staleIncluded) && (
        <p className="font-mono text-xs text-tertiary">
          {missing > 0
            ? `Totals from ${included.length} of ${trackers.length} trackers with a snapshot.`
            : `Totals from ${trackers.length} trackers.`}
          {staleIncluded && (
            <span
              className="ml-1 text-warn"
              title="One or more included snapshots are older than two hours."
            >
              * Needs checking
            </span>
          )}
        </p>
      )}
        </>
      )}

      <div className="hidden border border-border bg-raised min-[1280px]:block">
        <div className="grid h-8 grid-cols-[1.45fr_.55fr_.85fr_1.1fr_.55fr_.8fr_.9fr_1.05fr] items-center border-b border-border-emphasis bg-elevated px-1">
          {["Account", "Ratio", "Buffer", "Transfer", "Seeding", "Login due", "Rank", "Checks"].map(
            (label) => (
              <span
                key={label}
                className="px-3 font-cond text-xs font-semibold uppercase tracking-[0.14em] text-secondary"
              >
                {label}
              </span>
            )
          )}
        </div>
        <ul className="m-0 list-none p-0">
          {rows.map((row) => (
            <li key={row.tracker.id} className="border-b border-border last:border-b-0">
              <Link
                href={`/trackers/${row.tracker.id}`}
                className={clsx(
                  "grid h-16 grid-cols-[1.45fr_.55fr_.85fr_1.1fr_.55fr_.8fr_.9fr_1.05fr] items-center px-1 transition-colors duration-150 hover:bg-elevated",
                  row.statusTone === "crit" && "bg-danger-dim",
                  row.statusTone === "warn" && "bg-warn-dim"
                )}
              >
                <span className="px-3">
                  <AccountCell row={row} />
                </span>
                <span className="px-3 font-mono text-sm tabular-nums text-[var(--color-ratio)]">
                  {row.ratio}
                </span>
                <span className="whitespace-nowrap px-3 font-mono text-sm tabular-nums text-secondary">
                  {row.buffer}
                </span>
                <span
                  className="flex flex-col gap-[1px] px-3 font-mono text-sm tabular-nums"
                  title="Transfer totals and tracker-specific bonus points from the latest snapshot; not client speed."
                >
                  <span className="flex items-center justify-between gap-1.5">
                    <span className="text-xs text-tertiary">Upload</span>
                    <MetricValue readout={row.uploaded} />
                  </span>
                  <span className="flex items-center justify-between gap-1.5">
                    <span className="text-xs text-tertiary">Download</span>
                    <MetricValue readout={row.downloaded} />
                  </span>
                  <span className="flex items-center justify-between gap-1.5">
                    <span className="text-xs text-tertiary">Bonus</span>
                    <MetricValue readout={row.bonus} />
                  </span>
                </span>
                <span className="px-3 font-mono text-sm tabular-nums text-secondary">
                  {row.seeding}
                </span>
                <span className="flex cursor-help items-center gap-2 px-3" title={row.login.reason}>
                  <span className="block h-1 w-10 bg-border">
                    <span
                      className={clsx("block h-1", TONE_MARK[row.login.tone])}
                      style={{
                        width:
                          row.login.days === null
                            ? "0%"
                            : `${Math.max(10, Math.min(100, row.login.days * 3))}%`,
                      }}
                    />
                  </span>
                  <span className="font-mono text-sm text-primary">{row.login.label}</span>
                </span>
                <span
                  className="min-w-0 truncate px-3 font-mono text-sm text-secondary"
                  title={row.rank}
                >
                  {row.rank}
                </span>
                <span className="px-3">
                  <ViabilityStrip segments={row.segments} passed={row.passed} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="border border-border bg-raised min-[1280px]:hidden">
        <ul className="m-0 list-none p-0">
          {rows.map((row) => (
            <li key={row.tracker.id} className="border-b border-border last:border-b-0">
              <Link
                href={`/trackers/${row.tracker.id}`}
                className={clsx(
                  "flex flex-col gap-2 px-3 py-3",
                  row.statusTone === "crit" && "bg-danger-dim",
                  row.statusTone === "warn" && "bg-warn-dim"
                )}
              >
                <span className="flex items-start justify-between gap-3">
                  <AccountCell row={row} />
                  <StatusMark tone={row.statusTone} label={getHealthLabel(row.health)} />
                </span>
                <span className="grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-border-soft pt-2">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="slot-label">Ratio</span>
                    <span className="font-mono text-sm text-[var(--color-ratio)]">{row.ratio}</span>
                  </span>
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="slot-label">Buffer</span>
                    <span className="font-mono text-sm text-secondary">{row.buffer}</span>
                  </span>
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="slot-label">Seeding</span>
                    <span className="font-mono text-sm text-secondary">{row.seeding}</span>
                  </span>
                  <span className="col-span-2 grid grid-cols-2 gap-2 border-t border-border-soft pt-2 sm:grid-cols-3">
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="slot-label">Uploaded</span>
                      <MetricValue readout={row.uploaded} />
                    </span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="slot-label">Downloaded</span>
                      <MetricValue readout={row.downloaded} />
                    </span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="slot-label">Bonus (pts)</span>
                      <MetricValue readout={row.bonus} />
                    </span>
                  </span>
                  <span
                    className="flex items-baseline justify-between gap-2"
                    title={row.login.reason}
                  >
                    <span className="slot-label">Login</span>
                    <span className="cursor-help font-mono text-xs text-primary">
                      {row.login.label}
                    </span>
                  </span>
                  <span className="col-span-2 flex items-center justify-between gap-2 pt-1">
                    <span className="slot-label">{row.rank}</span>
                    <ViabilityStrip segments={row.segments} passed={row.passed} />
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <p className="font-mono text-xs text-tertiary">
        Transfer values and bonus are from the latest stored snapshot, not client speed.{" "}
        {"\u2014"} no data {"\u00b7"} * stale snapshot (&gt;2h) {"\u00b7"} ? snapshot age
        unknown. Bonus points are tracker-specific.
      </p>

      <RegisterFoot rows={rows} />
    </section>
  )
}

export { TrackerRegister }
