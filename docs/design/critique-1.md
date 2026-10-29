# Design check 1 — critique

**Score history: 24/40 (first pass) → 25/40 (second pass after P32b/c/d).**

Method: dual-agent (A: design review · B: detector + screenshot evidence)
Target: merged app surfaces on `main` (`9c42abaa`) plus this pass's clear-break fixes.
Scope: dashboard, pathways, tracker detail, settings.

P32b (dashboard grid/table), P32c (pathways restyle) and P32d (detail/settings
restyle) are open draft PRs, not merged. Where a missing pattern belongs to one
of those branches, it is called out as a dependency, not as a defect of this pass.

## Design health score

| # | Heuristic | Score | Key issue |
| --- | --- | --- | --- |
| 1 | Visibility of system status | 3 | Per-tracker freshness is strong; no global poller/next-poll state. |
| 2 | Match system / real world | 3 | Exact operator vocabulary, but “Accounted”, “Viability” and raw platform ids leak. |
| 3 | User control and freedom | 2 | The one-click “mark login today” write has no confirm/undo; settings tabs reset on reload. |
| 4 | Consistency and standards | 2 | “HEALTHY” vs rule text; multiple button languages; labels at 0.14–0.16em against a 0.06em spec. |
| 5 | Error prevention | 2 | One-click last-login write; stale data can still be read as current. |
| 6 | Recognition rather than recall | 2 | `*`/`?` decoded in titles; settings tabs scroll with no affordance; nav hides on mobile. |
| 7 | Flexibility and efficiency | 3 | Poll actions are good; no sort/filter/expand or keyboard path in the register. |
| 8 | Aesthetic and minimalist design | 2 | Honest density but no quiet zone; detail page strings compete at one weight. |
| 9 | Error recovery | 3 | Specific recovery copy; poll failures surface far from the action. |
| 10 | Help and documentation | 2 | Evidence disclosures are good; no contextual rank help. |
| **Total** | | **24/40** | **Acceptable — significant improvements before users are happy** |

## Design specificity

**Authored at the data layer, category-interchangeable at the shell.** The
register's Accounted cell, login micro-bar, `3/4` viability strip, truth
vocabulary (`—`, `?`, `*`, “Needs checking”) and rank-goal reasoning are
unmistakably this product. The violet/Geist/10px-card/top-bar shell could belong
to any self-hosted dashboard. The old condensed label grammar also survives:
labels are uppercase and tracked far beyond the new 0.06em spec, while the
12px floor collapsed four label sizes into one.

**Deterministic scan:** 0 findings in the 48 targeted files. One unrelated
`side-tab` warning exists in `TrackerOverviewGrid.tsx` (outside this target set).
The scan is regex-based and cannot see runtime clipping, wrap or contrast.

## What's working

1. **Truth is designed, not disclaimed.** Marks, written labels, provenance and
   “Totals from n of m” form a coherent system.
2. **The register row compresses a lot of domain truth** without becoming a
   second product.
3. **Numbers are the loudest element.** Tabular mono, consistent metric hues and
   quiet units match the operator's reading pattern.

## Priority issues

### P1 — Tracker detail action bar is an undifferentiated, partly unguarded cluster

Six equal-weight controls, four icon-only, sit in one row. The check icon writes
the last-login date with no confirmation. Misclicking fabricates a login and
hides a real inactivity deadline.
**Decision:** keep Poll Now and pause visible; move Debug, Mark login,
Credentials and Settings into one labeled overflow; turn Mark login into a
confirmed text action that names the new date.

### P1 — The 3-second contract is not met on `main`

The first viewport has four totals tiles (no buffer), no sparklines, and rank
distance only in the seventh section after a target is saved. This is owned by
the unmerged P32b branch, not by this pass.
**Decision:** land P32b before signing off the dashboard, or add the fifth tile
and an above-the-fold rank-distance row in the register band.

### P2 — Rank stacks encode distance with alpha only

The ladder uses fill alpha and a glow; the only text is the class name. The
unearned rungs are effectively invisible at low contrast, and nothing states
“n of 11” or “x to next rank”.
**Fixed this pass:** the outside-ladder chip no longer uses 60% opacity, so its
text clears AA.
**Decision:** print the written distance and give the stack an accessible name.

### P2 — Settings General is a ten-section junk drawer at full page width

Account, 2FA, privacy, vault, data, two importers, image hosting, security,
proxy and danger zone share one 1600px column. Fields and their save buttons are
far apart; the 390px tab strip clips without a scroll cue. The unmerged P32d
restyle does not fix the IA.
**Decision:** cap form content at a readable measure, split General into
task-based sub-sections, and add a tab-scroll affordance.

### P2 — Register has no sort, filter or row expansion

DESIGN.md promises sorting, row expansion and empty states; the register renders
in array order. At 20 trackers the operator's question (“which login is closest
to due?”) can only be answered by scanning.
**Decision:** add sortable Ratio/Buffer/Login due/Rank heads with `aria-sort`, or
amend DESIGN.md to drop the claim.

## Fixed while checking

- Register replacement glyphs, the 320px metric-label collision, clipped offline
  status labels and the bare stale asterisk.
- Mobile tracker action row now wraps; button labels do not break mid-word.
- TrackerHub status fits at 390px; metric periods no longer run into their units;
  joined date and account age no longer break mid-token.
- The outside-ladder rank chip no longer uses 60% opacity, so its text clears AA.
- Mobile platform baseline (`dvh`, safe areas, 16px coarse inputs, tap highlight,
  touch-action, theme-color, color-scheme) and explicit control transitions.
- `bg-field` native selects now use a defined surface token.

## Persona red flags

- **Alex (power user):** no sort/filter/density toggle; no keyboard shortcuts;
  no URL state for tabs or rank target; Poll All gives no per-tracker result.
- **Sam (accessibility):** rank ladder states are not focusable or announced;
  tabs lack roving focus/arrow keys; `*`/`?` help is title-only; some states are
  color/alpha-only. This pass fixed the outside-rank contrast and reduced
  transition scope.
- **Casey (mobile):** six controls in one 390px row; settings tabs clip with no
  scroll cue; picker autofocus raises the keyboard; pull-to-refresh is globally
  suppressed; 20 owned trackers bury the picker.

## Minor observations

- Same tracker uses “HEALTHY” and a rule sentence as its primary status.
- `UNIT3D`/`ENGLISH` sit as peers to the rule badge; platform id is internal.
- Pathways still uses `nm-inset`/`nm-float` legacy surfaces; P32c is unmerged.
- Download budget prints a raw ISO timestamp.
- Accountability language repeats three times on one tracker screen.
- 1024–1279px laptops get the mobile stacked register, a density cliff.
- “Account register” is the only H1 under a “Dashboard” eyebrow.

## Second pass — P32b/c/d merged

Score: **25/40** (up 1). The fleet read is materially better, but the rank
semantics and cross-view inconsistency now carry more weight.

| # | Heuristic | Score | Key issue |
| --- | --- | --- | --- |
| 1 | Visibility of system status | 3 | Strong totals/health/stale markers; “All clear” still needs to be coverage-aware. |
| 2 | Match system / real world | 3 | “Accounted”, “UP/DN/BON” and “1 direct lead” still require decoding. |
| 3 | User control and freedom | 3 | Grid/Table is remembered and details expand; grid has no filter/group. |
| 4 | Consistency and standards | 2 | Ratio is amber in totals, green on cards and neutral in the table; register thresholds differ. |
| 5 | Error prevention | 2 | Mark-login and rank-target writes are immediate and unconfirmed. |
| 6 | Recognition rather than recall | 2 | Six icon actions on detail; UP/DN/BON legend is below the fold. |
| 7 | Flexibility and efficiency | 2 | No sort/filter/group for 20 cards; table is the only dense view. |
| 8 | Aesthetic and minimalist design | 3 | Fleet read is clean; best-path card is mostly empty; rank is stated three times. |
| 9 | Error recovery | 2 | “Structured rank progress is unavailable” repeats without cause or next step; strict-threshold UNMET is unexplained. |
| 10 | Help and documentation | 3 | Evidence/docs are good; threshold semantics and rank help are buried. |
| **Total** | | **25/40** | **Acceptable** |

**Second-pass strengths:** the five-tile totals row delivers the 3-second read;
truth language is rigorous; the Night Grid is coherent on totals and cards.

**Second-pass priority issues:**
1. **P1** A strict threshold at equality renders a full red bar with no written
   state. Cards now print MET/UNMET/UNKNOWN, but the bar remains visually
   contradictory; decide whether equality is met and show a threshold tick.
2. **P1** Names were truncated in cards and register despite DESIGN.md saying the
   only identifier must wrap. Fixed in this pass.
3. **P2** Pathways leads with the owned-tracker directory, repeats the route,
   duplicates “Ready now” and hides requirement bars in Details. Decision.
4. **P2** Need attention said `00 / All clear` while coverage was incomplete.
   Fixed to `0 / No known actions · coverage incomplete`.
5. **P3** Ratio uses amber in totals, green on cards and neutral in the table.
   Decision: one ratio ramp and one threshold policy across views.

**Fixed after the second-pass critique:**
- rank-bar MET/UNMET/UNKNOWN text; tracker names wrap; attention count/coverage;
  320px totals no longer break units; 44px detail action targets; unknown `?`
  marker in the register; dashboard header wraps at 320/390.

## Third pass — main @ 80ed6ee8

Evidence: dark theme only, 1440px and 390px. The e2e app started through
Playwright's webServer in about 4 seconds, so the 5-minute stop rule never
triggered. Detector scans of the rendered surfaces returned no warnings; the
only hit in the wider tree was a 3px side-tab in the unused
`TrackerOverviewGrid.tsx:205`, which is not on the rendered dashboard.

### Dashboard

**Verdict:** the five-tile read and the card/register split are the strongest
they have been, but the two views no longer tell the same truth. Grid says
“2 of 3 checks”; the register says “3/4 checks” for the same account, and only
the register's ratio keeps its metric hue. A 3-second scan still reads a green
`0` while two of five accounts are offline.

**Holds:** totals order and coverage caption; rank bars with current/required,
MET/UNMET and threshold ticks; sortable register; remembered Grid/Table;
mobile card stacking; plain `OFFLINE` labels in the register.

**Issues:**

- **P1 — The attention tile can say all-clear while the account list does not.**
  At 1440 the tile reads green `0` with “No known actions · coverage
  incomplete” above two `OFFLINE` rows and four “need verification” items.
  `DashboardTotals.tsx:87-95` colors success whenever `attentionCount === 0`,
  regardless of missing or stale snapshots. The qualifier is 12px tertiary, so
  the 3-second read is “all clear.”
- **P1 — Grid and register disagree on “checks.”** Foundation's card says
  “2 of 3 checks” (rank-target conditions); its register row says `3/4`
  (ratio, buffer, seeding, login). Both columns are labelled “Checks,” so the
  same account has two answers. The register also has no target rank or
  distance-to-next-rank column, so the dense view drops the page's core
  question.
- **P2 — Health is still color-only on the primary surface.** Cards show an
  8px green or gray dot with no written state; the register writes `OFFLINE`
  for non-ok rows but omits `HEALTHY`, and the Checks strip has four unlabelled
  segments. DESIGN requires a dot to be paired with a written label.
- **P2 — Stale looks current.** The stale card keeps a green dot and no `*`;
  the register stars only Upload/Download/Bonus (`2.00 TiB*`) while Ratio,
  Buffer and Seeding stay clean. A stale snapshot is a fleet-wide footnote, not
  a per-card state (`DashboardTotals.tsx:46-49,98-111`).
- **P2 — Metric colors stop at the register.** Ratio keeps amber, but Buffer,
  Seeding and Transfer values are neutral in the table
  (`TrackerRegister.tsx:700-723`); only the card grid carries upload green,
  download violet, buffer blue, bonus orange. The same hue does not follow the
  metric into the table, so the two views look like different products.
- **P2 — At 390 the first screen answers 3 of 4 questions.** The 844px
  viewport ends before the first rank target; “Need attention” is the fifth
  tile alone beside an empty cell. The page is totals-first, rank-later, which
  is the right order on the desktop grid but not on a phone.
- **P3 — Type and vocabulary drift between views.** Grid H1 “Trackers” is 30px;
  register H1 “Account register” is 36px (DESIGN: 28/32). Meta changes from
  “5 accounts · as of 2026-10-29” to “5 trackers · last poll just now,” ratio
  from `2.00x` to `2.00×`, age from “1 year, 10 months” to “1y 10m.”
- **P3 — Label tracking is still 0.12–0.14em**, not the 0.06em DESIGN value:
  computed 1.44px on 12px tile labels and 1.68px on 12px register heads.

## Decisions for you

1. **P32b dependency:** merge the dashboard grid/table branch before declaring
   the 3-second contract met, or keep main as the register view?
2. **Tracker detail actions:** overflow menu (recommended) or keep all six
   controls visible and add labels?
3. **Rank ladder:** add written distance (`n of 11 · x to rank`) or drop the
   ladder from the dashboard/detail?
4. **Settings:** split General into task groups and cap form width, or keep one
   long form and only fix the tab affordance?
5. **Register behavior:** add sorting/filter/expansion, or amend DESIGN.md to
   remove the promise?
6. **20-tracker owned list:** cap/expand, scroll region, or separate page?
   Long names now wrap, so that half is resolved.
7. **Ratio semantics:** one ramp and one threshold policy across totals, cards
   and table? Decide whether “at least” vs “above” equality is met.
8. **Pathways order:** lead with the picker/best path and collapse the owned
   directory (recommended), or keep the directory first?
9. **Scroll affordances:** fade/chevron for the 390px settings tabs and rank
   ladder, or allow the rows to wrap?

## Evidence

- `docs/design/break-ui-1.md` and `docs/design/web-guidelines-1.md`
- `docs/design/polish-1.md`
- `e2e/design-stress.spec.ts`
- Stress and foundation screenshots under `test-results/`
