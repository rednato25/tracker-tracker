// e2e/attention.spec.ts
//
// P05 integration + visual check with synthetic trackers. Uses the guarded
// tracker_tracker_e2e database and never contacts a real tracker.
import { expect, test } from "@playwright/test"
import { deriveKey, encrypt } from "../src/lib/crypto"
import { e2eSql } from "./db"
import { E2E_OWNER } from "./fixtures"

const NOW = new Date()
const iso = (date: Date) => date.toISOString()
const daysAgo = (days: number) => iso(new Date(NOW.getTime() - days * 86_400_000))

let ids: number[] = []

test.describe.serial("attention needed dashboard", () => {
  test.beforeAll(async () => {
    const sql = e2eSql()
    try {
      const [settings] = await sql<{ encryption_salt: string }[]>`
        select encryption_salt from app_settings limit 1
      `
      const key = await deriveKey(E2E_OWNER.password, settings.encryption_salt)
      const token = encrypt("synthetic-attention-token", key)
      const rows = await sql<{ id: number }[]>`
        insert into trackers (
          name, base_url, registry_slug, platform_type, is_active, last_access_at,
          last_polled_at, encrypted_api_token, created_at, updated_at
        ) values
          ('Synthetic Alpha', 'https://alpha.example.test', 'torrentleech', 'unit3d', true, '2026-01-01', ${iso(NOW)}, ${token}, now(), now()),
          ('Synthetic Beta', 'https://beta.example.test', 'torrentleech', 'unit3d', true, null, ${daysAgo(1)}, ${token}, now(), now()),
          ('Synthetic Gamma', 'https://gamma.example.test', 'torrentleech', 'unit3d', true, ${iso(NOW)}, ${iso(NOW)}, ${token}, now(), now())
        returning id
      `
      ids = rows.map((row) => row.id)
      const [alpha, beta, gamma] = ids
      await sql`
        insert into tracker_snapshots (
          tracker_id, polled_at, uploaded_bytes, downloaded_bytes, ratio,
          seeding_count, leeching_count, hit_and_runs, is_manual
        ) values
          (${alpha}, ${iso(NOW)}, 500, 1000, 0.5, 4, 0, 0, false),
          (${beta}, ${daysAgo(1)}, 2000, 1000, 2, 4, 0, 0, false),
          (${gamma}, ${iso(NOW)}, 3000, 1000, 3, 4, 0, 0, false)
      `
    } finally {
      await sql.end()
    }
  })

  test.afterAll(async () => {
    if (ids.length === 0) return
    const sql = e2eSql()
    try {
      await sql`delete from trackers where name like 'Synthetic %'`
    } finally {
      await sql.end()
    }
  })

  test("renders confirmed, verification and clear rows in light and dark", async ({ page }) => {
    await page.goto("/")
    const view = page.locator("[data-attention-view]")
    await expect(page.getByRole("heading", { name: "Attention needed" })).toBeVisible()
    await expect(view.getByText("Synthetic Alpha")).toBeVisible()
    await expect(view.getByText(/below the confirmed account minimum/)).toBeVisible()

    await view.getByRole("button", { name: /^Unknown/ }).click()
    await expect(view.getByText("Synthetic Beta")).toBeVisible()
    await expect(view.getByText(/last successful poll is older/)).toBeVisible()

    await view.getByRole("button", { name: /^Healthy/ }).click()
    await expect(view.getByText("Synthetic Gamma")).toBeVisible()

    await view.getByRole("button", { name: /^All/ }).click()
    await view.scrollIntoViewIfNeeded()
    await view.screenshot({ path: "test-results/attention-light.png" })

    await page.evaluate(() => {
      document.documentElement.dataset.theme = "dark"
    })
    await view.screenshot({ path: "test-results/attention-dark.png" })

    await page.setViewportSize({ width: 390, height: 844 })
    await page.waitForFunction(
      () => document.querySelector('[data-mobile="true"]') !== null
    )
    await page.waitForTimeout(400)
    await view.scrollIntoViewIfNeeded()
    await page.screenshot({ path: "test-results/attention-mobile-dark.png" })
  })
})
