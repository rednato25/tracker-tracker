// e2e/visual.spec.ts
//
// P11/P13 visual evidence with synthetic data. Runs against the guarded
// tracker_tracker_e2e database and never contacts a tracker or download client.
import { createServer } from "node:http"
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
    await expect(page.locator("[data-download-budget-panel]").first()).toBeVisible()

    await page.getByLabel("Download size (GiB)").fill("80")
    await page.getByLabel("How is it charged?").selectOption("1")
    await page.getByText(/Advanced: committed traffic and reserve/).click()
    await page.getByLabel("Reserve (GiB)").fill("100")
    await expect(page.getByText(/Projected ratio/)).toBeVisible()

    const capturePanel = async (selector: string, path: string) => {
      const box = await page.locator(selector).boundingBox()
      if (!box) throw new Error(`no box for ${selector}`)
      const viewport = page.viewportSize()
      if (!viewport) throw new Error("no viewport")
      const x = Math.max(0, box.x - 16)
      const y = Math.max(0, box.y - 16)
      await page.screenshot({
        path,
        clip: {
          x,
          y,
          width: Math.min(viewport.width - x, box.width + 32),
          height: Math.min(viewport.height - y, box.height + 32),
        },
      })
    }
    await capturePanel("[data-rank-goal-panel]", "test-results/visual-rank-light.png")
    await capturePanel("[data-download-budget-panel]", "test-results/visual-budget-light.png")

    await page.evaluate(() => {
      document.documentElement.dataset.theme = "dark"
    })
    await capturePanel("[data-rank-goal-panel]", "test-results/visual-rank-dark.png")
    await capturePanel("[data-download-budget-panel]", "test-results/visual-budget-dark.png")

    await page.setViewportSize({ width: 390, height: 844 })
    await page.waitForFunction(
      () => document.querySelector('[data-mobile="true"][data-collapsed="true"]') !== null
    )
    await page.waitForTimeout(300)
    const metrics = await page.evaluate(() => {
      const rect = (selector: string) => {
        const node = document.querySelector(selector) as HTMLElement | null
        if (!node) return null
        const r = node.getBoundingClientRect()
        return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }
      }
      const main = document.querySelector("main") as HTMLElement | null
      const overflows: { tag: string; cls: string; left: number; right: number; width: number }[] = []
      for (const node of document.querySelectorAll<HTMLElement>("body *")) {
        const r = node.getBoundingClientRect()
        if (r.width > 0 && (r.right > window.innerWidth + 1 || r.left < -1)) {
          overflows.push({ tag: node.tagName, cls: node.className, left: r.left, right: r.right, width: r.width })
          if (overflows.length >= 12) break
        }
      }
      return {
        viewport: { innerWidth: window.innerWidth, innerHeight: window.innerHeight, docScrollWidth: document.documentElement.scrollWidth, docClientWidth: document.documentElement.clientWidth },
        main: main ? { rect: rect("main"), clientWidth: main.clientWidth, scrollWidth: main.scrollWidth, scrollLeft: main.scrollLeft, clientHeight: main.clientHeight, scrollHeight: main.scrollHeight, scrollTop: main.scrollTop, overflowX: getComputedStyle(main).overflowX, overflowY: getComputedStyle(main).overflowY } : null,
        rank: rect("[data-rank-goal-panel]"),
        budget: rect("[data-download-budget-panel]"),
        overflows,
      }
    })
    console.log("MOBILE_DIAGNOSTICS", JSON.stringify(metrics))
    const scrollMainTo = async (selector: string) => {
      await page.evaluate((sel) => {
        const main = document.querySelector("main") as HTMLElement | null
        const el = document.querySelector(sel) as HTMLElement | null
        if (!main || !el) return
        main.scrollLeft = 0
        main.scrollTop += el.getBoundingClientRect().top - 72
      }, selector)
      await page.waitForTimeout(100)
    }
    await page.evaluate(() => {
      const main = document.querySelector("main")
      if (main) {
        main.scrollLeft = 0
        main.scrollTop = 0
      }
      window.scrollTo(0, 0)
    })
    await page.screenshot({ path: "test-results/visual-mobile-full.png" })
    await scrollMainTo("[data-rank-goal-panel]")
    await page.screenshot({ path: "test-results/visual-rank-mobile.png" })
    await scrollMainTo("[data-download-budget-panel]")
    await page.screenshot({ path: "test-results/visual-budget-mobile-top.png" })

    const budgetBottom = await page.evaluate(() => {
      const main = document.querySelector("main") as HTMLElement | null
      const el = document.querySelector("[data-download-budget-panel]") as HTMLElement | null
      if (!main || !el) return null
      main.scrollTop += el.getBoundingClientRect().bottom - main.clientHeight + 16
      return {
        visible: el.getBoundingClientRect().bottom <= main.clientHeight + 1,
        mainScrollTop: main.scrollTop,
        panelBottom: el.getBoundingClientRect().bottom,
        viewportHeight: main.clientHeight,
      }
    })
    console.log("MOBILE_PANEL_BOTTOM", JSON.stringify(budgetBottom))
    if (!budgetBottom?.visible) throw new Error("Budget panel bottom is not reachable by vertical scroll")
    await page.screenshot({ path: "test-results/visual-budget-mobile-bottom.png" })

    await page.setViewportSize({ width: 390, height: 1200 })
    await scrollMainTo("[data-rank-goal-panel]")
    await capturePanel("[data-rank-goal-panel]", "test-results/visual-rank-mobile-full.png")
    await scrollMainTo("[data-download-budget-panel]")
    await capturePanel("[data-download-budget-panel]", "test-results/visual-budget-mobile-full.png")
    await page.setViewportSize({ width: 390, height: 844 })

    await page.getByLabel("Download size (GiB)").fill("40")
    await page.getByLabel("How is it charged?").selectOption("1")
    await page.getByRole("button", { name: "Add to simulation" }).click()
    await page.getByLabel("Download size (GiB)").fill("60")
    await page.getByLabel("How is it charged?").selectOption("0.5")
    await page.getByRole("button", { name: "Add to simulation" }).click()
    await expect(page.getByRole("button", { name: "Edit" }).first()).toBeVisible()
    await page.getByRole("button", { name: "Edit" }).first().click()
    await page.getByRole("button", { name: "Remove" }).first().click()
    await expect(page.getByRole("button", { name: "Remove" })).toHaveCount(1)
    await scrollMainTo("[data-scenario-queue]")
    await page.screenshot({ path: "test-results/visual-budget-mobile-queue.png" })

    const bottom = await page.evaluate(() => {
      const main = document.querySelector("main") as HTMLElement | null
      const budget = document.querySelector("[data-download-budget-panel]") as HTMLElement | null
      if (!main || !budget) return null
      main.scrollTop = main.scrollHeight
      return { mainScrollTop: main.scrollTop, mainScrollHeight: main.scrollHeight, budgetBottom: budget.getBoundingClientRect().bottom, viewportHeight: window.innerHeight }
    })
    console.log("MOBILE_BOTTOM", JSON.stringify(bottom))
    await page.screenshot({ path: "test-results/visual-mobile-bottom.png" })
  })

  test("captures the reported queue totals after the UX fix", async ({ page }) => {
    const sql = e2eSql()
    try {
      await sql`
        update tracker_snapshots
        set uploaded_bytes = ${900 * GiB}, downloaded_bytes = ${600 * GiB}, ratio = 1.5
        where tracker_id = ${trackerId}
      `
    } finally {
      await sql.end()
    }
    await page.goto(`/trackers/${trackerId}`)
    await expect(page.locator("[data-download-budget-panel]")).toBeVisible()
    await page.getByLabel("Your target ratio").fill("1")
    const add = async (sizeGiB: string, charge: string) => {
      await page.getByLabel("Download size (GiB)").fill(sizeGiB)
      await page.getByLabel("How is it charged?").selectOption(charge)
      await page.getByRole("button", { name: "Add to simulation" }).click()
    }
    await add("50", "0")
    await add("15", "0")
    await add("155", "1")
    await add("80", "1")
    await expect(page.getByText(/Remaining allowance:/)).toContainText(/65(?:\.0+)? GiB/)
    await expect(page.getByText(/Projected ratio:/)).toContainText(/1\.08/)
    await page.locator("[data-download-budget-panel]").first().scrollIntoViewIfNeeded()
    await page.screenshot({ path: "test-results/visual-budget-queue-after.png" })
    await page.setViewportSize({ width: 390, height: 1200 })
    await page.waitForFunction(
      () => document.querySelector('[data-mobile="true"][data-collapsed="true"]') !== null
    )
    await page.waitForTimeout(300)
    await page.evaluate(() => {
      const main = document.querySelector("main")
      const el = document.querySelector("[data-download-budget-panel]") as HTMLElement | null
      if (main && el) main.scrollTop += el.getBoundingClientRect().top - 72
    })
    await page.screenshot({ path: "test-results/visual-budget-queue-after-mobile.png" })
  })

  test("previews and imports a selected Prowlarr indexer", async ({ page, request }) => {
    const server = createServer((req, res) => {
      if (req.url === "/api/v1/indexer") {
        res.writeHead(200, { "content-type": "application/json" })
        res.end(
          JSON.stringify([
            {
              id: 7,
              name: "TorrentLeech",
              implementation: "TorrentLeech",
              fields: [{ name: "baseUrl", value: "https://trackerleech.example" }],
            },
          ])
        )
        return
      }
      res.writeHead(404)
      res.end()
    })
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
    const address = server.address()
    if (!address || typeof address === "string") throw new Error("no prowlarr address")
    const prowlarrUrl = `http://127.0.0.1:${address.port}`
    try {
      const settings = await request.patch("/api/settings", {
        data: {
          prowlarrUrl,
          prowlarrApiKey: "synthetic-prowlarr-key",
          prowlarrAllowPrivate: true,
        },
      })
      expect(settings.ok()).toBe(true)
      console.log("PROWLARR_STEP settings saved")
      await page.goto("/settings")
      const section = page.locator("[data-prowlarr-import]").first()
      await expect(section).toBeVisible()
      console.log("PROWLARR_STEP section visible")
      await section.getByLabel("Prowlarr URL").fill(prowlarrUrl)
      await section.getByLabel(/Prowlarr API key/).fill("synthetic-prowlarr-key")
      console.log("PROWLARR_STEP fields filled")
      await section.getByRole("button", { name: "Test and preview" }).click()
      console.log("PROWLARR_STEP preview clicked")
      await expect(section.getByText("TorrentLeech", { exact: true }).first()).toBeVisible({ timeout: 10_000 })
      console.log("PROWLARR_STEP preview visible")
      await section.getByLabel("Select TorrentLeech").check()
      await section.getByRole("button", { name: /Import selected/ }).click()
      await expect(section.getByText(/1 tracker\(s\) created/)).toBeVisible()
      const sql = e2eSql()
      try {
        const [row] = await sql<{ count: number; active: number }[]>`
          select count(*)::int as count, count(*) filter (where is_active)::int as active
          from trackers where name = 'TorrentLeech'
        `
        expect(row.count).toBe(1)
        expect(row.active).toBe(0)
      } finally {
        await sql.end()
      }
      await section.scrollIntoViewIfNeeded()
      await section.screenshot({ path: "test-results/visual-prowlarr-light.png" })
      await page.evaluate(() => {
        document.documentElement.dataset.theme = "dark"
      })
      await section.screenshot({ path: "test-results/visual-prowlarr-dark.png" })
      await page.setViewportSize({ width: 390, height: 1200 })
      await page.waitForFunction(
        () => document.querySelector('[data-mobile="true"][data-collapsed="true"]') !== null
      )
      await page.waitForTimeout(300)
      await section.scrollIntoViewIfNeeded()
      await section.screenshot({ path: "test-results/visual-prowlarr-mobile.png" })
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
      const sql = e2eSql()
      try {
        await sql`delete from trackers where name = 'TorrentLeech' and is_active = false`
      } finally {
        await sql.end()
      }
    }
  })
})
