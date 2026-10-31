// src/components/dashboard/ManualValueEditor.tsx
//
// P47: a user-entered current value for a metric the tracker API does not
// report. The value is stored with the date it was entered, used only when no
// observed value exists, and marked stale after 14 days.

"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { localDateStr } from "@/lib/formatters"
import type { RankMetric } from "@/lib/rank-goals"
import {
  formatManualAge,
  isManualValueStale,
  manualUnitsFor,
  manualValueToCanonical,
  type RankManualUnit,
  type RankManualValue,
} from "@/lib/rank-manual-values"

interface ManualValueEditorProps {
  trackerName: string
  metric: RankMetric
  label: string
  manual: RankManualValue | null
  manualUsed: boolean
  manualStale?: boolean
  observed: boolean
  canEnter: boolean
  now: Date
  onSave: (value: RankManualValue) => Promise<void>
  onClear: () => Promise<void>
  /** Controlled editing, so the inline trigger can live in a compact row. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  triggerVariant?: "button" | "link"
  hideTrigger?: boolean
}

export function ManualValueEditor({
  trackerName,
  metric,
  label,
  manual,
  manualUsed,
  manualStale,
  observed,
  canEnter,
  now,
  onSave,
  onClear,
  open,
  onOpenChange,
  triggerVariant = "button",
  hideTrigger = false,
}: ManualValueEditorProps) {
  const units = manualUnitsFor(metric)
  const [internalEditing, setInternalEditing] = useState(false)
  const editing = open ?? internalEditing
  const setEditing = (next: boolean) => {
    if (open === undefined) setInternalEditing(next)
    onOpenChange?.(next)
  }
  const [value, setValue] = useState("")
  const [unit, setUnit] = useState<RankManualUnit>(manual?.unit ?? units[0] ?? "count")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const stale = manual ? (manualStale ?? isManualValueStale(manual.enteredAt, now)) : false

  async function save() {
    if (saving) return
    const parsed = Number(value.replace(/,/g, "").trim())
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError("Enter a value of zero or more.")
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave({
        value: manualValueToCanonical(metric, parsed, unit),
        unit,
        enteredAt: localDateStr(now),
      })
      setEditing(false)
      setValue("")
    } catch {
      setError("Could not save this value. Try again.")
    } finally {
      setSaving(false)
    }
  }

  async function clear() {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      await onClear()
    } catch {
      setError("Could not clear this value. Try again.")
    } finally {
      setSaving(false)
    }
  }

  if (manual) {
    return (
      <div className="mt-1 flex flex-col gap-1" data-manual-value>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-mono text-4xs text-tertiary">
            {formatManualAge(manual.enteredAt, now)}
            {stale ? "* · Needs checking" : ""}
          </span>
          {manualUsed ? (
            <Badge variant="accent">Manual value</Badge>
          ) : (
            <span className="font-mono text-4xs text-tertiary">Observed value wins</span>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void clear()}
            disabled={saving}
            className="min-h-11 px-2 sm:min-h-8"
            data-clear-manual-value
          >
            Clear
          </Button>
        </div>
        {error && (
          <p className="text-4xs text-danger" role="alert">
            {error}
          </p>
        )}
      </div>
    )
  }

  if (observed || !canEnter) return null

  return (
    <div className="mt-1 flex flex-col gap-1.5">
      {!editing ? (
        hideTrigger ? null : triggerVariant === "link" ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="w-fit text-2xs font-medium text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-focus)] focus-visible:ring-offset-1"
            data-enter-manual-value
          >
            Enter value
          </button>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setEditing(true)}
            className="min-h-11 px-2 sm:min-h-8"
            data-enter-manual-value
          >
            Enter value
          </Button>
        )
      ) : (
        <div className="flex flex-wrap items-end gap-1.5">
          <label className="flex flex-col gap-0.5">
            <span className="font-cond text-4xs uppercase tracking-[0.1em] text-tertiary">
              {label}
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              aria-label={`Value for ${label} on ${trackerName}`}
              className="min-h-11 w-28 rounded-nm-sm border border-border bg-control-bg px-2 py-1 font-mono text-xs text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-control-focus)] sm:min-h-8"
            />
          </label>
          {units.length > 1 && (
            <label className="flex flex-col gap-0.5">
              <span className="font-cond text-4xs uppercase tracking-[0.1em] text-tertiary">
                Unit
              </span>
              <select
                value={unit}
                onChange={(event) => setUnit(event.target.value as RankManualUnit)}
                aria-label={`Unit for ${label} on ${trackerName}`}
                className="min-h-11 rounded-nm-sm border border-border bg-control-bg px-2 py-1 font-mono text-xs text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-control-focus)] sm:min-h-8"
              >
                {units.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          )}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void save()}
            disabled={saving || value.trim() === ""}
            className="min-h-11 sm:min-h-8"
          >
            Save value
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setEditing(false)
              setError(null)
            }}
            disabled={saving}
            className="min-h-11 sm:min-h-8"
          >
            Cancel
          </Button>
        </div>
      )}
      {error && (
        <p className="text-4xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
