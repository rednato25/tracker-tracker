// Canonical schema fingerprint for the frozen P02a baseline.
//
// The implementation is shared with the production migration runner in
// scripts/db/schema-fingerprint.mjs. Column order is deliberately ignored:
// historical `drizzle-kit push` runs can produce the same columns in a
// different order.

import { readFileSync } from "node:fs"
import type { SchemaFingerprint } from "../../../scripts/db/schema-fingerprint.mjs"


export type {
  ColumnFingerprint,
  ConstraintFingerprint,
  IndexFingerprint,
  SchemaFingerprint,
} from "../../../scripts/db/schema-fingerprint.mjs"
export {
  BASELINE_RUNTIME_INDEX,
  classifyFingerprint,
  computeFingerprint,
  describeFingerprintDifference,
  sameFingerprint,
  serializeFingerprint,
  validateFingerprintShape,
} from "../../../scripts/db/schema-fingerprint.mjs"

export function loadExpectedFingerprint(): SchemaFingerprint {
  const path = new URL("./schema-fingerprint.json", import.meta.url)
  return JSON.parse(readFileSync(path, "utf8")) as SchemaFingerprint
}
