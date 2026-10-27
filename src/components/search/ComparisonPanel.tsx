// src/components/search/ComparisonPanel.tsx

"use client"

import { H2 } from "@typography"
import { useMemo, useState } from "react"
import { Badge, Card, Input } from "@/components/ui"
import { formatBytesNum, formatRatio } from "@/lib/formatters"
import type { ProwlarrSearchIndexer, ProwlarrSearchRelease } from "@/lib/prowlarr-search"
import {
  type ComparisonCandidate,
  compareSearchResults,
} from "@/lib/result-comparison"

export interface SelectedSearchResult extends ProwlarrSearchRelease {
  id: string
  indexer: ProwlarrSearchIndexer | null
}

function valueOrUnknown(value: string | number | null, formatter?: (value: number) => string) {
  if (value === null) return "Unknown"
  return formatter && typeof value === "number" ? formatter(value) : String(value)
}

function factorLabel(value: number | null, label: string | null): string {
  if (value === null) return "Unknown"
  return label ?? `${Math.round(value * 100)}%`
}

export function ComparisonPanel({ results }: { results: SelectedSearchResult[] }) {
  const [target, setTarget] = useState("")
  const parsedTarget = target.trim() ? Number(target) : null
  const comparison = useMemo(() => {
    const candidates: ComparisonCandidate[] = results.map((result) => ({
      id: result.id,
      title: result.title,
      sizeBytes: result.sizeBytes,
      downloadFactor: result.downloadFactor,
      downloadFactorLabel: result.downloadFactorLabel,
      indexer: result.indexer,
    }))
    return compareSearchResults({
      candidates,
      targetRatio: parsedTarget !== null && Number.isFinite(parsedTarget) ? parsedTarget : null,
      now: new Date(),
    })
  }, [parsedTarget, results])

  return (
    <Card elevation="raised" className="flex scroll-mt-16 flex-col gap-4" data-comparison-panel>
      <div className="flex flex-col gap-1">
        <H2>Compare selected results</H2>
        <p className="text-xs text-secondary">
          {results.length} independent alternative(s). Titles are not merged or assumed equivalent.
        </p>
      </div>
      <div className="max-w-xs">
        <Input
          label="Your target ratio"
          value={target}
          onChange={(event) => setTarget(event.target.value)}
          placeholder="e.g. 1.1"
          inputMode="decimal"
          name="comparison-target-ratio"
        />
      </div>

      {results.length < 2 ? (
        <p className="text-xs text-secondary">Select at least two results to compare alternatives.</p>
      ) : (
        <>
          <div className="grid gap-2 text-2xs text-tertiary sm:grid-cols-4">
            <span>{comparison.summary.available} with account arithmetic</span>
            <span>{comparison.summary.scenarioOnly} zero-charge scenario</span>
            <span>{comparison.summary.unavailable} unavailable</span>
            <span>No ranking or universal “best” label</span>
          </div>
          <ul className="flex flex-col gap-2">
            {comparison.rows.map((row) => (
              <li key={row.id} className="flex flex-col gap-2 border border-border px-3 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="break-words font-mono text-xs text-primary">{row.title}</p>
                    <p className="text-2xs text-secondary">
                      {row.indexerName}
                      {row.trackerName ? ` · ${row.trackerName}` : ""} · Account:{" "}
                      {row.accountName ?? row.accountState} · Data: {row.accountFreshness}
                    </p>
                  </div>
                  <Badge
                    variant={
                      row.status === "available"
                        ? "success"
                        : row.status === "scenario-only"
                          ? "warn"
                          : "default"
                    }
                  >
                    {row.status === "available"
                      ? "Account arithmetic available"
                      : row.status === "scenario-only"
                        ? "Zero-charge scenario"
                        : "Comparison unavailable"}
                  </Badge>
                </div>

                <div className="grid gap-x-4 gap-y-1 text-2xs text-secondary sm:grid-cols-2 lg:grid-cols-4">
                  <p>Size: {valueOrUnknown(row.sizeBytes, formatBytesNum)}</p>
                  <p>Accounting: {factorLabel(row.factor, row.factorLabel)}</p>
                  <p>Charged bytes: {valueOrUnknown(row.chargedBytes, formatBytesNum)}</p>
                  <p>Target ratio: {valueOrUnknown(row.targetRatio, formatRatio)}</p>
                  <p>
                    Tracker minimum:{" "}
                    {row.minimumRatio === null
                      ? "Unknown"
                      : row.minimumRatio === 0
                        ? "None"
                        : formatRatio(row.minimumRatio)}
                  </p>
                  <p>
                    Projected ratio:{" "}
                    {valueOrUnknown(row.budget?.projectedRatio ?? null, formatRatio)}
                  </p>
                  <p>
                    Remaining charged allowance:{" "}
                    {valueOrUnknown(row.budget?.remainingChargedAfterProposed ?? null, formatBytesNum)}
                  </p>
                  <p>
                    Additional upload needed:{" "}
                    {valueOrUnknown(row.budget?.additionalUploadRequired ?? null, formatBytesNum)}
                  </p>
                </div>

                <p className="text-2xs text-tertiary">
                  Seeding/H&R obligation: unknown; not included in account arithmetic. Future upload is
                  never credited.
                </p>

                {row.reasons.length > 0 && (
                  <ul className="flex flex-col gap-0.5 text-2xs text-secondary">
                    {row.reasons.map((reason) => (
                      <li key={reason}>Observed: {reason}</li>
                    ))}
                  </ul>
                )}
                {row.unknowns.length > 0 && (
                  <ul className="flex flex-col gap-0.5 text-2xs text-warn">
                    {row.unknowns.map((unknown) => (
                      <li key={unknown}>Uncertain: {unknown}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="text-2xs text-tertiary">
        Quality, language and release-group preferences are not inferred. Check the release title
        yourself; a freeleech result is not automatically preferred. No download, grab, magnet or
        client action is available here.
      </p>
    </Card>
  )
}
