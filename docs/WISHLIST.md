# Tracker pathways (P18/P30/P31)

The Tracker pathways page lives at `/pathways`; `/wishlist` redirects there. P18
added the planning surface, P30 expanded it to the complete trackerpathways
dataset, and P31 simplified it into two sections. It is not an application flow:
no tracker request, message, invitation or automatic action is sent.

## User flow

1. **Your trackers** lists each account you own with its current class, account
   age and number of direct trackerpathways leads. An owned tracker that is not
   in the dataset says "Not in trackerpathways data" and shows nothing else.
2. **Get to a tracker** is a searchable picker over trackerpathways names you do
   not own. The saved destination is stored as a trackerpathways ID; legacy
   registry-slug targets migrate on read. Previously selected targets remain
   available as switchable chips for the session.
3. The fastest known route is shown as a chain of steps with total time left at
   the top. Each step shows the tracker, the invite class it needs and "Ready
   now", "N days left" or "Unknown". A step on a tracker you do not own yet uses
   the full wait after joining.
4. Source text, `reqs`, structured conditions, availability, evidence notes and
   stale notices sit behind one closed **Details** toggle per step.
5. Other routes stay collapsed under **Other routes (N)**, with at most five
   listed.
6. If there is no route, the page says "No known route from your trackers." The
   picker footer links to trackerpathways for missing trackers.

The page keeps the tracker-detail width and header placement for now; a full
width audit is a separate task.

## Uncertainty is intentionally visible

- Community `reqs` prose stays readable and is never parsed into thresholds.
- `days` is shown as the minimum time on the source tracker, labelled
  "per trackerpathways". It is not converted into a rank condition.
- A source account the user owns gets its account age from `joinedAt`, so the
  step shows the days remaining. An unknown account age stays unknown. A
  scenario step shows the requirement as-is.
- Source `unlockInviteClass` text is shown for every source step that has it, as
  an unresolved invite-class/forum gate.
- Closed routes (`active: "No"` or `"Closed"`) are excluded from suggested
  paths. `Limited` and `Unknown` availability remain unconfirmed.
- Requirement eligibility is separate from the time gate, recruitment
  availability and invitation/admission. There is no "ready to apply",
  guaranteed admission or promotion date.
- Unknown availability is never rendered as ready-to-apply.

The page explains what needs checking instead of repeating a bare "Unknown"
badge. Examples: "Source invite/forum gate", "Time on source", "Source text",
"Availability unconfirmed".

## Evaluation rules

The page reuses `evaluateRecruitmentRoute` from P17 without duplicating its
condition logic.

- A step whose source account is owned is evaluated against that tracker's stored
  observations and `joinedAt`. Stale or missing stored data stays unknown.
- A step whose source account is not owned is a **Scenario**; no personal
  observations are applied, and later steps are not treated as satisfied by
  reaching an earlier step.
- The path time gate is
  `sum(max(route days, source forum days))` across the path, matching upstream's
  route search.
- Paths are collected from every owned tracker before any cap, then ranked by
  total days remaining: the first hop uses the days remaining from your account
  age, later hops use the full step wait, and unknown waits rank after known
  ones. Ties use fewer hops. Per-source and total caps are applied only after
  ranking, so a faster route from a later source is not dropped.
- The first step is not a guarantee that the next account can be obtained.
- Saved goal links require an exact metric/comparison/required-value match with a
  structured condition in an existing saved rank goal. The shipped community
  catalog has no structured conditions, so the control appears only when a
  validated override supplies one.

## Page states

- No target selected.
- Target already owned.
- Owned tracker absent from trackerpathways data.
- No known route: "No known route from your trackers."
- Missing or stale stored observations on an owned source.
- Source gate, minimum source time and readable prose behind a closed Details
  toggle.
- Stale goal links or saved references after a catalog/tracker change are
  ignored defensively; they do not crash the page.

## Manual acceptance

The current catalog has a direct route `AlphaRatio -> BroadcasTheNet`
(`tp:AlphaRatio:BroadcasTheNet`). Use the **AlphaRatio** fixture tracker as the
owned source and **BroadcasTheNet** as the target. No route data was changed to
fit this guide.

1. Confirm the isolated fixture instance has AlphaRatio with a registry match,
   then open `/pathways`. Confirm `/wishlist` redirects there.
2. Search for **BroadcasTheNet** and select it. Reload; confirm the target is
   still selected.
3. Confirm **Your trackers** shows AlphaRatio with its class, account age and
   direct lead count. A tracker without a trackerpathways match shows only
   "Not in trackerpathways data".
4. Confirm the fastest route is a chain with total time left at the top. Each
   step shows the tracker, invite class and Ready now / N days left / Unknown.
5. Confirm every **Details** toggle is closed by default. Opening one reveals
   source text, `reqs`, availability, evidence dates and stale notices.
6. Confirm **Other routes (N)** is closed and lists no more than five routes.
7. Set the viewport to 390px; confirm the Tracker pathways title clears the
   navigation control and long text wraps.

## Persistence, backup and restore

Migration `0006_recruitment_state` adds one nullable `app_settings.recruitment_state`
JSON text column. P30 stores state version 2:

```json
{
  "version": 2,
  "desiredTrackerSlug": "TorrentLeech",
  "hiddenPathKeys": ["tp:AlphaRatio:BroadcasTheNet"],
  "goalLinks": [
    {
      "routeId": "tp:TorrentLeech:BroadcasTheNet",
      "conditionId": "source-age",
      "sourceTrackerSlug": "torrentleech",
      "goalTrackerSlug": "torrentleech",
      "targetRank": "Power User",
      "metric": "accountAgeDays",
      "comparison": "gte",
      "requiredValue": 14
    }
  ]
}
```

The field name `desiredTrackerSlug` is kept for compatibility, but it now holds a
trackerpathways ID. A saved version-1 registry slug (for example
`"torrentleech"`) is migrated to its upstream name (`"TorrentLeech"`) by the same
normalizer used on read, on write and in the restore route, so existing targets
survive the upgrade. There is no separate migration step.

Goal links keep registry slugs because saved rank goals are registry-based.
Hidden path keys and goal links may become stale after a route-catalog update;
they are treated as inert until they match a current path/condition. Restore
sanitizes the recruitment JSON with `normalizeRecruitmentState`; existing backup
exports carry the column automatically.

The API is `GET/PUT /api/recruitment/wishlist` and requires the normal session. It
does not accept integration tokens and does not contact a tracker.

## Validation

- P30 tests cover selecting an unregistered destination, a two-hop path through
  an unregistered tracker, route/forum day maximums and path sums, days remaining
  from account age, unknown account age, inactive-route exclusion, fastest-first
  ranking across sources, cap-after-ranking, unknown-wait ordering, the full
  trackerpathways catalog and malformed-file rejection by the update script.
- Synthetic fixtures provide met/unmet/unknown scenarios. No production route was
  invented or upgraded to verified.
- Visual evidence from the authenticated E2E run, using a temporary owned
  AlphaRatio row and the real pinned catalog:
  `visual-pathways-light.png` and `visual-pathways-dark.png` at 1440px, plus
  `visual-pathways-mobile.png` and `visual-pathways-mobile-dark.png` at 390px.
  The test removes the row and clears the saved state afterwards.

## Limitations

- Community `reqs` prose remains unknown; class, ratio, upload and seed-size
  requirements are not parsed.
- Upstream `days` and `unlockInviteClass` gates remain community data, not
  verification.
- Trackers without a unique registry match cannot start a path from an owned
  dashboard account, but they remain usable as targets and intermediate hops.
- No graph visualization; P19 search is a separate surface. No private-forum
  access, recruiter messages, applications or automatic actions.
- Removing a tracker can leave a stale saved goal link; it is ignored and cannot
  crash the page.
