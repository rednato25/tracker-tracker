// Baseline adoption guard.
//
//   check-baseline.ts            compare the live public schema to the frozen baseline
//   check-baseline.ts --write    write schema-fingerprint.json from the live fixture
//   check-baseline.ts --self-test-unknown
//                                prove that an extra column is rejected, then roll back
//
// This is the check P02b must run before inserting the baseline row into the
// migration ledger. Existing tables alone are not proof of adoption.

import { writeFileSync } from "node:fs"
import {
  computeFingerprint,
  describeFingerprintDifference,
  loadExpectedFingerprint,
  serializeFingerprint,
} from "./fingerprint"
import { closeFixture, openFixture } from "./safety"

async function main() {
  const write = process.argv.includes("--write")
  const selfTest = process.argv.includes("--self-test-unknown")
  const { sql, endpoint } = await openFixture({ requireMarker: true })

  try {
    const actual = await computeFingerprint(sql)

    if (write) {
      const path = new URL("./schema-fingerprint.json", import.meta.url)
      writeFileSync(path, serializeFingerprint(actual), "utf8")
      console.log(
        `baseline: wrote ${actual.tables.length} tables and ${actual.indexes.length} indexes to schema-fingerprint.json`
      )
      return
    }

    const expected = loadExpectedFingerprint()
    const same = serializeFingerprint(actual) === serializeFingerprint(expected)
    if (!same) {
      throw new Error(
        `baseline rejected for ${endpoint.database}: ${describeFingerprintDifference(actual, expected)}`
      )
    }
    console.log(`baseline: ${endpoint.database} matches the frozen schema`)

    if (selfTest) {
      await sql.unsafe("BEGIN")
      try {
        await sql.unsafe("ALTER TABLE trackers ADD COLUMN p02a_unknown_column text")
        const changed = await computeFingerprint(sql)
        if (serializeFingerprint(changed) === serializeFingerprint(expected)) {
          throw new Error("self-test failed: an extra column was not detected")
        }
        console.log("baseline: unknown-schema self-test rejected the extra column")
      } finally {
        await sql.unsafe("ROLLBACK")
      }
    }
  } catch (error) {
    console.error(`baseline check failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  } finally {
    await closeFixture(sql)
  }
}

main().catch((error) => {
  console.error(`baseline check error: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
