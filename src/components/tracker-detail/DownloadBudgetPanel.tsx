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

function statusText(status: string): string {
  if (status === "available") return "Arithmetic allowance"
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
  const result = useMemo(() => {
    if (uploaded === null || downloaded === null) return null
    const sizeGiB = num(size)
    const c = fraction(chargedFraction)
    const targetRatio = num(target)
    const q = num(committed) ?? 0
    const reserveBytes = (num(reserve) ?? 0) * GiB
    return calculateDownloadBudget({
      uploaded,
      downloaded,
      size: sizeGiB === null ? null : sizeGiB * GiB,
      chargedFraction: c,
      targetRatio,
      committedDownload: q * GiB,
      reserveChargedBytes: reserveBytes,
      minimumRatio: minimum,
    })
  }, [uploaded, downloaded, size, chargedFraction, target, committed, reserve, minimum])

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
      targetRatio: num(target),
      committedDownload: (num(committed) ?? 0) * GiB,
      reserveChargedBytes: (num(reserve) ?? 0) * GiB,
      minimumRatio: minimum,
    })
  }, [entries, uploaded, downloaded, target, committed, reserve, minimum])

  function addEntry() {
    const sizeGiB = num(size)
    const c = fraction(chargedFraction)
    if (sizeGiB === null || sizeGiB <= 0 || c === null) {
      setError("Enter a positive size and choose an explicit accounting assumption.")
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

  return (
    <section className="border border-border bg-raised p-4" data-download-budget-panel>
      <H2 className="uppercase tracking-wider">Download budget</H2>
      <p className="mt-1 font-mono text-4xs text-tertiary">
        Account-ratio arithmetic only. It does not certify H&amp;R compliance, tracker policy or overall safety.
      </p>
      {!stats ? (
        <p className="mt-3 font-mono text-xs text-secondary" role="status">
          Accounted upload/download data is unavailable. No budget is claimed.
        </p>
      ) : (
        <>
          <div className="mt-3 grid gap-2 font-mono text-4xs text-secondary sm:grid-cols-2">
            <p>
              Accounted upload:{" "}
              {uploaded === null ? "unavailable" : formatBytesNum(uploaded)}
            </p>
            <p>
              Accounted download:{" "}
              {downloaded === null ? "unavailable" : formatBytesNum(downloaded)}
            </p>
            <p>Tracker minimum: {minimum === null ? "unknown" : minimum === 0 ? "none" : formatRatio(minimum)}</p>
            <p>
              Observed data: {stale ? "stale — verify before relying on the result" : "fresh"}{" "}
              {lastPolledAt ? `(${lastPolledAt})` : ""}
            </p>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Input
              label="Proposed size (GiB)"
              value={size}
              onChange={(e) => setSize(e.target.value)}
              placeholder="80"
              inputMode="decimal"
              name="download-budget-size"
            />
            <label className="flex flex-col gap-1">
              <span className="font-cond text-4xs uppercase tracking-[0.12em] text-secondary">
                Accounting assumption
              </span>
              <select
                className="border border-border bg-field px-3 py-2 font-mono text-xs text-primary"
                value={chargedFraction}
                onChange={(e) => setChargedFraction(e.target.value)}
                name="download-budget-charged-fraction"
              >
                <option value="">Unknown — no allowance claimed</option>
                <option value="1">100% charged</option>
                <option value="0.5">50% charged</option>
                <option value="0">Freeleech / 0% charged (scenario)</option>
              </select>
            </label>
            <Input
              label="Target ratio (yours)"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="1.0"
              inputMode="decimal"
              name="download-budget-target"
            />
            <Input
              label="Committed charged traffic (GiB)"
              value={committed}
              onChange={(e) => setCommitted(e.target.value)}
              inputMode="decimal"
              name="download-budget-committed"
            />
            <Input
              label="Charged reserve (GiB)"
              value={reserve}
              onChange={(e) => setReserve(e.target.value)}
              inputMode="decimal"
              name="download-budget-reserve"
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" onClick={addEntry} text={editingId ? "Save scenario" : "Add to scenario"} />
            <span className="font-mono text-4xs text-muted">
              Scenario entries are planning only; nothing is sent to a download client.
            </span>
          </div>
          {error && <p className="mt-2 font-mono text-4xs text-danger">{error}</p>}
          {minimum !== null && targetNum !== null && targetNum < minimum && (
            <p className="mt-2 font-mono text-4xs text-warn">
              Your target ratio is below the known tracker minimum ({formatRatio(minimum)}). This is not a safe allowance.
            </p>
          )}
          {result && (
            <div className="mt-3 border-t border-border pt-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={result.status === "available" ? "default" : "warn"}>
                  {statusText(result.status)}
                </Badge>
                <span className="font-mono text-4xs text-secondary">{result.reason}</span>
              </div>
              <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 font-mono text-4xs text-secondary sm:grid-cols-2">
                <div className="flex justify-between gap-2">
                  <dt>Projected ratio</dt>
                  <dd>{result.projectedRatio === null ? "unavailable" : formatRatio(result.projectedRatio)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Charged bytes</dt>
                  <dd>{result.chargedBytes === null ? "unavailable" : formatBytesNum(result.chargedBytes)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Transfer budget</dt>
                  <dd>{result.transferBudget === null ? "not claimed" : formatBytesNum(result.transferBudget)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Upload needed</dt>
                  <dd>{result.additionalUploadRequired === null ? "unavailable" : formatBytesNum(result.additionalUploadRequired)}</dd>
                </div>
              </dl>
              {result.status === "scenario-only" && (
                <p className="mt-1 font-mono text-4xs text-warn">
                  Zero-charge scenario: freeleech expiry and future accounting are not assumed.
                </p>
              )}
            </div>
          )}
          {entries.length > 0 && (
            <div className="mt-3 border-t border-border pt-2" data-scenario-queue>
              <div className="flex items-center justify-between gap-2">
                <H2 className="uppercase tracking-wider">Scenario queue</H2>
                <span className="font-mono text-4xs text-muted">Planning only</span>
              </div>
              <ul className="mt-1">
                {entries.map((entry) => (
                  <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-border py-1 font-mono text-4xs">
                    <span>{entry.sizeGiB} GiB · {entry.chargedFraction === "0" ? "freeleech scenario" : `${Number(entry.chargedFraction) * 100}% charged`}</span>
                    <span className="flex gap-2">
                      <button type="button" className="text-accent underline-offset-2 hover:underline" onClick={() => editEntry(entry)}>Edit</button>
                      <button type="button" className="text-danger underline-offset-2 hover:underline" onClick={() => removeEntry(entry.id)}>Remove</button>
                    </span>
                  </li>
                ))}
              </ul>
              {queue && (
                <p className="mt-1 font-mono text-4xs text-secondary">
                  Cumulative: {queue.projectedRatio === null ? "unavailable" : `ratio ${formatRatio(queue.projectedRatio)}`}
                  {" · "}
                  {queue.transferBudget === null ? "budget not claimed" : `remaining budget ${formatBytesNum(queue.transferBudget)}`}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </section>
  )
}
