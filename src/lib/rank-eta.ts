// src/lib/rank-eta.ts
import type { Snapshot } from "@/types/api"

export interface UploadEstimate {
  date: string
  daysRemaining: number
  basisDays: number
  observedDeltaBytes: number
}

export function estimateUploadCompletion(
  snapshots: Snapshot[],
  requiredBytes: number,
  latestUploadedBytes: number,
  now: Date,
  options: { windowDays?: number; staleAfterMs?: number } = {}
): UploadEstimate | null {
  const windowDays = options.windowDays ?? 30
  const staleAfterMs = options.staleAfterMs ?? 24 * 60 * 60 * 1000
  const cutoff = now.getTime() - windowDays * 86_400_000
  const points = snapshots
    .map((snapshot) => ({
      at: new Date(snapshot.polledAt),
      uploaded: Number(snapshot.uploadedBytes),
    }))
    .filter((point) => Number.isFinite(point.at.getTime()) && point.at.getTime() >= cutoff)
    .filter((point) => Number.isFinite(point.uploaded))
    .sort((a, b) => a.at.getTime() - b.at.getTime())

  if (points.length < 2) return null
  const first = points[0]
  const last = points[points.length - 1]
  const spanMs = last.at.getTime() - first.at.getTime()
  if (spanMs < 86_400_000) return null
  if (now.getTime() - last.at.getTime() > staleAfterMs) return null
  const delta = last.uploaded - first.uploaded
  if (delta <= 0) return null
  if (!Number.isFinite(latestUploadedBytes) || latestUploadedBytes >= requiredBytes) return null
  const remaining = requiredBytes - latestUploadedBytes
  const perDay = delta / (spanMs / 86_400_000)
  if (!Number.isFinite(perDay) || perDay <= 0) return null
  const daysRemaining = remaining / perDay
  return {
    date: new Date(now.getTime() + daysRemaining * 86_400_000).toISOString().slice(0, 10),
    daysRemaining,
    basisDays: Math.max(1, Math.round(spanMs / 86_400_000)),
    observedDeltaBytes: delta,
  }
}
