// e2e/p66.spec.ts
//
// P66 evidence. Synthetic rows live only in the guarded tracker_tracker_e2e
// database and are removed after the run.
import { mkdir } from "node:fs/promises"
import { expect, test } from "@playwright/test"
import { deriveKey, encrypt } from "../src/lib/crypto"
import { e2eSql } from "./db"
import { E2E_OWNER } from "./fixtures"

const TIB = 1024 ** 4
const GIB = 1024 ** 3
const DAY_MS = 24 * 60 * 60 * 1000

function dateOnly(daysAgo: number): string {
  const date = new Date(Date.now() - daysAgo * DAY_MS)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`
}

interface P66Fixture {
  id: number
  name: string
}

const fixtures: P66Fixture[] = []
let previousRankGoals: string | null = null
let previousDashboardSettings: string | null = null

test.describe.configure({ mode: "serial" })

test.describe("P66 what's next", () => {
  test.beforeAll(async () => {
    const sql = e2eSql()
    try {
      const [settings] = await sql<
        {
          encryption_salt: string
          rank_goals: string | null
          dashboard_settings: string | null
        }[]
      >`
        select encryption_salt, rank_goals, dashboard_settings
        from app_settings limit 1
      `
      previousRankGoals = settings.rank_goals
      previousDashboardSettings = settings.dashboard_settings
      const key = await deriveKey(E2E_OWNER.password, settings.encryption_salt)

      const rows = [
        {
          name: "P66 FileList VIP",
          slug: "filelist",
          platform: "filelist",
          joinedAt: dateOnly(100),
          lastAccessAt: new Date(Date.now() - 2 * DAY_MS),
          group: "VIP (Until: 2026-12-29)",
          ratio: 3,
          uploaded: 2 * TIB,
          downloaded: TIB,
          requiredRatio: 1,
          target: "Power User",
        },
        {
          name: "P66 LoginDue",
          slug: "blutopia",
          platform: "unit3d",
          joinedAt: null,
          lastAccessAt: new Date(Date.now() - 20 * DAY_MS),
          group: null,
          ratio: null,
          uploaded: 0,
          downloaded: 0,
          requiredRatio: null,
          target: null,
        },
        {
          name: "P66 RatioEdge",
          slug: "torrentleech",
          platform: "unit3d",
          joinedAt: dateOnly(200),
          lastAccessAt: new Date(Date.now() - 2 * DAY_MS),
          group: "Power User",
          ratio: 1.05,
          uploaded: 105 * GIB,
          downloaded: 100 * GIB,
          requiredRatio: 1,
          target: null,
        },
      ]

      const goals: Record<string, { targetRank: string }> = {}
      for (const row of rows) {
        const [tracker] = await sql<{ id: number }[]>`
          insert into trackers (
            name, base_url, registry_slug, platform_type, is_active, joined_at,
            last_polled_at, last_access_at, encrypted_api_token, color,
            created_at, updated_at
          ) values (
            ${row.name}, ${`https://p66-${row.slug}.invalid`}, ${row.slug},
            ${row.platform}, true, ${row.joinedAt}::date, now(),
            ${row.lastAccessAt}, ${encrypt("synthetic-p66-token", key)},
            '#64748b', now(), now()
          ) returning id
        `
        fixtures.push({ id: tracker.id, name: row.name })
        if (row.group) {
          await sql`
            insert into tracker_snapshots (
              tracker_id, polled_at, uploaded_bytes, downloaded_bytes, ratio,
              buffer_bytes, seeding_count, leeching_count, seedbonus, hit_and_runs,
              required_ratio, warned, freeleech_tokens, group_name, is_manual
            ) values (
              ${tracker.id}, now(), ${row.uploaded}, ${row.downloaded}, ${row.ratio},
              ${0}, 10, 0, 100, 0, ${row.requiredRatio}, false, 0, ${row.group}, false
            )
          `
        }
        if (row.target) goals[String(tracker.id)] = { targetRank: row.target }
      }

      await sql`update app_settings set rank_goals = ${JSON.stringify(goals)}`
      const dashboardSettings = previousDashboardSettings
        ? (JSON.parse(previousDashboardSettings) as Record<string, unknown>)
        : {}
      await sql`
        update app_settings
        set dashboard_settings = ${JSON.stringify({ ...dashboardSettings, showWhatsNext: true })}
      `
    } finally {
      await sql.end()
    }
    await mkdir("docs/screenshots/p66", { recursive: true })
  })

  test.afterAll(async () => {
    const sql = e2eSql()
    try {
      for (const fixture of fixtures) {
        await sql`delete from trackers where id = ${fixture.id}`
      }
      await sql`update app_settings set rank_goals = ${previousRankGoals}`
      await sql`
        update app_settings set dashboard_settings = ${previousDashboardSettings}
      `
    } finally {
      await sql.end()
    }
  })

  test("puts the totals row before the What's next panel", async ({ page }) => {
    test.setTimeout(120_000)
    expect(fixtures).toHaveLength(3)

    for (const width of [1440, 390] as const) {
      await page.setViewportSize({ width, height: 1200 })
      await page.goto("/")

      const totals = page.locator("[data-dashboard-totals]")
      const panel = page.locator("[data-whats-next]")
      await expect(totals).toBeVisible({ timeout: 20_000 })
      await expect(panel).toBeVisible()

      const panelFollowsTotals = await page.evaluate(() => {
        const totalsElement = document.querySelector("[data-dashboard-totals]")
        const panelElement = document.querySelector("[data-whats-next]")
        if (!totalsElement || !panelElement) return null
        return Boolean(
          totalsElement.compareDocumentPosition(panelElement) & Node.DOCUMENT_POSITION_FOLLOWING
        )
      })
      expect(panelFollowsTotals).toBe(true)

      const totalsBox = await totals.boundingBox()
      const panelBox = await panel.boundingBox()
      expect(totalsBox).not.toBeNull()
      expect(panelBox).not.toBeNull()
      if (totalsBox && panelBox) expect(totalsBox.y).toBeLessThan(panelBox.y)
    }
  })
})
