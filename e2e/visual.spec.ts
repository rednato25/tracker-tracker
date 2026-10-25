// e2e/visual.spec.ts
//
// P11/P13 visual evidence with synthetic data. Runs against the guarded
// tracker_tracker_e2e database and never contacts a tracker or download client.
import { expect, test } from "@playwright/test"
import { deriveKey, encrypt } from "../src/lib/crypto"
import { e2eSql } from "./db"
import { E2E_OWNER } from "./fixtures"

const GiB = 1024 ** 3
let trackerId: number | null = null

test.describe.serial("rank and budget visual evidence", () => {
  test.beforeAll(async () => {
    const sql = e2eSql()
    try {
      const [settings] = await sql<{ encryption_salt: string }[]>`
        select encryption_salt from app_settings limit 1
      `
      const key = await deriveKey(E2E_OWNER.password, settings.encryption_salt)
      const [tracker] = await sql<{ id: number }[]>`
        insert into trackers (
          name, base_url, registry_slug, platform_type, is_active, user_paused_at,
          joined_at, last_polled_at, encrypted_api_token, created_at, updated_at
        ) values (
          'TEST Visual Rank and Budget', 'https://tt-p13.invalid', 'torrentleech',
          'unit3d', true, now(), '2026-10-01T12:00:00.000Z', now(),
          ${encrypt("synthetic-visual-token", key)}, now(), now()
        ) returning id
      `
      trackerId = tracker.id
      await sql`
        insert into tracker_snapshots (
          tracker_id, polled_at, uploaded_bytes, downloaded_bytes, ratio,
          buffer_bytes, seeding_count, leeching_count, seedbonus, hit_and_runs,
          required_ratio, warned, freeleech_tokens, is_manual
        ) values (
          ${tracker.id}, now(), ${250 * GiB}, ${100 * GiB}, 2.5,
          ${150 * GiB}, 4, 0, 10, 0, 1, false, 0, false
        )
      `
    } finally {
      await sql.end()
    }
  })

  test.afterAll(async () => {
    if (trackerId === null) return
    const sql = e2eSql()
    try {
      await sql`delete from trackers where id = ${trackerId}`
    } finally {
      await sql.end()
    }
  })

  test("captures the rank goal and download budget panels", async ({ page }) => {
    expect(trackerId).not.toBeNull()
    await page.goto(`/trackers/${trackerId}`)
    await expect(page.locator("[data-rank-goal-panel]")).toBeVisible()
    await expect(page.locator("[data-download-budget-panel]")).toBeVisible()

    await page.getByLabel("Proposed size (GiB)").fill("80")
    await page.getByLabel("Accounting assumption").selectOption("1")
    await page.getByLabel("Charged reserve (GiB)").fill("100")
    await expect(page.getByText(/Projected ratio/)).toBeVisible()

    const rank = page.locator("[data-rank-goal-panel]")
    const budget = page.locator("[data-download-budget-panel]")
    await rank.screenshot({ path: "test-results/visual-rank-light.png" })
    await budget.screenshot({ path: "test-results/visual-budget-light.png" })

    await page.evaluate(() => {
      document.documentElement.dataset.theme = "dark"
    })
    await rank.screenshot({ path: "test-results/visual-rank-dark.png" })
    await budget.screenshot({ path: "test-results/visual-budget-dark.png" })

    await page.setViewportSize({ width: 390, height: 844 })
    await page.waitForFunction(
      () => document.querySelector('[data-mobile="true"][data-collapsed="true"]') !== null
    )
    await page.waitForTimeout(300)
    await rank.scrollIntoViewIfNeeded()
    await budget.scrollIntoViewIfNeeded()
    await rank.screenshot({ path: "test-results/visual-rank-mobile.png" })
    await budget.screenshot({ path: "test-results/visual-budget-mobile.png" })
  })
})
