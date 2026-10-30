// e2e/p47.spec.ts
//
// P47 visual evidence: Upload.cx (three paths plus off-ladder classes) and
// Zenith (a shared start plus two paths). The trackers, ranks and manual values
// are synthetic and live only in the guarded tracker_tracker_e2e database.
import { mkdir } from "node:fs/promises"
import { expect, test } from "@playwright/test"
import { deriveKey, encrypt } from "../src/lib/crypto"
import { e2eSql } from "./db"
import { E2E_OWNER } from "./fixtures"

const TiB = 1024 ** 4
const GiB = 1024 ** 3
const DAY = 86_400

interface Fixture {
  id: number
  name: string
  slug: "uploadcx" | "zenith"
  group: string
}

const fixtures: Fixture[] = []
let originalRankGoals: string | null = null
let originalDashboardSettings: string | null = null

test.describe.serial("P47 rank progression and manual values", () => {
  test.beforeAll(async () => {
    const sql = e2eSql()
    try {
      const [settings] = await sql<
        { encryption_salt: string; rank_goals: string | null; dashboard_settings: string | null }[]
      >`
        select encryption_salt, rank_goals, dashboard_settings from app_settings limit 1
      `
      originalRankGoals = settings.rank_goals
      originalDashboardSettings = settings.dashboard_settings
      const key = await deriveKey(E2E_OWNER.password, settings.encryption_salt)

      const rows = [
        {
          name: "Upload.cx",
          slug: "uploadcx" as const,
          group: "User",
          uploaded: 12 * TiB,
          downloaded: 8 * TiB,
          ratio: 1.5,
          seeding: 120,
        },
        {
          name: "Zenith",
          slug: "zenith" as const,
          group: "Explorer",
          uploaded: 1 * TiB,
          downloaded: 200 * GiB,
          ratio: 5,
          seeding: 40,
        },
      ]

      for (const row of rows) {
        const [tracker] = await sql<{ id: number }[]>`
          insert into trackers (
            name, base_url, registry_slug, platform_type, is_active, joined_at,
            last_polled_at, encrypted_api_token, color, created_at, updated_at
          ) values (
            ${row.name}, ${`https://${row.slug}.invalid`}, ${row.slug}, 'unit3d', true,
            '2025-03-01T00:00:00.000Z', now(), ${encrypt("synthetic-p47-token", key)},
            ${row.slug === "uploadcx" ? "#538dab" : "#7c3aed"}, now(), now()
          ) returning id
        `
        fixtures.push({ id: tracker.id, name: row.name, slug: row.slug, group: row.group })
        await sql`
          insert into tracker_snapshots (
            tracker_id, polled_at, uploaded_bytes, downloaded_bytes, ratio, group_name,
            buffer_bytes, seeding_count, leeching_count, seedbonus, hit_and_runs,
            required_ratio, warned, freeleech_tokens, is_manual
          ) values (
            ${tracker.id}, now(), ${row.uploaded}, ${row.downloaded}, ${row.ratio},
            ${row.group}, ${row.uploaded - row.downloaded}, ${row.seeding}, 0, 5000, 0,
            0.6, false, 0, false
          )
        `
      }

      const upload = fixtures.find((fixture) => fixture.slug === "uploadcx")
      const zenith = fixtures.find((fixture) => fixture.slug === "zenith")
      const rankGoals = {
        [String(upload?.id)]: { targetRank: "Seeder" },
        [String(zenith?.id)]: { targetRank: "Climber" },
      }
      const rankManualValues = {
        [String(upload?.id)]: {
          seedSizeBytes: { value: 2 * TiB, unit: "TiB", enteredAt: "2026-10-28" },
          averageSeedTimeSeconds: { value: 30 * DAY, unit: "months", enteredAt: "2026-10-10" },
        },
        [String(zenith?.id)]: {
          seedSizeBytes: { value: 6 * TiB, unit: "TiB", enteredAt: "2026-10-29" },
          averageSeedTimeSeconds: { value: 21 * DAY, unit: "weeks", enteredAt: "2026-10-29" },
        },
      }
      const dashboardSettings =
        originalDashboardSettings === null
          ? { rankManualValues }
          : { ...JSON.parse(originalDashboardSettings), rankManualValues }

      await sql`
        update app_settings
        set rank_goals = ${JSON.stringify(rankGoals)},
            dashboard_settings = ${JSON.stringify(dashboardSettings)}
      `
    } finally {
      await sql.end()
    }
    await mkdir("docs/screenshots/p47", { recursive: true })
  })

  test.afterAll(async () => {
    const sql = e2eSql()
    try {
      for (const fixture of fixtures) {
        await sql`delete from trackers where id = ${fixture.id}`
      }
      await sql`
        update app_settings
        set rank_goals = ${originalRankGoals},
            dashboard_settings = ${originalDashboardSettings}
      `
    } finally {
      await sql.end()
    }
  })

  test("captures Upload.cx and Zenith at 1440px and 390px in both themes", async ({ page }) => {
    test.setTimeout(120_000)

    for (const fixture of fixtures) {
      await page.setViewportSize({ width: 1440, height: 1400 })
      await page.goto(`/trackers/${fixture.id}`)
      await expect(page.locator("#main-content h1").first()).toBeVisible({ timeout: 15_000 })
      await expect(page.locator("[data-rank-progression]")).toBeVisible()
      await expect(page.locator("[data-rank-goal-panel]")).toBeVisible()

      await page.evaluate(() => {
        document.documentElement.dataset.theme = "light"
      })
      await page.locator("[data-rank-progression]").scrollIntoViewIfNeeded()
      await page.waitForTimeout(250)
      await page.screenshot({ path: `docs/screenshots/p47/${fixture.slug}-1440-light.png` })

      await page.evaluate(() => {
        document.documentElement.dataset.theme = "dark"
      })
      await page.waitForTimeout(150)
      await page.screenshot({ path: `docs/screenshots/p47/${fixture.slug}-1440-dark.png` })

      await page.setViewportSize({ width: 390, height: 1200 })
      await page.waitForFunction(() => document.querySelector('[data-mobile="true"]') !== null)
      await page.evaluate(() => {
        document.documentElement.dataset.theme = "light"
      })
      await page.locator("[data-rank-progression]").scrollIntoViewIfNeeded()
      await page.waitForTimeout(300)
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      )
      expect(overflow, `${fixture.name} overflows horizontally at 390px`).toBeLessThanOrEqual(1)
      await page.screenshot({ path: `docs/screenshots/p47/${fixture.slug}-390-light.png` })

      await page.evaluate(() => {
        document.documentElement.dataset.theme = "dark"
      })
      await page.waitForTimeout(150)
      await page.screenshot({ path: `docs/screenshots/p47/${fixture.slug}-390-dark.png` })
    }
  })
})
