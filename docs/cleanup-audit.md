# P60 unused code audit

Date: 2026-11-01

Baseline: `main` at `f20680a6` (merge of P59), `origin/main` at the same commit.
Upstream reference: `upstream/main` at `d9cf207a`, merge-base `63a3db11`.

This audit changed no source code. Step 1 produced only this file.

## Method

- `pnpm knip` and `pnpm knip --reporter json --no-exit-code` (unused files, exports,
  types, dependencies, devDependencies).
- Import-graph scan of `src/**/*.{ts,tsx}` to find files with no production importer
  (files imported only by a test, or by nothing).
- Route scan: every `src/app/api/**/route.ts` path searched against `src/` and `e2e/`
  for a caller.
- `app_settings` scan: every column searched outside `src/lib/db/schema.ts`.
- Script, doc, environment-variable and feature-flag references searched across
  `package.json`, `.github/`, `Dockerfile`, `docker-entrypoint.sh`, `docs/` and `src/`.
- Each item was classified by checking whether the same path or symbol exists on
  `upstream/main`, and whether upstream still uses it. Upstream items are removed only
  when upstream also leaves them unused; otherwise they are kept so upstream merges stay
  cheap.

Knip baseline: 7 unused files, 4 unused devDependencies, 74 unused exports and 59
unused exported types. `pnpm knip` exits 0 because every rule is configured as `warn`.
No runtime dependency is unused.

## Unused files

All seven are upstream files. Every one except the tracker template is still used by
upstream, so all are kept on purpose.

| File | Origin | Used upstream? | Decision |
|---|---|---|---|
| `src/components/layout/Sidebar.tsx` | upstream | Yes, by `AuthShell` | Keep. The fork replaced the sidebar with `AppHeader`; upstream still renders it, so deleting it would make the next upstream merge conflict. |
| `src/components/layout/DownloadClientStatusWidget.tsx` | upstream | Yes, by `Sidebar` | Keep for the same reason. |
| `src/components/layout/SortableTrackerItem.tsx` | upstream | Yes, by `Sidebar` | Keep for the same reason. |
| `src/hooks/useCarousel.ts` | upstream | Yes, by `DownloadClientStatusWidget` | Keep. |
| `src/hooks/useSidebarPreferences.ts` | upstream | Yes, by `Sidebar` | Keep. |
| `src/components/settings/ImageHostingSection.tsx` | upstream | Yes, by `SettingsClient` | Keep. Commit `622e2fda` hid image hosting in the fork, but upstream still renders the section. |
| `src/data/trackers/_template.ts` | upstream | No, it is a template | Keep. It is documentation-by-example for adding a tracker and is never imported by design. |

The import-graph scan found no additional orphan file. Files reported as imported only
by tests are all upstream (`RankStacks.tsx`, `TrackerOverviewGrid.tsx`) and are rendered
by upstream `DashboardClient`, so they are kept.

## Fork-only dead code removed in step 2

These symbols exist only in the fork, have no production or test importer, and are not
re-exported for an external contract.

| Item | File | Evidence |
|---|---|---|
| `IntegrationsSection` component and its test | `src/components/settings/IntegrationsSection.tsx`, `src/components/settings/__tests__/IntegrationsSection.test.tsx` | Fork-only. Commit `12614848` ("hide settings imports and integration tokens") removed it from `SettingsClient`; only the test still imports it. The integration-token HTTP API stays; it was never part of this component. |
| `reachableSourceLabel` | `src/lib/recruitment-pathways.ts` | Fork-only export; no importer in `src/`, `e2e/` or `scripts/`. |
| `WHATS_NEXT_LIMIT`, `WHATS_NEXT_LOGIN_WINDOW_DAYS`, `WHATS_NEXT_RATIO_NEAR_DANGER`, `WHATS_NEXT_DAY_MS` | `src/lib/whats-next.ts` | Fork-only exports; the underlying private constants are used inside the module, the public aliases are not. |
| `registrySlugForPathwaysTracker` | `src/data/pathways/catalog.ts` | Fork-only wrapper; only its own re-export references it. |
| Unused re-exports `normalizePathwaysTarget`, `pathwaysTrackerIdForRegistrySlug`, `pathwaysTrackerName`, `registrySlugForPathwaysTracker` | `src/data/recruitment-catalog.ts` | The barrel keeps `PATHWAYS_TRACKERS`, `RECRUITMENT_CATALOG` and `RECRUITMENT_ROUTES`; every consumer imports these four helpers from `src/data/pathways/catalog.ts` instead. |
| `INTEGRATION_SCOPE_LABELS`, `INTEGRATION_SCOPE_DESCRIPTIONS` | `src/lib/integration-scopes.ts` | Fork-only labels used only by the deleted `IntegrationsSection`; the scope vocabulary and validators remain for the API. |
| `resolveTrackerRules` import | `src/components/tracker-detail/TrackerInfoTab.tsx` | Fork-only leftover import flagged by Biome as unused; upstream does not import it. |

## Upstream unused exports kept on purpose

| Area | Knip result | Why it stays |
|---|---|---|
| `src/components/ui/index.ts` | 52 unused re-exports and 50 unused types | The barrel is the app's shared UI import surface and is used by many components. Knip flags individual entries that no caller imports through the barrel, but those components are imported directly elsewhere or are public component props. Deleting entries would create a large diff against upstream for no behavioral gain. |
| `src/components/ui/Icons.tsx` | `BookmarkIcon`, `ChevronLeftIcon`, `InfinityIcon`, `LockIcon`, `TransitPapersIcon`, `UnlockIcon` | Upstream icon library. Several are referenced by the upstream sidebar island or by later upstream work; keeping the set avoids churn. |
| `src/types/api.ts` | `AvistazPlatformMeta`, `DigitalCorePlatformMeta`, `MamPlatformMeta`, `NebulancePlatformMeta` | Documented platform metadata types exported for adapter and API consumers. |
| `src/lib/limits.ts` | `MS_PER_DAY` | Used by upstream `src/lib/data-transforms.ts`; fork files declare local copies instead. Kept to avoid an upstream merge conflict. |
| `src/lib/tracker-scheduler.ts` | `_getSchedulerKeyForTest` | Used by `src/lib/__tests__/security.test.ts` through a dynamic import that Knip does not follow. |
| `src/lib/download-clients/qbt/types.ts` | `VALID_CLIENT_TYPES` | Upstream re-export of `../types`; the fork imports the canonical constant from `src/lib/download-clients/types.ts`. |
| `src/lib/image-hosting/index.ts` | `UploadOptions`, `UploadResult` | Used by upstream image-hosting UI and adapter consumers; the fork still serves `/api/upload-image`. |
| `src/components/dashboard/DayRangeSidebar.tsx` | `DayRange` type | Upstream dashboard uses it; fork uses a different date-range surface. |
| `src/components/dashboard/torrents/index.ts` | `TorrentTableVariant` | Upstream barrel type; kept with the upstream file. |
| `src/components/dashboard/useDashboardSettings.ts` | `DashboardSettings` | Upstream settings shape; kept with the upstream hook. |

## Routes and API endpoints

75 API route handlers were scanned. All but five have an in-repo caller.

| Endpoint | Origin | Decision |
|---|---|---|
| `/api/integrations/v1/{summary,actions,history}` | fork-only (P16) | Keep. They are the read-only integration contract documented in `docs/INTEGRATION_API.md` and are meant to be called by external homelab clients, not by this UI. |
| `/api/settings/image-hosts`, `/api/upload-image` | upstream | Keep. Their only UI caller is the upstream `ImageHostingSection`, retained above; upstream renders that section. They are also covered by `security.test.ts`. |

No fork-only page or API route is orphaned.

## Settings keys

`app_settings` has 52 modeled columns. Each column name is read somewhere outside
`src/lib/db/schema.ts` (settings API, backup/restore, schedulers, UI or tests). No
unused settings key was found. The Prowlarr columns removed in P59 remain intentionally
unmodeled in the schema and are not touched by this task.

## Scripts

| Script | Referenced by |
|---|---|
| `scripts/backfill-buffer.cjs` | `Dockerfile` |
| `scripts/recover.cjs` | `Dockerfile`, `next.config.ts`, `docs/` and schema comments |
| `scripts/regen-changelog.cjs` | `package.json` (`changelog:regen`) |
| `scripts/pathways-update.mjs` | `package.json` (`pathways:update`) |
| `scripts/knip-filter.sh` | `package.json` (`knip:filter`) |
| `scripts/security-audit.ts`, `scripts/security-audit-lib.ts` | `.github/workflows/security-audit.yml`, tests |
| `scripts/validate-trackers.ts` | `.github/workflows/tracker-validation.yml` |

No unused script was found.

## Docs

No doc is imported by code, so "unused" here means not linked from the current status or
README. The `docs/kb` tree and the root screenshots are upstream and still linked from
upstream docs/README. Fork-only docs (`docs/design/*`, `docs/screenshots/*`,
`docs/P51_*`, `docs/P55_*`, `docs/ROADMAP.md`, `docs/IMPLEMENTATION_STATUS.md`) are
historical delivery records and evidence referenced by the status file. They are kept;
deleting history is not a code cleanup and would make P40-P59 unreviewable.

`docs/TRACKER_TRACKER_KILO_PLAN.md` is an untracked user file and was not touched.

## Feature flags and environment variables

There is no runtime feature-flag system. Every environment variable read by the app is
consumed: `BASE_URL`, `SECURE_COOKIES`, `SESSION_SECRET`, `DATABASE_URL`,
`POSTGRES_{HOST,PORT,USER,PASSWORD,DB}`, `LOG_FILE`, `LOG_LEVEL`,
`NEXT_PUBLIC_APP_VERSION`, `NEXT_PUBLIC_RELEASE_CHANNEL`, `NEXT_RUNTIME`, and the
`E2E_*` Playwright variables. `NEXT_PUBLIC_RELEASE_CHANNEL` is read only by the
upstream `Sidebar`, which is retained, so it is not removed.

## Dependencies

Knip reports no unused runtime dependency. Four devDependencies are flagged:

| Package | Decision |
|---|---|
| `@types/node-cron` | Remove. `node-cron@4.6.0` ships its own type definitions (`types` and `exports.types` in its package manifest), so the v3 types are dead. |
| `@tailwindcss/typography` | Keep. Used by `src/app/globals.css` through `@plugin "@tailwindcss/typography"`, which Knip does not parse. |
| `conventional-changelog` | Keep. Invoked as a CLI by `scripts/regen-changelog.cjs`; it is not an `import`. |
| `tailwindcss` | Keep. Used by `src/app/globals.css` through `@import "tailwindcss"` and by the Tailwind PostCSS plugin. |

## Step 2 and step 3 changes

1. Delete the fork-only `IntegrationsSection` component and its test.
2. Delete the six fork-only unused exports listed above, the four unused
   `recruitment-catalog` re-exports, the two integration-scope label maps that only the
   deleted section used, and the unused `resolveTrackerRules` import.
3. Remove `@types/node-cron` and refresh `pnpm-lock.yaml` only for that removal.
4. Do not touch migrations, stored data or behavior. The hidden integration-token API,
   image-hosting routes and upstream-kept components stay in place.

After step 2, Knip reports 64 unused exports (down from 74) and 59 unused types. The
remaining entries are the upstream items listed above. Unused files and devDependencies
are unchanged until step 3 removes `@types/node-cron`.

## Verification gate

Step 1: `pnpm knip` (exit 0), `git status`.

Step 2 and 3, after the changes:

- `pnpm tsc`
- `pnpm biome check .`
- `pnpm test:run`
- `pnpm knip`
- `pnpm test:e2e` (Playwright, disposable `_e2e` database)
