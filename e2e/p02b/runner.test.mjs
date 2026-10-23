// e2e/p02b/runner.test.mjs
//
// P02b-2 integration tests. Run with Node 24 and a guarded PostgreSQL 18
// disposable database:
//
//   P02B_DATABASE_URL=postgresql://.../tracker_tracker_p02b \
//   P02B_ALLOW_DESTRUCTIVE=1 \
//   node --test e2e/p02b/runner.test.mjs

import assert from "node:assert/strict"
import { spawn, spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import test, { after } from "node:test"
import { fileURLToPath } from "node:url"
import {
  computeChecksum,
  computeFileChecksum,
} from "../../scripts/db/migration-manifest.mjs"
import {
  computeFingerprint,
  serializeFingerprint,
} from "../../scripts/db/schema-fingerprint.mjs"
import {
  closeP02b,
  openP02b,
  readP02bEndpoint,
  resetFromUnmanagedBaseline,
} from "./safety.mjs"

const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)))
const PRODUCTION_MIGRATIONS = join(ROOT, "db", "migrations")
const PRODUCTION_FINGERPRINT = join(PRODUCTION_MIGRATIONS, "baseline-fingerprint.json")
const RUNNER = join(ROOT, "scripts", "db", "migrate.mjs")

const tempDirs = []
const endpoint = readP02bEndpoint()

function makeMigrations(extras = []) {
  const dir = mkdtempSync(join(tmpdir(), "tt-p02b2-"))
  tempDirs.push(dir)
  copyFileSync(join(PRODUCTION_MIGRATIONS, "0000_baseline.sql"), join(dir, "0000_baseline.sql"))
  const migrations = [
    {
      version: "0000_baseline",
      file: "0000_baseline.sql",
      sha256: computeFileChecksum(join(dir, "0000_baseline.sql")),
    },
  ]
  for (const extra of extras) {
    writeFileSync(join(dir, extra.file), extra.sql, "utf8")
    migrations.push({
      version: extra.version,
      file: extra.file,
      sha256: computeChecksum(extra.sql),
    })
  }
  writeFileSync(
    join(dir, "manifest.json"),
    `${JSON.stringify({ format: 1, baseline: "0000_baseline", migrations }, null, 2)}\n`,
    "utf8"
  )
  return dir
}

function runRunner({ migrationsDir = PRODUCTION_MIGRATIONS, lockTimeoutMs = 10_000 } = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(
      process.execPath,
      [RUNNER, "--migrations-dir", migrationsDir, "--lock-timeout-ms", String(lockTimeoutMs)],
      {
        env: {
          ...process.env,
          DATABASE_URL: endpoint.url,
          P02B_REQUIRE_DISPOSABLE: "1",
          NODE_ENV: "test",
        },
        stdio: ["ignore", "pipe", "pipe"],
      }
    )
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (chunk) => {
      stdout += chunk
    })
    child.stderr.on("data", (chunk) => {
      stderr += chunk
    })
    const timer = setTimeout(() => {
      child.kill("SIGKILL")
    }, 45_000)
    child.on("error", reject)
    child.on("close", (code) => {
      clearTimeout(timer)
      let payload
      try {
        payload = JSON.parse(stdout.trim())
      } catch {
        payload = undefined
      }
      resolvePromise({ code, payload, stdout, stderr })
    })
  })
}

async function reset() {
  const { sql } = await openP02b({ reset: true })
  await closeP02b(sql)
}

async function query(fn) {
  const { sql } = await openP02b()
  try {
    return await fn(sql)
  } finally {
    await closeP02b(sql)
  }
}

async function ledgerVersions() {
  return query(async (sql) => {
    const rows = await sql`SELECT version FROM public.schema_migrations ORDER BY version`
    return rows.map((row) => row.version)
  })
}

async function tableExists(name) {
  return query(async (sql) => {
    const [row] = await sql`SELECT to_regclass(${`public.${name}`})::text AS name`
    return Boolean(row?.name)
  })
}

function hashValue(value) {
  return value === null || value === undefined
    ? null
    : createHash("sha256").update(String(value), "utf8").digest("hex")
}

async function snapshotData() {
  return query(async (sql) => {
    const trackers = await sql`
      SELECT id, encrypted_api_token, encrypted_credentials, encrypted_mousehole_token,
             last_access_at, sort_order
      FROM trackers ORDER BY id
    `
    const clients = await sql`
      SELECT id, encrypted_username, encrypted_password, encrypted_api_key
      FROM download_clients ORDER BY id
    `
    const targets = await sql`
      SELECT id, encrypted_config FROM notification_targets ORDER BY id
    `
    const [settings] = await sql`
      SELECT encrypted_scheduler_key, encryption_salt FROM app_settings ORDER BY id LIMIT 1
    `
    const [counts] = await sql`
      SELECT
        (SELECT count(*)::int FROM trackers) AS trackers,
        (SELECT count(*)::int FROM tracker_snapshots) AS snapshots,
        (SELECT count(*)::int FROM download_clients) AS clients,
        (SELECT count(*)::int FROM notification_targets) AS targets,
        (SELECT count(*)::int FROM notification_delivery_state) AS deliveries,
        (SELECT count(*)::int FROM tracker_daily_checkpoints) AS checkpoints,
        (SELECT count(*)::int FROM app_liveness) AS liveness
    `
    const [sequence] = await sql`
      SELECT last_value::text AS last_value, is_called FROM trackers_id_seq
    `
    return {
      counts,
      trackers: trackers.map((row) => ({
        id: row.id,
        token: hashValue(row.encrypted_api_token),
        credentials: hashValue(row.encrypted_credentials),
        mousehole: hashValue(row.encrypted_mousehole_token),
        lastAccess: String(row.last_access_at),
        sortOrder: row.sort_order,
      })),
      clients: clients.map((row) => ({
        id: row.id,
        username: hashValue(row.encrypted_username),
        password: hashValue(row.encrypted_password),
        apiKey: hashValue(row.encrypted_api_key),
      })),
      targets: targets.map((row) => ({ id: row.id, config: hashValue(row.encrypted_config) })),
      settings: {
        schedulerKey: hashValue(settings?.encrypted_scheduler_key),
        salt: hashValue(settings?.encryption_salt),
      },
      sequence: { lastValue: sequence.last_value, isCalled: sequence.is_called },
    }
  })
}

function productionFingerprint() {
  return JSON.parse(readFileSync(PRODUCTION_FINGERPRINT, "utf8"))
}

async function assertProductionFingerprint() {
  const actual = await query((sql) => computeFingerprint(sql))
  assert.equal(serializeFingerprint(actual), serializeFingerprint(productionFingerprint()))
}

async function createColumnOrderVariant() {
  const baseline = readFileSync(join(PRODUCTION_MIGRATIONS, "0000_baseline.sql"), "utf8")
  const reordered = baseline.replace(
    /CREATE TABLE "app_liveness" \([\s\S]*?\n\);/,
    `CREATE TABLE "app_liveness" (\n\t"id" serial PRIMARY KEY NOT NULL,\n\t"last_seen_at" timestamp DEFAULT now() NOT NULL,\n\t"first_seen_at" timestamp DEFAULT now() NOT NULL,\n\t"stopped_at" timestamp\n);`
  )
  assert.notEqual(reordered, baseline, "column-order variant replacement failed")
  await query(async (sql) => {
    await sql.unsafe("DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
    for (const statement of reordered
      .split("--> statement-breakpoint")
      .map((part) => part.trim())
      .filter(Boolean)) {
      await sql.unsafe(statement)
    }
    await sql`INSERT INTO app_liveness (last_seen_at, first_seen_at) VALUES (now(), now())`
  })
}

async function dropEventTrigger(name) {
  await query(async (sql) => {
    await sql.unsafe(`DROP EVENT TRIGGER IF EXISTS ${name}`)
    await sql.unsafe(`DROP FUNCTION IF EXISTS ${name}()`)
  })
}

async function createIndexEventTrigger(name, body) {
  await query(async (sql) => {
    await sql.unsafe(`
      CREATE OR REPLACE FUNCTION ${name}() RETURNS event_trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_event_trigger_ddl_commands()
          WHERE object_identity LIKE '%idx_snapshots_tracker_polled_covering%'
        ) THEN
          ${body}
        END IF;
      END;
      $$;
    `)
    await sql.unsafe(
      `CREATE EVENT TRIGGER ${name} ON ddl_command_end WHEN TAG IN ('CREATE INDEX') EXECUTE FUNCTION ${name}()`
    )
  })
}

test("fresh initialization is atomic, verifies tables and repeats as a no-op", async () => {
  await reset()
  const first = await runRunner()
  assert.equal(first.code, 0, first.stderr || first.stdout)
  assert.equal(first.payload?.ok, true)
  assert.equal(first.payload?.path, "fresh")
  assert.deepEqual(first.payload?.applied, ["0000_baseline"])

  const versions = await ledgerVersions()
  assert.deepEqual(versions, ["0000_baseline"])

  const schema = await query(async (sql) => {
    const rows = await sql`
      SELECT tablename AS table_name FROM pg_tables
      WHERE schemaname = 'public' AND tablename <> 'schema_migrations'
      ORDER BY tablename
    `
    return rows.map((row) => row.table_name)
  })
  assert.ok(schema.includes("trackers"))
  assert.ok(schema.includes("tracker_snapshots"))
  assert.ok(schema.includes("notification_targets"))
  assert.equal(schema.length, 19)

  const second = await runRunner()
  assert.equal(second.code, 0, second.stderr || second.stdout)
  assert.equal(second.payload?.path, "noop")
  assert.deepEqual(second.payload?.applied, [])
  assert.deepEqual(await ledgerVersions(), ["0000_baseline"])
})

test("adopts the canonical seeded unmanaged baseline without replaying it", async () => {
  await resetFromUnmanagedBaseline()
  const before = await snapshotData()

  const result = await runRunner()
  assert.equal(result.code, 0, result.stderr || result.stdout)
  assert.equal(result.payload?.ok, true)
  assert.equal(result.payload?.path, "adopted")
  assert.deepEqual(result.payload?.applied, ["0000_baseline"])
  assert.deepEqual(await ledgerVersions(), ["0000_baseline"])
  await assertProductionFingerprint()

  const [ledger] = await query(async (sql) => {
    return sql`
      SELECT checksum, baseline FROM public.schema_migrations
      WHERE version = '0000_baseline'
    `
  })
  assert.equal(ledger.checksum, "59b382583d2a70edf5b1b2ca8488408f3eb83582ea4a4eb6aec501f72e0e9815")
  assert.equal(ledger.baseline, true)
  assert.deepEqual(await snapshotData(), before)

  const second = await runRunner()
  assert.equal(second.code, 0, second.stderr || second.stdout)
  assert.equal(second.payload?.path, "noop")
})

test("adopts a column-order variant", async () => {
  await reset()
  await createColumnOrderVariant()
  const before = await snapshotData()

  const result = await runRunner()
  assert.equal(result.code, 0, result.stderr || result.stdout)
  assert.equal(result.payload?.path, "adopted")
  await assertProductionFingerprint()
  assert.deepEqual(await ledgerVersions(), ["0000_baseline"])
  assert.deepEqual(await snapshotData(), before)
  const [row] = await query(async (sql) => sql`SELECT count(*)::int AS count FROM app_liveness`)
  assert.equal(row.count, 1)
})

test("repairs the exact missing runtime index and adopts atomically", async () => {
  await resetFromUnmanagedBaseline()
  await query(async (sql) => {
    await sql.unsafe("DROP INDEX idx_snapshots_tracker_polled_covering")
  })
  const before = await snapshotData()

  const result = await runRunner()
  assert.equal(result.code, 0, result.stderr || result.stdout)
  assert.equal(result.payload?.path, "adopted_repaired")
  await assertProductionFingerprint()
  assert.deepEqual(await ledgerVersions(), ["0000_baseline"])

  const expected = productionFingerprint().indexes.find(
    (index) => index.index === "idx_snapshots_tracker_polled_covering"
  )
  const [index] = await query(async (sql) => {
    return sql`
      SELECT indexdef FROM pg_indexes
      WHERE schemaname = 'public' AND indexname = 'idx_snapshots_tracker_polled_covering'
    `
  })
  assert.equal(index.indexdef, expected.definition)
  assert.deepEqual(await snapshotData(), before)
})

test("rejects unexplained schema differences without mutation", async () => {
  const cases = [
    {
      name: "extra table",
      mutate: (sql) => sql.unsafe("CREATE TABLE p02b_extra_table (id integer)"),
      difference: "extra tables",
    },
    {
      name: "extra column",
      mutate: (sql) => sql.unsafe("ALTER TABLE trackers ADD COLUMN p02b_extra text"),
      difference: "extra columns",
    },
    {
      name: "missing column",
      mutate: (sql) => sql.unsafe("ALTER TABLE trackers DROP COLUMN color"),
      difference: "missing columns",
    },
    {
      name: "changed column definition",
      mutate: (sql) => sql.unsafe("ALTER TABLE trackers ALTER COLUMN color TYPE text"),
      difference: "definitions differ",
    },
    {
      name: "extra index",
      mutate: (sql) => sql.unsafe("CREATE INDEX p02b_extra_idx ON trackers (name)"),
      difference: "extra indexes",
    },
    {
      name: "extra constraint",
      mutate: (sql) =>
        sql.unsafe("ALTER TABLE trackers ADD CONSTRAINT p02b_extra_unique UNIQUE (name)"),
      difference: "constraints",
    },
  ]

  for (const testCase of cases) {
    await resetFromUnmanagedBaseline()
    const before = await snapshotData()
    await query(testCase.mutate)
    const result = await runRunner()
    assert.equal(result.code, 1, `${testCase.name}: expected rejection`)
    assert.equal(result.payload?.code, "ADOPTION_FINGERPRINT_MISMATCH", testCase.name)
    assert.equal(await tableExists("schema_migrations"), false, testCase.name)
    assert.deepEqual(await snapshotData(), before, testCase.name)
    assert.ok(
      result.payload?.details?.difference?.includes(testCase.difference),
      `${testCase.name}: ${result.payload?.details?.difference}`
    )
  }
})

test("rejects a same-named runtime index with the wrong definition", async () => {
  await resetFromUnmanagedBaseline()
  await query(async (sql) => {
    await sql.unsafe("DROP INDEX idx_snapshots_tracker_polled_covering")
    await sql.unsafe("CREATE INDEX idx_snapshots_tracker_polled_covering ON tracker_snapshots (tracker_id)")
  })
  const before = await snapshotData()
  const result = await runRunner()
  assert.equal(result.code, 1)
  assert.equal(result.payload?.code, "ADOPTION_FINGERPRINT_MISMATCH")
  assert.equal(await tableExists("schema_migrations"), false)
  assert.deepEqual(await snapshotData(), before)
  const [index] = await query(async (sql) => {
    return sql`
      SELECT indexdef FROM pg_indexes
      WHERE schemaname = 'public' AND indexname = 'idx_snapshots_tracker_polled_covering'
    `
  })
  assert.ok(index.indexdef.includes("btree (tracker_id)"))
})

test("rejects a foreign ledger on an unmanaged baseline", async () => {
  await resetFromUnmanagedBaseline()
  await query(async (sql) => {
    await sql.unsafe("CREATE SCHEMA drizzle")
    await sql.unsafe(
      "CREATE TABLE drizzle.__drizzle_migrations (id serial PRIMARY KEY, hash text, created_at bigint)"
    )
  })
  const before = await snapshotData()
  const result = await runRunner()
  assert.equal(result.code, 1)
  assert.equal(result.payload?.code, "FOREIGN_LEDGER")
  assert.equal(await tableExists("schema_migrations"), false)
  assert.deepEqual(await snapshotData(), before)
})

test("rolls back index repair when adoption fails", { timeout: 30_000 }, async () => {
  await resetFromUnmanagedBaseline()
  await query(async (sql) => {
    await sql.unsafe("DROP INDEX idx_snapshots_tracker_polled_covering")
  })
  await createIndexEventTrigger(
    "p02b_fail_index",
    "RAISE EXCEPTION 'p02b injected index failure';"
  )
  const before = await snapshotData()
  try {
    const result = await runRunner()
    assert.equal(result.code, 1)
    assert.equal(result.payload?.code, "ADOPTION_FAILED")
    assert.equal(await tableExists("idx_snapshots_tracker_polled_covering"), false)
    assert.equal(await tableExists("schema_migrations"), false)
    assert.deepEqual(await snapshotData(), before)
  } finally {
    await dropEventTrigger("p02b_fail_index")
  }
})

test("interruption during adoption rolls back and retries", { timeout: 45_000 }, async () => {
  await resetFromUnmanagedBaseline()
  await query(async (sql) => {
    await sql.unsafe("DROP INDEX idx_snapshots_tracker_polled_covering")
  })
  const { sql: lockSql } = await openP02b()
  try {
    await lockSql`SELECT pg_advisory_lock(424242, 44)`
    await createIndexEventTrigger(
      "p02b_block_index",
      "PERFORM pg_advisory_lock(424242, 44);"
    )
    const child = spawn(
      process.execPath,
      [RUNNER, "--migrations-dir", PRODUCTION_MIGRATIONS, "--lock-timeout-ms", "10000"],
      {
        env: {
          ...process.env,
          DATABASE_URL: endpoint.url,
          P02B_REQUIRE_DISPOSABLE: "1",
          NODE_ENV: "test",
        },
        stdio: ["ignore", "pipe", "pipe"],
      }
    )
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 1000))
    const active = await query(async (sql) => {
      const [row] = await sql`
        SELECT count(*)::int AS count FROM pg_stat_activity
        WHERE application_name = 'tracker-tracker-migrate'
          AND query ILIKE '%idx_snapshots_tracker_polled_covering%'
          AND pid <> pg_backend_pid()
      `
      return row.count
    })
    assert.ok(active > 0, "adoption repair was not observed before termination")
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" })
    } else {
      child.kill("SIGKILL")
    }
    await new Promise((resolvePromise) => child.on("close", resolvePromise))
    await lockSql`SELECT pg_advisory_unlock(424242, 44)`
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500))
  } finally {
    await closeP02b(lockSql)
    await dropEventTrigger("p02b_block_index")
  }

  assert.equal(await tableExists("idx_snapshots_tracker_polled_covering"), false)
  assert.equal(await tableExists("schema_migrations"), false)
  const before = await snapshotData()
  const retried = await runRunner()
  assert.equal(retried.code, 0, retried.stderr || retried.stdout)
  assert.equal(retried.payload?.path, "adopted_repaired")
  assert.deepEqual(await ledgerVersions(), ["0000_baseline"])
  assert.deepEqual(await snapshotData(), before)
})

test("serializes concurrent adoption attempts", { timeout: 45_000 }, async () => {
  await resetFromUnmanagedBaseline()
  const before = await snapshotData()
  const [first, second] = await Promise.all([runRunner(), runRunner()])
  assert.equal(first.code, 0, first.stderr || first.stdout)
  assert.equal(second.code, 0, second.stderr || second.stdout)
  assert.deepEqual(await ledgerVersions(), ["0000_baseline"])
  assert.deepEqual(await snapshotData(), before)
})

test("rejects an invalid manifest before touching the database", async () => {
  await reset()
  const dir = mkdtempSync(join(tmpdir(), "tt-p02b2-invalid-"))
  tempDirs.push(dir)
  copyFileSync(join(PRODUCTION_MIGRATIONS, "0000_baseline.sql"), join(dir, "0000_baseline.sql"))
  const result = await runRunner({ migrationsDir: dir })
  assert.equal(result.code, 1)
  assert.equal(result.payload?.code, "MANIFEST_INVALID")
  const tables = await query(async (sql) => {
    const [row] = await sql`
      SELECT count(*)::int AS count FROM pg_tables WHERE schemaname = 'public'
    `
    return row.count
  })
  assert.equal(tables, 0)
})

test("rejects a malformed ledger without applying the baseline", async () => {
  await reset()
  await query(async (sql) => {
    await sql.unsafe("CREATE TABLE public.schema_migrations (version text PRIMARY KEY)")
  })
  const result = await runRunner()
  assert.equal(result.code, 1)
  assert.equal(result.payload?.code, "LEDGER_STRUCTURE")
  assert.equal(await tableExists("trackers"), false)
})

test("rejects a foreign Drizzle ledger", async () => {
  await reset()
  await query(async (sql) => {
    await sql.unsafe("CREATE SCHEMA drizzle")
    await sql.unsafe(
      "CREATE TABLE drizzle.__drizzle_migrations (id serial PRIMARY KEY, hash text NOT NULL, created_at bigint)"
    )
  })
  const result = await runRunner()
  assert.equal(result.code, 1)
  assert.equal(result.payload?.code, "FOREIGN_LEDGER")
  assert.equal(await tableExists("trackers"), false)
})

test("rejects an edited applied checksum without mutation", async () => {
  await reset()
  assert.equal((await runRunner()).code, 0)
  await query(async (sql) => {
    await sql.unsafe("UPDATE public.schema_migrations SET checksum = repeat('0', 64)")
  })
  const result = await runRunner()
  assert.equal(result.code, 1)
  assert.equal(result.payload?.code, "CHECKSUM_MISMATCH")
  assert.deepEqual(await ledgerVersions(), ["0000_baseline"])
  assert.equal(await tableExists("trackers"), true)

  const lockFree = await query(async (sql) => {
    const [row] =
      await sql`SELECT pg_try_advisory_lock(hashtext('tracker-tracker:schema-migrations-v1'), 1) AS locked`
    if (row.locked) {
      await sql`SELECT pg_advisory_unlock(hashtext('tracker-tracker:schema-migrations-v1'), 1)`
    }
    return row.locked
  })
  assert.equal(lockFree, true, "the failed run did not release the advisory lock")
})

test("rejects unsupported non-transactional SQL before applying it", async () => {
  await reset()
  const dir = makeMigrations([
    {
      version: "0001_unsafe",
      file: "0001_unsafe.sql",
      sql: "CREATE INDEX CONCURRENTLY p02b_unsafe_idx ON trackers (id);\n",
    },
  ])
  const result = await runRunner({ migrationsDir: dir })
  assert.equal(result.code, 1)
  assert.equal(result.payload?.code, "UNSAFE_SQL")
  assert.deepEqual(await ledgerVersions(), ["0000_baseline"])
  const indexExists = await query(async (sql) => {
    const [row] = await sql`
      SELECT count(*)::int AS count FROM pg_indexes
      WHERE schemaname = 'public' AND indexname = 'p02b_unsafe_idx'
    `
    return row.count
  })
  assert.equal(indexExists, 0)
})

test("rejects a database ahead of the application", async () => {
  await reset()
  assert.equal((await runRunner()).code, 0)
  await query(async (sql) => {
    await sql`
      INSERT INTO public.schema_migrations
        (version, checksum, app_version, baseline)
      VALUES
        ('0001_unknown', repeat('0', 64), 'test-ahead', false)
    `
  })
  const result = await runRunner()
  assert.equal(result.code, 1)
  assert.equal(result.payload?.code, "DATABASE_AHEAD")
  assert.deepEqual(await ledgerVersions(), ["0000_baseline", "0001_unknown"])
})

test("rejects an existing unmanaged schema without creating a ledger", async () => {
  await reset()
  await query(async (sql) => {
    await sql.unsafe("CREATE TABLE public.trackers (id integer)")
  })
  const result = await runRunner()
  assert.equal(result.code, 1)
  assert.equal(result.payload?.code, "ADOPTION_FINGERPRINT_MISMATCH")
  assert.equal(await tableExists("trackers"), true)
  assert.equal(await tableExists("schema_migrations"), false)
})

test("rolls back a failed migration and succeeds on retry", async () => {
  await reset()
  const failing = makeMigrations([
    {
      version: "0001_fail",
      file: "0001_fail.sql",
      sql: "CREATE TABLE p02b_rollback_probe (id integer);\n--> statement-breakpoint\nSELECT * FROM p02b_missing_table_should_fail;\n",
    },
  ])
  const failed = await runRunner({ migrationsDir: failing })
  assert.equal(failed.code, 1)
  assert.equal(failed.payload?.code, "MIGRATION_FAILED")
  assert.deepEqual(await ledgerVersions(), ["0000_baseline"])
  assert.equal(await tableExists("p02b_rollback_probe"), false)

  const retry = makeMigrations([
    {
      version: "0001_retry",
      file: "0001_retry.sql",
      sql: "CREATE TABLE p02b_retry_probe (id integer);\n",
    },
  ])
  const retried = await runRunner({ migrationsDir: retry })
  assert.equal(retried.code, 0, retried.stderr || retried.stdout)
  assert.equal(retried.payload?.path, "managed")
  assert.deepEqual(await ledgerVersions(), ["0000_baseline", "0001_retry"])
  assert.equal(await tableExists("p02b_retry_probe"), true)
})

test("rolls back an interrupted uncommitted migration and retries", { timeout: 45_000 }, async () => {
  await reset()
  const slow = makeMigrations([
    {
      version: "0001_slow",
      file: "0001_slow.sql",
      sql: "SELECT pg_advisory_lock(424242, 42);\n--> statement-breakpoint\nCREATE TABLE p02b_slow_probe (id integer);\n",
    },
  ])
  const { sql: lockSql } = await openP02b()
  try {
    await lockSql`SELECT pg_advisory_lock(424242, 42)`
    const child = spawn(
      process.execPath,
      [RUNNER, "--migrations-dir", slow, "--lock-timeout-ms", "10000"],
      {
        env: {
          ...process.env,
          DATABASE_URL: endpoint.url,
          P02B_REQUIRE_DISPOSABLE: "1",
          NODE_ENV: "test",
        },
        stdio: ["ignore", "pipe", "pipe"],
      }
    )
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 1000))
    const active = await query(async (sql) => {
      const [row] = await sql`
        SELECT count(*)::int AS count FROM pg_stat_activity
        WHERE application_name = 'tracker-tracker-migrate'
          AND query ILIKE '%pg_advisory_lock%'
          AND pid <> pg_backend_pid()
      `
      return row.count
    })
    assert.ok(active > 0, "blocked migration was not observed before termination")
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" })
    } else {
      child.kill("SIGKILL")
    }
    await new Promise((resolvePromise) => child.on("close", resolvePromise))
    await lockSql`SELECT pg_advisory_unlock(424242, 42)`
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500))
  } finally {
    await closeP02b(lockSql)
  }

  assert.deepEqual(await ledgerVersions(), ["0000_baseline"])
  assert.equal(await tableExists("p02b_slow_probe"), false)

  const fast = makeMigrations([
    {
      version: "0001_slow",
      file: "0001_slow.sql",
      sql: "CREATE TABLE p02b_slow_probe (id integer);\n",
    },
  ])
  const retried = await runRunner({ migrationsDir: fast })
  assert.equal(retried.code, 0, retried.stderr || retried.stdout)
  assert.deepEqual(await ledgerVersions(), ["0000_baseline", "0001_slow"])
  assert.equal(await tableExists("p02b_slow_probe"), true)
})

test("fails closed when the dedicated session is terminated", { timeout: 30_000 }, async () => {
  await reset()
  const dir = makeMigrations([
    {
      version: "0001_connloss",
      file: "0001_connloss.sql",
      sql: "SELECT pg_sleep(5);\n--> statement-breakpoint\nCREATE TABLE p02b_connloss_probe (id integer);\n",
    },
  ])
  const child = spawn(
    process.execPath,
    [RUNNER, "--migrations-dir", dir, "--lock-timeout-ms", "10000"],
    {
      env: {
        ...process.env,
        DATABASE_URL: endpoint.url,
        P02B_REQUIRE_DISPOSABLE: "1",
        NODE_ENV: "test",
      },
      stdio: ["ignore", "pipe", "pipe"],
    }
  )
  let stdout = ""
  let stderr = ""
  child.stdout.on("data", (chunk) => {
    stdout += chunk
  })
  child.stderr.on("data", (chunk) => {
    stderr += chunk
  })
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 1000))
  const backend = await query(async (sql) => {
    const [row] = await sql`
      SELECT pid FROM pg_stat_activity
      WHERE application_name = 'tracker-tracker-migrate'
        AND query ILIKE '%pg_sleep%'
      LIMIT 1
    `
    return row?.pid
  })
  assert.ok(backend, "runner backend was not found before termination")
  await query(async (sql) => {
    await sql`SELECT pg_terminate_backend(${backend})`
  })
  const exit = await new Promise((resolvePromise) => {
    child.on("close", (code, signal) => resolvePromise({ code, signal }))
  })
  assert.ok(
    stdout.trim(),
    `runner produced no output. exit=${JSON.stringify(exit)} stderr=${stderr}`
  )
  const payload = JSON.parse(stdout.trim())
  assert.equal(payload?.ok, false)
  assert.equal(payload?.code, "CONNECTION_LOST")
  assert.deepEqual(await ledgerVersions(), ["0000_baseline"])
  assert.equal(await tableExists("p02b_connloss_probe"), false)
})

test("serializes two concurrent runner processes", { timeout: 45_000 }, async () => {
  await reset()
  const [first, second] = await Promise.all([runRunner(), runRunner()])
  assert.equal(first.code, 0, first.stderr || first.stdout)
  assert.equal(second.code, 0, second.stderr || second.stdout)
  assert.deepEqual(await ledgerVersions(), ["0000_baseline"])
})

test("reports a bounded advisory-lock timeout", { timeout: 30_000 }, async () => {
  await reset()
  const { sql } = await openP02b()
  try {
    await sql`SELECT pg_advisory_lock(hashtext('tracker-tracker:schema-migrations-v1'), 1)`
    const result = await runRunner({ lockTimeoutMs: 500 })
    assert.equal(result.code, 1)
    assert.equal(result.payload?.code, "LOCK_TIMEOUT")
    assert.equal(result.payload?.details?.lock, "tracker-tracker:schema-migrations-v1")
    assert.ok(Array.isArray(result.payload?.details?.holders))
  } finally {
    await sql`SELECT pg_advisory_unlock(hashtext('tracker-tracker:schema-migrations-v1'), 1)`.catch(
      () => {}
    )
    await closeP02b(sql)
  }
})

after(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})
