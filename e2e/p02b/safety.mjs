// e2e/p02b/safety.mjs
//
// Guarded disposable PostgreSQL 18 helper for P02b integration tests.
// The database name is only the first check; the effective database and the
// marker comment are verified before any reset.

import postgres from "postgres"

export const P02B_MARKER = "tracker-tracker-p02b-disposable"
export const P02A_MARKER = "tracker-tracker-p02a-disposable"
export const P02B_SUFFIX = "_p02b"
export const P02A_SUFFIX = "_p02a"

export function readP02bEndpoint() {
  const raw = process.env.P02B_DATABASE_URL
  if (!raw) throw new Error("P02B_DATABASE_URL is required; do not use DATABASE_URL")
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing P02b tests with NODE_ENV=production")
  }

  const parsed = new URL(raw)
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error("P02B_DATABASE_URL must use postgres:// or postgresql://")
  }
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""))
  if (!database.endsWith(P02B_SUFFIX)) {
    throw new Error(`Refusing P02b database "${database}": name must end in ${P02B_SUFFIX}`)
  }
  const localHosts = new Set(["127.0.0.1", "localhost", "::1", "[::1]"])
  if (!localHosts.has(parsed.hostname)) {
    throw new Error(`Refusing non-local P02b database host "${parsed.hostname}"`)
  }
  return { url: raw, database, host: parsed.hostname }
}

export async function openP02b({ reset = false } = {}) {
  const endpoint = readP02bEndpoint()
  if (reset && process.env.P02B_ALLOW_DESTRUCTIVE !== "1") {
    throw new Error("Resetting the P02b database requires P02B_ALLOW_DESTRUCTIVE=1")
  }

  const sql = postgres(endpoint.url, {
    max: 1,
    idle_timeout: 5,
    connect_timeout: 10,
    onnotice: () => {},
  })

  try {
    const [row] = await sql`
      SELECT
        current_database() AS database,
        inet_server_addr()::text AS address,
        current_setting('server_version_num')::int AS version,
        coalesce(
          shobj_description((SELECT oid FROM pg_database WHERE datname = current_database()), 'pg_database'),
          ''
        ) AS comment
    `
    if (row.database !== endpoint.database) {
      throw new Error(`Connected to "${row.database}", expected "${endpoint.database}"`)
    }
    const address = row.address.split("/")[0]
    if (address !== "" && address !== "127.0.0.1" && address !== "::1") {
      throw new Error(`Refusing remote P02b server address "${row.address}"`)
    }
    if (row.version < 180000 || row.version >= 190000) {
      throw new Error(`P02b integration tests require PostgreSQL 18, got ${row.version}`)
    }
    if (row.comment !== P02B_MARKER) {
      throw new Error(`Refusing P02b database without marker "${P02B_MARKER}"`)
    }

    if (reset) {
      await sql.unsafe(
        "DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
      )
    }
    return { sql, endpoint, version: row.version }
  } catch (error) {
    await sql.end({ timeout: 1 }).catch(() => {})
    throw error
  }
}

export async function closeP02b(sql) {
  await sql.end({ timeout: 5 }).catch(() => {})
}

function quoteIdentifier(value) {
  return `"${value.replace(/"/g, '""')}"`
}

/**
 * Recreates the P02b target database from the seeded P02a template.
 * This is the unmanaged baseline path: no migration ledger is copied from the
 * template because the P02a seed never creates one.
 */
export async function resetFromUnmanagedBaseline() {
  const target = readP02bEndpoint()
  const templateRaw = process.env.P02A_TEMPLATE_DATABASE_URL
  if (!templateRaw) {
    throw new Error("P02A_TEMPLATE_DATABASE_URL is required for unmanaged adoption tests")
  }
  if (process.env.P02B_ALLOW_DESTRUCTIVE !== "1") {
    throw new Error("Recreating the P02b database requires P02B_ALLOW_DESTRUCTIVE=1")
  }
  const templateUrl = new URL(templateRaw)
  const template = decodeURIComponent(templateUrl.pathname.replace(/^\//, ""))
  if (!template.endsWith(P02A_SUFFIX)) {
    throw new Error(`Refusing template "${template}": name must end in ${P02A_SUFFIX}`)
  }

  const adminUrl = new URL(target.url)
  adminUrl.pathname = "/postgres"
  const admin = postgres(adminUrl.toString(), {
    max: 1,
    idle_timeout: 5,
    connect_timeout: 10,
    onnotice: () => {},
  })

  try {
    const meta = await admin`
      SELECT
        datname AS name,
        coalesce(shobj_description(oid, 'pg_database'), '') AS comment
      FROM pg_database
      WHERE datname IN (${template}, ${target.database})
    `
    const templateDb = Array.isArray(meta)
      ? meta.find((row) => row.name === template)
      : undefined
    if (!templateDb || templateDb.comment !== P02A_MARKER) {
      throw new Error(
        `Refusing template "${template}": expected marker "${P02A_MARKER}"`
      )
    }

    await admin`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = ${target.database} AND pid <> pg_backend_pid()
    `
    await admin.unsafe(`DROP DATABASE IF EXISTS ${quoteIdentifier(target.database)}`)
    await admin.unsafe(
      `CREATE DATABASE ${quoteIdentifier(target.database)} TEMPLATE ${quoteIdentifier(template)}`
    )
    await admin.unsafe(
      `COMMENT ON DATABASE ${quoteIdentifier(target.database)} IS '${P02B_MARKER}'`
    )
  } finally {
    await admin.end({ timeout: 5 }).catch(() => {})
  }
}
