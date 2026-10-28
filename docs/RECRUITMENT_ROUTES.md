# Recruitment Routes (P17/P30)

P17 defines an offline, versioned recruitment-route format and a deterministic
evaluator. P30 replaces the registry-filtered subset with the complete
trackerpathways snapshot so unmatched trackers can still be destinations or
middle hops. P18 owns the Tracker pathways page.

## Source coverage and reuse

The Tracker pathways page uses the community
[trackerpathways](https://github.com/handokota/trackerpathways) dataset directly.
It is MIT-licensed, and the snapshot is vendored unchanged:

- Upstream: `trackerpathways`
- License: MIT, Copyright (c) 2025 Handoko Tejo Atmoko
- Pinned commit, fetch date and license: `src/data/pathways/metadata.json`
- Vendored file: `src/data/pathways/trackers.json`
- Adapter: `src/data/pathways/catalog.ts`
- Attribution: `docs/THIRD_PARTY_NOTICES.md` and the Tracker pathways page

The current snapshot has 598 route edges across 64 destinations, 182 tracker
names and 61 source invite-class/forum gates. Nothing fetches the dataset at
render time. Refresh it only through the pinned update script:

```bash
pnpm pathways:update            # latest upstream main
pnpm pathways:update <commit>   # an explicit commit
```

The script fetches `src/data/trackers.json`, validates the expected shape,
writes the dataset and metadata together, and prints added/removed trackers and
routes. Invalid data is rejected before anything is written.

Tracker IDs inside the catalog are trackerpathways names. A registry slug is
attached only where a name/slug/abbreviation match is unambiguous. Names that do
not match stay usable as route sources, destinations and middle hops. The 194
routes whose ends both match the production registry are preserved from P17.

## Format

Each route has a stable ID (`tp:<source-name>:<destination-name>`, URL-encoded),
trackerpathways source/destination IDs, optional registry slugs, structured
requirements, readable notes, a minimum source time, availability, source update
date, and source attribution from the catalog.

- `minimumDays` is the upstream `days` value: the minimum time on the source
  tracker before the route opens.
- `requirementNotes` keeps `reqs` verbatim. Prose is never parsed into invented
  thresholds or structured rank conditions.
- `availability` maps `active: "Yes"`/`"open"` to open and
  `active: "No"`/`"Closed"` to closed. `Limited`, `Unknown` and any other value
  remain unconfirmed (`unknown`), never "ready to apply".

Upstream `days` is not a rank condition. The evaluator exposes it as a separate
time gate, computed per step as
`max(route.minimumDays, sourceGate.days)` and summed along a path. This mirrors
upstream's own route search (route days versus forum days). Where the user owns
the source account, account age from `joinedAt` gives the days remaining;
otherwise the requirement is shown as-is and the status stays unknown.

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
  unknown. Mandatory `reqs` prose and the source invite-class/forum gate are
  unresolved manual leaves. Under ALL, a known unmet condition still wins
  (`unmet`); otherwise any unresolved leaf makes the overall result `unknown`.
  The time gate is reported separately in `timeGate` and does not silently
  change rank eligibility.
- `sourceRequirements.inviteGate` carries the complete `unlockInviteClass`
  `[days, text]` entry for the source step. The text is always shown; it is not
  evaluated or replaced with a badge-only summary.
- `sourceRequirements.daysSource` is `"trackerpathways"` for the minimum-days
  value.
- `availability` is `open`, `closed` or `unknown` from the community `active`
  field. Community availability is always `confirmed: false`. Closed routes are
  excluded from suggested paths but remain visible if evaluated directly.
- `invitation.guaranteed` is always `false`; `activeRecruiter` and `admission`
  are always `unknown`. Meeting requirements never proves a recruiter exists,
  guarantees an invitation, or implies admission.

## Local overrides

`src/data/recruitment-overrides.ts` is the smallest mechanism: a reviewed code
change, not a new editor UI or database table. Every override requires an author,
authoring date, provenance URL and verification date. It may replace availability,
structured requirements or readable notes. Evaluation exposes the effective
values plus `originalStatus` / `originalRequirementNotes`, so the community source
record is preserved. Overrides win only for the fields they declare.

Validation rejects duplicate route IDs/pairs, unknown tracker IDs, self-routes,
malformed dates, duplicate overrides, and overrides missing an author or
provenance. The shipped override list is empty.

## Path traversal

`findRecruitmentPaths` is a bounded depth-first search (default six hops) with a
visited-tracker set, so cycles cannot cause infinite traversal. It returns route
IDs only; it does not evaluate or mutate anything. Closed routes are skipped
unless `includeClosed` is explicitly requested. The Tracker pathways page collects candidates
from all owned sources, ranks them by total known wait and then fewer hops, and
applies its caps only after ranking.

## Limitations

- Community `reqs` prose is not structured; class, ratio, upload and seed-size
  requirements remain unknown until a local override supplies validated
  structured data.
- Source `unlockInviteClass` gates are preserved as readable text and unresolved
  prerequisites; they are not evaluated.
- Unmatched trackerpathways names are usable, but they cannot be identified with
  an owned dashboard account until the registry contains a unique match.
- No automatic applications, messages, scraping, credentials or effect on tracker
  polling. No runtime dataset fetch.
- P18 UI, P19 search and deployment are out of scope.
