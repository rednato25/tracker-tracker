# Tracker Tracker — Design System

The dashboard must show in 3 seconds: total uploaded, total downloaded, overall ratio, and how far each tracker is from its next rank.

Status: active. Surface mode: **Operate**. Visual world: **Night Grid**
(Yata-inspired).

Reference: [Yata-Dash](https://github.com/Yata-Dash/Yata-Dash) at
`d4692e33d2a72b22d828de956cbd468fc3075949`, GPL-3.0. The reference audit and
surface briefs live in `docs/YATA_REFERENCE_NOTES.md`. No Yata code, CSS or
assets are copied by this document.

## Direction contract

**Thesis.** A calm, instrument-grade night dashboard: dark layered surfaces,
precise rules, vivid data inks and one violet interaction accent. It is dense
enough for an operator and quiet enough to read at a glance.

**Own-world.** Near-black blue ground, stepped blue-black surfaces, 1px borders,
three slate text levels, one violet accent, Yata's metric color mapping, Geist
and Geist Mono. Cards are flat panels with a 2px top signal rule, not floating
glass. Numbers carry the color; labels stay quiet.

**Story.** The operator sees the fleet total, the accounts that need attention,
and the distance to the next rank without opening a detail page. Tracker cards
and the register are two views of the same truth.

**First viewport.** A 58px sticky top bar with the Tracker Tracker identity,
Dashboard (Grid | Table), Pathways and Settings. Beneath it, one 1600px content
frame starts with a five-tile totals row: uploaded, downloaded, buffer, overall
ratio and need attention. Sparklines use existing snapshot history only. The
dashboard body follows as tracker cards or the existing register, restyled.

## Shape briefs

The four shaped surfaces are documented in `docs/YATA_REFERENCE_NOTES.md`:

- **Dashboard** — totals row plus Grid | Table, answering "what needs attention
  and how far is the next rank".
- **Tracker card** — header, six-metric stat grid, current/required rank bars.
- **Pathways** — owned-tracker cards, searchable target profile, best-path card,
  route chips, one-line steps, collapsed other routes.
- **Page shell** — one sticky top bar, one page width, shared navigation.

## Tokens

### Dark reference theme

| Token | Value | Use |
|---|---|---|
| `--color-bg` | `#0d0f14` | Page ground, top bar base |
| `--color-surface` | `#13161e` | Cards, tiles, table body |
| `--color-surface-2` | `#1a1e2a` | Nested panels, table heads, controls |
| `--color-surface-3` | `#1f2433` | Hover, tracks, inset bands |
| `--color-border` | `#252b3b` | Default 1px rule |
| `--color-border-strong` | `#2e3548` | Control and focus-adjacent rules |
| `--color-text` | `#e2e8f0` | Headings and primary values |
| `--color-text-2` | `#94a3b8` | Body and secondary labels |
| `--color-text-3` | `#8492ad` | Metadata; Yata's `#64748b` lifted for AA at 12px |
| `--color-accent` | `#6d56eb` | Solid primary action fill |
| `--color-accent-hover` | `#5a44d4` | Primary action hover |
| `--color-accent-text` | `#9b8cff` | Accent text and links on dark |
| `--color-on-accent` | `#ffffff` | Text on the accent fill |
| `--color-accent-bg` | `rgba(109, 86, 235, 0.14)` | Selected row, active nav, soft accent |
| `--color-focus` | `#9b8cff` | Keyboard focus ring |

Yata's exact `--bg`, surfaces, borders, text levels and accent are the source.
`--color-text-3` and `--color-accent-text` are the only dark adjustments: the
Yata tertiary slate and the raw accent fail 4.5:1 as small text on the dark
ground, so text uses the lifted values while the exact Yata accent remains the
solid fill color.

### Light theme derived from the reference

| Token | Value | Use |
|---|---|---|
| `--color-bg` | `#f6f7fb` | Page ground |
| `--color-surface` | `#ffffff` | Cards, tiles, table body |
| `--color-surface-2` | `#eef1f7` | Nested panels, table heads, controls |
| `--color-surface-3` | `#e4e8f2` | Hover, tracks, inset bands |
| `--color-border` | `#d5dae6` | Default 1px rule |
| `--color-border-strong` | `#bcc4d6` | Control and focus-adjacent rules |
| `--color-text` | `#141824` | Headings and primary values |
| `--color-text-2` | `#4b5366` | Body and secondary labels |
| `--color-text-3` | `#60687c` | Metadata; AA on every light surface |
| `--color-accent` | `#5b45d6` | Solid primary action fill |
| `--color-accent-hover` | `#4a35c4` | Primary action hover |
| `--color-accent-text` | `#5b45d6` | Accent text and links |
| `--color-on-accent` | `#ffffff` | Text on the accent fill |
| `--color-accent-bg` | `rgba(91, 69, 214, 0.08)` | Selected row, active nav |
| `--color-focus` | `#5b45d6` | Keyboard focus ring |

Light is a derived parity theme, not a filter. The light palette is cool,
slightly blue-tinted paper that keeps the same hierarchy and data colors.

Contrast checks for the shipped pairs:

- Dark: primary text 15.5:1 on `bg`, secondary 7.5:1, tertiary 6.1:1, accent text
  6.9:1, accent fill with white text 5.0:1.
- Light: primary text 16.5:1 on `bg`, secondary 7.2:1, tertiary 5.2:1, accent
  text 6.0:1, accent fill with white text 6.4:1.
- Metric-colored text is only placed on `surface` and `surface-2`, where every
  mapped color clears 4.5:1. `surface-3` is for rules, tracks and empty bars, not
  small colored text.

### Metric colors

These tokens are global. The same hue follows each metric into totals, cards,
tables, charts, sparklines, details and pathways.

| Metric | Dark | Light | Rule |
|---|---|---|---|
| Uploaded | `#22c55e` | `#166534` | Green, always |
| Downloaded | `#a855f7` | `#7e22ce` | Data violet, always; never used for controls or the accent |
| Buffer | `#3b82f6` | `#1d4ed8` | Blue, always |
| Ratio | `#f59e0b` | `#854d0e` | One ratio metric color for the value everywhere. Status comes from MET/UNMET/UNKNOWN text and markers, never from the value hue. Equality follows the stored operator: gte is met at equality; gt is not. |
| Seeding | `#3b82f6` | `#1d4ed8` | Blue, always |
| Bonus | `#f97316` | `#c2410c` | Orange, always |
| Need attention | `#ef4444` when above zero, `#22c55e` at zero | `#b91c1c` / `#166534` | Written count plus color |

Green, amber and red are semantic state colors for availability, health and
eligibility. Purple is reserved for downloaded data. The interaction accent is
the only violet used for controls.

### Type

- **Geist** for interface and body text, loaded with `next/font`.
- **Geist Mono** for every number, value, date, count, ratio and duration, loaded
  with `next/font`. Numerals are tabular.
- Minimum visible size: **12px**. Never ship 10px or 11px interface text.
- Page title: 28px / 32px, 650.
- Section title: 18px / 24px, 600.
- Card title: 15px / 20px, 600.
- Body: 13px / 18px, 400–500.
- Labels and table heads: 12px, uppercase, 0.06em tracking, 500.
- Values: 14px / 20px mono; totals: 24px / 28px mono, 650.
- Long names wrap; do not truncate the only identifier.

### Shape and elevation

- Card and tile radius: 10px. Control radius: 6px. Chip radius: 6px.
- 1px borders at all times. A 2px top signal rule on totals and card accents.
- No glow, no gradient fills, no stacked shadows. Overlays get one soft shadow.
- Focus is a 2px ring in `--color-focus` with a 1px offset.

## Layout

- One page width for every surface: 1600px maximum, centered, with 24px desktop
  and 16px mobile gutters. Header contents share the same frame.
- Sticky top bar: 58px. Main is the scroll container; the header stays put.
- Totals row: 5 columns at wide widths, 3 at medium, 2 at narrow.
- Dashboard grid: 3 card columns at 1280px+, 2 at 768px+, 1 below. The table
  replaces the stacked cards from 1024px when it fits without horizontal scroll;
  it moves to the stacked register below that width.
- Settings form content is capped at 896px inside the page frame. Its tab strip
  wraps to two rows at narrow widths instead of scrolling.
- Tracker cards use a 3-column stat grid; target bars sit below the stats.
- Page sections use one vertical rhythm: 24px between major bands, 16px inside
  cards, 12px between rows.
- 390px is a first-class layout: no horizontal scroll, 44px touch targets and a
  header whose title clears the menu trigger.

## Components and patterns

### Page shell and header

- Tracker Tracker identity at the left. Keep the product name and mark; do not
  use the Yata name or logo.
- Primary navigation: **Dashboard** with a Grid | Table segmented control,
  **Pathways**, **Settings**. Secondary tools (search, docs, add tracker,
  session) live in a right-side utility group or overflow menu.
- Active navigation uses the accent background and a 2px accent underline; it is
  never only color.
- The header is sticky and translucent over the page ground, with a 1px bottom
  border. No second navigation rail.

### Totals tile row

- Exactly five tiles: uploaded, downloaded, buffer, overall ratio, need attention.
- Each tile: 12px uppercase label, large mono value, optional delta, and a
  sparkline drawn from existing snapshot history.
- A sparkline appears only when at least two real points exist. Need attention
  shows a count and a written state; do not fabricate a series for it.
- Unknown totals show `—` and `?`, never `0`. Stale totals carry `*` and the
  "Needs checking" text.
- The top signal rule and value use the metric color.

### Dashboard views

- **Grid** is the tracker card grid. **Table** is the existing register restyled,
  not a new table with different semantics. Both use the same totals row and the
  same metric colors.
- The Grid | Table choice is a view toggle, not a route. Preserve the current
  register columns and default order. Sorting is owned by the register itself.
- Do not add a seedbox strip, per-tracker health score or time-to-next-rank
  estimate.

### Tracker card

- Header: health dot plus written state, tracker name, host, class chip and
  account age. The account age is a real duration or `Unknown`.
- Stat grid: uploaded, downloaded, buffer, ratio, seeding, bonus. Values use the
  metric tokens; labels stay secondary.
- Rank progress prints `n of N` and the distance in words to the saved or next
  rank (for example `Super User: 340 GiB upload, 12 days account age left`) from
  the existing rank summary. State rank once per view. Grid cards replace the
  separate dashboard ladder section.
- Target bars: one row per active requirement, labelled `current / required`,
  with a threshold tick, MET/UNMET/UNKNOWN text and a fill that never contradicts
  the text. Fill uses the requirement state color, not a generic progress color.
  Unknown current or required values show `?`; stale values show `*`.
- Rank targets come from the registry and saved rank goals. There is no ETA, no
  promotion date and no invented threshold.
- At the top of the automatic ladder, say `Highest automatic class reached`.
  Never invent thresholds for staff, VIP, awarded or unpublished classes.
- A saved target at or below the current class says `Target reached`; offer the
  next automatic class when one exists, otherwise repeat the highest-automatic
  line. Do not silently drop the saved target.
- A next class with only rule text shows the class name and its requirement,
  labelled `From tracker rules (not tracked automatically)`.
- A failure-paused tracker shows `Paused after N failed polls · next retry HH:MM`
  and the plain cause (`Timeout`, `Site down`, `Login expired, update
  credentials`). Manual pauses never show a retry. A rejected login stops after
  the first retry.
- One-of groups are labelled "One of"; all-of groups stack normally.

### Register table

- Restyle the existing register with the Night Grid tokens: surface body, 1px
  rules, 12px uppercase heads, mono values, hover row tint, accent focus.
- Keep the existing columns and empty states. Ratio, Buffer, Login due and
  Rank are sortable with `aria-sort`, remembered per browser. There is no
  filter and no row expansion.
- Show the table from 1024px when it fits without horizontal scroll; otherwise
  use the smallest width that does.
- Status is written as well as colored. The table does not become a second
  product.

### Pathways page

- The page uses the dashboard frame: the same H1 rule row, 24px major gaps, flat
  raised cards, and Geist Mono for numbers, days and dates.
- "Where your trackers can take you" comes first: one card per owned tracker that
  has routes, not one row per route. The card header names the tracker and shows
  when its invites open: `Invites open now` or `Invites open in N days`. Use the
  source `unlockInviteClass` gate for this timing, including MAM's gate.
- Sort the owned-tracker cards by soonest invite: open now first, then the
  smallest remaining days, then unknown.
- Inside each card, destinations are compact rows of name plus requirement.
  Show the first six, then a `+N more` control that reveals the rest.
- Closed routes stay visible but greyed with a written `Closed` label. They are
  never part of a best path.
- The target picker opens a tracker profile, in this order:
  1. the best path on top when the user has one;
  2. the no-route block when there is none;
  3. the profile card.
- The profile card shows the target, the class needed on that tracker to send
  invites, its recruiting status and checked date, `Invited from` and
  `Can invite to`. Both lists mark closed routes.
- When no owned route reaches the target, list the open `Invited from` trackers
  and for each one show `Can reach` with the best path and time, or `Can't
  reach`. If no open invite route exists, say:
  `Nobody in the data invites to <tracker>. It may recruit through open signups
  or interviews.`
- The best-path card starts with a **Best path** badge, route chips from the
  owned source to the target, and total time left.
- Each best-path step is one line: `From A to B Â· needs â€¦ Â· N days left`. A step
  is "Ready now" only when its wait is met and it has no other requirement text.
  Otherwise the wait and requirement stay together, for example
  `Wait done, needs 3TB upload`.
- Total time left uses the same rule and says when any step still needs checking.
- Route chips use surface-2 with a 1px border and the accent only for the active
  target. They are selectors, not decorative pills.
- Details stays collapsed and shows only the source updated date and last
  verification. No raw ISO timestamps.
- Other routes stay collapsed, maximum five. No requirement bars in the step
  row; the one-line requirement text carries the check.
- No seedbox bar, no Yata target headline copy, no promotion estimate.

### Controls

- Buttons: 6px radius, 1px border, 13px Geist. Primary is the accent fill with
  white text; secondary is surface-2; ghost is text with a border on hover.
- Inputs and search: surface-2 ground, 1px border, 2px focus ring.
- Chips: 6px radius, 12px label, surface-2 ground; active chip uses accent-bg and
  accent text.
- Tabs and segmented controls: a single bordered track with the active segment on
  surface; no sliding pill animation.
- Status dots: 8px, semantic color, always paired with a written label.

## Truth and status language

- Zero is a known value and is rendered as `0`. Unknown is `—` plus `?` and an
  accessible "Unknown".
- `*` means stale source or snapshot. It always travels with "Needs checking" or
  an equivalent written explanation; never a bare asterisk.
- `?` means unknown or unverified. It is not a failure and never becomes `0`.
- "Needs checking" is the canonical label for unresolved community text, stale
  evidence, unknown waits and unverified availability.
- Do not invent thresholds, ratio rules, eligibility rules, recruiter activity,
  promotion dates or time-to-next-rank estimates. Use the tracker registry,
  saved goals and trackerpathways data as the only sources.
- Availability, eligibility, time gates and admission remain separate. Meeting a
  requirement never guarantees an invitation or admission.
- Source text remains readable. Do not parse `reqs` prose into numbers.

## Charts

Choose each chart by the question it answers, using IBM Carbon's
data-visualization guidance only. The visual treatment — surfaces, type, rules and
metric colors — follows this document and Yata. Remove any chart that does not
answer a real operator question.

- Totals sparklines: "which direction is this fleet metric moving?"
- Rank target bars: "how far is this account from this requirement?"
- No decorative charts, no dual-axis charts, no invented health scores.

## Motion

- 150–200ms ease-out for color, border and opacity only.
- No page-load choreography, parallax, glowing pulses or animated gradients.
- Sparklines may draw once on first paint; hold still under
  `prefers-reduced-motion`.
- No new animation without explicit approval.

## Accessibility

- WCAG AA is the floor. All shipped text pairs meet 4.5:1; large text meets 3:1.
- 12px minimum text. 44px minimum touch targets on mobile primary controls.
- Keyboard focus is always visible; focus order follows the visual order.
- Status is never color-only: written state, `n/4`, `?` or "Needs checking"
  accompanies every semantic color.
- Sparklines carry a text summary or accessible label; they are not the only read.
- Both themes pass the same contrast and state rules. Reduced motion is respected.
- Long tracker names, long classes and missing data must not create horizontal
  scroll at 390px.

## Do not copy

- The Yata name, wordmark, logo or brand voice.
- The seedbox bar.
- The theme switcher / theme cycler.
- Time-to-next-rank estimates or promotion dates.
- Yata's six-tile health row as a direct composition; this product uses the five
  tiles above.
- Yata CSS or assets copied wholesale. If any CSS is adapted later, record the
  source file in `docs/THIRD_PARTY_NOTICES.md`.

## Anti-reference

The replaced Cold Vault: mineral-white paper, deep forest rail, Barlow/Barlow
Condensed, oxide accents and square stamps. Also rejected: the older all-dark
neumorphic surface with cyan glows, pill tags and stacked rounded cards. Do not
split the difference by polishing either one.

## Provenance

Direction chosen from the Yata-Dash reference at commit
`d4692e33d2a72b22d828de956cbd468fc3075949` (GPL-3.0), studied through
`dashboard-grid`, `dashboard-table`, `card-targets`, `pathways` and
`static/dashboard.css`. The shape briefs are in `docs/YATA_REFERENCE_NOTES.md`.
This rewrite is documentation only; no application code or CSS was changed.
