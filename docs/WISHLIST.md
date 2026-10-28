# Wishlist and Recruitment Pathways (P18/P30)

P18 adds a compact list-based wishlist page at `/wishlist`. P30 expands it to
the complete trackerpathways dataset. It is a planning surface, not an
application flow: no tracker request, message, invitation or automatic action is
sent.

## User flow

1. Pick one desired tracker from every trackerpathways name and save it. The
   destination is stored as a trackerpathways ID; legacy registry-slug targets
   are migrated on read.
2. The page finds direct and bounded multi-step routes from trackers the user
   already owns (maximum four hops, five paths per source, twenty paths total).
   Unregistered trackerpathways names can be destinations and middle hops.
3. Each step shows source → destination, structured conditions, readable `reqs`
   text, the full `unlockInviteClass` text when present, minimum source time,
   availability, evidence dates and attribution.
4. Hide a route path to remove it from the list; show hidden paths again from the
   same page.
5. When a step has a validated structured condition that exactly matches a
   condition in an existing saved rank goal, link it. The link stores registry
   slugs and the target rank, not database ids.

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
- The first step is not a guarantee that the next account can be obtained.
- Saved goal links require an exact metric/comparison/required-value match with a
  structured condition in an existing saved rank goal. The shipped community
  catalog has no structured conditions, so the control appears only when a
  validated override supplies one.

## Page states

- No destination selected.
- Destination already owned.
- No owned tracker matched to a trackerpathways name.
- Destination absent from the pinned catalog: "No catalog coverage", never
  "no route exists".
- No known route from owned accounts: "No known route", with the same caveat.
- All matching paths hidden.
- Missing or stale stored observations on an owned source.
- Source gate, minimum source time and readable prose that still need checking.
- Hidden path count and the control to show them again.
- Stale goal links or saved references after a catalog/tracker change are
  ignored defensively; they do not crash the page.

## Manual acceptance

The current catalog has a direct route `AlphaRatio -> BroadcasTheNet`
(`tp:AlphaRatio:BroadcasTheNet`). Use the **AlphaRatio** fixture tracker as the
owned source and **BroadcasTheNet** as the destination. Aither reaches this
destination through intermediates, so do not expect a direct Aither step. No
route data was changed to fit this guide.

1. Confirm the isolated fixture instance has AlphaRatio with a registry match,
   then open `/wishlist`.
2. Select **BroadcasTheNet** and save. Reload the page; confirm the destination is
   still selected.
3. Inspect the direct **AlphaRatio to BroadcasTheNet** route. AlphaRatio is your
   fixture account, so that step is marked **Your account**. The step shows the
   source invite/forum gate text and the minimum time labelled
   "per trackerpathways". If a multi-step path through an unowned intermediate
   appears, it is marked **Scenario** and is not evaluated against your data.
4. Confirm the unresolved text is shown separately from availability: readable
   `reqs`, the full `unlockInviteClass` text, the stale source update, and
   community availability (open/closed/unconfirmed). No step should claim "ready
   to apply" or a guaranteed invitation.
5. Hide the route. Reload; confirm it stays hidden and the hidden-path count is
   shown. Use "Show hidden routes" and confirm the path returns.
6. Set the viewport to 390px; confirm the Wishlist title clears the navigation
   control, long source text wraps, and Hide/Show controls remain reachable.
7. The **goal-link control is legitimately absent** for this fixture route. The
   community route has no structured condition, only prose, the source gate and
   the minimum days, so there is no exact match with an existing saved rank goal.
   Its absence is not a UI failure.

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
  from account age, unknown account age, inactive-route exclusion, the full
  trackerpathways catalog and malformed-file rejection by the update script.
- Synthetic fixtures provide met/unmet/unknown scenarios. No production route was
  invented or upgraded to verified.
- Visual evidence from the authenticated E2E run, using a temporary owned
  AlphaRatio row and the real pinned catalog:
  `visual-wishlist-light.png` and `visual-wishlist-dark.png` at 1440px, plus
  `visual-wishlist-mobile.png` and `visual-wishlist-mobile-dark.png` at 390px.
  The test removes the row and clears the wishlist state afterwards.

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
