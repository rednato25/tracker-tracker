# Yata reference notes and shape briefs

Design reference: [Yata-Dash](https://github.com/Yata-Dash/Yata-Dash), commit
`d4692e33d2a72b22d828de956cbd468fc3075949`, GPL-3.0. Read-only clone studied
outside the repository: `docs/screenshots/dashboard-grid.png`,
`docs/screenshots/dashboard-table.png`, `docs/screenshots/card-targets.png`,
`docs/screenshots/pathways.png`, and `static/dashboard.css`.

No Yata code, CSS or assets are copied. The screenshots are evidence for
composition and token behaviour only.

## What the reference actually does

- A single sticky top bar, 58px high, with the product mark, primary views and
  utility actions. There is no left rail.
- Dashboard totals: a six-column row of flat cards, each with a top accent rule,
  a large mono value, a muted label and a compact sparkline. It collapses to
  three columns and then two.
- Dashboard grid: tracker cards with a header (health dot, name, URL, account
  age), a compact identity/class row, a three-column stat grid and a targets
  section with current/required bars.
- Dashboard table: the same data as a dense register; rows expand into stats,
  info and targets. The table is a view of the same model, not a separate page.
- Pathways: a target input, a highlighted best-path card with route chips, a
  requirement checklist with current/required bars, and collapsed other routes.
- Tokens: near-black `#0d0f14` ground, layered blue-black surfaces, 1px borders,
  three slate text levels, one violet accent and semantic green/red/amber/blue/
  purple/orange data colors. Geist and Geist Mono. 10px card radius, 6px control
  radius. Borders and small accent rules carry structure; shadows are restrained.

## Shape briefs

### Dashboard

- **Job and audience.** A self-hoster with 5–50 tracker accounts opens the app to
  answer "is anything wrong, and how far am I from the next rank?" in one scan.
  Operate mode.
- **Outcome and proof.** Success is the 3-second read: total uploaded, total
  downloaded, overall ratio, and next-rank distance. Proof comes from existing
  snapshots, registry rules and rank ladders; no fabricated health score.
- **Structure.** One totals tile row (uploaded, downloaded, buffer, overall ratio,
  need attention), then a Grid | Table switch in the header. Grid shows tracker
  cards; Table shows the existing register restyled. Rank progress follows the
  accounts, not the tiles.
- **States and ranges.** 0 accounts, 1 account, 50 accounts, no snapshot history,
  stale history, zero values, unknown values, failed polls, paused accounts,
  long tracker names, narrow and ultrawide widths.
- **Boundaries.** Sparklines only where snapshot history exists. Need attention
  is a count and a written state, not an invented series. No time-to-next-rank
  estimate. No seedbox strip.

### Tracker card

- **Job.** Read one account without opening it; compare its stats and rank target.
- **Structure.** Header: health dot, name, host, class/account-age chip. Stat grid:
  the six mapped metrics. Target bars: current / required, one bar per requirement,
  with `?` for unknown and `*` for stale.
- **States.** Unknown class, no joined date, no snapshot, stale snapshot, requirement
  met/unmet/unknown, one-of groups, long class names.
- **Boundaries.** No ETA, no promotion date, no invented threshold. Actions stay in
  the existing overflow/menu pattern; the card is a summary, not a settings page.

### Pathways page

- **Job.** Choose a tracker not owned and understand the fastest known route and
  what each step requires.
- **Structure.** Searchable picker, saved-target chips, one best-path card with
  route chips and a total time-left readout, requirement bars per step, and
  collapsed other routes (max five). Details stay behind a disclosure.
- **States.** No target, target owned, no known route, missing from trackerpathways,
  unknown wait, stale community data, source-gate text, long tracker names.
- **Boundaries.** Route data stays trackerpathways; requirement bars show existing
  current/required values, `?` when unknown, and "Needs checking" when unverified.
  No promotion dates and no implied guarantee.

### Page shell

- **Job.** Move between Dashboard, Pathways and Settings without losing context;
  keep one visual rhythm across all pages.
- **Structure.** Sticky top bar with brand, Dashboard (Grid | Table), Pathways and
  Settings. Secondary tools (search, docs, add tracker, session) live in a utility
  group or overflow. Content uses one 1600px maximum width and 24px desktop / 16px
  mobile gutters. The main region scrolls; the header stays put.
- **Mobile.** Brand + menu; the same three destinations in a drawer. 44px touch
  targets, no horizontal scroll, title clears the menu trigger at 390px.
- **Boundaries.** Do not copy the Yata wordmark, logo, seedbox bar, theme cycler or
  time-to-rank language. Keep the existing theme persistence and the Tracker
  Tracker identity.

## Assumptions

- The shell moves from the incumbent left rail to the sticky top bar described
  above; this is the requested header and the Yata shell shape.
- Dark is the reference rendering, with a derived light parity theme. Both use the
  existing theme mechanism; no new theme switcher is introduced.
- One page width means a shared 1600px content frame for dashboard, tracker detail,
  pathways, search, settings and docs.
- This task changes documentation only. No product code, data, thresholds or
  migrations are part of it.
