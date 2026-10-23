// scripts/db/schema-fingerprint.mjs
//
// The single schema fingerprint implementation shared by the runner and the
// P02a fixture. Column order is deliberately ignored; types, nullability,
// defaults, indexes and constraints are compared.

const LEDGER_TABLES = new Set(["schema_migrations"])
export const BASELINE_RUNTIME_INDEX = "idx_snapshots_tracker_polled_covering"

export async function computeFingerprint(sql) {
  const columns = await sql`
    select table_name, column_name, data_type, udt_name, is_nullable, column_default
    from information_schema.columns
    where table_schema = 'public'
    order by table_name, column_name
  `

  const indexes = await sql`
    select tablename, indexname, indexdef
    from pg_indexes
    where schemaname = 'public'
    order by tablename, indexname
  `

  const constraints = await sql`
    select c.conrelid::regclass::text as table_name, c.conname, c.contype,
           pg_get_constraintdef(c.oid) as definition
    from pg_constraint c
    where c.connamespace = 'public'::regnamespace
    order by table_name, c.conname
  `

  const visibleColumns = columns.filter((column) => !LEDGER_TABLES.has(column.table_name))
  const tables = [...new Set(visibleColumns.map((column) => column.table_name))].sort()

  return {
    tables,
    columns: visibleColumns.map((column) => ({
      table: column.table_name,
      column: column.column_name,
      type: `${column.data_type}:${column.udt_name}`,
      nullable: column.is_nullable === "YES",
      default: column.column_default,
    })),
    indexes: indexes
      .filter((index) => !LEDGER_TABLES.has(index.tablename))
      .map((index) => ({
        table: index.tablename,
        index: index.indexname,
        definition: index.indexdef,
      })),
    constraints: constraints
      .filter((constraint) => !LEDGER_TABLES.has(constraint.table_name))
      .map((constraint) => ({
        table: constraint.table_name,
        constraint: constraint.conname,
        type: constraint.contype,
        definition: constraint.definition,
      })),
  }
}

export function serializeFingerprint(fingerprint) {
  return `${JSON.stringify(fingerprint, null, 2)}\n`
}

export function sameFingerprint(a, b) {
  return serializeFingerprint(a) === serializeFingerprint(b)
}

export function describeFingerprintDifference(actual, expected) {
  const actualTables = new Set(actual.tables)
  const expectedTables = new Set(expected.tables)
  const missing = [...expectedTables].filter((table) => !actualTables.has(table))
  const extra = [...actualTables].filter((table) => !expectedTables.has(table))

  const actualColumns = new Set(actual.columns.map((c) => `${c.table}.${c.column}`))
  const expectedColumns = new Set(expected.columns.map((c) => `${c.table}.${c.column}`))
  const missingColumns = [...expectedColumns].filter((c) => !actualColumns.has(c))
  const extraColumns = [...actualColumns].filter((c) => !expectedColumns.has(c))

  const actualIndexes = new Set(actual.indexes.map((i) => i.index))
  const expectedIndexes = new Set(expected.indexes.map((i) => i.index))
  const missingIndexes = [...expectedIndexes].filter((i) => !actualIndexes.has(i))
  const extraIndexes = [...actualIndexes].filter((i) => !expectedIndexes.has(i))

  const actualConstraints = new Set(actual.constraints.map((c) => c.constraint))
  const expectedConstraints = new Set(expected.constraints.map((c) => c.constraint))
  const missingConstraints = [...expectedConstraints].filter((c) => !actualConstraints.has(c))
  const extraConstraints = [...actualConstraints].filter((c) => !expectedConstraints.has(c))

  if (
    missing.length + extra.length + missingColumns.length + extraColumns.length +
      missingIndexes.length + extraIndexes.length + missingConstraints.length +
      extraConstraints.length ===
    0
  ) {
    return "tables and columns match; definitions differ"
  }

  return [
    missing.length ? `missing tables: ${missing.join(", ")}` : "",
    extra.length ? `extra tables: ${extra.join(", ")}` : "",
    missingColumns.length ? `missing columns: ${missingColumns.join(", ")}` : "",
    extraColumns.length ? `extra columns: ${extraColumns.join(", ")}` : "",
    missingIndexes.length ? `missing indexes: ${missingIndexes.join(", ")}` : "",
    extraIndexes.length ? `extra indexes: ${extraIndexes.join(", ")}` : "",
    missingConstraints.length ? `missing constraints: ${missingConstraints.join(", ")}` : "",
    extraConstraints.length ? `extra constraints: ${extraConstraints.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("; ")
}

function sameJson(a, b) {
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * Classify actual vs expected under the approved adoption policy.
 * Only an exactly missing baseline runtime index is repairable.
 */
export function classifyFingerprint(actual, expected) {
  if (sameFingerprint(actual, expected)) return { kind: "exact" }

  if (!sameJson(actual.tables, expected.tables)) {
    return { kind: "unknown", reason: describeFingerprintDifference(actual, expected) }
  }
  if (!sameJson(actual.columns, expected.columns)) {
    return { kind: "unknown", reason: describeFingerprintDifference(actual, expected) }
  }
  if (!sameJson(actual.constraints, expected.constraints)) {
    return { kind: "unknown", reason: describeFingerprintDifference(actual, expected) }
  }

  const expectedIndexes = new Map(expected.indexes.map((index) => [index.index, index]))
  const actualIndexes = new Map(actual.indexes.map((index) => [index.index, index]))
  const expectedWithoutRuntime = expected.indexes.filter(
    (index) => index.index !== BASELINE_RUNTIME_INDEX
  )

  if (!expectedIndexes.has(BASELINE_RUNTIME_INDEX)) {
    return { kind: "unknown", reason: "expected fingerprint has no baseline runtime index" }
  }
  if (actualIndexes.has(BASELINE_RUNTIME_INDEX)) {
    return { kind: "unknown", reason: describeFingerprintDifference(actual, expected) }
  }
  if (actual.indexes.length !== expectedWithoutRuntime.length) {
    return { kind: "unknown", reason: describeFingerprintDifference(actual, expected) }
  }
  for (const index of actual.indexes) {
    if (!sameJson(index, expectedIndexes.get(index.index))) {
      return { kind: "unknown", reason: describeFingerprintDifference(actual, expected) }
    }
  }
  for (const index of expectedWithoutRuntime) {
    if (!sameJson(actualIndexes.get(index.index), index)) {
      return { kind: "unknown", reason: describeFingerprintDifference(actual, expected) }
    }
  }

  return { kind: "missing_runtime_index", index: BASELINE_RUNTIME_INDEX }
}

export function validateFingerprintShape(value) {
  if (!value || typeof value !== "object") return false
  return (
    Array.isArray(value.tables) &&
    Array.isArray(value.columns) &&
    Array.isArray(value.indexes) &&
    Array.isArray(value.constraints)
  )
}
