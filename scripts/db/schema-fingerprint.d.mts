export interface ColumnFingerprint {
  table: string
  column: string
  type: string
  nullable: boolean
  default: string | null
}

export interface IndexFingerprint {
  table: string
  index: string
  definition: string
}

export interface ConstraintFingerprint {
  table: string
  constraint: string
  type: string
  definition: string
}

export interface SchemaFingerprint {
  tables: string[]
  columns: ColumnFingerprint[]
  indexes: IndexFingerprint[]
  constraints: ConstraintFingerprint[]
}

export const BASELINE_RUNTIME_INDEX: string

export function computeFingerprint(sql: unknown): Promise<SchemaFingerprint>
export function serializeFingerprint(fingerprint: SchemaFingerprint): string
export function sameFingerprint(a: SchemaFingerprint, b: SchemaFingerprint): boolean
export function describeFingerprintDifference(
  actual: SchemaFingerprint,
  expected: SchemaFingerprint
): string
export function classifyFingerprint(
  actual: SchemaFingerprint,
  expected: SchemaFingerprint
):
  | { kind: "exact" }
  | { kind: "missing_runtime_index"; index: string }
  | { kind: "unknown"; reason: string }
export function validateFingerprintShape(value: unknown): boolean
