// e2e/p57.spec.ts
//
// P57 visual evidence. Three synthetic accounts live only in the guarded
// tracker_tracker_e2e database. They are enough to show a qualifying account,
// two future dates and a prefilled six-month filter from the PixelHD route.
import { mkdir } from "node:fs/promises"
import { expect, test } from "@playwright/test"
import { deriveKey, encrypt } from "../src/lib/crypto"
import { e2eSql } from "./db"
import { E2E_OWNER } from "./fixtures"

interface ProofFixture {
  id: number
  name: string
  slug: string
  group: string
  ratio: number
  joinedAt: string
  username: string
  remoteUserId: number | null
}

const fixtures: ProofFixture[] = []
let previousRecruitmentState: string | null = null

test.describe.configure({ mode: "serial" })

test.describe("P57 proof accounts", () => {
  test.beforeAll(async () => {
    const sql = e2eSql()
    try {
      const [settings] = await sql<
        { encryption_salt: string; recruitment_state: string | null }[]
      >`
        select encryption_salt, recruitment_state from app_settings limit 1
      `
      previousRecruitmentState = settings.recruitment_state
      const key = await deriveKey(E2E_OWNER.password, settings.encryption_salt)

      const rows = [
        {
          name: "TEST P57 TorrentLeech",
          slug: "torrentleech",
          group: "Power User",
          ratio: 2.5,
          joinedAt: "2023-01-15",
          username: "owner",
          remoteUserId: null,
        },
        {
          name: "TEST P57 Aither",
          slug: "aither",
          group: "Zeus",
          ratio: 1.8,
          joinedAt: "2026-07-15",
          username: "alice",
          remoteUserId: null,
        },
        {
          name: "TEST P57 AlphaRatio",
          slug: "alpharatio",
          group: "Sphinx",
          ratio: 1.4,
          joinedAt: "2026-09-15",
          username: "alphaowner",
          remoteUserId: 4321,
        },
      ]

      for (const row of rows) {
        const [tracker] = await sql<{ id: number }[]>`
          insert into trackers (
            name, base_url, registry_slug, platform_type, is_active, joined_at,
            last_polled_at, encrypted_api_token, remote_user_id, color, created_at, updated_at
          ) values (
            ${row.name}, ${`https://p57-${row.slug}.invalid`}, ${row.slug}, 'unit3d', true,
            ${row.joinedAt}::date, now(), ${encrypt(`synthetic-p57-${row.slug}`, key)},
            ${row.remoteUserId}, '#6d56eb', now(), now()
          ) returning id
        `
        fixtures.push({ ...row, id: tracker.id })
        await sql`
          insert into tracker_snapshots (
            tracker_id, polled_at, uploaded_bytes, downloaded_bytes, ratio, group_name,
            username, buffer_bytes, seeding_count, leeching_count, seedbonus, hit_and_runs,
            required_ratio, warned, freeleech_tokens, is_manual
          ) values (
            ${tracker.id}, now(), ${2 * 1024 ** 4}, ${1024 ** 4}, ${row.ratio}, ${row.group},
            ${row.username}, ${1024 ** 4}, 8, 1, 1234, 0, 1, false, 0, false
          )
        `
      }

      await sql`
        update app_settings
        set recruitment_state = ${JSON.stringify({
          version: 2,
          desiredTrackerSlug: "PixelHD",
          hiddenPathKeys: [],
          goalLinks: [],
          pinnedRoutes: {},
        })}
      `
    } finally {
      await sql.end()
    }
    await mkdir("docs/screenshots/p57", { recursive: true })
  })

  test.afterAll(async () => {
    const sql = e2eSql()
    try {
      for (const fixture of fixtures) {
        await sql`delete from trackers where id = ${fixture.id}`
      }
      await sql`update app_settings set recruitment_state = ${previousRecruitmentState}`
    } finally {
      await sql.end()
    }
  })

  test("lists proof accounts, prefill and the copied summary", async ({ page }) => {
    test.setTimeout(180_000)
    expect(fixtures).toHaveLength(3)
    const torrentLeech = fixtures[0]
    const aither = fixtures[1]
    if (!torrentLeech || !aither) throw new Error("missing P57 fixtures")

    await page.setViewportSize({ width: 1440, height: 1200 })
    await page.goto("/pathways")
    await page.waitForLoadState("networkidle")

    const panel = page.locator("[data-proof-accounts]")
    await expect(panel).toBeVisible()
    await expect(panel.getByRole("heading", { name: "Your proof accounts" })).toBeVisible()

    // PixelHD's AlphaRatio route says "2 extra tracker proofs that are 6 months old".
    await expect(panel.getByLabel("Minimum account age (months)")).toHaveValue("6")
    await expect(panel.getByLabel("Minimum ratio")).toHaveValue("0")
    const requirement = panel.locator("[data-proof-requirement]")
    await expect(requirement).toContainText("2 needed")
    await expect(requirement).toContainText("1 qualifies now")
    await expect(requirement).toContainText(/next on [A-Z][a-z]{2} \d{1,2}, \d{4}/)

    // Other specs may leave an unrelated tracker behind. Assert that each of
    // this spec's three fixtures is listed, not that the panel contains only them.
    for (const fixture of fixtures) {
      await expect(panel.locator(`[data-proof-account="${fixture.id}"]`)).toHaveCount(1)
    }
    const old = panel.locator(`[data-proof-account="${torrentLeech.id}"]`)
    await expect(old).toHaveAttribute("data-qualifies", "true")
    await expect(old).toContainText("Power User")
    await expect(old).toContainText("ratio 2.50x")
    await expect(old.locator("[data-proof-profile-link]")).toHaveAttribute(
      "href",
      "https://p57-torrentleech.invalid/profile/owner"
    )

    const young = panel.locator(`[data-proof-account="${aither.id}"]`)
    await expect(young).toHaveAttribute("data-qualifies", "false")
    await expect(young).toContainText(/Qualifies in \d+ days/)

    await page.evaluate(() => {
      const store = { text: "" }
      ;(window as unknown as { __p57Copied: { text: string } }).__p57Copied = store
      Object.defineProperty(navigator.clipboard, "writeText", {
        configurable: true,
        value: async (text: string) => {
          store.text = text
        },
      })
    })
    await panel.getByRole("button", { name: "Copy application summary" }).click()
    await expect(panel.getByRole("status")).toContainText("Copied application summary.")
    const copied = await page.evaluate(
      () => (window as unknown as { __p57Copied?: { text: string } }).__p57Copied?.text ?? ""
    )
    expect(copied).toContain(`**${torrentLeech.name}**`)
    expect(copied).toContain("member since Jan 15, 2023")
    expect(copied).toContain("ratio 2.50x")
    expect(copied).toContain("https://p57-torrentleech.invalid/profile/owner")
    expect(copied).not.toContain(aither.name)
    expect(copied).not.toMatch(/token|cookie|passkey/i)
    expect(copied).not.toMatch(/@/)

    // Drop the client-side "Copied" state so the evidence shows the default action.
    await page.reload()
    await page.waitForLoadState("networkidle")

    for (const width of [1440, 390] as const) {
      await page.setViewportSize({ width, height: width === 1440 ? 1200 : 1000 })
      if (width === 390) {
        await page.waitForFunction(() => document.querySelector('[data-mobile="true"]') !== null)
      }
      await panel.scrollIntoViewIfNeeded()
      for (const theme of ["light", "dark"] as const) {
        await page.evaluate((next) => {
          document.documentElement.dataset.theme = next
        }, theme)
        await page.waitForTimeout(150)
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth
        )
        expect(overflow, `proof accounts overflow at ${width}px`).toBeLessThanOrEqual(1)
        await panel.screenshot({
          path: `docs/screenshots/p57/proof-accounts-${width}-${theme}.png`,
          animations: "disabled",
        })
      }
    }
  })
})
