// e2e/p54.spec.ts
//
// P54 visual evidence. One synthetic owned tracker and two pins live only in the
// guarded tracker_tracker_e2e database and are removed afterwards. Both pins
// pass through BitPorn, so the screenshot proves the shared prefix is one branch.
import { mkdir } from "node:fs/promises"
import { expect, test } from "@playwright/test"
import { deriveKey, encrypt } from "../src/lib/crypto"
import { e2eSql } from "./db"
import { E2E_OWNER } from "./fixtures"

const PINNED_ROUTES = {
  BitPorn: "tp:seedpool:BitPorn",
  BrokenStones: "tp:seedpool:BitPorn>tp:BitPorn:BrokenStones",
}

let trackerId: number | null = null

test.describe.configure({ mode: "serial" })

test.describe("P54 pinned route trees", () => {
  test.beforeAll(async () => {
    const sql = e2eSql()
    try {
      const [settings] = await sql<{ encryption_salt: string }[]>`
        select encryption_salt from app_settings limit 1
      `
      const key = await deriveKey(E2E_OWNER.password, settings.encryption_salt)
      // 175 days into seedpool's 180-day gate, so the first hop has a wait.
      const joinedAt = new Date(Date.now() - 175 * 86_400_000).toISOString().slice(0, 10)
      const [tracker] = await sql<{ id: number }[]>`
        insert into trackers (
          name, base_url, registry_slug, platform_type, is_active, joined_at,
          last_polled_at, encrypted_api_token, color, created_at, updated_at
        ) values (
          'P54 seedpool', 'https://seedpool.invalid', 'seedpool', 'unit3d', true,
          ${joinedAt}::date, now(), ${encrypt("synthetic-p54-token", key)}, '#22c55e',
          now(), now()
        ) returning id
      `
      trackerId = tracker.id
    } finally {
      await sql.end()
    }
    await mkdir("docs/screenshots/p54", { recursive: true })
  })

  test.afterAll(async () => {
    const sql = e2eSql()
    try {
      if (trackerId !== null) await sql`delete from trackers where id = ${trackerId}`
    } finally {
      await sql.end()
    }
  })

  test("merges shared steps into one branch and names the next step", async ({ page }) => {
    test.setTimeout(180_000)

    const current = (await (await page.request.get("/api/recruitment/wishlist")).json()) as {
      state: Record<string, unknown>
    }
    await page.request.put("/api/recruitment/wishlist", {
      data: {
        state: {
          ...current.state,
          desiredTrackerSlug: "BitPorn",
          pinnedRoutes: PINNED_ROUTES,
        },
      },
    })

    await page.setViewportSize({ width: 1440, height: 1200 })
    await page.goto("/pathways")
    await page.waitForLoadState("networkidle")

    const section = page.locator("[data-my-pinned-routes]")
    await expect(section.getByRole("heading", { name: "My pinned routes" })).toBeVisible()
    await expect(section.locator("[data-pinned-tree]")).toHaveCount(1)
    await expect(section.locator('[data-pinned-tree="seedpool"]')).toBeVisible()

    // Both pins pass through BitPorn: one node, two targets below it.
    const bitporn = section.locator('[data-tree-node="BitPorn"]')
    await expect(bitporn).toHaveCount(1)
    await expect(bitporn).toContainText("unlocks 2 of your targets")
    await expect(bitporn.locator("[data-pin-marker]").first()).toBeVisible()
    await expect(bitporn.locator("[data-node-wait]").first()).toContainText(/\d+ days? left/)
    await expect(section.locator('[data-pinned-route="BrokenStones"]')).toBeVisible()

    await expect(section.locator("[data-next-step]")).toContainText(
      /Next step: BitPorn from seedpool in \d+ days?/
    )

    for (const width of [1440, 390] as const) {
      await page.setViewportSize({ width, height: width === 1440 ? 1200 : 1000 })
      await page.waitForTimeout(250)
      await section.scrollIntoViewIfNeeded()

      for (const theme of ["light", "dark"] as const) {
        await page.evaluate((next) => {
          document.documentElement.dataset.theme = next
        }, theme)
        await page.waitForTimeout(150)
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth
        )
        expect(overflow, `pinned trees overflow at ${width}px`).toBeLessThanOrEqual(1)
        await section.screenshot({
          path: `docs/screenshots/p54/pins-tree-${width}-${theme}.png`,
          animations: "disabled",
        })
      }
    }
  })
})
