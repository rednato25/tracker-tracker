// src/components/dashboard/RankOverview.tsx
//
// P41 dashboard Ranks view. One compact section per active tracker answers:
// which class am I in, which class is the target, and does every condition
// meet its requirement? Unknown values carry a written reason.

"use client"

import { ExternalLinkSmallIcon } from "@icons"
import { useEffect, useMemo, useState } from "react"
import { Badge, Button } from "@/components/ui"
import { type ClipboardOutcome, copyTextToClipboard } from "@/lib/clipboard"
import { formatDate, localDateStr } from "@/lib/formatters"
import type { RankGoalStatus } from "@/lib/rank-goals"
import { buildRankOverviewMarkdown } from "@/lib/rank-markdown"
import { buildRankOverviews, type RankOverview as RankOverviewData } from "@/lib/rank-overview"
import type { RankCheck, RankCheckVerdict } from "@/lib/recruitment-state"
import type { TrackerSummary } from "@/types/api"

interface RankOverviewProps {
  trackers: TrackerSummary[]
  savedGoals: Record<string, { targetRank: string }>
  checks: Record<string, RankCheck>
  onSaveCheck: (trackerId: number, check: RankCheck | null) => Promise<void>
  now?: Date
}

function statusLabel(status: RankGoalStatus): string {
  return status === "met" ? "Met" : status === "unmet" ? "Unmet" : "Unknown"
}

function statusTone(status: RankGoalStatus): string {
  return status === "met"
    ? "text-success"
    : status === "unmet"
      ? "text-danger"
      : "text-warn"
}

function targetLabel(overview: RankOverviewData): string {
  if (!overview.targetClass) return "No target"
  if (overview.targetKind === "saved") return `Target: ${overview.targetClass}`
  return `Next automatic class: ${overview.targetClass}`
}

function verificationLabel(verification: RankOverviewData["source"]["verification"]): string {
  if (verification === "published") return "Published source"
  if (verification === "unresolved") return "Source unresolved"
  return "No registry source"
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <span className="block font-cond text-2xs font-semibold uppercase tracking-[0.1em] text-tertiary md:hidden">
        {label}
      </span>
      <span className="block break-words text-xs text-secondary">{children}</span>
    </div>
  )
}

function ConditionRow({ condition }: { condition: RankOverviewData["conditions"][number] }) {
  const whyUnknown =
    condition.status === "unknown"
      ? condition.unknownReason ?? condition.reason ?? "Unknown"
      : "\u2014"
  return (
    <div
      className="grid grid-cols-2 gap-x-3 gap-y-1 border-t border-border py-2 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.7fr)_minmax(0,1.5fr)] md:items-baseline"
      data-rank-condition={condition.id}
    >
      <Field label="Requirement" className="col-span-2 md:col-span-1">
        {condition.requirement}
      </Field>
      <Field label="Current">
        <span className="font-mono tabular-nums text-primary">{condition.current}</span>
      </Field>
      <Field label="Required">
        <span className="font-mono tabular-nums text-primary">{condition.required}</span>
      </Field>
      <Field label="Status">
        <span
          className={`font-cond text-2xs font-semibold uppercase tracking-[0.1em] ${statusTone(condition.status)}`}
        >
          {statusLabel(condition.status)}
        </span>
      </Field>
      <Field label="Why unknown" className="col-span-2 md:col-span-1">
        <span className={condition.status === "unknown" ? "text-warn" : "text-tertiary"}>
          {whyUnknown}
        </span>
      </Field>
    </div>
  )
}

function CheckControl({
  trackerName,
  check,
  onSave,
}: {
  trackerName: string
  check: RankCheck | null
  onSave: (check: RankCheck | null) => Promise<void>
}) {
  const [verdict, setVerdict] = useState<RankCheckVerdict | null>(check?.verdict ?? null)
  const [note, setNote] = useState(check?.note ?? "")
  const [checkedAt, setCheckedAt] = useState(check?.checkedAt ?? localDateStr())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setVerdict(check?.verdict ?? null)
    setNote(check?.note ?? "")
    setCheckedAt(check?.checkedAt ?? localDateStr())
  }, [check])

  function chooseVerdict(next: RankCheckVerdict) {
    setVerdict(next)
    if (!check) setCheckedAt(localDateStr())
  }

  async function save() {
    if (!verdict || saving) return
    setSaving(true)
    setError(null)
    try {
      await onSave({
        verdict,
        note: note.trim() ? note.trim() : null,
        checkedAt: checkedAt || localDateStr(),
      })
    } catch {
      setError("Could not save this check. Try again.")
    } finally {
      setSaving(false)
    }
  }

  async function clear() {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      await onSave(null)
      setVerdict(null)
      setNote("")
      setCheckedAt(localDateStr())
    } catch {
      setError("Could not clear this check. Try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-2" data-rank-check>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-cond text-2xs font-semibold uppercase tracking-[0.1em] text-secondary">
          My check
        </span>
        <span className="font-mono text-xs text-tertiary" aria-live="polite">
          {saving
            ? "Saving\u2026"
            : check
              ? `Checked ${formatDate(check.checkedAt)}`
              : "Not checked yet"}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={verdict === "matches" ? "primary" : "secondary"}
          aria-pressed={verdict === "matches"}
          onClick={() => chooseVerdict("matches")}
          disabled={saving}
          className="min-h-11 sm:min-h-9"
          data-rank-check-verdict="matches"
        >
          Matches the site
        </Button>
        <Button
          size="sm"
          variant={verdict === "wrong" ? "danger" : "secondary"}
          aria-pressed={verdict === "wrong"}
          onClick={() => chooseVerdict("wrong")}
          disabled={saving}
          className="min-h-11 sm:min-h-9"
          data-rank-check-verdict="wrong"
        >
          Wrong
        </Button>
        <label className="flex min-h-11 items-center gap-2 text-xs text-tertiary sm:min-h-9">
          Checked
          <input
            type="date"
            value={checkedAt}
            onChange={(event) => setCheckedAt(event.target.value)}
            aria-label={`Date checked for ${trackerName}`}
            className="min-h-11 rounded-nm-sm border border-border bg-control-bg px-2 py-1 font-mono text-xs text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-control-focus)] sm:min-h-9"
          />
        </label>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Optional note"
          aria-label={`Note for ${trackerName}`}
          maxLength={2000}
          className="min-h-11 flex-1 rounded-nm-sm border border-border bg-control-bg px-2.5 py-1.5 text-xs text-primary placeholder:text-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-control-focus)] sm:min-h-9"
        />
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void save()}
            disabled={saving || !verdict}
            className="min-h-11 sm:min-h-9"
          >
            Save check
          </Button>
          {check && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void clear()}
              disabled={saving}
              className="min-h-11 sm:min-h-9"
            >
              Clear
            </Button>
          )}
        </div>
      </div>
      {error && (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

function TrackerRankSection({
  overview,
  savedGoal,
  check,
  onSaveCheck,
}: {
  overview: RankOverviewData
  savedGoal: string | null
  check: RankCheck | null
  onSaveCheck: (check: RankCheck | null) => Promise<void>
}) {
  return (
    <section
      className="flex min-w-0 flex-col gap-3 border border-border border-t-2 bg-raised p-4"
      style={{ borderTopColor: overview.color }}
      data-rank-overview-tracker={overview.trackerId}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <h3 className="break-words font-cond text-sm font-semibold text-primary">
              {overview.trackerName}
            </h3>
            <a
              href={overview.siteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-accent underline-offset-2 hover:underline"
              aria-label={`Open ${overview.trackerName} site`}
              data-rank-site-link
            >
              Site
              <ExternalLinkSmallIcon width="12" height="12" aria-hidden="true" />
            </a>
          </div>
          <p className="mt-0.5 text-xs text-secondary">
            Current class:{" "}
            <span className="font-mono text-primary">
              {overview.currentClassHidden ? "Redacted" : (overview.currentClass ?? "Unknown")}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {overview.targetReached && <Badge variant="success">Target reached</Badge>}
          <Badge variant={overview.targetKind === "saved" ? "accent" : "default"}>
            {targetLabel(overview)}
          </Badge>
        </div>
      </div>

      {overview.targetReached && overview.reachedTarget && (
        <p className="text-xs text-secondary">
          Saved target: <span className="font-mono">{overview.reachedTarget}</span>
        </p>
      )}
      {savedGoal && !overview.targetReached && savedGoal !== overview.targetClass && (
        <p className="text-xs text-warn">Saved target is not in this ladder.</p>
      )}

      {overview.conditions.length > 0 ? (
        <div className="flex flex-col" data-rank-conditions>
          <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.7fr)_minmax(0,1.5fr)] gap-x-3 pb-1 font-cond text-2xs font-semibold uppercase tracking-[0.1em] text-tertiary md:grid">
            <span>Requirement</span>
            <span>Current</span>
            <span>Required</span>
            <span>Status</span>
            <span>Why unknown</span>
          </div>
          {overview.conditions.map((condition) => (
            <ConditionRow key={condition.id} condition={condition} />
          ))}
        </div>
      ) : (
        <div className="border-t border-border pt-2 text-xs text-secondary">
          <p>No structured conditions are published for this class.</p>
          {overview.highestAutomatic && (
            <p className="mt-1 text-tertiary">Highest automatic class reached.</p>
          )}
        </div>
      )}

      <CheckControl trackerName={overview.trackerName} check={check} onSave={onSaveCheck} />

      <div className="flex flex-col gap-1 border-t border-border pt-2 text-xs" data-rank-source>
        <p className="text-secondary">
          Registry text:{" "}
          <span className="text-tertiary">
            {overview.ruleText ?? "No class requirement text in the registry."}
          </span>
        </p>
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-tertiary">
          <span data-rank-source-verification>{verificationLabel(overview.source.verification)}</span>
          {overview.source.title && <span>{overview.source.title}</span>}
          {overview.source.url && (
            <a
              href={overview.source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all text-accent underline-offset-2 hover:underline"
            >
              {overview.source.url}
            </a>
          )}
        </p>
        {overview.source.accessedAt && (
          <p className="text-tertiary">Accessed {formatDate(overview.source.accessedAt)}</p>
        )}
        {overview.source.note && <p className="text-tertiary">{overview.source.note}</p>}
      </div>
    </section>
  )
}

export function RankOverview({
  trackers,
  savedGoals,
  checks,
  onSaveCheck,
  now = new Date(),
}: RankOverviewProps) {
  const overviews = useMemo(
    () => buildRankOverviews(trackers, savedGoals, now),
    [trackers, savedGoals, now]
  )
  const checkedCount = overviews.filter((overview) => checks[String(overview.trackerId)]).length
  const wrongCount = overviews.filter(
    (overview) => checks[String(overview.trackerId)]?.verdict === "wrong"
  ).length
  const notCheckedCount = overviews.length - checkedCount
  const [copyState, setCopyState] = useState<ClipboardOutcome | null>(null)

  async function copyOverview() {
    const outcome = await copyTextToClipboard(
      buildRankOverviewMarkdown(overviews, checks)
    )
    setCopyState(outcome)
  }

  if (overviews.length === 0) {
    return (
      <p className="border border-border bg-raised p-4 text-sm text-secondary">
        No rank ladders are available for the active trackers.
      </p>
    )
  }

  return (
    <section className="flex flex-col gap-3" aria-label="Rank overview" data-rank-overview>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-cond text-lg font-semibold leading-6 tracking-[-0.01em] text-primary">
          Ranks
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-mono text-xs text-tertiary">
            {overviews.length} {overviews.length === 1 ? "tracker" : "trackers"}{" "}
            {"\u00b7"} every condition on the target or next automatic class
          </p>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void copyOverview()}
            className="min-h-11 sm:min-h-9"
            data-copy-rank-overview
          >
            {copyState === "copied"
              ? "Copied"
              : copyState === "unavailable"
                ? "Copy unavailable"
                : "Copy as Markdown"}
          </Button>
          <span className="sr-only" aria-live="polite">
            {copyState === "copied" ? "Rank overview copied" : null}
            {copyState === "unavailable" ? "Clipboard unavailable" : null}
          </span>
        </div>
      </div>
      <div
        className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border border-border bg-raised px-3 py-2 font-mono text-xs"
        data-rank-check-summary
      >
        <span className="text-secondary">
          Checked <span className="text-primary">{checkedCount}</span>
        </span>
        <span className="text-tertiary">{"\u00b7"}</span>
        <span className={wrongCount > 0 ? "text-danger" : "text-secondary"}>
          Wrong <span className="text-primary">{wrongCount}</span>
        </span>
        <span className="text-tertiary">{"\u00b7"}</span>
        <span className="text-secondary">
          Not checked <span className="text-primary">{notCheckedCount}</span>
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {overviews.map((overview) => (
          <TrackerRankSection
            key={overview.trackerId}
            overview={overview}
            savedGoal={savedGoals[String(overview.trackerId)]?.targetRank ?? null}
            check={checks[String(overview.trackerId)] ?? null}
            onSaveCheck={(check) => onSaveCheck(overview.trackerId, check)}
          />
        ))}
      </div>
    </section>
  )
}
