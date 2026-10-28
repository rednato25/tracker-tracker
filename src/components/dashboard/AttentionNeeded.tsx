import clsx from "clsx"
import Link from "next/link"
import { useMemo, useState } from "react"
import { FilterPill } from "@/components/ui/FilterPill"
import { InfoIcon, TriangleWarningIcon } from "@/components/ui/Icons"
import type { TrackerAction } from "@/lib/actions"
import type { TrackerSummary } from "@/types/api"

type AttentionFilter = "attention" | "unknown" | "healthy" | "all"
type RowTone = "crit" | "warn" | "muted" | "ok"

interface AttentionNeededProps {
  trackers: TrackerSummary[]
  actions: TrackerAction[]
  loading?: boolean
  error?: boolean
  clientsUnavailable?: boolean
  /** Server-rendered time; the pure engine receives this same value upstream. */
  asOf: string
}

const FILTER_LABELS: Record<AttentionFilter, string> = {
  attention: "Needs attention",
  unknown: "Unknown",
  healthy: "Healthy",
  all: "All",
}

const TONE_MARK: Record<RowTone, string> = {
  crit: "bg-danger",
  warn: "bg-warn",
  muted: "bg-muted",
  ok: "bg-success",
}

function statusMeta(status: TrackerAction["status"]) {
  if (status === "action-required") {
    return { tone: "crit" as const, label: "Action required", icon: TriangleWarningIcon }
  }
  return { tone: "warn" as const, label: "Needs verification", icon: InfoIcon }
}

function actionDestination(action: TrackerAction): string {
  if (action.clientId != null || action.trackerId === null) return "/settings"
  return `/trackers/${action.trackerId}`
}

function formatEvidenceValue(value: unknown): string {
  if (value === null || value === undefined) return "—"
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(2)
  return String(value)
}

function StatusMark({ tone, label }: { tone: RowTone; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-cond text-xs font-semibold uppercase tracking-[0.1em] text-secondary">
      <span className={clsx("size-1.5 rounded-[1px]", TONE_MARK[tone])} aria-hidden="true" />
      {label}
    </span>
  )
}

function ActionEvidence({ action }: { action: TrackerAction }) {
  const evidence = action.evidence
  return (
    <details className="mt-2 border-t border-border pt-2">
      <summary className="cursor-pointer font-cond text-xs uppercase tracking-[0.1em] text-tertiary focus-visible:outline-1 focus-visible:outline-accent">
        Evidence and source
      </summary>
      <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 font-mono text-xs text-tertiary sm:grid-cols-2">
        <div className="flex gap-2">
          <dt className="text-muted">key</dt>
          <dd className="break-all">{action.key}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted">type</dt>
          <dd>{action.type}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted">priority</dt>
          <dd>{action.priority}</dd>
        </div>
        {evidence.value !== undefined && (
          <div className="flex gap-2">
            <dt className="text-muted">observed</dt>
            <dd>{formatEvidenceValue(evidence.value)}</dd>
          </div>
        )}
        {evidence.required !== undefined && (
          <div className="flex gap-2">
            <dt className="text-muted">required</dt>
            <dd>{formatEvidenceValue(evidence.required)}</dd>
          </div>
        )}
        {evidence.observedAt && (
          <div className="flex gap-2">
            <dt className="text-muted">timestamp</dt>
            <dd>{evidence.observedAt}</dd>
          </div>
        )}
        {evidence.verifiedAt && (
          <div className="flex gap-2">
            <dt className="text-muted">verified</dt>
            <dd>{evidence.verifiedAt}</dd>
          </div>
        )}
        {evidence.source && (
          <div className="flex gap-2">
            <dt className="text-muted">source</dt>
            <dd>{evidence.source}</dd>
          </div>
        )}
        {evidence.freshness && (
          <div className="flex gap-2">
            <dt className="text-muted">freshness</dt>
            <dd>{evidence.freshness}</dd>
          </div>
        )}
        {evidence.note && (
          <div className="col-span-full flex gap-2">
            <dt className="text-muted">note</dt>
            <dd>{evidence.note}</dd>
          </div>
        )}
      </dl>
    </details>
  )
}

function ActionRow({ action, tracker }: { action: TrackerAction; tracker?: TrackerSummary }) {
  const meta = statusMeta(action.status)
  const Icon = meta.icon
  const destination = actionDestination(action)
  return (
    <article
      className="grid gap-2 border-t border-border px-3 py-3 md:grid-cols-[7rem_minmax(9rem,1fr)_minmax(12rem,2fr)_minmax(8rem,1fr)] md:items-start md:gap-4"
      data-action-key={action.key}
    >
      <div className="flex items-center gap-2 md:block">
        <Icon
          width="14"
          height="14"
          className={action.status === "action-required" ? "text-danger" : "text-warn"}
          aria-hidden="true"
        />
        <StatusMark tone={meta.tone} label={meta.label} />
      </div>
      <div className="min-w-0">
        <Link
          href={destination}
          className="font-cond text-xs font-semibold uppercase tracking-[0.06em] text-primary underline-offset-2 hover:underline focus-visible:outline-1 focus-visible:outline-accent"
        >
          {tracker?.name ?? action.trackerName}
        </Link>
        {action.torrentHash && (
          <p className="mt-1 break-all font-mono text-xs text-tertiary">
            Torrent {action.torrentHash.slice(0, 12)}…
          </p>
        )}
        <p className="mt-1 font-mono text-xs text-muted">{action.type}</p>
      </div>
      <div className="min-w-0">
        <p className="text-xs leading-5 text-secondary">{action.reason}</p>
        {action.deadline && (
          <p className="mt-1 font-mono text-xs text-tertiary">Deadline {action.deadline}</p>
        )}
        <ActionEvidence action={action} />
      </div>
      <div className="flex items-start">
        <Link
          href={destination}
          className="font-cond text-xs font-semibold uppercase tracking-[0.1em] text-accent underline-offset-2 hover:underline focus-visible:outline-1 focus-visible:outline-accent"
        >
          {action.nextAction}
        </Link>
      </div>
    </article>
  )
}

function ClearRow({ tracker }: { tracker: TrackerSummary }) {
  return (
    <article
      className="grid gap-2 border-t border-border px-3 py-3 md:grid-cols-[7rem_minmax(9rem,1fr)_minmax(12rem,2fr)_minmax(8rem,1fr)] md:items-center md:gap-4"
      data-clear-tracker={tracker.id}
    >
      <StatusMark tone="ok" label="Clear" />
      <Link
        href={`/trackers/${tracker.id}`}
        className="font-cond text-xs font-semibold uppercase tracking-[0.06em] text-primary underline-offset-2 hover:underline focus-visible:outline-1 focus-visible:outline-accent"
      >
        {tracker.name}
      </Link>
      <p className="text-xs text-secondary">No action or verification item is recorded.</p>
      <span className="font-mono text-xs text-muted">No next action</span>
    </article>
  )
}

/**
 * P05 compact attention surface. Classification, priority, deadlines and keys
 * come from `computeTrackerActions`; this component only groups and renders.
 */
export function AttentionNeeded({
  trackers,
  actions,
  loading = false,
  error = false,
  clientsUnavailable = false,
  asOf,
}: AttentionNeededProps) {
  const [filter, setFilter] = useState<AttentionFilter>("attention")

  const { actionRows, clearTrackers, actionRequired, verification } = useMemo(() => {
    const byTracker = new Map<number, TrackerAction[]>()
    const clientRows: TrackerAction[] = []
    for (const action of actions) {
      if (action.trackerId === null) {
        clientRows.push(action)
        continue
      }
      const rows = byTracker.get(action.trackerId) ?? []
      rows.push(action)
      byTracker.set(action.trackerId, rows)
    }
    const trackerRows = trackers
      .filter((tracker) => tracker.isActive)
      .map((tracker) => {
        const rows = byTracker.get(tracker.id) ?? []
        const primary = rows.find((row) => row.status === "action-required") ?? rows[0] ?? null
        return { tracker, rows, primary }
      })
    return {
      actionRows: { trackerRows, clientRows },
      clearTrackers: trackerRows.filter((row) => row.rows.length === 0),
      actionRequired: actions.filter((action) => action.status === "action-required").length,
      verification: actions.filter((action) => action.status === "needs-verification").length,
    }
  }, [actions, trackers])

  const filterCounts: Record<AttentionFilter, number> = {
    attention: actionRequired,
    unknown: verification,
    healthy: clearTrackers.length,
    all: actionRequired + verification + clearTrackers.length,
  }

  const visibleTrackerRows = actionRows.trackerRows.filter((row) => {
    if (filter === "all") return true
    if (filter === "healthy") return row.rows.length === 0
    if (filter === "unknown") {
      return row.rows.length > 0 && row.rows.every((action) => action.status === "needs-verification")
    }
    return row.rows.some((action) => action.status === "action-required")
  })

  const visibleClientRows = actionRows.clientRows.filter((action) => {
    if (filter === "all") return true
    if (filter === "healthy") return false
    if (filter === "unknown") return action.status === "needs-verification"
    return action.status === "action-required"
  })

  const hasConfirmed = actionRequired > 0
  const hasVerification = verification > 0
  const fullyLoaded = !loading && !error && !clientsUnavailable
  const allClear = fullyLoaded && !hasConfirmed && !hasVerification && clearTrackers.length > 0
  const noRows = visibleTrackerRows.length === 0 && visibleClientRows.length === 0

  return (
    <section
      className="border border-border bg-raised"
      aria-labelledby="attention-needed-heading"
      data-attention-view
    >
      <div className="flex flex-col gap-3 border-b border-border px-3 py-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2
            id="attention-needed-heading"
            className="font-cond text-lg font-semibold uppercase tracking-[0.08em] text-primary"
          >
            Attention needed
          </h2>
          <p className="mt-1 font-mono text-xs text-tertiary" aria-live="polite" data-testid="attention-counts">
            {actionRequired} action{actionRequired === 1 ? "" : "s"} required ·{" "}
            {verification} need{verification === 1 ? "s" : ""} verification ·{" "}
            {clearTrackers.length} clear
          </p>
        </div>
        <fieldset className="m-0 flex flex-wrap items-center gap-1 border-0 p-0">
          <legend className="sr-only">Filter attention items</legend>
          {(Object.keys(FILTER_LABELS) as AttentionFilter[]).map((key) => (
            <FilterPill
              key={key}
              active={filter === key}
              onClick={() => setFilter(key)}
              size="sm"
              aria-label={`${FILTER_LABELS[key]} (${filterCounts[key]})`}
            >
              {FILTER_LABELS[key]} <span className="text-muted">{filterCounts[key]}</span>
            </FilterPill>
          ))}
        </fieldset>
      </div>

      {loading ? (
        <div className="px-3 py-6" role="status">
          <p className="font-mono text-xs text-secondary">Checking tracker actions…</p>
          <p className="mt-1 font-mono text-xs text-tertiary">
            A clear result is withheld until data finishes loading.
          </p>
        </div>
      ) : error ? (
        <div className="px-3 py-6" role="alert">
          <p className="font-mono text-xs text-danger">Tracker actions could not be loaded.</p>
          <p className="mt-1 font-mono text-xs text-tertiary">
            No clear status is claimed while data is unavailable.
          </p>
        </div>
      ) : (
        <>
          {clientsUnavailable && (
            <p className="border-b border-border px-3 py-2 font-mono text-xs text-warn" role="status">
              Client data is unavailable. Client actions may be missing, so this is not an all-clear.
            </p>
          )}
          {hasVerification && !hasConfirmed && (
            <p className="border-b border-border px-3 py-2 font-mono text-xs text-secondary" role="status">
              No confirmed problems. {verification} item{verification === 1 ? "" : "s"} still need
              verification.
            </p>
          )}
          {allClear && !clientsUnavailable && (
            <p className="border-b border-border px-3 py-2 font-mono text-xs text-success" role="status">
              All clear. No confirmed actions or verification items at {asOf}.
            </p>
          )}
          {noRows ? (
            <div className="px-3 py-6">
              <p className="font-mono text-xs text-secondary">
                {filter === "attention" && hasVerification
                  ? "No confirmed actions in this filter."
                  : filter === "attention"
                    ? "No confirmed actions."
                    : filter === "unknown"
                      ? "No verification items."
                      : filter === "healthy"
                        ? "No clear accounts."
                        : "No tracker actions."}
              </p>
            </div>
          ) : (
            <div>
              {visibleTrackerRows.map(({ tracker, rows, primary }) =>
                primary ? (
                  <div key={`tracker:${tracker.id}`}>
                    {rows.map((action) => (
                      <ActionRow key={action.key} action={action} tracker={tracker} />
                    ))}
                  </div>
                ) : (
                  <ClearRow key={`tracker:${tracker.id}`} tracker={tracker} />
                )
              )}
              {visibleClientRows.map((action) => (
                <ActionRow key={action.key} action={action} />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}
