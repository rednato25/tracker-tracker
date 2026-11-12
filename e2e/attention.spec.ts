// e2e/attention.spec.ts
//
// Attention needed and the tracker page rank goal, with synthetic trackers in
// the guarded tracker_tracker_e2e database. Never contacts a real tracker.
//
// The data is a realistic worst case, not a demo: ten open items, a 70-character
// nickname, a non-Latin nickname, a one-letter nickname, a tracker that was
// never polled, and clear trackers that must be counted rather than listed.
import { expect, test } from "@playwright/test"
import { deriveKey, encrypt } from "../src/lib/crypto"
import { e2eSql } from "./db"
import { E2E_OWNER } from "./fixtures"

const NOW = new Date()
const iso = (date: Date) => date.toISOString()
const daysAgo = (days: number) => iso(new Date(NOW.getTime() - days * 86_400_000))

const LONG_NAME = "Synthetic GreatPosterWall International Film Archive (backup account)"
const STALE_NAMES = [
  "Synthetic Beta",
  LONG_NAME,
  "Synthetic 馒头 M-Team 备用账号",
  "Synthetic X",
  "Synthetic Delta",
  "Synthetic Epsilon",
  "Synthetic Zeta",
  "Synthetic Eta",
]

const ids: number[] = []
let alphaId = 0

test.describe.serial("attention needed and rank goal", () => {
  test.beforeAll(async () => {
    const sql = e2eSql()
    try {
      const [settings] = await sql<{ encryption_salt: string }[]>`
        select encryption_salt from app_settings limit 1
      `
      const key = await deriveKey(E2E_OWNER.password, settings.encryption_salt)
      const token = encrypt("synthetic-attention-token", key)
      const insert = async (name: string, polledAt: string | null, lastAccess: string | null) => {
        const [row] = await sql<{ id: number }[]>`
          insert into trackers (
            name, base_url, registry_slug, platform_type, is_active, last_access_at,
            last_polled_at, joined_at, encrypted_api_token, created_at, updated_at
          ) values (
            ${name}, 'https://synthetic.example.test', 'torrentleech', 'unit3d', true, ${lastAccess},
            ${polledAt}, ${daysAgo(16)}, ${token}, now(), now()
          )
          returning id
        `
        return row.id
      }
      // Alpha: fresh poll, ratio below the account minimum.
      alphaId = await insert("Synthetic Alpha", iso(NOW), iso(NOW))
      ids.push(alphaId)
      // Stale polls, one per name.
      for (const name of STALE_NAMES) ids.push(await insert(name, daysAgo(1), iso(NOW)))
      // Never polled.
      ids.push(await insert("Synthetic Never Polled", null, iso(NOW)))
      // Clear.
      const gamma = await insert("Synthetic Gamma", iso(NOW), iso(NOW))
      const iota = await insert("Synthetic Iota", iso(NOW), iso(NOW))
      ids.push(gamma, iota)

      const snapshot = (id: number, polledAt: string, ratio: number) => sql`
        insert into tracker_snapshots (
          tracker_id, polled_at, uploaded_bytes, downloaded_bytes, ratio,
          seeding_count, leeching_count, hit_and_runs, group_name, is_manual
        ) values (${id}, ${polledAt}, 500, 1000, ${ratio}, 4, 0, 0, 'User', false)
      `
      await snapshot(alphaId, iso(NOW), 0.5)
      for (const id of ids.slice(1, 1 + STALE_NAMES.length)) await snapshot(id, daysAgo(1), 2)
      await snapshot(gamma, iso(NOW), 3)
      await snapshot(iota, iso(NOW), 3)
    } finally {
      await sql.end()
    }
  })

  test.afterAll(async () => {
    if (ids.length === 0) return
    const sql = e2eSql()
    try {
      await sql`delete from tracker_snapshots where tracker_id in ${sql(ids)}`
      await sql`delete from trackers where name like 'Synthetic %'`
    } finally {
      await sql.end()
    }
  })

  test("lists every open item once and counts the clear trackers", async ({ page }) => {
    await page.goto("/")
    const view = page.locator("[data-attention-view]")
    await expect(page.getByRole("heading", { name: "Attention needed" })).toBeVisible()
    await expect(view.getByText("Synthetic Alpha")).toBeVisible()
    await expect(view.getByText(LONG_NAME)).toBeVisible()
    await expect(view.getByText("Synthetic 馒头 M-Team 备用账号")).toBeVisible()
    await expect(view.getByText("Synthetic Never Polled")).toBeVisible()
    await expect(view.getByText(/clear\.$/)).toBeVisible()
    // Clear trackers are counted, not listed; no filters, no internal fields.
    await expect(view.getByText("Synthetic Gamma")).toHaveCount(0)
    await expect(view.getByRole("button")).toHaveCount(0)
    await expect(view).not.toContainText(/stale-data|priority|freshness|Evidence/)

    await view.scrollIntoViewIfNeeded()
    await view.screenshot({ path: "test-results/attention-light.png" })
    await page.evaluate(() => {
      document.documentElement.dataset.theme = "dark"
    })
    await view.screenshot({ path: "test-results/attention-dark.png" })

    await page.setViewportSize({ width: 390, height: 844 })
    await page.waitForFunction(() => document.querySelector('[data-mobile="true"]') !== null)
    await page.waitForTimeout(400)
    await view.scrollIntoViewIfNeeded()
    const overflow = await view.evaluate((element) => element.scrollWidth > element.clientWidth)
    expect(overflow, "attention panel overflows at 390px").toBe(false)
    await view.screenshot({ path: "test-results/attention-mobile-dark.png" })
  })

  test("shows the rank goal without debug details or a trend estimate", async ({ page }) => {
    await page.goto(`/trackers/${alphaId}`)
    const panel = page.locator("#main-content [data-rank-goal-panel]")
    await expect(panel).toBeVisible({ timeout: 15_000 })
    await panel.getByLabel("Target rank").selectOption("Power User")
    await expect(panel.locator("[data-rank-condition]").first()).toBeVisible()
    await expect(panel.locator("[data-rank-source]")).toContainText(/Ranks view/)
    await expect(panel).not.toContainText(/Details|source=|freshness=|estimate|trend/)
    await panel.scrollIntoViewIfNeeded()
    await panel.screenshot({ path: "test-results/rank-goal-light.png" })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.waitForTimeout(400)
    await panel.scrollIntoViewIfNeeded()
    const overflow = await panel.evaluate((element) => element.scrollWidth > element.clientWidth)
    expect(overflow, "rank goal overflows at 390px").toBe(false)
    await panel.screenshot({ path: "test-results/rank-goal-mobile.png" })
  })
})
