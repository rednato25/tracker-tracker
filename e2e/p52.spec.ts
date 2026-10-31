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
let notificationTargetId: number | null = null
const extraTrackerIds: number[] = []

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
          0, 1, false, 0, 'Power User', false
        )
      `
      await sql`
        insert into tracker_snapshots (
          tracker_id, polled_at, uploaded_bytes, downloaded_bytes, ratio,
          buffer_bytes, seeding_count, leeching_count, seedbonus, hit_and_runs,
          required_ratio, warned, freeleech_tokens, group_name, is_manual
        ) values (
          ${tracker.id}, ${new Date(Date.now() - 20 * DAY_MS)},
          ${1 * TIB}, ${TIB}, 1, ${0}, 10, 0, 50, 0, 1, false, 0,
          'Registered', false
        )
      `
      const extras = [
        {
          name: "P52 AllMet",
          slug: "torrentleech",
          joinedAt: dateOnly(100),
          group: "Power User",
          ratio: 3,
          uploaded: 2 * TIB,
          target: "Super User",
          lastAccessAt: new Date(Date.now() - 2 * DAY_MS),
        },
        {
          name: "P52 TimeOnly",
          slug: "torrentleech",
          joinedAt: dateOnly(70),
          group: "Power User",
          ratio: 3,
          uploaded: 2 * TIB,
          target: "Super User",
          lastAccessAt: new Date(Date.now() - 2 * DAY_MS),
        },
        {
          name: "P52 RatioEdge",
          slug: "torrentleech",
          joinedAt: dateOnly(200),
          group: "Power User",
          ratio: 1.05,
          uploaded: Math.round(0.1 * TIB),
          target: null,
          lastAccessAt: new Date(Date.now() - 2 * DAY_MS),
        },
        {
          name: "P52 LoginDue",
          slug: "blutopia",
          joinedAt: null,
          group: null,
          ratio: null,
          uploaded: 0,
          target: null,
          lastAccessAt: new Date(Date.now() - 20 * DAY_MS),
        },
      ]

      for (const extra of extras) {
        const [row] = await sql<{ id: number }[]>`
          insert into trackers (
            name, base_url, registry_slug, platform_type, is_active, joined_at,
            last_polled_at, last_access_at, encrypted_api_token, color,
            created_at, updated_at
          ) values (
            ${extra.name}, ${`https://${extra.slug}.invalid`}, ${extra.slug},
            'unit3d', true, ${extra.joinedAt}::date, now(), ${extra.lastAccessAt},
            ${encrypt("synthetic-p52-token", key)}, '#64748b', now(), now()
          ) returning id
        `
        extraTrackerIds.push(row.id)
        if (extra.group) {
          await sql`
            insert into tracker_snapshots (
              tracker_id, polled_at, uploaded_bytes, downloaded_bytes, ratio,
              buffer_bytes, seeding_count, leeching_count, seedbonus, hit_and_runs,
              required_ratio, warned, freeleech_tokens, group_name, is_manual
            ) values (
              ${row.id}, now(), ${extra.uploaded}, ${TIB}, ${extra.ratio},
              ${0}, 10, 0, 100, 0, 1, false, 0, ${extra.group}, false
            )
          `
        }
      }

      const goals: Record<string, { targetRank: string }> = {
        [String(tracker.id)]: { targetRank: "Super User" },
      }
      for (const [index, extra] of extras.entries()) {
        if (extra.target) goals[String(extraTrackerIds[index])] = { targetRank: extra.target }
      }
      await sql`update app_settings set rank_goals = ${JSON.stringify(goals)}`

      const [target] = await sql<{ id: number }[]>`
        insert into notification_targets (
          name, type, enabled, encrypted_config, notify_rank_change,
          notify_ratio_danger, notify_login_due, include_tracker_name,
          created_at, updated_at
        ) values (
          'P52 Alerts', 'discord', true,
          ${encrypt(
            JSON.stringify({
              webhookUrl:
                "https://discord.com/api/webhooks/123456789012345678/p52-notification-test",
            }),
            key
          )},
          true, true, true, true, now(), now()
        ) returning id
      `
      notificationTargetId = target.id
    } finally {
      await sql.end()
    }
    await mkdir("docs/screenshots/p52", { recursive: true })
  })

  test.afterAll(async () => {
    const sql = e2eSql()
    try {
      if (trackerId !== null) await sql`delete from trackers where id = ${trackerId}`
      for (const id of extraTrackerIds) await sql`delete from trackers where id = ${id}`
      if (notificationTargetId !== null) {
        await sql`delete from notification_targets where id = ${notificationTargetId}`
      }
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

  test("puts the target hint above the chips and promotion history in the data tab", async ({
    page,
  }) => {
    test.setTimeout(120_000)
    expect(trackerId).not.toBeNull()

    for (const width of [1440, 390] as const) {
      await page.setViewportSize({ width, height: 1200 })
      await page.goto(`/trackers/${trackerId}`)
      const progression = page.locator("[data-rank-progression]")
      await expect(progression).toBeVisible({ timeout: 20_000 })

      const hint = progression.locator("[data-rank-target-hint]")
      await expect(hint).toBeVisible()
      await expect(progression.locator("[data-promotion-history]")).toHaveCount(0)

      const firstChip = progression.getByRole("button").first()
      const hintBox = await hint.boundingBox()
      const chipBox = await firstChip.boundingBox()
      expect(hintBox).not.toBeNull()
      expect(chipBox).not.toBeNull()
      if (hintBox && chipBox) expect(hintBox.y).toBeLessThan(chipBox.y)

      const history = page.locator("[data-promotion-history]")
      await expect(history).toBeVisible()
      await expect(history).toContainText("Promotion history")
      await expect(history).toContainText("Registered")
      await expect(history).toContainText("Power User")

      const height = Math.min(6000, (await page.locator("#main-content").evaluate(
        (element) => element.scrollHeight
      )) + 80)
      await page.setViewportSize({ width, height })
      await page.evaluate(() => {
        const main = document.querySelector("#main-content")
        if (main) main.scrollTop = 0
        window.scrollTo(0, 0)
      })
      await page.waitForTimeout(200)

      for (const theme of ["light", "dark"] as const) {
        await page.evaluate((next) => {
          document.documentElement.dataset.theme = next
        }, theme)
        await page.waitForTimeout(150)
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth
        )
        expect(overflow, `tracker page overflows at ${width}px`).toBeLessThanOrEqual(1)
        await progression.screenshot({
          path: `docs/screenshots/p52/tracker-progression-${width}-${theme}.png`,
        })
        await history.screenshot({
          path: `docs/screenshots/p52/tracker-history-${width}-${theme}.png`,
        })
      }
    }
  })

  test("shows what's next at the top of the dashboard, soonest first", async ({ page }) => {
    test.setTimeout(120_000)
    for (const width of [1440, 390] as const) {
      await page.setViewportSize({ width, height: 1200 })
      await page.goto("/")

      const panel = page.locator("[data-whats-next]:visible").first()
      await expect(panel).toBeVisible({ timeout: 20_000 })
      const rows = panel.locator("[data-whats-next-row]")
      await expect(rows).toHaveCount(4)

      await expect(rows.nth(0)).toHaveAttribute("data-whats-next-kind", "promotion-waiting")
      await expect(rows.nth(0)).toContainText("P52 AllMet \u2192 Super User")
      await expect(rows.nth(0)).toContainText("waiting for the site")
      await expect(rows.nth(1)).toHaveAttribute("data-whats-next-kind", "login")
      await expect(rows.nth(1)).toContainText("P52 LoginDue login")
      await expect(rows.nth(1)).toContainText("due in 10 days")
      await expect(rows.nth(2)).toHaveAttribute("data-whats-next-kind", "promotion-time")
      await expect(rows.nth(2)).toContainText("P52 TimeOnly \u2192 Super User")
      await expect(rows.nth(2)).toContainText("in 14 days of account age")
      await expect(rows.nth(3)).toHaveAttribute("data-whats-next-kind", "ratio")
      await expect(rows.nth(3)).toContainText("P52 RatioEdge ratio")
      await expect(rows.nth(3)).toContainText("minimum 1.00")

      const box = await panel.boundingBox()
      const visibleHeight = page.viewportSize()?.height ?? 0
      if (box && box.height + 160 > visibleHeight) {
        await page.setViewportSize({
          width,
          height: Math.min(6000, Math.ceil(box.height + 160)),
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
        expect(overflow, `what's next overflows at ${width}px`).toBeLessThanOrEqual(1)
        await panel.screenshot({
          path: `docs/screenshots/p52/whats-next-${width}-${theme}.png`,
        })
      }
    }
  })

  test("exposes the new notification events on the existing channels", async ({ page }) => {
    test.setTimeout(120_000)
    for (const width of [1440, 390] as const) {
      await page.setViewportSize({ width, height: 1200 })
      await page.goto("/settings")
      await page.getByRole("tab", { name: "Notifications" }).click()

      const card = page.getByRole("button", { name: /P52 Alerts/ })
      await expect(card).toBeVisible({ timeout: 20_000 })
      if ((await card.getAttribute("aria-expanded")) !== "true") await card.click()

      const toggles = page.locator("[data-notification-toggles]:visible").first()
      await expect(toggles).toBeVisible({ timeout: 20_000 })
      await expect(toggles).toContainText("Target reached or rank/class changed")
      await expect(toggles).toContainText("Ratio near or below tracker minimum")
      await expect(toggles).toContainText("Login due within 7 days")

      const box = await toggles.boundingBox()
      if (box) {
        await page.setViewportSize({ width, height: Math.min(6000, Math.ceil(box.height + 400)) })
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
        expect(overflow, `notification settings overflows at ${width}px`).toBeLessThanOrEqual(1)
        await toggles.screenshot({
          path: `docs/screenshots/p52/notifications-${width}-${theme}.png`,
        })
      }
    }
  })
})
