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
| P01 | done | P00 | `main @ 0ff13573` (merged; not installed) | GHCR image public; published `linux/amd64` digest `sha256:9548aecb3231f51cdbddf276526244eda54c5bd6c40f5d0d3d9d920b5ff6fdda`; Compose config valid; Quick Start and image reference aligned; upstream attribution kept | Candidate-image Compose smoke passed pre-merge; published-image smoke passed in PR #2 (run 40038697376). No deployment or real-install upgrade. |
| P02 | done | P00, P02a, P02b-0, P02b-1, P02b-2, P02b-3, P02b-5, P02b-6, P02b-7 | `main @ 0ff13573` (merged; not installed) | P02b-1–P02b-3, P02b-6 and P02b-7 validated; P02b-5 removes the production push path and wires the runner into the entrypoint/Dockerfile | Candidate-image and published-image Docker matrices passed, including PostgreSQL 17 rejection. No deployment or real-install upgrade. |
| P02a | done | P00 | branch `feat/p01-fork-distribution` (not deployed) | `docs/DB_MIGRATION_PLAN.md`; frozen 19-table baseline in `e2e/fixtures/db-baseline-v1/`; fingerprint, seed/check/verify and guard scripts; fixture seeded and verified in a disposable `_p02a` database | Restore route was not executed in P02a; interrupted/concurrent runner behavior is now covered by P02b-2. No production startup, schema or data changed. |
| P02b-0 | done | P02a | branch `feat/p01-fork-distribution` (not deployed) | Reviewed ledger, concurrency, fingerprint, security-audit finding and validation gaps; exact SQL and startup sequence added to `DB_MIGRATION_PLAN.md`; owner approvals recorded 2026-10-23 | No implementation in P02b-0; P02b-1 followed. |
| P02b-1 | done | P02b-0 | branch `feat/p01-fork-distribution` (not deployed) | Approved policy; `db/migrations/0000_baseline.sql` (checksum `59b382583d2a70edf5b1b2ca8488408f3eb83582ea4a4eb6aec501f72e0e9815`); `db/migrations/manifest.json`; `scripts/db/migration-manifest.mjs`; narrow security-audit update; 10 regression tests | Backup v2, production cutover and authenticated restore remain P02b-6/P02b-5. No DB mutation, commit, push or deploy. |
| P02b-2 | done | P02b-1 | branch `feat/p01-fork-distribution` (not deployed) | `scripts/db/migrate.mjs`; exact ledger; dedicated-session advisory lock; fresh baseline, managed/no-op, rollback, interruption, connection-loss, concurrent and lock-timeout tests; PostgreSQL 18 guard before ledger/DDL; 13/13 PostgreSQL 18 integration cases on Node 24 | P02b-3 followed. Runner is not wired into startup; backup v2 and cutover remain P02b-6/P02b-5. No real installation touched. |
| P02b-3 | done | P02b-2 | branch `feat/p01-fork-distribution` (not deployed) | `scripts/db/schema-fingerprint.mjs`; production `baseline-fingerprint.json`; canonical/column-order adoption; exact missing-index repair; drift/wrong-index/foreign-ledger rejection; row/ciphertext/sequence preservation; rollback, interruption and concurrent adoption tests; 22/22 PostgreSQL 18 integration cases on Node 24 | No adoption blockers. Backup v2 and cutover remain P02b-6/P02b-5. No real installation touched. |
| P02b-5 | done | P02b-1, P02b-2, P02b-3 (P02b-4 covered) | branch `feat/p01-fork-distribution` (not deployed) | `docker-entrypoint.sh` runs `scripts/db/migrate.mjs`, exits non-zero on failure and forwards TERM/INT; `Dockerfile` runtime copies `db/migrations` and `scripts/db`; `db:push` removed; audit rejects push in package/CI/entrypoint/Dockerfile; 4/4 entrypoint tests, 22/22 PostgreSQL 18 runner tests, 11/11 manifest tests, 5918 unit tests, TypeScript, lint, audit (38/38) and production build pass on Node 24; baseline checksum unchanged; CI run 40036272230 built PR head `02af2eac` and passed fresh, unmanaged P02a adoption, managed restart, unknown/ahead refusal, PostgreSQL 17 rejection, concurrent startup and Compose candidate override | Published image digest `sha256:9548aecb3231f51cdbddf276526244eda54c5bd6c40f5d0d3d9d920b5ff6fdda` passed the post-publication smoke matrix in PR #2 (run 40038697376). No deployment or real-install access. |
| P02b-6 | done | P02b-3 | branch `feat/p01-fork-distribution` (not deployed) | v2 export/validation, v1 import, delivery/checkpoint restore with id/scope remapping, transactional restore + cross-process advisory lock, credential lifecycle verification; 5918 unit tests, 10 authenticated HTTP cases plus setup (PostgreSQL 18), TypeScript, lint, audit (38/38), build | Published-image smoke passed in PR #2 (digest `sha256:9548aecb3231f51cdbddf276526244eda54c5bd6c40f5d0d3d9d920b5ff6fdda`). No production access or deployment. |
| P02b-7 | done | P02b-6 | branch `feat/p01-fork-distribution` (not deployed) | Consolidated Node 24 evidence; `docs/UPGRADE_AND_ROLLBACK.md`; backup v2/v1 limits; upgrade/rollback and Docker-check list; Unreleased release notes | Documentation only. Candidate-image and published-image Docker validation passed; the published image was not deployed or installed. This is not a production-validated release. |
| P03 | pending | P00, P02 for persistence | — | `satisfaction.ts` already separates account ratio from per-torrent rules; no provenance model | Add `requiredAccountRatio`/`requiredTorrentRatio` and source/freshness without rewriting old values |
| P04 | pending | P03 | — | `computeAlerts` and pure `tracker-events` checks exist, but there is no single deterministic action engine with injected `now` | Build action evaluator; reuse existing checks |
| P05 | pending | P04 | — | Alerts banner, login timers and status banners exist; no Next action column/filters | Build compact action surface and filters |
| P06 | pending | P04, P02 | — | Notification types list includes Telegram, but `SUPPORTED_NOTIFICATION_TYPES` is Discord-only; delivery path rejects others | Add Telegram transport, config validation, encrypted lifecycle and tests |
| P07 | pending | P06 transport contract | — | No ntfy transport | Add self-hosted ntfy with strict redirect/network policy |
| P08 | pending | P04 and one new transport | — | No digest or quiet-hours scheduler state | Add digest scheduling/deduplication in the existing scheduler |
| P09 | pending | P03 | — | `rank-ladder.ts` exists; no goals/requirements evaluator | Implement goals engine before UI |
| P10 | pending | P09 | — | Registry has user classes/rank paths, but no pilot goal/requirement definitions with provenance | Select 3–5 accessible trackers; encode only verifiable conditions |
| P11 | pending | P09–P10 | — | Rank progress UI exists; no custom goals or estimates | Add Next rank, Custom goal, missing conditions and estimates |
| P12 | pending | P03 | — | No download/headroom calculator | Implement pure calculator with BigInt precision and unknown handling |
| P13 | pending | P12 | — | No calculator UI or queue integration | Split P13a form and P13b queue |
| P14 | pending | P02–P03 | — | No Prowlarr import | Add preview/test/select/import with explicit credentials |
| P15 | pending | P14 | — | No Jackett import | Reuse P14 preview/import contract |
| P16 | pending | P02, P04; P11 for goals | — | App has session-authenticated internal API routes; no versioned scoped integration API | Add hashed, revocable read-only tokens; no mutations |
| P17 | pending | P09–P10 | — | No recruitment-route dataset/model | Define offline route format with provenance and unknown status |
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

PR #2 (`test/published-image-smoke`) validated that exact artifact, not the
candidate. Run
[40038697376](https://github.com/rednato25/tracker-tracker/actions/runs/40038697376)
pulled by digest, asserted the local `RepoDigest`, and passed fresh
startup/health, baseline ledger, P02a adoption, managed restart, unknown/ahead
refusal, PostgreSQL 17 refusal, concurrent startup and the Compose Quick Start
with the digest as the explicit image.

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
- **P09/P10 block the progress delivery.** P11, P17, P18 and P24 should not duplicate rank logic before the evaluator exists.
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
