// src/lib/rank-observations.ts
//
// Single observation builder for P09 consumers (dashboard summary and tracker
// detail). The 24h freshness and source handling stay identical across both.

import type { RankObservationMap } from "@/lib/rank-goals"
import type { TrackerLatestStats } from "@/types/api"
import type {
  CarptPlatformMeta,
  DigitalCorePlatformMeta,
  FileListPlatformMeta,
  PortugasPlatformMeta,
} from "@/types/tracker-stats"

export const RANK_OBSERVATION_STALE_MS = 24 * 60 * 60 * 1000

function metaNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null
}

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
      // Zero download with upload is a real ratio, not missing data. Keeping it
      // as Infinity lets a minimum-ratio condition see the maximum possible value.
      value: stats.ratioIsInfinite ? Number.POSITIVE_INFINITY : stats.ratio,
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

  // Seed size and seeding points live in platformMeta, which is overwritten on
  // every poll. A missing or null figure stays absent so the rank layer reports
  // it as not collected instead of treating it as a measured zero.
  const seedSizeBytes =
    input.platformType === "filelist"
      ? metaNumber((input.platformMeta as FileListPlatformMeta | null)?.totalSeedSizeBytes)
      : input.platformType === "portugas"
        ? metaNumber((input.platformMeta as PortugasPlatformMeta | null)?.seedSizeBytes)
        : input.platformType === "digitalcore"
          ? metaNumber((input.platformMeta as DigitalCorePlatformMeta | null)?.seedSizeBytes)
          : null
  if (seedSizeBytes !== null) {
    observations.seedSizeBytes = { value: seedSizeBytes, freshness, source, observedAt }
  }

  if (input.platformType === "carpt") {
    const seedingPoints = metaNumber(
      (input.platformMeta as CarptPlatformMeta | null)?.seedingPoints
    )
    if (seedingPoints !== null) {
      observations.seedingPoints = { value: seedingPoints, freshness, source, observedAt }
    }
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
