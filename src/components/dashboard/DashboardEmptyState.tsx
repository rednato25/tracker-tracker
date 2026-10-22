// src/components/dashboard/DashboardEmptyState.tsx
"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { AddTrackerDialog } from "@/components/AddTrackerDialog"
import { Button, PlusIcon } from "@/components/ui"

interface DashboardEmptyStateProps {
  /** Refetches the dashboard queries once the first tracker exists. */
  onAdded: () => void | Promise<void>
}

/**
 * Shown on the dashboard when the account has no trackers at all.
 *
 * The sidebar's "+ Add Tracker" button keeps its dialog state local, and the two
 * components are siblings under AuthShell with nothing shared between them, so this
 * mounts its own AddTrackerDialog rather than reaching for the sidebar's.
 */
function DashboardEmptyState({ onAdded }: DashboardEmptyStateProps) {
  const [showAddDialog, setShowAddDialog] = useState(false)
  const router = useRouter()

  return (
    <div className="mx-auto max-w-2xl pt-12 pb-12">
      <div className="border border-border bg-raised">
        <div className="border-b border-border px-6 py-6">
          <h1 className="font-cond text-4xl font-semibold leading-none text-primary">
            Account register
          </h1>
          <p className="mt-2 font-mono text-3xs text-secondary">
            No accessions yet · the register begins with one account.
          </p>
        </div>
        <div className="flex flex-col gap-4 px-6 py-6">
          <p className="max-w-prose text-xs leading-relaxed text-secondary">
            Add a private tracker account to record ratio, buffer, seeding, and rank. The first
            line appears here after the first poll.
          </p>
          <div className="flex items-center gap-3">
            <Button size="sm" onClick={() => setShowAddDialog(true)}>
              <PlusIcon width="13" height="13" />
              Add first tracker
            </Button>
            <span className="font-mono text-4xs text-muted">Credentials stay on this server.</span>
          </div>
        </div>
      </div>

      <AddTrackerDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onAdded={(id) => {
          setShowAddDialog(false)
          void onAdded()
          router.push(`/trackers/${id}`)
        }}
      />
    </div>
  )
}

export { DashboardEmptyState }
