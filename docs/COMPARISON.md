# Result Comparison (P20)

P20 compares independently selected search results by their account impact. It
reuses the P12 pure `calculateDownloadBudget` function; it does not introduce an
opaque score, “best”/“safest” label, ranking, download or client action.

## Selection and inputs

- Each search result has an independent Compare checkbox. Up to eight results
  can be selected. Similar titles, duplicate rows and similar sizes are never
  merged or treated as equivalent.
- The comparison asks for **your target ratio**. The tracker minimum is displayed
  separately per row and is not substituted for the user target.
- Account data comes from the existing tracker snapshot attached to the matched
  indexer: uploaded/downloaded bytes, tracker minimum and last poll time. No
  external polling or credential access occurs.
- Quality, language and release-group preferences are not inferred from titles.
  The table tells the user to verify the title and states that a freeleech result
  is not automatically preferred.

## Arithmetic shown when supported

For each selected alternative:

- release size and explicit accounting factor;
- charged bytes (`size * factor`);
- user target ratio and tracker minimum separately;
- projected ratio, remaining charged allowance and additional upload required;
- account name, mapping state and observation freshness.

The existing calculator is called only when the account is owned and fresh, the
matched indexer is unambiguous, uploaded/downloaded bytes are known, size is
known, the accounting factor is explicit and the target ratio is positive.
Committed traffic and reserve are passed as zero with the visible note that no
queued commitments/reserve are included in this comparison.

## Uncertainty rules

- A missing or conflicting accounting factor leaves charged bytes and account
  arithmetic unavailable. It is never treated as zero, normal charge or
  freeleech.
- A missing size, target ratio, account snapshot or uploaded/downloaded value
  leaves the corresponding arithmetic unavailable.
- Stale account observations (older than 24 hours) make projected ratio and
  allowance unavailable; already-known charged bytes may still be displayed.
- Imported paused placeholders, no-account, ambiguous and unsupported mappings
  cannot produce account arithmetic.
- Freeleech/neutralleech 0 factors are shown as a zero-charge **scenario**, with
  the existing calculator safety verdict `not-assessed`. Zero is not H&R
  compliance, upload credit or overall download safety.
- Neutralleech does not imply upload credit.
- Future upload is never credited; only stored uploaded/downloaded amounts are
  used.
- Known seeding/H&R obligations are displayed separately and remain `unknown`
  because P19 search results carry no release-level obligation data. They are
  never folded into the ratio arithmetic.
- Unknown values are not sorted/ranked as cheapest. The table preserves selection
  order; there is no universal “best” or “safest” recommendation.

## Validation

- Pure tests cover arithmetic, target/minimum separation, explicit zero factor,
  missing factor/size/target, stale and missing accounts, placeholder/ambiguous/
  unsupported mappings, duplicate titles, future-upload non-crediting and separate
  unknown seeding obligations.
- UI tests cover selection, target input, concrete values, unavailable rows,
  scenario labelling and the absence of download/client actions.
- Visual evidence: local fake Prowlarr only; light/dark desktop and 390px mobile
  comparison layouts, with a freeleech row and a missing-metadata row.
- 10 P20-focused tests; full suite on Node 24: 257 files / 6235 tests passed.
- P20 has no owner acceptance yet.

## Limitations

- No quality/language/release-group preference model exists; those remain user
  judgement.
- No release-level H&R/seeding obligation data is available from P19.
- No estimate of speed, future upload or equivalence between releases.
- No P21 grab/download/client mutation, P22 storage report or deployment.
