# Upstream sync report

Date: 2026-11-02

- **Fork:** `rednato25/tracker-tracker`, `main` at `7069b4e4` (P61 merge).
- **Upstream:** `jordanlambrecht/tracker-tracker`, `upstream/main` at `d9cf207a` (`Release v2.15.1`, 2026-10-30).
- **Merge base:** `63a3db11`.
- **Divergence:** 460 commits ahead, 168 behind (121 non-merge, 47 merge commits).
- **Upstream delta:** 397 files changed, +18,812 / -3,127; 79 files added, 3 deleted.

The trial merge was made on a throwaway local branch and aborted. Nothing was
pushed, and no source file was changed by this investigation. Only this report
is new.

## Method

- `git fetch upstream --prune`; compared `main`, `upstream/main` and their merge base.
- Grouped `main..upstream/main` by commit type, scope and touched path.
- Ran `git merge upstream/main` on a branch cut from `main`, recorded the
  conflicted paths and conflict hunks, inspected the key hunks, then
  `git merge --abort` and deleted the branch.
- Compared the migration systems on both sides, including the fork's manifest,
  baseline fingerprint and migration audit tests.

## 1. What the 168 commits bring

63 fixes, 29 features, 11 chores, 7 refactors, 4 style, 4 test and 3 docs
commits. Grouped:

| Area | Volume | What arrives |
|---|---|---|
| Trackers, adapters, rules | ~48 commits; 58 data files; 3 new adapter/helper files (plus tests) | New **Luminance** adapter (Cathode-Ray.Tube), **AnimeBytes** moved to its own API, **IPTorrents** rewritten to read the member's profile in one request, Cloudflare challenge detection on 403/503, announce-domain matching for 14 trackers, FileList VIP-expiry fix, GGn achievement/downloaded fixes, Orpheus class ladder, and rules/perks for Seedpool, MAM, RetroToon, TorrentLeech and FileList. Plus tracker logos and registry validation. |
| Download clients | ~15 commits; 29 files | A complete **Transmission** adapter (transport, field map, types, UI entry), a shared client-agnostic transport module, private-torrent-only polling, active-count fixes, oversized-response backoff, per-client error messages and session-cache keying. |
| Prowlarr monitoring | 4 direct commits plus merges; 10 new files under `src/lib/prowlarr` and `src/app/api/prowlarr`, plus UI cards and docs | A new **Prowlarr indexer monitoring** feature: `prowlarr_instances` / `prowlarr_indexers` tables, API routes, settings section, dashboard failure card, tracker-detail indexer card with 24h/7d stats, scheduler, hostname matching and docs. This is *not* the Prowlarr import/search feature the fork removed in P59; it is a different, read-only integration. |
| Backups | 5 commits | Restore maps dismissed alerts and notification scopes to restored ids, restores Mousehole settings only from encrypted backups, refuses to send tracker keys to unknown addresses, refuses Transmission keys and ignores unknown clients. |
| Security and auth | 6 commits | Lockdown requires the master password, password/salt changes revoke every session, download-client passwords are no longer hashed into a cache key, API keys and notification configs are audited, torrent values are kept out of logs, and SOCKS5 proxy hostnames are resolved correctly. |
| Dashboard, charts, UI | ~25 commits | "Yesterday at a glance", 24-hour ratio arrows and deltas, bonus-change fixes, `-1` ratio treated as infinite, outage bands on charts, one shared status dot, status cards beside the user card, TrackerHub grid layout, SVG icons and copy/spacing fixes. |
| Infra, deps, docs | ~15 commits | Scheduler shutdown now lets requests finish, the unused `fetchTrackerStats` is removed, Next 16.4.3, Vitest 5, emoji-picker 5, dotenv 18, Biome 2.6 and a 19-file Prettier pass, plus Prowlarr documentation. |

Notable new files: `src/lib/tracker-platforms/adapters/luminance.ts`,
`animebytes.ts`, `helpers/login-session.ts`,
`src/lib/download-clients/adapters/transmission.ts`,
`src/lib/download-clients/transport.ts`,
`src/lib/prowlarr/*`, `src/app/api/prowlarr/*`,
`src/components/settings/ProwlarrSection.tsx`,
`src/components/ui/StatusDot.tsx`.

## 2. Trial merge

`git merge upstream/main` on a branch cut from `main` produced **72 conflicted
files and 147 conflict hunks**: 70 `UU` (both sides modified) and 2 `UD`
(modified by the fork, deleted upstream: `src/components/ui/PulseDot.tsx` and
`src/lib/__tests__/limits.test.ts`). The merge was aborted.

By area:

| Area | Conflicted files | Representative files | Nature |
|---|---|---|---|
| `src/lib` | 23 | `tracker-scheduler.ts` (2 hunks), `backup.ts` (5), `download-client-scheduler.ts`, `download-clients/coordinator.ts`, `scheduler.ts` (3), `error-utils.ts`, `limits.ts`, `today.ts`, `formatters.ts` | The fork's recovery/backoff, digest and backup engine meets upstream's Transmission refactor and shutdown fixes. Mostly semantic, not mechanical. |
| `src/components` | 19 | `ui/Icons.tsx` (10 hunks), `dashboard/FleetHeadline.tsx` (6), `dashboard/TodayAtAGlance.tsx`, `tracker-detail/TrackerDetailHeader.tsx` (5), `TrackerHubStatus.tsx` (4), `ui/PulseDot.tsx` (UD), `layout/Sidebar.tsx` | Cold Vault design, dashboard first viewport and fork card layouts meet upstream's status-dot unification, SVG icons and Transmission UI. |
| `src/data` | 11 | `trackers/animebytes.ts`, `iptorrents.ts`, `myanonamouse.ts`, `seedpool.ts`, `uploadcx.ts`, `zenith.ts`, `_template.ts`, `platform-types.ts`, `tracker-validation-rules.ts` | Fork rank/rule data and platform labels meet upstream's new `animebytes` / `luminance` platforms, rules and announce domains. Additive but needs per-tracker reconciliation. |
| `src/app/api` | 6 | `settings/backup/restore/route.ts` (6 hunks), `auth/change-password/route.ts` (2), `settings/lockdown/route.ts`, `trackers/[id]/route.ts` | Fork's v2 restore/re-encryption and Prowlarr-secret removal meet upstream's restore fixes and security hardening. |
| `src/app` pages | 4 | `DashboardClient.tsx` (6), `SettingsClient.tsx` (1), `trackers/[id]/page.tsx`, `TrackerDetailClient.tsx` | Prowlarr status widgets and ratio/bonus changes meet the fork's dashboard and detail-page work. |
| Docs / root | 6 | `README.md`, `CHANGELOG.md`, `SECURITY.md`, `docs/kb/*` | Fork rewrote distribution and migration docs; upstream changed the same sections. |
| `scripts` | 2 | `security-audit.ts`, `validate-trackers.ts` | Fork's migration audit and upstream's new security checks; registry validation. |
| `src/types` | 1 | `tracker-stats.ts` (3 hunks) | Upstream's AnimeBytes/Luminance stat fields meet the fork's login-provenance fields. |

Which fork features the conflicts touch:

- **Cold Vault UI, dashboard first viewport, rank and login surfaces** — the
  largest group. Upstream's status-dot/SVG/ratio work overlaps files the fork
  redesigned, including `Icons.tsx` (10 hunks) and both dashboard clients.
- **Backup/restore v2** — `backup.ts`, the restore route and its test, the
  change-password re-encryption ladder, and the tracker-route restore guard.
  Upstream's five backup fixes need to be ported into the fork's engine rather
  than merged line by line.
- **Scheduler and recovery** — `tracker-scheduler.ts`, `download-client-scheduler.ts`,
  `coordinator.ts`, `scheduler.ts` and `error-utils.ts`.
- **Tracker adapters and registry** — the fork's V3X/CarPT/Portugas/RetroToon/C411/
  Hawke/Tr4ker work meets upstream's Luminance, AnimeBytes, IPTorrents and
  announce-domain changes. The two new adapter files arrive cleanly; the
  contract test, `tracker-stats.ts` and tracker data do not.
- **Prowlarr removal (P59)** — `SettingsClient.tsx`, `DashboardClient.tsx`,
  `change-password/route.ts`, `lockdown/route.ts` and `schema.ts` all conflict
  where upstream adds the new Prowlarr feature to code the fork removed or
  reshaped. No old Prowlarr file is resurrected; this is a product decision,
  not a code conflict.
- **Security audit and docs** — `scripts/security-audit.ts`, `SECURITY.md`,
  integration/security tests, README and CHANGELOG.

Non-textual risks found while inspecting the merge state:

- Upstream removed `src/components/ui/PulseDot.tsx` in favour of `StatusDot`,
  but six fork components still import `PulseDot`. Resolving this is a small
  migration, not a conflict marker.
- Upstream removed `fetchTrackerStats` from `tracker-scheduler.ts`; the fork
  still exports it (only tests call it), so the conflict is easy to resolve by
  accepting the removal, but the surrounding login-provenance changes stay.
- Incoming Prowlarr modules import only modules the fork still has, so they
  link cleanly once `schema.ts` and `limits.ts` are resolved. The missing
  pieces are the database tables and the new limit constants, not new modules.
- The incoming Prowlarr and Transmission code uses new constants in
  `src/lib/limits.ts` (`PROWLARR_RESPONSE_MAX_BYTES`,
  `PROWLARR_CYCLE_DEADLINE_MS`, `PROWLARR_INDEXER_REFRESH_MS`,
  `PROWLARR_STATS_REFRESH_MS`, `PROWLARR_STALE_MS`,
  `TRANSMISSION_RESPONSE_MAX_BYTES`) and the new shared
  `src/lib/download-clients/transport.ts`. The transport file is added
  cleanly; `limits.ts` is conflicted, so resolving it by keeping only the
  fork's side will not compile.
- The merge state expects Vitest 5 and Biome 2.6 from upstream's
  `package.json`. The fork is on Vitest 4 and Biome 2.5; adopting the merge
  means taking that upgrade and clearing the lint fallout in one pass.

## 3. Migration system

Upstream has no `db/` directory at all, neither at the merge base nor at
`upstream/main`. Its schema is Drizzle-only and its development flow uses
`drizzle-kit push` (`package.json` → `db:push`). The merge therefore does not
touch `db/migrations`, `db/migrations/manifest.json` or
`db/migrations/baseline-fingerprint.json`, and there are no upstream migration
files to conflict with.

Upstream does change the Drizzle model: `src/lib/db/schema.ts` gains 79 lines
and loses 5:

- `trackers.prowlarr_instance_id` (FK, `ON DELETE SET NULL`),
  `trackers.prowlarr_indexer_id`, `trackers.prowlarr_opt_out`.
- `prowlarr_instances`, `prowlarr_indexers`, and the unique index
  `uq_prowlarr_indexer (instance_id, indexer_id)`.

Consequences for the fork's migration system:

- A sync needs one new migration, for example
  `db/migrations/0011_prowlarr.sql`, plus its entry in
  `db/migrations/manifest.json` with the SHA-256 checksum. The existing
  `0000`-`0010` files are frozen by checksum and must not be edited.
- The baseline fingerprint is used for adopting a pre-migration-system
  database, not for post-baseline migrations, so it does not need to change.
  Both a fresh install (running `0011` after `0010`) and an upgraded install
  would apply the new file.
- `0004_prowlarr.sql` is unrelated: it adds the old Prowlarr *import* settings
  to `app_settings` (`prowlarr_url`, `encrypted_prowlarr_api_key`,
  `prowlarr_allow_private`). Those columns are deliberately unmodeled after
  P59. They cannot be reused for the new tables, and are not a collision.
- **No migration is needed if Prowlarr is not adopted.** Transmission, the
  backup fixes and the security fixes all use existing tables and columns.
- The fork's unit tests will not catch a missing Prowlarr migration: they mock
  the database. Only a real database (e2e or a manual upgrade) would fail on
  `relation "prowlarr_instances" does not exist`.
- One trap: upstream's `package.json` contains `"db:push": "drizzle-kit push"`.
  The trial merge auto-resolved this correctly (the fork deleted the script,
  upstream never changed it), but resolving `package.json` wholesale from
  upstream would restore it, and `src/lib/__tests__/migration-manifest.test.ts`
  explicitly fails when `db:push`, `db:generate` or `db:migrate` reappear.

## 4. Recommendation

**Do not take the full merge now. Sync the security, backup and adapter fixes;
keep Prowlarr and the dashboard redesign out of this pass.**

The conflict surface (72 files, 147 hunks) is not the main cost. The expensive
part is that upstream's dashboard/UI work and its Prowlarr feature collide with
two deliberate fork decisions (Cold Vault and the P59 removal), and that the
Transmission refactor rewrites the download-client layer. Bundling all of that
with a database migration into one change would be a multi-day, high-regression
merge for little of the fork's own value.

Options and effort (focused engineering time, including tests and a fresh plus
upgraded database check):

| Option | Scope | Effort | Risk |
|---|---|---|---|
| **A. Full sync now** | All 168 commits, 72 conflicts/147 hunks, Prowlarr decision, `0011` migration, Vitest 5 / Biome 2.6 upgrades | ~4-6 days | High. Touches the whole dashboard and the download-client layer at once. |
| **B. Selective backport (recommended)** | Security/auth fixes, backup-restore fixes, adapter/data fixes (Luminance + CRT, AnimeBytes, IPTorrents, Cloudflare, announce domains, rules) | ~2-3 days total: ~0.5-1 day security, ~0.5-1 day backups, ~1 day adapters | Medium. No schema change. Conflicts are confined to the touched adapters and `backup.ts`/restore. |
| **B2. B plus Transmission** | Adds the 15-commit Transmission adapter and shared transport | +1-2 days | Medium. Rewrites `coordinator.ts`/`download-client-scheduler.ts`; no schema change. |
| **B3. B plus Prowlarr** | Adds upstream's Prowlarr monitoring | +1-2 days, plus `0011` migration and a product decision | Medium. Reintroduces a feature the fork removed. |
| **C. Stay separate** | Nothing | 0 now | Low short-term, growing later. Security fixes and adapter maintenance must be reimplemented; IPTorrents/AnimeBytes/Cloudflare changes already show why adapters rot. |

Suggested order for option B:

1. Security and auth (session revocation, lockdown password, client-password
   cache key, secret audits, log redaction). No schema, no UI.
2. Backup/restore fixes. Port them into the fork's v2 engine, with its tests.
3. Adapter and registry work: Luminance + Cathode-Ray.Tube, AnimeBytes API,
   IPTorrents profile read, Cloudflare 403/503 handling, announce domains and
   the tracker-rule updates.
4. Decide Prowlarr separately. If adopted, add `0011_prowlarr.sql` and the
   manifest entry in its own PR, and wire the settings/UI where the fork wants
   it; if not, leave the feature out of the sync.
5. Decide Transmission separately; it is self-contained and needs no migration.

If the fork prefers a single merge later, wait until the Prowlarr and dashboard
decisions are settled, then do the full merge with the migration in the same
branch. Do not run the full merge first and decide afterwards: the conflict
resolution is where those decisions get made.

## Appendix: conflicted files

<details>
<summary>All 72 conflicted paths</summary>

- `CHANGELOG.md`
- `README.md`
- `SECURITY.md`
- `docs/kb/docs/contributing/adapter-standard.md`
- `docs/kb/docs/contributing/adding-a-tracker.md`
- `docs/kb/docs/index.md`
- `scripts/security-audit.ts`
- `scripts/validate-trackers.ts`
- `src/app/(auth)/DashboardClient.tsx`
- `src/app/(auth)/settings/SettingsClient.tsx`
- `src/app/(auth)/trackers/[id]/TrackerDetailClient.tsx`
- `src/app/(auth)/trackers/[id]/page.tsx`
- `src/app/api/auth/change-password/change-password-route.test.ts`
- `src/app/api/auth/change-password/route.ts`
- `src/app/api/settings/backup/restore/restore-route.test.ts`
- `src/app/api/settings/backup/restore/route.ts`
- `src/app/api/settings/lockdown/route.ts`
- `src/app/api/trackers/[id]/route.ts`
- `src/components/TrackerHubStatus.tsx`
- `src/components/TrackerSettingsSheet.tsx`
- `src/components/charts/TorrentCrossSeedDonut.tsx`
- `src/components/dashboard/AlertsBanner.tsx`
- `src/components/dashboard/FleetHeadline.tsx`
- `src/components/dashboard/MoversAndShakers.tsx`
- `src/components/dashboard/TodayAtAGlance.tsx`
- `src/components/dashboard/TorrentsTab.tsx`
- `src/components/dashboard/torrents/UnsatisfiedTorrentsTable.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/components/layout/SortableTrackerItem.tsx`
- `src/components/tracker-detail/AnalyticsTab.tsx`
- `src/components/tracker-detail/CoreStatCards.tsx`
- `src/components/tracker-detail/TrackerDetailHeader.tsx`
- `src/components/tracker-detail/TrackerInfoTab.tsx`
- `src/components/ui/Icons.tsx`
- `src/components/ui/ProgressBar.tsx`
- `src/components/ui/PulseDot.tsx` (deleted upstream)
- `src/components/ui/StatCard.tsx`
- `src/data/__tests__/tracker-registry.test.ts`
- `src/data/platform-types.ts`
- `src/data/tracker-validation-rules.ts`
- `src/data/trackers/_template.ts`
- `src/data/trackers/animebytes.ts`
- `src/data/trackers/gazellegames.ts`
- `src/data/trackers/iptorrents.ts`
- `src/data/trackers/myanonamouse.ts`
- `src/data/trackers/seedpool.ts`
- `src/data/trackers/uploadcx.ts`
- `src/data/trackers/zenith.ts`
- `src/lib/__tests__/formatters.test.ts`
- `src/lib/__tests__/limits.test.ts` (deleted upstream)
- `src/lib/__tests__/security.test.ts`
- `src/lib/__tests__/tracker-credential-null-invariant.test.ts`
- `src/lib/backup.ts`
- `src/lib/credential-forms.test.ts`
- `src/lib/credential-forms.ts`
- `src/lib/db/schema.ts`
- `src/lib/download-client-scheduler.ts`
- `src/lib/download-clients/__tests__/coordinator.test.ts`
- `src/lib/download-clients/coordinator.ts`
- `src/lib/error-utils.ts`
- `src/lib/formatters.ts`
- `src/lib/limits.ts`
- `src/lib/scheduler.ts`
- `src/lib/today.ts`
- `src/lib/tracker-platforms/__tests__/adapters.contract.test.ts`
- `src/lib/tracker-platforms/__tests__/iptorrents.test.ts`
- `src/lib/tracker-platforms/adapters/avistaz.ts`
- `src/lib/tracker-platforms/adapters/iptorrents.ts`
- `src/lib/tracker-platforms/adapters/torrentleech.ts`
- `src/lib/tracker-platforms/helpers/html-fetch.ts`
- `src/lib/tracker-scheduler.ts`
- `src/types/tracker-stats.ts`

</details>
