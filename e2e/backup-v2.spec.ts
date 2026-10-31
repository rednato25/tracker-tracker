// e2e/backup-v2.spec.ts
//
// Authenticated HTTP coverage for the v2 backup contract. It seeds synthetic
// rows through SQL (using the app's real crypto helpers), exports and restores
// through the real routes, and reads the result back over HTTP and SQL.
//
// The database is the throwaway tracker_tracker_e2e; e2e/db.ts refuses any
// other name. No real tracker or notification endpoint is contacted: every
// seeded row is disabled and the credentials are synthetic.
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  type APIRequestContext,
  expect,
  request as playwrightRequest,
  test,
} from "@playwright/test"
import { decrypt, deriveKey, encrypt } from "../src/lib/crypto"
import { withBackgroundRestoreGuard } from "../src/lib/restore-lock"
import { e2eSql, migrationLedger } from "./db"
import { E2E_OWNER } from "./fixtures"

const DB_PASSWORD = E2E_OWNER.password

type Seed = {
  trackerId: number
  clientId: number
  targetId: number
  dir: string
  key: Buffer
  plaintext: {
    trackerToken: string
    mouseholeToken: string
    clientUsername: string
    clientPassword: string
    clientUrlPath: string
    notificationConfig: string
  }
}

let seed: Seed

async function seedDatabase(): Promise<Seed> {
  const sql = e2eSql()
  const dir = await mkdtemp(join(tmpdir(), "tt-e2e-v2-"))
  const plaintext = {
    trackerToken: "e2e-tracker-token-v2",
    mouseholeToken: "e2e-mousehole-token-v2",
    clientUsername: "e2e-qbt-user",
    clientPassword: "e2e-qbt-password",
    clientUrlPath: "/e2e-qbt-path",
    notificationConfig: JSON.stringify({ webhookUrl: "https://example.test/hook" }),
  }

  try {
    const [settings] = await sql<{ encryption_salt: string }[]>`
      select encryption_salt from app_settings limit 1
    `
    expect(settings?.encryption_salt).toBeTruthy()
    const key = await deriveKey(DB_PASSWORD, settings.encryption_salt)

    const [tracker] = await sql<{ id: number }[]>`
      insert into trackers (
        name, base_url, api_path, platform_type, encrypted_api_token,
        encrypted_mousehole_token, is_active, created_at, updated_at
      ) values (
        'E2E Backup Tracker', 'https://tracker.example.test', '/api/user', 'unit3d',
        ${encrypt(plaintext.trackerToken, key)}, ${encrypt(plaintext.mouseholeToken, key)},
        false, now(), now()
      ) returning id
    `

    const [client] = await sql<{ id: number }[]>`
      insert into download_clients (
        name, type, enabled, host, port, encrypted_username, encrypted_password,
        encrypted_url_path, poll_interval_seconds, cross_seed_tags, created_at, updated_at
      ) values (
        'E2E qbt', 'qbittorrent', false, 'client.example.test', 8080,
        ${encrypt(plaintext.clientUsername, key)},
        ${encrypt(plaintext.clientPassword, key)},
        ${encrypt(plaintext.clientUrlPath, key)},
        300, '{}', now(), now()
      ) returning id
    `

    const [target] = await sql<{ id: number }[]>`
      insert into notification_targets (
        name, type, enabled, encrypted_config, notify_ratio_drop, scope, created_at, updated_at
      ) values (
        'E2E discord', 'discord', false, ${encrypt(plaintext.notificationConfig, key)},
        true, ARRAY[${tracker.id}]::int[], now(), now()
      ) returning id
    `

    await sql`
      insert into tracker_snapshots (
        tracker_id, polled_at, uploaded_bytes, downloaded_bytes, ratio, buffer_bytes, is_manual
      ) values (
        ${tracker.id}, '2026-01-01T00:00:00.000Z', 1000, 500, 2, 250, false
      )
    `
    await sql`
      insert into tracker_daily_checkpoints (
        tracker_id, checkpoint_date, uploaded_bytes_end, downloaded_bytes_end,
        buffer_bytes_end, ratio_end, seedbonus_end, snapshot_count
      ) values (${tracker.id}, '2026-01-01', 1000, 500, 250, 2, 100, 10)
    `
    await sql`
      insert into torrent_daily_checkpoints (
        client_id, hash, name, checkpoint_date, uploaded_start, downloaded_start
      ) values (
        ${client.id}, ${"a".repeat(40)}, 'E2E Torrent', '2026-01-01', 100, 50
      )
    `
    await sql`
      insert into notification_delivery_state (
        target_id, tracker_id, event_type, last_notified_at, snoozed_until
      ) values (
        ${target.id}, ${tracker.id}, 'ratio_drop', '2026-01-02T00:00:00.000Z',
        '2030-01-02T00:00:00.000Z'
      )
    `

    return {
      trackerId: tracker.id,
      clientId: client.id,
      targetId: target.id,
      dir,
      key,
      plaintext,
    }
  } finally {
    await sql.end()
  }
}

async function exportBackup(
  request: APIRequestContext,
  backupPassword?: string
): Promise<{ filename: string; buffer: Buffer }> {
  const response = await request.post("/api/settings/backup/export", {
    multipart: backupPassword ? { backupPassword } : {},
  })
  expect(response.ok()).toBe(true)
  const body = (await response.json()) as { success?: boolean; filename?: string }
  expect(body.filename).toBeTruthy()
  const buffer = await readFile(join(seed.dir, body.filename as string))
  return { filename: body.filename as string, buffer }
}

function restore(
  request: APIRequestContext,
  buffer: Buffer,
  fileName: string,
  extra: Record<string, string> = {}
) {
  return request.post("/api/settings/backup/restore", {
    multipart: {
      file: { name: fileName, mimeType: "application/json", buffer },
      masterPassword: DB_PASSWORD,
      ...extra,
    },
  })
}

function normalized(payload: Record<string, unknown>) {
  const trackers = payload.trackers as Record<string, unknown>[]
  const clients = payload.downloadClients as Record<string, unknown>[]
  const targets = payload.notificationTargets as Record<string, unknown>[]
  const trackerName = new Map(trackers.map((t) => [t.id as number, t.name as string]))
  const clientName = new Map(clients.map((c) => [c.id as number, c.name as string]))
  const targetName = new Map(targets.map((t) => [t.id as number, t.name as string]))

  const sort = <T>(rows: T[]) =>
    rows.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))

  return {
    trackers: sort(trackers.map((t) => t.name as string)),
    snapshots: sort(
      (payload.trackerSnapshots as Record<string, unknown>[]).map((s) => ({
        tracker: trackerName.get(s.trackerId as number),
        uploaded: s.uploadedBytes,
        downloaded: s.downloadedBytes,
      }))
    ),
    clients: sort(clients.map((c) => c.name as string)),
    targets: sort(
      targets.map((t) => ({
        name: t.name,
        type: t.type,
        scope: (t.scope as number[] | null)?.map((id) => trackerName.get(id)) ?? null,
      }))
    ),
    delivery: sort(
      (payload.notificationDeliveryState as Record<string, unknown>[]).map((d) => ({
        target: targetName.get(d.targetId as number),
        tracker: d.trackerId === null ? null : trackerName.get(d.trackerId as number),
        event: d.eventType,
        lastNotifiedAt: d.lastNotifiedAt,
        snoozedUntil: d.snoozedUntil,
      }))
    ),
    trackerCheckpoints: sort(
      (payload.trackerDailyCheckpoints as Record<string, unknown>[]).map((c) => ({
        tracker: trackerName.get(c.trackerId as number),
        date: c.checkpointDate,
        uploaded: c.uploadedBytesEnd,
        downloaded: c.downloadedBytesEnd,
      }))
    ),
    torrentCheckpoints: sort(
      (payload.torrentDailyCheckpoints as Record<string, unknown>[]).map((c) => ({
        client: clientName.get(c.clientId as number),
        hash: c.hash,
        date: c.checkpointDate,
        uploaded: c.uploadedStart,
      }))
    ),
  }
}

test.describe.serial("backup format v2 over authenticated HTTP", () => {
  test.beforeAll(async ({ request }) => {
    seed = await seedDatabase()
    const pathSet = await request.patch("/api/settings", {
      data: { backupStoragePath: seed.dir },
    })
    expect(pathSet.ok()).toBe(true)
  })

  test.afterAll(async ({ request }) => {
    await request.patch("/api/settings", { data: { backupStoragePath: null } })
    if (seed?.dir) await rm(seed.dir, { recursive: true, force: true })
    // The injected-failure case leaves the seeded tracker renamed. Remove every
    // synthetic row this file creates so later specs see an empty tracker set.
    const sql = e2eSql()
    try {
      await sql`delete from notification_targets where name = 'E2E discord'`
      await sql`delete from trackers where name in ('E2E Backup Tracker', 'before-injected-failure')`
      await sql`delete from download_clients where name = 'E2E qbt'`
    } finally {
      await sql.end()
    }
  })

  test("export writes v2 with durable history, restore round-trips it, and the ledger is untouched", async ({
    request,
  }) => {
    const ledgerBefore = await migrationLedger()
    const exported = await exportBackup(request)
    const payload = JSON.parse(exported.buffer.toString("utf8")) as Record<string, unknown>
    expect((payload.manifest as Record<string, unknown>).version).toBe(2)
    expect(payload.notificationDeliveryState).toHaveLength(1)
    expect(payload.trackerDailyCheckpoints).toHaveLength(1)
    expect(payload.torrentDailyCheckpoints).toHaveLength(1)

    const before = normalized(payload)

    const sql = e2eSql()
    try {
      await sql`update trackers set name = 'mutated' where id = ${seed.trackerId}`
      await sql`delete from notification_delivery_state`
      await sql`delete from tracker_daily_checkpoints`
      await sql`delete from torrent_daily_checkpoints`
      await sql`delete from download_clients where id = ${seed.clientId}`
    } finally {
      await sql.end()
    }

    const restored = await restore(request, exported.buffer, exported.filename)
    expect(restored.status()).toBe(200)
    const body = (await restored.json()) as Record<string, unknown>
    expect(body).toMatchObject({
      success: true,
      legacyHistoryUnavailable: false,
      history: {
        version: 2,
        notificationDeliveryState: "restored",
        trackerDailyCheckpoints: "restored",
        torrentDailyCheckpoints: "restored",
      },
    })

    expect(await migrationLedger()).toEqual(ledgerBefore)

    const again = await exportBackup(request)
    const after = normalized(JSON.parse(again.buffer.toString("utf8")) as Record<string, unknown>)
    expect(after).toEqual(before)
  })

  test("restored credentials decrypt with the destination master key", async () => {
    const sql = e2eSql()
    try {
      const [settings] = await sql<
        { encryption_salt: string; encrypted_scheduler_key: string | null }[]
      >`select encryption_salt, encrypted_scheduler_key from app_settings limit 1`
      // Restore deliberately does not carry the destination's scheduler key.
      expect(settings.encrypted_scheduler_key).toBeNull()
      const key = await deriveKey(DB_PASSWORD, settings.encryption_salt)
      const [tracker] = await sql<
        { encrypted_api_token: string; encrypted_mousehole_token: string }[]
      >`select encrypted_api_token, encrypted_mousehole_token from trackers limit 1`
      const [client] = await sql<
        {
          encrypted_username: string
          encrypted_password: string
          encrypted_url_path: string
        }[]
      >`select encrypted_username, encrypted_password, encrypted_url_path from download_clients limit 1`
      const [target] = await sql<{ encrypted_config: string }[]>`
        select encrypted_config from notification_targets limit 1
      `

      expect(decrypt(tracker.encrypted_api_token, key)).toBe(seed.plaintext.trackerToken)
      expect(decrypt(tracker.encrypted_mousehole_token, key)).toBe(
        seed.plaintext.mouseholeToken
      )
      expect(decrypt(client.encrypted_username, key)).toBe(seed.plaintext.clientUsername)
      expect(decrypt(client.encrypted_password, key)).toBe(seed.plaintext.clientPassword)
      expect(decrypt(client.encrypted_url_path, key)).toBe(seed.plaintext.clientUrlPath)
      expect(decrypt(target.encrypted_config, key)).toBe(seed.plaintext.notificationConfig)
    } finally {
      await sql.end()
    }
  })

  test("v1 import reports missing history and writes no v2 rows", async ({ request }) => {
    const ledgerBefore = await migrationLedger()
    const exported = await exportBackup(request)
    const v2 = JSON.parse(exported.buffer.toString("utf8")) as Record<string, unknown>
    const v1 = {
      ...v2,
      manifest: { ...(v2.manifest as object), version: 1 },
    } as Record<string, unknown>
    for (const field of [
      "notificationDeliveryState",
      "trackerDailyCheckpoints",
      "torrentDailyCheckpoints",
    ]) {
      delete v1[field]
    }

    const restored = await restore(
      request,
      Buffer.from(JSON.stringify(v1)),
      "backup-v1.json"
    )
    expect(restored.status()).toBe(200)
    expect(await restored.json()).toMatchObject({
      legacyHistoryUnavailable: true,
      history: {
        version: 1,
        notificationDeliveryState: "unavailable",
        trackerDailyCheckpoints: "unavailable",
        torrentDailyCheckpoints: "unavailable",
      },
    })

    const sql = e2eSql()
    try {
      const [counts] = await sql<
        {
          delivery: number
          tracker_checkpoints: number
          torrent_checkpoints: number
        }[]
      >`select
        (select count(*)::int from notification_delivery_state) as delivery,
        (select count(*)::int from tracker_daily_checkpoints) as tracker_checkpoints,
        (select count(*)::int from torrent_daily_checkpoints) as torrent_checkpoints`
      expect(counts).toEqual({ delivery: 0, tracker_checkpoints: 0, torrent_checkpoints: 0 })
    } finally {
      await sql.end()
    }
    expect(await migrationLedger()).toEqual(ledgerBefore)
  })

  test("a v1 payload carrying v2 fields is rejected before mutation", async ({ request }) => {
    const exported = await exportBackup(request)
    const payload = JSON.parse(exported.buffer.toString("utf8")) as Record<string, unknown>
    ;(payload.manifest as Record<string, unknown>).version = 1

    const response = await restore(
      request,
      Buffer.from(JSON.stringify(payload)),
      "bad-v1.json",
      {}
    )
    expect(response.status()).toBe(400)
    expect(await (await request.get("/api/trackers")).json()).toHaveLength(1)
  })

  test("wrong backup password and corrupt ciphertext do not partially restore", async ({
    request,
  }) => {
    const exported = await exportBackup(request, "e2e-file-password")
    const envelope = JSON.parse(exported.buffer.toString("utf8")) as Record<string, unknown>

    const wrong = await restore(request, exported.buffer, exported.filename, {
      backupPassword: "definitely-wrong",
    })
    expect(wrong.status()).toBe(400)
    expect(await (await request.get("/api/trackers")).json()).toHaveLength(1)

    const corrupted = Buffer.from(envelope.ciphertext as string, "base64")
    corrupted[20] ^= 0xff
    envelope.ciphertext = corrupted.toString("base64")
    const corrupt = await restore(
      request,
      Buffer.from(JSON.stringify(envelope)),
      "corrupt.ttbak",
      { backupPassword: "e2e-file-password" }
    )
    expect(corrupt.status()).toBe(400)
    expect(await (await request.get("/api/trackers")).json()).toHaveLength(1)

    const good = await restore(request, exported.buffer, exported.filename, {
      backupPassword: "e2e-file-password",
    })
    expect(good.status()).toBe(200)
  })

  test("unsupported version and invalid relationships are rejected before mutation", async ({
    request,
  }) => {
    const exported = await exportBackup(request)
    const v2 = JSON.parse(exported.buffer.toString("utf8")) as Record<string, unknown>
    const ledgerBefore = await migrationLedger()

    const v3 = structuredClone(v2)
    ;(v3.manifest as Record<string, unknown>).version = 3
    const unsupported = await restore(
      request,
      Buffer.from(JSON.stringify(v3)),
      "v3.json"
    )
    expect(unsupported.status()).toBe(400)
    expect(await migrationLedger()).toEqual(ledgerBefore)
    expect(await (await request.get("/api/trackers")).json()).toHaveLength(1)

    const broken = structuredClone(v2)
    ;(broken.notificationTargets as Record<string, unknown>[])[0].scope = [999999]
    const invalid = await restore(
      request,
      Buffer.from(JSON.stringify(broken)),
      "broken.json"
    )
    expect(invalid.status()).toBe(400)
    expect(await migrationLedger()).toEqual(ledgerBefore)
    expect(await (await request.get("/api/trackers")).json()).toHaveLength(1)
  })

  test("an in-flight background operation blocks restore, then it resumes", async ({
    request,
  }) => {
    const exported = await exportBackup(request)
    const sql = e2eSql()
    const held = await sql.reserve()
    try {
      await held`select pg_advisory_lock(hashtext('tracker-tracker:restore-v1'), 1)`
      const busy = await restore(request, exported.buffer, exported.filename)
      expect(busy.status()).toBe(503)
      expect(await (await request.get("/api/trackers")).json()).toHaveLength(1)
    } finally {
      await held`select pg_advisory_unlock(hashtext('tracker-tracker:restore-v1'), 1)`
      held.release()
      await sql.end()
    }

    const resumed = await restore(request, exported.buffer, exported.filename)
    expect(resumed.status()).toBe(200)
  })

  test("the background guard skips while a restore lock is held", async () => {
    const sql = e2eSql()
    const held = await sql.reserve()
    let ran = false
    try {
      await held`select pg_advisory_lock(hashtext('tracker-tracker:restore-v1'), 1)`
      const skipped = await withBackgroundRestoreGuard("e2e-lock-probe", async () => {
        ran = true
        return "ran"
      })
      expect(skipped).toBeNull()
      expect(ran).toBe(false)
    } finally {
      await held`select pg_advisory_unlock(hashtext('tracker-tracker:restore-v1'), 1)`
      held.release()
      await sql.end()
    }

    const result = await withBackgroundRestoreGuard("e2e-lock-probe", async () => "ran")
    expect(result).toBe("ran")
    expect(ran).toBe(false)
  })

  test("an injected insert failure rolls the entire restore back", async ({ request }) => {
    const exported = await exportBackup(request)
    const sql = e2eSql()
    try {
      const [currentTracker] = await sql<{ id: number }[]>`
        select id from trackers order by id limit 1
      `
      const [currentClient] = await sql<{ id: number }[]>`
        select id from download_clients order by id limit 1
      `
      await sql`
        update trackers set name = 'before-injected-failure' where id = ${currentTracker.id}
      `
      await sql`delete from download_clients where id = ${currentClient.id}`
      await sql.unsafe(`
        create or replace function e2e_fail_snapshot() returns trigger as $$
        begin raise exception 'e2e injected snapshot failure'; end;
        $$ language plpgsql;
        create trigger e2e_fail_snapshot before insert on tracker_snapshots
        for each row execute function e2e_fail_snapshot();
      `)

      const failed = await restore(request, exported.buffer, exported.filename)
      expect(failed.status()).toBe(500)

      const [tracker] = await sql<{ name: string }[]>`
        select name from trackers limit 1
      `
      expect(tracker.name).toBe("before-injected-failure")
      const [clients] = await sql<{ count: number }[]>`
        select count(*)::int as count from download_clients
      `
      expect(clients.count).toBe(0)
    } finally {
      await sql.unsafe(`
        drop trigger if exists e2e_fail_snapshot on tracker_snapshots;
        drop function if exists e2e_fail_snapshot();
      `)
      await sql.end()
    }
  })

  test("unauthenticated restore is rejected", async ({ request }) => {
    const exported = await exportBackup(request)
    const anonymous = await playwrightRequest.newContext({
      baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3020",
      storageState: { cookies: [], origins: [] },
    })
    try {
      const response = await restore(anonymous, exported.buffer, exported.filename)
      expect(response.status()).toBe(401)
    } finally {
      await anonymous.dispose()
    }
  })
})
