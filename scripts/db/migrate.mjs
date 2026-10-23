#!/usr/bin/env node
// scripts/db/migrate.mjs
//
// P02b-2 dedicated-session migration runner.
//
// Scope: fresh baseline initialization and already-managed baseline/no-op.
// Unmanaged baseline adoption is deliberately not implemented here.

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import postgres from "postgres"
import {
  BASELINE_VERSION,
  normalizeMigrationText,
  validateMigrations,
} from "./migration-manifest.mjs"
import {
  BASELINE_RUNTIME_INDEX,
  classifyFingerprint,
  computeFingerprint,
  sameFingerprint,
  validateFingerprintShape,
} from "./schema-fingerprint.mjs"

const ROOT = path.resolve(fileURLToPath(new URL("../..", import.meta.url)))
const DEFAULT_MIGRATIONS_DIR = path.join(ROOT, "db", "migrations")
const BASELINE_FINGERPRINT_PATH = path.join(ROOT, "db", "migrations", "baseline-fingerprint.json")
const LOCK_KEY = "tracker-tracker:schema-migrations-v1"
const DEFAULT_LOCK_TIMEOUT_MS = 30_000
const APP_VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).version

const TRANSACTION_CONTROL_RE =
  /\b(BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE|PREPARE\s+TRANSACTION|COMMIT\s+PREPARED|ROLLBACK\s+PREPARED|SET\s+TRANSACTION)\b/i
const NON_TRANSACTIONAL_RE =
  /\b(CREATE\s+(?:UNIQUE\s+)?INDEX\s+CONCURRENTLY|DROP\s+INDEX\s+CONCURRENTLY|VACUUM|CREATE\s+DATABASE|DROP\s+DATABASE|CREATE\s+TABLESPACE|DROP\s+TABLESPACE|REINDEX\s+CONCURRENTLY|ALTER\s+TYPE[\s\S]*ADD\s+VALUE|CLUSTER|CHECKPOINT)\b/i

class MigrationError extends Error {
  constructor(code, message, details = undefined) {
    super(message)
    this.name = "MigrationError"
    this.code = code
    this.details = details
  }
}

let shuttingDown = false
let reported = false

function reportFailure(error) {
  if (reported) return
  reported = true
  if (process.env.P02B_DEBUG === "1") {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
  }
  const payload =
    error instanceof MigrationError
      ? { ok: false, code: error.code, message: error.message, details: error.details }
      : { ok: false, code: "INTERNAL_ERROR", message: "Migration runner failed" }
  process.stdout.write(`${JSON.stringify(payload)}\n`, () => {
    process.exit(1)
  })
}

function reportSuccess(result) {
  if (reported) return
  reported = true
  process.stdout.write(`${JSON.stringify(result)}\n`)
}

function parseArgs(argv) {
  const result = {
    migrationsDir: DEFAULT_MIGRATIONS_DIR,
    lockTimeoutMs: DEFAULT_LOCK_TIMEOUT_MS,
  }
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]
    if (arg === "--migrations-dir") {
      result.migrationsDir = path.resolve(argv[++index] ?? "")
    } else if (arg === "--lock-timeout-ms") {
      result.lockTimeoutMs = Number.parseInt(argv[++index] ?? "", 10)
      if (!Number.isFinite(result.lockTimeoutMs) || result.lockTimeoutMs < 100) {
        throw new MigrationError("ARGUMENT_INVALID", "--lock-timeout-ms must be at least 100")
      }
    } else {
      throw new MigrationError("ARGUMENT_INVALID", `Unknown argument: ${arg}`)
    }
  }
  return result
}

function loadBaselineFingerprint() {
  let parsed
  try {
    parsed = JSON.parse(fs.readFileSync(BASELINE_FINGERPRINT_PATH, "utf8"))
  } catch (error) {
    throw new MigrationError(
      "BASELINE_FINGERPRINT_INVALID",
      `Baseline fingerprint could not be read: ${error.message}`
    )
  }
  if (!validateFingerprintShape(parsed)) {
    throw new MigrationError(
      "BASELINE_FINGERPRINT_INVALID",
      "Baseline fingerprint has an invalid shape"
    )
  }
  return parsed
}

function baselineRuntimeIndexStatement(entry) {
  const statements = readStatements(entry.path)
  const matcher = new RegExp(
    `CREATE\\s+INDEX\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?"?${BASELINE_RUNTIME_INDEX}"?\\b`,
    "i"
  )
  const statement = statements.find((candidate) => matcher.test(candidate))
  if (!statement) {
    throw new MigrationError(
      "BASELINE_INDEX_MISSING",
      `Baseline does not define the ${BASELINE_RUNTIME_INDEX} index`
    )
  }
  // The runtime index was appended after the generated baseline without a
  // statement-breakpoint marker. Extract only the approved index statement so
  // adoption never re-runs the other baseline indexes that already exist.
  const start = statement.search(matcher)
  const end = statement.indexOf(";", start)
  if (start < 0 || end < 0) {
    throw new MigrationError(
      "BASELINE_INDEX_MISSING",
      `Baseline runtime index ${BASELINE_RUNTIME_INDEX} is not a complete statement`
    )
  }
  return statement.slice(start, end + 1)
}

function parseDatabaseUrl(raw) {
  let parsed
  try {
    parsed = new URL(raw)
  } catch {
    throw new MigrationError("DATABASE_URL_INVALID", "DATABASE_URL is not a valid URL")
  }
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new MigrationError("DATABASE_URL_INVALID", "DATABASE_URL must be postgres:// or postgresql://")
  }
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""))
  if (!database) {
    throw new MigrationError("DATABASE_URL_INVALID", "DATABASE_URL must include a database name")
  }
  return { database, host: parsed.hostname }
}

function requireDisposableUrl(endpoint) {
  if (process.env.P02B_REQUIRE_DISPOSABLE !== "1") return
  if (process.env.NODE_ENV === "production") {
    throw new MigrationError("DISPOSABLE_GUARD", "Refusing disposable runner work with NODE_ENV=production")
  }
  if (!endpoint.database.endsWith("_p02b")) {
    throw new MigrationError(
      "DISPOSABLE_GUARD",
      `Refusing database "${endpoint.database}": P02b disposable databases must end in _p02b`
    )
  }
  const localHosts = new Set(["127.0.0.1", "localhost", "::1", "[::1]"])
  if (!localHosts.has(endpoint.host) && process.env.P02B_ALLOW_REMOTE !== "1") {
    throw new MigrationError(
      "DISPOSABLE_GUARD",
      `Refusing non-local database host "${endpoint.host}"`
    )
  }
}

function readStatements(file) {
  return normalizeMigrationText(fs.readFileSync(file, "utf8"))
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean)
}

function assertSafeStatement(statement, file) {
  const sql = statement
    .replace(/--[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
  if (TRANSACTION_CONTROL_RE.test(sql)) {
    throw new MigrationError(
      "UNSAFE_SQL",
      `Transaction-control SQL is not allowed in ${path.basename(file)}`
    )
  }
  if (NON_TRANSACTIONAL_RE.test(sql)) {
    throw new MigrationError(
      "UNSAFE_SQL",
      `Non-transactional SQL is not allowed in ${path.basename(file)}`
    )
  }
}

function baselineTableNames(statements) {
  const names = new Set()
  const re = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?"?([a-zA-Z0-9_]+)"?/gi
  for (const statement of statements) {
    let match = re.exec(statement)
    while (match !== null) {
      names.add(match[1])
      match = re.exec(statement)
    }
  }
  return [...names]
}

async function verifyBaselineTables(tx, statements) {
  const tables = baselineTableNames(statements)
  for (const table of tables) {
    const [row] = await tx`select to_regclass(${`public.${table}`})::text as name`
    if (!row?.name) {
      throw new MigrationError("SCHEMA_VERIFY_FAILED", `Baseline table is missing: ${table}`)
    }
  }
  return tables
}

function createLedgerSql() {
  return `
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
  `
}

async function foreignLedgerExists(conn) {
  const [row] = await conn`select to_regclass('drizzle.__drizzle_migrations')::text as name`
  return Boolean(row?.name)
}

async function ledgerExists(conn) {
  const [row] = await conn`select to_regclass('public.schema_migrations')::text as name`
  return Boolean(row?.name)
}

async function validateLedgerStructure(conn) {
  const columns = await conn`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'schema_migrations'
    ORDER BY column_name
  `
  const byName = new Map(columns.map((column) => [column.column_name, column]))
  const expected = [
    ["app_version", "text", "NO"],
    ["applied_at", "timestamp with time zone", "NO"],
    ["baseline", "boolean", "NO"],
    ["checksum", "text", "NO"],
    ["execution_ms", "integer", "YES"],
    ["version", "text", "NO"],
  ]
  for (const [name, type, nullable] of expected) {
    const column = byName.get(name)
    if (!column || column.data_type !== type || column.is_nullable !== nullable) {
      throw new MigrationError(
        "LEDGER_STRUCTURE",
        `schema_migrations has an unexpected definition for ${name}`
      )
    }
  }
  if (byName.size !== expected.length) {
    throw new MigrationError("LEDGER_STRUCTURE", "schema_migrations has unexpected columns")
  }

  const constraints = await conn`
    SELECT contype, pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE conrelid = 'public.schema_migrations'::regclass
  `
  const primary = constraints.find((constraint) => constraint.contype === "p")
  if (!primary || !/PRIMARY KEY \(version\)/i.test(primary.definition)) {
    throw new MigrationError("LEDGER_STRUCTURE", "schema_migrations is missing its version primary key")
  }
  const checks = constraints.filter((constraint) => constraint.contype === "c")
  const definitions = checks.map((constraint) => constraint.definition.toLowerCase()).join("\n")
  if (!definitions.includes("checksum") || !definitions.includes("version") || !definitions.includes("baseline")) {
    throw new MigrationError("LEDGER_STRUCTURE", "schema_migrations is missing required checks")
  }
}

async function readLedger(conn) {
  return conn`
    SELECT version, checksum, app_version, baseline, applied_at
    FROM public.schema_migrations
    ORDER BY version
  `
}

function validateLedgerRows(rows, entries) {
  if (rows.length === 0) return
  if (rows[0].version !== BASELINE_VERSION) {
    throw new MigrationError("LEDGER_INVALID", `First ledger version must be ${BASELINE_VERSION}`)
  }
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index]
    const entry = entries[index]
    if (!entry) {
      throw new MigrationError("DATABASE_AHEAD", `Database has unknown migration ${row.version}`)
    }
    if (row.version !== entry.version) {
      const known = entries.some((candidate) => candidate.version === row.version)
      throw new MigrationError(
        known ? "LEDGER_INVALID" : "DATABASE_AHEAD",
        known
          ? `Ledger version ${row.version} is out of order`
          : `Database is ahead of this application: ${row.version}`
      )
    }
    if (row.checksum !== entry.sha256) {
      throw new MigrationError(
        "CHECKSUM_MISMATCH",
        `Checksum mismatch for applied migration ${row.version}`
      )
    }
    if (row.baseline !== (row.version === BASELINE_VERSION)) {
      throw new MigrationError("LEDGER_INVALID", `Baseline flag is invalid for ${row.version}`)
    }
  }
}

async function applicationTables(conn) {
  const rows = await conn`
    SELECT tablename AS table_name
    FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> 'schema_migrations'
    ORDER BY tablename
  `
  return rows.map((row) => row.table_name)
}

async function assertPg18(conn) {
  const [row] = await conn`SELECT current_setting('server_version_num')::int AS number`
  if (row.number < 180000 || row.number >= 190000) {
    throw new MigrationError(
      "UNSUPPORTED_POSTGRES",
      `PostgreSQL 18 is required; connected server reports ${row.number}`
    )
  }
}

async function lockHolders(conn) {
  try {
    return await conn`
      SELECT l.pid, a.application_name, a.state, a.query_start
      FROM pg_locks l
      LEFT JOIN pg_stat_activity a ON a.pid = l.pid
      WHERE l.locktype = 'advisory' AND l.granted AND l.objsubid = 1
    `
  } catch {
    return []
  }
}

async function acquireLock(conn, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const [row] = await conn`SELECT pg_try_advisory_lock(hashtext(${LOCK_KEY}), 1) AS locked`
    if (row.locked) return
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new MigrationError("LOCK_TIMEOUT", "Timed out waiting for the migration advisory lock", {
    lock: LOCK_KEY,
    holders: await lockHolders(conn),
  })
}

async function assertSession(conn, expectedPid, expectedDatabase) {
  if (conn.__lost) {
    throw new MigrationError("CONNECTION_LOST", "The dedicated migration session was closed")
  }
  const [row] = await conn`SELECT pg_backend_pid() AS pid, current_database() AS database`
  if (row.pid !== expectedPid || row.database !== expectedDatabase) {
    throw new MigrationError(
      "CONNECTION_LOST",
      "The dedicated migration session changed; refusing to continue"
    )
  }
}

async function withTransaction(conn, fn) {
  await conn.unsafe("BEGIN")
  try {
    const result = await fn(conn)
    await conn.unsafe("COMMIT")
    return result
  } catch (error) {
    await conn.unsafe("ROLLBACK").catch(() => {})
    if (conn.__lost) {
      throw new MigrationError("CONNECTION_LOST", "The migration transaction lost its session")
    }
    throw error
  }
}

async function insertLedger(tx, entry, appVersion, elapsedMs, baseline) {
  await tx`
    INSERT INTO public.schema_migrations
      (version, checksum, app_version, execution_ms, baseline)
    VALUES
      (${entry.version}, ${entry.sha256}, ${appVersion}, ${elapsedMs}, ${baseline})
  `
}

async function applyFresh(conn, baselineEntry, appVersion, expectedPid, database) {
  const statements = readStatements(baselineEntry.path)
  for (const statement of statements) assertSafeStatement(statement, baselineEntry.path)
  const started = Date.now()
  let tables
  await withTransaction(conn, async (tx) => {
    await tx.unsafe(createLedgerSql())
    for (const statement of statements) await tx.unsafe(statement)
    tables = await verifyBaselineTables(tx, statements)
    await insertLedger(tx, baselineEntry, appVersion, Date.now() - started, true)
  })
  await assertSession(conn, expectedPid, database)
  return { path: "fresh", tables }
}

async function applyPending(conn, entries, appVersion, expectedPid, database) {
  const applied = []
  for (const entry of entries) {
    await assertSession(conn, expectedPid, database)
    const statements = readStatements(entry.path)
    for (const statement of statements) assertSafeStatement(statement, entry.path)
    const started = Date.now()
    try {
      await withTransaction(conn, async (tx) => {
        for (const statement of statements) await tx.unsafe(statement)
        await insertLedger(tx, entry, appVersion, Date.now() - started, false)
      })
    } catch (error) {
      if (error instanceof MigrationError) throw error
      throw new MigrationError(
        "MIGRATION_FAILED",
        `Migration ${entry.version} failed and was rolled back`,
        { version: entry.version }
      )
    }
    applied.push(entry.version)
  }
  return applied
}

async function adoptExisting(
  conn,
  baselineEntry,
  expectedFingerprint,
  classification,
  appVersion,
  expectedPid,
  database
) {
  await assertSession(conn, expectedPid, database)
  const actual = await computeFingerprint(conn)
  const current = classifyFingerprint(actual, expectedFingerprint)
  if (current.kind === "unknown") {
    throw new MigrationError(
      "ADOPTION_FINGERPRINT_MISMATCH",
      "Existing schema does not match the approved baseline",
      { difference: current.reason, database }
    )
  }
  if (current.kind !== classification.kind) {
    throw new MigrationError(
      "ADOPTION_FINGERPRINT_MISMATCH",
      "Schema changed while adoption was being prepared",
      { database }
    )
  }

  const started = Date.now()
  await withTransaction(conn, async (tx) => {
    if (current.kind === "missing_runtime_index") {
      await tx.unsafe(baselineRuntimeIndexStatement(baselineEntry))
      const repaired = await computeFingerprint(tx)
      if (!sameFingerprint(repaired, expectedFingerprint)) {
        throw new MigrationError(
          "ADOPTION_REPAIR_FAILED",
          "The baseline runtime index repair did not produce the approved schema"
        )
      }
    }
    await tx.unsafe(createLedgerSql())
    await insertLedger(tx, baselineEntry, appVersion, Date.now() - started, true)
  })
  await assertSession(conn, expectedPid, database)
  return current.kind
}

async function run() {
  const args = parseArgs(process.argv.slice(2))
  const manifest = validateMigrations(args.migrationsDir)
  if (!manifest.ok) {
    throw new MigrationError("MANIFEST_INVALID", "Migration manifest is invalid", {
      errors: manifest.errors,
    })
  }
  const baselineFingerprint = loadBaselineFingerprint()

  const rawUrl = process.env.DATABASE_URL
  if (!rawUrl) throw new MigrationError("DATABASE_URL_MISSING", "DATABASE_URL is required")
  const endpoint = parseDatabaseUrl(rawUrl)
  requireDisposableUrl(endpoint)

  let client
  let conn
  let locked = false
  let backendPid = null
  try {
    client = postgres(rawUrl, {
      max: 1,
      idle_timeout: 0,
      connect_timeout: 10,
      onnotice: () => {},
      onclose: () => {
        if (conn) conn.__lost = true
        if (!shuttingDown) {
          reportFailure(
            new MigrationError(
              "CONNECTION_LOST",
              "The dedicated migration session was closed; the run is marked failed"
            )
          )
        }
      },
    })
    conn = await client.reserve()
    conn.__lost = false
    await conn.unsafe(`SET application_name = 'tracker-tracker-migrate'`)
    await acquireLock(conn, args.lockTimeoutMs)
    locked = true

    const [identity] = await conn`
      SELECT pg_backend_pid() AS pid, current_database() AS database, inet_server_addr()::text AS address
    `
    backendPid = identity.pid
    await assertSession(conn, backendPid, identity.database)
    await assertPg18(conn)

    if (await foreignLedgerExists(conn)) {
      throw new MigrationError(
        "FOREIGN_LEDGER",
        "drizzle.__drizzle_migrations exists; this is not the approved migration ledger"
      )
    }

    const hasLedger = await ledgerExists(conn)
    if (hasLedger) await validateLedgerStructure(conn)
    const tables = await applicationTables(conn)
    const rows = hasLedger ? await readLedger(conn) : []
    validateLedgerRows(rows, manifest.entries)

    if (rows.length === 0) {
      if (tables.length === 0) {
        const baselineEntry = manifest.entries[0]
        const result = await applyFresh(
          conn,
          baselineEntry,
          APP_VERSION,
          backendPid,
          identity.database
        )
        const pendingAfterFresh = manifest.entries.slice(1)
        const appliedAfterFresh =
          pendingAfterFresh.length > 0
            ? await applyPending(
                conn,
                pendingAfterFresh,
                APP_VERSION,
                backendPid,
                identity.database
              )
            : []
        return {
          ok: true,
          database: identity.database,
          host: endpoint.host,
          path: result.path,
          applied: [baselineEntry.version, ...appliedAfterFresh],
          tables: result.tables.length,
        }
      }

      if (hasLedger) {
        throw new MigrationError(
          "LEDGER_INVALID",
          "schema_migrations exists but has no rows; refusing adoption over a partial ledger"
        )
      }

      await assertSession(conn, backendPid, identity.database)
      const actual = await computeFingerprint(conn)
      const classification = classifyFingerprint(actual, baselineFingerprint)
      if (classification.kind === "unknown") {
        throw new MigrationError(
          "ADOPTION_FINGERPRINT_MISMATCH",
          "Existing schema does not match the approved baseline",
          { difference: classification.reason, database: identity.database }
        )
      }

      const baselineEntry = manifest.entries[0]
      let adoptedKind
      try {
        adoptedKind = await adoptExisting(
          conn,
          baselineEntry,
          baselineFingerprint,
          classification,
          APP_VERSION,
          backendPid,
          identity.database
        )
      } catch (error) {
        if (process.env.P02B_DEBUG === "1") {
          process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
        }
        if (error instanceof MigrationError) throw error
        throw new MigrationError(
          "ADOPTION_FAILED",
          "Baseline adoption failed and was rolled back",
          { database: identity.database }
        )
      }
      const pendingAfterAdoption = manifest.entries.slice(1)
      const appliedAfterAdoption =
        pendingAfterAdoption.length > 0
          ? await applyPending(
              conn,
              pendingAfterAdoption,
              APP_VERSION,
              backendPid,
              identity.database
            )
          : []
      return {
        ok: true,
        database: identity.database,
        host: endpoint.host,
        path: adoptedKind === "missing_runtime_index" ? "adopted_repaired" : "adopted",
        applied: [baselineEntry.version, ...appliedAfterAdoption],
        tables: tables.length,
      }
    }

    const pending = manifest.entries.slice(rows.length)
    if (pending.length === 0) {
      return {
        ok: true,
        database: identity.database,
        host: endpoint.host,
        path: "noop",
        applied: [],
        ledger: rows.map((row) => row.version),
      }
    }

    const applied = await applyPending(conn, pending, APP_VERSION, backendPid, identity.database)
    return {
      ok: true,
      database: identity.database,
      host: endpoint.host,
      path: "managed",
      applied,
      ledger: [...rows.map((row) => row.version), ...applied],
    }
  } finally {
    shuttingDown = true
    if (conn) {
      if (locked) {
        await conn`SELECT pg_advisory_unlock(hashtext(${LOCK_KEY}), 1)`.catch(() => {})
      }
      try {
        conn.release()
      } catch {
        // already released or lost
      }
    }
    if (client) await client.end({ timeout: 5 }).catch(() => {})
  }
}

run().then(reportSuccess, reportFailure)
