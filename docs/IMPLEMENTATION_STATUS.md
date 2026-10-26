# Implementation Status

**Baseline:** P00 audit, 2026-10-23
**Repository:** `rednato25/tracker-tracker`
**Baseline branch:** `main` at audit time
**HEAD:** `e9586d53` — `fix(ui): sync tracker writes into the shared cache`
**Current branch:** `feat/p01-fork-distribution` (checkpoint committed; not deployed)
**Backup point:** tag `backup/pre-big-work-2026-10-23` at `e9586d53`

## P00 — audit and baseline

**Status:** done for the audit; the status document itself is not committed yet.

**Working tree at audit time:**

- `docs/TRACKER_TRACKER_KILO_PLAN.md` was the only pre-existing untracked user file and was preserved unchanged.
- This document is new and committed with the checkpoint.
- No application code, schema or production data was changed by P00.

**Roadmap path mismatch:** the requested `docs/IMPLEMENTATION_ROADMAP.md` does not exist. The roadmap is currently at `docs/TRACKER_TRACKER_KILO_PLAN.md`; its own text recommends copying it to `docs/IMPLEMENTATION_ROADMAP.md`. P00 did not rename or duplicate the user's file.

## Environment

| Item | Value |
|---|---|
| Node | `v26.8.2` |
| pnpm | `11.22.0` |
| Package version | `2.13.5` |
| Lockfile | `pnpm-lock.yaml`, `lockfileVersion: 9.0` |
| Next.js | `16.4.2` |
| React | `19.3.1` |
| TypeScript | `7.0.2` |
| Drizzle ORM / Kit | `0.45.4` / `0.31.11` |
| Database in Compose | `postgres:18-alpine` |

The local Node is newer than the package engine floor (`>=22`). The local jsdom `localStorage` failures below are an environment issue on Node 26, not a code regression.

## Baseline validation

| Check | Command | Result |
|---|---|---|
| Typecheck + lint | `pnpm lint` (`tsc --noEmit` + Biome) | **passed**; 13 warnings, 2 infos, 0 errors |
| Unit tests | `pnpm test:run` | **5868 passed, 24 failed** in 4 files; all failures are `localStorage` unavailable in jsdom on Node 26 (`useSectionCollapse`, `DashboardChartPreferences`, `useDashboardSettings`, `MamMouseholeCard`) |
| Production build | `pnpm build` | **passed** |
| E2E | `pnpm test:e2e` | **not run**; requires the disposable `_e2e` database and server, and P00 must not mutate a live database |
| CI at `e9586d53` | GitHub Actions | **CI, Security Audit, CodeQL and GHCR passed**; **OSSAR failed (workflow later retired)** with its stock “all files matching `**/*.{js,ts}` are ignored” ESLint issue, unrelated to application tests |

No deployment, push or live-database mutation was performed by P00.

## Existing implementation inventory

The roadmap is a proposal; these parts already exist in `e9586d53`:

- **Tracker platform:** registry-driven adapters, official API and cookie authentication, encrypted tracker credentials, snapshots, scheduler and rate-limit/network guard.
- **Dashboard:** account register, health status, viability strip, login timers, alerts, fleet activity, light/dark Cold Vault theme and WCAG AA contrast audit.
- **Login due:** `lastAccessAt`, `Last Login` in tracker settings, `Mark login today` in the tracker header and shared-cache synchronization after writes.
- **Ranks:** `rank-ladder.ts`, `RankProgress`, registry `userClasses` and `rankPaths`.
- **Rules-aware health:** `tracker-status.ts`, `satisfaction.ts`, per-tracker `TrackerRules`, H&R/seed-time/ratio handling.
- **Notifications:** persistent targets and delivery state; **Discord delivery is the only supported type**.
- **Download client:** qBittorrent integration, fleet aggregation, cross-seed and per-torrent seeding requirements.
- **Data safety:** encrypted columns, password re-key lifecycle, backup/restore, recovery CLI and lockdown paths.
- **Distribution:** GHCR workflow builds the fork image on `main` for `linux/amd64`; the image is public and verified. Compose and the Quick Start now point at the fork; upstream attribution and documentation links remain.

## Task status

Statuses follow the roadmap vocabulary: `pending`, `in_progress`, `implemented_validation_blocked`, `done`, `deferred`.

| ID | Status | Dependencies | Commit | Validation / evidence | Blocker or next step |
|---|---|---|---|---|---|
| P00 | done | — | `e9586d53` (baseline) | This audit, baseline commands above | Smallest next: P01 |
| P01 | done | P00 | `main @ 0ff13573` (merged; not installed) | GHCR image public; published `linux/amd64` digests `sha256:9548aecb3231f51cdbddf276526244eda54c5bd6c40f5d0d3d9d920b5ff6fdda` (from `0ff13573`) and `sha256:adcec0f2b600d93dd918b2d8de8695bdfb555e9ce242bf8b337b3a1a5384b456` (from `ec3fe17f`); Compose config valid; Quick Start and image reference aligned; upstream attribution kept | Candidate-image Compose smoke passed pre-merge; published-image smoke passed in PR #2 (run 40038697376). No deployment or real-install upgrade. |
| P02 | done | P00, P02a, P02b-0, P02b-1, P02b-2, P02b-3, P02b-5, P02b-6, P02b-7 | `main @ 0ff13573` (merged; not installed) | P02b-1–P02b-3, P02b-6 and P02b-7 validated; P02b-5 removes the production push path and wires the runner into the entrypoint/Dockerfile | Candidate-image and published-image Docker matrices passed, including PostgreSQL 17 rejection. No deployment or real-install upgrade. |
| P02a | done | P00 | branch `feat/p01-fork-distribution` (not deployed) | `docs/DB_MIGRATION_PLAN.md`; frozen 19-table baseline in `e2e/fixtures/db-baseline-v1/`; fingerprint, seed/check/verify and guard scripts; fixture seeded and verified in a disposable `_p02a` database | Restore route was not executed in P02a; interrupted/concurrent runner behavior is now covered by P02b-2. No production startup, schema or data changed. |
| P02b-0 | done | P02a | branch `feat/p01-fork-distribution` (not deployed) | Reviewed ledger, concurrency, fingerprint, security-audit finding and validation gaps; exact SQL and startup sequence added to `DB_MIGRATION_PLAN.md`; owner approvals recorded 2026-10-23 | No implementation in P02b-0; P02b-1 followed. |
| P02b-1 | done | P02b-0 | branch `feat/p01-fork-distribution` (not deployed) | Approved policy; `db/migrations/0000_baseline.sql` (checksum `59b382583d2a70edf5b1b2ca8488408f3eb83582ea4a4eb6aec501f72e0e9815`); `db/migrations/manifest.json`; `scripts/db/migration-manifest.mjs`; narrow security-audit update; 10 regression tests | Backup v2, production cutover and authenticated restore remain P02b-6/P02b-5. No DB mutation, commit, push or deploy. |
| P02b-2 | done | P02b-1 | branch `feat/p01-fork-distribution` (not deployed) | `scripts/db/migrate.mjs`; exact ledger; dedicated-session advisory lock; fresh baseline, managed/no-op, rollback, interruption, connection-loss, concurrent and lock-timeout tests; PostgreSQL 18 guard before ledger/DDL; 13/13 PostgreSQL 18 integration cases on Node 24 | P02b-3 followed. Runner is not wired into startup; backup v2 and cutover remain P02b-6/P02b-5. No real installation touched. |
| P02b-3 | done | P02b-2 | branch `feat/p01-fork-distribution` (not deployed) | `scripts/db/schema-fingerprint.mjs`; production `baseline-fingerprint.json`; canonical/column-order adoption; exact missing-index repair; drift/wrong-index/foreign-ledger rejection; row/ciphertext/sequence preservation; rollback, interruption and concurrent adoption tests; 22/22 PostgreSQL 18 integration cases on Node 24 | No adoption blockers. Backup v2 and cutover remain P02b-6/P02b-5. No real installation touched. |
| P02b-5 | done | P02b-1, P02b-2, P02b-3 (P02b-4 covered) | branch `feat/p01-fork-distribution` (not deployed) | `docker-entrypoint.sh` runs `scripts/db/migrate.mjs`, exits non-zero on failure and forwards TERM/INT; `Dockerfile` runtime copies `db/migrations` and `scripts/db`; `db:push` removed; audit rejects push in package/CI/entrypoint/Dockerfile; 4/4 entrypoint tests, 22/22 PostgreSQL 18 runner tests, 11/11 manifest tests, 5918 unit tests, TypeScript, lint, audit (38/38) and production build pass on Node 24; baseline checksum unchanged; CI run 40036272230 built PR head `02af2eac` and passed fresh, unmanaged P02a adoption, managed restart, unknown/ahead refusal, PostgreSQL 17 rejection, concurrent startup and Compose candidate override | Published digest `sha256:9548…f6fdda` passed smoke in PR #2 (run 40038697376); after PR #2 merged, digest `sha256:adcec0…84b456` also passed a main workflow_dispatch (run 40048016089). No deployment or real-install access. |
| P02b-6 | done | P02b-3 | branch `feat/p01-fork-distribution` (not deployed) | v2 export/validation, v1 import, delivery/checkpoint restore with id/scope remapping, transactional restore + cross-process advisory lock, credential lifecycle verification; 5918 unit tests, 10 authenticated HTTP cases plus setup (PostgreSQL 18), TypeScript, lint, audit (38/38), build | Published-image smoke passed in PR #2 (digest `sha256:9548aecb3231f51cdbddf276526244eda54c5bd6c40f5d0d3d9d920b5ff6fdda`). No production access or deployment. |
| P02b-7 | done | P02b-6 | branch `feat/p01-fork-distribution` (not deployed) | Consolidated Node 24 evidence; `docs/UPGRADE_AND_ROLLBACK.md`; backup v2/v1 limits; upgrade/rollback and Docker-check list; Unreleased release notes | Documentation only. Candidate-image and published-image Docker validation passed; the published image was not deployed or installed. This is not a production-validated release. |
| P03 | done | P00, P02 for persistence | branch `feat/p03-rule-provenance` (not merged) | `src/lib/tracker-rules.ts`; explicit `requiredAccountRatio`/`requiredTorrentRatio`; legacy `minimumRatio` read mapping; per-field source/timestamp-kind/freshness provenance; manual login evidence; 5982 unit tests, TypeScript, Biome, audit (38/38), build | Real registry entries remain unverified and are marked unknown unless provenance is supplied. No DB change. No real tracker account accessed. |
| P04 | done | P03 | branch `feat/p04-actions` (not merged) | `src/lib/actions.ts`; deterministic `computeTrackerActions` with injected `now`; account ratio, login, stale/poll/client, H&R and per-torrent seeding actions; stable keys, dedupe and deterministic ordering; P03 provenance on evidence; focused 99 tests, 5998 full tests, TypeScript, Biome, audit 38/38, build | No UI or notification delivery (P05). No database change. Real rules remain unknown unless P03 provenance says otherwise. |
| P05 | implemented_with_deferrals | P04 | `main @ 05c78300` (merged; not deployed) | `AttentionNeeded` dashboard surface; P04 actions as sole classification; Needs attention/Unknown/Healthy/All filters and counts; stable keys, progressive evidence, tracker/settings links; loading/error/partial-data/all-clear states; 8 UI tests, 2 dashboard e2e tests, 6006 full tests, TypeScript, Biome, audit 38/38, build | Deferred: dense register Next action column, timed snooze/dismiss, and torrent-level rows (no bulk torrent feed without extra requests). Next action is in each attention row; H&R is shown at tracker level. No notifications or torrent mutation. |
| P06 | done | P05, P02 | `main @ 45a81cc` (merged; not deployed) | Telegram through existing notification targets, dispatch, cooldowns and durable delivery state; encryptedConfig reuse (no schema change); bot-token/chat-id validation and Settings controls; plain-text sendMessage; 5s timeout, circuit breaker, 429 retry_after, API ok:false/401 handling; token redaction; 6 delivery + 3 dispatch + validation tests; 229 files / 6019 tests, TypeScript, Biome, audit 38/38, build | No ntfy, digests or other platforms. No real Telegram call; local fake service only. Discord behavior unchanged. |
| P07 | done | P06 | `main @ 380c5600` (merged; not deployed) | ntfy through existing target/dispatch/cooldown/durable-state/circuit path; serverUrl/topic/optional token in encryptedConfig; per-target private-network opt-in; JSON publish with Bearer auth; redirect refused; 5s timeout, response cap, 429/401/403 handling; token/topic redaction; 5 delivery + 1 dispatch + 3 validation tests; 230 files / 6028 tests, TypeScript, Biome, audit 38/38, build | No digests, quiet hours or later platforms. No real ntfy message; local fake service only. Discord/Telegram unchanged. |
| P08 | done | P04, P06, P07 | `main @ 33f227c5` (merged; not deployed) | Migrations 0001/0002; opt-in digest + quiet hours; master-scheduler tick with advisory lock; per-target dedup/backoff; DST-aware timezone; provider-aware truncation; restore id/state remap; 8 digest + 4 quiet + 3 digest-run tests; 232 files / 6046 tests, TypeScript, Biome, audit 38/38, build | Docker run 40096915406 validated fresh + P02a upgrade. No real notifications. |
| P09 | done | P03 | `main @ e925ca18` (merged; not deployed) | `src/lib/rank-goals.ts`; deterministic numeric/manual conditions with ALL/ANY; met/unmet/unknown, observed/freshness and remaining; injected account-age clock; existing ladder/forest next-rank resolution; personal goals; 12 focused tests; 234 files / 6058 tests, TypeScript, Biome, audit 38/38, build | No UI, DB or promotion mutation. Free text is preserved, never parsed. P11 remains. |
| P10 | partial pilot coverage | P09 | `main @ a8fca65` (merged; not deployed) | TorrentLeech: account-age and ratio conditions verified from the public wiki; four upload conditions kept explicitly unknown because GB/TB binary-vs-decimal is unresolved. MyAnonaMouse/REDacted have no structured goals. 6 pilot tests; 235 files / 6064 tests, TypeScript, Biome, audit 38/38, build | Follow-ups: #11 TorrentLeech units; #12 MAM/REDacted excerpts. No UI, DB or ETA. |
| P11 | done | P09–P10 | `main @ d1c11333` (merged; not deployed) | Tracker-detail rank-goal panel; current/target rank; verified/unmet/unknown conditions; source details; custom target persisted in app_settings.rank_goals via migration 0003 with restore ID remapping; upload ETA only from adequate fresh history; account-age exact date; 2 ETA + 4 panel tests + restore remap assertion; 236 files / 6070 tests, TypeScript, Biome, audit 38/38, build | Light/dark/mobile artifacts generated in CI and reviewed; no application clipping found after capture fix. #14 closed. |
| P12 | done | P03 | `main @ 02f0645d` (merged; not deployed) | `src/lib/download-budget.ts`; pure projected ratio, additional allowance, required upload and charged reserve; explicit charged fraction; zero-charge scenario; unknown/invalid inputs unavailable; 8 focused tests; 237 files / 6078 tests, TypeScript, Biome, audit 38/38, build | Dynamic ratio/freeleech expiry follow-up: #15. No UI, downloads, qBittorrent actions or per-torrent mixing. |
| P13 | done | P12 | `main @ cbca164a` (merged; not deployed) | Tracker-detail budget form; explicit accounting, target-vs-minimum, projected ratio/budget/upload; local planning queue with add/edit/remove and cumulative result; no client/tracker mutation; 5 panel tests; 238 files / 6085 tests, TypeScript, Biome, audit 38/38, build; CI Visual Evidence artifacts captured; UX correction in PR #18; owner manual acceptance on digest `sha256:8b8cba401ffab275a3c46cb33db7ef0264702c71422de9fe33198dffe0a89690` | Mobile capture setup was corrected (page clip, 72px header offset, full-height 390px captures); metrics and interaction tests show no horizontal overflow, reachable controls and bottom scrolling. Issue #14 closed. P14 is implemented in draft; polish #19 remains. |
| P14 | done | P02–P03 | `main @ 22a5dd68` (merged; not deployed) | Read-only Prowlarr client; encrypted URL/key settings; preview statuses ready/already-added/ambiguous/unsupported; selected-only import creates active user-paused placeholders with no copied credentials; local fake-service, matching and import tests; 6089 full tests; no Jackett/search. Owner-reported manual acceptance 2026-10-26 on image digest `sha256:2b265361883e03e39127cf05cacbbe90bbf2dd470d34d50759e88b91f9ae995e`: FileList imported through Prowlarr | Prowlarr key is never returned; imported entries are active/user-paused and need manual tracker credentials. Owner-reported: imported FileList remained visible and PAUSED with no account metrics or automatic polling, an existing entry was identified as already added, and tracker credentials were not copied. Automated evidence is separate (local fake service and authenticated Playwright run). Mobile long preview text polish: #21. No P15. |
| P15 | done | P14 | PR #23 (`5e2990c8`; not deployed) | Jackett admin-login read-only indexer list; matching/duplicate/ambiguous/unsupported preview; selected-only active user-paused import; no credential copying; local fake-service tests; 6092 full tests; authenticated visual run captured light/dark/mobile settings preview/import and the PAUSED imported tracker. Owner-reported manual acceptance 2026-10-26 on image digest `sha256:2b265361883e03e39127cf05cacbbe90bbf2dd470d34d50759e88b91f9ae995e`: AlphaRatio imported through Jackett | No Jackett connection persistence (admin password used per request only). Owner-reported: imported AlphaRatio remained visible and PAUSED with no account metrics or automatic polling, an existing entry was identified as already added, and tracker credentials were not copied. Automated evidence is separate (local fake service and authenticated Playwright run). Visual evidence #22 closed; long mobile preview wrapping is the shared #21 polish. No P16. |
| P16 | done | P02, P04; P11 for goals | PR #24 (merged; not deployed) | Versioned `/api/integrations/v1/{summary,actions,history}`; hashed one-time tokens with read scopes; session-only token management; explicit identity modes (`none` default); bounded summary/actions/history; migration 0005; password/lockdown/nuke/restore/recovery invalidation; focused auth/privacy/UI/lifecycle/recovery tests; 6145 full tests; desktop light/dark/mobile token UI inspected; contract in `docs/INTEGRATION_API.md` | Owner-supplied home-server acceptance on image digest `sha256:02271ad43c65dc5b8a81a0b878747c4b5fbf02ab0fcd94061bee04b8cf4969fb`: migration 0005 applied, health passed, existing login/trackers/mock integrations preserved, summary-only token 200 / actions 403 / post-revocation summary 401 without session cookies, hidden identity excluded names/usernames/secrets, token displayed once and only its hash stored, temporary tokens revoked, production and stopped updater unchanged. Optional expiry is #25. No write scopes, CORS, webhooks, search or downloads; no deployment. |
| P17 | done (draft PR, not merged) | P09–P10 | draft PR #26 (`feat/p17-recruitment-routes`) | Versioned offline recruitment-route format/evaluator; pinned MIT trackerpathways snapshot with 194 registry-mapped edges and attribution; structured account-age only, readable free text; separate eligibility/availability/invitation; source-update vs access vs verification dates; bounded cycle-safe path search; dated local overrides | Draft only; not merged or deployed. 117 unresolved upstream names omitted; no prose-to-threshold parsing, runtime fetch, automated applications or recruiter messages. No P18 UI, P19 search, deployment or home-server change. |
| P18 | pending | P17 and goals UI | — | No wishlist/routes UI | Start with lists, not a graph |
| P19 | pending | P14 | — | No Prowlarr search | Implement read-only search with partial results and cancellation |
| P20 | pending | P19, P12–P13 | — | No result comparison | Compare charged bytes, ratio impact and obligations; explain recommendations |
| P21 | pending | P19; P20 recommended | — | qBittorrent client exists; no search-result send flow | Add explicit confirmation and idempotency; never auto-download |
| P22 | pending | P03 and existing qBittorrent | — | Fleet/torrent analytics and satisfaction exist; no storage/seeding report | Add report without exposing paths or claiming physical recovery |
| P23 | pending | P22 | — | No space-release candidate classification | Optional; destructive actions are out of scope |
| P24 | pending | P09 and pilot sources | — | No bonus-points planner | Compare verified exchanges per tracker; never spend automatically |
| GATE | pending | Relevant tasks | — | No release gate run for a delivery | Run after each delivery; do not treat this audit as a gate |

## P02a — database baseline preparation

### Artifacts

- `docs/DB_MIGRATION_PLAN.md` — lifecycle audit, strategy comparison, cases
  A–E, rollout/rollback rules and the P02b checklist.
- `e2e/fixtures/db-baseline-v1/schema/` — frozen Drizzle baseline SQL and
  journal generated from `e9586d53`.
- `e2e/fixtures/db-baseline-v1/runtime-indexes.sql` — covering index from
  `ensure-indexes.ts`.
- `e2e/fixtures/db-baseline-v1/schema-fingerprint.json` — 19 tables, 38
  indexes, 170 constraints; column order normalized.
- `seed.ts`, `check-baseline.ts`, `verify.ts`, `safety.ts`, `fingerprint.ts`
  and `README.md` — repeatable disposable fixture and guards.

### Selected strategy

Frozen baseline + versioned additive SQL + explicit `schema_migrations` ledger +
preflight fingerprint + advisory lock + fail-closed unknown-schema handling.
Drizzle Kit remains the SQL generator; `push --force` is removed from
production in P02b. The strategy is documented in `DB_MIGRATION_PLAN.md`.

### Checks actually run

**Passed**

- Baseline SQL applied to a disposable `tracker_tracker_p02a` database.
- Expected fingerprint written and re-checked: 19 tables, 38 indexes, 170
  constraints.
- Unknown-schema self-test: an extra column was detected and rolled back.
- Representative row counts: 2 trackers, 5 snapshots, 1 client, 1 notification
  target, 1 delivery state, 1 checkpoint.
- Synthetic tracker token, tracker vault, mousehole token, client credentials,
  notification config and scheduler key all decrypted with the fixture keys.
- Covering index, delivery-state unique index and delivery-state foreign key
  present.
- Backup payload generated and `validateBackupJson` passed with encrypted fields
  intact.
- Fixture re-seeded; counts and fingerprint remained deterministic.
- Safety checks rejected a non-`_p02a` database and a destructive seed without
  `P02A_ALLOW_DESTRUCTIVE=1`.

**Failed**

- None in P02a after the fixture was corrected. The baseline run initially
  exposed a verifier bug (unique constraint vs unique index); the check was
  corrected without changing application code.

**Blocked / not executed**

- Authenticated restore HTTP route: requires the app/auth context and is not
  executed in P02a.
- Fresh-install smoke test: Docker daemon unavailable (P01 block).
- Interrupted migration and concurrent startup: designed, not implemented;
  P02b.
- Migration against an existing non-fixture database: intentionally not run.
- Upgrade of a real installation: not attempted.

### Test-environment conclusion

- Local runtime is Node `v26.8.2`; `globalThis.localStorage` is `undefined`
  (`ExperimentalWarning: localStorage is not available because
  --localstorage-file was not provided`).
- A representative failure is `src/hooks/useSectionCollapse.test.ts:10`
  (`localStorage.clear()`), which matches the broader 24-test environment
  failure set.
- CI pins Node 24 and was green at `e9586d53`. This is an environment mismatch,
  not an application regression; no assertions were suppressed or changed.

### P02b prerequisites

1. Review and approve the selected strategy and ledger schema.
2. Update `scripts/security-audit.ts` to allow the approved migration files and
   runner and reject production `push --force`.
3. Freeze the baseline source commit and ensure the production image ships the
   baseline/migrations.
4. Implement the preflight fingerprint, baseline adoption, advisory lock,
   transactional runner and ledger.
5. Add integration tests for fresh, baseline-existing, managed, unknown,
   interrupted and concurrent cases.
6. Define backup/restore version changes and the encrypted-field checklist for
   every schema addition.
7. Document pre-upgrade database dumps and image/schema rollback compatibility.
8. Replace the entrypoint push path only after the runner and tests pass.

### P02b implementation order

1. Policy/security-audit update.
2. Ledger and runner skeleton behind a non-production flag.
3. Fresh-database path and baseline fixture test.
4. Baseline-adoption path and unknown-schema rejection.
5. Interrupted/concurrent tests and advisory-lock behavior.
6. Backup/restore and encrypted-column updates.
7. Entrypoint/Dockerfile cutover and removal of production push.
8. Validation run, then status update.

## P02b-0 — migration design review

### Reviewed artifacts

- `docs/DB_MIGRATION_PLAN.md` now contains the exact
  `public.schema_migrations` SQL, checksum content, ordering/mismatch behavior,
  custom-vs-Drizzle justification, startup/lock/transaction sequence,
  interruption outcomes, fingerprint policy, validation matrix and P02b slices.
- The P02a fixture remains the frozen baseline; no fixture files were changed.

### Canonical ledger SQL

Full rationale and behavior are in `DB_MIGRATION_PLAN.md` §3.

```sql
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  version text PRIMARY KEY,
  checksum text NOT NULL
    CHECK (checksum ~ '^[0-9a-f]{64}$'),
  applied_at timestamptz NOT NULL DEFAULT now(),
  app_version text NOT NULL,
  execution_ms integer
    CHECK (execution_ms IS NULL OR execution_ms >= 0),
  baseline boolean NOT NULL DEFAULT false,
  CHECK (version ~ '^[0-9]{4}_[a-z0-9_]+$'),
  CHECK (NOT baseline OR version = '0000_baseline')
);
```

This is the only ledger. `drizzle.__drizzle_migrations` is a foreign ledger and
must cause a fail-closed exit.

### Startup sequence summary

1. Entrypoint waits for PostgreSQL readiness.
2. A separate runner opens one `max: 1` session (`idle_timeout: 0`), never the
   application pool.
3. Acquire the fixed advisory lock before reading ledger/fingerprint.
4. Reject foreign ledgers; validate our ledger versions/checksums.
5. Fresh -> baseline transaction; unmanaged exact baseline -> ledger-only
   adoption; managed -> pending transactions; anything else -> fail closed.
6. Each migration and its ledger insert commit in one transaction; failures
   roll back and are not recorded.
7. Release the lock in `finally`/on session close, then start the app.
8. Run existing backfills after schema success, in the documented order.

### Checks actually run for P02b-0

- Source inspection of `docker-entrypoint.sh`, `drizzle.config.ts`,
  `db/index.ts`, `instrumentation.ts`, `scheduler.ts`, backfills,
  backup/restore, password change, recovery, lockdown, nuke, CI and the
  security audit.
- Drizzle 0.45.4 migrator source inspected: internal
  `drizzle.__drizzle_migrations`, latest-row ordering, no baseline adoption, no
  lock and no full checksum verification.
- Security-audit rule identified: `no-raw-migrations`,
  `checkNoRawMigrations()` around `scripts/security-audit.ts:1027`, critical,
  registered around line 2534.
- No database was accessed for P02b-0; no runner, audit change, schema change or
  push removal was implemented.

### Findings, ranked

1. **Critical:** the existing security policy forbade the selected mechanism.
   Owner approval was granted on 2026-10-23; P02b-1 implements the manifest/audit
   foundation and the policy is no longer pending.
2. **Critical:** production `push --force` must be removed, not run alongside
   the runner.
3. **Critical:** checksum/version ledger is required to detect edited/removed
   migrations and a database ahead of the application.
4. **Critical:** the P02a fingerprint helper ignores `__drizzle_migrations`; P02b
   must ignore only `schema_migrations` and fail on foreign ledgers.
5. **High:** advisory lock must stay on one dedicated `max: 1` session; the
   application pool cannot own it.
6. **High:** ~~backup format 1 omits durable-looking state and restore deletes
   `notification_delivery_state` without restoring it.~~ P02b-6 adds v2 with
   delivery state and both checkpoint tables plus authenticated restore tests;
   v1 imports report missing history explicitly.
7. **High:** every new encrypted column needs the five lifecycle sites.
8. **High:** `ensureIndexes()` creates unledgered schema; make it
   migration-owned or verification-only.
9. **High:** non-transactional SQL must be rejected.
10. **Medium:** fingerprint normalization/supported PostgreSQL major and known
    variants must be explicit; only column order and missing runtime covering
    index are proposed variants.
11. **Medium:** backfills must run after schema migration and remain idempotent.
12. **Medium:** Node 24 is the CI test runtime; Node 26/localStorage failures are
    a separate environment issue.

### Security-audit change (implemented in P02b-1)

`no-raw-migrations` remains **critical** and now validates the approved
manifest through `scripts/db/migration-manifest.mjs`:

- only manifest-listed SQL in `db/migrations` with matching SHA-256 passes;
- duplicate/out-of-order versions, missing files, checksum mismatch, traversal
  and unlisted SQL fail;
- SQL under `src/lib/db/migrations` or `drizzle/` fails;
- `drizzle-kit generate/migrate` in package scripts or CI fails;
- the transitional `db:push` was allowed until P02b-5; that slice removed it
  and now rejects push in package scripts, CI, the entrypoint and the
  Dockerfile.

No ignore comment, severity reduction, blanket directory exemption or global
finding acceptance is used. The production-entrypoint push rejection deferred
from P02b-1 is implemented in the P02b-5 working tree.

### Owner approvals — recorded 2026-10-23

1. Replace the push-only migration policy with the reviewed mechanism. **Approved.**
2. Use `public.schema_migrations` and the custom runner as the only ledger;
   foreign ledgers fail closed. **Approved.**
3. Treat notification delivery state and daily checkpoints as durable backup
   state; adopt backup v2 with v1 import and no source-ledger restore. **Approved.**
4. Support PostgreSQL 18 with only the two documented baseline variants;
   reject other versions and unknown schemas. **Approved.**

No further policy approval is required.

### P02b-1 implementation and checks

Artifacts:

- approved policy recorded in `docs/DB_MIGRATION_PLAN.md`;
- `db/migrations/0000_baseline.sql` built from the frozen P02a files, not
  regenerated from `schema.ts`;
- `db/migrations/manifest.json` with SHA-256
  `59b382583d2a70edf5b1b2ca8488408f3eb83582ea4a4eb6aec501f72e0e9815`;
- `scripts/db/migration-manifest.mjs` and `.d.mts`;
- `checkNoRawMigrations()` now delegates to the validator;
- `SECURITY.md` check #11 updated.

Passed:

- Node 24: 10 manifest/audit regression tests pass.
- Node 24: security audit exits 0 with 38 checks and 0 critical findings;
  `no-raw-migrations` passes.
- Node 24: TypeScript check passes.
- Node 24: full unit suite passes — 224 files, 5902 tests.
- Production manifest validation: baseline checksum matches.
- Approved and unauthorized regression cases: duplicate/out-of-order versions,
  missing file, checksum mismatch, traversal/absolute path, unlisted SQL, old
  SQL directories, unauthorized `drizzle-kit generate/migrate`, and the
  then-transitional `db:push` allowed (superseded by P02b-5).
- Full lint on the repository passes with the existing 13 warnings/2 infos.

Failed:

- None in P02b-1 after fixing the test import order.

Blocked / not executed:

- Runner-dependent guarantees (fresh, adoption, managed, interrupted,
  concurrent, ledger transactions): P02b-2–P02b-4.
- Backup v2 and authenticated restore: P02b-6.
- Production push removal/cutover: P02b-5.
- P01 Docker fresh-install smoke test: Docker daemon unavailable.
- Node 26/jsdom `localStorage` failures remain a separate environment issue;
  assertions were not suppressed.

### P02b-2 implementation and checks

Artifacts:

- `scripts/db/migrate.mjs` — dedicated-session runner, exact ledger, advisory
  lock, fresh/managed/no-op paths, transaction control, connection-loss guard.
- `e2e/p02b/safety.mjs` — guarded disposable PostgreSQL 18 helper with marker,
  suffix, local-host and major-version checks.
- PostgreSQL 18 guard: `assertPg18()` in `scripts/db/migrate.mjs` reads
  `server_version_num` and rejects anything outside 18.x; it is called before
  the foreign-ledger check, ledger read, adoption or DDL. The P02b safety
  helper also refuses non-18 test databases. Docker scenario 7 additionally
  verifies a PostgreSQL 17 server is rejected before ledger/table creation and
  before the server starts.
- `e2e/p02b/runner.test.mjs` — 13 integration cases.
- `e2e/p02b/README.md` — setup and Node 24 commands.

Exact integration command:

```powershell
$env:P02B_DATABASE_URL='postgresql://.../tracker_tracker_p02b'
$env:P02B_ALLOW_DESTRUCTIVE='1'
$env:NODE_ENV='test'
npx.cmd -y node@24 --test e2e/p02b/runner.test.mjs
```

Passed:

- Node 24 + PostgreSQL 18.1: **13/13 integration tests pass**:
  fresh initialization and baseline table verification, clean no-op repeat,
  invalid manifest before DB access, malformed ledger, foreign Drizzle ledger,
  checksum mismatch, database-ahead, unmanaged-schema rejection without
  mutation, unauthorized non-transactional SQL, failed-migration rollback and
  retry, interrupted-process rollback/retry, dedicated-session termination,
  concurrent runners, lock release after failure and bounded lock timeout.
- Node 24 TypeScript check passes.
- Node 24 security audit exits 0 with 38 checks and 0 critical findings.
- Full repository lint passes with the existing 13 warnings and 2 infos.
- `node --check scripts/db/migrate.mjs` passes.

Failed:

- None in the final P02b-2 run. Intermediate failures were fixed in the runner:
  `pg_tables` column name, comment tokens in the SQL safety scan, manual
  transaction handling on a reserved session, fresh-path pending migrations,
  and silent exit-on-connection-loss reporting.

Blocked / not executed:

- Unmanaged baseline adoption: P02b-3.
- Backup v2 and authenticated restore: P02b-6.
- Production startup/Docker cutover and push removal: P02b-5.
- P01 Docker fresh-install smoke test: Docker daemon unavailable.
- Node 26/jsdom `localStorage` failures remain separate; assertions were not
  suppressed.
- No real installation or production database was touched; the runner is not
  referenced by `docker-entrypoint.sh`.

### P02b-3 implementation and checks

Artifacts:

- `scripts/db/schema-fingerprint.mjs` and `.d.mts` — single fingerprint
  implementation shared by the runner and the P02a fixture. Only
  `public.schema_migrations` is excluded; foreign ledgers are checked separately.
- `db/migrations/baseline-fingerprint.json` — production copy of the frozen P02a
  schema fingerprint.
- `scripts/db/migrate.mjs` — verified canonical adoption, column-order
  acceptance, exact missing-runtime-index repair and post-adoption managed path.
- `e2e/p02b/safety.mjs` — `resetFromUnmanagedBaseline()` using the seeded,
  guarded P02a template.
- `e2e/p02b/runner.test.mjs` — 22 integration cases.

Exact command:

```powershell
$env:P02B_DATABASE_URL='postgresql://.../tracker_tracker_p02b'
$env:P02A_TEMPLATE_DATABASE_URL='postgresql://.../tracker_tracker_p02a'
$env:P02B_ALLOW_DESTRUCTIVE='1'
$env:NODE_ENV='test'
npx.cmd -y node@24 --test e2e/p02b/runner.test.mjs
```

Passed:

- Node 24 + PostgreSQL 18.1: **22/22 integration tests pass**, covering canonical
  seeded adoption, column-order adoption, exact missing-index repair, subsequent
  no-op, rows/ciphertext/sequence preservation, extra/missing columns, changed
  definitions, unexpected tables/indexes/constraints, wrong same-named index,
  foreign ledger, repair rollback, adoption interruption/retry, concurrent
  adoption, plus all retained fresh/managed/runner regressions.
- P02a check-baseline self-test and verifier still pass against the template.
- Production baseline checksum remains
  `59b382583d2a70edf5b1b2ca8488408f3eb83582ea4a4eb6aec501f72e0e9815`.
- Node 24 TypeScript, security audit (38 checks, 0 critical), full unit suite
  (224 files, 5902 tests), lint and `node --check` pass.

Failed:

- None in the final run. Intermediate failures were fixed in the repair
  statement extraction (the appended runtime index shared a statement with an
  existing BRIN index) and in the test's active-query filter.

Blocked / not executed:

- Entrypoint/Docker cutover and push removal: P02b-5.
- Backup v2 and authenticated restore: P02b-6.
- P01 Docker fresh-install smoke test: Docker daemon unavailable.
- No production database access; all evidence is from the guarded `_p02b`
  database and the seeded `_p02a` template. Node 26/jsdom failures remain
  separate and unsuppressed.

### P02b-5 implementation and checks

Artifacts (branch checkpoint, not deployed):

- `docker-entrypoint.sh` waits for PostgreSQL, runs
  `node /app/scripts/db/migrate.mjs` before `node server.js`, exits non-zero
  when migration fails, forwards TERM/INT to the migration child, and has no
  push/reset fallback.
- `Dockerfile` removes the `schema-deps`/`drizzle-kit` stage and copies
  `db/migrations` (`0000_baseline.sql`, `manifest.json`,
  `baseline-fingerprint.json`) plus `scripts/db` into the runtime stage;
  `node_modules/postgres` is already copied for runtime resolution.
- `.dockerignore` re-includes `scripts/db`; `db:push` is removed from
  `package.json`.
- `scripts/db/migration-manifest.mjs` rejects `drizzle-kit push` in
  package scripts, CI workflows, `docker-entrypoint.sh` and the `Dockerfile`,
  still rejects unauthorized SQL and requires the runner in the entrypoint.
- `e2e/p02b/entrypoint.test.mjs` adds four stub-based control-flow tests.
  The TERM test now passes the fixture `DATABASE_URL`/`SESSION_SECRET` into
  WSL, waits for the migration marker before signalling, and checks that the
  migration child exits (no orphan).
- README, SECURITY.md, knowledge-base install/upgrade pages, the Copilot
  instructions and the `no-raw-migrations` audit comment now describe the
  reviewed runner instead of `db:push`.

Exact commands and results (Node 24, PostgreSQL 18.1):

```powershell
npx.cmd -y node@24 --test e2e/p02b/entrypoint.test.mjs
# 4/4 pass: migration before app, failure blocks startup, no push fallback,
# TERM blocks startup and leaves no migration orphan

$env:P02B_DATABASE_URL='postgresql://.../tracker_tracker_p02b'
$env:P02A_TEMPLATE_DATABASE_URL='postgresql://.../tracker_tracker_p02a'
$env:P02B_ALLOW_DESTRUCTIVE='1'
$env:NODE_ENV='test'
npx.cmd -y node@24 --test e2e/p02b/runner.test.mjs
# 22/22 pass (fresh, adoption, managed/no-op, drift, interruption,
# concurrency, lock timeout) against the guarded `_p02b` database and the
# seeded `_p02a` template

npx.cmd -y node@24 node_modules/vitest/vitest.mjs run src/lib/__tests__/migration-manifest.test.ts
# 11/11 pass

npx.cmd -y node@24 node_modules/vitest/vitest.mjs run
# 224 files, 5903 tests pass

npx.cmd -y node@24 node_modules/typescript/bin/tsc --noEmit
# pass
biome check .
# pass; 13 warnings, 2 infos, 0 errors
npx.cmd -y node@24 node_modules/tsx/dist/cli.mjs scripts/security-audit.ts
# 38/38 checks pass; 0 critical, 0 warning findings
npx.cmd -y node@24 node_modules/next/dist/bin/next build
# production build passes
```

Static packaging inspection (not an image build):

- `scripts/db/migrate.mjs` imports only Node built-ins, `postgres`, and the
  copied `./migration-manifest.mjs` / `./schema-fingerprint.mjs`.
- No `scripts/db` module imports `e2e/`, `src/`, Vitest or Playwright.
- `.next/standalone/package.json` contains version `2.13.5`, which the runner
  reads for `app_version`.
- `db/migrations/0000_baseline.sql` normalizes to SHA-256
  `59b382583d2a70edf5b1b2ca8488408f3eb83582ea4a4eb6aec501f72e0e9815`,
  matching `manifest.json`; the fingerprint still contains 19 tables.

Follow-up: the candidate matrix ran in PR #1 and passed (see
  "Docker candidate validation" below). The local Docker daemon was unavailable
  during development, which is why the first evidence came from CI.

Still open:

- The published `latest` image was not rebuilt from this checkpoint.
- P01's disposable fresh-install smoke test is a post-publication release gate.
- No deployment or production database access was performed.

### P02b-6 implementation and checks

Artifacts (branch checkpoint, not deployed):

- Both the manual export route and `runScheduledBackup` call the same
  `generateBackupPayload`, so v2 applies to downloads and scheduled files.
- Backup contract: `CURRENT_BACKUP_VERSION = 2`; v1 remains importable.
  v2 exports and requires `notificationDeliveryState`,
  `trackerDailyCheckpoints` and `torrentDailyCheckpoints`; a v1 manifest that
  carries those fields is rejected.
- Validation: unsupported versions, missing v2 arrays, malformed rows,
  duplicate delivery/checkpoint keys, count mismatches and broken references
  are rejected before the restore transaction. v2 restore also rejects a
  notification target scope or checkpoint that points at a missing row.
- Restore: still deletes and inserts in dependency order, but now remaps
  tracker/client/target ids, notification `scope`, delivery state and both
  checkpoint tables. The destination `schema_migrations` ledger is neither
  read nor written.
- v1 semantics: restore leaves delivery state and checkpoint history empty,
  returns `history.* = "unavailable"` and `legacyHistoryUnavailable: true`.
  No past delivery is invented and exactly-once delivery across a restore is
  not claimed. v2 empty arrays are reported as `restored`.
- Coordination: the restore transaction takes an exclusive PostgreSQL advisory
  lock; tracker poll, client heartbeat/deep poll and scheduled-backup cron
  cycles hold the shared lock on one reserved connection and skip while a
  restore is active. A busy restore returns 503 after the bounded 10s wait and
  restarts the local scheduler.
- Encrypted lifecycle: the existing derivation/GCM and re-encryption path is
  unchanged. The coverage test decrypts restored tracker token, Mousehole token,
  client username/password/URL path and notification config with the
  destination key. The scheduler key stays destination-specific and is cleared
  by restore. Change-password, recovery, lockdown and nuke continue to use the
  existing five-site lifecycle; the full unit suite passes.
- Test harness: `resetDatabase` now preserves `schema_migrations`; the global
  setup reloads after answering the retention prompt; the smoke locator matches
  the current "Add tracker" button text.

Exact commands and results (Node 24, PostgreSQL 18.1):

```powershell
npx.cmd -y node@24 node_modules/vitest/vitest.mjs run src/lib/__tests__/backup.test.ts \
  src/app/api/settings/backup/restore/restore-route.test.ts
# 94/94 pass

npx.cmd -y node@24 node_modules/vitest/vitest.mjs run
# 224 files, 5918 tests pass

# _e2e is a fresh database initialized by scripts/db/migrate.mjs (19 tables).
npx.cmd playwright test e2e/backup-v2.spec.ts
# 11/11 pass (setup + 10 cases): v2 round trip, credentials, v1 import,
# corrupt/wrong password, unsupported version, bad relationships, busy lock,
# background guard, injected-failure rollback, unauthenticated 401

npx.cmd playwright test e2e/smoke.spec.ts
# 6/6 pass, including the existing backup export/restore smoke case
```

TypeScript, repository Biome lint, security audit (38/38) and the production
build pass. The injected trigger failure proved the transaction restores the
pre-restore tracker and client rows; the migration ledger was identical before
and after each checked success and rejection case.

**Docker follow-up:** the P02b-5 candidate image matrix passed in PR #1. The
published image and P01 fresh-install smoke test remain open. No production
access, deployment or release was performed.


### P02b-7 validation consolidation and release documentation

P02b-7 is documentation only; it changed no application code. The recorded
Node 24 evidence is:

| Check | Result |
|---|---|
| Manifest regression | 11/11 pass |
| Reviewed runner on PostgreSQL 18.1 | 22/22 pass |
| Entrypoint control flow (Node 24 + WSL/sh) | 4/4 pass |
| Backup/restore contract | 94/94 pass |
| Full unit suite | 224 files, 5918 tests pass |
| Authenticated HTTP backup suite | 10/10 cases pass (plus setup) |
| Existing browser smoke suite | 6/6 pass |
| TypeScript | pass |
| Biome | 0 errors (15 warnings, 2 infos) |
| Security audit | 38/38 pass, 0 critical/warning |
| Production build | pass |

Upgrade, backup-compatibility and rollback procedures are recorded in
`docs/UPGRADE_AND_ROLLBACK.md`. Release notes are in `CHANGELOG.md` under
`[Unreleased]`. The Docker job now builds the actual PR head for
linux/amd64 and runs `e2e/docker/validate-candidate.sh`; PR #1 carries the
first passing candidate evidence.

**Explicitly open:** the published `latest` image was not rebuilt, and the P01
disposable fresh-install smoke test against a published image has not run. The
candidate-image equivalent for this PR passed in the Docker job. This work is
**not** a production-validated release.

### Docker candidate validation (PR #1)

`Docker Build & Scan` run
[40036272230](https://github.com/rednato25/tracker-tracker/actions/runs/40036272230)
built the actual PR head `02af2eac` for `linux/amd64` and passed in 2m41s:

- Fresh database startup with `/api/health` and one baseline ledger row.
- Managed restart with a no-op migration path and no duplicate ledger row.
- Unknown schema refused before DDL and before the server started; probe table
  preserved and no ledger created.
- Database-ahead ledger refused without applying the unknown version.
- PostgreSQL 17 refused by the runtime major guard before ledger/table
  creation and before the server started.
- Two concurrent containers both healthy with one ledger row.
- Frozen seeded P02a baseline adopted; two trackers and fixture settings
  preserved; fixture `verify.ts` passed after adoption.
- Compose Quick Start healthy using an explicit `tracker-tracker:ci` override
  and the candidate image identity asserted; the published `latest` image was
  not used.

The same PR also passed CI, Security Audit, Docs Build, Knip, Tracker
Validation, CodeQL and Dependency Review. OSSAR was retired with owner approval;
its actual coverage removal is documented in `SECURITY.md`. Dependency Review
reported no findings. No assertion was weakened.

Candidate-image validation is the pre-merge gate and has passed. The published
`ghcr.io/rednato25/tracker-tracker:latest` image smoke test is a post-publication
release gate; it is not required before the merge that creates that image. This
is not a production-validated release.

### Published-image validation (PR #2)

PR #1 merged to `main` at `0ff13573` (merge commit). GHCR run
[40037997388](https://github.com/rednato25/tracker-tracker/actions/runs/40037997388)
published:

- `ghcr.io/rednato25/tracker-tracker:latest`
- `ghcr.io/rednato25/tracker-tracker:sha-0ff13573758e312466bffe311fb98e9a613401d6`
- platform `linux/amd64`
- immutable digest
  `sha256:9548aecb3231f51cdbddf276526244eda54c5bd6c40f5d0d3d9d920b5ff6fdda`

The Release workflow was already `disabled_manually`, so the merge created no
tag or GitHub Release. Main CI, Security Audit, Docs, CodeQL and GHCR passed.
PR #2's merge (`ec3fe17f`) triggered a second docs-only image from that commit;
it was pulled and smoke-tested separately, so both published artifacts have
evidence. `latest` now points at `ec3fe17f` / `adcec0f2…84b456`.

PR #2 validated `0ff13573` / `9548aecb…f6fdda` in run
[40038697376](https://github.com/rednato25/tracker-tracker/actions/runs/40038697376).
After the docs-only PR #2 merge published `ec3fe17f` / `adcec0f2…84b456`,
workflow_dispatch run
[40048016089](https://github.com/rednato25/tracker-tracker/actions/runs/40048016089)
validated that artifact too. Both runs pulled by digest, asserted the local
`RepoDigest`, and passed fresh startup/health, baseline ledger, P02a adoption,
managed restart, unknown/ahead refusal, PostgreSQL 17 refusal, concurrent
startup and Compose.

No published image was pulled into the running installation, and no production
database was accessed.

### CI security configuration

- **Dependency Review:** passes at `02af2eac` (run 120696411518) with no
  findings; the dependency graph is enabled and populated.
- **OSSAR:** retired with owner approval. It produced no SARIF findings
  because Bandit/BinSkim/SpotBugs had no applicable targets and its generated
  ESLint 9 config could not run here. The removed ESLint JS security rules and
  the non-equivalent remaining coverage (CodeQL, Trivy, Biome, Dependency
  Review, custom audit) are documented in `SECURITY.md`; no
  `continue-on-error` or exclusion was used.
- Docker Build & Scan's first attempt at `465d63c1` failed inside Next/Turbopack
  font resolution (`@vercel/turbopack-next/internal/font/google/font`); a rerun
  passed every scenario. No source change was made for it, and the failure is
  reported here rather than hidden.
- The PostgreSQL 18 guard is **implemented**, not pending:
  `assertPg18()` in `scripts/db/migrate.mjs` reads `server_version_num` before
  any ledger read, adoption or DDL. `e2e/p02b/safety.mjs` also refuses non-18
  test databases, and Docker scenario 7 verifies PostgreSQL 17 is rejected
  before mutation and server startup.

### P03 implementation and checks

- `src/lib/tracker-rules.ts` is the read model for account and per-torrent
  requirements. New fields are `requiredAccountRatio` and
  `requiredTorrentRatio`; `minimumRatio` remains readable. A legacy
  `minimumRatio` becomes the account rule, and becomes the torrent rule only
  when the entry had already declared `satisfactionMode` (the pre-P03
  behavior). Values are never rewritten in the registry.
- Missing, known zero and unknown are distinct: `null` is unknown, `0` is a
  confirmed no-requirement, and an absent rules block is unknown. A tracker with
  no ratio stays seed-only; an account ratio never satisfies a torrent by itself.
- Provenance covers account ratio, per-torrent ratio, accounted transfer, H&R,
  login and seeding. It carries `source`, `verifiedAt`, `timestampKind` and
  `freshness`. A poll timestamp is marked as snapshot age, not an independent
  metric verification; real registry entries without a confirmation record stay
  `unknown` and no dates are invented.
- `lastAccessAt` is the only login evidence and is marked manual. Snapshot/API
  data is explicitly not login proof. `satisfaction.ts` now consumes the
  per-torrent field; tracker health, the register and the info tab read the
  account field through the resolver and show Unknown versus None.
- No database or migration change was required.
- Tests: `src/lib/tracker-rules.test.ts` covers missing/zero/unknown, legacy
  mapping, explicit overrides, stale snapshots, contradictory live/registry
  sources, ratio-less trackers, manual login and account-vs-torrent behavior.
  Full unit suite 225 files / 5982 tests, TypeScript, Biome, audit 38/38 and the
  production build pass on Node 24. Synthetic rules only; no real account was
  accessed.

### P04 action engine

- `src/lib/actions.ts` exposes a pure `computeTrackerActions({ trackers, clients, torrents, now })`.
  It performs no I/O and does not read the clock, so tests and every surface
  get the same ordered result for the same input.
- Supported actions: confirmed account ratio below the account rule, login due,
  login overdue, missing login evidence, stale data, polling paused, local poll
  error, explicit authentication rejection, client error, reported H&R,
  unmet per-torrent seeding obligation, and missing rules/data verification.
- P03's resolver supplies account and torrent rules plus provenance. Account
  ratio never feeds `resolveSatisfaction`; per-torrent actions use only the
  explicit/legacy torrent route.
- `status` separates `action-required` from `needs-verification`. Unknown
  rules, missing stats, invalid timestamps and stale snapshots produce
  verification actions, not violations. Stale snapshots suppress ratio, H&R and
  ratio-missing actions rather than confirming them.
- A generic poll message is a local `poll-error` needing verification. Only an
  explicit 401/403/unauthorized/forbidden/invalid-token signal becomes
  `auth-error`; expiry is never inferred from a cookie message. Opening a link
  or polling does not touch confirmed login evidence.
- Keys are stable (`type:tracker:id[:torrent:hash]`). Equivalent keys dedupe
  without text affecting identity; sorting is priority, then derivable
  deadline, then key. Only the login reminder derives a deadline, and it is a
  reminder date, not a ban date.
- Resolved conditions disappear on the next pure computation; no database
  state or computed-action table was added.

Tests: `src/lib/actions.test.ts` covers exact thresholds, known/unknown/missing
and confirmed-zero rules, fresh versus stale evidence, account/torrent
separation, login boundaries, generic versus explicit auth errors, H&R/client
actions, disabled trackers, dedupe/ordering, recovery/reappearance and
determinism. Focused suites 99 tests; full suite 5998 tests; TypeScript,
Biome, security audit 38/38 and production build pass on Node 24.

### P05 attention dashboard

- `src/components/dashboard/AttentionNeeded.tsx` renders the compact
  Attention needed surface on the dashboard. It consumes
  `computeTrackerActions` for type, status, priority, deadline, key and
  evidence; it does not re-derive tracker rules.
- Counts separate confirmed actions, verification items and clear accounts.
  Filters are **Needs attention**, **Unknown**, **Healthy** and **All**.
  "Healthy" means no action and no verification item, never "unknown rules
  treated as satisfied."
- Each row shows the affected tracker/client/torrent, the written status
  (Action required or Needs verification), reason, known deadline/value and one
  next-action link to the existing tracker page or Settings. Login rows link to
  the tracker page; opening a link never marks login.
- Evidence/source, freshness, observed/verified timestamps and the stable key
  are behind a native `<details>` disclosure. Status uses text and icon, not
  color alone.
- Loading withholds all-clear. Error and unavailable client data produce
  explicit incomplete states. Verification-only data says "No confirmed
  problems" rather than "All clear." A complete, empty result is the only
  all-clear.
- The dashboard passes server time to keep the first render aligned. One
  existing bulk clients query feeds client actions; there are no per-row
  requests. No credentials are serialized into actions.
- No dismiss/snooze state was added: P04 conditions disappear only when
  recomputed and resolved. No notification, torrent mutation or database table
  was added.

Validation: `AttentionNeeded.test.tsx` covers confirmed vs verification,
filters, links, loading/error/partial-data, verification-only wording,
all-clear gating, evidence disclosure, resolution/reappearance and stable keys.
`e2e/attention.spec.ts` seeds synthetic trackers in the guarded e2e database
and verifies the real dashboard in light, dark and 390px mobile layouts;
screenshots are written to the ignored `test-results/` directory. Full unit
suite 227 files / 6006 tests, TypeScript, Biome, security audit 38/38 and the
production build pass.

### P05 deferred roadmap items

The compact surface is implemented; these P05 roadmap items are explicitly
**not** implemented and must not be read as delivered:

- **Next action column in the dense tracker register:** deferred. Next action
  is present in each attention row; changing the register grid would duplicate
  the action and risk unrelated dashboard regressions.
- **Timed snooze/dismiss:** deferred. Existing alert dismissal has no timed
  snooze semantics, and P04 actions are computed rather than stored. Adding a
  new dismissal store was out of scope; conditions disappear when the pure
  engine recomputes and resolves them. Dismissing an H&R action would not mark
  it resolved.
- **Torrent-level attention rows:** deferred. P04 supports synthetic torrent
  obligations, but the dashboard has no bulk torrent feed today. Adding one
  would introduce another request and was outside this compact surface; the
  dashboard shows tracker-level H&R and verification actions.

### P06 Telegram delivery

- Telegram is a second supported type on the existing `notification_targets`
  row. Its `{ botToken, chatId }` config lives inside the existing
  AES-256-GCM `encryptedConfig`; no schema or migration change was needed.
- Settings exposes Telegram in the existing add/edit target flow, with
  bot-token and chat-ID fields, masked storage, and a **Send Test Message**
  control. Tokens are never returned by the API or written to logs/errors.
- Delivery reuses the existing event eligibility, per-target cooldowns and
  durable `notification_delivery_state`. A send attempt is not recorded as a
  successful delivery; only `ok: true` writes state.
- `sendMessage` uses the official fixed HTTPS host, plain text (no parse mode)
  and a 5s timeout. HTTP 429 and API `error_code: 429` honor
  `parameters.retry_after` (capped); 401/403 stop with a credential error;
  other API/HTTP/network failures use the existing bounded circuit breaker.
  Ambiguous network failures are not claimed as exactly-once delivery.
- The generic `encryptedConfig` lifecycle covers Telegram without a new
  field: change-password and backup/restore re-encrypt it, recovery
  (`scripts/recover.cjs`) lists `notification_targets.encrypted_config`, nuke
  randomizes then deletes it, and lockdown now revokes notification configs and
  disables their targets. Existing security tests still prove the API never
  serializes `encryptedConfig`.
- Discord remains unchanged. Telegram is opt-in for new targets only; no
  existing user is auto-enabled. ntfy, digests and later platforms are not
  implemented.

Validation: local fake Telegram HTTP service covers success, 429/retry_after,
API `ok:false`, 401, timeout and circuit opening; dispatch tests cover durable
state, cooldowns and independent Discord/Telegram targets; validation tests
cover token/chat-ID rejection without echoing the token and plain-text message
escaping. The change-password and backup/restore fixtures now carry a Telegram
config, so the existing generic re-key and restore paths exercise this shape.
Full unit suite 229 files / 6019 tests, TypeScript, Biome, security
audit 38/38 and production build pass. No real Telegram message was sent.

### P07 ntfy delivery

- ntfy is a supported target using the existing `encryptedConfig` field:
  `{ serverUrl, topic, authToken?, allowPrivateNetwork? }`. No schema or
  migration change.
- Settings exposes server URL, topic, optional access token and an explicit
  **Allow private network** opt-in for self-hosted servers. The global URL
  safety policy is unchanged; private/local ntfy hosts are allowed only when
  that per-target flag is set. Public servers work without it.
- Publishing uses ntfy's JSON publish API at the configured server root, with
  Bearer auth when a token is present. The topic is in the JSON body, not a URL,
  and is never logged. Redirects use `redirect: "error"`, so the token is never
  forwarded to another origin.
- Delivery has a 5s timeout, a 16KB response cap, 429/Retry-After handling,
  401/403 credential rejection and the existing circuit breaker. Only a
  confirmed 2xx response records durable delivery state; ambiguous failures are
  not claimed as exactly-once.
- Reuses event eligibility, per-target cooldowns and
  `notification_delivery_state`; no scheduler or alert engine was added.
  ntfy is opt-in and existing targets are unchanged.
- The generic `encryptedConfig` lifecycle covers ntfy: change-password and
  backup/restore re-encrypt it, recovery includes the column, nuke
  randomizes/deletes it, and lockdown revokes notification configs.
- Discord and Telegram remain supported; digests, quiet hours and later
  platforms are not implemented.

Validation: local fake ntfy service covers JSON/Bearer success, redirect refusal,
401, 429 and timeout; dispatch covers ntfy durable state alongside Telegram and
Discord; validation covers public/private URLs, topics, credential-bearing URLs
and header-safe tokens. Full suite 230 files / 6028 tests, TypeScript, Biome,
security audit 38/38 and production build pass. No real ntfy message was sent.

### P08 notification digests and quiet hours

- Migration `0001_digest_settings` adds digest enable/time/timezone/empty
  behavior/destination ids/state. Migration `0002_quiet_hours` adds opt-in
  quiet start/end/timezone and the explicit critical-bypass flag. The frozen
  baseline and published checksums are untouched.
- Digests are opt-in. A one-minute task on the existing master scheduler runs
  behind a PostgreSQL advisory lock. Per-target state stores last attempt,
  last success, local-date dedup and next-attempt backoff. Restart or concurrent
  execution cannot send the same local date twice; missed days collapse to at
  most today's summary.
- Quiet hours are opt-in with an explicit IANA timezone. Windows crossing
  midnight and DST transitions are handled via `Intl`. Routine immediate events
  are coalesced into durable `quietPending` state, not dropped or marked
  delivered. When quiet hours end, the summary is rebuilt from current P04
  actions, so resolved items disappear and no backlog of old daily digests is
  sent.
- The only urgency bypass is `quietHoursCriticalBypass`, limited to
  `hit_and_run` and `tracker_down`. Non-critical events in that batch remain
  pending. The UI documents this; no other event bypasses quiet hours.
- Rendering groups by tracker/client and separates `ACTION REQUIRED` from
  `NEEDS VERIFICATION`. Empty digests are skipped by default or sent only when
  the user explicitly chooses an all-clear summary.
- Provider sizing is explicit: Discord uses an embed description capped at 4096
  characters (no 2000-character content field is used), Telegram is capped at
  4096 characters, and ntfy is capped at 4096 UTF-8 bytes. UTF-8 truncation is
  emoji/diacritic-safe. Omitted-item counts and an HTTPS dashboard link are
  included in the budget where possible.
- Restore remaps `digestTargetIds` and every `digestState` key through the new
  notification-target id map. Digest/quiet settings and state ride in
  app-settings backup/restore and follow nuke/lockdown.
- Failed or ambiguous sends do not advance success/dedup state; retries are
  bounded per target. No exactly-once claim is made.

Validation: `digest.test.ts` covers local-time boundaries, New York DST,
dedup/restart, backoff, empty behavior, grouping, UTF-8 truncation and dashboard
links. `quiet-hours.test.ts` covers midnight crossing, DST, opt-in and the
limited critical set. `digest-run.test.ts` covers competing lock acquisition,
independent target state and per-target failure backoff. Dispatch tests prove
quiet deferral does not mark delivery; restore tests prove id/state remapping
and quiet/digest settings. Full suite 232 files / 6046 tests, TypeScript,
Biome, audit 38/38 and production build pass. Docker run 40096915406 validated
fresh startup and P02a adoption through migrations 0001 and 0002. No real
notifications were sent.

### P08 manual isolated test

On 2026-10-24 the P08 behavior was exercised on the published digest with a
disposable PostgreSQL 18 database and a local ntfy mock. No production access,
real tracker requests or real external notifications occurred.

- **Attention needed:** confirmed ratio action, unknown/stale verification and
  clear row all rendered; inserting a ratio 3.0 snapshot removed the resolved
  action after refresh.
- **Digest:** the delivered mock body contained the current P04 actions and
  `ACTION REQUIRED` / `NEEDS VERIFICATION` groups. Digest success is tracked by
  `app_settings.digest_state.lastSuccessAt`, not by
  `notification_targets.last_delivery_at`; the latter is updated by immediate
  dispatch only.
- **Quiet hours:** a digest due inside the window was not sent; state showed
  `quietPending: true`. It was delivered at the window end with the summary
  rebuilt from current actions.
- **Restore:** a restored tracker without `last_polled_at` correctly appears as
  needs-verification, not healthy. Backup/restore round-tripped the three
  synthetic trackers and snapshots.

### P09 rank-goal evaluator

- `src/lib/rank-goals.ts` is a pure evaluator: no browser, database, tracker
  request or clock read. `now` is injected for account-age conditions.
- Structured requirements support numeric comparisons and nested `all`/`any`
  groups. ALL is unmet when a known condition is false; ANY is met when one
  condition is true; unknown propagates when a result cannot be established.
  Empty groups are unknown, not silently met.
- Every condition reports its id/label, required value, observed value,
  freshness/source, met/unmet/unknown status and a remaining amount only where
  mathematically meaningful (gte/lte). Missing values stay `null` and distinct
  from a confirmed 0. Stale observations are unknown.
- Account conditions use account observations. Per-torrent conditions are
  explicitly unknown in this account-rank evaluator; the P03 per-torrent rule is
  not mixed into account ratio.
- Current and next rank reuse `buildRankLadder`/`buildRankForest`. Staff/donation
  classes and unselected branches do not become a numeric next rank. An
  out-of-ladder current rank yields no inferred next rank.
- Free-text `userClasses.requirements` is returned unchanged as readable
  information; prose is never parsed into thresholds, sources or dates.
- `eligible` is informational only. `promotionApplied` is always false, the
  observed current rank is never updated, and no ETA/average-percentage chance is
  produced. Personal goals use the same condition/group evaluator.

Tests: `src/lib/rank-goals.test.ts` covers all-met, one unmet, unknown in ALL and
ANY, nested groups, exact boundary, zero versus missing, account-age clock
boundaries, stale observations, manual/non-numeric conditions, per-torrent
separation, large values, unknown ranks, appointed classes, branch forks and
personal goals. Full suite 234 files / 6058 tests; TypeScript, Biome, security
audit 38/38 and production build pass.

### P10 pilot rank definitions

- `src/data/rank-goals.ts` selects three existing ladder entries:
  **TorrentLeech**, **MyAnonaMouse** and **REDacted**.
- **TorrentLeech** is the only source-backed pilot. The official public wiki
  (`https://wiki.torrentleech.org/doku.php/user_classes`) was consulted on
  2026-10-25. Its own last-modified date (2021-09-03) is recorded separately
  and is not treated as a fresh verification.
- The wiki's account-age and ratio conditions are encoded exactly (gte for the
  minimum registration period, strict greater-than for ratio). Four promotion
  classes use those verified conditions.
- The upload thresholds are retained with their required values, but marked
  `verification: "unresolved"`: the wiki says GB/TB without establishing binary
  or decimal units. The evaluator reports the upload condition `unknown`, so no
  fully eligible result can be claimed. The unit caveat is visible on the
  condition.
- VIP/staff classes remain manual/outside the ladder.
- **MyAnonaMouse** and **REDacted** keep their existing free-text registry
  descriptions but have **no structured goals**. Their official wikis were not
  publicly readable (403/login), and no threshold was inferred from prose.
- Follow-up issues: https://github.com/rednato25/tracker-tracker/issues/11
  (TorrentLeech units) and
  https://github.com/rednato25/tracker-tracker/issues/12 (MAM/REDacted
  excerpts).
- The P09 evaluator remains the only calculation path. Eligibility is
  informational; no observed rank is changed and no promotion is applied.
- No database, UI, tracker access or ETA implementation.

Tests: `src/data/__tests__/rank-goals.test.ts` covers TorrentLeech verified
age/ratio boundaries, exact gt/gte semantics, unresolved upload units, a
regression proving high transfers cannot produce eligibility, missing/stale
values, manual VIP/appointed behavior, source-date separation and unresolved
pilot non-eligibility. Full suite 235 files / 6064 tests; TypeScript, Biome, security
audit 38/38 and production build pass.

### P11 rank-goal UI and estimates

- `RankGoalPanel` on the tracker detail page uses the P09 evaluator and P10
  definitions. It shows the observed current rank and a selectable target rank;
  it never changes the observed rank.
- Conditions show required/observed values, met/unmet/unknown, remaining values
  where meaningful, source/freshness and unit caveats. Manual conditions say
  "unknown" rather than zero; the upload-unit caveat stays visible beside the
  condition. Sources/verification and unresolved excerpts are expandable.
- Trackers without verified structured definitions keep the existing ladder and
  free-text requirements and show "structured progress unavailable". No global
  percentage or promotion claim is produced.
- The selected target is stored under `app_settings.rank_goals` (migration
  `0003_rank_goals`), so it survives restart and app-settings backup/restore.
  Restore remaps the tracker-ID keys through the new tracker-ID map; a focused
  fixture proves an old id 1 cannot keep pointing at the wrong restored tracker.
  No separate rank system or database table was added.
- ETA is limited to a verified upload condition with at least two fresh
  observations spanning a day and a positive recent trend. It reports the basis
  and says it is not a promotion date. The unresolved TorrentLeech upload unit
  makes its ETA unavailable. Account-age conditions show the exact threshold
  date, not an estimate.
- No P12, deployment or tracker access.

Validation: `rank-eta.test.ts` covers positive, missing, stale, reset and
non-positive history. `RankGoalPanel.test.tsx` covers verified/unknown-unit,
unsupported/unresolved trackers and target persistence. Full suite 236 files /
6070 tests, TypeScript, Biome, security audit 38/38 and production build pass.
Light/dark/mobile screenshot inspection remains blocked because local
PostgreSQL and Docker are unavailable; follow-up: https://github.com/rednato25/tracker-tracker/issues/14. Docker CI validates migrations, not rendered UI.

### P12 download-budget calculator

- `src/lib/download-budget.ts` implements the roadmap formulas over accounted
  upload/download, proposed size, explicit charged fraction, user target ratio,
  already-committed charged traffic and a charged-traffic reserve.
- It returns charged bytes, projected downloaded, projected ratio, headroom,
  physical transfer budget and additional upload required to reach the target.
  A negative headroom produces a zero budget, not a negative allowance.
- The tracker minimum ratio and the user-selected target are separate inputs;
  the calculation uses only the target ratio. Per-torrent seeding/H&R rules are
  not mixed into the account calculation.
- Unknown charged fraction, invalid/negative values, unknown amounts and no
  target make the result unavailable. A zero charged fraction is explicitly
  `scenario-only`, not unlimited or safe capacity. The result always carries
  `safetyVerdict: "not-assessed"`.
- Freeleech/accounting multipliers are accepted only as an explicit fraction;
  no future upload is credited and no dynamic ratio rule is predicted.
- Follow-up for dynamic ratio/freeleech-expiry evidence: #15.

Tests: `src/lib/download-budget.test.ts` covers the roadmap example, explicit
fractions, committed traffic, required upload, zero amounts, exact boundaries,
negative/oversized reserves, unknown/invalid inputs, no-ratio status and
target-vs-minimum separation. Full suite 237 files / 6078 tests; TypeScript,
Biome, security audit 38/38 and production build pass.

### P13 download-budget UI and scenario queue

- The tracker-detail budget panel reuses `calculateDownloadBudget`; no formula
  is duplicated in the UI.
- It shows accounted upload/download, freshness, tracker minimum separately from
  the user target, explicit accounting assumption, proposed GiB size, projected
  ratio, transfer budget and upload needed. Unknown accounting is unavailable;
  zero charge is a labelled scenario; a target below the minimum is disclosed.
- The panel states that it is account-ratio arithmetic only and not H&R or
  overall-safety approval.
- The planning queue supports add/edit/remove and cumulative calculations with
  an effective charged fraction. It is local planning state only, separate from
  committed traffic/reserve; nothing is sent to a tracker or download client and
  no queue persistence was added.
- No P14.

Visual evidence: the CI Visual Evidence job runs the existing disposable
PostgreSQL/Playwright setup and uploaded six artifacts (rank/budget, light/dark/
mobile) in run 40178324799. The artifacts were downloaded and inspected. The
rank panel renders its conditions and unknown-unit caveat; the budget panel
renders its form and arithmetic result. The apparent mobile clipping was a capture artifact: viewport and main were
390px wide with zero horizontal overflow, panels at x=16/width=358, and only the
hidden off-canvas sidebar extended negative. The CI capture now scrolls panels
below the fixed header and uses a page clip/full-height viewport. Inputs and
queue add/edit/remove worked at 390px, vertical scrolling reached the panel
bottom, and the light/dark/mobile artifacts were inspected. Issue #14 was closed
only after those checks.

UX correction: the queue preview was showing the physical transfer budget
(383 GiB) instead of remaining charged allowance (65 GiB). The calculator now
exposes `remainingChargedAfterProposed`; the prominent result and queue use it,
while physical budget is secondary. The draft preview now names the actual
blocker, draft values remain visible after adding, and controls/labels are
simplified. Regression covers U=900/D=600 with 50/15 freeleech + 155/80 charged
=> 235 charged, 835 downloaded, ratio 1.08, 65 GiB remaining. PR #18 contains
the fix; merged in `cbca164a`.

Tests: `DownloadBudgetPanel.test.tsx` covers single results, unknown accounting,
freeleech scenario, target below minimum, queue add/edit/remove/cumulative,
stale/unavailable data, the exact reported queue and no network mutation. Full
suite 238 files / 6085 tests; TypeScript, Biome, security audit 38/38,
production build and Docker Build & Scan pass.

### P13 manual acceptance

The owner accepted the corrected calculator on the isolated home-server
instance using digest
`sha256:8b8cba401ffab275a3c46cb33db7ef0264702c71422de9fe33198dffe0a89690`.
The accepted behavior is the P13 budget UI and saved simulation queue, including
the 235/835/65 charged-allowance result and the explicit unknown/freeleech
states. Minor polish remains tracked separately: clearer draft/saved headings
and moving the physical-size budget into advanced details.

### P14 Prowlarr import

- Read-only Prowlarr client calls `GET /api/v1/indexer` with `X-Api-Key`,
  bounded timeout, redirect refusal and response cap. The API key is encrypted
  in app settings and never returned; private-network access is a connection
  scoped opt-in.
- Preview normalizes URLs and reuses the registry hostname/name/abbreviation
  matching. It distinguishes ready, already-added, ambiguous and unsupported
  entries; no automatic match for ambiguous names.
- Selection is explicit. Import creates active, user-paused tracker placeholders
  only for selected ready entries, does not copy cookies/passkeys/arbitrary credentials,
  does not poll, and marks credentials as requiring manual configuration.
  Repeated imports skip existing slugs and duplicates within the selection;
  imported rows remain visible in the register as PAUSED and require manual
  credentials/polling configuration.
- Settings has URL, API key, private-network opt-in, Test and preview, per-row
  selection and Import selected. The Prowlarr API key is not a tracker key.
- No Jackett, search, download-client actions or P15.

Tests: local fake Prowlarr service covers auth, 401, invalid JSON, private URL
policy, matching, duplicates and unsupported/ambiguous entries; the authenticated
Playwright visual run covers preview/import, verifies the created tracker is
visible and paused, and captures desktop/mobile Prowlarr UI. Full suite 240
files / 6089 tests; TypeScript, Biome, security audit 38/38 and production build
pass. Desktop/mobile artifacts were inspected; the imported tracker appears as
PAUSED in the register and remains visible. Long Prowlarr preview text still
clips at the right edge on mobile; this non-blocking polish is tracked as #21.
No real Prowlarr or tracker was contacted.

### P15 Jackett import

- Jackett discovery uses the documented read-only dashboard flow: POST
  `/UI/Dashboard` for a cookie, then GET `/api/v2.0/indexers?configured=true`.
  The admin password is request-scoped and not persisted; indexer secrets are
  never read or copied.
- The preview reuses the P14 statuses (ready/already-added/ambiguous/unsupported)
  and registry hostname/name matching. Ambiguous names are not auto-matched.
- Selected-only import creates active, user-paused placeholders with a clear
  "configure tracker credentials" error. Entries remain visible in the register
  and do not poll. Duplicates and repeated selections are skipped.
- No Jackett connection storage, migration, backup state or lifecycle change was
  added because the password is not persisted. No search/download/indexer action.
- Visual evidence is captured by the authenticated CI run: light, dark and mobile
  settings preview/import plus the imported tracker on the dashboard. The import
  was verified as active/user-paused in the database; the register shows it as
  PAUSED. #22 is closed.

Tests: local fake Jackett service covers login cookie, configured indexer list,
failed login, private URL policy, matching, duplicates, ambiguous/unsupported.
Full suite 240 files / 6092 tests; TypeScript, Biome, security audit 38/38 and
production build pass. The visual run (40311910654) produced
`visual-jackett-{light,dark,mobile,imported-tracker}.png`; light/dark contrast
and the PAUSED register state were inspected. On mobile the long preview URL and
credential notes still clip at the right edge; this is the shared preview
wrapping polish tracked in #21, not a P15 blocker. No real Jackett or tracker was
contacted.

### P14/P15 owner manual acceptance (owner-reported, 2026-10-26)

The owner confirmed both import flows on the isolated home-server instance using
the already-published image digest
`sha256:2b265361883e03e39127cf05cacbbe90bbf2dd470d34d50759e88b91f9ae995e`:

- FileList was imported through the Prowlarr flow; AlphaRatio through the Jackett
  flow.
- Both imported trackers remained visible and PAUSED, with no account metrics
  and no automatic polling.
- Existing entries were identified as already added.
- Tracker credentials were not copied into the imported placeholders.

This is owner-reported acceptance from the isolated instance, not new automated
evidence. The fake-service tests and the authenticated Playwright artifacts
remain the automated evidence. The minor mobile long-text wrapping issue stays
in #21; the completed import implementation was not reopened.

### P16 read-only integration API

- Adds `/api/integrations/v1/summary`, `/actions` and `/history`. They read
  stored tracker snapshots and run the existing P04 evaluator; no route performs
  a poll, search, download, connection test or tracker/client request.
- Scope vocabulary is `summary:read`, `actions:read` and `history:read`.
  Migration `0005_integration_tokens` adds only `integration_tokens` and
  `app_settings.integration_identity_mode` (default `none`).
- Tokens are `tt_int_` plus 32 random bytes. Only SHA-256 hashes, names, scopes
  and timestamps are stored; plaintext is returned once by the session-only
  creation route. Revocation is immediate and keeps a revoked marker.
  `Authorization: Bearer` is the only accepted transport; token-looking query
  parameters return 400. Up to 20 active tokens may exist.
- Integration tokens cannot reach admin, mutation, backup, log/secret export or
  credential routes: those keep the session gate, and the proxy exposes only the
  `/api/integrations/v1/` prefix without a cookie.
- Responses are explicitly shaped. They omit base URLs, registry slugs, raw
  errors, cookies, passkeys, credentials and private configuration. Identity
  disclosure is explicit: `none` (default, name and username absent), `trackers`
  (name only), `full` (name plus stored username only when username storage is on
  and the value is not redacted). Numeric tracker ids remain for stable cursors.
- Summary is capped at 200 trackers; actions at 200; history requires
  `1 <= days <= 90` and `1 <= limit <= 500`, with an ISO cursor. Oversized values
  return 400 rather than being silently clamped. `unknown`/`stale`/`current` and
  `needs-verification` evidence are preserved.
- Lifecycle: password change and lockdown revoke every token; nuke deletes them.
  Backups deliberately exclude tokens, and restore deletes every token, so a
  restore cannot reactivate access revoked after the backup. A successful
  `tt-recover --apply` also deletes every token inside its existing password
  reset/re-key transaction; failed recovery rolls that deletion back. `--check`
  and dry runs write nothing. Full contract and curl examples:
  `docs/INTEGRATION_API.md`.
- Settings > Integrations creates/lists/revokes tokens and selects the identity
  mode. Creation shows the token once; the list never fetches plaintext or hashes.
  Desktop light/dark/mobile visual evidence is captured by the authenticated E2E
  run with a synthetic token that is deleted afterwards.
- Limitations: no write scopes, token expiry, CORS policy, webhooks, search,
  downloads or torrent-level history. Optional expiry is deduplicated in #25.
  No deployment, real integration or home-server change.

Tests: focused route/auth/privacy/UI/lifecycle tests cover missing, invalid and
revoked tokens, insufficient scopes, query-string rejection, explicit response
fields, bounded summary/actions/history, oversized parameters, token creation
one-time display and revocation, password change, lockdown, nuke and restore.
A recovery regression proves a previously valid token is rejected after a
successful reset and remains valid when the transaction fails and rolls back.
Full suite on Node 24: 246 files / 6142 tests passed. TypeScript, Biome and
security audit 38/38 pass; production build and Docker candidate migration
validation are covered by PR CI. The authenticated visual run captured desktop
light/dark and mobile token management with the synthetic one-time token blurred
and deleted afterwards; the captured views were inspected and showed no layout
break at 390px, including the active token row and revoke confirmation.

### P16 owner-supplied home-server acceptance (2026-10-26)

The owner supplied isolated home-server verification on the published digest
`sha256:02271ad43c65dc5b8a81a0b878747c4b5fbf02ab0fcd94061bee04b8cf4969fb`:

- Migration `0005_integration_tokens` applied successfully and health passed.
- Existing login, trackers and mock integrations were preserved.
- A summary-only token returned 200 from summary, 403 from actions, and 401 from
  summary after revocation, all without session cookies.
- The hidden-identity response excluded tracker names, usernames and secrets.
- The token was displayed once; the database stored only its hash.
- All temporary test tokens were revoked.
- Production and its stopped updater were unchanged.

This is owner-supplied home-server evidence, not a check performed by the
assistant. The automated evidence remains the unit/route/UI tests, CI checks and
authenticated Playwright artifacts. A headless typing observation was not treated
as proof of a user-facing defect and no speculative UI fix was made; it should
only be investigated further if normal keyboard interaction reproduces it.

### P17 recruitment-route data and evaluation

- Adds a versioned offline format and deterministic evaluator in
  `src/lib/recruitment-routes.ts`, with no UI, network fetch, database access,
  automated application or recruiter message.
- Uses the native `trackerpathways` dataset (MIT), pinned at commit
  `5e3b206ed1352b56a685b90ec8da3757f702c3eb`; attribution and the full MIT notice
  are in `src/data/recruitment-routes.ts`, `docs/RECRUITMENT_ROUTES.md` and
  `docs/THIRD_PARTY_NOTICES.md`. Yata-Dash is GPL-3.0; its converted
  `routes.json` was not copied.
- Real coverage: 598 upstream edges; 194 edges whose source and destination both
  resolve to a production registry slug. 117 unresolved community names are
  omitted rather than guessed. 549 upstream edges are community-marked open, 37
  closed and 12 unknown/limited; the included subset preserves closed and unknown
  examples.
- Structured requirements come only from the explicit `days` field
  (`accountAgeDays >= days`). Prose stays readable and evaluable-free. Missing or
  stale observations remain `unknown`; empty/no-structured route requirements are
  `unknown`, never `met`.
- Eligibility (ALL/ANY, met/unmet/unknown) is separate from community
  availability (open/closed/unknown) and from invitation/admission, which are
  always unguaranteed and the active recruiter is always `unknown`.
- Dates stay distinct: per-route `sourceUpdatedAt` (month precision), catalog
  `sourceAccessedAt`, and `lastVerifiedAt` (null for community data; set only by a
  dated local override). Source freshness is separate from independent evidence
  freshness.
- Local overrides are reviewed code in `src/data/recruitment-overrides.ts` with
  author, authored date, provenance URL and verification date. They preserve the
  original record and are empty by default; no editor UI or migration.
- Bounded DFS path search uses a visited set and maximum hops, so cycles cannot
  loop forever.
- Tests: 15 focused deterministic fixtures cover duplicate/invalid IDs and
  references, duplicate pairs, cycles, hop bounds, closed/withdrawn routes, stale
  evidence, missing requirements/observations, ALL/ANY combinations, override
  precedence/provenance and eligibility vs availability. Full suite on Node 24:
  248 files / 6160 tests passed; required CI remains the gate. Contract and source
  coverage: `docs/RECRUITMENT_ROUTES.md`.
- Limitations: free-text ratio/class/upload/seed-size requirements remain unknown;
  117 upstream names are unresolved; source-level `unlockInviteClass` is not
  modeled. No P18 UI, P19 search, deployment or home-server change.

### P02b slices

1. **P02b-1:** policy, production manifest/baseline, checksum validator,
   security-audit update and regression tests. **Done.**
2. **P02b-2:** ledger, dedicated-session runner, advisory lock, fresh baseline,
   managed/no-op, rollback, interruption, connection loss, concurrency and
   disposable-database tests. **Done.**
3. **P02b-3:** verified adoption of existing baseline databases, column-order
   and missing-runtime-index variants, preservation and failure matrices.
   **Done.**
4. **P02b-4:** interruption/concurrency — covered by the P02b-2/P02b-3 suites;
   no separate implementation slice is needed unless new migration types change
   the transaction model.
5. **P02b-5:** entrypoint/Docker cutover and removal of production push.
   **Done; candidate-image Docker matrix passed in PR #1. Published image
   remains untested.**
6. **P02b-6:** backup v2, encrypted lifecycle and authenticated restore.
   **Done in the working tree; contract, authenticated HTTP, rollback and
   ledger-preservation checks pass.**
7. **P02b-7:** Node 24 matrix consolidation, release and rollback docs.
   **Done; documentation only.**

## Dependencies and blockers

- **P02 is the main structural blocker.** P03, P06, P14, P16 and any new persisted goal/notification state should not create schema without a controlled upgrade and backup/restore path.
- **P04 blocks the first daily-use delivery.** P05, P06, P08 and the action portion of P16 depend on a stable action model and keys.
- **P09/P10 now provide the progress foundation.** P11, P17, P18 and P24 must reuse the evaluator and pilot definitions rather than introduce parallel rank logic.
- **P12 blocks the calculator and comparison tasks.** P13 and P20 depend on the pure function, not on the queue.
- **P14 blocks P15 and P19.** P21 depends on search; do not build a direct download action first.
- **P22 blocks P23.** The space candidate task is explicitly optional and must not delete or move data.

## Roadmap and documentation corrections

1. `docs/IMPLEMENTATION_ROADMAP.md` is absent; the plan lives at `docs/TRACKER_TRACKER_KILO_PLAN.md`. Copy or rename it deliberately before the next task.
2. `PRODUCT.md` is stale on the visual world: it still describes the incumbent dark neumorphic interface and says the light theme is undecided. `DESIGN.md` and the current code define the Cold Vault light/dark system. Design-dependent tasks should follow `DESIGN.md`, and `PRODUCT.md` should be reconciled separately.
3. P01 is implemented on `feat/p01-fork-distribution`: the GHCR image is public and verified, and Compose/Quick Start now reference it. The candidate-image Compose Quick Start passed in CI as the pre-merge gate; the published-image fresh-install smoke test is a post-publication gate. Upstream attribution and documentation links were preserved.
4. P06/P07 are not “add a type” tasks: Telegram/ntfy need transport dispatch, encrypted configuration lifecycle, validation and delivery-state handling. The existing type list is only scaffold.
5. P03’s account-vs-per-torrent distinction is partly encoded in `satisfaction.ts`; rename/extend carefully instead of rewriting old registry values.
6. P16 cannot reuse the session-only internal API as-is; it needs a separate token model, scopes and read-only enforcement.
7. P22’s fleet/torrent analytics are not a storage report; distinguish logical size, physical size and unknown recovery.
8. The roadmap file has mojibake Romanian diacritics in the working copy; normalize its encoding when it is moved/renamed.

## Database upgrade risks

P02b-1 through P02b-3, P02b-5 (candidate image) and P02b-6 are implemented and
validated. Published-image smoke testing remains a post-publication gate, not a
pre-merge blocker. The remaining risks are:

1. **The cutover is candidate-validated, not published-validated.** `docker-entrypoint.sh` runs the runner and `db:push` is removed; the PR-head image passed the Docker matrix. The published `latest` image has not been rebuilt; its smoke test and a pre-upgrade dump are post-publication deployment checks, not pre-merge gates.
2. **No schema rollback.** An old image that runs `push --force` is not a safe rollback against a newer schema. Require a pre-upgrade dump and keep the fail-closed unknown/newer-schema behavior.
3. **Encrypted columns are lifecycle-sensitive.** `trackers.encryptedApiToken`, `trackers.encryptedCredentials`, `encryptedMouseholeToken`, proxy/backup/image keys, notification configs and the scheduler key must be re-keyed and restored through every lifecycle site. New encrypted fields must be added to change-password, recovery, backup/restore, nuke and lockdown paths.
4. **v1 keeps no durable history.** New exports are v2 and include delivery state plus both checkpoint tables. v1 restores leave them empty and report `unavailable`; cooldowns reset, tracker checkpoints may be derived from restored snapshots, and torrent history cannot be rebuilt. Future durable tables still require payload, validation, restore and version updates.
5. **Existing installs have unknown baselines.** P02b-3 validates canonical, column-order, missing-runtime-index, drift/rejection and concurrent adoption against the P02a fingerprint while preserving rows, ciphertext and sequence state.
6. **Do not test against the real database.** P02b-2/P02b-3/P02b-5 used the guarded `_p02b` database and `_p02a` template; P02b-6 used the guarded `_e2e` database, all PostgreSQL 18.1. Any future published-image smoke test must retain the same guards.
7. **Node 26 is outside the tested local runtime for jsdom.** The local Node 26 unit suite still has the 24 `localStorage` failures; Node 24 passed 224 files / 5918 tests. Do not treat Node 26 results as migration evidence.
8. **Security-audit policy now allows the reviewed manifest and rejects push.** `db:push` is removed, and the audit fails on `drizzle-kit push` in package scripts, CI, the entrypoint or the Dockerfile.

## Smallest next task

P02b-6 is implemented and reviewable. Contract validation, v2 round trips,
v1 import, restored-credential decryption, rejection paths, injected-failure
rollback, lock coordination and ledger preservation pass through the real
authenticated routes on Node 24 and PostgreSQL 18. The full unit suite, lint,
security audit and production build pass.

The Docker cutover for P02b-5 passed the candidate-image matrix, including
fresh/unmanaged/managed/unknown/concurrent startup and health. That candidate
matrix is the pre-merge gate. Published-image smoke testing is a post-publication
release gate.

P02b-7 is complete as documentation only. The candidate-image Docker matrix and
P02b-5 have passing CI evidence and are the pre-merge gate. Published-image
smoke testing is a post-publication release gate; rebuild it only when
authorized, then run P01's disposable fresh-install smoke test. The PostgreSQL
18 guard is implemented and Docker-verified; P03 was not started.
