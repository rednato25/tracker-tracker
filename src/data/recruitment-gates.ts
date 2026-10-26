// src/data/recruitment-gates.ts
//
// Source-side invite/class/forum gates from the trackerpathways
// "unlockInviteClass" field. Pinned source: 5e3b206ed1352b56a685b90ec8da3757f702c3eb
//
// Upstream documents this as a source-gate wait/class value used alongside a
// route's "days" value. It is a required prerequisite, not a structured metric:
// P17 keeps it unresolved so a route cannot become eligible while this gate is
// unknown. Do not fetch this at render time.

import type { RecruitmentSourceGate } from "@/lib/recruitment-routes"

type RawGate = readonly [trackerId: string, days: number | null, text: string]

const RAW_GATES: readonly RawGate[] = [
  ["aither", 240, "Prometheus: 8 months, 10TiB upload or 10TiB seedsize, 5 uploads, ratio>=1.0, avg seedtime>=1 month 2 weeks 1 day; Titan: 2 years, 100TiB upload or 65TiB seedsize, 20 uploads, ratio>=2.0, avg seedtime>=6 months"],
  ["alpharatio", 182, "Sphinx: 26 weeks, 3.2TB upload, 1.44m BP"],
  ["animebytes", 14, "PU: 2 weeks, upload 25GB, 10 torrents, ratio>=0.7"],
  ["anthelion", 30, "PU: 5 uploads and/or 10 adoptions, 1TiB upload, ratio>=1, 25k BP, 1 month"],
  ["blutopia", 30, "BluExtremist: 3 months, 20TiB upload, ratio>=0.4, or BluSeeder+: 1 month, 5TiB seedsize, avg seedtime>=1 month, ratio>=0.4"],
  ["broadcasthenet", 28, "PU: 4 weeks, 250GB upload/download, 250 snatches (upload/download), 250,000 bonus points"],
  ["darkpeers", 120, "ExtremeUser: 4 months, 20TiB upload, ratio>0.8, avg seedtime >= 2 months, 15 torrents uploaded; or, Hoarder: 4 months, 16TiB seedsize, ratio>0.8, avg seedtime >= 3 months"],
  ["digitalcore", 210, "Sentry: 7 months, 1,200 GiB upload, ratio>=1.10"],
  ["gazellegames", 30, "Pro Gamer: 1200 points, 30 days; Legendary Gamer: 3000 points, 90 days"],
  ["greatposterwall", 14, "PU: 2 weeks, 200GB download, 1 upload, ratio>=1.2"],
  ["lst", 120, "Whale: 4 months, 25 TiB upload or 6 TiB seedsize, 10 uploads, ratio >= 1.0, avg seedtime >= 1 month; Sailboat: 6 months, 10 TiB seedsize, ratio >= 1.0, avg seedtime >= 2 months"],
  ["luminarr", 90, "Archivist: 3 months, 10TiB upload, 10TiB seedsize, avg seedtime>=2 month, ratio>=1.0, or Elite: 3 months, 10TiB upload, 50 torrents, ratio>=1.0"],
  ["mteam", 56, "Elite: 8 weeks, 400GB download, ratio>3"],
  ["myanonamouse", 180, "PU: 6 months, 1 TiB upload, ratio>=2"],
  ["nebulance", 28, "Ensign: 4 weeks, 100GB upload, 100 snatches, 100k BP"],
  ["onlyencodes", 60, "Trailblazer: 2 months, 5 TB upload, seedsize 100 GB, ratio >=0.4"],
  ["orpheus", 28, "Elite: 4 weeks, 100GiB upload, 50 torrents, ratio>1.05"],
  ["passthepopcorn", 28, "PU: 4 weeks, 80GB upload, 1 torrent, ratio>1.05"],
  ["reelflix", 90, "Elite: 90 days, 2.5TiB upload, ratio>=1.2, avg seedtime>=30 days"],
  ["rockethd", 60, "Lunar Explorer: 2 months, 2TiB Upload, ratio>=1.0, avg seedtime>=1 month"],
  ["seedpool", 180, "SuperPool: 6 months, 1TiB seedsize, ratio>=1"],
  ["uploadcx", 84, "PU: 12 weeks, 3TiB upload, ratio >= 1"],
  ["yuscene", 60, "Super User: 2 months, ratio >=0.70, uploaded >=5 TiB"],
]

export const RECRUITMENT_SOURCE_GATES: RecruitmentSourceGate[] = RAW_GATES.map(
  ([trackerId, days, text]) => ({ trackerId, days, text })
)
