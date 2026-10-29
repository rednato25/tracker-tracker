# Design check 1 — break-ui

Target: `main` at `9c42abaa`. The P32b dashboard grid/table, P32c pathways restyle and
P32d detail/settings restyle are still open draft PRs, so this pass covers the
merged shell plus the register's desktop table and mobile tracker cards, the
merged pathways page, and the merged tracker detail/settings surfaces.

Fixture: `e2e/design-stress.spec.ts` (20 trackers, long names, 55 TiB values,
zero download, no snapshot, stale snapshot, unknown age, long class, 320/390px).

## What broke

| # | Severity | Field | Worst-case value | What happens | Fix |
| --- | --- | --- | --- | --- | --- |
| 1 | Broken | Unknown labels and separators | no snapshot / no login interval / missing rank | Replacement glyphs (`◆`) replace `—`, `·` and `×`; the register, totals note and rank/login columns read as corrupt data | Restore `—`, `·` and `×` in `TrackerRegister.tsx` |
| 2 | Broken | 320px metric grid | 55 TiB uploaded, 0 MiB downloaded, 1,000 bonus | Labels collide as `DOWNLOADEDBONUS`; values wrap against each other | Use a 2-column mobile grid and let Bonus take its own row |
| 3 | Broken | Mobile status | offline tracker | Offline status is clipped to `OFFL…` at the card edge | Make the status mark non-shrinking and nowrap |
| 4 | Broken | Stale marker | stale snapshot | Totals note ends with a bare `*`; no “Needs checking” text despite the design rule | Add the written `Needs checking` label |
| 5 | Ugly | Mobile tracker name | Aleksandra Wiśniewska-Kowalczyk's Very Long Private Tracker Community | Truncates to `Aleksandra Wiśniewsk…` with no way to read the full name | Decision: wrap to 2 lines on cards or keep truncation plus a full-name affordance |
| 6 | Fragile | Pathways owned list | 20 owned trackers | The list pushes the “Get to a tracker” picker and best path below the fold | Decision: cap/expand, scroll region, or separate list |

## Decisions for you

- **Long mobile tracker name (#5):** wrap to two lines (recommended: names are the
  primary identifier) or keep one-line truncation with a title/tooltip.
- **20 owned trackers on Pathways (#6):** show the first 5 with “Show all”
  (recommended), put the list in its own scroll region, or move it to a separate
  page. The current unbounded list makes the primary task disappear.
- **Tracker cards:** the P32b grid cards are not on `main`; stress coverage for
  those cards belongs to that PR. The merged dashboard's mobile register cards
  are covered here.

## Re-run on rebased main (P32b grid + totals)

The rebased dashboard now defaults to Grid and adds the five totals tiles. The
worst-case fixture was extended to 20 cards, 55 TiB totals, zero download, no
snapshot, stale snapshot, unknown age and long names.

| # | Severity | Field | What happens | Status |
| --- | --- | --- | --- | --- |
| 7 | Broken | 390px dashboard header | `DASHBOARD`, `GRID/TABLE`, `POLL ALL NOW` and the gear exceed 390px; the main region scrolls horizontally and the gear is off-screen | Report first; fix by wrapping the view/action row |
| 8 | Ugly | Grid card name | Long account name truncates to `Aleksandra Wiśniewska-Kowalczyk's Ver…` with no title/full-name affordance | Decision (wrap vs reveal) |
| 9 | Good | Totals tiles | Five tiles render at 390 with metric colors; values and sparklines hold | No fix |
| 10 | Good | Grid cards / table | 20 cards and the table render without vertical corruption; rank bars appear where the tracker has a target | No fix |

The 320px grid pass was blocked by the 390px overflow assertion; it will be run
after the header fix.

## What held up

- 55 TiB values remain readable and tabular; zero download renders `0 MiB`.
- Missing snapshots show an offline row instead of crashing.
- Long names and long classes wrap on Pathways, and missing trackerpathways data
  is stated without extra columns.
- Unknown age on Pathways is written as `Unknown`.
- No horizontal page or main-region overflow at 390px or 320px.
- Stale metrics keep their asterisks; the missing part is the written label.

## Evidence

`test-results/design-stress-register-1440.png`,
`design-stress-register-390.png`, `design-stress-register-320.png`,
`design-stress-pathways-1440.png`, `design-stress-pathways-390.png`.
