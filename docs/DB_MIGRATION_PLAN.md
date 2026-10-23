# Database Migration Plan

Status: P02b-6 implemented and validated in this checkpoint (backup format
v2, v1-compatible import, durable delivery/checkpoint restore and authenticated
HTTP coverage). P02b-7 records the Node 24 evidence, upgrade/rollback procedures
and release notes. P02b-1–P02b-3 are validated. P02b-5 remains
`implemented_validation_blocked` because Docker image/container startup cannot
run while the daemon is unavailable. This checkpoint is committed on the feature branch but undeployed.
Operational upgrade, backup-compatibility and rollback procedures are in
`docs/UPGRADE_AND_ROLLBACK.md`.

Baseline source commit: `e9586d531b66b45ce7e4aa50b498e5c58cc9d76f`
Frozen fixture: `e2e/fixtures/db-baseline-v1/`
Production baseline: `db/migrations/0000_baseline.sql`
Production manifest: `db/migrations/manifest.json`

## Owner approvals — 2026-10-23

These are explicit, recorded approvals. They are not pending questions.

1. Replace the push-only migration policy with the reviewed, versioned
   mechanism documented here.
2. Approve `public.schema_migrations` and the custom runner as the only
   migration ledger. Foreign ledgers fail closed.
3. Notification delivery state and daily checkpoints are durable backup state.
   Adopt backup format v2 with backward-compatible v1 import and explicit
   missing-data handling. Do not restore a source database's migration ledger
   into the destination application.
4. Support PostgreSQL 18 initially, with only the two documented baseline
   variants. Reject other versions and unknown schemas with actionable
   diagnostics.

P02b-1 recorded all four approvals and implemented the manifest/audit
foundation. P02b-2/P02b-3 added the ledger, runner and verified adoption.
P02b-5 implements the production cutover in the working tree; P02b-6 implements
backup v2 and its authenticated restore checks. P02b-7 (release validation/docs)
and the runtime PostgreSQL-version guard still follow.

## 1. Current lifecycle

### Schema and configuration

- `src/lib/db/schema.ts` defines 19 tables: `app_settings`, `trackers`,
  `tracker_snapshots`, `tracker_roles`, `download_clients`,
  `client_uptime_buckets`, `tag_groups`, `tag_group_members`,
  `client_snapshots`, `backup_history`, `dismissed_alerts`,
  `notification_targets`, `notification_delivery_state`,
  `tracker_daily_checkpoints`, `torrent_daily_checkpoints`,
  `db_size_history`, `app_liveness`, `app_coverage_gaps`, `tracker_outages`.
- `drizzle.config.ts` points at `./drizzle`, but **there is no migration
  directory and no migration history** in the repository.
- `src/lib/db/ensure-indexes.ts` creates the runtime covering index
  `idx_snapshots_tracker_polled_covering`, which the Drizzle DSL does not
  express. The frozen fixture includes it explicitly.

### Startup and backfills

1. `docker-entrypoint.sh` waits for Postgres. Before P02b-5 it ran
   `drizzle-kit push --force` against the live database; the working tree now
   runs `node scripts/db/migrate.mjs` and exits non-zero if it fails.
2. The Next.js server starts only after the runner succeeds.
3. `src/instrumentation.ts` runs `backfillRegistrySlugs()` before scheduler
   recovery. It is idempotent, latched per process, and tolerates failure.
4. `src/lib/scheduler.ts` calls `ensureIndexes()` once per process.
5. `src/app/api/dashboard/today/route.ts` performs a one-time
   `backfillTrackerCheckpoints()` on first request, also latched per process.
6. Scheduler recovery starts only after the persisted scheduler key is loaded.

The backfills are repairs of derived data, not schema migrations. They must run
**after** the schema is upgraded and must remain idempotent.

### Backup and restore

`src/lib/backup.ts` exports backup format **version 1**. Its payload contains:

`settings`, `trackers`, `trackerSnapshots`, `trackerRoles`, `downloadClients`,
`tagGroups`, `tagGroupMembers`, `clientSnapshots`, `clientUptimeBuckets`,
`appCoverageGaps`, `trackerOutages`, `dismissedAlerts`,
`notificationTargets`.

Version 2 includes the durable delivery/checkpoint state. It deliberately
excludes:

- `app_liveness`, because it describes the running process;
- `notification_targets.last_delivery_*`, which are transient sender status, not
  delivery history;
- `db_size_history` and `backup_history`, which are local operational history;
- `password_hash`, `failed_login_attempts` and `encrypted_scheduler_key` from
  `app_settings`; the scheduler key is destination-specific and is cleared on
  restore.

`notification_delivery_state`, `tracker_daily_checkpoints` and
`torrent_daily_checkpoints` are restored by v2. A v1 backup did not carry them,
so restore leaves them empty and reports them as `unavailable`; it does not
fabricate delivered history. A tracker-checkpoint backfill may derive values
from restored snapshots, but torrent checkpoint history cannot be reconstructed.

Any new table must be added to `BackupPayload`, `generateBackupPayload`, the
validation function, the restore insert path and the restore response. Any new
**encrypted** column must also be added to the credential lifecycle below.

### Credential lifecycle

Master-key encrypted columns:

| Table | Columns |
|---|---|
| `app_settings` | `totp_secret`, `totp_backup_codes`, `encrypted_proxy_password`, `encrypted_backup_password`, `encrypted_ptpimg_api_key`, `encrypted_oeimg_api_key`, `encrypted_imgbb_api_key` |
| `trackers` | `encrypted_api_token`, `encrypted_credentials`, `encrypted_mousehole_token` |
| `download_clients` | `encrypted_username`, `encrypted_password`, `encrypted_api_key`, `encrypted_url_path` |
| `notification_targets` | `encrypted_config` |

`encrypted_scheduler_key` is different: it is wrapped with the
`SESSION_SECRET` wrapping key, not the master key. `encryption_salt` is reused
verbatim. A new encrypted column must be added to **all** of:

1. master-password change: `src/app/api/auth/change-password/route.ts`;
2. recovery: `scripts/recover.cjs` `MASTER_KEY_TABLES` or
   `MASTER_KEY_SETTINGS_COLUMNS`;
3. lockdown: `src/app/api/settings/lockdown/route.ts`;
4. nuke: `src/lib/nuke.ts`;
5. backup export/restore and `backupCiphertexts()`.

Missing one site means the column is silently orphaned on the next password
change, lockdown or restore.

### Existing test and runtime guards

- `e2e/db.ts` refuses any database name that does not end in `_e2e` and requires
  `POSTGRES_PASSWORD`.
- `playwright.config.ts` owns `tracker_tracker_e2e` and starts the app with a
  disposable database.
- CI uses Node 24. The local Node is 26.8.2. The 24 local unit failures are
  jsdom `localStorage` failures on Node 26, not application regressions; CI is
  green at the baseline commit.
- CI does not run E2E. E2E requires a dedicated database and server.
- `scripts/security-audit.ts` currently treats raw migration files and
  `drizzle-kit generate/migrate` as a **critical** finding. P02b must change
  that policy deliberately when it introduces the approved runner.

## 2. Strategy comparison

| Strategy | Verdict | Reason |
|---|---|---|
| Keep `drizzle-kit push --force` | reject | No history, no rollback, destructive renames, concurrent instances race. |
| Drizzle's built-in `migrate()` alone | viable but insufficient | It tracks `drizzle.__drizzle_migrations` transactionally, but has no baseline adoption for push-managed databases and no startup lock. |
| External migration framework | reject for now | Adds another runtime and does not solve baseline adoption by itself. |
| **Frozen baseline + versioned SQL + explicit ledger + preflight fingerprint + advisory lock** | **selected** | Uses Drizzle Kit only to generate SQL, keeps an auditable ledger, handles push-managed databases without pretending tables prove history, and can fail closed. |

The selected design keeps Drizzle 0.45.4 as the schema source and Drizzle Kit
0.31.11 as the SQL generator. The production startup does **not** use
`drizzle-kit push`.

## 3. Selected migration protocol

### Ledger

The only ledger is `public.schema_migrations`. Do not create or consult
`drizzle.__drizzle_migrations`; if a database has it, it is a foreign ledger and
the runner must fail closed.

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

- **Identity and ordering:** `version` is the primary key and the sort key.
  Versions are zero-padded (`0000_baseline`, `0001_...`) so lexicographic order
  equals migration order. A duplicate version is rejected.
- **Baseline:** `0000_baseline` is recorded for both fresh installs and adopted
  unmanaged databases. The row is inserted only after either the baseline DDL
  succeeds (fresh) or the exact fingerprint passes (adopted). It is never
  inferred from table existence. `baseline = true` is allowed only for
  `0000_baseline`.
- **Checksum:** SHA-256, lowercase hex, of the exact migration file contents as
  shipped, after stripping a UTF-8 BOM and normalizing CRLF to LF. No trimming
  and no comment stripping: any edit changes the checksum. The baseline
  checksum covers one combined `0000_baseline.sql` file containing the frozen
  schema SQL followed by the runtime covering-index SQL, so the applied unit is
  unambiguous. The P02a split fixture files are source material, not separate
  ledger entries.
- **Applied timestamp:** `now()` at the successful ledger insert, in the same
  transaction as the migration. For adoption it is the adoption time, not the
  original release time.
- **Uniqueness:** `version` is unique by primary key. Checksums are not a
  uniqueness key; the same SQL is not expected under two versions, and the
  runner rejects duplicate version tags before applying anything.
- **Edited applied migration:** checksum differs from the ledger -> abort before
  any DDL, report version/expected/actual, leave the database unchanged.
- **Removed applied migration:** ledger has a version that the application
  bundle does not contain -> abort as an unknown applied version.
- **Out-of-order file:** a new file whose version is less than or equal to the
  current maximum, but absent from the ledger, is rejected rather than applied.
- **Database ahead:** a ledger version unknown to the running application, or a
  ledger whose known checksums differ, causes a fail-closed exit. A new image
  must refuse an older schema only when it has no path for it; an older image
  must never be pointed at a newer schema.

### Migration files

- `0000_baseline` is the combined frozen SQL in
  `db/migrations/0000_baseline.sql`, built from the P02a frozen schema plus
  `runtime-indexes.sql` without regenerating from `schema.ts`.
- `db/migrations/manifest.json` is the production manifest; the baseline
  checksum is recorded there.
- Additive migrations are reviewed SQL under `db/migrations/`; Drizzle Kit
  generate may be used to author them, but the generated files and manifest
  entries are committed and reviewed.
- Every migration has a stable version tag and a SHA-256 checksum.
- Statements must be transactional. Do not use `CREATE INDEX CONCURRENTLY`,
  `DROP INDEX CONCURRENTLY`, `VACUUM`, `CREATE DATABASE`, `CREATE TABLESPACE`,
  `REINDEX CONCURRENTLY`, `ALTER TYPE ... ADD VALUE`, or any other
  non-transactional DDL in the normal sequence. The runner scans and rejects
  these tokens unless an explicitly designed, separately locked path is added.

### Case A — completely fresh database

1. Acquire the migration advisory lock.
2. Create the ledger.
3. Apply `0000_baseline` in one transaction.
4. Insert the baseline ledger row and checksum.
5. Apply any later migrations in order.
6. Release the lock.
7. Start the app; run the idempotent backfills.

### Case B — existing database matching the supported baseline, no history

This is the important case for installations created by `push --force`.

1. Acquire the advisory lock.
2. Read the live schema and compute the normalized fingerprint.
3. Compare it with `schema-fingerprint.json`:
   - every expected table/column/index/constraint present;
   - no unexpected application tables or columns;
   - types, nullability and defaults match;
   - column order is ignored;
   - only `public.schema_migrations` is ignored;
   - a foreign `drizzle.__drizzle_migrations` is rejected, not adopted.
4. If it matches exactly, create the ledger if needed, insert
   `0000_baseline` with the frozen checksum, and do **not** run baseline DDL.
5. If it does not match, fail closed with the missing/extra table/column/index
   report. Do not repair, drop or force-convert.

A table existing is never sufficient to mark a migration applied. A matching
fingerprint plus a recorded pre-upgrade backup is the minimum evidence.

Implemented in P02b-3: the production fingerprint is
`db/migrations/baseline-fingerprint.json`; canonical and column-order matches
adopt without baseline DDL. The only accepted repair is the exact baseline
runtime index, created and re-fingerprinted inside the adoption transaction.
Adoption preserves rows, keys, sequence state and ciphertext and never runs
backfills.

### Case C — database already managed by the migration system

1. Acquire the advisory lock.
2. Verify every recorded ledger version/checksum is known.
3. If the database has a version newer than this image knows, fail closed.
4. Apply pending migrations in order, each in its own transaction with its
   ledger row.
5. Release the lock.

### Case D — unknown or partially matching schema

Fail closed before any DDL. Emit the fingerprint difference, the database name,
the server address and the app version. Do not run `push`, do not drop tables,
do not mark the baseline, and do not continue to the application. The operator
must restore a backup or provide a reviewed migration path.

### Case E — interrupted migration and concurrent startup

- Wrap the whole run in `pg_advisory_lock` using a fixed key derived from
  `tracker-tracker:migrations`.
- Each migration and its ledger insert share one PostgreSQL transaction.
  PostgreSQL rolls back transactional DDL on failure.
- If the process dies, the lock is released by the connection and the ledger
  remains at the last complete version. Restart retries the pending migration.
- A second instance waits for the lock instead of applying the same SQL.
- If a migration cannot be transactional, it is a separate reviewed operation
  with its own lock and completion marker.

### Why a custom ledger instead of Drizzle's migrator

The installed Drizzle migrator was inspected. It creates
`drizzle.__drizzle_migrations (id, hash, created_at)`, reads only the latest
row, applies files whose `folderMillis` is newer, and inserts the hash and
timestamp. It does **not**:

- adopt a baseline created by `push --force` without executing baseline DDL;
- verify the checksums of all applied migrations;
- detect a database whose ledger is ahead of the running image;
- acquire an advisory lock for concurrent startup;
- provide a baseline/adoption marker or an app-version record;
- reject a foreign ledger.

Those are explicit P02b requirements. We therefore use Drizzle Kit only to
generate SQL and keep a separate, small, auditable `public.schema_migrations`
ledger. The runner does not call `drizzle-orm`'s `migrate()`, and it must not
create `drizzle.__drizzle_migrations`. If that table already exists, it is a
foreign system and the run fails closed.

### Exact startup and transaction sequence

The migration runner is a separate process/session started by the entrypoint
before `node server.js`. It does not use the application `db` proxy.

1. **Wait for TCP/database readiness** (existing entrypoint behavior).
2. **Open one dedicated session:** `postgres(DATABASE_URL, { max: 1,
   idle_timeout: 0, connect_timeout: 10 })`, with an application name.
   Keep this exact connection until unlock/close. A pool with more than one
   session, or a transaction that returns its connection to a pool, invalidates
   session-level advisory-lock guarantees.
3. **Acquire the advisory lock before any schema decision** using a fixed key
   (`pg_try_advisory_lock` in a bounded retry loop). On timeout, query
   `pg_locks`/`pg_stat_activity`, report the holder pid/application name, the
   database and the lock key, then exit non-zero. Do not proceed unlocked.
4. **Identify the ledgers and database:** `current_database()`,
   `current_user`, server address, app version. If `drizzle.__drizzle_migrations`
   or any unknown ledger exists, fail closed.
5. **Read our ledger** if present. Validate known versions and checksums before
   applying anything.
6. **Choose one deterministic path:**
   - no application tables and no ledger: fresh path;
   - no ledger but schema matches the frozen baseline: adoption path;
   - ledger present: managed path;
   - anything else: fail closed with a fingerprint difference.
7. **Apply each migration in its own transaction.** Execute all statements, then
   insert the `schema_migrations` row with checksum, `app_version` and
   `now()`, then commit. If any statement or the ledger insert fails, roll back
   the whole transaction; the migration is not recorded. Never mark a migration
   successful outside the transaction.
8. **Adoption transaction:** create the ledger if needed, insert
   `0000_baseline` with the frozen checksum and `baseline = true`, commit. No
   baseline DDL is executed in this path.
9. **Release the advisory lock** in a `finally` block, then close the dedicated
   session. If the process is killed, PostgreSQL releases the session lock when
   the connection closes.
10. **Start the application only after exit code 0.** Then run the existing
    backfills in their documented order; they are not inside a migration
    transaction.
11. **Reject non-transactional SQL** by scanning each file for the denylisted
    statements. A special path for such SQL is out of scope for P02b.

### Smallest implementation proposal (P02b-1/P02b-2, built)

The implementation remains separate from the application:

```
db/migrations/0000_baseline.sql       # frozen baseline + runtime indexes
db/migrations/manifest.json           # version/file/sha256 allowlist
scripts/db/migration-manifest.mjs     # shared validation and audit logic
scripts/db/migration-manifest.d.mts   # type surface for the audit/tests
scripts/db/migrate.mjs                # dedicated-session runner, no @/lib/db import
e2e/p02b/                             # guarded PostgreSQL 18 integration tests
```

- P02b-2 does not change production startup or `push --force`.
- The runner opens its own `postgres(DATABASE_URL, { max: 1, idle_timeout: 0 })`
  reserved session. It does not import `src/lib/db` or use the app pool.
- Manifest shape:

```json
{
  "format": 1,
  "baseline": "0000_baseline",
  "migrations": [
    {
      "version": "0000_baseline",
      "file": "0000_baseline.sql",
      "sha256": "<lowercase sha-256 of normalized file>"
    }
  ]
}
```

- Checksum implementation:

```js
const text = readFileSync(file, "utf8")
  .replace(/^\uFEFF/, "")
  .replace(/\r\n?/g, "\n")
const checksum = createHash("sha256").update(text, "utf8").digest("hex")
```

- Lock acquisition uses the two-key form on the dedicated session:
  `pg_try_advisory_lock(hashtext('tracker-tracker:schema-migrations-v1'), 1)`
  in a bounded loop. The timeout diagnostic reads `pg_locks` and
  `pg_stat_activity` for the same advisory key and reports holder pid and
  application name, never credentials.
- The runner prints machine-readable outcome lines: path chosen, versions
  applied, fingerprint result and a sanitized failure detail. It exits non-zero
  before the app starts on any uncertainty.
- The Docker runtime stage copies `db/migrations` and `scripts/db`; the
  entrypoint replaces the push block with `node scripts/db/migrate.mjs` only
  after P02b tests pass.

### Interruption outcomes

- **Before baseline adoption:** no ledger row and no baseline DDL. The next
  start re-runs fingerprint/adoption; the lock is released on disconnect.
- **During a migration:** the transaction rolls back, including the ledger
  insert. The next start retries the same pending migration.
- **After commit, before application startup:** the schema and ledger are
  committed and consistent. A restart sees the migration applied and does not
  re-run it; the app may have been unavailable for that boot, so the
  orchestrator retries it.
- **During adoption commit:** the transaction either commits both the ledger row
  and no DDL, or rolls back; there is no half-adopted state.
- **Concurrent startup:** the first session holds the advisory lock; the second
  waits, then re-reads the ledger and applies nothing. The final ledger contains
  one row per version.

## 4. Startup backfills and migrations

Ordering is fixed:

1. migration runner;
2. application server;
3. `backfillRegistrySlugs()`;
4. `ensureIndexes()` (or its migration-managed equivalent);
5. first-request checkpoint backfill;
6. scheduler recovery.

Backfills must be idempotent, must not assume a column added by a later
migration is absent, and must not be recorded as migrations. A failed backfill
may degrade history but must not roll back a completed schema migration.

### Fingerprint policy and known variants

The P02a fingerprint helper currently ignores both `__drizzle_migrations` and
`schema_migrations`. P02b must narrow that to **only** `public.schema_migrations`;
a foreign Drizzle ledger is a fail-closed condition, not a known variant.

- **Ledger:** ignored by name, never by broad schema exclusion.
- **Runtime indexes:** the covering index is part of `0000_baseline`. The
  fingerprint includes it. Any future runtime index must be owned by a
  migration, or `ensureIndexes()` must become a verification/no-op; otherwise an
  index created outside the ledger can make the next adoption check drift.
- **Backfills:** not part of the schema fingerprint. They operate on data after
  the migration commits, are idempotent, and must be safe when a column added by
  a migration is present.
- **PostgreSQL-generated output:** normalize whitespace and keyword case in
  index/constraint definitions; compare column type via `data_type`/`udt_name`,
  nullability and normalized default expressions. The frozen fingerprint was
  produced on PostgreSQL 18 (the Compose baseline). An unsupported major
  version must fail with a clear diagnostic rather than silently loosening the
  match.
- **Known historical variants:** column order is ignored. A database that is
  otherwise an exact baseline match but lacks the runtime covering index may
  apply `runtime-indexes.sql` as a reviewed repair, then re-fingerprint before
  recording baseline. Extra indexes/tables/columns, missing columns or changed
  constraints are **not** accepted as arbitrary drift; they require a reviewed
  migration or restore path.
- **Unknown schema:** fail closed before DDL/backfill and print missing/extra
  tables, columns and indexes, plus database, server address, app version and
  expected/actual fingerprint. No auto-repair.

Fresh, unmanaged-baseline and managed databases therefore follow three distinct
paths:

1. **Fresh:** no tables/ledger -> apply baseline DDL -> record baseline.
2. **Unmanaged baseline:** no ledger, exact fingerprint -> record baseline only;
   the allowed runtime-index repair is the sole DDL exception.
3. **Managed:** ledger present -> validate known checksums -> apply pending
   versions transactionally. The baseline fingerprint is not re-run.

## 5. Removing production `push --force` in P02b

Exactly one mechanism is active in the P02b-5 working tree:

- `docker-entrypoint.sh` calls `node /app/scripts/db/migrate.mjs` before
  `node server.js` and never falls back to push, force or reset.
- The Dockerfile removes the `schema-deps`/`drizzle-kit` production stage,
  copies `db/migrations` (baseline SQL, manifest, fingerprint) and
  `scripts/db`, and keeps `node_modules/postgres` for the runner.
- `drizzle-kit generate` remains a development/CI authoring tool; the
  `db:push` script is removed.
- P02b-1 updated `scripts/security-audit.ts` for the manifest; P02b-5 adds
  rejection of `drizzle-kit push` in package scripts, CI, the entrypoint and
  the Dockerfile, plus the required-runner check.
- The image has not been built and the container startup paths have not been
  validated; this remains open until a Docker host is available.

## 6. Rollback compatibility

Schema rollback and image rollback are not the same thing.

- An old image that still runs `push --force` is **not** a safe rollback against
  a newer schema. It can drop or rewrite columns that the new image added.
- Rolling the image back is safe only when the schema remains backward
  compatible and the old image does not run the push path.
- After any schema-changing P02b migration, restoring the pre-upgrade database
  dump is the supported rollback.
- The runner must refuse a database with a ledger version newer than the image
  understands rather than attempting a downgrade.
- Release notes must state the required pre-upgrade dump and the compatible
  image range.

## 7. Backup/restore implications

Owner decision: **notification delivery state and daily checkpoints are durable
backup state.** Backup format **v2** is required, with backward-compatible v1
import and explicit handling of missing data. The source database's migration
ledger must never be restored into the destination application's database.

P02b-6 implements this in the working tree.

- New exports are `manifest.version: 2`. The payload has explicit
  `notificationDeliveryState`, `trackerDailyCheckpoints` and
  `torrentDailyCheckpoints` arrays; v2 requires them even when empty.
- v1 remains importable. It must omit the v2 arrays (a v1 manifest carrying them
  is rejected). Missing v1 history is reported as `unavailable` and the
  destination tables are left empty; cooldowns restart from the restore point
  and no delivery is claimed to have happened after the backup.
- Validation is complete before the delete transaction: unsupported versions,
  missing v2 arrays, malformed rows, duplicate keys, count mismatches and
  broken references are rejected before any mutation.
- Restore runs in one transaction, remaps tracker/client/target ids (including
  notification `scope`, delivery state and checkpoints), and takes a
  cross-process advisory lock. Background poll, client and backup cycles hold
  the shared lock and skip while a restore is active.
- `public.schema_migrations` is never exported, deleted or written by backup
  content. Restore preserves the destination ledger exactly.
- New encrypted fields must use the full credential lifecycle and be present in
  `backupCiphertexts()`; restored ciphertexts are verified by decrypting with
  the destination master key in the authenticated integration suite.

## 8. P02b implementation checklist

1. ~~Approve this strategy and the `schema_migrations` ledger shape.~~ Done
   2026-10-23.
2. Update `scripts/security-audit.ts` policy for the approved manifest and
   files. Done in P02b-1; production-push rejection added in P02b-5.
3. Add the frozen baseline and manifest to the production image. Done in
   P02b-5 (Dockerfile copies); static inspection only, no image build yet.
4. Implement the preflight fingerprint, advisory lock, transactional runner,
   ledger, checksum checks and fail-closed diagnostics. Done in P02b-2/P02b-3.
5. Add baseline adoption for the exact P02a fingerprint, with no DDL and no
   marking based on table existence. Done in P02b-3, including the approved
   missing-runtime-index repair and column-order normalization.
6. Replace the entrypoint push step and remove the runtime schema-sync stage.
   Done in the P02b-5 working tree.
7. Add integration tests for fresh, baseline-existing, managed, unknown,
   interrupted and concurrent cases using the fixture pattern. Done in
   P02b-2/P02b-3; entrypoint control-flow tests added in P02b-5.
8. Update backup/restore versioning and the encrypted-field lifecycle for every
   schema addition. P02b-6.
9. Document image/schema rollback and require a pre-upgrade database dump.
   Done; image rollback still requires the container smoke test.
10. Update `IMPLEMENTATION_STATUS.md` only after the gate passes. P02b-5 is
    recorded as `implemented_validation_blocked`.

## 8a. Security-audit finding review

- **Rule:** `no-raw-migrations`.
- **Function:** `checkNoRawMigrations()` in `scripts/security-audit.ts` (around
  line 1027); registered in the audit list around line 2534.
- **Severity:** critical.
- **Triggers after P02b-1:**
  - unmanifested `.sql` files in `db/migrations/`;
  - any `.sql` file under `src/lib/db/migrations/` or the root `drizzle/`;
  - missing/invalid manifest, duplicate or out-of-order versions, missing file,
    checksum mismatch, path escape, or unlisted SQL;
  - any `package.json` script or CI workflow containing `drizzle-kit generate`
    or `drizzle-kit migrate`.
- **Security property:** production schema changes must come from a reviewed,
  versioned, checksum-verified manifest; unreviewed SQL, path escapes and dual
  migration mechanisms are critical supply-chain/schema-integrity risks.
- **Classification:** **C — explicit policy restriction, approved by the owner
  on 2026-10-23.** The detector update is **B — narrowly scoped** and is
  implemented in P02b-1.

Implemented in P02b-1:

1. The check remains critical.
2. `scripts/db/migration-manifest.mjs` validates the manifest, versions,
   ordering, paths, missing files, checksums and unlisted SQL.
3. `checkNoRawMigrations()` delegates to that validator and rejects
   `drizzle-kit generate/migrate/push` in package scripts and CI.
4. P02b-5 removed `db:push` and added entrypoint/Dockerfile checks: the
   entrypoint must call `scripts/db/migrate.mjs` and must not contain
   `drizzle-kit push`.

Still deferred:

- A `drizzle-kit generate` authoring exception is not added; generation remains
  unauthorized until a later narrow allowance is proposed and reviewed.

**Regression cases covered by P02b-1 tests:**

- approved manifest passes;
- duplicate and out-of-order versions fail;
- missing file and checksum mismatch fail;
- traversal/absolute paths fail;
- unlisted SQL in the managed directory fails;
- SQL in `src/lib/db/migrations` or `drizzle/` fails;
- unauthorized `drizzle-kit generate/migrate/push` in package scripts/CI fails;
- an entrypoint containing `drizzle-kit push` fails;
- an entrypoint that does not call `scripts/db/migrate.mjs` fails;
- a Dockerfile containing `drizzle-kit push` fails.

No `security-audit-ignore`, severity reduction, blanket directory exemption or
global finding acceptance is used.

## 8b. Validation matrix for P02b

| Case | Expected result | Node/runtime |
|---|---|---|
| Fresh database | Baseline DDL runs, `0000_baseline` ledger row, app starts, synthetic counts intact | Node 24 |
| Frozen unmanaged baseline | No baseline DDL, fingerprint passes, ledger row added, synthetic rows/ciphertext preserved | Node 24 |
| Managed database with pending migration | Pending SQL and ledger row commit atomically; no-op on repeat | Node 24 |
| Repeat startup, no changes | No DDL, no duplicate ledger rows, no backfill duplication | Node 24 |
| Unknown schema | Non-zero exit before DDL/backfill; actionable diff; schema/ledger unchanged | Node 24 |
| Applied checksum mismatch | Non-zero exit before DDL; ledger unchanged; report version and checksum | Node 24 |
| Database ahead of app | Non-zero exit; no downgrade; report unknown ledger version | Node 24 |
| Interrupted migration | Transaction rollback; no ledger row; lock released; retry succeeds | Node 24 |
| Concurrent startup | Advisory lock serializes; one ledger row; second process waits then no-ops | Node 24 |
| Synthetic record/ciphertext preservation | All fixture rows and decryptable values survive adoption/migration | Node 24 |
| v2 export -> restore -> export | Normalized application data and durable history survive; ledger unchanged | Node 24 + PostgreSQL 18; 10/10 cases plus setup passed in P02b-6 |
| v1 import | Accepted without v2 arrays; history reported `unavailable`; no fabricated rows | Node 24 + PostgreSQL 18; passed |
| v2 delivery/checkpoint preservation | Cooldowns and both checkpoint tables restored with remapped ids | Node 24 + PostgreSQL 18; passed |
| Restored credential usability | tracker/client/notification ciphertext decrypts with the destination key | Node 24 + PostgreSQL 18; passed |
| Wrong password / corrupt ciphertext / invalid relationships / unsupported version | Rejected before mutation; data and ledger unchanged | Node 24 + PostgreSQL 18; passed |
| Injected insert failure | Whole transaction rolls back; no partial replacement | Node 24 + PostgreSQL 18; passed |
| Restore/background coordination | Restore waits and returns 503 while a background lock is held; guard skips during restore | Node 24 + PostgreSQL 18; passed |
| Unauthenticated restore | 401 | Node 24 + PostgreSQL 18; passed |
| Entrypoint success/failure/termination | Migration runs before the app; failure or TERM/INT prevents startup; no push fallback or orphan | Node 24 + POSIX sh/WSL; 4/4 passed in P02b-5 |
| Candidate image startup | Fresh, unmanaged, managed/restart, unknown and concurrent containers; app health after migration | Docker host; **blocked — daemon unavailable** |

Test harness: a Node-environment suite under `e2e/p02b/` (not the jsdom Vitest
project) using the P02a safety pattern with a distinct `_p02b` suffix, marker
comment and explicit `P02B_DATABASE_URL`. The entrypoint suite is stub-based
and proves shell control flow only. The authenticated restore case belongs in
the Playwright app flow, using a disposable database and the normal
login/backup/restore endpoints. The runner tests do not need the browser.

The local Node 26 failure set (`localStorage` undefined in jsdom) stays separate.
Do not suppress assertions or change unrelated app code. CI and integration
tests must run on Node 24; local Node 26 unit failures remain documented as an
environment issue.

## 8c. Findings ranked by severity

**Critical / blocking**

1. ~~`no-raw-migrations` policy forbids the selected mechanism and requires an
   explicit owner decision.~~ Approved 2026-10-23; manifest/audit foundation is
   implemented in P02b-1.
2. ~~Production still runs `drizzle-kit push --force`; runner and push must
   never coexist.~~ P02b-5 removes `db:push`, switches the entrypoint to the
   runner and rejects push in the audit. The image/container validation is
   still open (`implemented_validation_blocked`).
3. ~~There is no checksum-verifying ledger; edited/removed applied migrations
   and a database ahead of the app are undetectable today.~~ P02b-2 implements
   the ledger, checksum validation, edited-removal and ahead-of-app rejection.
4. The P02a fingerprint helper ignores `__drizzle_migrations`; P02b must ignore
   only `schema_migrations` and reject foreign ledgers.

**High**

5. ~~Advisory locking must use one dedicated database session (`max: 1`), not
   the application pool; Drizzle's migrator has no lock.~~ P02b-2 implements a
   reserved session, lock-before-decision, bounded timeout and connection-loss
   guard with tests.
6. ~~Backup format 1 omits durable-looking state (`notification_delivery_state`,
   daily checkpoints); restore deletes delivery state but does not restore it.~~
   P02b-6 adds format v2 for delivery state and both checkpoint tables, with v1
   import explicitly reporting missing history. `db_size_history`,
   `backup_history` and `app_liveness` remain local runtime history, not
   portable backup data.
7. New encrypted columns have a five-site lifecycle; missing one silently
   orphans data.
8. `ensureIndexes()` creates schema outside the ledger; it must become
   migration-owned or verification-only.
9. ~~Non-transactional SQL must be rejected, not silently run.~~ P02b-2 rejects
   transaction-control and non-transactional SQL, with a regression test.
10. Backup JSON validation is not restore verification.

**Medium**

11. Fingerprint output depends on PostgreSQL version and generated names; define
    normalization and supported-major policy.
12. Known historical variants need a narrow allowlist; only column order and the
    missing runtime covering-index repair are proposed.
13. Backfills must run after migration and remain idempotent; checkpoint
    backfills are derived state.
14. P01 and P02b-5 Docker smoke tests are still blocked by the unavailable
    daemon; no fresh-install or candidate-image startup evidence.

**Low / documentation**

15. `PRODUCT.md` visual-world mismatch is a separate documentation follow-up;
    do not redesign the product in P02b.
16. `SECURITY.md` check numbering/count is stale relative to
    `security-audit.ts` and should be updated when policy changes.

## 8d. P02b implementation slices

1. **P02b-1 — policy and manifest:** done. Owner approvals recorded; production
   baseline/manifest, checksum validator, security-audit update and tests added.
2. **P02b-2 — ledger and fresh path:** done. Runner, exact ledger, dedicated
   session/advisory lock, fresh baseline, managed/no-op, rollback, interruption,
   connection-loss and concurrency tests added.
3. **P02b-3 — adoption and managed paths:** done. Verified canonical,
   column-order and missing-runtime-index adoption; data/ciphertext/sequence
   preservation; rejection of drift, wrong indexes, foreign ledgers and
   partial states; rollback/interruption/concurrent adoption tests.
4. **P02b-4 — interruption and concurrency:** covered by the P02b-2/P02b-3
   suites (failure injection, rollback, connection loss, lock timeout/holder
   diagnostics, two-process tests). No separate implementation is needed unless
   future migration types change the transaction model.
5. **P02b-5 — cutover:** implemented in the working tree. Entrypoint push
   replaced by the runner, Dockerfile stages updated, `db:push` removed and the
   audit tightened. Node 24 unit/entrypoint/integration/build checks pass.
   Image build and container smoke tests are blocked by the unavailable Docker
   daemon.
6. **P02b-6 — backup and crypto:** implemented in the working tree. v2
   export/validation, v1 import, durable delivery/checkpoint restore, id/scope
   remapping, advisory-lock coordination, and authenticated HTTP round-trip,
   credential, rejection, rollback and ledger-preservation tests.
7. **P02b-7 - validation/docs:** done as documentation only. The Node 24
   evidence is consolidated in `docs/IMPLEMENTATION_STATUS.md`, and
   `docs/UPGRADE_AND_ROLLBACK.md` records upgrade, backup v2/v1 compatibility,
   rollback limits, and the open Docker checks. Release notes are under
   `[Unreleased]` in `CHANGELOG.md`.

## 8e. Owner decisions — approved

All four owner decisions were explicitly approved on 2026-10-23 and are recorded
at the top of this document. No further policy approval is required.

1. Replace the push-only migration policy with the reviewed mechanism. **Approved.**
2. Use `public.schema_migrations` and the custom runner as the only ledger;
   foreign ledgers fail closed. **Approved.**
3. Treat notification delivery state and daily checkpoints as durable backup
   state; adopt backup v2 with v1 import and no source-ledger restore. **Approved.**
4. Support PostgreSQL 18 with only the two documented baseline variants;
   reject other versions and unknown schemas. **Approved.**

Node 24 is already the CI runtime; no separate approval is needed.

## 9. Fixture and verification commands

See `e2e/fixtures/db-baseline-v1/README.md`. The fixture is deliberately
independent of future `schema.ts` changes; regenerate the fingerprint only from
the frozen baseline, never from a later schema.

## 10. Review summary and decisions

**Summary:** the selected design is a frozen baseline plus a single
`public.schema_migrations` ledger, SHA-256 checksums, a dedicated-session
advisory lock, transactional migrations with atomic ledger inserts, strict
fingerprint adoption for unmanaged baseline databases, and fail-closed handling
for unknown, edited, removed, interrupted or ahead-of-app schemas. Drizzle Kit
generates SQL; production `push --force` is removed in P02b.

P02b-1 implements the approved policy, production baseline/manifest, checksum
validator and narrow security-audit update. P02b-2 implements the dedicated
runner, exact ledger, fresh/managed/no-op paths, rollback, connection-loss and
concurrency handling. P02b-3 implements verified adoption of the canonical
unmanaged baseline, the column-order variant and the approved
missing-runtime-index repair, with data/ciphertext/sequence preservation and
failure/interruption/concurrent tests. P02b-5 removes `db:push`, switches the
entrypoint to the runner, packages the runner assets in the runtime stage and
tightens the audit; its Node 24 entrypoint, unit, integration and build checks
pass. Docker image/container startup validation is blocked because the daemon is
unavailable, so P02b-5 is `implemented_validation_blocked`. P02b-6 passes
5918 unit tests, its contract suites, authenticated HTTP export/restore tests
on PostgreSQL 18 and Node 24, TypeScript, lint, the security audit and the
production build; the destination migration ledger is preserved on success and
failure.

All four owner decisions are recorded and approved; no further policy approval
is required. Node 24 is already the CI runtime. P02b-7 is complete as
documentation only. The next bounded task is the **Docker validation matrix on
a host with a working daemon**, which also closes the P01 fresh-install smoke
test; P02b-5 remains `implemented_validation_blocked` until then. The runtime
PostgreSQL-version guard and P03 were not started.
