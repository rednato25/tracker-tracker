# P02a database baseline fixture

This directory freezes the supported database schema as it existed at
`e9586d53` (`fix(ui): sync tracker writes into the shared cache`). It is a
migration fixture, not application code.

The schema files are a snapshot:

- `schema/0000_baseline.sql` — generated from `src/lib/db/schema.ts` at the
  source commit above, then frozen.
- `schema/meta/` — the Drizzle journal/snapshot for that baseline.
- `runtime-indexes.sql` — the covering index created at runtime by
  `src/lib/db/ensure-indexes.ts`, which Drizzle's schema DSL cannot express.
- `schema-fingerprint.json` — canonical tables, columns, indexes and
  constraints; generated from the disposable fixture, not from later
  `schema.ts` changes.
- `constants.ts` — fixed synthetic master password/salt/session secret and the
  database marker.
- `seed.ts` — destructive setup of a designated disposable database.
- `check-baseline.ts` — exact schema guard plus an unknown-schema self-test.
- `verify.ts` — read-only row, crypto, integrity and backup checks.

## Safety

Every command requires `P02A_DATABASE_URL` explicitly; it never falls back to
`DATABASE_URL`. The database name must end in `_p02a`, the effective
`current_database()` must match, remote hosts are refused unless explicitly
allowed, `NODE_ENV=production` is refused, and `seed.ts` additionally requires
`P02A_ALLOW_DESTRUCTIVE=1` and the P02a marker comment. A production database
with a lookalike name is still rejected because it lacks the marker.

Create the database yourself first, for example:

```bash
createdb tracker_tracker_p02a
```

## Recreate and verify

```bash
P02A_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/tracker_tracker_p02a \
P02A_ALLOW_DESTRUCTIVE=1 \
pnpm exec tsx e2e/fixtures/db-baseline-v1/seed.ts

P02A_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/tracker_tracker_p02a \
pnpm exec tsx e2e/fixtures/db-baseline-v1/check-baseline.ts --write

P02A_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/tracker_tracker_p02a \
pnpm exec tsx e2e/fixtures/db-baseline-v1/check-baseline.ts --self-test-unknown

P02A_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/tracker_tracker_p02a \
pnpm exec tsx e2e/fixtures/db-baseline-v1/verify.ts
```

`--write` is only for regenerating the expected fingerprint from a freshly
seeded fixture at the frozen baseline. Do not run it against a future schema
and call the result a baseline.

## What this fixture does not prove

- It does not run the authenticated restore HTTP route.
- It does not replace a real pre-upgrade database dump.
- It does not validate an interrupted migration or concurrent startup; those
  are P02b behaviors described in `docs/DB_MIGRATION_PLAN.md`.
