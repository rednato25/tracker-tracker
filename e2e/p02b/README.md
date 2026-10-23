# P02b migration runner tests

These tests run the real `scripts/db/migrate.mjs` runner against guarded,
disposable PostgreSQL 18 databases. They do not use the application database and
do not add synthetic migrations to `db/migrations/`.

## Prepare the databases

Create and mark both disposable databases:

```sql
CREATE DATABASE tracker_tracker_p02a;
COMMENT ON DATABASE tracker_tracker_p02a IS 'tracker-tracker-p02a-disposable';
CREATE DATABASE tracker_tracker_p02b;
COMMENT ON DATABASE tracker_tracker_p02b IS 'tracker-tracker-p02b-disposable';
```

Seed the P02a template with the frozen fixture. It must contain no migration
ledger:

```bash
P02A_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/tracker_tracker_p02a \
P02A_ALLOW_DESTRUCTIVE=1 \
pnpm exec tsx e2e/fixtures/db-baseline-v1/seed.ts
```

The test guards verify the effective database, loopback address, PostgreSQL
major 18, marker comments and the `_p02a`/`_p02b` suffixes. The P02a template is
cloned read-only for unmanaged adoption cases.

## Run with Node 24

```bash
P02B_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/tracker_tracker_p02b \
P02A_TEMPLATE_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/tracker_tracker_p02a \
P02B_ALLOW_DESTRUCTIVE=1 \
node --test e2e/p02b/runner.test.mjs
```

Tests reset the `public`/`drizzle` schemas or clone the seeded template between
cases. The suite has **22 integration cases**: fresh initialization and baseline
verification, managed/no-op, canonical/column-order/missing-runtime-index
adoption, data/ciphertext/sequence preservation, drift and wrong-index rejection,
foreign ledgers, checksum/ahead failures, unsupported SQL, rollback/retry,
adoption interruption, process termination, dedicated-session termination,
concurrency, lock release and bounded lock timeout.

The runner itself never uses `DATABASE_URL` from a real installation during
these tests; the harness maps `P02B_DATABASE_URL` to it only for the child
process.

## Entrypoint control-flow tests

```bash
node --test e2e/p02b/entrypoint.test.mjs
```

Four stub-based tests prove that the entrypoint runs the migration before the
application, exits non-zero when migration fails, contains no push/reset
fallback, and does not start the application when terminated during migration.
The TERM test forwards the fixture `DATABASE_URL`/`SESSION_SECRET` into WSL,
waits for the migration marker before signalling, and checks that the migration
child exits (no orphan). On Windows it needs WSL and a POSIX `sh`; it skips when
WSL is unavailable.

These are shell control-flow tests only. They are not Docker or real-application
validation; candidate-image startup and health checks remain blocked while the
Docker daemon is unavailable.
