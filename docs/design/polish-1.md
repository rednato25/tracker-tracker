# Design check 1 — polish

Scope: merged shell, register, pathways, tracker detail and settings. Preserved the
Night Grid world; no content or new features.

## Fixed

- `Button`: labels no longer wrap mid-label at 390px (for example `POLL NOW`).
- `TrackerHubStatus`: the status panel is now full-width on phones, and the
  header/stats rows wrap instead of clipping `Powered by TrackerHub`.
- Register mobile metric grid, corrupt glyphs and stale wording were fixed in the
  break-ui step.
- Core form/control transitions now name their properties; dark mode declares
  `color-scheme`.

## Deliberately left

- Settings forms still use the full 1600px frame on desktop. Narrowing them is a
  layout decision for the user, not a defect.
- The P32b/c/d restyles are not on `main`; this pass did not pull those branches
  into the comparison.
- Long mobile names still truncate; see the break-ui decisions.
- The Pathways owned-tracker list remains unbounded; see the break-ui decisions.
