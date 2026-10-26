# Recruitment Routes (P17)

P17 defines an offline, versioned recruitment-route format and a deterministic
evaluator. It does not add a wishlist UI, search, outbound applications or
recruiter messages. P18 owns the UI.

## Source coverage and reuse

Yata-Dash's Pathways feature uses the community
[trackerpathways](https://github.com/handokota/trackerpathways) dataset. Yata-Dash
itself is GPL-3.0; its `defs/pathways/routes.json` is a converted derivative. This
project did **not** copy Yata code or its converted file. It read the upstream
dataset directly, whose actual reuse terms are MIT:

- Upstream: `trackerpathways`
- License: MIT, Copyright (c) 2025 Handoko Tejo Atmoko
- Pinned commit: `5e3b206ed1352b56a685b90ec8da3757f702c3eb`
- Snapshot URL: `https://raw.githubusercontent.com/handokota/trackerpathways/5e3b206ed1352b56a685b90ec8da3757f702c3eb/src/data/trackers.json`
- Snapshot accessed: `2026-10-26T00:00:00.000Z`
- Attribution is carried in `RECRUITMENT_SOURCE` and
  `docs/THIRD_PARTY_NOTICES.md`.

The upstream snapshot has 598 route edges across 64 destinations. P17 includes
the **194 edges** whose source and destination both resolve to a production
tracker registry slug. Names that do not resolve are omitted rather than guessed:
117 community names remain unresolved, including trackers outside the current
production registry and draft-only entries. The static catalog lives in
`src/data/recruitment-routes.ts`; 23 source-side invite/class/forum gates from
the same snapshot live in `src/data/recruitment-gates.ts`. Nothing fetches the
dataset at render time.

## Format

Each route has a stable ID (`tp:<source-slug>:<destination-slug>`), registry
source/destination IDs, structured requirements, readable notes, availability,
source update date, and source attribution from the catalog.

Structured requirements exist only where the source field is explicit **and its
meaning is documented**. Upstream's `days` field is only described as an unnamed
"Days" wait/sort value; it is not documented as account age. P17 therefore keeps
`sourceDays` as an unresolved prerequisite rather than converting it into an
`accountAgeDays` threshold. This follows the upstream API/source, not Yata's
different interpretation.

Every `reqs` string stays a readable note, even when it mentions ratio, uploads
or a class. Prose is never parsed into invented thresholds. Mandatory prose,
unresolved `sourceDays`, and a source invite-class/forum gate are inserted as
manual `unknown` leaves. A route with only these prerequisites evaluates as
`unknown`, not `met`.

Three dates are intentionally distinct:

- `sourceUpdatedAt` / `sourceUpdatedRaw`: the community data's own month, e.g.
  `2026-06` / `Jun 2026`.
- `sourceAccessedAt`: when this project took the snapshot. This is not a
  verification date.
- `lastVerifiedAt`: only present for a dated local override. Community routes
  have `null`.

`sourceFreshness` is `fresh` while the community update is at most 180 days old,
otherwise `stale`; unknown if the date is missing. `evidenceFreshness` is
`unknown` for all unverified community records and `fresh`/`stale` only for a
dated override. A recently accessed page is never reported as recently verified.

## Eligibility, availability and invitation

- `eligibility` is `met`, `unmet` or `unknown`, with ALL/ANY progress and the
  existing rank-condition semantics reused. Missing or stale observations remain
  unknown. Mandatory prose, unresolved `sourceDays`, and the source
  invite-class/forum gate are unresolved manual leaves. Under ALL, a known unmet
  condition still wins (`unmet`); otherwise any unresolved leaf makes the overall
  result `unknown`. `sourceRequirements` exposes the gate and
  `daysSemantics: "unresolved" | "absent"`.
- `availability` is `open`, `closed` or `unknown` from the community `active`
  field. `Limited` maps to unknown rather than a guessed open state. Community
  availability is always `confirmed: false`.
- `invitation.guaranteed` is always `false`; `activeRecruiter` and `admission`
  are always `unknown`. Meeting requirements never proves a recruiter exists,
  guarantees an invitation, or implies admission. Unknown availability is never
  presented as ready-to-apply.

## Local overrides

`src/data/recruitment-overrides.ts` is the smallest mechanism: a reviewed code
change, not a new editor UI or database table. Every override requires an author,
authoring date, provenance URL and verification date. It may replace availability,
structured requirements or readable notes. Evaluation exposes the effective
values plus `originalStatus` / `originalRequirementNotes`, so the community source
record is preserved. Overrides win only for the fields they declare. An override
can turn reviewed prose into structured requirements, or clear it, but
`sourceDays` and the source invite gate remain unresolved unless the source has
no such prerequisite.

Validation rejects duplicate route IDs/pairs, unknown tracker slugs, self-routes,
malformed dates, duplicate overrides, and overrides missing an author or
provenance. The shipped override list is empty.

## Path traversal

`findRecruitmentPaths` is a bounded depth-first search (default six hops) with a
visited-tracker set, so cycles cannot cause infinite traversal. It returns route
IDs only; it does not evaluate or mutate anything.

## Representative offline results

Using the shipped catalog and a synthetic observation of 5,000 account-age days:

| Route | Eligibility | Availability | Evidence |
| --- | --- | --- | --- |
| `tp:broadcasthenet:passthepopcorn` | `unknown` (days + gate + prose unresolved) | `closed` | source fresh (`Aug 2026`), independently verified `unknown` |
| `tp:alpharatio:broadcasthenet` | `unknown` (source gate + `Invite forum access`) | `open` | source fresh (`Mar 2026`), independently verified `unknown` |
| `tp:luminarr:nebulance` | `unknown` (days + source gate) | `unknown` (`Limited`) | source fresh (`Jun 2026`) |
| `tp:aither:broadcasthenet` | `unknown` (source gate + prose) | `open` | source stale (`Nov 2024`), independently verified `unknown` |

Every shipped community route is `unknown` for eligibility because its `days`,
prose or source gate is unresolved. A closed route remains closed even if a
future override resolves all requirements. Synthetic regressions additionally
prove: age met + mandatory prose unknown => overall `unknown`; age unmet +
mandatory prose unknown => overall `unmet`; and source gate unknown => overall
`unknown` even with a met structured age.

## Limitations

- Upstream `days` semantics are undocumented beyond "Days"; P17 does not
  interpret them as account age or any other threshold.
- Community `reqs` prose is not structured; class, ratio, upload and seed-size
  requirements remain unknown until a local override supplies validated structured
  data.
- Source `unlockInviteClass` gates are preserved as unresolved prerequisites; they
  are not evaluated or treated as satisfied.
- 117 upstream names are unresolved and omitted; no aliases are guessed.
- No automatic applications, messages, scraping, credentials or effect on tracker
  polling. No runtime dataset fetch, migration or backup change.
- P18 UI, P19 search and deployment are out of scope.
