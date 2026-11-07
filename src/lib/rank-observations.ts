// src/lib/rank-observations.ts
//
// Single observation builder for P09 consumers (dashboard summary and tracker
// detail). The 24h freshness and source handling stay identical across both.

import { isProfileReadFresh, readProfileReadRecord } from "@/lib/profile-reading/types"
import type { RankObservationMap } from "@/lib/rank-goals"
import type { TrackerLatestStats } from "@/types/api"
import type {
  CarptPlatformMeta,
  DigitalCorePlatformMeta,
  FileListPlatformMeta,
  MamPlatformMeta,
  MteamPlatformMeta,
  PortugasPlatformMeta,
  TorrentleechPlatformMeta,
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
  const meta = input.platformMeta
  let seedSizeBytes: number | null = null
  switch (input.platformType) {
    case "filelist":
      seedSizeBytes = metaNumber((meta as FileListPlatformMeta | null)?.totalSeedSizeBytes)
      break
    case "portugas":
      seedSizeBytes = metaNumber((meta as PortugasPlatformMeta | null)?.seedSizeBytes)
      break
    case "digitalcore":
      seedSizeBytes = metaNumber((meta as DigitalCorePlatformMeta | null)?.seedSizeBytes)
      break
    case "mteam":
      seedSizeBytes = metaNumber((meta as MteamPlatformMeta | null)?.seedSizeBytes)
      break
    case "mam":
      seedSizeBytes = metaNumber((meta as MamPlatformMeta | null)?.seedSizeBytes)
      break
    case "torrentleech":
      seedSizeBytes = metaNumber((meta as TorrentleechPlatformMeta | null)?.seedSizeBytes)
      break
  }
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
  // percentile and must never be used as a count. M-Team and MAM report their
  // own uploaded-torrent counts in platformMeta.
  if (input.platformType === "gazelle") {
    const community = (meta as { community?: { uploaded?: unknown } } | null)?.community
    const uploaded = community?.uploaded
    if (typeof uploaded === "number" && Number.isSafeInteger(uploaded) && uploaded >= 0) {
      observations.uploads = { value: uploaded, freshness, source, observedAt }
    }
  } else if (input.platformType === "mteam") {
    const uploads = metaNumber((meta as MteamPlatformMeta | null)?.uploads)
    if (uploads !== null) observations.uploads = { value: uploads, freshness, source, observedAt }
  } else if (input.platformType === "mam") {
    const uploads = metaNumber((meta as MamPlatformMeta | null)?.uploads)
    if (uploads !== null) observations.uploads = { value: uploads, freshness, source, observedAt }
  }

  // P49: a daily profile read is an observation in its own right. It fills a
  // metric only when the normal poll does not already report one, and it is
  // marked stale after its own 24-hour window or after a stopped read.
  const profile = readProfileReadRecord(input.platformMeta)
  if (profile?.fetchedAt) {
    const profileFreshness: "fresh" | "stale" = isProfileReadFresh(profile, input.now)
      ? "fresh"
      : "stale"
    const profileObservation = (value: number) => ({
      value,
      freshness: profileFreshness,
      source: "profile" as const,
      observedAt: profile.fetchedAt,
    })
    if (profile.values.seedSizeBytes !== undefined && !observations.seedSizeBytes) {
      observations.seedSizeBytes = profileObservation(profile.values.seedSizeBytes)
    }
    if (
      profile.values.averageSeedTimeSeconds !== undefined &&
      !observations.averageSeedTimeSeconds
    ) {
      observations.averageSeedTimeSeconds = profileObservation(
        profile.values.averageSeedTimeSeconds
      )
    }
    if (profile.values.uploads !== undefined && !observations.uploads) {
      observations.uploads = profileObservation(profile.values.uploads)
    }
  }

  return observations
}
