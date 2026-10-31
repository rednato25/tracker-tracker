// e2e/p50.spec.ts
//
// P50 visual evidence. Five synthetic tracker cards cover the login ring's
// normal, warning, overdue, detected and no-rule states. The rows live only in
// the guarded tracker_tracker_e2e database and are removed afterwards.
import { mkdir } from "node:fs/promises"
import { expect, test } from "@playwright/test"
import { deriveKey, encrypt } from "../src/lib/crypto"
import { e2eSql } from "./db"
import { E2E_OWNER } from "./fixtures"

const TIB = 1024 ** 4

function localDaysAgo(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${date.getFullYear()}-${month}-${day}`
}

interface Fixture {
  name: string
  slug: string
  platform: string
  lastAccessAt: string | null
  lastAccessSource: "detected" | "manual" | null
  color: string
}

const fixtures: Fixture[] = [
  {
    name: "P50 Normal",
    slug: "myanonamouse",
    platform: "mam",
    lastAccessAt: localDaysAgo(20),
    lastAccessSource: "manual",
    color: "#6d56eb",
  },
  {
    name: "P50 Warning",
    slug: "myanonamouse",
    platform: "mam",
    lastAccessAt: localDaysAgo(115),
    lastAccessSource: "manual",
    color: "#f59e0b",
  },
  {
    name: "P50 Overdue",
    slug: "myanonamouse",
    platform: "mam",
    lastAccessAt: localDaysAgo(130),
    lastAccessSource: "manual",
    color: "#ef4444",
  },
  {
    name: "P50 Detected",
    slug: "uploadcx",
    platform: "unit3d",
    lastAccessAt: localDaysAgo(10),
    lastAccessSource: "detected",
    color: "#538dab",
  },
  {
    name: "P50 No Rule",
    slug: "torrentleech",
    platform: "unit3d",
    lastAccessAt: null,
    lastAccessSource: null,
    color: "#3b82f6",
  },
]

const ids: number[] = []

test.describe.serial("P50 login ring", () => {
  test.beforeAll(async () => {
    const sql = e2eSql()
    try {
      const [settings] = await sql<{ encryption_salt: string }[]>`
        select encryption_salt from app_settings limit 1
      `
      const key = await deriveKey(E2E_OWNER.password, settings.encryption_salt)

      for (const fixture of fixtures) {
        const [tracker] = await sql<{ id: number }[]>`
          insert into trackers (
            name, base_url, registry_slug, platform_type, is_active, joined_at,
            last_polled_at, encrypted_api_token, last_access_at,
            last_access_source, color, created_at, updated_at
          ) values (
            ${fixture.name}, ${`https://${fixture.slug}.invalid`}, ${fixture.slug},
            ${fixture.platform}, true, '2025-03-01T00:00:00.000Z', now(),
            ${encrypt("synthetic-p50-token", key)}, ${fixture.lastAccessAt},
            ${fixture.lastAccessSource}, ${fixture.color}, now(), now()
          ) returning id
        `
        ids.push(tracker.id)
        await sql`
          insert into tracker_snapshots (
            tracker_id, polled_at, uploaded_bytes, downloaded_bytes, ratio,
            buffer_bytes, seeding_count, leeching_count, seedbonus, hit_and_runs,
            required_ratio, warned, freeleech_tokens, group_name, is_manual
          ) values (
            ${tracker.id}, now(), ${12 * TIB}, ${8 * TIB}, 1.5, ${4 * TIB},
            120, 0, 5000, 0, 0.6, false, 0, 'Power User', false
          )
        `
      }
    } finally {
      await sql.end()
    }
    await mkdir("docs/screenshots/p50", { recursive: true })
  })

  test.afterAll(async () => {
    const sql = e2eSql()
    try {
      for (const id of ids) await sql`delete from trackers where id = ${id}`
    } finally {
      await sql.end()
    }
  })

  test("captures the card footer at 1440px and 390px in both themes", async ({ page }) => {
    test.setTimeout(120_000)

    for (const width of [1440, 390] as const) {
      await page.setViewportSize({ width, height: width === 1440 ? 1400 : 1000 })
      await page.goto("/")
      await page.getByRole("button", { name: "Grid" }).click()
      await expect(page.locator("#main-content [data-tracker-grid]")).toBeVisible({
        timeout: 20_000,
      })
      if (width === 390) {
        await page.waitForFunction(
          () => document.querySelector('[data-mobile="true"]') !== null
        )
      }

      await expect(page.locator("[data-tracker-card]")).toHaveCount(fixtures.length)
      await expect(page.getByText("P50 Normal").first()).toBeVisible()
      await expect(page.getByText("P50 No Rule").first()).toBeVisible()
      await expect(page.locator("[data-login-no-rule]")).toBeVisible()
      await expect(page.locator("[data-login-ring]")).toHaveCount(4)
      await expect(page.locator('[data-login-source="detected"]')).toHaveCount(1)
      await expect(page.locator('[data-login-source="manual"]')).toHaveCount(3)

      const normalCard = page.locator(`[data-tracker-card="${ids[0]}"]`)
      const normalRing = normalCard.locator("[data-login-ring]")
      await expect(normalRing.locator("[data-ring-value]")).toHaveText("100")
      await expect(normalRing.locator("[data-ring-value]")).toHaveCSS("font-size", "13px")
      await expect(normalRing.locator("[data-ring-value]")).toHaveCSS(
        "font-variant-numeric",
        "tabular-nums"
      )
      const normalBy = normalCard.locator("[data-login-by]")
      await expect(normalBy).toHaveText(/^by\s/)
      await expect(normalBy).not.toContainText("days left")
      await expect(normalBy).toHaveClass(/text-tertiary/)

      const ringBox = await normalRing.locator('[role="img"]').boundingBox()
      const valueBox = await normalRing.locator("[data-ring-value]").boundingBox()
      if (!ringBox || !valueBox) throw new Error("ring or value box missing")
      expect(valueBox.x - ringBox.x).toBeGreaterThan(4)
      expect(ringBox.x + ringBox.width - (valueBox.x + valueBox.width)).toBeGreaterThan(4)

      const overdueCard = page.locator(`[data-tracker-card="${ids[2]}"]`)
      await expect(overdueCard.locator("[data-ring-value]")).toHaveText("!")
      await expect(overdueCard.locator("[data-login-by]")).toHaveText(/overdue by 10 days/)
      await expect(overdueCard.locator("[data-login-by]")).toHaveClass(/text-danger/)

      const grid = page.locator("#main-content [data-tracker-grid]")
      await grid.scrollIntoViewIfNeeded()

      // Element screenshots taller than the viewport leave unpainted rows in
      // Chromium. Grow the viewport so every card is painted before capturing.
      const box = await grid.boundingBox()
      const visibleHeight = page.viewportSize()?.height ?? 0
      if (box && box.height + 120 > visibleHeight) {
        await page.setViewportSize({
          width,
          height: Math.min(6000, Math.ceil(box.height + 120)),
        })
        await page.waitForTimeout(250)
      }
      await page.waitForTimeout(250)

      for (const theme of ["light", "dark"] as const) {
        await page.evaluate((next) => {
          document.documentElement.dataset.theme = next
        }, theme)
        await page.waitForTimeout(150)

        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth
        )
        expect(overflow, `dashboard overflows at ${width}px`).toBeLessThanOrEqual(1)

        const footerOverflow = await page.evaluate(() =>
          [...document.querySelectorAll("[data-card-footer]")].some((footer) => {
            const box = footer.getBoundingClientRect()
            return [...footer.querySelectorAll("*")].some((child) => {
              const rect = child.getBoundingClientRect()
              return rect.width > 0 && (rect.left < box.left - 1 || rect.right > box.right + 1)
            })
          })
        )
        expect(footerOverflow, `footer clips its content at ${width}px`).toBe(false)

        await grid.screenshot({
          path: `docs/screenshots/p50/footer-${width}-${theme}.png`,
        })
      }
    }
  })
})
