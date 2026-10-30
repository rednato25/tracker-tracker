// src/lib/rank-manual-values-client.ts
//
// P47 client writes for manual rank values. The route stores them in the
// existing dashboardSettings JSON, so no schema change is needed.

import type { RankMetric } from "@/lib/rank-goals"
import type { RankManualValue, RankManualValuesByTracker } from "@/lib/rank-manual-values"

interface RankManualValuesResponse {
  rankManualValues?: RankManualValuesByTracker
  error?: string
}

export async function putRankManualValue(
  trackerId: number,
  metric: RankMetric,
  manualValue: RankManualValue | null
): Promise<RankManualValuesByTracker> {
  const res = await fetch("/api/settings/rank-manual-values", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trackerId, metric, manualValue }),
  })
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as RankManualValuesResponse | null
    throw new Error(payload?.error ?? "Could not save the manual value")
  }
  const payload = (await res.json()) as RankManualValuesResponse
  return payload.rankManualValues ?? {}
}
