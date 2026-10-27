// src/lib/result-comparison.ts
//
// P20 comparison of independently selected search results. It reuses the P12
// budget calculator and never infers release equivalence, quality, language,
// or future upload. Missing/stale/ambiguous inputs stay unavailable.

import { registryEntryFor } from "@/data/tracker-registry"
import {
  calculateDownloadBudget,
  type DownloadBudgetResult,
} from "@/lib/download-budget"
import type { ProwlarrSearchIndexer } from "@/lib/prowlarr-search"
import { resolveAccountRatio } from "@/lib/tracker-rules"

export const COMPARISON_STALE_MS = 24 * 60 * 60 * 1000

export interface ComparisonCandidate {
  id: string
  title: string
  sizeBytes: number | null
  downloadFactor: number | null
  downloadFactorLabel: string | null
  indexer: ProwlarrSearchIndexer | null
}

export type ComparisonAccountState =
  | "available"
  | "stale"
  | "missing"
  | "placeholder"
  | "ambiguous"
  | "unsupported"

export interface ComparisonRow {
  id: string
  title: string
  indexerName: string
  trackerName: string | null
  accountState: ComparisonAccountState
  accountName: string | null
  accountFreshness: "fresh" | "stale" | "unknown"
  lastPolledAt: string | null
  sizeBytes: number | null
  factor: number | null
  factorLabel: string | null
  chargedBytes: number | null
  targetRatio: number | null
  minimumRatio: number | null
  budget: DownloadBudgetResult | null
  status: "available" | "scenario-only" | "unavailable"
  seedingObligation: "unknown"
  reasons: string[]
  unknowns: string[]
}

export interface ComparisonSummary {
  selected: number
  available: number
  scenarioOnly: number
  unavailable: number
}

export interface ComparisonResult {
  rows: ComparisonRow[]
  summary: ComparisonSummary
  targetRatio: number | null
}

function freshness(lastPolledAt: string | null, now: Date): "fresh" | "stale" | "unknown" {
  if (!lastPolledAt) return "unknown"
  const date = new Date(lastPolledAt)
  if (Number.isNaN(date.getTime())) return "unknown"
  return now.getTime() - date.getTime() > COMPARISON_STALE_MS ? "stale" : "fresh"
}

function accountState(indexer: ProwlarrSearchIndexer | null): ComparisonAccountState {
  if (!indexer) return "missing"
  if (indexer.ownership === "owned" && indexer.account) return "available"
  if (indexer.ownership === "placeholder") return "placeholder"
  if (indexer.ownership === "ambiguous") return "ambiguous"
  if (indexer.ownership === "unsupported") return "unsupported"
  return "missing"
}

function compareOne(
  candidate: ComparisonCandidate,
  targetRatio: number | null,
  now: Date
): ComparisonRow {
  const indexer = candidate.indexer
  const state = accountState(indexer)
  const account = indexer?.account ?? null
  const freshnessState = freshness(account?.lastPolledAt ?? null, now)
  const minimum = account
    ? resolveAccountRatio(account.requiredRatio, registryEntryFor({ registrySlug: indexer?.trackerSlug ?? null })?.rules)
    : null
  const charged =
    candidate.sizeBytes !== null && candidate.downloadFactor !== null
      ? candidate.sizeBytes * candidate.downloadFactor
      : null

  const unknowns: string[] = []
  if (!indexer) unknowns.push("Indexer mapping is unavailable.")
  if (state === "placeholder") unknowns.push("The matching row is an imported paused placeholder, not a healthy account.")
  if (state === "missing") unknowns.push("No matching owned account is available.")
  if (state === "ambiguous") unknowns.push("Registry matching is ambiguous.")
  if (state === "unsupported") unknowns.push("No supported tracker registry entry matches this indexer.")
  if (state === "available" && freshnessState !== "fresh") {
    unknowns.push(
      freshnessState === "stale"
        ? "Account observations are stale, so account arithmetic is unavailable."
        : "Account observation time is unknown, so account arithmetic is unavailable."
    )
  }
  if (candidate.sizeBytes === null) unknowns.push("Release size is unknown.")
  if (candidate.downloadFactor === null) {
    unknowns.push("Download accounting factor is unknown; zero/normal charge is not assumed.")
  }
  if (targetRatio === null) unknowns.push("Set a positive target ratio to calculate account impact.")

  let budget: DownloadBudgetResult | null = null
  const uploaded = account?.uploadedBytes === null ? null : Number(account?.uploadedBytes)
  const downloaded = account?.downloadedBytes === null ? null : Number(account?.downloadedBytes)
  if (
    state === "available" &&
    freshnessState === "fresh" &&
    account &&
    account.uploadedBytes !== null &&
    account.downloadedBytes !== null &&
    candidate.sizeBytes !== null &&
    candidate.downloadFactor !== null &&
    targetRatio !== null &&
    targetRatio > 0
  ) {
    budget = calculateDownloadBudget({
      uploaded,
      downloaded,
      size: candidate.sizeBytes,
      chargedFraction: candidate.downloadFactor,
      targetRatio,
      committedDownload: 0,
      reserveChargedBytes: 0,
      minimumRatio: minimum,
    })
    if (budget.status === "unavailable") {
      unknowns.push(budget.reason)
    }
  }

  const reasons: string[] = []
  if (charged !== null) {
    reasons.push(
      candidate.downloadFactor === 0
        ? "Explicit zero download factor; charged bytes are a scenario, not proof of safety."
        : "Charged bytes use the explicit download accounting factor."
    )
  }
  if (budget?.status === "available") {
    reasons.push("Projected ratio and remaining charged allowance use stored account observations.")
  }
  if (budget?.status === "scenario-only") {
    reasons.push("Zero-charge scenario only; H&R/seeding obligations still apply.")
  }
  if (minimum !== null) {
    reasons.push(
      minimum === 0
        ? "Tracker minimum is none; your target ratio is separate."
        : "Tracker minimum is shown separately from your target ratio."
    )
  }

  const status =
    budget?.status === "available"
      ? "available"
      : budget?.status === "scenario-only"
        ? "scenario-only"
        : "unavailable"

  return {
    id: candidate.id,
    title: candidate.title,
    indexerName: candidate.indexer?.indexerName ?? "Unknown indexer",
    trackerName: candidate.indexer?.trackerName ?? null,
    accountState: state,
    accountName: account?.name ?? null,
    accountFreshness: freshnessState,
    lastPolledAt: account?.lastPolledAt ?? null,
    sizeBytes: candidate.sizeBytes,
    factor: candidate.downloadFactor,
    factorLabel: candidate.downloadFactorLabel,
    chargedBytes: charged,
    targetRatio,
    minimumRatio: minimum,
    budget,
    status,
    seedingObligation: "unknown",
    reasons,
    unknowns,
  }
}

export function compareSearchResults(input: {
  candidates: ComparisonCandidate[]
  targetRatio: number | null
  now: Date
}): ComparisonResult {
  const target =
    input.targetRatio !== null && Number.isFinite(input.targetRatio) && input.targetRatio > 0
      ? input.targetRatio
      : null
  const rows = input.candidates.map((candidate) => compareOne(candidate, target, input.now))
  return {
    rows,
    summary: {
      selected: rows.length,
      available: rows.filter((row) => row.status !== "unavailable").length,
      scenarioOnly: rows.filter((row) => row.status === "scenario-only").length,
      unavailable: rows.filter((row) => row.status === "unavailable").length,
    },
    targetRatio: target,
  }
}
