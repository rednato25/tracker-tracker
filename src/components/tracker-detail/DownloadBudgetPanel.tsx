"use client"

import { H2 } from "@typography"
import { useMemo, useState } from "react"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { registryEntryFor } from "@/data/tracker-registry"
import { calculateDownloadBudget } from "@/lib/download-budget"
import { formatBytesNum, formatRatio } from "@/lib/formatters"
import { resolveAccountRatio } from "@/lib/tracker-rules"
import type { TrackerLatestStats } from "@/types/api"

interface DownloadBudgetPanelProps {
  trackerId: number
  registrySlug: string | null
  stats: TrackerLatestStats | null
  lastPolledAt: string | null
}

interface ScenarioEntry {
  id: string
  sizeGiB: string
  chargedFraction: string
}

const GiB = 1024 ** 3
const STALE_MS = 24 * 60 * 60 * 1000

function num(value: string): number | null {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function fraction(value: string): number | null {
  if (value === "") return null
  const parsed = Number(value)
  return parsed === 0 || parsed === 0.5 || parsed === 1 ? parsed : null
}

function chargeLabel(value: string): string {
  if (value === "1") return "Fully charged (100%)"
  if (value === "0.5") return "Half charged (50%)"
  if (value === "0") return "Freeleech (0%, scenario)"
  return "Unknown accounting"
}

function statusText(status: string): string {
  if (status === "available") return "Estimate available"
  if (status === "scenario-only") return "Scenario only"
  if (status === "not-applicable") return "Not applicable"
  return "Unavailable"
}

export function DownloadBudgetPanel({
  trackerId,
  registrySlug,
  stats,
  lastPolledAt,
}: DownloadBudgetPanelProps) {
  const registryRules = registryEntryFor({ registrySlug })?.rules
  const minimum = resolveAccountRatio(stats?.requiredRatio, registryRules)
  const [target, setTarget] = useState(minimum && minimum > 0 ? String(minimum) : "")
  const [size, setSize] = useState("")
  const [chargedFraction, setChargedFraction] = useState("")
  const [committed, setCommitted] = useState("0")
  const [reserve, setReserve] = useState("0")
  const [entries, setEntries] = useState<ScenarioEntry[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const uploaded = stats?.uploadedBytes == null ? null : Number(stats.uploadedBytes)
  const downloaded = stats?.downloadedBytes == null ? null : Number(stats.downloadedBytes)
  const last = lastPolledAt ? new Date(lastPolledAt) : null
  const stale = !last || Number.isNaN(last.getTime()) || Date.now() - last.getTime() > STALE_MS
  const targetNum = num(target)
  const sizeGiB = num(size)
  const charge = fraction(chargedFraction)

  const result = useMemo(
    () =>
      uploaded === null || downloaded === null
        ? null
        : calculateDownloadBudget({
            uploaded,
            downloaded,
            size: sizeGiB === null ? null : sizeGiB * GiB,
            chargedFraction: charge,
            targetRatio: targetNum,
            committedDownload: (num(committed) ?? 0) * GiB,
            reserveChargedBytes: (num(reserve) ?? 0) * GiB,
            minimumRatio: minimum,
          }),
    [uploaded, downloaded, sizeGiB, charge, targetNum, committed, reserve, minimum]
  )

  const queue = useMemo(() => {
    const parsed = entries.map((entry) => ({
      size: num(entry.sizeGiB),
      c: fraction(entry.chargedFraction),
    }))
    if (parsed.some((entry) => entry.size === null || entry.c === null)) return null
    const totalSize = parsed.reduce((sum, entry) => sum + (entry.size as number), 0)
    const totalCharged = parsed.reduce(
      (sum, entry) => sum + (entry.size as number) * (entry.c as number),
      0
    )
    const effectiveC = totalSize > 0 ? totalCharged / totalSize : 0
    if (uploaded === null || downloaded === null) return null
    return calculateDownloadBudget({
      uploaded,
      downloaded,
      size: totalSize * GiB,
      chargedFraction: effectiveC,
      targetRatio: targetNum,
      committedDownload: (num(committed) ?? 0) * GiB,
      reserveChargedBytes: (num(reserve) ?? 0) * GiB,
      minimumRatio: minimum,
    })
  }, [entries, uploaded, downloaded, targetNum, committed, reserve, minimum])

  function addEntry() {
    const nextSize = num(size)
    const nextCharge = fraction(chargedFraction)
    if (nextSize === null || nextSize <= 0 || nextCharge === null) {
      setError("Enter a positive download size and choose how it is charged.")
      return
    }
    setError(null)
    if (editingId) {
      setEntries((current) =>
        current.map((entry) =>
          entry.id === editingId ? { ...entry, sizeGiB: size, chargedFraction } : entry
        )
      )
      setEditingId(null)
    } else {
      setEntries((current) => [
        ...current,
        { id: `${trackerId}-${Date.now()}-${current.length}`, sizeGiB: size, chargedFraction },
      ])
    }
    setSize("")
    setChargedFraction("")
  }

  function editEntry(entry: ScenarioEntry) {
    setEditingId(entry.id)
    setSize(entry.sizeGiB)
    setChargedFraction(entry.chargedFraction)
    setError(null)
  }

  function removeEntry(id: string) {
    setEntries((current) => current.filter((entry) => entry.id !== id))
    if (editingId === id) {
      setEditingId(null)
      setSize("")
      setChargedFraction("")
    }
  }

  const previewReason =
    !stats
      ? "Account data is unavailable, so no estimate can be shown."
      : sizeGiB === null
        ? "Enter a download size to preview its effect."
        : charge === null
          ? "Choose how this download is charged. Unknown accounting is not assumed."
          : targetNum === null
            ? "Set a positive target ratio to preview the allowance."
            : null

  return (
    <section className="border border-border bg-raised p-4" data-download-budget-panel>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <H2 className="uppercase tracking-wider">Download budget</H2>
          <p className="mt-1 text-xs text-secondary">
            Estimate the account-ratio impact of a planned download.
          </p>
        </div>
        <span className="font-mono text-4xs text-muted">
          {stats ? (stale ? "Account data is stale" : "Account data is fresh") : "Account data unavailable"}
        </span>
      </div>

      {stats && (
        <div className="mt-3 grid gap-x-4 gap-y-1 font-mono text-4xs text-secondary sm:grid-cols-2">
          <p>Uploaded: {uploaded === null ? "unavailable" : formatBytesNum(uploaded)}</p>
          <p>Downloaded: {downloaded === null ? "unavailable" : formatBytesNum(downloaded)}</p>
          <p>
            Tracker minimum:{" "}
            {minimum === null ? "unknown" : minimum === 0 ? "none" : formatRatio(minimum)}
          </p>
          <p>{lastPolledAt ? `Last observed: ${lastPolledAt}` : "No observation timestamp"}</p>
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Input
          label="Download size (GiB)"
          value={size}
          onChange={(e) => setSize(e.target.value)}
          placeholder="80"
          inputMode="decimal"
          name="download-budget-size"
        />
        <label className="flex flex-col gap-1">
          <span className="font-cond text-4xs uppercase tracking-[0.12em] text-secondary">
            How is it charged?
          </span>
          <select
            className="border border-border bg-field px-3 py-2 font-mono text-xs text-primary"
            value={chargedFraction}
            onChange={(e) => setChargedFraction(e.target.value)}
            name="download-budget-charged-fraction"
          >
            <option value="">Unknown accounting</option>
            <option value="1">Fully charged (100%)</option>
            <option value="0.5">Half charged (50%)</option>
            <option value="0">Freeleech (0%, scenario)</option>
          </select>
        </label>
        <Input
          label="Your target ratio"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="1.0"
          inputMode="decimal"
          name="download-budget-target"
        />
      </div>

      <details className="mt-3">
        <summary className="cursor-pointer font-mono text-4xs text-tertiary">
          Advanced: committed traffic and reserve
        </summary>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <Input
            label="Already committed (GiB)"
            value={committed}
            onChange={(e) => setCommitted(e.target.value)}
            inputMode="decimal"
            name="download-budget-committed"
          />
          <Input
            label="Reserve (GiB)"
            value={reserve}
            onChange={(e) => setReserve(e.target.value)}
            inputMode="decimal"
            name="download-budget-reserve"
          />
        </div>
      </details>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="primary"
          onClick={addEntry}
          text={editingId ? "Save simulation item" : "Add to simulation"}
        />
        <span className="font-mono text-4xs text-muted">
          Planning only. Nothing is sent to a download client.
        </span>
      </div>
      {error && <p className="mt-2 font-mono text-4xs text-danger">{error}</p>}

      {previewReason ? (
        <p className="mt-3 border-t border-border pt-2 font-mono text-xs text-secondary" role="status">
          {previewReason}
        </p>
      ) : (
        result && (
          <div className="mt-3 border-t border-border pt-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="font-cond text-4xs uppercase tracking-[0.12em] text-secondary">
                  Projected ratio
                </p>
                <p className="mt-1 font-display text-3xl text-primary">
                  {result.projectedRatio === null ? "Unavailable" : formatRatio(result.projectedRatio)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-cond text-4xs uppercase tracking-[0.12em] text-secondary">
                  Remaining allowance
                </p>
                <p className="mt-1 font-display text-2xl text-primary">
                  {result.remainingChargedAfterProposed === null
                    ? "Unavailable"
                    : formatBytesNum(result.remainingChargedAfterProposed)}
                </p>
                <p className="font-mono text-4xs text-tertiary">charged traffic to your target</p>
              </div>
              <Badge variant={result.status === "available" ? "default" : "warn"}>
                {statusText(result.status)}
              </Badge>
            </div>
            <div className="mt-3 grid gap-x-4 gap-y-1 font-mono text-4xs text-secondary sm:grid-cols-2">
              <p>Charged download: {result.chargedBytes === null ? "unavailable" : formatBytesNum(result.chargedBytes)}</p>
              <p>Total downloaded: {result.projectedDownloaded === null ? "unavailable" : formatBytesNum(result.projectedDownloaded)}</p>
              <p>Upload still needed: {result.additionalUploadRequired === null ? "unavailable" : formatBytesNum(result.additionalUploadRequired)}</p>
              <p>Physical size budget: {result.transferBudget === null ? "not claimed" : formatBytesNum(result.transferBudget)}</p>
            </div>
            {result.status === "scenario-only" && (
              <p className="mt-2 font-mono text-4xs text-warn">
                Freeleech is a scenario. Expiry and future accounting are not assumed.
              </p>
            )}
          </div>
        )
      )}

      {minimum !== null && targetNum !== null && targetNum < minimum && (
        <p className="mt-2 font-mono text-4xs text-warn">
          Your target is below the known tracker minimum ({formatRatio(minimum)}). This is not a safe allowance.
        </p>
      )}

      {entries.length > 0 && (
        <div className="mt-4 border-t border-border pt-3" data-scenario-queue>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <H2 className="uppercase tracking-wider">Saved simulation</H2>
              <p className="mt-1 font-mono text-4xs text-muted">
                Each saved item is counted once. Nothing is downloaded.
              </p>
            </div>
            <span className="font-mono text-4xs text-muted">
              {entries.length} item{entries.length === 1 ? "" : "s"}
            </span>
          </div>
          <ul className="mt-1">
            {entries.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-border py-1 font-mono text-4xs">
                <span>
                  {entry.sizeGiB} GiB · {chargeLabel(entry.chargedFraction)}
                </span>
                <span className="flex gap-2">
                  <button type="button" className="text-accent underline-offset-2 hover:underline" onClick={() => editEntry(entry)}>Edit</button>
                  <button type="button" className="text-danger underline-offset-2 hover:underline" onClick={() => removeEntry(entry.id)}>Remove</button>
                </span>
              </li>
            ))}
          </ul>
          {queue && (
            <div className="mt-2 grid gap-x-4 gap-y-1 font-mono text-4xs text-secondary sm:grid-cols-2">
              <p>
                Projected ratio:{" "}
                <span className="text-primary">
                  {queue.projectedRatio === null ? "unavailable" : formatRatio(queue.projectedRatio)}
                </span>
              </p>
              <p>
                Remaining allowance:{" "}
                <span className="text-primary">
                  {queue.remainingChargedAfterProposed === null
                    ? "unavailable"
                    : formatBytesNum(queue.remainingChargedAfterProposed)}
                </span>
              </p>
              <p>Charged download: {queue.chargedBytes === null ? "unavailable" : formatBytesNum(queue.chargedBytes)}</p>
              <p>Total downloaded: {queue.projectedDownloaded === null ? "unavailable" : formatBytesNum(queue.projectedDownloaded)}</p>
            </div>
          )}
        </div>
      )}

      <p className="mt-3 font-mono text-4xs text-muted">
        Ratio arithmetic only. Seeding and H&amp;R obligations remain separate.
      </p>
    </section>
  )
}
