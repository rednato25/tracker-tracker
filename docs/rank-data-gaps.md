# Rank data gaps by tracker

Investigation only. No adapter or schema changes are made here. The question is
what each platform actually exposes for the four rank inputs that the current
model cannot fully answer: uploaded-torrent count, seed size, average seed time,
and seeding points/bonus.

Availability terms:

- **yes** — present in an API response or profile page.
- **needs scraping** — only present in HTML, or in a page/endpoint the adapter
  does not currently call.
- **no** — not exposed by the API or the profile page. Deriving it from the
  download client is possible, but that is not a tracker field.

Effort assumes the current adapter shape and includes the smallest change that
puts the value in the database. Adding a field to rank distance also means
adding a `RankMetric`, an observation, and formatting; that is called out where
it applies.

## The table

| Platform | Field | Available | Already stored | Effort to add |
| --- | --- | --- | --- | --- |
| UNIT3D | Upload count | needs scraping | no | Medium. Stock UNIT3D shows total uploads (non-anonymous + anonymous) on the user profile, not in `/api/user`. The API token cannot read the HTML profile, so this needs a cookie-session fetch plus a parser. |
| UNIT3D | Seed size | needs scraping | no | Medium. Profile "Seed statistics" exposes seeding size. Same cookie-session fetch; store bytes in `platformMeta` or a snapshot column. |
| UNIT3D | Average seed time | needs scraping | no | Medium. Profile "Seed statistics" exposes average seed time. Same fetch; store seconds and add a rank metric for distance/ETA. |
| UNIT3D | Seeding points / bonus | yes | yes | None. `/api/user` returns `seedbonus`; it is already snapshotted as `seedbonus`. |
| Gazelle | Upload count | yes | yes | None. `action=user` enrichment returns `community.uploaded`; the app already stores it in `platformMeta` and maps it to the `uploads` observation. |
| Gazelle | Seed size | no | no | Not exposed by the index or extended profile API. A download-client estimate is the only local option. |
| Gazelle | Average seed time | needs scraping | no | Medium to High. The profile renders "Mean seed time" from seed time divided by seeding count. It is not in `action=user`, and the API token does not authenticate `user.php`; needs a cookie session, parser, and metric. |
| Gazelle | Seeding points / bonus | yes | yes | None. Index returns `bonusPoints` or `bonuspoints`; already snapshotted as `seedbonus`. |
| MAM | Upload count | yes | no | Low. `snatch_summary.upAct.count` plus `upInact.count` is the account's uploaded-torrent count. Store it in `platformMeta` (latest only) or a snapshot column for history. |
| MAM | Seed size | yes | no | Low to Medium. Each snatch category carries a `size`; sum the seeding categories that report one. The field can be null, so store only a verified sum. |
| MAM | Average seed time | needs scraping | no | High. `jsonLoad.php` exposes counts and sizes, not seed time. A profile-page seed-time field is not confirmed; this needs page recon, cookie scraping, and a metric. |
| MAM | Seeding points / bonus | yes | yes | None. `seedbonus` is returned directly and snapshotted. MAM caps it at 99,999. |
| TorrentLeech | Upload count | no | no | No API, and the profile carries byte totals, seeding/leeching counts, slots, H&R and TL Points, but no upload count. |
| TorrentLeech | Seed size | needs scraping | no | Low. The top-bar "Uploaded (Seeding)" cell is `<size> (<count>)`; the parser already reads the count and discards the size. Parse the leading size and store bytes. |
| TorrentLeech | Average seed time | no | no | No seed-time field on the profile page. |
| TorrentLeech | Seeding points / bonus | yes | yes | None. TL Points are parsed and snapshotted as `seedbonus`. |
| DigitalCore | Upload count | yes | yes | Low. `/api/v1/users/:id` returns a `torrents` counter, already stored as `platformMeta.torrents`. Confirm the site labels it as uploaded torrents, then expose it as `uploads`. |
| DigitalCore | Seed size | yes | no | Low. `/api/v1/status` returns `user.currentGbSeed` (GB). Convert to bytes and store in `platformMeta` or a snapshot column. |
| DigitalCore | Average seed time | no | no | Not in the status or user API. |
| DigitalCore | Seeding points / bonus | yes | yes | None. `bonuspoang` is parsed and snapshotted as `seedbonus`. |
| Portugas | Upload count | needs scraping | no | Medium. The UNIT3D build links to `/users/:name/uploads`; the profile key-value list currently parsed has no total. Cookie auth is already present, so this is page parsing plus storage. |
| Portugas | Seed size | yes | yes | None for storage. Profile "Tamanho das Sementes" is already stored as `platformMeta.seedSizeBytes`; add a rank metric to use it for distance. |
| Portugas | Average seed time | needs scraping | no | Medium. This is a custom UNIT3D profile; an average seed-time field may exist but is not parsed or verified. Needs page recon and parsing. |
| Portugas | Seeding points / bonus | yes | yes | None. BON points are parsed and snapshotted as `seedbonus`. |
| FileList | Upload count | no | no | The profile table has byte totals, seeding count/size, invites, reputation and comment counts, but no upload count. |
| FileList | Seed size | yes | yes | None for storage. The "Seed bonus" row is already parsed into `platformMeta.totalSeedSizeBytes`; add a rank metric to use it for distance. |
| FileList | Average seed time | no | no | The same row carries no seed time. |
| FileList | Seeding points / bonus | yes | yes | None. FLCoins are parsed and snapshotted as `seedbonus`. |
| M-Team | Upload count | yes | no | Low to Medium. `/api/tracker/myPeerStatistics` returns `uploadCount`. The adapter calls `myPeerStatus`, not this endpoint, so this is one extra API call plus storage. |
| M-Team | Seed size | yes | no | Low to Medium. The same `myPeerStatistics` call returns `seederSize` in bytes. Store it alongside the upload count. |
| M-Team | Average seed time | needs scraping | no | Medium to High. `memberCount.seedtime` is total seed time, not an average. An average needs per-torrent data or a profile field, plus a metric. |
| M-Team | Seeding points / bonus | yes | yes | None. `memberCount.bonus` is parsed and snapshotted as `seedbonus`; `/api/tracker/mybonus` also exposes bonus per hour. |
| CarPT | Upload count | needs scraping | no | Medium. NexusPHP user-details or upload-list scraping; the row/list label is site-defined and not currently parsed. |
| CarPT | Seed size | needs scraping | no | Medium. NexusPHP user-details commonly has a seeding-size row, but the current parser does not read one. Needs label verification and byte parsing. |
| CarPT | Average seed time | needs scraping | no | Medium. NexusPHP user-details commonly has seed-time rows, but the current parser does not read one. Needs label verification and duration parsing. |
| CarPT | Seeding points / bonus | yes | yes | None. 魔力值 is the header bonus and is snapshotted as `seedbonus`; 做种积分 is stored as `platformMeta.seedingPoints`. |

## What "already stored" means

Two different stores are in play:

- `tracker_snapshots` has a row per poll and columns for `seeding_count` and
  `seedbonus` (`src/lib/db/schema.ts:194`). Those two fields have history.
- `trackers.platform_meta` is a single JSON column overwritten on every poll
  (`src/lib/db/schema.ts:164`). Upload counts, seed sizes and seeding points
  live here today, so the current value survives but previous values do not.
  No trend, forecast or ETA can be built from them without a migration.

There is no column for upload count, seed size, or average seed time. A
latest-only value is enough to answer "how far is the next rank". History needs
snapshot columns or a new table.

## Why stored data still does not drive rank distance

The rank layer has no `seedSize` or `averageSeedTime` metric:

- `RANK_METRICS` in `src/lib/rank-goals.ts:20` lists `seedingCount`,
  `seedbonus`, `uploads`, etc., but not seed size or average seed time.
- `buildRankObservations` in `src/lib/rank-observations.ts:64` only adds
  `uploads`, and only for Gazelle.
- `rank-overview.ts:31` marks metrics outside that set as "Not a supported
  metric". A `seedsize` or `avg seedtime` requirement is therefore not
  evaluated even for FileList or Portugas, where the value is already in
  `platformMeta`.

So the gap is two-part: collect the value, then teach the rank layer to use it.
The second part is needed for FileList and Portugas seed size even though
storage already exists.

## Evidence

Code paths checked:

- `src/lib/db/schema.ts:164` (`platform_meta`), `:186`-`:208` (snapshots).
- `src/lib/tracker-platforms/adapters/unit3d.ts:64`-`:79`, `:301`-`:322`.
- `src/lib/tracker-platforms/adapters/gazelle.ts:175`-`:197`, `:378`-`:432`.
- `src/lib/tracker-platforms/adapters/mam.ts:151`-`:199`.
- `src/lib/tracker-platforms/adapters/torrentleech.ts:336`-`:385`.
- `src/lib/tracker-platforms/adapters/digitalcore.ts:147`-`:217`,
  `:330`-`:389`.
- `src/lib/tracker-platforms/adapters/portugas.ts:145`-`:167`,
  `:188`-`:202`.
- `src/lib/tracker-platforms/adapters/filelist.ts:107`-`:145`,
  `:188`-`:216`.
- `src/lib/tracker-platforms/adapters/mteam.ts:18`-`:26`, `:34`-`:50`,
  `:159`-`:189`, `:233`-`:244`.
- `src/lib/tracker-platforms/adapters/carpt.ts:88`-`:115`, `:184`-`:209`.
- `src/lib/rank-goals.ts:20`, `src/lib/rank-observations.ts:64`,
  `src/lib/rank-overview.ts:31`.

Platform sources used to confirm what is actually exposed:

- UNIT3D profile: `HDInnovations/UNIT3D`
  `resources/views/user/profile/show.blade.php` has "Torrent count" total
  uploads and a "Seed statistics" panel with total seed time, average seed time
  and seeding size. `app/Http/Resources/UserResource.php` confirms `/api/user`
  carries none of those three.
- Gazelle: `OPSnet/Gazelle` `templates/user/sidebar-stats.twig` renders
  "Mean seed time" from `stats.seedtimeHour / stats.seedingTotal`; the user
  page and API expose uploads as `community.uploaded`. Seed size is not shown.
- MAM: `docs/kb/docs/contributing/tracker-responses-mam.md` documents
  `snatch_summary` categories, their counts and `seedbonus`; the category type
  in `mam.ts` also carries `size`.
- DigitalCore: the Rartracker schema used by DigitalCore exposes
  `user.currentGbSeed` on `/api/v1/status`; `torrents` is on
  `/api/v1/users/:id`.
- M-Team: both `sunerpy/pt-tools` and `pt-plugins/PT-depiler` read
  `/api/tracker/myPeerStatistics` for `uploadCount` and `seederSize`.
  `/api/member/profile` returns `memberCount.bonus` and total `seedtime`.

## Suggested order

1. Cheap wins that need no new auth: M-Team `myPeerStatistics`, DigitalCore
   `currentGbSeed`, TorrentLeech's top-bar seed size, MAM upload count and
   category sizes.
2. Add `seedSize` and `averageSeedTime` metrics to the rank layer, then wire
   FileList and Portugas seed size, which are already stored.
3. Cookie-session profile scraping for UNIT3D, Gazelle, Portugas and CarPT,
   where upload count and average seed time are only on the web profile.
4. Snapshot the new values only if rank ETA or trend charts are required;
   latest-only `platformMeta` is enough for current distance.
