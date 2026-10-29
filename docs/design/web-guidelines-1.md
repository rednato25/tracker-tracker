# Design check 1 — web interface guidelines

Reviewed the merged shell, register, pathways, tracker detail and settings against
the Vercel Web Interface Guidelines fetched 2026-10-29.

## Fixed

- `src/components/tracker-detail/RankGoalPanel.tsx`, `DownloadBudgetPanel.tsx`,
  `settings/DigestSection.tsx`: `bg-field` was not a defined token; native
  selects had no explicit surface. Replaced with `bg-control-bg`.
- `src/app/globals.css`: dark mode did not set `color-scheme`; native controls and
  scrollbars could stay light. Added light/dark `color-scheme`.
- `src/components/ui/{Input,AreaInput,Toggle,Checkbox,ProgressBar}.tsx`: replaced
  `transition-all` with explicit properties.
- Updated `ProgressBar` test to assert the explicit transition.

## Decisions for you

- **Pull-to-refresh:** `html { overscroll-behavior: none }` follows the
  mobile-native baseline but suppresses coarse-pointer pull-to-refresh. Move it
  behind `(pointer: fine)` if browser refresh should remain available.
- **State in URLs:** settings tabs, rank-target selection and the (unmerged)
  dashboard view are local state, not query params. Deep-linking is a product
  decision.
- **Picker autofocus:** the Pathways search input autofocuses after the user
  opens the picker. Keep it for keyboard speed or drop it on coarse pointers.
- **Long identifiers:** the register's mobile name still truncates without a
  full-name affordance. Wrap or reveal, per the break-ui decision.
- **Hardcoded dates/numbers:** several surfaces still format dates/numbers
  outside `Intl.*`. This is a broader refactor, not a single clear break.

## Held

- Icon-only header actions have labels; skip link, heading order and focus rings
  are present.
- No zoom blocking, no paste blocking, no clickable `div` navigation.
- Empty states and dark-mode theme colors are present.
