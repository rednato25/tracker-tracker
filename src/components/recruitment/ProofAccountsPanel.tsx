// src/components/recruitment/ProofAccountsPanel.tsx

"use client"

import { useMemo } from "react"
import { formatAccountAge, formatDate } from "@/lib/formatters"
import {
  buildProofAccounts,
  type ProofAccountView,
  proofRatioLabel,
} from "@/lib/proof-accounts"
import type { TrackerSummary } from "@/types/api"

interface ProofAccountsPanelProps {
  trackers: TrackerSummary[]
  now: Date
}

function ProofAccountRowView({ account, now }: { account: ProofAccountView; now: Date }) {
  const age = formatAccountAge(account.joinedAt, now)
  const memberSince = account.joinedAt ? formatDate(account.joinedAt) : "unknown"

  return (
    <li
      data-proof-account={account.trackerId}
      className="flex min-w-0 flex-col gap-1 border-t border-border py-2 first:border-t-0 first:pt-0"
    >
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

export function ProofAccountsPanel({ trackers, now }: ProofAccountsPanelProps) {
  const accounts = useMemo(() => buildProofAccounts(trackers, now), [now, trackers])

  return (
    <section
      className="flex flex-col gap-3 border-t border-border pt-4"
      aria-labelledby="proof-accounts-heading"
      data-proof-accounts
    >
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

      {accounts.length === 0 ? (
        <p className="text-xs text-secondary">
          No tracker accounts yet. Add one to use it as proof in an application.
        </p>
      ) : (
        <ul className="flex min-w-0 flex-col" data-proof-account-list>
          {accounts.map((account) => (
            <ProofAccountRowView key={account.trackerId} account={account} now={now} />
          ))}
        </ul>
      )}
    </section>
  )
}
