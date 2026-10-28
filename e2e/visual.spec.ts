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
    await expect(page.locator("[data-rank-goal-panel]").first()).toBeVisible()
    await expect(page.locator("[data-download-budget-panel]").first()).toBeVisible()

    await page.getByLabel("Download size (GiB)").first().fill("80")
    await page.getByLabel("How is it charged?").first().selectOption("1")
    await page.getByText(/Advanced: committed traffic and reserve/).first().click()
    await page.getByLabel("Reserve (GiB)").first().fill("100")
    await expect(page.getByText(/Projected ratio/).first()).toBeVisible()

    const capturePanel = async (selector: string, path: string) => {
      const box = await page.locator(selector).first().boundingBox()
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
    await expect(page.locator("[data-download-budget-panel]").first()).toBeVisible()
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
              name: "MyAnonaMouse",
              implementation: "MyAnonaMouse",
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
      await expect(section.getByText("MyAnonaMouse", { exact: true }).first()).toBeVisible({ timeout: 10_000 })
      console.log("PROWLARR_STEP preview visible")
      await section.getByLabel("Select MyAnonaMouse").check()
      await section.getByRole("button", { name: /Import selected/ }).click()
      await expect(section.getByText(/1 tracker\(s\) created/)).toBeVisible()
      const sql = e2eSql()
      try {
        const [row] = await sql<{ count: number; active: number; paused: number }[]>`
          select count(*)::int as count,
                 count(*) filter (where is_active)::int as active,
                 count(*) filter (where user_paused_at is not null)::int as paused
          from trackers where name = 'MyAnonaMouse'
        `
        expect(row.count).toBe(1)
        expect(row.active).toBe(1)
        expect(row.paused).toBe(1)
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
      await page.screenshot({ path: "test-results/visual-prowlarr-mobile.png" })
      await page.setViewportSize({ width: 1280, height: 900 })
      await page.goto("/")
      await expect(page.getByText("MyAnonaMouse").first()).toBeVisible()
      await page.screenshot({ path: "test-results/visual-prowlarr-imported-tracker.png" })
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
      const sql = e2eSql()
      try {
        await sql`delete from trackers where name = 'MyAnonaMouse'`
      } finally {
        await sql.end()
      }
    }
  })

  test("previews and imports a selected Jackett indexer", async ({ page }) => {
    const server = createServer((req, res) => {
      if (req.url === "/UI/Dashboard" && req.method === "POST") {
        let body = ""
        req.on("data", (chunk) => (body += chunk))
        req.on("end", () => {
          if (body.includes("wrong-password")) {
            res.writeHead(200, { "content-type": "text/html" })
            res.end("login")
            return
          }
          res.setHeader("set-cookie", "Jackett=session; Path=/")
          res.writeHead(302, { location: "/UI/Dashboard" })
          res.end()
        })
        return
      }
      if (req.url === "/api/v2.0/indexers?configured=true") {
        res.writeHead(200, { "content-type": "application/json" })
        res.end(
          JSON.stringify([
            { id: "mam", name: "MyAnonaMouse", type: "MyAnonaMouse", site_link: "https://www.myanonamouse.net" },
            { id: "tl", name: "TorrentLeech", type: "TorrentLeech", site_link: "https://trackerleech.example" },
            { id: "amb", name: "REDacted", type: "REDacted", site_link: "https://www.myanonamouse.net" },
            { id: "unknown", name: "Unknown Indexer", type: "Unknown", site_link: "https://unknown.example" },
          ])
        )
        return
      }
      res.writeHead(404)
      res.end()
    })
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
    const address = server.address()
    if (!address || typeof address === "string") throw new Error("no jackett address")
    const jackettUrl = `http://127.0.0.1:${address.port}`
    try {
      await page.goto("/settings")
      const section = page.locator("[data-jackett-import]").first()
      await expect(section).toBeVisible()
      await section.getByLabel("Jackett URL").fill(jackettUrl)
      await section.getByLabel("Jackett admin password").fill("correct-password")
      await section.getByLabel("Allow private network").check()
      await section.getByRole("button", { name: "Test and preview" }).click()
      await expect(section.getByText("already added")).toBeVisible()
      await expect(section.getByText("ambiguous")).toBeVisible()
      await expect(section.getByText("unsupported")).toBeVisible()
      await expect(section.getByLabel("Select MyAnonaMouse")).toBeEnabled()
      await section.getByLabel("Select MyAnonaMouse").check()
      await section.getByRole("button", { name: /Import selected/ }).click()
      await expect(section.getByText(/1 tracker\(s\) created/)).toBeVisible()

      const sql = e2eSql()
      try {
        const [row] = await sql<{ count: number; active: number; paused: number }[]>`
          select count(*)::int as count,
                 count(*) filter (where is_active)::int as active,
                 count(*) filter (where user_paused_at is not null)::int as paused
          from trackers where name = 'MyAnonaMouse'
        `
        expect(row).toEqual({ count: 1, active: 1, paused: 1 })
      } finally {
        await sql.end()
      }

      await section.scrollIntoViewIfNeeded()
      await section.screenshot({ path: "test-results/visual-jackett-light.png" })
      await page.evaluate(() => {
        document.documentElement.dataset.theme = "dark"
      })
      await section.screenshot({ path: "test-results/visual-jackett-dark.png" })
      await page.setViewportSize({ width: 390, height: 1200 })
      await page.waitForFunction(
        () => document.querySelector('[data-mobile="true"][data-collapsed="true"]') !== null
      )
      await page.waitForTimeout(300)
      await section.scrollIntoViewIfNeeded()
      await page.screenshot({ path: "test-results/visual-jackett-mobile.png" })
      await page.setViewportSize({ width: 1280, height: 900 })
      await page.goto("/")
      await expect(page.getByText("MyAnonaMouse").first()).toBeVisible()
      await page.screenshot({ path: "test-results/visual-jackett-imported-tracker.png" })
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
      const sql = e2eSql()
      try {
        await sql`delete from trackers where name = 'MyAnonaMouse'`
      } finally {
        await sql.end()
      }
    }
  })
})
test.describe.serial("integration token visual evidence", () => {
  test("captures desktop light/dark and mobile token management", async ({ page }) => {
    try {
      await page.goto("/settings")
      await page.getByRole("tab", { name: "Integrations" }).click()

      const section = page.locator('section[aria-labelledby="integrations-heading"]')
      await expect(section).toBeVisible()
      await expect(section.getByText("Create a token")).toBeVisible()

      await section.getByLabel("Token name").fill("Visual Widget")
      await section.getByRole("button", { name: "Create token" }).click()
      await expect(section.getByText("Copy this token now")).toBeVisible()

      // The artifact is public. Blur the one-time value even though this token is
      // deleted in the finally block; layout, scopes and warnings stay inspectable.
      await page.addStyleTag({
        content: "[data-integration-token]{filter:blur(7px);user-select:none}",
      })

      const sql = e2eSql()
      try {
        const rows = await sql<{ count: number }[]>`
          select count(*)::int as count from integration_tokens
          where name = 'Visual Widget' and revoked_at is null
        `
        expect(rows[0]?.count).toBe(1)
      } finally {
        await sql.end()
      }

      await section.scrollIntoViewIfNeeded()
      await section.screenshot({ path: "test-results/visual-integrations-light.png" })
      await page.evaluate(() => {
        document.documentElement.dataset.theme = "dark"
      })
      await section.screenshot({ path: "test-results/visual-integrations-dark.png" })

      await page.setViewportSize({ width: 390, height: 1200 })
      await page.waitForFunction(
        () => document.querySelector('[data-mobile="true"][data-collapsed="true"]') !== null
      )
      await page.waitForTimeout(300)
      await section.scrollIntoViewIfNeeded()
      await page.screenshot({ path: "test-results/visual-integrations-mobile.png" })
    } finally {
      const sql = e2eSql()
      try {
        await sql`delete from integration_tokens where name = 'Visual Widget'`
      } finally {
        await sql.end()
      }
    }
  })
})
test.describe.serial("wishlist visual evidence", () => {
  let wishlistTrackerId: number | null = null

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
          'TEST Visual Wishlist', 'https://tt-p18.invalid', 'alpharatio',
          'unit3d', true, now(), '2025-01-01T00:00:00.000Z', now(),
          ${encrypt("synthetic-p18-token", key)}, now(), now()
        ) returning id
      `
      wishlistTrackerId = tracker.id
      await sql`
        insert into tracker_snapshots (
          tracker_id, polled_at, uploaded_bytes, downloaded_bytes, ratio,
          buffer_bytes, seeding_count, leeching_count, seedbonus, hit_and_runs,
          required_ratio, warned, freeleech_tokens, is_manual
        ) values (
          ${tracker.id}, now(), ${500 * GiB}, ${200 * GiB}, 2.5,
          ${300 * GiB}, 5, 0, 10, 0, 1, false, 0, false
        )
      `
    } finally {
      await sql.end()
    }
  })

  test.afterAll(async () => {
    const sql = e2eSql()
    try {
      if (wishlistTrackerId !== null) {
        await sql`delete from trackers where id = ${wishlistTrackerId}`
      }
      await sql`update app_settings set recruitment_state = null`
    } finally {
      await sql.end()
    }
  })

  test("captures desktop light/dark and 390px wishlist layouts", async ({ page }) => {
    expect(wishlistTrackerId).not.toBeNull()
    await page.goto("/wishlist")
    // Next can keep a hidden previous route tree outside the app shell. The
    // visible page is the one mounted under #main-content; scope interactions
    // there instead of matching a framework-preserved hidden duplicate.
    const wishlistPage = page.locator("#main-content [data-wishlist-page]")
    await expect(wishlistPage).toHaveCount(1)
    await expect(wishlistPage).toBeVisible()

    await wishlistPage.getByRole("button", { name: "Desired tracker" }).click()
    await wishlistPage.getByRole("option", { name: "BroadcasTheNet" }).click()
    await expect(wishlistPage.getByText("Known routes")).toBeVisible({ timeout: 15_000 })
    await expect(wishlistPage.getByText("Needs checking").first()).toBeVisible()

    await page.setViewportSize({ width: 1280, height: 1400 })
    await page.screenshot({ path: "test-results/visual-wishlist-light.png" })
    await page.evaluate(() => {
      document.documentElement.dataset.theme = "dark"
    })
    await page.screenshot({ path: "test-results/visual-wishlist-dark.png" })

    await page.setViewportSize({ width: 390, height: 1200 })
    await page.waitForFunction(
      () => document.querySelector('[data-mobile="true"][data-collapsed="true"]') !== null
    )
    await page.waitForTimeout(300)
    await page.screenshot({ path: "test-results/visual-wishlist-mobile.png" })
  })
})
test.describe.serial("Prowlarr search visual evidence", () => {
  let searchTrackerId: number | null = null
  let searchServer: ReturnType<typeof createServer> | null = null

  test.beforeAll(async () => {
    const sql = e2eSql()
    try {
      const [settings] = await sql<{ encryption_salt: string }[]>`
        select encryption_salt from app_settings limit 1
      `
      const key = await deriveKey(E2E_OWNER.password, settings.encryption_salt)
      const [tracker] = await sql<{ id: number }[]>`
        insert into trackers (
          name, base_url, registry_slug, platform_type, is_active,
          joined_at, last_polled_at, encrypted_api_token, created_at, updated_at
        ) values (
          'TEST Visual Search', 'https://tt-p19.invalid', 'alpharatio', 'unit3d', true,
          '2025-01-01T00:00:00.000Z', now(), ${encrypt("synthetic-p19-token", key)}, now(), now()
        ) returning id
      `
      searchTrackerId = tracker.id
      await sql`
        insert into tracker_snapshots (
          tracker_id, polled_at, uploaded_bytes, downloaded_bytes, ratio,
          buffer_bytes, seeding_count, leeching_count, seedbonus, hit_and_runs,
          required_ratio, warned, freeleech_tokens, is_manual
        ) values (
          ${tracker.id}, now(), ${500 * GiB}, ${200 * GiB}, 2.5,
          ${300 * GiB}, 5, 0, 10, 0, 1, false, 0, false
        )
      `
    } finally {
      await sql.end()
    }
  })

  test.afterAll(async () => {
    if (searchServer) {
      await new Promise<void>((resolve) => searchServer?.close(() => resolve()))
    }
    const sql = e2eSql()
    try {
      if (searchTrackerId !== null) {
        await sql`delete from trackers where id = ${searchTrackerId}`
      }
    } finally {
      await sql.end()
    }
  })

  test("captures desktop light/dark and 390px search layouts", async ({ page, request }) => {
    test.setTimeout(60_000)
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://127.0.0.1")
      if (url.pathname === "/api/v1/indexer") {
        res.writeHead(200, { "content-type": "application/json" })
        res.end(
          JSON.stringify([
            {
              id: 101,
              name: "AlphaRatio",
              implementation: "AlphaRatio",
              fields: [{ name: "baseUrl", value: "https://alpharatio.cc" }],
            },
            {
              id: 102,
              name: "Mystery Tracker",
              implementation: "Unknown",
              fields: [],
            },
          ])
        )
        return
      }
      if (url.pathname === "/api/v1/search" && url.searchParams.get("indexerIds") === "101") {
        res.writeHead(200, { "content-type": "application/json" })
        res.end(
          JSON.stringify([
            {
              indexerId: 101,
              indexer: "AlphaRatio",
              title: "Synthetic.Release.2026.1080p",
              size: 2 * GiB,
              seeders: 17,
              leechers: 2,
              publishDate: "2026-10-26T12:00:00.000Z",
              protocol: "torrent",
              indexerFlags: ["freeleech"],
              downloadUrl: "https://prowlarr.invalid/download?apikey=must-not-leak",
              magnetUrl: "magnet:?xt=urn:btih:must-not-leak",
              guid: "must-not-leak",
            },
            {
              indexerId: 101,
              indexer: "AlphaRatio",
              title: "Synthetic.Unknown.Metadata.2025.1080p",
              size: 0,
              seeders: null,
              publishDate: "0001-01-01T00:00:00.000Z",
              protocol: "torrent",
              indexerFlags: [],
            },
          ])
        )
        return
      }
      if (url.pathname === "/api/v1/search") {
        res.writeHead(429, { "content-type": "application/json" })
        res.end(JSON.stringify({ error: "rate limited" }))
        return
      }
      res.writeHead(404)
      res.end()
    })
    searchServer = server
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
    const address = server.address()
    if (!address || typeof address === "string") throw new Error("no Prowlarr address")
    const prowlarrUrl = `http://127.0.0.1:${address.port}`

    try {
      await request.patch("/api/settings", {
        data: {
          prowlarrUrl,
          prowlarrApiKey: "synthetic-prowlarr-key",
          prowlarrAllowPrivate: true,
        },
      })
      await page.goto("/search")
      await expect(page.locator("[data-search-page]")).toBeVisible()
      await expect(page.locator("fieldset input[type=checkbox]").first()).toBeVisible({
        timeout: 15_000,
      })
      await page.getByRole("button", { name: "Select all" }).click()
      await page.getByLabel("Search releases").fill("synthetic")
      await page.getByRole("button", { name: "Search selected indexers" }).click()
      await expect(page.getByText("Partial results")).toBeVisible({ timeout: 15_000 })
      await expect(page.getByText("Synthetic.Release.2026.1080p")).toBeVisible()
      await expect(page.getByText("Synthetic.Unknown.Metadata.2025.1080p")).toBeVisible()

      await page.setViewportSize({ width: 1280, height: 1400 })
      await page.screenshot({ path: "test-results/visual-search-light.png" })
      await page.evaluate(() => {
        document.documentElement.dataset.theme = "dark"
      })
      await page.screenshot({ path: "test-results/visual-search-dark.png" })

      await expect(page.locator("[data-search-results] input[type=checkbox]")).toHaveCount(2)
      const compareLabels = page.locator("[data-search-results]").getByText("Compare", { exact: true })
      await compareLabels.nth(0).click()
      await compareLabels.nth(1).click()
      await page
        .locator('[data-comparison-panel] input[name="comparison-target-ratio"]')
        .fill("1.5")
      await expect(page.locator("[data-comparison-panel]")).toBeVisible()
      await page.evaluate(() => {
        document.documentElement.dataset.theme = "light"
        document
          .querySelector("[data-comparison-panel]")
          ?.scrollIntoView({ block: "start" })
      })
      await page.waitForTimeout(200)
      await page.screenshot({ path: "test-results/visual-comparison-light.png" })
      await page.evaluate(() => {
        document.documentElement.dataset.theme = "dark"
      })
      await page.screenshot({ path: "test-results/visual-comparison-dark.png" })

      await page.setViewportSize({ width: 390, height: 1200 })
      await page.waitForFunction(
        () => document.querySelector('[data-mobile="true"][data-collapsed="true"]') !== null
      )
      await page.waitForTimeout(300)
      await page.evaluate(() => {
        document
          .querySelector("[data-comparison-panel]")
          ?.scrollIntoView({ block: "start" })
      })
      await page.waitForTimeout(200)
      await page.screenshot({ path: "test-results/visual-comparison-mobile.png" })
    } finally {
      await request.patch("/api/settings", {
        data: { prowlarrUrl: null, prowlarrApiKey: null },
      })
    }
  })
})
test.describe.serial("monitoring register visual evidence", () => {
  const ids: number[] = []

  test.beforeAll(async () => {
    const sql = e2eSql()
    try {
      const [settings] = await sql<{ encryption_salt: string }[]>`
        select encryption_salt from app_settings limit 1
      `
      const key = await deriveKey(E2E_OWNER.password, settings.encryption_salt)
      const rows = [
        {
          name: "TEST Register Fresh",
          slug: "alpharatio",
          polled: new Date(),
          upload: 1 * 1024 ** 4,
          download: 500 * 1024 ** 3,
          bonus: 1234,
        },
        {
          name: "TEST Register Stale",
          slug: "aither",
          polled: new Date(Date.now() - 4 * 60 * 60 * 1000),
          upload: 2 * 1024 ** 4,
          download: 1 * 1024 ** 4,
          bonus: 50,
        },
        {
          name: "TEST Register Missing",
          slug: "broadcasthenet",
          polled: null,
          upload: 0,
          download: 0,
          bonus: 0,
        },
      ]
      for (const row of rows) {
        const [tracker] = await sql<{ id: number }[]>`
          insert into trackers (
            name, base_url, registry_slug, platform_type, is_active,
            joined_at, last_polled_at, encrypted_api_token, created_at, updated_at
          ) values (
            ${row.name}, ${`https://${row.slug}.invalid`}, ${row.slug}, 'unit3d', true,
            '2025-01-01T00:00:00.000Z', ${row.polled}, ${encrypt("synthetic-p25-token", key)}, now(), now()
          ) returning id
        `
        ids.push(tracker.id)
        if (row.polled !== null) {
          await sql`
            insert into tracker_snapshots (
              tracker_id, polled_at, uploaded_bytes, downloaded_bytes, ratio,
              buffer_bytes, seeding_count, leeching_count, seedbonus, hit_and_runs,
              required_ratio, warned, freeleech_tokens, is_manual
            ) values (
              ${tracker.id}, ${row.polled}, ${row.upload}, ${row.download}, 2,
              ${row.upload - row.download}, 5, 0, ${row.bonus}, 0, 1, false, 0, false
            )
          `
        }
      }
    } finally {
      await sql.end()
    }
  })

  test.afterAll(async () => {
    const sql = e2eSql()
    try {
      for (const id of ids) await sql`delete from trackers where id = ${id}`
    } finally {
      await sql.end()
    }
  })

  test("captures light/dark desktop and 390px register layouts", async ({ page }) => {
    await page.goto("/")
    // Next may retain a hidden previous route tree outside the app shell. Only
    // the copy under #main-content is the active application page.
    const register = page.locator("#main-content #register")
    await expect(register).toHaveCount(1)
    await expect(register).toBeVisible({ timeout: 15_000 })
    await expect(register.getByText("TEST Register Fresh").filter({ visible: true })).toBeVisible()
    await expect(register.getByText("1,234").filter({ visible: true })).toBeVisible()
    await expect(
      register.getByLabel("stale snapshot").filter({ visible: true })
    ).toBeVisible()
    await page.evaluate(() => {
      document.documentElement.dataset.theme = "light"
      document.querySelector("#main-content #register")?.scrollIntoView({ block: "start" })
    })
    await page.waitForTimeout(200)
    await register.screenshot({ path: "test-results/visual-register-light.png" })

    await page.evaluate(() => {
      document.documentElement.dataset.theme = "dark"
    })
    await register.screenshot({ path: "test-results/visual-register-dark.png" })

    await page.setViewportSize({ width: 390, height: 1200 })
    await page.waitForFunction(
      () => document.querySelector('[data-mobile="true"][data-collapsed="true"]') !== null
    )
    await page.waitForTimeout(300)
    await page.evaluate(() => {
      document.querySelector("#main-content #register")?.scrollIntoView({ block: "start" })
    })
    await register.screenshot({ path: "test-results/visual-register-mobile.png" })
  })
})
test.describe.serial("rank goal summary visual evidence", () => {
  const ids: number[] = []

  test.beforeAll(async () => {
    const sql = e2eSql()
    try {
      const [settings] = await sql<{ encryption_salt: string }[]>`
        select encryption_salt from app_settings limit 1
      `
      const key = await deriveKey(E2E_OWNER.password, settings.encryption_salt)
      const rows = [
        { name: "TEST Rank Goal", slug: "torrentleech", group: "Power User" },
        { name: "TEST Rank Unsupported", slug: "myanonamouse", group: "Power User" },
      ]
      const idsBySlug: Record<string, number> = {}
      for (const row of rows) {
        const [tracker] = await sql<{ id: number }[]>`
          insert into trackers (
            name, base_url, registry_slug, platform_type, is_active,
            joined_at, last_polled_at, encrypted_api_token, created_at, updated_at
          ) values (
            ${row.name}, ${`https://${row.slug}.invalid`}, ${row.slug}, 'unit3d', true,
            ${new Date(Date.now() - 20 * 86400000)}, now(),
            ${encrypt("synthetic-p26-token", key)}, now(), now()
          ) returning id
        `
        ids.push(tracker.id)
        idsBySlug[row.slug] = tracker.id
        await sql`
          insert into tracker_snapshots (
            tracker_id, polled_at, uploaded_bytes, downloaded_bytes, ratio, group_name,
            buffer_bytes, seeding_count, leeching_count, seedbonus, hit_and_runs,
            required_ratio, warned, freeleech_tokens, is_manual
          ) values (
            ${tracker.id}, now(), ${1 * 1024 ** 4}, ${500 * 1024 ** 3}, 1.0, ${row.group},
            ${512 * 1024 ** 3}, 3, 0, 100, 0, 1, false, 0, false
          )
        `
      }
      await sql`
        update app_settings
        set rank_goals = ${JSON.stringify({
          [String(idsBySlug.torrentleech)]: { targetRank: "Super User" },
        })}
      `
    } finally {
      await sql.end()
    }
  })

  test.afterAll(async () => {
    const sql = e2eSql()
    try {
      for (const id of ids) await sql`delete from trackers where id = ${id}`
      await sql`update app_settings set rank_goals = null`
    } finally {
      await sql.end()
    }
  })

  test("captures light/dark desktop and 390px summary layouts", async ({ page }) => {
    await page.goto("/")
    await expect(page.locator("[data-rank-stacks]")).toBeVisible({ timeout: 15_000 })
    const ranksToggle = page.getByRole("button", { name: "Ranks" })
    if ((await ranksToggle.getAttribute("aria-expanded")) === "false") {
      await ranksToggle.click()
    }
    await expect(page.locator("[data-rank-goal-summary]")).toHaveCount(2)
    await expect(page.getByText("Target set")).toBeVisible()
    await expect(page.getByText("Structured progress unavailable")).toBeVisible()
    await expect(page.getByText(/Current: Power User/).first()).toBeVisible()

    await page.evaluate(() => {
      document.documentElement.dataset.theme = "light"
      document.querySelector("[data-rank-stacks]")?.scrollIntoView({ block: "start" })
    })
    await page.waitForTimeout(200)
    await page.locator("[data-rank-stacks]").screenshot({
      path: "test-results/visual-rank-summary-light.png",
    })

    await page.evaluate(() => {
      document.documentElement.dataset.theme = "dark"
    })
    await page.locator("[data-rank-stacks]").screenshot({
      path: "test-results/visual-rank-summary-dark.png",
    })

    await page.setViewportSize({ width: 390, height: 1200 })
    await page.waitForFunction(
      () => document.querySelector('[data-mobile="true"][data-collapsed="true"]') !== null
    )
    await page.waitForTimeout(300)
    await page.evaluate(() => {
      document.querySelector("[data-rank-stacks]")?.scrollIntoView({ block: "start" })
    })
    await page.locator("[data-rank-stacks]").screenshot({
      path: "test-results/visual-rank-summary-mobile.png",
    })

    await page.setViewportSize({ width: 1280, height: 1400 })
    await page.goto(`/trackers/${ids[0]}#rank-goal`)
    const rankPanel = page.locator("#main-content #rank-goal")
    await expect(rankPanel).toBeVisible({ timeout: 15_000 })
    await rankPanel.getByRole("button", { name: "Clear target" }).click()
    await expect(rankPanel.getByLabel("Target rank")).toHaveValue("")
    await expect(rankPanel.getByText(/No saved target for this tracker/)).toBeVisible()
    await expect(rankPanel.getByText(/Suggested next rank:/)).toBeVisible()
    await page.evaluate(() => {
      document.documentElement.dataset.theme = "light"
      document.querySelector("#rank-goal")?.scrollIntoView({ block: "start" })
    })
    await page.waitForTimeout(200)
    await rankPanel.screenshot({ path: "test-results/visual-rank-target-light.png" })
    await page.evaluate(() => {
      document.documentElement.dataset.theme = "dark"
    })
    await rankPanel.screenshot({ path: "test-results/visual-rank-target-dark.png" })

    await page.setViewportSize({ width: 390, height: 1200 })
    await page.waitForFunction(
      () => document.querySelector('[data-mobile="true"][data-collapsed="true"]') !== null
    )
    await page.waitForTimeout(300)
    await page.evaluate(() => {
      document.querySelector("#rank-goal")?.scrollIntoView({ block: "start" })
    })
    await rankPanel.screenshot({ path: "test-results/visual-rank-target-mobile.png" })
  })
})