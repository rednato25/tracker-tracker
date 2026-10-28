# Tracker Tracker — Design System

The dashboard must show in 3 seconds: total uploaded, total downloaded, overall ratio, and how far each tracker is from its next rank.

Status: active. Surface mode: **Operate**. Visual world: **Cold Vault**.

## Direction contract

**Thesis.** A working account register for a cold-storage vault. It refuses the
dashboard-card grid and the neon control room.

**Own-world.** Mineral-white paper, a deep green-black rail, oxide/amber/green
state inks, Barlow and Barlow Condensed for the working voice, Roboto Mono for
measurements, hairline rules, square stamps, no shadows and no pills.

**Story.** The operator sees which accounts are viable, which are losing
condition, and what leaves next. The register is the product, not a set of cards.

**First viewport.** A 248px dark vault rail with navigation and a compact drawer
index. The main column carries a 56px top bar, a 34px register title, a four-cell
account strip (total uploaded, total downloaded, overall ratio, need attention),
and a full-width account register. The primary action sits top right; the
signature four-segment status strip lives in the last column of every row. Ranks
and attention follow the register; fleet activity, leaderboard, ecosystem, tag
groups and chart cards start collapsed.

## Tokens

### Surfaces

| Token | Value | Use |
|---|---|---|
| `--color-rail` | `#1b2a24` | Sidebar, vault rail |
| `--color-rail-raised` | `#24372e` | Active nav, rail controls |
| `--color-rail-line` | `#34483d` | Rail rules |
| `--color-base` | `#eef2ed` | Page ground |
| `--color-raised` | `#f8faf6` | Registers, panels, cards |
| `--color-elevated` | `#e3e9e2` | Table heads, nested bands |
| `--color-control-bg` | `#f4f7f2` | Inputs and controls |

### Ink

| Token | Value | Use |
|---|---|---|
| `--color-primary` | `#17211c` | Headings, figures |
| `--color-secondary` | `#526159` | Body and labels |
| `--color-tertiary` | `#58675e` | Metadata |
| `--color-muted` | `#617067` | Disabled, placeholders |

### Status and data

| Token | Value | Meaning |
|---|---|---|
| `--color-accent` | `#9e3f1f` | Primary action, selection, due |
| `--color-success` | `#2f6f5e` | Healthy, viable |
| `--color-warn` | `#8a5a12` | Watch, nearing a limit |
| `--color-danger` | `#9f3428` | Critical, breached |
| `--color-upload` | `#2f6f5e` | Upload series |
| `--color-download` | `#2f5f83` / dark `#8fc7e8` | Download series; distinct from accent/due |
| `--color-positive` | `#2f6f5e` | Positive deltas |
| `--color-negative` | `#9f3428` | Negative deltas |
| `--color-neutral` | `#58675e` | Neutral series |

The ordinal chart scale is crimson, ochre, cold green, slate blue, umber, plum.

### Type

- **Barlow** — interface and body. Workhorse, slightly industrial, legible at 11–13px.
- **Barlow Condensed** — labels, buttons, column heads, stamps. Uppercase with
  `0.12–0.16em` tracking.
- **Roboto Mono** — figures, ids, timestamps, counts. Tabular numerals.

Page title: Barlow Condensed 36px/1.0, weight 600. Dashboard section heads and
column heads: 12px condensed, uppercase. Values: 13–14px mono with tabular
numerals; the top strip uses display numerals. No visible dashboard text below
12px. The 10px floor may remain only in non-dashboard chrome.

### Shape and elevation

- Radii: 2px (stamps and tags), 4px (controls), 6px (sheets), 8px (dialogs).
- Elevation is a **one-pixel rule**, never a glow. Floating surfaces get one soft
  offset shadow and one edge; nothing else.
- Cards are ruled sheets. Do not stack shadows, halos, or gradients.

## Layout

- App shell: 248px fixed rail; fluid main column; 56px top bar.
- Content max width: 1500px; page padding 16px mobile / 24px desktop.
- Register rows: 48px desktop, auto-height stacked rows below 768px.
- Summary strip: four cells separated by hairlines.
- Main scroll is the `main` element; the rail and top bar stay fixed in place.

## Components

### Account register

The dashboard's primary read. Columns: Account, Ratio, Buffer, Accounted,
Seeding, Login due, Rank, Status. The top strip reports total uploaded, total
downloaded, overall ratio and need attention; totals count only snapshots and
carry the shared stale marker. Rows preserve the user's order and carry a 6px
status square plus a written status label when the account is not healthy. Critical rows
tint `--color-danger-dim`; watch rows tint `--color-warn-dim`. The register shows
every account; the page scrolls, and the Today band follows the full register.
The rail is a deep forest green in light mode, not near-black; drawer controls
default to collapsed so the rail reads as navigation, not a control panel.

### Viability strip

Four equal segments, each a separate check: ratio, buffer, seeding, login window.
Green is viable, amber is close to a limit, red is failing, muted is unknown. The
mono `n/4` label is the non-color readout. Do not turn this into a sparkline or a
continuous percentage.

### Status marks

A 6px square plus a condensed uppercase label. Never a colored pill, never a
border-left thicker than 1px. Status is always written as well as colored.

### Buttons

Condensed uppercase, 10–11px, `0.1em` tracking. Primary is solid oxide; secondary
is a ruled sheet; ghost is text-only; danger is solid crimson. No scale bounce on
press; state changes are color and border only.

### Inputs, selects, toggles

Flat control ground with a 1px rule. Focus is a 1px oxide ring. Toggles are
squared-off tracks with a small square thumb; no pill switches. Labels are
condensed uppercase micro-type above the field.

### Cards, tables, tabs

Cards are bordered sheets with 16px padding. Tables use condensed column heads
and mono cells; no zebra striping. Tabs are an underline row, not a sliding pill.

### Dialogs and sheets

A sheet surface with one edge and one soft shadow. Titles use Barlow Condensed;
body copy stays 12–13px. Destructive actions are crimson, not decorative.

## Themes

- Light is the default. `data-theme="dark"` on `<html>` switches the semantic
  tokens; `theme` in `localStorage` persists the choice. A tiny before-paint
  bootstrap script applies the stored choice or the OS preference.
- The rail is always the darkest surface; in light mode it is a deep forest
  green (`#1b2a24`), not near-black. In dark mode the register, cards, and
  controls move to green-black paper (`#0f1713` / `#16211b`), with lighter status
  inks for contrast.
- Dark status inks: accent `#e07a4f`, success `#6fb79c`, warn `#d9a44a`, danger
  `#e06a58`. On-accent text flips to near-black via `--color-on-accent`.
- `--color-download` is a distinct data blue (`#2f5f83` light, `#8fc7e8` dark),
  not the accent/due color; both pass WCAG AA on the page/raised surfaces.
- ECharts reads the token colors through CSS variables at option build. The
  toggle reloads once so every canvas is rebuilt with the new palette.
- Both themes must pass the same contrast and state rules; dark mode is not a
  filter over light mode.

## Motion

- 150–200ms ease-out for color, border, and opacity.
- The viability strip may fill once on first paint; it must hold still under
  `prefers-reduced-motion`.
- No page-load choreography. No pulsing glows. Status dots may breathe at low
  opacity, never with a halo.

## Responsive

- Below 768px the rail becomes an overlay drawer; the top bar gets a floating
  menu trigger and 56px left clearance.
- The register becomes stacked account rows: identity and status first, then a
  two-column metric grid, then the viability strip.
- The summary strip becomes a 2×2 grid.
- The sidebar's drawer controls collapse into a ruled light panel inside the rail.

## Accessibility

- Every status has a text label or a numeric `n/4` readout; color is never the
  only channel.
- Focus rings are visible on rail and paper surfaces.
- Body contrast: primary on base ≥ 12:1; secondary on base ≥ 5:1.
- Live regions are not used for decorative motion. Reduced motion is respected.

## Audit

Automated Playwright audit, 1440×900 and 390×844, dashboard / settings / tracker
detail, both themes:

- WCAG AA text contrast: **0 failures** in light and dark across the audited
  pages.
- No horizontal overflow; heading order is clean; form controls are labelled;
  meaningful images carry alt text (one decorative asset is intentionally empty).
- The dashboard type floor is 12px; body copy is 12–13px and values 13–14px.
- Interactive targets meet the WCAG 2.2 24×24 minimum on the primary controls;
  44×44 is not universal because this is a dense desktop operator surface.
  Mobile nav rows and the floating trigger get extra height.
- Remaining audit areas: keyboard focus order, 200% zoom/reflow, forced-colors
  mode, screen-reader chart summaries, long-string stress, i18n/RTL, and the
  error/empty states that require live tracker failures.

## Anti-reference

The previous all-dark neumorphic surface: cyan accents, glow shadows, pill tags,
rounded cards stacked in a grid, and a tracker list as the only navigation. Do
not reintroduce any of those as "polish."

## Provenance

Direction chosen from the Cold Vault mock in the Impeccable decision round
(assigned direction, seed `ea4e2716`). The shipped screens are captured in the
review directory for this session; the register is code-led from the same
composition.
