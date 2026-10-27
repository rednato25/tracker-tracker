# Product Priorities and Revised Roadmap

Tracker Tracker is an account-monitoring and progression dashboard. Prowlarr and
qBittorrent remain responsible for searching and adding torrents. Search and
comparison are optional surfaces, not the product centre.

## Priority map

| Priority | Already implemented | Actual gap | Smallest useful next change |
| --- | --- | --- | --- |
| Per-tracker ratio, buffer, accounted upload/download, seeding and bonus | Adapters and snapshots collect these fields where the source exposes them; tracker detail shows seedbonus cards/charts; the register shows ratio, buffer and seeding | Accounted upload/download and current bonus points are absent from the compact register; adapter coverage differs (e.g. BTN has no seeding/bonus) | P25: add upload, download and bonus cells to the existing register, showing `—`/unknown for unsupported or missing values |
| Freshness, missing data and account attention | P03 provenance, P04 deterministic actions, P05 attention surface, stale/ratio/zero-seed alerts, per-step evidence | Metric-level missing/stale state is not visible in the register; attention is action-oriented | P25: add a per-row freshness/missing marker sourced from `lastPolledAt` and null metrics; no new polling |
| Observed rank, next-rank requirements and remaining progress | P09 evaluator; P10 TorrentLeech pilot rules (others unknown); P11 tracker-detail goal panel; dashboard rank stacks/progress | Next-rank requirements/progress live mainly on tracker detail; P10 coverage is deliberately incomplete | A bounded dashboard next-rank summary reusing P09/P11, without new rules or inferred branches |
| Wishlist and recruitment pathways | P17/P18 delivered and P18 owner-accepted; one destination, bounded paths, hide/show, explicit unknown state and exact-match goal links | 117 upstream names and most prose requirements remain unresolved; dataset is intentionally static | No change now; keep optional and preserve unknown semantics |
| Useful Telegram alerts and digests | P06 Telegram delivery; P08 scheduled digest/quiet hours/durable state/Settings; local mock validation | Digest is primarily a P04 action summary; it does not yet include monitoring or rank-progress context | After P25, add a bounded monitoring section to the existing digest; reuse existing targets/dispatch |
| Optional search and comparison | P19 search and P20 comparison delivered; both owner-accepted | Quality/language preferences, normal-charge source data and release-level obligations are not modeled | Keep as optional; do not remove or redesign |
| P24 bonus planning | Seedbonus is stored and shown on tracker detail; bonus-cap warning exists for MAM | No verified exchange catalogue, cap/class/cooldown rules or planner | Keep bonus **visibility** in P25; defer the exchange planner until verified per-tracker sources exist |

## Roadmap disposition

- **P21:** deferred / out of current scope. No torrent-add, grab, magnet, download
  or client mutation flow.
- **P22/P23:** deferred. Storage cleanup and space-release candidates are not a
  current priority; no destructive actions.
- **P24:** narrowed to relevant bonus monitoring/planning only. Do not compare or
  spend points across trackers; no automatic purchases.
- **Search/comparison (P19/P20):** remains available, optional and read-only. Do
  not remove or redesign it in the monitoring work.
- **Monitoring/progression:** per-tracker account health, rank progress, wishlist
  and useful Telegram digests are the current priorities.

## Adopted next implementation (P25)

**Adopted as P25: complete the monitoring register.** Add three fields to the
existing dashboard `TrackerRegister` row — accounted upload, accounted download
and current bonus points — plus a compact missing/stale marker on those metric
cells. Reuse `latestStats` and `lastPolledAt`; do not add adapters, schema,
polling, derived bonus estimates or new metric guesses. Unsupported/missing
values remain `—`/unknown, never zero. Add focused register tests for present,
null and stale values. This directly improves the primary dashboard and supports
P24 monitoring without starting the exchange planner.

## P20 acceptance note

P20 owner acceptance on the isolated image is recorded in
`docs/IMPLEMENTATION_STATUS.md`. Normal-charge 1.0 arithmetic is deterministic
fixture/calculator evidence; the deployed Prowlarr UI can only produce explicit
0/0.5 factors or unknown, never inferred normal charge. Keep those two evidence
classes separate.
