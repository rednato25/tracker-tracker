# Upgrade and Rollback

This document covers the reviewed migration runner, backup format v2 and the
rollback limits for this fork. It is not a production-validation record: the
Docker image and container startup paths are still open (see the end of this
page).

## Before upgrading

1. **Take a database dump.** The migration runner is forward-only. An image
   rollback does not reverse schema changes, so the dump is the supported
   rollback for the database.
2. **Export an application backup.** New exports use format v2. Keep a copy of
   the last v1 export if you may need to run an older image.
3. **Record the running image.** Note the digest or `sha-<commit>` tag so the
   previous image can be pinned without guessing.
4. Read `docs/IMPLEMENTATION_STATUS.md`; it records what has actually been
   tested and what is blocked.

```bash
# Example: keep the dump outside the container volume.
docker compose exec -T db pg_dump -U tracker_tracker tracker_tracker > pre-upgrade.sql
```

## Upgrade

1. Update the image reference in `docker-compose.yml` (or pin the new digest).
2. Pull and recreate:

   ```bash
   docker compose pull
   docker compose up -d
   ```

3. `docker-entrypoint.sh` waits for PostgreSQL, applies the manifest-listed
   migrations from `db/migrations/` with `scripts/db/migrate.mjs`, and starts the
   server only if the runner succeeds. A failure exits non-zero; check
   `docker compose logs tracker-tracker-app`.
4. Verify `/api/health`, the application version and the startup logs.
5. The destination migration ledger (`schema_migrations`) is owned by the
   destination. It is not exported and restore never rewrites it.

PostgreSQL 18 is the tested and required major version; the runner reads
`server_version_num` and rejects 17.x or 19+ before ledger creation, DDL or
application startup. Unknown, drifted or newer schemas
fail closed; do not work around that by running `drizzle-kit push`.

## Backup format compatibility

| File | Import into this release | Notes |
| --- | --- | --- |
| v2 JSON/`.ttbak` | Yes | Includes notification delivery state and both daily checkpoint tables. |
| v1 JSON/`.ttbak` | Yes | Missing delivery/checkpoint history is reported as `unavailable`; no rows are invented. |
| v2 into a pre-v2 app | No | Older validators reject manifest version 2. |
| Source `schema_migrations` ledger | Never | Ledger rows are not application data and are never imported. |

A v1 restore leaves notification cooldowns and checkpoint history empty.
Cooldowns restart at the restore point, so a notification suppressed before the
backup may fire once. Restoring an older backup cannot prove what was delivered
after it was taken; exactly-once delivery across restore is not claimed. Tracker
checkpoints may be derived from restored snapshots by the existing backfill;
torrent checkpoint history cannot be reconstructed.

The scheduler key is destination-specific and is not restored. Polling resumes
after the restore, but surviving a process restart requires the next login.

## Rollback

### If no migration was applied

Pin the previous image digest or `sha-<commit>` tag, then:

```bash
docker compose pull
docker compose up -d
```

This is an application-code rollback only.

### If a migration was applied

Do **not** start an older image that runs `drizzle-kit push --force` against the
newer schema. It can drop or rewrite data. Use the pre-upgrade dump:

1. Stop the application.
2. Restore `pre-upgrade.sql` into the same PostgreSQL instance.
3. Pin the previous image.
4. Start the app and verify `/api/health`.

Restoring an application backup v2 into an older app is not supported; use a
pre-upgrade v1 backup or the dump.

## Validation status

The PR-head candidate image passed the pre-merge Docker gate in CI
([run 40036272230](https://github.com/rednato25/tracker-tracker/actions/runs/40036272230)):
fresh startup and health, older unmanaged P02a adoption, managed restart/no-op,
unknown and ahead schema refusal, PostgreSQL 17 refusal, concurrent startup,
and a Compose Quick Start with an explicit candidate-image override. The
published `latest` image was not used.

**Candidate-image validation was the pre-merge gate.** The published image was
built from merged main `0ff13573` at digest
`sha256:9548aecb3231f51cdbddf276526244eda54c5bd6c40f5d0d3d9d920b5ff6fdda`.
PR #2 then pulled that digest and passed the published-image smoke matrix
(fresh startup/health, baseline ledger, P02a adoption, managed restart,
unknown/ahead and PostgreSQL 17 refusal, concurrency, Compose).

Still required before a production claim:

- Take and test a pre-upgrade dump on the target installation.
- Upgrade an actual installation under the documented rollback plan.

No deployment, release or production database validation has been performed.
