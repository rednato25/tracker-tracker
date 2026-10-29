// e2e/design-stress.spec.ts
//
// Worst-case data for the design check. This is a test fixture only; it never
// ships to the product.
import { expect, test } from "@playwright/test"
import { deriveKey, encrypt } from "../src/lib/crypto"
import { e2eSql } from "./db"
import { E2E_OWNER } from "./fixtures"

const TIB = 1024 ** 4
const GiB = 1024 ** 3
const LONG_NAME =
  "Aleksandra Wiśniewska-Kowalczyk's Very Long Private Tracker Community"

test.describe.serial("design stress fixtures", () => {
  let ids: number[] = []

  test.beforeAll(async () => {
    const sql = e2eSql()
    try {
      const [settings] = await sql<{ encryption_salt: string }[]>`
        select encryption_salt from app_settings limit 1
      `
      const key = await deriveKey(E2E_OWNER.password, settings.encryption_salt)
      for (let index = 1; index <= 20; index++) {
        const name =
          index === 1
            ? LONG_NAME
            : index === 2
              ? "Tracker 02 — a deliberately long account label with a suffix"
              : `TEST Stress ${String(index).padStart(2, "0")}`
        const slug = index === 1 ? "alpharatio" : index === 3 ? null : "torrentleech"
        const [tracker] = await sql<{ id: number }[]>`
          insert into trackers (
            name, base_url, registry_slug, platform_type, is_active, joined_at,
            last_polled_at, encrypted_api_token, color, created_at, updated_at
          ) values (
            ${name}, ${`https://stress-${index}.example.invalid`}, ${slug}, 'unit3d', true,
            ${index === 2 ? null : "2025-01-01T00:00:00.000Z"},
            ${index === 4 ? new Date(Date.now() - 3 * 86_400_000).toISOString() : new Date().toISOString()},
            ${encrypt(`stress-token-${index}`, key)}, '#6d56eb', now(), now()
          ) returning id
        `
        ids.push(tracker.id)

        if (index === 3) continue
        await sql`
          insert into tracker_snapshots (
            tracker_id, polled_at, uploaded_bytes, downloaded_bytes, ratio, group_name,
            buffer_bytes, seeding_count, leeching_count, seedbonus, hit_and_runs,
            required_ratio, warned, freeleech_tokens, is_manual
          ) values (
            ${tracker.id}, ${index === 4 ? new Date(Date.now() - 3 * 86_400_000).toISOString() : new Date().toISOString()},
            ${index === 1 ? 55 * TIB : index * 3 * TIB},
            ${index === 1 ? 0 : index * 1.5 * TIB},
            ${index === 1 ? null : 2},
            ${index === 2 ? "Extremely Powerful Elite Uploader" : "Power User"},
            ${index === 1 ? 55 * TIB : 1.5 * GiB}, ${index * 7}, 1, ${index * 1000}, 0, 1,
            false, 0, false
          )
        `
      }
      await sql`
        update app_settings
        set recruitment_state = ${JSON.stringify({
          version: 2,
          desiredTrackerSlug: "BroadcasTheNet",
          hiddenPathKeys: [],
          goalLinks: [],
        })}
      `
    } finally {
      await sql.end()
    }
  })

  test.afterAll(async () => {
    const sql = e2eSql()
    try {
      await sql`update app_settings set recruitment_state = null, rank_goals = null`
      for (const id of ids) await sql`delete from trackers where id = ${id}`
    } finally {
      await sql.end()
    }
  })

  test("captures worst-case register, cards and pathways", async ({ page }) => {
    test.setTimeout(120_000)
    expect(ids).toHaveLength(20)

    await page.setViewportSize({ width: 1440, height: 1200 })
    await page.goto("/")
    await expect(page.locator("#main-content #register")).toBeVisible({ timeout: 15_000 })
    await page.evaluate(() => {
      document.querySelector<HTMLElement>("#main-content")?.scrollTo(0, 0)
    })
    await page.screenshot({ path: "test-results/design-stress-register-1440.png" })

    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 1000 })
      await page.waitForTimeout(250)
      await page.evaluate(() => {
        document.querySelector<HTMLElement>("#main-content")?.scrollTo(0, 0)
      })
      await page.screenshot({ path: `test-results/design-stress-register-${width}.png` })
      const overflow = await page.evaluate(() => ({
        html: document.documentElement.scrollWidth > window.innerWidth,
        main: (() => {
          const main = document.querySelector<HTMLElement>("#main-content")
          return main ? main.scrollWidth > main.clientWidth : false
        })(),
      }))
      expect(overflow.html, `page overflows horizontally at ${width}px`).toBe(false)
      expect(overflow.main, `main overflows horizontally at ${width}px`).toBe(false)
    }

    await page.setViewportSize({ width: 1440, height: 1200 })
    await page.goto("/pathways")
    await expect(page.locator("#main-content [data-pathways-page]")).toBeVisible({
      timeout: 15_000,
    })
    await page.evaluate(() => {
      document.querySelector<HTMLElement>("#main-content")?.scrollTo(0, 0)
    })
    await page.screenshot({ path: "test-results/design-stress-pathways-1440.png" })

    await page.setViewportSize({ width: 390, height: 1200 })
    await page.waitForFunction(
      () => document.querySelector('[data-mobile="true"]') !== null
    )
    await page.evaluate(() => {
      document.querySelector<HTMLElement>("#main-content")?.scrollTo(0, 0)
    })
    await page.waitForTimeout(200)
    await page.screenshot({ path: "test-results/design-stress-pathways-390.png" })
    const pathwaysOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    )
    expect(pathwaysOverflow, "pathways overflows horizontally at 390px").toBe(false)
  })
})
