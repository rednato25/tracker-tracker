// e2e/visual.spec.ts
//
// Visual evidence with synthetic data. Runs against the guarded
// tracker_tracker_e2e database and never contacts a tracker or download client.
import { mkdir } from "node:fs/promises"
import { expect, test } from "@playwright/test"
import { deriveKey, encrypt } from "../src/lib/crypto"
import { e2eSql } from "./db"
import { E2E_OWNER } from "./fixtures"

const GiB = 1024 ** 3
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
    await expect(pathwaysPage.locator("[data-route-controls]")).toBeVisible({ timeout: 15_000 })
    await expect(pathwaysPage.locator("[data-route-choice]").first()).toBeVisible()
    await expect(pathwaysPage.locator('[data-route-choice][data-fastest="true"]')).toBeVisible()
    await expect(pathwaysPage.getByText("Best path")).toHaveCount(0)
    await expect(pathwaysPage.locator('[data-target-profile="Aither"]')).toBeVisible()
    await expect(pathwaysPage.locator("[data-invited-from]")).toBeVisible()
    await expect(pathwaysPage.locator("[data-can-invite-to]")).toBeVisible()
    await expect(pathwaysPage.getByText("Invite class", { exact: true })).toBeVisible()
    await expect(pathwaysPage.getByText(/Checked /)).toBeVisible()
    await expect(pathwaysPage.getByText("Structured requirements")).toHaveCount(0)
    await expect(pathwaysPage.getByText(/Availability:/)).toHaveCount(0)

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

    await pathwaysPage.locator("[data-route-controls]").scrollIntoViewIfNeeded()
    await page.waitForTimeout(150)
    await page.screenshot({ path: "test-results/visual-pathways-routes-dark.png" })
    await page.evaluate(() => {
      document.documentElement.dataset.theme = "light"
    })
    await page.waitForTimeout(150)
    await page.screenshot({ path: "test-results/visual-pathways-routes-light.png" })

    await pathwaysPage.locator('[data-target-profile="Aither"]').scrollIntoViewIfNeeded()
    await page.waitForTimeout(150)
    await page.screenshot({ path: "test-results/visual-pathways-profile-light.png" })
    await page.evaluate(() => {
      document.documentElement.dataset.theme = "dark"
    })
    await page.waitForTimeout(150)
    await page.screenshot({ path: "test-results/visual-pathways-profile-dark.png" })

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

    await pathwaysPage.locator("[data-route-controls]").scrollIntoViewIfNeeded()
    await page.waitForTimeout(150)
    await page.screenshot({ path: "test-results/visual-pathways-mobile-routes.png" })
    await page.evaluate(() => {
      document.documentElement.dataset.theme = "dark"
    })
    await page.waitForTimeout(150)
    await page.screenshot({ path: "test-results/visual-pathways-mobile-routes-dark.png" })

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
      await expect(page.locator("#main-content [data-route-controls]")).toBeVisible()
      await expect(page.locator("#main-content [data-route-choice]").first()).toBeVisible()
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

  test("gives the pathways picker a row width and shows route choices", async ({ page }) => {
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

      const controls = page.locator("[data-route-controls]").first()
      const route = page.locator("[data-route-choice]").first()
      await expect(controls).toBeVisible()
      await expect(route).toBeVisible()
      const controlsBox = await controls.boundingBox()
      const routeBox = await route.boundingBox()
      expect(controlsBox).not.toBeNull()
      expect(routeBox).not.toBeNull()
      if (width === 390 && controlsBox && routeBox) {
        expect(Math.abs(controlsBox.x - routeBox.x)).toBeLessThanOrEqual(2)
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
    const ladder = page.locator("[data-rank-progression]").first()
    await expect(ladder).toBeVisible({ timeout: 15_000 })
    const widths = await ladder.evaluate((node) => ({
      scrollWidth: node.scrollWidth,
      clientWidth: node.clientWidth,
    }))
    expect(widths.scrollWidth).toBeLessThanOrEqual(widths.clientWidth + 1)
    for (const rung of ["Registered", "Power User", "Super User", "Extreme User", "TL GOD"]) {
      await expect(ladder.getByText(rung, { exact: true })).toBeVisible()
    }
    await expect(ladder.getByText("VIP", { exact: true })).toHaveCount(0)
    await ladder.getByRole("button", { name: "Show all classes" }).click()
    await expect(ladder.getByText("VIP", { exact: true })).toBeVisible()
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

test.describe.serial("P39 rank and pause card states", () => {
  let topId: number | null = null
  let reachedId: number | null = null
  let pausedId: number | null = null
  let previousRankGoals: string | null = null

  test.beforeAll(async () => {
    const sql = e2eSql()
    try {
      const [settings] = await sql<{ encryption_salt: string; rank_goals: string | null }[]>`
        select encryption_salt, rank_goals from app_settings limit 1
      `
      previousRankGoals = settings.rank_goals
      const key = await deriveKey(E2E_OWNER.password, settings.encryption_salt)
      const token = encrypt("synthetic-p39-token", key)

      const insertTracker = async (name: string, suffix: string) => {
        const [row] = await sql<{ id: number }[]>`
          insert into trackers (
            name, base_url, registry_slug, platform_type, is_active, joined_at,
            last_polled_at, encrypted_api_token, color, created_at, updated_at
          ) values (
            ${name}, ${`https://tt-p39-${suffix}.invalid`}, 'torrentleech', 'unit3d',
            true, '2024-01-01T00:00:00.000Z', now(), ${token}, '#6d56eb', now(), now()
          ) returning id
        `
        return row.id
      }

      const insertSnapshot = async (trackerId: number, group: string) => {
        await sql`
          insert into tracker_snapshots (
            tracker_id, polled_at, uploaded_bytes, downloaded_bytes, ratio, group_name,
            buffer_bytes, seeding_count, leeching_count, seedbonus, hit_and_runs,
            required_ratio, warned, freeleech_tokens, is_manual
          ) values (
            ${trackerId}, now(), ${2 * GiB}, ${GiB}, 2.0, ${group},
            ${GiB}, 8, 1, 1234, 0, 1, false, 0, false
          )
        `
      }

      topId = await insertTracker("TEST P39 Top", "top")
      reachedId = await insertTracker("TEST P39 Reached", "reached")
      pausedId = await insertTracker("TEST P39 Paused", "paused")
      await insertSnapshot(topId, "TL GOD")
      await insertSnapshot(reachedId, "Super User")
      await insertSnapshot(pausedId, "Power User")

      const failedAt = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      await sql`
        update trackers
        set paused_at = ${failedAt},
            consecutive_failures = 5,
            last_error = 'Request timed out',
            last_error_at = ${failedAt}
        where id = ${pausedId}
      `
      await sql`
        update app_settings
        set rank_goals = ${JSON.stringify({ [reachedId]: { targetRank: "Power User" } })}
      `
    } finally {
      await sql.end()
    }
  })

  test.afterAll(async () => {
    const ids = [topId, reachedId, pausedId].filter((id): id is number => id !== null)
    if (ids.length === 0) return
    const sql = e2eSql()
    try {
      for (const id of ids) await sql`delete from trackers where id = ${id}`
      await sql`update app_settings set rank_goals = ${previousRankGoals}`
    } finally {
      await sql.end()
    }
  })

  test("captures top-of-ladder, target-reached and failed-poll cards", async ({ page }) => {
    test.setTimeout(120_000)
    expect(topId).not.toBeNull()
    expect(reachedId).not.toBeNull()
    expect(pausedId).not.toBeNull()

    const cards = [
      ["top", topId as number],
      ["reached", reachedId as number],
      ["paused", pausedId as number],
    ] as const
    const cardFor = (id: number) =>
      page.locator(`[data-tracker-card="${id}"]`).filter({ visible: true }).first()

    for (const width of [1440, 390]) {
      for (const theme of ["light", "dark"] as const) {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 })
        await page.goto("/")
        await expect(page.locator("[data-tracker-card]").first()).toBeVisible({ timeout: 15_000 })
        await page.evaluate((nextTheme) => {
          document.documentElement.dataset.theme = nextTheme
          const backToTop = document.querySelector('[aria-label="Back to top"]') as HTMLElement | null
          if (backToTop) backToTop.style.visibility = "hidden"
        }, theme)
        for (const [name, id] of cards) {
          const card = cardFor(id)
          await card.scrollIntoViewIfNeeded()
          await page.waitForTimeout(150)
          const box = await card.boundingBox()
          if (!box) throw new Error(`no box for ${name} card`)
          const viewport = page.viewportSize()
          if (!viewport) throw new Error("no viewport")
          const x = Math.max(0, box.x - 12)
          const y = Math.max(0, box.y - 12)
          await page.screenshot({
            path: `test-results/p39-${name}-${width}-${theme}.png`,
            clip: {
              x,
              y,
              width: Math.min(viewport.width - x, box.width + 24),
              height: Math.min(viewport.height - y, box.height + 24),
            },
          })
        }
      }
    }

    const top = cardFor(topId as number)
    await expect(top).toContainText("Highest automatic class reached")

    const reached = cardFor(reachedId as number)
    await expect(reached).toContainText("Target reached: Power User")
    await expect(reached).toContainText("Extreme User")
    await expect(reached).toContainText("Automatic")

    const paused = cardFor(pausedId as number)
    const pauseBlock = paused.locator("[data-failed-poll-pause]")
    await expect(pauseBlock).toContainText("Paused after 5 failed polls")
    await expect(pauseBlock).toContainText(/next retry \d{2}:\d{2}/)
    await expect(pauseBlock).toContainText("Timeout")
  })
})

test.describe.serial("P40 pathway route choices", () => {
  let trackerId: number | null = null
  let previousState: string | null = null

  test.beforeAll(async () => {
    const sql = e2eSql()
    try {
      const [settings] = await sql<
        { encryption_salt: string; recruitment_state: string | null }[]
      >`
        select encryption_salt, recruitment_state from app_settings limit 1
      `
      previousState = settings.recruitment_state
      const key = await deriveKey(E2E_OWNER.password, settings.encryption_salt)
      const [tracker] = await sql<{ id: number }[]>`
        insert into trackers (
          name, base_url, registry_slug, platform_type, is_active, joined_at,
          last_polled_at, encrypted_api_token, created_at, updated_at
        ) values (
          'TEST P40 Routes', 'https://tt-p40.invalid', 'alpharatio', 'unit3d', true,
          '2025-01-01T00:00:00.000Z', now(), ${encrypt("synthetic-p40-token", key)},
          now(), now()
        ) returning id
      `
      trackerId = tracker.id
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
      await sql`
        update app_settings
        set recruitment_state = ${JSON.stringify({
          version: 2,
          desiredTrackerSlug: "Aither",
          hiddenPathKeys: [],
          goalLinks: [],
          pinnedRoutes: {},
        })}
      `
    } finally {
      await sql.end()
    }
  })

  test.afterAll(async () => {
    const sql = e2eSql()
    try {
      if (trackerId !== null) await sql`delete from trackers where id = ${trackerId}`
      await sql`update app_settings set recruitment_state = ${previousState}`
    } finally {
      await sql.end()
    }
  })

  test("sorts, filters, pins and restores the chosen route", async ({ page }) => {
    test.setTimeout(120_000)
    expect(trackerId).not.toBeNull()
    await page.goto("/pathways")
    const pathwaysPage = page.locator("#main-content [data-pathways-page]")
    await expect(pathwaysPage.locator("[data-route-controls]")).toBeVisible({ timeout: 15_000 })
    const rows = pathwaysPage.locator("[data-route-choice]")
    await expect(rows.first()).toBeVisible()
    const routeCount = await rows.count()
    expect(routeCount).toBeGreaterThan(3)

    await pathwaysPage.getByRole("button", { name: "Fewest hops" }).click()
    await expect(rows.first()).toContainText("1 hop")

    await pathwaysPage.getByRole("button", { name: "Fastest" }).click()
    await expect(
      pathwaysPage.locator('[data-route-choice][data-fastest="true"]')
    ).toHaveCount(1)

    await pathwaysPage.getByRole("button", { name: "1" }).click()
    await expect(rows).toHaveCount(1)
    await pathwaysPage.getByRole("button", { name: "3" }).click()
    await expect(rows).toHaveCount(routeCount)

    await pathwaysPage.getByRole("button", { name: "Start from" }).click()
    await pathwaysPage.getByRole("option", { name: "AlphaRatio" }).click()
    await expect(rows).toHaveCount(routeCount)

    const pinRow = pathwaysPage.locator('[data-route-choice][data-fastest="false"]').first()
    await expect(pinRow).toBeVisible()
    const pinText = (await pinRow.textContent()) ?? ""
    const pinnedHops = pinText.match(/(\d+) hops?/)?.[1] ?? ""
    const pinnedWait = pinText.match(/(Ready now|\d+ days? left)/)?.[1] ?? ""
    await pinRow.getByRole("button", { name: "Pin" }).click()
    await expect(rows.first()).toHaveAttribute("data-pinned", "true")
    await expect(rows.nth(1)).toHaveAttribute("data-fastest", "true")

    await pathwaysPage.getByRole("button", { name: "Choose a tracker" }).click()
    await pathwaysPage.getByRole("combobox", { name: "Search trackerpathways" }).fill("Anthelion")
    await pathwaysPage.getByRole("option", { name: "Anthelion" }).click()
    const aitherChip = pathwaysPage.getByRole("button", { name: /Aither · .* hops ·/ })
    await expect(aitherChip).toBeVisible()
    await expect(aitherChip).toContainText(`${pinnedHops} hop`)
    if (pinnedWait) await expect(aitherChip).toContainText(pinnedWait)

    await aitherChip.click()
    await page.reload()
    await expect(rows.first()).toHaveAttribute("data-pinned", "true")

    await page.evaluate(() => {
      const backToTop = document.querySelector('[aria-label="Back to top"]') as HTMLElement | null
      if (backToTop) backToTop.style.visibility = "hidden"
    })
    await page.setViewportSize({ width: 1440, height: 1400 })
    await pathwaysPage.locator("[data-route-controls]").scrollIntoViewIfNeeded()
    await page.evaluate(() => {
      document.documentElement.dataset.theme = "light"
    })
    await page.waitForTimeout(200)
    await page.screenshot({ path: "test-results/p40-routes-1440-light.png" })
    await page.evaluate(() => {
      document.documentElement.dataset.theme = "dark"
    })
    await page.screenshot({ path: "test-results/p40-routes-1440-dark.png" })

    await page.setViewportSize({ width: 390, height: 1200 })
    await page.waitForFunction(() => document.querySelector('[data-mobile="true"]') !== null)
    await pathwaysPage.locator("[data-route-controls]").scrollIntoViewIfNeeded()
    await page.evaluate(() => {
      document.documentElement.dataset.theme = "light"
    })
    await page.waitForTimeout(200)
    await page.screenshot({ path: "test-results/p40-routes-390-light.png" })
    await page.evaluate(() => {
      document.documentElement.dataset.theme = "dark"
    })
    await page.screenshot({ path: "test-results/p40-routes-390-dark.png" })
  })
})

test.describe.serial("P41 rank overview", () => {
  let torrentLeechId: number | null = null
  let dreadVaultId: number | null = null
  let aitherId: number | null = null
  let previousRankGoals: string | null = null
  let previousRecruitmentState: string | null = null

  test.beforeAll(async () => {
    const sql = e2eSql()
    try {
      const [settings] = await sql<
        {
          encryption_salt: string
          rank_goals: string | null
          recruitment_state: string | null
        }[]
      >`
        select encryption_salt, rank_goals, recruitment_state
        from app_settings limit 1
      `
      previousRankGoals = settings.rank_goals
      previousRecruitmentState = settings.recruitment_state
      const key = await deriveKey(E2E_OWNER.password, settings.encryption_salt)
      const token = encrypt("synthetic-p41-token", key)

      const insertTracker = async (
        name: string,
        slug: string,
        suffix: string,
        group: string
      ) => {
        const [row] = await sql<{ id: number }[]>`
          insert into trackers (
            name, base_url, registry_slug, platform_type, is_active, joined_at,
            last_polled_at, encrypted_api_token, color, created_at, updated_at
          ) values (
            ${name}, ${`https://tt-p41-${suffix}.invalid`}, ${slug}, 'unit3d', true,
            '2026-01-01T00:00:00.000Z', now(), ${token}, '#6d56eb', now(), now()
          ) returning id
        `
        await sql`
          insert into tracker_snapshots (
            tracker_id, polled_at, uploaded_bytes, downloaded_bytes, ratio, group_name,
            buffer_bytes, seeding_count, leeching_count, seedbonus, hit_and_runs,
            required_ratio, warned, freeleech_tokens, is_manual
          ) values (
            ${row.id}, now(), ${2 * 1024 * GiB}, ${1024 * GiB}, 2.4, ${group},
            ${1024 * GiB}, 8, 1, 1234, 0, 1, false, 0, false
          )
        `
        return row.id
      }

      torrentLeechId = await insertTracker(
        "TEST P41 TorrentLeech",
        "torrentleech",
        "tl",
        "Power User"
      )
      dreadVaultId = await insertTracker("TEST P41 DreadVault", "dreadvault", "dv", "User")
      aitherId = await insertTracker("TEST P41 Aither", "aither", "aither", "Phobos")

      await sql`
        update app_settings
        set rank_goals = ${JSON.stringify({
          [String(torrentLeechId)]: { targetRank: "Super User" },
          [String(dreadVaultId)]: { targetRank: "Ancient One" },
        })},
        recruitment_state = ${JSON.stringify({
          version: 2,
          desiredTrackerSlug: "Aither",
          hiddenPathKeys: [],
          goalLinks: [],
          pinnedRoutes: {},
          rankChecks: {
            [String(torrentLeechId)]: {
              verdict: "matches",
              note: "Same thresholds as the wiki",
              checkedAt: "2026-10-30",
            },
            [String(dreadVaultId)]: {
              verdict: "wrong",
              note: "Site says 500 uploads",
              checkedAt: "2026-10-29",
            },
          },
        })}
      `
    } finally {
      await sql.end()
    }
  })

  test.afterAll(async () => {
    const sql = e2eSql()
    try {
      for (const id of [torrentLeechId, dreadVaultId, aitherId]) {
        if (id !== null) await sql`delete from trackers where id = ${id}`
      }
      await sql`
        update app_settings
        set rank_goals = ${previousRankGoals},
            recruitment_state = ${previousRecruitmentState}
      `
    } finally {
      await sql.end()
    }
  })

  test("captures the rank overview with checks, sources and class filtering", async ({ page }) => {
    test.setTimeout(120_000)
    expect(torrentLeechId).not.toBeNull()
    expect(dreadVaultId).not.toBeNull()
    const tlId = torrentLeechId as number
    const dvId = dreadVaultId as number

    await page.setViewportSize({ width: 1440, height: 1400 })
    await page.goto("/")
    await page.getByRole("button", { name: "Ranks" }).click()
    const view = page.locator("#main-content [data-rank-overview]")
    await expect(view).toBeVisible({ timeout: 15_000 })

    const summary = view.locator("[data-rank-check-summary]")
    await expect(summary).toContainText("Checked 2")
    await expect(summary).toContainText("Wrong 1")
    await expect(summary).toContainText("Not checked 1")

    const tl = view.locator(`[data-rank-overview-tracker="${tlId}"]`)
    await expect(tl).toContainText("Target: Super User")
    await expect(tl.locator("[data-rank-condition]")).toHaveCount(3)
    await expect(tl).toContainText("Published source")
    await expect(tl.getByLabel("Note for TEST P41 TorrentLeech")).toHaveValue(
      "Same thresholds as the wiki"
    )
    await expect(tl.getByRole("link", { name: "Open TEST P41 TorrentLeech site" })).toHaveAttribute(
      "href",
      "https://www.torrentleech.org"
    )

    await expect(tl.getByText("VIP")).toHaveCount(0)
    await tl.getByRole("button", { name: "Show all classes" }).click()
    await expect(tl.getByText("VIP")).toBeVisible()
    await tl.getByRole("button", { name: "Show earned classes" }).click()

    const dv = view.locator(`[data-rank-overview-tracker="${dvId}"]`)
    await expect(
      dv
        .getByText(
          /TEST P41 DreadVault's API doesn't report (average seed time|seed size|uploaded torrents)\./
        )
        .first()
    ).toBeVisible()
    await expect(dv.getByLabel("Note for TEST P41 DreadVault")).toHaveValue(
      "Site says 500 uploads"
    )

    for (const theme of ["light", "dark"] as const) {
      await page.evaluate((nextTheme) => {
        document.documentElement.dataset.theme = nextTheme
      }, theme)
      await page.waitForTimeout(150)
      await page.screenshot({ path: `test-results/p41-ranks-1440-${theme}.png` })
    }

    await page.setViewportSize({ width: 390, height: 1200 })
    await page.waitForFunction(() => document.querySelector("[data-mobile=\"true\"]") !== null)
    await page.evaluate(() => {
      document.querySelector<HTMLElement>("#main-content")?.scrollTo(0, 0)
      document.querySelector("[data-rank-overview]")?.scrollIntoView({ block: "start" })
    })
    const overflow = await page.evaluate(() => ({
      html: document.documentElement.scrollWidth > window.innerWidth,
      main: (() => {
        const main = document.querySelector<HTMLElement>("#main-content")
        return main ? main.scrollWidth > main.clientWidth : false
      })(),
    }))
    expect(overflow.html, "page overflows horizontally at 390px").toBe(false)
    expect(overflow.main, "main overflows horizontally at 390px").toBe(false)

    for (const theme of ["light", "dark"] as const) {
      await page.evaluate((nextTheme) => {
        document.documentElement.dataset.theme = nextTheme
      }, theme)
      await page.waitForTimeout(150)
      await page.screenshot({ path: `test-results/p41-ranks-390-${theme}.png` })
    }
  })
})

test.describe.serial("P42 dashboard card visual evidence", () => {
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
          name: "TEST P42 Manual Login",
          slug: "myanonamouse",
          platform: "mam",
          group: "User",
          target: "Power User",
          lastAccessAt: new Date(Date.now() - 115 * 24 * 60 * 60 * 1000),
          lastAccessSource: "manual",
        },
        {
          name: "TEST P42 Detected Login",
          slug: "aither",
          platform: "unit3d",
          group: "Zeus",
          target: "Helios",
          lastAccessAt: new Date(),
          lastAccessSource: "detected",
        },
      ]
      for (const row of rows) {
        const [tracker] = await sql<{ id: number }[]>`
          insert into trackers (
            name, base_url, registry_slug, platform_type, is_active, joined_at,
            last_access_at, last_access_source, last_polled_at, encrypted_api_token, created_at, updated_at
          ) values (
            ${row.name}, ${`https://${row.slug}.invalid`}, ${row.slug}, ${row.platform}, true,
            '2021-08-01', ${row.lastAccessAt}, ${row.lastAccessSource}, now(), ${encrypt("synthetic-p42-token", key)},
            now(), now()
          ) returning id
        `
        ids.push(tracker.id)
        await sql`
          insert into tracker_snapshots (
            tracker_id, polled_at, uploaded_bytes, downloaded_bytes, ratio, group_name,
            buffer_bytes, seeding_count, leeching_count, seedbonus, hit_and_runs,
            required_ratio, warned, freeleech_tokens, is_manual
          ) values (
            ${tracker.id}, now(), ${2 * 1024 ** 4}, ${1.5 * 1024 ** 4}, 1.5, ${row.group},
            ${0.5 * 1024 ** 4}, 8, 1, 1234, 0, 1, false, 0, false
          )
        `
      }
      const goals = Object.fromEntries(
        rows.map((row, index) => [String(ids[index]), { targetRank: row.target }])
      )
      await sql`update app_settings set rank_goals = ${JSON.stringify(goals)}`
    } finally {
      await sql.end()
    }
  })

  test.afterAll(async () => {
    const sql = e2eSql()
    try {
      await sql`update app_settings set rank_goals = null`
      for (const id of ids) await sql`delete from trackers where id = ${id}`
    } finally {
      await sql.end()
    }
  })

  async function capture(page: import("@playwright/test").Page, width: number, height: number) {
    await page.setViewportSize({ width, height })
    await page.goto("/")
    await page.getByRole("button", { name: "Grid" }).click()
    const grid = page.locator("#main-content [data-tracker-grid]")
    await expect(grid).toBeVisible({ timeout: 15_000 })
    await expect(grid.getByText("TEST P42 Manual Login")).toBeVisible()
    await expect(grid.getByLabel(/Login due in 5 days/)).toBeVisible()
    await expect(grid.locator('[data-login-ring][data-login-tone="warn"]')).toHaveCount(1)
    await expect(grid.getByRole("button", { name: "Marked by you" })).toBeVisible()
    await expect(grid.getByRole("button", { name: "Detected from the tracker" })).toBeVisible()
    await expect(grid.getByText("2 of 3 met")).toBeVisible()
    const dueButton = grid.getByRole("button", { name: "Logged in today" })
    await expect(dueButton).toHaveAttribute("data-login-due", "true")
    await expect(grid.getByRole("button", { name: "Logged in today" })).toHaveCount(1)

    for (const theme of ["light", "dark"] as const) {
      await page.evaluate((nextTheme) => {
        document.documentElement.dataset.theme = nextTheme
      }, theme)
      await page.waitForTimeout(150)
      await grid.screenshot({
        path: `test-results/p42-dashboard-cards-${width}-${theme}.png`,
      })
    }

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

  test("captures the card grid light and dark at 1440px and 390px", async ({ page }) => {
    test.setTimeout(90_000)
    await capture(page, 1440, 1000)
    await capture(page, 390, 1200)
  })
})

test.describe.serial("P48 login deadline visual evidence", () => {
  interface P48Fixture {
    id: number
    name: string
    lastAccessSource: "manual" | "detected"
  }

  const fixtures: P48Fixture[] = []

  test.beforeAll(async () => {
    const sql = e2eSql()
    try {
      const [settings] = await sql<{ encryption_salt: string }[]>`
        select encryption_salt from app_settings limit 1
      `
      const key = await deriveKey(E2E_OWNER.password, settings.encryption_salt)
      const day = 24 * 60 * 60 * 1000
      const rows = [
        {
          name: "TEST P48 Overdue",
          slug: "myanonamouse",
          platform: "mam",
          group: "User",
          target: "Power User",
          lastAccessAt: new Date(Date.now() - 125 * day),
          lastAccessSource: "manual" as const,
        },
        {
          name: "TEST P48 Due Soon",
          slug: "myanonamouse",
          platform: "mam",
          group: "User",
          target: "Power User",
          lastAccessAt: new Date(Date.now() - 115 * day),
          lastAccessSource: "manual" as const,
        },
        {
          name: "TEST P48 No Rule",
          slug: "torrentleech",
          platform: "torrentleech",
          group: "Power User",
          target: "Power User",
          lastAccessAt: new Date(Date.now() - 10 * day),
          lastAccessSource: "manual" as const,
        },
        {
          name: "TEST P48 Detected",
          slug: "aither",
          platform: "unit3d",
          group: "Zeus",
          target: "Helios",
          lastAccessAt: new Date(Date.now() - 2 * day),
          lastAccessSource: "detected" as const,
        },
      ]

      for (const row of rows) {
        const [tracker] = await sql<{ id: number }[]>`
          insert into trackers (
            name, base_url, registry_slug, platform_type, is_active, joined_at,
            last_access_at, last_access_source, last_polled_at, encrypted_api_token, created_at, updated_at
          ) values (
            ${row.name}, ${`https://p48-${row.slug}.invalid`}, ${row.slug}, ${row.platform}, true,
            '2021-08-01', ${row.lastAccessAt}, ${row.lastAccessSource}, now(),
            ${encrypt("synthetic-p48-token", key)}, now(), now()
          ) returning id
        `
        fixtures.push({
          id: tracker.id,
          name: row.name,
          lastAccessSource: row.lastAccessSource,
        })
        await sql`
          insert into tracker_snapshots (
            tracker_id, polled_at, uploaded_bytes, downloaded_bytes, ratio, group_name,
            buffer_bytes, seeding_count, leeching_count, seedbonus, hit_and_runs,
            required_ratio, warned, freeleech_tokens, is_manual
          ) values (
            ${tracker.id}, now(), ${2 * 1024 ** 4}, ${1.5 * 1024 ** 4}, 1.33, ${row.group},
            ${0.5 * 1024 ** 4}, 8, 1, 1234, 0, 1, false, 0, false
          )
        `
      }

      const goals = Object.fromEntries(fixtures.map((fixture) => [String(fixture.id), { targetRank: rows.find((row) => row.name === fixture.name)?.target }]))
      await sql`update app_settings set rank_goals = ${JSON.stringify(goals)}`
    } finally {
      await sql.end()
    }
    await mkdir("docs/screenshots/p48", { recursive: true })
  })

  test.afterAll(async () => {
    const sql = e2eSql()
    try {
      await sql`update app_settings set rank_goals = null`
      for (const fixture of fixtures) {
        await sql`delete from trackers where id = ${fixture.id}`
      }
    } finally {
      await sql.end()
    }
  })

  async function capture(page: import("@playwright/test").Page, width: number, height: number) {
    await page.setViewportSize({ width, height })
    await page.goto("/")
    await page.getByRole("button", { name: "Grid" }).click()
    const grid = page.locator("#main-content [data-tracker-grid]")
    await expect(grid).toBeVisible({ timeout: 15_000 })
    await expect(grid.getByText("TEST P48 Overdue")).toBeVisible()

    const overdue = grid.getByLabel(/Login overdue by 5 days/)
    await expect(overdue).toBeVisible()
    await expect(overdue).toContainText("!")
    await expect(grid.getByText("overdue by 5 days")).toBeVisible()
    await expect(grid.locator('[data-login-ring][data-login-tone="crit"]')).toHaveCount(1)

    await expect(grid.getByLabel(/Login due in 5 days/)).toBeVisible()
    await expect(grid.locator('[data-login-ring][data-login-tone="warn"]')).toHaveCount(1)

    await expect(grid.getByText("No login rule")).toBeVisible()
    await expect(grid.getByRole("button", { name: "Detected from the tracker" })).toBeVisible()
    await expect(grid.getByRole("button", { name: "Marked by you" })).toHaveCount(2)
    await expect(grid.getByRole("button", { name: "Logged in today" })).toHaveCount(3)

    const detected = fixtures.find((fixture) => fixture.lastAccessSource === "detected")
    if (!detected) throw new Error("missing detected fixture")
    await expect(
      grid.locator(`[data-tracker-card="${detected.id}"]`).getByRole("button", {
        name: "Logged in today",
      })
    ).toHaveCount(0)

    for (const theme of ["light", "dark"] as const) {
      await page.evaluate((nextTheme) => {
        document.documentElement.dataset.theme = nextTheme
      }, theme)
      await page.waitForTimeout(150)
      await grid.screenshot({
        path: `docs/screenshots/p48/login-deadline-${width}-${theme}.png`,
      })
    }

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

  test("captures the login deadline grid light and dark at 1440px and 390px", async ({ page }) => {
    test.setTimeout(120_000)
    await capture(page, 1440, 2000)
    await capture(page, 390, 5200)
  })
})