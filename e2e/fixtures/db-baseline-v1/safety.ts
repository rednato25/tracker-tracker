// Shared guard for every P02a command.
//
// The database name is only the first check. The guard also verifies the
// effective server/database, refuses production and remote servers by default,
// and requires a marker comment before a command may touch an existing schema.

import postgres from "postgres"
import {
  FIXTURE_DATABASE_SUFFIX,
  FIXTURE_MARKER,
} from "./constants"

export interface FixtureEndpoint {
  url: string
  database: string
  host: string
}

export function readFixtureEndpoint(): FixtureEndpoint {
  const raw = process.env.P02A_DATABASE_URL
  if (!raw) {
    throw new Error("P02A_DATABASE_URL is required; do not fall back to DATABASE_URL")
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing P02a fixture work with NODE_ENV=production")
  }

  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    throw new Error("P02A_DATABASE_URL is not a valid URL")
  }

  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error("P02A_DATABASE_URL must use postgres:// or postgresql://")
  }

  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""))
  if (!database.endsWith(FIXTURE_DATABASE_SUFFIX)) {
    throw new Error(
      `Refusing database "${database}": P02a databases must end in ${FIXTURE_DATABASE_SUFFIX}`
    )
  }

  const host = parsed.hostname
  const localHosts = new Set(["127.0.0.1", "localhost", "::1", "[::1]"])
  if (!localHosts.has(host) && process.env.P02A_ALLOW_REMOTE !== "1") {
    throw new Error(
      `Refusing non-local database host "${host}"; set P02A_ALLOW_REMOTE=1 only for an isolated disposable server`
    )
  }

  return { url: raw, database, host }
}

export async function openFixture(options: {
  destructive?: boolean
  requireMarker?: boolean
}): Promise<{ sql: postgres.Sql; endpoint: FixtureEndpoint }> {
  const endpoint = readFixtureEndpoint()

  if (options.destructive && process.env.P02A_ALLOW_DESTRUCTIVE !== "1") {
    throw new Error("Destructive fixture setup requires P02A_ALLOW_DESTRUCTIVE=1")
  }

  const sql = postgres(endpoint.url, {
    max: 1,
    idle_timeout: 5,
    connect_timeout: 10,
    onnotice: () => {},
  })

  try {
    const [row] = await sql<
      { database: string; address: string; comment: string | null; tables: number }[]
    >`
      select
        current_database() as database,
        coalesce(inet_server_addr()::text, '') as address,
        coalesce(
          shobj_description((select oid from pg_database where datname = current_database()), 'pg_database'),
          ''
        ) as comment,
        (select count(*)::int from pg_tables where schemaname = 'public') as tables
    `

    if (!row || row.database !== endpoint.database) {
      throw new Error(
        `Connected to "${row?.database ?? "unknown"}", expected "${endpoint.database}"`
      )
    }

    const address = row.address.split("/")[0]
    const localAddress = address === "" || address === "127.0.0.1" || address === "::1"
    if (!localAddress && process.env.P02A_ALLOW_REMOTE !== "1") {
      throw new Error(
        `Refusing remote server address "${row.address}"; set P02A_ALLOW_REMOTE=1 only for an isolated disposable server`
      )
    }

    if (row.comment && row.comment !== FIXTURE_MARKER) {
      throw new Error(
        `Refusing database "${endpoint.database}": its marker is "${row.comment}", not "${FIXTURE_MARKER}"`
      )
    }

    if (options.destructive && row.tables > 0 && row.comment !== FIXTURE_MARKER) {
      throw new Error(
        `Refusing to reset "${endpoint.database}": it has tables but no P02a marker`
      )
    }

    if (options.requireMarker && row.comment !== FIXTURE_MARKER) {
      throw new Error(
        `Refusing "${endpoint.database}": run seed.ts first so the database carries the P02a marker`
      )
    }

    return { sql, endpoint }
  } catch (error) {
    await sql.end({ timeout: 1 }).catch(() => {})
    throw error
  }
}

export async function closeFixture(sql: postgres.Sql): Promise<void> {
  await sql.end({ timeout: 5 }).catch(() => {})
}
