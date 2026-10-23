// Recreates the frozen P02a baseline in a designated disposable database.
//
//   P02A_DATABASE_URL=postgresql://.../tracker_tracker_p02a \
//   P02A_ALLOW_DESTRUCTIVE=1 \
//   pnpm exec tsx e2e/fixtures/db-baseline-v1/seed.ts
//
// The schema comes from the frozen SQL snapshot, not from the current
// schema.ts. Credentials are synthetic and encrypted with the existing crypto
// helpers under the fixed fixture password.

import { readFileSync } from "node:fs"
import argon2 from "argon2"
import { deriveKey, deriveWrappingKey, encrypt } from "../../../src/lib/crypto"
import {
  FIXTURE_MARKER,
  FIXTURE_PASSWORD,
  FIXTURE_SALT,
  FIXTURE_SESSION_SECRET,
} from "./constants"
import { closeFixture, openFixture } from "./safety"

function readFixtureSql(name: string): string {
  return readFileSync(new URL(`./${name}`, import.meta.url), "utf8")
}

function statements(text: string): string[] {
  return text
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean)
}

async function main() {
  process.env.SESSION_SECRET = FIXTURE_SESSION_SECRET
  const { sql, endpoint } = await openFixture({ destructive: true })
  const database = endpoint.database.replace(/"/g, '""')

  try {
    const passwordHash = await argon2.hash(FIXTURE_PASSWORD)
    const key = await deriveKey(FIXTURE_PASSWORD, FIXTURE_SALT)
    const wrappedSchedulerKey = encrypt(key.toString("hex"), deriveWrappingKey())

    await sql.begin(async (tx) => {
      await tx.unsafe("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
      await tx.unsafe(
        `COMMENT ON DATABASE "${database}" IS '${FIXTURE_MARKER}'`
      )

      for (const statement of statements(readFixtureSql("schema/0000_baseline.sql"))) {
        await tx.unsafe(statement)
      }
      for (const statement of statements(readFixtureSql("runtime-indexes.sql"))) {
        await tx.unsafe(statement)
      }

      await tx`
        INSERT INTO app_settings
          (password_hash, encryption_salt, username, encrypted_scheduler_key,
           encrypted_proxy_password, dashboard_settings, credential_vault_enabled)
        VALUES
          (${passwordHash}, ${FIXTURE_SALT}, ${"p02a-fixture"}, ${wrappedSchedulerKey},
           ${encrypt("fixture-proxy-password", key)},
           ${JSON.stringify({ showTodayAtAGlance: true })}, true)
      `

      const [trackerA] = await tx<{ id: number }[]>`
        INSERT INTO trackers
          (name, base_url, api_path, platform_type, registry_slug, encrypted_api_token,
           is_active, joined_at, last_access_at, encrypted_credentials, encrypted_mousehole_token,
           is_favorite, sort_order)
        VALUES
          (${"Fixture Alpha"}, ${"https://fixture-alpha.example"}, ${"/api/user"}, ${"unit3d"},
           ${"aither"}, ${encrypt("fixture-api-token-alpha", key)}, true,
           ${"2025-01-15"}, ${"2026-10-20"},
           ${encrypt(JSON.stringify({ passkey: "fixture-passkey", nickServPassword: "fixture-nickserv" }), key)},
           ${encrypt("fixture-mousehole-token", key)}, true, 0)
        RETURNING id
      `
      const [trackerB] = await tx<{ id: number }[]>`
        INSERT INTO trackers
          (name, base_url, api_path, platform_type, registry_slug, encrypted_api_token,
           is_active, joined_at, last_access_at, is_favorite, sort_order)
        VALUES
          (${"Fixture Beta"}, ${"https://fixture-beta.example"}, ${"/api/user"}, ${"unit3d"},
           ${"blutopia"}, ${encrypt("fixture-api-token-beta", key)}, true,
           ${"2024-06-01"}, ${"2026-09-30"}, false, 1)
        RETURNING id
      `

      await tx`
        INSERT INTO tracker_snapshots
          (tracker_id, polled_at, uploaded_bytes, downloaded_bytes, ratio, buffer_bytes,
           seeding_count, leeching_count, seedbonus, hit_and_runs, required_ratio, warned,
           username, group_name, is_manual)
        VALUES
          (${trackerA.id}, ${"2026-10-18T10:00:00Z"}, ${"1000000000000"}, ${"250000000000"},
           ${4}, ${"750000000000"}, ${12}, ${0}, ${1234.5}, ${0}, ${1}, false,
           ${"fixture-alpha-user"}, ${"Power User"}, false),
          (${trackerA.id}, ${"2026-10-19T10:00:00Z"}, ${"1020000000000"}, ${"260000000000"},
           ${3.92}, ${"760000000000"}, ${13}, ${0}, ${1300}, ${0}, ${1}, false,
           ${"fixture-alpha-user"}, ${"Power User"}, false),
          (${trackerA.id}, ${"2026-10-20T10:00:00Z"}, ${"1040000000000"}, ${"270000000000"},
           ${3.85}, ${"770000000000"}, ${14}, ${0}, ${1375}, ${0}, ${1}, false,
           ${"fixture-alpha-user"}, ${"Power User"}, false),
          (${trackerB.id}, ${"2026-10-19T10:00:00Z"}, ${"500000000000"}, ${"100000000000"},
           ${5}, ${"400000000000"}, ${6}, ${0}, ${220}, ${1}, ${0.6}, true,
           ${"fixture-beta-user"}, ${"Member"}, false),
          (${trackerB.id}, ${"2026-10-20T10:00:00Z"}, ${"510000000000"}, ${"105000000000"},
           ${4.86}, ${"405000000000"}, ${6}, ${0}, ${230}, ${1}, ${0.6}, true,
           ${"fixture-beta-user"}, ${"Member"}, false)
      `

      await tx`
        INSERT INTO tracker_roles (tracker_id, role_name, achieved_at, notes)
        VALUES (${trackerA.id}, ${"Fixture Role"}, ${"2025-06-01T12:00:00Z"}, ${"synthetic"})
      `

      const [client] = await tx<{ id: number }[]>`
        INSERT INTO download_clients
          (name, type, enabled, host, port, use_ssl, auth_method,
           encrypted_username, encrypted_password, encrypted_api_key, encrypted_url_path,
           poll_interval_seconds, is_default, cross_seed_tags)
        VALUES
          (${"Fixture qBittorrent"}, ${"qbittorrent"}, true, ${"fixture-qbt.example"}, 8080,
           false, ${"password"}, ${encrypt("fixture-client-user", key)},
           ${encrypt("fixture-client-password", key)}, ${encrypt("", key)},
           ${encrypt("", key)}, 300, true, ARRAY[${"fixture-tag"}])
        RETURNING id
      `

      const [target] = await tx<{ id: number }[]>`
        INSERT INTO notification_targets
          (name, type, enabled, encrypted_config, notify_ratio_danger, include_tracker_name)
        VALUES
          (${"Fixture Discord"}, ${"discord"}, true,
           ${encrypt(JSON.stringify({ webhookUrl: "https://discord.example/webhook" }), key)},
           true, true)
        RETURNING id
      `

      await tx`
        INSERT INTO notification_delivery_state
          (target_id, tracker_id, event_type, last_notified_at, snoozed_until)
        VALUES
          (${target.id}, ${trackerA.id}, ${"ratio_danger"},
           ${"2026-10-20T09:00:00Z"}, ${"2026-10-20T10:00:00Z"})
      `

      const [group] = await tx<{ id: number }[]>`
        INSERT INTO tag_groups (name, emoji, chart_type, description, sort_order)
        VALUES (${"Fixture Group"}, ${"@"}, ${"bar"}, ${"synthetic"}, 0)
        RETURNING id
      `
      await tx`
        INSERT INTO tag_group_members (group_id, tag, label, color, sort_order)
        VALUES (${group.id}, ${"fixture-tag"}, ${"Fixture Tag"}, ${"#9e3f1f"}, 0)
      `

      await tx`
        INSERT INTO client_snapshots
          (client_id, polled_at, total_seeding_count, total_leeching_count,
           upload_speed_bytes, download_speed_bytes, tag_stats)
        VALUES
          (${client.id}, ${"2026-10-20T10:00:00Z"}, 20, 1, ${"1250000"}, ${"250000"},
           ${JSON.stringify({ "fixture-tag": 20 })})
      `
      await tx`
        INSERT INTO client_uptime_buckets (client_id, bucket_ts, ok, fail)
        VALUES (${client.id}, ${"2026-10-20T10:00:00Z"}, 5, 0)
      `
      await tx`
        INSERT INTO backup_history (size_bytes, encrypted, frequency, status, storage_path, notes)
        VALUES (4096, false, ${"daily"}, ${"completed"}, ${"/data/backups/fixture.json"}, ${"synthetic"})
      `
      await tx`
        INSERT INTO dismissed_alerts (alert_key, alert_type, dismissed_at)
        VALUES (${"fixture-alert"}, ${"stale-data"}, ${"2026-10-20T10:00:00Z"})
      `
      await tx`
        INSERT INTO tracker_daily_checkpoints
          (tracker_id, checkpoint_date, uploaded_bytes_end, downloaded_bytes_end,
           buffer_bytes_end, ratio_end, seedbonus_end, snapshot_count)
        VALUES
          (${trackerA.id}, ${"2026-10-20"}, ${"1040000000000"}, ${"270000000000"},
           ${"770000000000"}, ${3.85}, ${1375}, 3)
      `
      await tx`
        INSERT INTO torrent_daily_checkpoints
          (client_id, hash, name, checkpoint_date, uploaded_start, downloaded_start)
        VALUES
          (${client.id}, ${"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"},
           ${"fixture.torrent"}, ${"2026-10-20"}, ${"1000"}, ${"500"})
      `
      await tx`
        INSERT INTO db_size_history (recorded_at, total_bytes)
        VALUES (${"2026-10-20"}, ${"1048576"})
      `
      await tx`INSERT INTO app_liveness DEFAULT VALUES`
      await tx`
        INSERT INTO app_coverage_gaps (started_at, ended_at, reason)
        VALUES (${"2026-10-20T00:00:00Z"}, ${"2026-10-20T01:00:00Z"}, ${"restart"})
      `
      await tx`
        INSERT INTO tracker_outages (tracker_id, started_at, ended_at, reason)
        VALUES (${trackerA.id}, ${"2026-10-19T00:00:00Z"}, ${"2026-10-19T01:00:00Z"}, ${"down"})
      `
    })

    console.log(`seed: fixture created in ${endpoint.host}/${endpoint.database}`)
  } finally {
    await closeFixture(sql)
  }
}

main().catch((error) => {
  console.error(`seed failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
