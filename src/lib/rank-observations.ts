// src/lib/rank-observations.ts
//
// Single observation builder for P09 consumers (dashboard summary and tracker
// detail). The 24h freshness and source handling stay identical across both.

import type { RankObservationMap } from "@/lib/rank-goals"
import type { TrackerLatestStats } from "@/types/api"

export const RANK_OBSERVATION_STALE_MS = 24 * 60 * 60 * 1000

export interface RankObservationSource {
  latestStats: TrackerLatestStats | null
  lastPolledAt: string | null
  platformType: string | null
  platformMeta: unknown
  now: Date
}

export function buildRankObservations(input: RankObservationSource): RankObservationMap {
  const stats = input.latestStats
  if (!stats) return {}
  const polled = input.lastPolledAt ? new Date(input.lastPolledAt) : null
  const freshness =
    polled &&
    !Number.isNaN(polled.getTime()) &&
    input.now.getTime() - polled.getTime() <= RANK_OBSERVATION_STALE_MS
      ? "fresh"
      : "stale"
  const source = "api" as const
  const observedAt = input.lastPolledAt

  const observations: RankObservationMap = {
    accountRatio: {
      value: stats.ratioIsInfinite ? null : stats.ratio,
      freshness,
      source,
      observedAt,
    },
    uploadedBytes: {
      value: stats.uploadedBytes === null ? null : Number(stats.uploadedBytes),
      freshness,
      source,
      observedAt,
    },
    downloadedBytes: {
      value: stats.downloadedBytes === null ? null : Number(stats.downloadedBytes),
      freshness,
      source,
      observedAt,
    },
    bufferBytes: {
      value: stats.bufferBytes === null ? null : Number(stats.bufferBytes),
      freshness,
      source,
      observedAt,
    },
    seedingCount: { value: stats.seedingCount, freshness, source, observedAt },
    seedbonus: { value: stats.seedbonus, freshness, source, observedAt },
    hitAndRuns: { value: stats.hitAndRuns, freshness, source, observedAt },
  }

  // Gazelle's community.uploaded is the upload count. ranks.uploads is a
  // percentile and must never be used as a count.
  if (input.platformType === "gazelle") {
    const community = (input.platformMeta as { community?: { uploaded?: unknown } } | null)
      ?.community
    const uploaded = community?.uploaded
    if (typeof uploaded === "number" && Number.isSafeInteger(uploaded) && uploaded >= 0) {
      observations.uploads = { value: uploaded, freshness, source, observedAt }
    }
  }

  return observations
}
