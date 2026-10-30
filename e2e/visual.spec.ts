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

  // P37 hides the Download budget panel. Its visual evidence is parked with the code.
  test.skip("captures the rank goal and download budget panels", async ({ page }) => {
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
      () => document.querySelector('[data-mobile="true"]') !== null
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

  test.skip("captures the reported queue totals after the UX fix", async ({ page }) => {
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
      () => document.querySelector('[data-mobile="true"]') !== null
    )
    await page.waitForTimeout(300)
    await page.evaluate(() => {
      const main = document.querySelector("main")
      const el = document.querySelector("[data-download-budget-panel]") as HTMLElement | null
      if (main && el) main.scrollTop += el.getBoundingClientRect().top - 72
    })
    await page.screenshot({ path: "test-results/visual-budget-queue-after-mobile.png" })
  })

  // P37 hides the Settings import UI. The import code remains for now.
  test.skip("previews and imports a selected Prowlarr indexer", async ({ page, request }) => {
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
        () => document.querySelector('[data-mobile="true"]') !== null
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

  // P37 hides the Settings import UI. The import code remains for now.
  test.skip("previews and imports a selected Jackett indexer", async ({ page }) => {
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
        () => document.querySelector('[data-mobile="true"]') !== null
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
// P37 hides the Integrations settings tab. The token code remains for now.
test.describe.skip("integration token visual evidence (hidden in P37)", () => {
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
        () => document.querySelector('[data-mobile="true"]') !== null
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
test.describe.serial("tracker pathways visual evidence", () => {
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
          'TEST Visual Pathways', 'https://tt-p18.invalid', 'alpharatio',
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
    } finally {
      await sql.end()
    }
  })

  test("captures desktop light/dark and 390px tracker pathways layouts", async ({ page }) => {
    expect(wishlistTrackerId).not.toBeNull()
    await page.goto("/pathways")
    // Next can keep a hidden previous route tree outside the app shell. The
    // visible page is the one mounted under #main-content; scope interactions
    // there instead of matching a framework-preserved hidden duplicate.
    const pathwaysPage = page.locator("#main-content [data-pathways-page]")
    await expect(pathwaysPage).toHaveCount(1)
    await expect(pathwaysPage).toBeVisible()

    await expect(page.getByRole("link", { name: "Pathways", exact: true })).toBeVisible()
    await expect(page).toHaveTitle("Tracker pathways")
    await expect(
      pathwaysPage.getByRole("heading", { name: "Where your trackers can take you" })
    ).toBeVisible()
    await expect(pathwaysPage.locator("[data-owned-card]").first()).toBeVisible()
    await expect(pathwaysPage.getByText(/Your trackers \(/)).toHaveCount(0)
    await pathwaysPage.getByRole("button", { name: "Choose a tracker" }).click()
    await pathwaysPage.getByRole("combobox", { name: "Search trackerpathways" }).fill("Aither")
    await pathwaysPage.getByRole("option", { name: "Aither" }).click()
    await expect(pathwaysPage.getByText("Best path")).toBeVisible({ timeout: 15_000 })
    await expect(pathwaysPage.getByText("Total time left")).toBeVisible()
    await expect(pathwaysPage.getByText(/From AlphaRatio to Aither ·/)).toBeVisible()
    await expect(pathwaysPage.locator('[data-target-profile="Aither"]')).toBeVisible()
    await expect(pathwaysPage.locator("[data-invited-from]")).toBeVisible()
    await expect(pathwaysPage.locator("[data-can-invite-to]")).toBeVisible()
    await expect(pathwaysPage.getByText("Invite class", { exact: true })).toBeVisible()
    await expect(pathwaysPage.getByText(/Checked /)).toBeVisible()
    await expect(pathwaysPage.getByText("Structured requirements")).toHaveCount(0)
    await expect(pathwaysPage.getByText(/Availability:/)).toHaveCount(0)
    await expect(pathwaysPage.getByText("Saving…")).toHaveCount(0)

    await page.setViewportSize({ width: 1440, height: 1400 })
    await page.evaluate(() => {
      document.querySelector<HTMLElement>("#main-content")?.scrollTo(0, 0)
    })
    await page.waitForTimeout(200)
    await page.screenshot({ path: "test-results/visual-pathways-light.png" })
    await page.evaluate(() => {
      document.documentElement.dataset.theme = "dark"
    })
    await page.screenshot({ path: "test-results/visual-pathways-dark.png" })

    await pathwaysPage.locator('[data-target-profile="Aither"]').scrollIntoViewIfNeeded()
    await page.waitForTimeout(150)
    await page.screenshot({ path: "test-results/visual-pathways-profile-dark.png" })
    await page.evaluate(() => {
      document.documentElement.dataset.theme = "light"
    })
    await page.waitForTimeout(150)
    await page.screenshot({ path: "test-results/visual-pathways-profile-light.png" })

    await page.evaluate(() => {
      document.documentElement.dataset.theme = "light"
    })
    const firstStepDetails = pathwaysPage.locator("details").first()
    await firstStepDetails.locator("summary").click()
    await expect(firstStepDetails).toHaveAttribute("open", "")
    await expect(firstStepDetails).toContainText(/Source updated .+ · last verified /)
    await expect(firstStepDetails).not.toContainText(/\d{4}-\d{2}-\d{2}T/)
    await page.waitForTimeout(150)
    await page.screenshot({ path: "test-results/visual-pathways-details-light.png" })
    await page.evaluate(() => {
      document.documentElement.dataset.theme = "dark"
    })
    await page.waitForTimeout(150)
    await page.screenshot({ path: "test-results/visual-pathways-details-dark.png" })
    await firstStepDetails.locator("summary").click()

    await page.setViewportSize({ width: 390, height: 1200 })
    await page.waitForFunction(
      () => document.querySelector('[data-mobile="true"]') !== null
    )
    await page.evaluate(() => {
      document.querySelector<HTMLElement>("#main-content")?.scrollTo(0, 0)
    })
    await page.waitForTimeout(300)
    await page.screenshot({ path: "test-results/visual-pathways-mobile-dark.png" })
    await page.evaluate(() => {
      document.documentElement.dataset.theme = "light"
    })
    await page.screenshot({ path: "test-results/visual-pathways-mobile.png" })

    await pathwaysPage.getByText("Best path").scrollIntoViewIfNeeded()
    await page.waitForTimeout(150)
    await page.screenshot({ path: "test-results/visual-pathways-mobile-best.png" })
    await page.evaluate(() => {
      document.documentElement.dataset.theme = "dark"
    })
    await page.waitForTimeout(150)
    await page.screenshot({ path: "test-results/visual-pathways-mobile-best-dark.png" })

    await pathwaysPage.locator('[data-target-profile="Aither"]').scrollIntoViewIfNeeded()
    await page.waitForTimeout(150)
    await page.screenshot({ path: "test-results/visual-pathways-profile-mobile-dark.png" })
    await page.evaluate(() => {
      document.documentElement.dataset.theme = "light"
    })
    await page.waitForTimeout(150)
    await page.screenshot({ path: "test-results/visual-pathways-profile-mobile.png" })
  })
})
// P37 hides the Search UI. The Prowlarr search code remains, so this visual
// evidence is parked until the feature is exposed again.
test.describe.skip("Prowlarr search visual evidence (hidden in P37)", () => {
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
      await expect(page.locator("[data-search-page]:visible")).toBeVisible()
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
        () => document.querySelector('[data-mobile="true"]') !== null
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
    await page.getByRole("button", { name: "Table" }).click()
    // Next may retain a hidden previous route tree outside the app shell. Only
    // the copy under #main-content is the active application page.
    const register = page.locator("#main-content #register")
    await expect(register).toHaveCount(1)
    await expect(register).toBeVisible({ timeout: 15_000 })
    await expect(register.getByText("TEST Register Fresh").filter({ visible: true })).toBeVisible()
    await expect(register.getByText("1,234").filter({ visible: true })).toBeVisible()
    expect(
      await register.getByLabel("stale snapshot").filter({ visible: true }).count()
    ).toBeGreaterThan(0)
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
      () => document.querySelector('[data-mobile="true"]') !== null
    )
    await page.waitForTimeout(300)
    await page.evaluate(() => {
      document.querySelector("#main-content #register")?.scrollIntoView({ block: "start" })
    })
    await register.screenshot({ path: "test-results/visual-register-mobile.png" })
  })
})
test.describe.serial("dashboard at-a-glance visual evidence", () => {
  const ids: number[] = []

  test.beforeAll(async () => {
    const sql = e2eSql()
    try {
      const [settings] = await sql<{ encryption_salt: string }[]>`
        select encryption_salt from app_settings limit 1
      `
      const key = await deriveKey(E2E_OWNER.password, settings.encryption_salt)
      const rows = [
        { name: "TEST Glance Fresh", slug: "torrentleech", last: new Date(), stats: true },
        {
          name: "TEST Glance Stale",
          slug: "aither",
          last: new Date(Date.now() - 4 * 60 * 60 * 1000),
          stats: true,
        },
        { name: "TEST Glance Missing", slug: "broadcasthenet", last: null, stats: false },
      ]
      for (const row of rows) {
        const [tracker] = await sql<{ id: number }[]>`
          insert into trackers (
            name, base_url, registry_slug, platform_type, is_active,
            joined_at, last_polled_at, encrypted_api_token, created_at, updated_at
          ) values (
            ${row.name}, ${`https://${row.slug}.invalid`}, ${row.slug}, 'unit3d', true,
            '2025-01-01T00:00:00.000Z', ${row.last}, ${encrypt("synthetic-p28-token", key)}, now(), now()
          ) returning id
        `
        ids.push(tracker.id)
        if (row.stats) {
          await sql`
            insert into tracker_snapshots (
              tracker_id, polled_at, uploaded_bytes, downloaded_bytes, ratio, group_name,
              buffer_bytes, seeding_count, leeching_count, seedbonus, hit_and_runs,
              required_ratio, warned, freeleech_tokens, is_manual
            ) values (
              ${tracker.id}, ${row.last}, ${1 * 1024 ** 4}, ${500 * 1024 ** 3}, 2.0, 'Power User',
              ${512 * 1024 ** 3}, 4, 0, 1234, 0, 1, false, 0, false
            )
          `
        }
      }
      const goals = Object.fromEntries(
        ids.map((id) => [String(id), { targetRank: "Super User" }])
      )
      await sql`update app_settings set rank_goals = ${JSON.stringify(goals)}`
    } finally {
      await sql.end()
    }
  })

  test.afterAll(async () => {
    const sql = e2eSql()
    try {
      await sql`update app_settings set rank_goals = null, recruitment_state = null`
      for (const id of ids) await sql`delete from trackers where id = ${id}`
    } finally {
      await sql.end()
    }
  })

  test("captures the first viewport at 1440px and 390px", async ({ page }) => {
    test.setTimeout(90_000)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto("/")
    const totals = page.locator("#main-content [data-dashboard-totals]")
    await expect(totals).toBeVisible({ timeout: 15_000 })
    await expect(totals.getByText("Uploaded", { exact: true })).toBeVisible()
    await expect(totals.getByText("Downloaded", { exact: true })).toBeVisible()
    await expect(totals.getByText("Buffer", { exact: true })).toBeVisible()
    await expect(totals.getByText("Overall ratio", { exact: true })).toBeVisible()
    await expect(totals.getByText("Need attention", { exact: true })).toBeVisible()
    await expect(totals.getByText(/Totals from 2 of 3 trackers/)).toBeVisible()
    await expect(page.locator("#main-content [data-tracker-grid]")).toBeVisible()

    async function setTheme(theme: "light" | "dark") {
      await page.evaluate((value) => {
        document.documentElement.dataset.theme = value
      }, theme)
      await page.waitForTimeout(150)
    }

    await setTheme("light")
    await page.screenshot({ path: "test-results/visual-dashboard-grid-light.png" })
    await setTheme("dark")
    await page.screenshot({ path: "test-results/visual-dashboard-grid-dark.png" })

    await setTheme("light")
    await page.getByRole("button", { name: "Table" }).click()
    const register = page.locator("#main-content #register")
    await expect(register).toBeVisible({ timeout: 15_000 })
    await expect(page.locator("#main-content [data-total-tile]")).toHaveCount(5)
    await page.screenshot({ path: "test-results/visual-dashboard-table-light.png" })
    await setTheme("dark")
    await page.screenshot({ path: "test-results/visual-dashboard-table-dark.png" })

    await page.setViewportSize({ width: 390, height: 844 })
    await page.waitForFunction(
      () => document.querySelector('[data-mobile="true"]') !== null
    )
    await page.waitForTimeout(300)
    await setTheme("light")
    await page.screenshot({ path: "test-results/visual-dashboard-table-mobile.png" })
    await setTheme("dark")
    await page.screenshot({ path: "test-results/visual-dashboard-table-mobile-dark.png" })

    await setTheme("light")
    await page.getByRole("button", { name: "Grid" }).click()
    await expect(page.locator("#main-content [data-tracker-grid]")).toBeVisible()
    await page.screenshot({ path: "test-results/visual-dashboard-grid-mobile.png" })
    await setTheme("dark")
    await page.screenshot({ path: "test-results/visual-dashboard-grid-mobile-dark.png" })
  })
})
test.describe.serial("P32a foundation visual evidence", () => {
  let foundationTrackerId: number | null = null
  let pathwayTrackerId: number | null = null

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
          'TEST Foundation', 'https://tt-p32a.invalid', 'torrentleech', 'unit3d', true,
          '2025-01-01T00:00:00.000Z', now(), ${encrypt("synthetic-p32a-token", key)},
          '#6d56eb', now(), now()
        ) returning id
      `
      foundationTrackerId = tracker.id
      await sql`
        insert into tracker_snapshots (
          tracker_id, polled_at, uploaded_bytes, downloaded_bytes, ratio, group_name,
          buffer_bytes, seeding_count, leeching_count, seedbonus, hit_and_runs,
          required_ratio, warned, freeleech_tokens, is_manual
        ) values (
          ${tracker.id}, now(), ${2 * 1024 ** 4}, ${1 * 1024 ** 4}, 2.0, 'Power User',
          ${1 * 1024 ** 4}, 8, 1, 1234, 0, 1, false, 0, false
        )
      `
      const [pathwayTracker] = await sql<{ id: number }[]>`
        insert into trackers (
          name, base_url, registry_slug, platform_type, is_active, joined_at,
          last_polled_at, encrypted_api_token, color, created_at, updated_at
        ) values (
          'TEST Pathways', 'https://tt-p33a.invalid', 'alpharatio', 'unit3d', true,
          '2025-01-01T00:00:00.000Z', now(), ${encrypt("synthetic-p33a-token", key)},
          '#6d56eb', now(), now()
        ) returning id
      `
      pathwayTrackerId = pathwayTracker.id
      await sql`
        insert into tracker_snapshots (
          tracker_id, polled_at, uploaded_bytes, downloaded_bytes, ratio, group_name,
          buffer_bytes, seeding_count, leeching_count, seedbonus, hit_and_runs,
          required_ratio, warned, freeleech_tokens, is_manual
        ) values (
          ${pathwayTracker.id}, now(), ${1 * 1024 ** 4}, ${500 * 1024 ** 3}, 2.0, 'Power User',
          ${512 * 1024 ** 3}, 4, 0, 500, 0, 1, false, 0, false
        )
      `
      await sql`update app_settings set rank_goals = ${JSON.stringify({ [String(tracker.id)]: { targetRank: "Super User" } })}, recruitment_state = ${JSON.stringify({
        version: 2,
        desiredTrackerSlug: "Aither",
        hiddenPathKeys: [],
        goalLinks: [],
      })}`
    } finally {
      await sql.end()
    }
  })

  test.afterAll(async () => {
    if (foundationTrackerId === null) return
    const sql = e2eSql()
    try {
      await sql`update app_settings set rank_goals = null, recruitment_state = null`
      await sql`delete from trackers where id = ${foundationTrackerId}`
      if (pathwayTrackerId !== null) {
        await sql`delete from trackers where id = ${pathwayTrackerId}`
      }
    } finally {
      await sql.end()
    }
  })

  test("captures the shared shell across pages", async ({ page }) => {
    test.setTimeout(120_000)
    expect(foundationTrackerId).not.toBeNull()
    const routes = [
      { slug: "dashboard", path: "/" },
      { slug: "tracker", path: `/trackers/${foundationTrackerId}` },
      { slug: "settings", path: "/settings" },
    ]

    for (const route of routes) {
      await page.setViewportSize({ width: 1440, height: 1000 })
      await page.goto(route.path)
      await expect(page.locator("#main-content h1").first()).toBeVisible({ timeout: 15_000 })
      await page.evaluate(() => {
        document.querySelector<HTMLElement>("#main-content")?.scrollTo(0, 0)
        document.documentElement.dataset.theme = "light"
      })
      await page.waitForTimeout(150)
      await page.screenshot({ path: `test-results/visual-foundation-${route.slug}-light.png` })
      await page.evaluate(() => {
        document.documentElement.dataset.theme = "dark"
      })
      await page.waitForTimeout(150)
      await page.screenshot({ path: `test-results/visual-foundation-${route.slug}-dark.png` })

      await page.setViewportSize({ width: 390, height: 844 })
      await page.waitForFunction(
        () => document.querySelector('[data-mobile="true"]') !== null
      )
      await page.evaluate(() => {
        document.querySelector<HTMLElement>("#main-content")?.scrollTo(0, 0)
        document.documentElement.dataset.theme = "light"
      })
      await page.waitForTimeout(200)
      await page.screenshot({
        path: `test-results/visual-foundation-${route.slug}-mobile.png`,
      })
      await page.evaluate(() => {
        document.documentElement.dataset.theme = "dark"
      })
      await page.waitForTimeout(150)
      await page.screenshot({
        path: `test-results/visual-foundation-${route.slug}-mobile-dark.png`,
      })
    }
  })

  test("captures tracker detail and settings", async ({ page }) => {
    test.setTimeout(120_000)
    expect(foundationTrackerId).not.toBeNull()

    for (const route of [
      { slug: "tracker-detail", path: `/trackers/${foundationTrackerId}` },
      { slug: "settings-detail", path: "/settings" },
    ]) {
      await page.setViewportSize({ width: 1440, height: 1000 })
      await page.goto(route.path)
      await expect(page.locator("#main-content h1").first()).toBeVisible({ timeout: 15_000 })
      if (route.slug === "settings-detail") {
        await expect(page.getByRole("tab", { name: "Integrations" })).toHaveCount(0)
        await expect(page.getByText("Prowlarr")).toHaveCount(0)
        await expect(page.getByText("Jackett")).toHaveCount(0)
        await expect(page.getByRole("link", { name: "Search" })).toHaveCount(0)
        const widths = await page.evaluate(() => {
          const frame = document.querySelector("#main-content > div") as HTMLElement | null
          const settings = document.querySelector("[data-settings-page]") as HTMLElement | null
          if (!frame || !settings) return null
          const style = getComputedStyle(frame)
          return {
            frame:
              frame.clientWidth -
              Number.parseFloat(style.paddingLeft) -
              Number.parseFloat(style.paddingRight),
            settings: settings.getBoundingClientRect().width,
          }
        })
        expect(widths).not.toBeNull()
        expect(widths?.settings ?? 0).toBeGreaterThan(1000)
        expect(Math.abs((widths?.settings ?? 0) - (widths?.frame ?? 0))).toBeLessThanOrEqual(2)
      }
      if (route.slug === "tracker-detail") {
        await expect(page.locator("[data-download-budget-panel]")).toHaveCount(0)
        await expect(page.locator("[data-rank-goal-panel]").first()).toBeVisible()
      }
      await page.evaluate(() => {
        document.querySelector<HTMLElement>("#main-content")?.scrollTo(0, 0)
        document.documentElement.dataset.theme = "light"
      })
      await page.waitForTimeout(200)
      await page.screenshot({ path: `test-results/p32d-${route.slug}-light.png` })
      await page.evaluate(() => {
        document.documentElement.dataset.theme = "dark"
      })
      await page.waitForTimeout(150)
      await page.screenshot({ path: `test-results/p32d-${route.slug}-dark.png` })

      await page.setViewportSize({ width: 390, height: 844 })
      await page.waitForFunction(
        () => document.querySelector('[data-mobile="true"]') !== null
      )
      await page.evaluate(() => {
        document.querySelector<HTMLElement>("#main-content")?.scrollTo(0, 0)
        document.documentElement.dataset.theme = "light"
      })
      await page.waitForTimeout(200)
      await page.screenshot({ path: `test-results/p32d-${route.slug}-mobile.png` })
      await page.evaluate(() => {
        document.documentElement.dataset.theme = "dark"
      })
      await page.waitForTimeout(150)
      await page.screenshot({ path: `test-results/p32d-${route.slug}-mobile-dark.png` })
    }

    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto(`/trackers/${foundationTrackerId}`)
    const rankGoal = page.locator("#main-content #rank-goal")
    await expect(rankGoal.locator("[data-rank-condition-bar]").first()).toBeVisible({
      timeout: 15_000,
    })
    await rankGoal.scrollIntoViewIfNeeded()
    await page.evaluate(() => {
      document.documentElement.dataset.theme = "light"
    })
    await page.waitForTimeout(150)
    await page.screenshot({ path: "test-results/p32d-rank-goal-light.png" })
    await page.evaluate(() => {
      document.documentElement.dataset.theme = "dark"
    })
    await page.waitForTimeout(150)
    await page.screenshot({ path: "test-results/p32d-rank-goal-dark.png" })
  })

  test("captures P33b decisions at 1440, 1024 and 390", async ({ page }) => {
    test.setTimeout(180_000)
    expect(foundationTrackerId).not.toBeNull()
    const routes = [
      { slug: "dashboard", path: "/" },
      { slug: "pathways", path: "/pathways" },
      { slug: "tracker", path: `/trackers/${foundationTrackerId}` },
      { slug: "settings", path: "/settings" },
    ]

    for (const width of [1440, 1024, 390]) {
      await page.setViewportSize({ width, height: 1000 })
      for (const route of routes) {
        await page.goto(route.path)
        await expect(page.locator("#main-content h1").first()).toBeVisible({ timeout: 15_000 })
        if (width === 1440 && route.slug === "settings") {
          const widths = await page.evaluate(() => {
            const frame = document.querySelector("#main-content > div") as HTMLElement | null
            const settings = document.querySelector("[data-settings-page]") as HTMLElement | null
            if (!frame || !settings) return null
            const style = getComputedStyle(frame)
            return {
              frame:
                frame.clientWidth -
                Number.parseFloat(style.paddingLeft) -
                Number.parseFloat(style.paddingRight),
              settings: settings.getBoundingClientRect().width,
            }
          })
          expect(widths).not.toBeNull()
          expect(widths?.settings ?? 0).toBeGreaterThan(1000)
          expect(Math.abs((widths?.settings ?? 0) - (widths?.frame ?? 0))).toBeLessThanOrEqual(2)
        }
        if (width === 390 && route.slug === "settings") {
          const tabRows = await page.locator('[role="tab"]').evaluateAll((tabs) => {
            return new Set(tabs.map((tab) => Math.round(tab.getBoundingClientRect().top))).size
          })
          expect(tabRows, "settings tabs wrap").toBeGreaterThanOrEqual(2)
        }
        if (width === 390) {
          await page.waitForFunction(
            () => document.querySelector('[data-mobile="true"]') !== null
          )
        }
        await page.evaluate(() => {
          document.querySelector<HTMLElement>("#main-content")?.scrollTo(0, 0)
          document.documentElement.dataset.theme = "light"
        })
        await page.waitForTimeout(150)
        await page.screenshot({
          path: `test-results/p33b-${route.slug}-${width}-light.png`,
        })
        await page.evaluate(() => {
          document.documentElement.dataset.theme = "dark"
        })
        await page.waitForTimeout(120)
        await page.screenshot({
          path: `test-results/p33b-${route.slug}-${width}-dark.png`,
        })
      }

      await page.goto("/")
      await page.getByRole("button", { name: "Table" }).click()
      await expect(page.locator("#main-content #register")).toBeVisible({ timeout: 15_000 })
      if (width === 1024) {
        const tableFits = await page
          .locator("[data-register-table]")
          .evaluate((element) => element.scrollWidth <= element.clientWidth + 1)
        expect(tableFits, "register table fits at 1024px").toBe(true)
        const pageFits = await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth
        )
        expect(pageFits, "page does not overflow at 1024px").toBe(true)
      }
      await page.evaluate(() => {
        document.querySelector<HTMLElement>("#main-content")?.scrollTo(0, 0)
        document.documentElement.dataset.theme = "light"
      })
      await page.waitForTimeout(150)
      await page.screenshot({
        path: `test-results/p33b-dashboard-table-${width}-light.png`,
      })
      await page.evaluate(() => {
        document.documentElement.dataset.theme = "dark"
      })
      await page.waitForTimeout(120)
      await page.screenshot({
        path: `test-results/p33b-dashboard-table-${width}-dark.png`,
      })
    }

    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 })
      await page.goto("/pathways")
      if (width === 390) {
        await page.waitForFunction(
          () => document.querySelector('[data-mobile="true"]') !== null
        )
      }
      await expect(page.getByText(/^From .+ to .+ ·/).first()).toBeVisible()
      const details = page.locator("#main-content details").first()
      await details.locator("summary").click()
      await expect(details).toContainText(/Source updated .+ · last verified /)
      await page.evaluate(() => {
        document.querySelector<HTMLElement>("#main-content")?.scrollTo(0, 0)
        document.documentElement.dataset.theme = "light"
      })
      await page.waitForTimeout(150)
      await page.screenshot({
        path: `test-results/p33b-pathways-details-${width}-light.png`,
      })
      await page.evaluate(() => {
        document.documentElement.dataset.theme = "dark"
      })
      await page.waitForTimeout(120)
      await page.screenshot({
        path: `test-results/p33b-pathways-details-${width}-dark.png`,
      })
    }
  })

  test("keeps the image hosting section hidden", async ({ page }) => {
    test.setTimeout(120_000)
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 })
      await page.goto("/settings")
      await expect(page.locator("#main-content h1").first()).toBeVisible({ timeout: 15_000 })
      await expect(page.getByText("Image Hosting", { exact: true })).toHaveCount(0)
    }
  })

  test("gives the pathways picker a row width and aligns the 390 time block", async ({ page }) => {
    test.setTimeout(120_000)

    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 })
      await page.goto("/pathways")
      await expect(page.locator("#main-content [data-pathways-page]")).toBeVisible({
        timeout: 15_000,
      })
      if (width === 390) {
        await page.waitForFunction(
          () => document.querySelector('[data-mobile="true"]') !== null
        )
      }
      const picker = page.locator("[data-pathway-picker]").first()
      await expect(picker).toBeVisible()
      const pickerBox = await picker.boundingBox()
      expect(pickerBox).not.toBeNull()
      if (!pickerBox) continue
      if (width === 390) {
        expect(pickerBox.width).toBeGreaterThanOrEqual(300)
      } else {
        expect(pickerBox.width).toBeGreaterThanOrEqual(320)
        expect(pickerBox.width).toBeLessThanOrEqual(420)
      }

      const route = page.getByRole("list", { name: "Route" }).first()
      const time = page.locator("[data-pathway-time]").first()
      await expect(route).toBeVisible()
      await expect(time).toBeVisible()
      const routeBox = await route.boundingBox()
      const timeBox = await time.boundingBox()
      expect(routeBox).not.toBeNull()
      expect(timeBox).not.toBeNull()
      if (width === 390 && routeBox && timeBox) {
        expect(Math.abs(routeBox.x - timeBox.x)).toBeLessThanOrEqual(2)
      }
      const sourceLine = page.getByText(/Source: Route data derived/).first()
      await expect(sourceLine).toContainText(/accessed [A-Z][a-z]{2} \d{1,2}, \d{4}/)

      for (const theme of ["light", "dark"] as const) {
        await page.evaluate((nextTheme) => {
          document.documentElement.dataset.theme = nextTheme
        }, theme)
        await page.waitForTimeout(150)
        await page.screenshot({
          path: `test-results/p34b-pathways-${width}-${theme}.png`,
        })
      }
    }
  })

  test("wraps the 390 rank ladder instead of clipping it", async ({ page }) => {
    test.setTimeout(120_000)
    expect(foundationTrackerId).not.toBeNull()
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`/trackers/${foundationTrackerId}`)
    await page.waitForFunction(() => document.querySelector('[data-mobile="true"]') !== null)
    const ladder = page.locator("[data-rank-ladder]").first()
    await expect(ladder).toBeVisible({ timeout: 15_000 })
    const widths = await ladder.evaluate((node) => ({
      scrollWidth: node.scrollWidth,
      clientWidth: node.clientWidth,
    }))
    expect(widths.scrollWidth).toBeLessThanOrEqual(widths.clientWidth + 1)
    for (const rung of ["Registered", "Power User", "Super User", "Extreme User", "TL GOD", "VIP"]) {
      await expect(ladder.getByText(rung, { exact: true })).toBeVisible()
    }
    await ladder.evaluate((node) => node.scrollIntoView({ block: "center" }))
    await page.evaluate(() => {
      document.documentElement.dataset.theme = "dark"
    })
    await page.waitForTimeout(200)
    await page.screenshot({
      path: "test-results/p34b-rank-ladder-390-dark.png",
    })
  })

  test("keeps the first tracker card in the first screen", async ({ page }) => {
    test.setTimeout(120_000)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto("/")
    await page.getByRole("button", { name: "Grid" }).click()
    const card = page.locator("[data-tracker-card]").first()
    await expect(card).toBeVisible({ timeout: 15_000 })
    const box = await card.boundingBox()
    expect(box).not.toBeNull()
    if (!box) return
    expect(box.y).toBeGreaterThanOrEqual(0)
    expect(box.y).toBeLessThan(900)
    await page.evaluate(() => {
      document.documentElement.dataset.theme = "dark"
    })
    await page.waitForTimeout(200)
    await page.screenshot({
      path: "test-results/p34b-dashboard-first-screen-1440-dark.png",
    })
  })

  test("keeps the rank target summary in the first viewport", async ({ page }) => {
    test.setTimeout(120_000)
    expect(foundationTrackerId).not.toBeNull()

    for (const { width, height } of [
      { width: 1440, height: 900 },
      { width: 390, height: 844 },
    ]) {
      for (const theme of ["light", "dark"] as const) {
        await page.setViewportSize({ width, height })
        await page.goto(`/trackers/${foundationTrackerId}`)
        if (width === 390) {
          await page.waitForFunction(
            () => document.querySelector('[data-mobile="true"]') !== null
          )
        }
        await page.evaluate((nextTheme) => {
          document.documentElement.dataset.theme = nextTheme
        }, theme)
        const summary = page.locator("[data-rank-target-summary]").first()
        await expect(summary).toBeVisible({ timeout: 15_000 })
        const box = await summary.boundingBox()
        expect(box).not.toBeNull()
        if (!box) continue
        expect(box.y).toBeGreaterThanOrEqual(0)
        expect(box.y + box.height).toBeLessThanOrEqual(height)
        await page.screenshot({
          path: `test-results/p34b-tracker-summary-${width}-${theme}.png`,
        })
      }
    }
  })

  test("keeps one page frame and the Dashboard H1 in both views", async ({ page }) => {
    test.setTimeout(120_000)
    expect(foundationTrackerId).not.toBeNull()
    const routes = [
      { slug: "dashboard", path: "/" },
      { slug: "pathways", path: "/pathways" },
      { slug: "tracker", path: `/trackers/${foundationTrackerId}` },
      { slug: "settings", path: "/settings" },
    ]

    for (const width of [1440, 390]) {
      const measurements: { slug: string; frame: number }[] = []
      for (const route of routes) {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 })
        await page.goto(route.path)
        await expect(page.locator("#main-content h1").first()).toBeVisible({ timeout: 15_000 })
        if (width === 390) {
          await page.waitForFunction(() => document.querySelector('[data-mobile="true"]') !== null)
        }
        const measurement = await page.evaluate(() => {
          const frame = document.querySelector<HTMLElement>("[data-page-frame]")
          return {
            frame: frame?.getBoundingClientRect().width ?? 0,
          }
        })
        expect(
          measurement.frame,
          `${route.slug} fills the shared frame at ${width}`
        ).toBeGreaterThan(0)
        measurements.push({ slug: route.slug, ...measurement })
      }
      const widths = measurements.map((measurement) => measurement.frame)
      expect(
        Math.max(...widths) - Math.min(...widths),
        `page frames agree at ${width}`
      ).toBeLessThanOrEqual(8)
    }

    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto("/")
    await expect(page.locator("#main-content h1").first()).toHaveText("Dashboard")
    await page.getByRole("button", { name: "Table" }).click()
    await expect(page.locator("#main-content h1").first()).toHaveText("Dashboard")
  })

  test("captures the dashboard grid cards at 1440 and 390", async ({ page }) => {
    test.setTimeout(120_000)

    for (const width of [1440, 390]) {
      for (const theme of ["light", "dark"] as const) {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 })
        await page.goto("/")
        await page.getByRole("button", { name: "Grid" }).click()
        await expect(page.locator("#main-content [data-tracker-grid]")).toBeVisible()
        await page.evaluate((nextTheme) => {
          document.documentElement.dataset.theme = nextTheme
        }, theme)
        await page.waitForTimeout(150)
        await page.screenshot({
          path: `test-results/p34a-dashboard-grid-${width}-${theme}.png`,
        })
      }
    }
  })

  test("redirects the removed Search page to Dashboard", async ({ page }) => {
    await page.goto("/search")
    await expect(page).toHaveURL(/\/$/)
    await expect(page.locator("#main-content h1").first()).toHaveText("Dashboard")
  })

  test("captures the detail metric hues at 1440 and 390", async ({ page }) => {
    test.setTimeout(120_000)
    expect(foundationTrackerId).not.toBeNull()

    for (const width of [1440, 390]) {
      for (const theme of ["light", "dark"] as const) {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 })
        await page.goto(`/trackers/${foundationTrackerId}`)
        if (width === 390) {
          await page.waitForFunction(
            () => document.querySelector('[data-mobile="true"]') !== null
          )
        }
        await page.evaluate((nextTheme) => {
          document.documentElement.dataset.theme = nextTheme
        }, theme)
        const cards = page.locator("[data-core-stat-cards]:visible").first()
        await cards.scrollIntoViewIfNeeded()
        await page.waitForTimeout(150)
        await page.screenshot({
          path: `test-results/p34a-tracker-stats-${width}-${theme}.png`,
        })
      }
    }
  })
})
