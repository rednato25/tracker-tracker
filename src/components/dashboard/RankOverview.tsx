// src/components/dashboard/RankOverview.tsx
//
// P41 dashboard Ranks view. One compact section per active tracker answers:
// which class am I in, which class is the target, and does every condition
// meet its requirement? Unknown values carry a written reason.

"use client"

import { ExternalLinkSmallIcon } from "@icons"
import { useMemo } from "react"
import { Badge } from "@/components/ui"
import { formatDate } from "@/lib/formatters"
import type { RankGoalStatus } from "@/lib/rank-goals"
import { buildRankOverviews, type RankOverview as RankOverviewData } from "@/lib/rank-overview"
import type { TrackerSummary } from "@/types/api"

interface RankOverviewProps {
  trackers: TrackerSummary[]
  savedGoals: Record<string, { targetRank: string }>
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

function TrackerRankSection({
  overview,
  savedGoal,
}: {
  overview: RankOverviewData
  savedGoal: string | null
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

export function RankOverview({ trackers, savedGoals, now = new Date() }: RankOverviewProps) {
  const overviews = useMemo(
    () => buildRankOverviews(trackers, savedGoals, now),
    [trackers, savedGoals, now]
  )

  if (overviews.length === 0) {
    return (
      <p className="border border-border bg-raised p-4 text-sm text-secondary">
        No rank ladders are available for the active trackers.
      </p>
    )
  }

  return (
    <section className="flex flex-col gap-3" aria-label="Rank overview" data-rank-overview>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-cond text-lg font-semibold leading-6 tracking-[-0.01em] text-primary">
          Ranks
        </h2>
        <p className="font-mono text-xs text-tertiary">
          {overviews.length} {overviews.length === 1 ? "tracker" : "trackers"}{" "}
          {"\u00b7"} every condition on the target or next automatic class
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {overviews.map((overview) => (
          <TrackerRankSection
            key={overview.trackerId}
            overview={overview}
            savedGoal={savedGoals[String(overview.trackerId)]?.targetRank ?? null}
          />
        ))}
      </div>
    </section>
  )
}
