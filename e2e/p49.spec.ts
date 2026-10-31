// e2e/p49.spec.ts
//
// P49 visual evidence. The rank panel and settings sheet show a synthetic
// profile read; no tracker is contacted. The data lives only in the guarded
// tracker_tracker_e2e database.
import { mkdir } from "node:fs/promises"
import { expect, test } from "@playwright/test"
import { deriveKey, encrypt } from "../src/lib/crypto"
import { e2eSql } from "./db"
import { E2E_OWNER } from "./fixtures"

const TIB = 1024 ** 4
const DAY = 86_400

let trackerId: number | null = null
let originalRankGoals: string | null = null

test.describe.serial("P49 profile reading", () => {
  test.beforeAll(async () => {
    const sql = e2eSql()
    try {
      const [settings] = await sql<
        { encryption_salt: string; rank_goals: string | null }[]
      >`select encryption_salt, rank_goals from app_settings limit 1`
      originalRankGoals = settings.rank_goals
      const key = await deriveKey(E2E_OWNER.password, settings.encryption_salt)
      const fetchedAt = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
      const attemptedAt = new Date().toISOString()
      const platformMeta = JSON.stringify({
        profileRead: {
          fetchedAt,
          attemptedAt,
          status: null,
          values: {
            seedSizeBytes: 6 * TIB,
            averageSeedTimeSeconds: 45 * DAY,
            uploads: 60,
          },
        },
      })

      const [tracker] = await sql<{ id: number }[]>`
        insert into trackers (
          name, base_url, registry_slug, platform_type, is_active, joined_at,
          last_polled_at, encrypted_api_token, encrypted_profile_cookie,
          profile_reading_enabled, platform_meta, color, created_at, updated_at
        ) values (
          'Upload.cx', 'https://uploadcx.invalid', 'uploadcx', 'unit3d', true,
          '2026-03-01T00:00:00.000Z', now(),
          ${encrypt("synthetic-p49-token", key)},
          ${encrypt("session=synthetic-profile-cookie", key)},
          true, ${platformMeta}, '#538dab', now(), now()
        ) returning id
      `
      trackerId = tracker.id

      await sql`
        insert into tracker_snapshots (
          tracker_id, polled_at, uploaded_bytes, downloaded_bytes, ratio,
          buffer_bytes, seeding_count, leeching_count, seedbonus, hit_and_runs,
          required_ratio, warned, freeleech_tokens, group_name, is_manual
        ) values (
          ${tracker.id}, now(), ${12 * TIB}, ${8 * TIB}, 1.5,
          ${4 * TIB}, 120, 0, 5000, 0, 0.6, false, 0, 'User', false
        )
      `
      await sql`
        update app_settings
        set rank_goals = ${JSON.stringify({ [String(tracker.id)]: { targetRank: "Seeder" } })}
      `
    } finally {
      await sql.end()
    }
    await mkdir("docs/screenshots/p49", { recursive: true })
  })

  test.afterAll(async () => {
    const sql = e2eSql()
    try {
      if (trackerId !== null) await sql`delete from trackers where id = ${trackerId}`
      await sql`update app_settings set rank_goals = ${originalRankGoals}`
    } finally {
      await sql.end()
    }
  })

  test("captures the profile source and settings at 1440px and 390px in both themes", async ({
    page,
  }) => {
    test.setTimeout(180_000)
    expect(trackerId).not.toBeNull()

    for (const width of [1440, 390] as const) {
      const height = width === 1440 ? 1400 : 1200
      await page.setViewportSize({ width, height })
      await page.goto(`/trackers/${trackerId}`)
      await expect(page.locator("[data-rank-goal-panel]")).toBeVisible({ timeout: 20_000 })
      if (width === 390) {
        await page.waitForFunction(() => document.querySelector('[data-mobile="true"]') !== null)
      }
      await page.locator("[data-rank-goal-panel]").scrollIntoViewIfNeeded()
      await page.waitForTimeout(250)

      for (const theme of ["light", "dark"] as const) {
        await page.evaluate((next) => {
          document.documentElement.dataset.theme = next
        }, theme)
        await page.waitForTimeout(150)
        if (width === 390) {
          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth
          )
          expect(overflow, "rank panel overflows at 390px").toBeLessThanOrEqual(1)
        }
        await page.screenshot({
          path: `docs/screenshots/p49/rank-${width}-${theme}.png`,
        })
      }

      // Settings sheet: More actions -> Settings, then the profile-reading block.
      await page.goto(`/trackers/${trackerId}`)
      await expect(page.getByText("More actions").first()).toBeVisible()
      await page.getByText("More actions").first().click()
      await page.getByRole("button", { name: "Settings" }).click()
      const profileBlock = page.locator("[data-profile-reading]")
      await expect(profileBlock).toBeVisible()
      await profileBlock.scrollIntoViewIfNeeded()
      await page.waitForTimeout(250)
      await expect(page.getByText("Read profile page daily")).toBeVisible()
      await expect(
        page.getByText("Check this tracker's rules allow automated access before enabling.")
      ).toBeVisible()

      for (const theme of ["light", "dark"] as const) {
        await page.evaluate((next) => {
          document.documentElement.dataset.theme = next
        }, theme)
        await page.waitForTimeout(150)
        if (width === 390) {
          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth
          )
          expect(overflow, "settings sheet overflows at 390px").toBeLessThanOrEqual(1)
        }
        await page.screenshot({
          path: `docs/screenshots/p49/settings-${width}-${theme}.png`,
        })
      }
    }
  })
})
