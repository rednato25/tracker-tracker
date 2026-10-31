// src/components/recruitment/ProofAccountsPanel.tsx

"use client"

import { useMemo, useState } from "react"
import { Badge, Button, Input } from "@/components/ui"
import { CopyIcon } from "@/components/ui/Icons"
import { copyTextToClipboard } from "@/lib/clipboard"
import { formatAccountAge, formatDate } from "@/lib/formatters"
import {
  buildProofAccounts,
  buildProofApplicationSummary,
  evaluateProofAccounts,
  findProofRequirement,
  nextProofQualification,
  type ProofAccountRow,
  proofRatioLabel,
} from "@/lib/proof-accounts"
import type { TrackerSummary } from "@/types/api"

interface ProofAccountsPanelProps {
  trackers: TrackerSummary[]
  now: Date
  /** Requirement prose from the invite routes into this target. */
  requirementTexts: (string | null)[]
}

function numberFromInput(value: string): number {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

function qualificationLabel(row: ProofAccountRow, minRatio: number): string {
  if (row.qualifies) return "Qualifies"
  if (row.blockedBy === "ratio") {
    return proofRatioLabel(row.account) === "—" ? "Ratio unknown" : `Ratio below ${minRatio}x`
  }
  if (row.daysUntilQualifies === null) return "Account age unknown"
  return `Qualifies in ${row.daysUntilQualifies} ${
    row.daysUntilQualifies === 1 ? "day" : "days"
  }`
}

function ProofAccountRowView({ row, now, minRatio }: { row: ProofAccountRow; now: Date; minRatio: number }) {
  const { account } = row
  const age = formatAccountAge(account.joinedAt, now)
  const memberSince = account.joinedAt ? formatDate(account.joinedAt) : "unknown"
  const label = qualificationLabel(row, minRatio)

  return (
    <li
      data-proof-account={account.trackerId}
      data-qualifies={row.qualifies ? "true" : "false"}
      data-days-until={row.daysUntilQualifies ?? undefined}
      className="flex min-w-0 flex-col gap-1 border-t border-border py-2 first:border-t-0 first:pt-0"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
          {account.profileUrl ? (
            <a
              href={account.profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-proof-profile-link
              className="min-w-0 break-words text-sm text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-focus)] focus-visible:ring-offset-1"
            >
              {account.trackerName}
            </a>
          ) : (
            <span className="min-w-0 break-words text-sm text-primary">{account.trackerName}</span>
          )}
          <span className="font-mono text-2xs text-tertiary">
            {account.className ?? "Unknown class"}
          </span>
        </div>
        <Badge variant={row.qualifies ? "success" : "warn"}>
          {label}
          {!row.qualifies && row.qualifiesOn ? ` · ${formatDate(row.qualifiesOn)}` : ""}
        </Badge>
      </div>
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs text-secondary">
        <span>{age ? `${age} old` : "Account age unknown"}</span>
        <span className="text-tertiary">·</span>
        <span>member since {memberSince}</span>
        <span className="text-tertiary">·</span>
        <span className="font-mono">ratio {proofRatioLabel(account)}</span>
      </p>
    </li>
  )
}

export function ProofAccountsPanel({ trackers, now, requirementTexts }: ProofAccountsPanelProps) {
  const requirement = useMemo(() => findProofRequirement(requirementTexts), [requirementTexts])
  const [minAgeMonths, setMinAgeMonths] = useState(() => requirement?.ageMonths ?? 0)
  const [minRatio, setMinRatio] = useState(0)
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle")

  const accounts = useMemo(() => buildProofAccounts(trackers, now), [now, trackers])
  const rows = useMemo(
    () => evaluateProofAccounts(accounts, { minAgeMonths, minRatio }, now),
    [accounts, minAgeMonths, minRatio, now]
  )
  const qualifyingCount = rows.filter((row) => row.qualifies).length
  const next = nextProofQualification(rows)
  const summary = buildProofApplicationSummary(rows)

  async function copySummary() {
    if (!summary) return
    const outcome = await copyTextToClipboard(summary)
    setCopyStatus(outcome === "copied" ? "copied" : "failed")
  }

  return (
    <section
      className="flex flex-col gap-3 border-t border-border pt-4"
      aria-labelledby="proof-accounts-heading"
      data-proof-accounts
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h4
            id="proof-accounts-heading"
            className="font-cond text-2xs font-semibold uppercase tracking-[0.12em] text-secondary"
          >
            Your proof accounts
          </h4>
          <p className="max-w-2xl text-xs text-secondary">
            Every tracker you are on, with the class and ratio a recruiter would see.
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          className="min-h-11"
          disabled={summary.length === 0}
          leftIcon={<CopyIcon width="12" height="12" aria-hidden="true" />}
          text={copyStatus === "copied" ? "Copied" : "Copy application summary"}
          onClick={() => void copySummary()}
        />
      </div>

      <div className="flex max-w-lg flex-col gap-2 sm:flex-row">
        <Input
          label="Minimum account age (months)"
          type="number"
          min={0}
          step={1}
          inputMode="numeric"
          className="w-full sm:w-44"
          value={minAgeMonths}
          onChange={(event) => {
            setMinAgeMonths(numberFromInput(event.target.value))
            setCopyStatus("idle")
          }}
        />
        <Input
          label="Minimum ratio"
          type="number"
          min={0}
          step={0.05}
          inputMode="decimal"
          className="w-full sm:w-36"
          value={minRatio}
          onChange={(event) => {
            setMinRatio(numberFromInput(event.target.value))
            setCopyStatus("idle")
          }}
        />
      </div>

      {requirement && (
        <p className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-xs text-secondary" data-proof-requirement>
          <span className="font-mono text-primary">{requirement.count} needed</span>
          <span aria-hidden="true">·</span>
          <span>
            <span className="font-mono text-primary">{qualifyingCount}</span>{" "}
            {qualifyingCount === 1 ? "qualifies" : "qualify"} now
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {next ? (
              <>
                next on <span className="font-mono text-primary">{formatDate(next.date)}</span>
              </>
            ) : (
              "no more qualify in this list"
            )}
          </span>
        </p>
      )}

      {rows.length === 0 ? (
        <p className="text-xs text-secondary">
          No tracker accounts yet. Add one to use it as proof in an application.
        </p>
      ) : (
        <ul className="flex min-w-0 flex-col" data-proof-account-list>
          {rows.map((row) => (
            <ProofAccountRowView key={row.account.trackerId} row={row} now={now} minRatio={minRatio} />
          ))}
        </ul>
      )}

      <span role="status" aria-live="polite" className="text-2xs text-tertiary">
        {copyStatus === "copied"
          ? "Copied application summary."
          : copyStatus === "failed"
            ? "Could not copy the application summary. Select the list and copy it manually."
            : ""}
      </span>
    </section>
  )
}
