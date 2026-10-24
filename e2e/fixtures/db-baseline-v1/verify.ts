// Verification for the frozen P02a fixture.
//
//   P02A_DATABASE_URL=postgresql://.../tracker_tracker_p02a \
//   pnpm exec tsx e2e/fixtures/db-baseline-v1/verify.ts
//
// This script is read-only against the fixture database. It verifies the schema
// fingerprint, representative row counts, encryption, indexes, constraints and
// the backup export/validation path. It does not execute the restore route and
// never connects to a production database.

import { generateBackupPayload, validateBackupJson } from "../../../src/lib/backup"
import { decrypt, deriveKey, deriveWrappingKey } from "../../../src/lib/crypto"
import {
  FIXTURE_PASSWORD,
  FIXTURE_SALT,
  FIXTURE_SESSION_SECRET,
} from "./constants"
import {
  computeFingerprint,
  describeFingerprintDifference,
  loadExpectedFingerprint,
  serializeFingerprint,
} from "./fingerprint"
import { closeFixture, openFixture } from "./safety"

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

async function main() {
  const schemaOnly = process.argv.includes("--schema-only")
  process.env.SESSION_SECRET = FIXTURE_SESSION_SECRET
  const { sql, endpoint } = await openFixture({ requireMarker: true })

  try {
    const expected = loadExpectedFingerprint()
    const actual = await computeFingerprint(sql)
    assert(
      serializeFingerprint(actual) === serializeFingerprint(expected),
      `schema mismatch: ${describeFingerprintDifference(actual, expected)}`
    )
    console.log(
      `schema: ${actual.tables.length} tables, ${actual.indexes.length} indexes, ${actual.constraints.length} constraints`
    )

    const [counts] = await sql<{
      trackers: number
      snapshots: number
      clients: number
      targets: number
      deliveries: number
      checkpoints: number
    }[]>`
      SELECT
        (SELECT count(*)::int FROM trackers) AS trackers,
        (SELECT count(*)::int FROM tracker_snapshots) AS snapshots,
        (SELECT count(*)::int FROM download_clients) AS clients,
        (SELECT count(*)::int FROM notification_targets) AS targets,
        (SELECT count(*)::int FROM notification_delivery_state) AS deliveries,
        (SELECT count(*)::int FROM tracker_daily_checkpoints) AS checkpoints
    `
    assert(counts.trackers === 2, `expected 2 trackers, got ${counts.trackers}`)
    assert(counts.snapshots === 5, `expected 5 snapshots, got ${counts.snapshots}`)
    assert(counts.clients === 1, `expected 1 download client, got ${counts.clients}`)
    assert(counts.targets === 1, `expected 1 notification target, got ${counts.targets}`)
    assert(counts.deliveries === 1, `expected 1 delivery state, got ${counts.deliveries}`)
    assert(counts.checkpoints === 1, `expected 1 checkpoint, got ${counts.checkpoints}`)
    console.log("rows: representative counts match")

    const key = await deriveKey(FIXTURE_PASSWORD, FIXTURE_SALT)
    const [tracker] = await sql<{
      encrypted_api_token: string
      encrypted_credentials: string | null
      encrypted_mousehole_token: string | null
    }[]>`
      SELECT encrypted_api_token, encrypted_credentials, encrypted_mousehole_token
      FROM trackers
      WHERE name = 'Fixture Alpha'
    `
    assert(
      decrypt(tracker.encrypted_api_token, key) === "fixture-api-token-alpha",
      "tracker API token did not decrypt"
    )
    assert(
      tracker.encrypted_credentials !== null &&
        JSON.parse(decrypt(tracker.encrypted_credentials, key)).passkey === "fixture-passkey",
      "tracker credential vault did not decrypt"
    )
    assert(
      tracker.encrypted_mousehole_token !== null &&
        decrypt(tracker.encrypted_mousehole_token, key) === "fixture-mousehole-token",
      "mousehole token did not decrypt"
    )

    const [client] = await sql<{ encrypted_username: string; encrypted_password: string }[]>`
      SELECT encrypted_username, encrypted_password FROM download_clients LIMIT 1
    `
    assert(
      decrypt(client.encrypted_username, key) === "fixture-client-user",
      "client username did not decrypt"
    )
    assert(
      decrypt(client.encrypted_password, key) === "fixture-client-password",
      "client password did not decrypt"
    )

    const [target] = await sql<{ encrypted_config: string }[]>`
      SELECT encrypted_config FROM notification_targets LIMIT 1
    `
    assert(
      JSON.parse(decrypt(target.encrypted_config, key)).webhookUrl ===
        "https://discord.example/webhook",
      "notification config did not decrypt"
    )

    const [settings] = await sql<{ encrypted_scheduler_key: string | null }[]>`
      SELECT encrypted_scheduler_key FROM app_settings LIMIT 1
    `
    assert(settings.encrypted_scheduler_key !== null, "scheduler key is missing")
    assert(
      decrypt(settings.encrypted_scheduler_key, deriveWrappingKey()) === key.toString("hex"),
      "scheduler key did not unwrap to the fixture master key"
    )
    console.log("crypto: tracker, client, notification and scheduler ciphertext decrypt")

    const [covering] = await sql<{ count: number }[]>`
      SELECT count(*)::int AS count FROM pg_indexes
      WHERE schemaname = 'public' AND indexname = 'idx_snapshots_tracker_polled_covering'
    `
    assert(covering.count === 1, "runtime covering index is missing")

    const [unique] = await sql<{ count: number }[]>`
      SELECT count(*)::int AS count FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = 'uq_delivery_state_target_tracker_event'
        AND indexdef LIKE 'CREATE UNIQUE INDEX%'
    `
    assert(unique.count === 1, "delivery-state unique index is missing")

    const [fk] = await sql<{ count: number }[]>`
      SELECT count(*)::int AS count FROM pg_constraint
      WHERE conname = 'fk_delivery_state_target'
    `
    assert(fk.count === 1, "delivery-state foreign key is missing")
    console.log("integrity: covering index, unique constraint and foreign key present")

    if (schemaOnly) {
      console.log("backup: skipped in schema-only mode (pre-migration fixture)")
      console.log(`verify: ${endpoint.host}/${endpoint.database} passed`)
      return
    }

    process.env.DATABASE_URL = endpoint.url
    const payload = await generateBackupPayload()
    validateBackupJson(payload)
    assert(payload.trackers.length === 2, "backup did not include both trackers")
    assert(payload.trackerSnapshots.length === 5, "backup did not include all snapshots")
    assert(payload.notificationTargets?.length === 1, "backup did not include notification target")
    assert(
      payload.notificationTargets?.[0]?.encryptedConfig,
      "backup did not carry encrypted notification config"
    )
    console.log("backup: payload generated and validated with encrypted fields intact")

    console.log(`verify: ${endpoint.host}/${endpoint.database} passed`)
  } catch (error) {
    console.error(`verify failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  } finally {
    await closeFixture(sql)
  }
}

main().catch((error) => {
  console.error(`verify error: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
