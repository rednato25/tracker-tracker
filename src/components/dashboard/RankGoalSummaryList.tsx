// src/components/dashboard/RankGoalSummaryList.tsx

"use client"

import Link from "next/link"
import { Badge } from "@/components/ui"
import type { RankGoalSummary } from "@/lib/rank-summary"

function currentLabel(summary: RankGoalSummary): string {
  if (summary.currentRankHidden) return "Hidden"
  return summary.currentRank ?? "Unknown"
}

function conditionList(label: string, items: RankGoalSummary["unmet"]): string[] {
  return items.slice(0, 2).map((item) => {
    const remaining = item.remaining ? ` · ${item.remaining} remaining` : ""
    return `${label}: ${item.label}${remaining}`
  })
}

function SummaryCard({ summary }: { summary: RankGoalSummary }) {
  const lines = [
    ...conditionList("Unmet", summary.unmet),
    ...conditionList("Needs checking", summary.unknown),
  ]
  const hiddenCount = Math.max(0, summary.unmet.length - 2) + Math.max(0, summary.unknown.length - 2)

  return (
    <article
      className="flex min-w-0 flex-col gap-1.5 border border-border bg-raised px-3 py-2.5"
      style={{ borderLeftColor: summary.color, borderLeftWidth: 2 }}
      data-rank-goal-summary
    >
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <span className="min-w-0 truncate font-sans text-xs font-semibold text-primary">
          {summary.trackerName}
        </span>
        <Badge variant={summary.status === "goal" ? "accent" : "default"}>
          {summary.status === "unsupported"
            ? "Unsupported"
            : summary.targetRank
              ? "Target set"
              : summary.automaticNextRank
                ? "Automatic next"
                : "No target"}
        </Badge>
      </div>

      <p className="font-mono text-xs text-secondary">
        Current: {currentLabel(summary)}
        {summary.targetRank ? ` · Target: ${summary.targetRank}` : ""}
        {!summary.targetRank && summary.automaticNextRank
          ? ` · Next rank (automatic): ${summary.automaticNextRank}`
          : ""}
      </p>

      {summary.status === "unsupported" ? (
        <p className="font-mono text-xs text-warn">Structured progress unavailable.</p>
      ) : summary.status === "no-target" && !summary.automaticNextRank ? (
        <p className="font-mono text-xs text-secondary">
          No target selected. Choose one on the tracker page.
        </p>
      ) : summary.metCount + summary.unmetCount + summary.unknownCount > 0 ? (
        <p className="font-mono text-xs text-tertiary">
          {summary.metCount} met · {summary.unmetCount} unmet · {summary.unknownCount} need checking
        </p>
      ) : summary.status === "no-target" ? (
        <p className="font-mono text-xs text-tertiary">
          Next rank is known, but no structured requirement is available.
        </p>
      ) : null}

      {lines.length > 0 && (
        <ul className="flex flex-col gap-0.5 font-mono text-xs text-secondary">
          {lines.map((line) => (
            <li key={line} className="break-words">
              {line}
            </li>
          ))}
          {hiddenCount > 0 && (
            <li className="text-tertiary">+{hiddenCount} more requirements</li>
          )}
        </ul>
      )}

      <Link
        href={summary.linkHref}
        className="font-mono text-xs text-accent underline underline-offset-2"
      >
        {summary.linkLabel}
      </Link>
    </article>
  )
}

export function RankGoalSummaryList({ summaries }: { summaries: RankGoalSummary[] }) {
  if (summaries.length === 0) return null
  return (
    <section
      className="grid gap-2 md:grid-cols-2 xl:grid-cols-3"
      aria-label="Rank goal summary"
    >
      {summaries.map((summary) => (
        <SummaryCard key={summary.trackerId} summary={summary} />
      ))}
    </section>
  )
}
