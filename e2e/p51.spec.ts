// e2e/p51.spec.ts
//
// P51 visual evidence. Synthetic trackers, snapshots and a download client live
// only in the guarded tracker_tracker_e2e database and are removed afterwards.
import { mkdir } from "node:fs/promises"
import { expect, test } from "@playwright/test"
import { deriveKey, encrypt } from "../src/lib/crypto"
import { e2eSql } from "./db"
import { E2E_OWNER } from "./fixtures"

const GIB = 1024 ** 3
const TIB = 1024 ** 4

function localDateStr(value = new Date()): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(
    value.getDate()
  ).padStart(2, "0")}`
}

interface SeededTracker {
  id: number
  name: string
  slug: string
}

const seeded: SeededTracker[] = []
let clientId: number | null = null

test.describe.configure({ mode: "serial" })

test.describe("P51 data accuracy", () => {
  test.beforeAll(async () => {
    const sql = e2eSql()
    try {
      const [settings] = await sql<{ encryption_salt: string }[]>`
        select encryption_salt from app_settings limit 1
      `
      const key = await deriveKey(E2E_OWNER.password, settings.encryption_salt)

      const definitions = [
        {
          name: "P51 seedpool",
          slug: "seedpool",
          joinedAt: "2026-08-01",
          qbtTag: "p51seedpool",
          color: "#22c55e",
          bonusStart: 500,
          bonusEnd: 1700,
        },
        {
          name: "P51 TorrentLeech",
          slug: "torrentleech",
          joinedAt: "2026-09-01",
          qbtTag: "p51torrentleech",
          color: "#3b82f6",
          bonusStart: 50,
          bonusEnd: 90,
        },
      ]

      for (const definition of definitions) {
        const [tracker] = await sql<{ id: number }[]>`
          insert into trackers (
            name, base_url, registry_slug, platform_type, is_active, joined_at,
            last_polled_at, encrypted_api_token, qbt_tag, color, created_at, updated_at
          ) values (
            ${definition.name}, ${`https://${definition.slug}.invalid`},
            ${definition.slug}, 'unit3d', true, ${definition.joinedAt}::date,
            now(), ${encrypt("synthetic-p51-token", key)}, ${definition.qbtTag},
            ${definition.color}, now(), now()
          ) returning id
        `
        seeded.push({ id: tracker.id, name: definition.name, slug: definition.slug })

        const start = new Date(Date.now() - 2 * 60 * 60 * 1000)
        const end = new Date()
        for (const [polledAt, bonus, uploadOffset] of [
          [start, definition.bonusStart, 0],
          [end, definition.bonusEnd, definition.slug === "seedpool" ? 512 : 1],
        ] as const) {
          await sql`
            insert into tracker_snapshots (
              tracker_id, polled_at, uploaded_bytes, downloaded_bytes, ratio,
              buffer_bytes, seeding_count, leeching_count, seedbonus, hit_and_runs,
              required_ratio, warned, freeleech_tokens, group_name, is_manual
            ) values (
              ${tracker.id}, ${polledAt}, ${10 * TIB + uploadOffset * GIB},
              ${4 * TIB}, 2.5, ${6 * TIB}, 50, 0, ${bonus}, 0,
              1, false, 0, 'Power User', false
            )
          `
        }
      }

      const [client] = await sql<{ id: number }[]>`
        insert into download_clients (
          name, type, enabled, host, port, use_ssl, auth_method,
          encrypted_username, encrypted_password, encrypted_api_key,
          encrypted_url_path, is_default, cached_torrents, cached_torrents_at,
          created_at, updated_at
        ) values (
          'qBittorrent', 'qbittorrent', true, '127.0.0.1', 8080, false, 'password',
          ${encrypt("e2e", key)}, ${encrypt("e2e", key)}, '', '',
          true, ${JSON.stringify([
            {
              hash: "p51-upl",
              name: "P51 Seeding Movie",
              tags: "p51seedpool",
              category: "",
              state: "uploading",
              size: 4 * TIB,
              uploaded: 20 * TIB,
              downloaded: 4 * TIB,
              ratio: 5,
              uploadSpeed: 0,
              downloadSpeed: 0,
              seedCount: 4,
              leechCount: 0,
              swarmSeeders: 4,
              swarmLeechers: 0,
              addedAt: 0,
              completedAt: -1,
              lastActivityAt: 0,
              seedingTime: 0,
              activeTime: 0,
              availability: 1,
              remaining: 0,
              progress: 1,
            },
            {
              hash: "p51-dl",
              name: "P51 Downloading Show",
              tags: "p51torrentleech",
              category: "",
              state: "downloading",
              size: 8 * TIB,
              uploaded: 2 * TIB,
              downloaded: 6 * TIB,
              ratio: 0.3,
              uploadSpeed: 0,
              downloadSpeed: 0,
              seedCount: 0,
              leechCount: 3,
              swarmSeeders: 10,
              swarmLeechers: 3,
              addedAt: 0,
              completedAt: -1,
              lastActivityAt: 0,
              seedingTime: 0,
              activeTime: 0,
              availability: 1,
              remaining: 2 * TIB,
              progress: 0.75,
            },
            {
              hash: "p51-zero",
              name: "P51 Idle Torrent",
              tags: "p51seedpool",
              category: "",
              state: "uploading",
              size: TIB,
              uploaded: 5 * TIB,
              downloaded: TIB,
              ratio: 5,
              uploadSpeed: 0,
              downloadSpeed: 0,
              seedCount: 1,
              leechCount: 0,
              swarmSeeders: 1,
              swarmLeechers: 0,
              addedAt: 0,
              completedAt: -1,
              lastActivityAt: 0,
              seedingTime: 0,
              activeTime: 0,
              availability: 1,
              remaining: 0,
              progress: 1,
            },
          ])}, now(), now(), now()
        ) returning id
      `
      clientId = client.id

      const today = localDateStr()
      for (const [hash, uploadedStart, downloadedStart] of [
        ["p51-upl", 10 * TIB, 4 * TIB],
        ["p51-dl", 0, 4 * TIB],
        ["p51-zero", 5 * TIB, 1 * TIB],
      ] as const) {
        await sql`
          insert into torrent_daily_checkpoints (
            client_id, hash, name, checkpoint_date, uploaded_start, downloaded_start
          ) values (
            ${client.id}, ${hash}, ${hash}, ${today}::date, ${uploadedStart}, ${downloadedStart}
          )
        `
      }
    } finally {
      await sql.end()
    }
    await mkdir("docs/screenshots/p51", { recursive: true })
  })

  test.afterAll(async () => {
    const sql = e2eSql()
    try {
      for (const tracker of seeded) {
        await sql`delete from trackers where id = ${tracker.id}`
      }
      if (clientId !== null) await sql`delete from download_clients where id = ${clientId}`
    } finally {
      await sql.end()
    }
  })

  test("fleet activity labels its period and never sums a bonus currency", async ({ page }) => {
    test.setTimeout(120_000)
    expect(seeded).toHaveLength(2)

    for (const width of [1440, 390] as const) {
      await page.setViewportSize({ width, height: width === 1440 ? 1400 : 1000 })
      await page.goto("/")
      await page.waitForLoadState("networkidle")
      const toggle = page.getByRole("button", { name: "Fleet activity" })
      await expect(async () => {
        if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click()
        await expect(toggle).toHaveAttribute("aria-expanded", "true")
      }).toPass({ timeout: 20_000 })

      const card = page.locator("[data-today-at-a-glance]")
      await expect(card).toBeVisible({ timeout: 20_000 })
      await expect(card.locator("[data-fleet-period]")).toHaveText("Today, since 00:00")
      await expect(card.getByText("Bonus gained")).toHaveCount(0)
      await expect(card.getByText("Bonus change by tracker")).toHaveCount(0)
      await expect(card.locator("[data-bonus-change]")).toHaveCount(0)
      // The downloading torrent also uploads, so it appears in both lists.
      await expect(card.locator('[data-transfer-client="qBittorrent"]')).toHaveCount(3)
      await expect(card.getByText("P51 Idle Torrent")).toHaveCount(0)

      const box = await card.boundingBox()
      const visibleHeight = page.viewportSize()?.height ?? 0
      if (box && box.height + 120 > visibleHeight) {
        await page.setViewportSize({
          width,
          height: Math.min(6000, Math.ceil(box.height + 120)),
        })
        await page.waitForTimeout(250)
      }

      for (const theme of ["light", "dark"] as const) {
        await page.evaluate((next) => {
          document.documentElement.dataset.theme = next
        }, theme)
        await page.waitForTimeout(150)
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth
        )
        expect(overflow, `dashboard overflows at ${width}px`).toBeLessThanOrEqual(1)
        await card.screenshot({
          path: `docs/screenshots/p51/fleet-${width}-${theme}.png`,
        })
      }
    }
  })

  test("pathways uses joinedAt, lists missing ages and compares gate classes", async ({
    page,
  }) => {
    test.setTimeout(180_000)
    const sql = e2eSql()
    const temporary: number[] = []

    try {
      const [settings] = await sql<{ encryption_salt: string }[]>`
        select encryption_salt from app_settings limit 1
      `
      const key = await deriveKey(E2E_OWNER.password, settings.encryption_salt)

      const definitions = [
        {
          name: "P51 Redacted",
          slug: "redacted",
          joinedAt: "2026-01-15",
          group: "User",
          color: "#ef4444",
        },
        {
          name: "P51 Blutopia",
          slug: "blutopia",
          joinedAt: "2025-12-01",
          group: "BluSeeder",
          color: "#8b5cf6",
        },
        {
          name: "P51 No Join",
          slug: "zenith",
          joinedAt: null,
          group: "User",
          color: "#64748b",
        },
      ]

      for (const definition of definitions) {
        const [tracker] = await sql<{ id: number }[]>`
          insert into trackers (
            name, base_url, registry_slug, platform_type, is_active, joined_at,
            last_polled_at, encrypted_api_token, color, created_at, updated_at
          ) values (
            ${definition.name}, ${`https://${definition.slug}.invalid`},
            ${definition.slug}, 'unit3d', true, ${definition.joinedAt}::date,
            now(), ${encrypt("synthetic-p51-token", key)}, ${definition.color},
            now(), now()
          ) returning id
        `
        temporary.push(tracker.id)
        await sql`
          insert into tracker_snapshots (
            tracker_id, polled_at, uploaded_bytes, downloaded_bytes, ratio,
            buffer_bytes, seeding_count, leeching_count, seedbonus, hit_and_runs,
            required_ratio, warned, freeleech_tokens, group_name, is_manual
          ) values (
            ${tracker.id}, now(), ${10 * TIB}, ${4 * TIB}, 2.5, ${6 * TIB},
            10, 0, 100, 0, 1, false, 0, ${definition.group}, false
          )
        `
      }

      await page.setViewportSize({ width: 1440, height: 1400 })
      await page.goto("/pathways")
      await expect(page.getByRole("heading", { name: "Where your trackers can take you" })).toBeVisible(
        { timeout: 20_000 }
      )

      await expect(page.locator("[data-missing-account-age]")).toContainText("P51 No Join")
      await expect(page.locator('[data-class-gate="not-yet"]').first()).toBeVisible()
      await expect(page.locator('[data-class-gate="met"]').first()).toBeVisible()

      await page.getByRole("button", { name: "Choose a tracker" }).click()
      await page
        .getByRole("combobox", { name: "Search trackerpathways" })
        .fill("BitPorn")
      await page.getByRole("option", { name: "BitPorn" }).click()

      const seedpoolPath = page.locator('[data-route-choice*="seedpool"]').first()
      await expect(seedpoolPath).toBeVisible()
      await expect(seedpoolPath).toContainText(/days left/)

      for (const width of [1440, 390] as const) {
        await page.setViewportSize({ width, height: 1200 })
        await page.waitForTimeout(250)
        const contentHeight = await page
          .locator("#main-content")
          .evaluate((element) => element.scrollHeight)
        await page.setViewportSize({ width, height: Math.min(12000, contentHeight + 80) })
        await page.evaluate(() => {
          const main = document.querySelector("#main-content")
          if (main) main.scrollTop = 0
          window.scrollTo(0, 0)
        })
        await page.waitForTimeout(250)

        for (const theme of ["light", "dark"] as const) {
          await page.evaluate((next) => {
            document.documentElement.dataset.theme = next
          }, theme)
          await page.waitForTimeout(150)
          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth
          )
          expect(overflow, `pathways overflows at ${width}px`).toBeLessThanOrEqual(1)
          await page.screenshot({
            path: `docs/screenshots/p51/pathways-${width}-${theme}.png`,
            animations: "disabled",
          })
        }
      }
    } finally {
      for (const id of temporary) {
        await sql`delete from trackers where id = ${id}`
      }
      await sql.end()
    }
  })

  test("pins stay saved per target and are listed at the top", async ({ page }) => {
    test.setTimeout(180_000)
    await page.setViewportSize({ width: 1440, height: 1200 })
    await page.goto("/pathways")

    const current = (await (await page.request.get("/api/recruitment/wishlist")).json()) as {
      state: Record<string, unknown>
    }
    await page.request.put("/api/recruitment/wishlist", {
      data: {
        state: { ...current.state, desiredTrackerSlug: "BitPorn", pinnedRoutes: {} },
      },
    })
    await page.reload()

    await expect(page.getByRole("heading", { name: "My pinned routes" })).toBeVisible()
    await expect(page.locator("[data-route-choice]").first()).toBeVisible()

    await page.getByRole("button", { name: "Pin" }).first().click()
    await expect(page.locator("[data-pinned-route]")).toHaveCount(1)

    await page.getByRole("button", { name: "Choose a tracker" }).click()
    await page.getByRole("combobox", { name: "Search trackerpathways" }).fill("BrokenStones")
    await page.getByRole("option", { name: "BrokenStones" }).click()
    await expect(page.getByRole("heading", { name: "BrokenStones" })).toBeVisible()
    await expect(page.locator('[data-pinned-route="BitPorn"]')).toBeVisible()
    const brokenChoice = page.locator('[data-route-choice*="BrokenStones"]').first()
    await expect(brokenChoice).toBeVisible()
    await brokenChoice.getByRole("button", { name: "Pin" }).click()
    await expect(page.locator("[data-pinned-route]")).toHaveCount(2)

    for (const target of ["BitPorn", "BrokenStones"]) {
      const row = page.locator(`[data-pinned-route="${target}"]`)
      await expect(row).toBeVisible()
      await expect(row.locator("[data-pinned-route-summary]")).toContainText(/\d+ hops?/)
      await expect(row.locator("[data-pinned-route-summary]")).toContainText(
        /Ready now|days? left/
      )
    }

    // Reload proves both pins came back from the saved state, not React memory.
    await page.reload()
    await expect(page.locator("[data-pinned-route]")).toHaveCount(2)

    await page.getByRole("button", { name: "Open BitPorn" }).click()
    await expect(
      page.locator('[data-route-choice][data-pinned="true"]').first()
    ).toBeVisible()

    for (const width of [1440, 390] as const) {
      await page.setViewportSize({ width, height: 1200 })
      await page.waitForTimeout(250)
      const contentHeight = await page
        .locator("#main-content")
        .evaluate((element) => element.scrollHeight)
      await page.setViewportSize({ width, height: Math.min(12000, contentHeight + 80) })
      await page.evaluate(() => {
        const main = document.querySelector("#main-content")
        if (main) main.scrollTop = 0
        window.scrollTo(0, 0)
      })
      await page.waitForTimeout(250)

      for (const theme of ["light", "dark"] as const) {
        await page.evaluate((next) => {
          document.documentElement.dataset.theme = next
        }, theme)
        await page.waitForTimeout(150)
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth
        )
        expect(overflow, `pins overflow at ${width}px`).toBeLessThanOrEqual(1)
        await page.screenshot({
          path: `docs/screenshots/p51/pins-${width}-${theme}.png`,
          animations: "disabled",
        })
      }
    }
  })
})
