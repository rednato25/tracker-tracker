# Wishlist and Recruitment Pathways (P18)

P18 adds a compact list-based wishlist page at `/wishlist`. It is a planning
surface, not an application flow: no tracker request, message, invitation or
automatic action is sent.

## User flow

1. Pick one desired tracker and save it. The destination is stored as a registry
   slug.
2. The page finds direct and bounded multi-step routes from trackers the user
   already owns (maximum four hops, five paths per source, twenty paths total).
3. Each step shows source → destination, structured conditions, unresolved
   source text, the source invite/forum gate, availability, evidence dates and
   attribution.
4. Hide a route path to remove it from the list; show hidden paths again from the
   same page.
5. When a step has a validated structured condition that exactly matches a
   condition in an existing saved rank goal, link it. The link stores registry
   slugs and the target rank, not database ids.

## Uncertainty is intentionally visible

P17's catalogue semantics are preserved:

- All 194 community edges currently have unknown overall eligibility.
- Upstream `days` is shown as an unresolved wait value, never as account age.
- Source `unlockInviteClass` text is shown as an unresolved invite-class/forum
  gate.
- Free-text ratio/upload/class requirements stay readable; nothing is parsed into
  a threshold.
- Closed routes remain closed. `Limited` availability remains unconfirmed.
- Requirement eligibility is separate from recruitment availability and from
  invitation/admission. There is no "ready to apply", guaranteed admission,
  promotion date or completion percentage.
- Unknown availability is never rendered as ready-to-apply.

The page explains what needs checking instead of repeating a bare "Unknown"
badge. Examples: "Source invite/forum gate", "Upstream wait", "Source text",
"Availability unconfirmed".

## Evaluation rules

The page reuses `evaluateRecruitmentRoute` from P17 without duplicating its
condition logic.

- A step whose source account is owned is evaluated against that tracker's stored
  observations. Stale or missing stored data stays unknown.
- A step whose source account is not owned is a **Scenario**; no personal
  observations are applied, and later steps are not treated as satisfied by
  reaching an earlier step.
- The first step is not a guarantee that the next account can be obtained.
- Saved goal links require an exact metric/comparison/required-value match with a
  structured condition in an existing saved rank goal. The shipped community
  catalogue has no structured conditions, so the control appears only when a
  validated override supplies one.

## Page states

- No destination selected.
- Destination already owned.
- No owned tracker with a registry identity.
- Destination absent from the pinned catalogue: "No catalog coverage", never
  "no route exists".
- No known route from owned accounts: "No known route", with the same caveat.
- All matching paths hidden.
- Missing or stale stored observations on an owned source.
- Source gate, undocumented days and readable prose that still need checking.
- Hidden path count and the control to show them again.
- Stale goal links or saved references after a catalogue/tracker change are
  ignored defensively; they do not crash the page.

## Persistence, backup and restore

Migration `0006_recruitment_state` adds one nullable `app_settings.recruitment_state`
JSON text column. The stored state is:

```json
{
  "version": 1,
  "desiredTrackerSlug": "torrentleech",
  "hiddenPathKeys": ["tp:alpharatio:broadcasthenet"],
  "goalLinks": [
    {
      "routeId": "tp:torrentleech:broadcasthenet",
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

All tracker references are registry slugs, so backup/restore can remap database
tracker ids without breaking wishlist references. Hidden path keys and goal links
may become stale after a route-catalogue update; they are treated as inert until
they match a current path/condition. The restore route sanitizes the string with
the same normalizer used by the API. Existing backup exports carry the new column
automatically.

The API is `GET/PUT /api/recruitment/wishlist` and requires the normal session. It
does not accept integration tokens and does not contact a tracker.

## Validation

- 25 P18-focused tests cover direct/multi-step paths, cycles, closed routes,
  unresolved gates/days, stale and missing observations, unsupported coverage,
  hidden paths, goal-link compatibility, state normalization, API persistence,
  and backup/restore slug preservation. Full suite on Node 24: 252 files /
  6190 tests passed.
- Synthetic fixtures provide met/unmet/unknown scenarios. No production route was
  invented or upgraded to verified.
- Visual evidence: `visual-wishlist-light.png`, `visual-wishlist-dark.png`,
  `visual-wishlist-mobile.png` from the authenticated E2E run, using a temporary
  owned AlphaRatio row and the real pinned catalogue. The test removes the row and
  clears the wishlist state afterwards.

## Limitations

- 117 unresolved upstream tracker names remain omitted; no aliases are guessed.
- Prose ratio/class/upload/seed-size requirements remain unknown.
- Upstream `days` and `unlockInviteClass` gates remain unresolved.
- No graph visualization, P19 search, private-forum access, recruiter messages,
  applications or automatic actions.
- Removing a tracker can leave a stale saved goal link; it is ignored and cannot
  crash the page.
