// e2e/p52.spec.ts
//
// P52 evidence. Synthetic rows live only in the guarded tracker_tracker_e2e
// database and are removed after the run.
import { mkdir } from "node:fs/promises"
import { expect, test } from "@playwright/test"
import { deriveKey, encrypt } from "../src/lib/crypto"
import { e2eSql } from "./db"
import { E2E_OWNER } from "./fixtures"

const TIB = 1024 ** 4
const DAY_MS = 24 * 60 * 60 * 1000

function dateOnly(daysAgo: number): string {
  const date = new Date(Date.now() - daysAgo * DAY_MS)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`
}

let trackerId: number | null = null

test.describe.configure({ mode: "serial" })

test.describe("P52 rank goal and what's next", () => {
  test.beforeAll(async () => {
    const sql = e2eSql()
    try {
      const [settings] = await sql<{ encryption_salt: string }[]>`
        select encryption_salt from app_settings limit 1
      `
      const key = await deriveKey(E2E_OWNER.password, settings.encryption_salt)
      const [tracker] = await sql<{ id: number }[]>`
        insert into trackers (
          name, base_url, registry_slug, platform_type, is_active, joined_at,
          last_polled_at, encrypted_api_token, color, created_at, updated_at
        ) values (
          'P52 TorrentLeech', 'https://torrentleech.invalid', 'torrentleech',
          'unit3d', true, ${dateOnly(70)}::date, now(),
          ${encrypt("synthetic-p52-token", key)}, '#2ecc71', now(), now()
        ) returning id
      `
      trackerId = tracker.id
      await sql`
        insert into tracker_snapshots (
          tracker_id, polled_at, uploaded_bytes, downloaded_bytes, ratio,
          buffer_bytes, seeding_count, leeching_count, seedbonus, hit_and_runs,
          required_ratio, warned, freeleech_tokens, group_name, is_manual
        ) values (
          ${tracker.id}, now(), ${2 * TIB}, ${TIB}, 2, ${TIB}, 20, 0, 100,
          0, 1, false, 0, 'Registered', false
        )
      `
      await sql`
        update app_settings
        set rank_goals = ${JSON.stringify({
          [String(tracker.id)]: { targetRank: "Super User" },
        })}
      `
    } finally {
      await sql.end()
    }
    await mkdir("docs/screenshots/p52", { recursive: true })
  })

  test.afterAll(async () => {
    const sql = e2eSql()
    try {
      if (trackerId !== null) await sql`delete from trackers where id = ${trackerId}`
      await sql`update app_settings set rank_goals = null`
    } finally {
      await sql.end()
    }
  })

  test("rank goal panel is compact, details are collapsed, and time-only waits are neutral", async ({
    page,
  }) => {
    test.setTimeout(120_000)
    expect(trackerId).not.toBeNull()

    for (const width of [1440, 390] as const) {
      await page.setViewportSize({ width, height: 1200 })
      await page.goto(`/trackers/${trackerId}`)
      const panel = page.locator("[data-rank-goal-panel]:visible").first()
      await expect(panel).toBeVisible({ timeout: 20_000 })

      await expect(panel.getByText("Details")).toBeVisible()
      await expect(panel.getByText("Evidence")).toHaveCount(0)
      await expect(panel.locator("[data-rank-condition]")).toHaveCount(3)
      const ageRow = panel
        .locator("[data-rank-condition]")
        .filter({ hasText: "At least 12 weeks registered" })
      await expect(ageRow).toContainText(/in 1[234] days/)
      await expect(ageRow.locator("text=Unmet")).toHaveCount(0)
      await expect(ageRow.locator("[data-bar-fill]")).toHaveClass(/bg-secondary/)

      const box = await panel.boundingBox()
      const visibleHeight = page.viewportSize()?.height ?? 0
      if (box && box.height + 120 > visibleHeight) {
        await page.setViewportSize({
          width,
          height: Math.min(6000, Math.ceil(box.height + 120)),
        })
        await page.waitForTimeout(200)
      }

      for (const theme of ["light", "dark"] as const) {
        await page.evaluate((next) => {
          document.documentElement.dataset.theme = next
        }, theme)
        await page.waitForTimeout(150)
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth
        )
        expect(overflow, `rank goal overflows at ${width}px`).toBeLessThanOrEqual(1)
        await panel.screenshot({
          path: `docs/screenshots/p52/rank-goal-${width}-${theme}.png`,
        })
      }
    }
  })
})
