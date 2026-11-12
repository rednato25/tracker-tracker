import clsx from "clsx"
import Link from "next/link"
import { useMemo } from "react"
import type { TrackerAction } from "@/lib/actions"
import { formatDateTime } from "@/lib/formatters"
import type { TrackerSummary } from "@/types/api"

interface AttentionNeededProps {
  trackers: TrackerSummary[]
  actions: TrackerAction[]
  loading?: boolean
  error?: boolean
  clientsUnavailable?: boolean
  /** Server-rendered time; the pure engine receives this same value upstream. */
  asOf: string
}

interface AttentionRow {
  action: TrackerAction
  /** One entry per tracker; more than one when the same item applies to several. */
  trackers: { name: string; href: string }[]
}

function actionDestination(action: TrackerAction): string {
  if (action.clientId != null || action.trackerId === null) return "/settings"
  return `/trackers/${action.trackerId}`
}

/** "5m ago", measured against the page's own time so server and browser agree. */
function ageFrom(observedAt: string, asOf: string): string | null {
  const ms = new Date(asOf).getTime() - new Date(observedAt).getTime()
  if (Number.isNaN(ms)) return null
  const minutes = Math.floor(Math.max(0, ms) / 60_000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

/** What the item's timestamp means, so "30d ago" is never ambiguous. */
function ageLabel(action: TrackerAction): string {
  if (action.type.startsWith("login-")) return "Last login"
  if (action.type === "poll-error" || action.type === "auth-error") return "Failed"
  if (action.type === "polling-paused") return "Paused"
  return "Updated"
}

function StatusMark({ action }: { action: TrackerAction }) {
  const fix = action.status === "action-required"
  return (
    <span className="inline-flex items-center gap-1.5 font-cond text-xs font-semibold uppercase tracking-[0.1em] text-secondary">
      <span
        className={clsx("size-1.5 shrink-0 rounded-[1px]", fix ? "bg-danger" : "bg-warn")}
        aria-hidden="true"
      />
      {fix ? "Needs action" : "Needs checking"}
    </span>
  )
}

function ActionRow({ row, asOf }: { row: AttentionRow; asOf: string }) {
  const { action, trackers } = row
  const observedAt = trackers.length === 1 ? action.evidence.observedAt : undefined
  const age = observedAt ? ageFrom(observedAt, asOf) : null
  return (
    <article
      className="grid gap-x-4 gap-y-1 border-t border-border px-3 py-3 md:grid-cols-[9rem_minmax(8rem,14rem)_minmax(0,1fr)_minmax(8rem,14rem)] md:items-baseline"
      data-action-key={action.key}
    >
      <StatusMark action={action} />
      <p className="min-w-0 break-words font-cond text-xs font-semibold uppercase tracking-[0.06em] text-primary">
        {trackers.map((tracker, index) => (
          <span key={`${tracker.href}:${tracker.name}`}>
            {index > 0 && ", "}
            <Link
              href={tracker.href}
              className="underline-offset-2 hover:underline focus-visible:outline-1 focus-visible:outline-accent"
            >
              {tracker.name}
            </Link>
          </span>
        ))}
      </p>
      <div className="min-w-0">
        <p className="break-words text-xs leading-5 text-secondary">{action.reason}</p>
        {action.torrentHash && (
          <p className="break-all font-mono text-xs text-tertiary">
            Torrent {action.torrentHash.slice(0, 12)}…
          </p>
        )}
        {(action.deadline || age) && (
          <p className="font-mono text-xs text-tertiary">
            {action.deadline ? `Due ${action.deadline}` : `${ageLabel(action)} ${age}`}
          </p>
        )}
      </div>
      <Link
        href={trackers[0]?.href ?? actionDestination(action)}
        className="break-words text-xs leading-5 text-accent underline-offset-2 hover:underline focus-visible:outline-1 focus-visible:outline-accent"
      >
        {action.nextAction}
      </Link>
    </article>
  )
}

function countLine(fix: number, check: number): string {
  const parts: string[] = []
  if (fix > 0) parts.push(`${fix} to fix`)
  if (check > 0) parts.push(`${check} to check`)
  return parts.length > 0 ? parts.join(", ") : "Nothing to fix"
}

/**
 * The dashboard's to-do list. Classification, priority, deadlines and keys
 * come from `computeTrackerActions`; this component only orders and renders.
 * Trackers with nothing open are counted, not listed.
 */
export function AttentionNeeded({
  trackers,
  actions,
  loading = false,
  error = false,
  clientsUnavailable = false,
  asOf,
}: AttentionNeededProps) {
  const { rows, clearCount, fix, check } = useMemo(() => {
    const active = trackers.filter((tracker) => tracker.isActive)
    const nameById = new Map(active.map((tracker) => [tracker.id, tracker.name]))
    const position = new Map(active.map((tracker, index) => [tracker.id, index]))
    const withOpenItems = new Set<number>()
    const trackerActions: { action: TrackerAction; name: string; order: number }[] = []
    const clientActions: TrackerAction[] = []

    actions.forEach((action, order) => {
      if (action.trackerId === null) {
        clientActions.push(action)
        return
      }
      if (!nameById.has(action.trackerId)) return
      withOpenItems.add(action.trackerId)
      trackerActions.push({
        action,
        name: nameById.get(action.trackerId) ?? action.trackerName,
        order,
      })
    })

    // Actions arrive in priority order; keep each tracker's rows together,
    // led by its most urgent one.
    const firstOrder = new Map<number, number>()
    for (const { action, order } of trackerActions) {
      const id = action.trackerId as number
      if (!firstOrder.has(id)) firstOrder.set(id, order)
    }
    trackerActions.sort((left, right) => {
      const a = left.action.trackerId as number
      const b = right.action.trackerId as number
      return (
        (firstOrder.get(a) ?? 0) - (firstOrder.get(b) ?? 0) ||
        (position.get(a) ?? 0) - (position.get(b) ?? 0) ||
        left.order - right.order
      )
    })

    // The same item on several trackers (a proxy outage makes every poll
    // stale) becomes one row naming them all. Items with a torrent or a
    // deadline stay separate, because those details differ per tracker.
    const grouped: AttentionRow[] = []
    const byKey = new Map<string, AttentionRow>()
    for (const { action, name } of trackerActions) {
      const tracker = { name, href: actionDestination(action) }
      const shareable = !action.torrentHash && !action.deadline
      const key = `${action.status}|${action.type}|${action.reason}|${action.nextAction}`
      const existing = shareable ? byKey.get(key) : undefined
      if (existing) {
        existing.trackers.push(tracker)
        continue
      }
      const row: AttentionRow = { action, trackers: [tracker] }
      if (shareable) byKey.set(key, row)
      grouped.push(row)
    }
    for (const action of clientActions) {
      grouped.push({
        action,
        trackers: [{ name: action.trackerName, href: actionDestination(action) }],
      })
    }

    const count = (status: TrackerAction["status"]) =>
      grouped
        .filter((row) => row.action.status === status)
        .reduce((sum, row) => sum + row.trackers.length, 0)
    return {
      rows: grouped,
      clearCount: active.length - withOpenItems.size,
      fix: count("action-required"),
      check: count("needs-verification"),
    }
  }, [actions, trackers])

  const complete = !loading && !error
  const allClear = complete && !clientsUnavailable && rows.length === 0

  return (
    <section
      className="border border-border bg-raised"
      aria-labelledby="attention-needed-heading"
      data-attention-view
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border px-3 py-3">
        <h2
          id="attention-needed-heading"
          className="font-cond text-lg font-semibold uppercase tracking-[0.08em] text-primary"
        >
          Attention needed
        </h2>
        {complete && (
          <p
            className={clsx("font-mono text-xs", allClear ? "text-success" : "text-secondary")}
            aria-live="polite"
            data-testid="attention-counts"
          >
            {countLine(fix, check)}
          </p>
        )}
      </div>

      {loading ? (
        <p className="px-3 py-4 font-mono text-xs text-secondary" role="status">
          Loading…
        </p>
      ) : error ? (
        <p className="px-3 py-4 font-mono text-xs text-danger" role="alert">
          Couldn't load the tracker checks. Reload the page to try again.
        </p>
      ) : (
        <>
          {clientsUnavailable && (
            <p className="border-b border-border px-3 py-2 font-mono text-xs text-warn" role="status">
              Download client data didn't load, so this list may be incomplete.
            </p>
          )}
          {rows.map((row) => (
            <ActionRow key={row.action.key} row={row} asOf={asOf} />
          ))}
          {clearCount > 0 && (
            <p
              className={clsx(
                "px-3 py-2.5 font-mono text-xs",
                rows.length > 0 && "border-t border-border",
                allClear ? "text-success" : "text-tertiary"
              )}
              role={allClear ? "status" : undefined}
              data-clear-count={clearCount}
            >
              {allClear
                ? `All ${clearCount} ${clearCount === 1 ? "tracker" : "trackers"} clear as of ${formatDateTime(asOf)}.`
                : `${rows.length > 0 ? "The other " : ""}${clearCount} ${clearCount === 1 ? "tracker is" : "trackers are"} clear.`}
            </p>
          )}
        </>
      )}
    </section>
  )
}
