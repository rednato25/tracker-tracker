// src/lib/rank-markdown.ts
//
// P41 Copy as Markdown. The whole Ranks view is flattened into chat-ready text:
// every tracker, condition, source, my check and its note.

import { formatDate } from "@/lib/formatters"
import type { RankOverview } from "@/lib/rank-overview"
import { rankLadderStateLabel } from "@/lib/rank-summary"
import type { RankCheck } from "@/lib/recruitment-state"

const DASH = "\u2014"

function cell(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("|", "\\|")
    .replace(/\s*\n\s*/g, " ")
    .trim()
}

function targetLine(overview: RankOverview): string {
  if (!overview.targetClass) return rankLadderStateLabel(overview.ladderState)
  if (overview.targetKind === "saved") return `${overview.targetClass} (saved target)`
  return `${overview.targetClass} (next automatic class)`
}

function checkLine(check: RankCheck | undefined): string {
  if (!check) return "Not checked yet"
  const verdict = check.verdict === "matches" ? "Matches the site" : "Wrong"
  const note = check.note ? ` ${DASH} ${check.note}` : ""
  return `${verdict}${note} (checked ${formatDate(check.checkedAt)})`
}

export function buildRankOverviewMarkdown(
  overviews: RankOverview[],
  checks: Record<string, RankCheck>
): string {
  const checked = overviews.filter((overview) => checks[String(overview.trackerId)]).length
  const wrong = overviews.filter(
    (overview) => checks[String(overview.trackerId)]?.verdict === "wrong"
  ).length
  const lines: string[] = [
    "# Rank overview",
    "",
    `My checks: ${checked - wrong} match the site, ${wrong} wrong, ${overviews.length - checked} not checked`,
    "",
  ]

  for (const overview of overviews) {
    lines.push(`## ${overview.trackerName}`)
    lines.push(`- Site: ${overview.siteUrl}`)
    lines.push(
      `- Current class: ${
        overview.currentClassHidden ? "Hidden" : (overview.currentClass ?? "Unknown")
      }`
    )
    lines.push(`- Target: ${targetLine(overview)}`)
    if (overview.targetReached && overview.reachedTarget) {
      lines.push(`- Target reached: ${overview.reachedTarget}`)
    }
    if (overview.ladderState === "top") lines.push("- Highest automatic class reached")
    lines.push(`- Tracker rules: ${overview.ruleText ?? "No rules text"}`)
    const source = overview.source
    const sourceParts = [
      source.title ?? "No title",
      source.verification === "published"
        ? "checked against the site"
        : source.verification === "unresolved"
          ? "not checked against the site"
          : "no source",
    ]
    if (source.url) sourceParts.push(source.url)
    if (source.accessedAt) sourceParts.push(`accessed ${formatDate(source.accessedAt)}`)
    lines.push(`- Source: ${sourceParts.join(", ")}`)
    lines.push(`- My check: ${checkLine(checks[String(overview.trackerId)])}`)
    if (overview.conditions.length === 0) {
      lines.push("- Conditions: none listed")
    } else {
      lines.push("- Conditions:")
      lines.push("")
      lines.push("  | Requirement | Current | Required | Status | Why unknown |")
      lines.push("  | --- | --- | --- | --- | --- |")
      for (const condition of overview.conditions) {
        const status =
          condition.status === "met" ? "Met" : condition.status === "unmet" ? "Not met" : "Unknown"
        const why =
          condition.status === "unknown"
            ? (condition.unknownReason ?? condition.reason ?? "Unknown")
            : DASH
        lines.push(
          `  | ${cell(condition.requirement)} | ${cell(condition.current)} | ${cell(condition.required)} | ${status} | ${cell(why)} |`
        )
      }
    }
    lines.push("")
  }

  return `${lines.join("\n").trimEnd()}\n`
}