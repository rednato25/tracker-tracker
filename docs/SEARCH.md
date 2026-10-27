# Prowlarr Search (P19)

Read-only search through the existing encrypted Prowlarr connection. The page
never downloads, grabs, fetches a torrent/NZB, opens a magnet or mutates a
download client. P20 owns comparisons; P21 owns sending releases.

## Upstream contract used

Verified against Prowlarr `develop` at commit
`0dc20d8495bad9951c3fafe53f32b6e1c70fcf3b` (2026-10-26) and the official
Servarr search page:

- `GET /api/v1/search` with `query`, `type=search`, `indexerIds`, `limit` and
  `offset`.
- `indexerIds` is a list; this implementation makes one request per selected
  indexer so a transport failure or timeout cannot hide successful results from
  other indexers.
- Release fields used: `indexerId`, `indexer`, `title`, `size`, `seeders`,
  `leechers`, `publishDate`, `protocol` and `indexerFlags`.
- `downloadUrl`, `magnetUrl`, `infoUrl`, `commentUrl`, `guid`, `posterUrl` and
  `downloadClientId` are deliberately not returned, logged or rendered.
- Prowlarr computes `size=0` when the upstream size is absent; P19 treats zero and
  negative values as unknown, not as a real zero-byte release.
- `seeders`/`leechers` are nullable. Missing values remain unknown; a real `0` is
  preserved as zero.
- `publishDate` must parse and be after 1970; otherwise it remains unknown.
- `indexerFlags` can explicitly say `freeleech`, `neutralleech` or `halfleech`.
  Only then is a download factor shown (`0`, `0`, `0.5`). Missing, malformed or
  conflicting flags remain unknown. `doubleupload` is not a download factor.
  Official Prowlarr `IndexerFlag.cs` at the pinned commit defines these as:
  `freeleech` = download does not count toward ratio; `neutralleech` = download
  **and upload** do not count toward ratio; `halfleech` = release counts 50% to
  ratio. A zero download factor is not upload credit, H&R compliance, or overall
  download safety; P19 exposes only the download accounting factor.
- Prowlarr's controller catches upstream search exceptions and can return HTTP
  200 with an empty list. **HTTP 200 means the Prowlarr API request succeeded; it
  is not proof that the underlying indexer search succeeded.** Per-indexer
  requests distinguish transport/HTTP failures, but a 200 empty response cannot
  tell â€œno releasesâ€ from an internal indexer failure. The UI reports actual
  response coverage and never claims all indexers succeeded.

## Endpoint behavior

- `GET /api/search/indexers` loads the indexer list, maps names/hosts through the
  existing registry matcher, and assigns ownership:
  - `owned`: matched registry tracker with an account row that is not an imported
    paused placeholder.
  - `placeholder`: matched row that is user-paused and has no stored stats. It is
    explicitly not treated as configured or healthy.
  - `no-account`: matched registry tracker without an account row.
  - `ambiguous`: more than one registry match; no automatic tracker choice.
  - `unsupported`: no registry match.
- `POST /api/search` requires the session. P16 integration tokens are not
  accepted by this external-search operation.
- Bounds: query 1-200 printable characters; 1-10 unique positive indexer IDs;
  `limit` 1-20 (UI uses 10); `offset` 0-500; 10-second timeout per indexer;
  1 MiB response ceiling per indexer; concurrency 3; at most 200 results returned
  from one page.
- Prowlarr's `limit`/`offset` are applied to **each selected indexer**. Page
  controls are therefore labelled with the offset and per-indexer page size; they
  do not claim a global result cursor.
- API key stays in the `X-Api-Key` header. Redirects are refused; private hosts
  require the existing explicit `prowlarrAllowPrivate` setting.
- No search is issued on page load. The page loads the indexer list on first
  view; submitting the form is what contacts the selected indexers.
- A request sequence guard and `AbortController` prevent a canceled/older
  response from replacing a newer search. Cancellation is described as
  page-local: upstream work already dispatched to Prowlarr may finish.
- No result cache is used. There is no cross-user or cross-instance cache to
  isolate.

## Result states

- Loading indexers with retry/config link.
- Loading search with Cancel.
- Successful empty results.
- Partial results with the exact responding/failed count and safe failure text.
- All indexers failed: explicitly a failure, not an empty result.
- Missing size, seeders, publication date and download factor labelled Unknown.
- Matched owned, paused placeholder, no account, ambiguous and unsupported labels
  on both indexer selection and result rows.
- Local page controls over Prowlarr's per-indexer offset.

No raw provider payloads, credential-bearing URLs or secrets are returned. Logs
contain route names, counts and safe error classes only.

## Validation

- Unit tests cover ownership classification, ambiguous mapping, explicit and
  missing download factors, missing metadata, duplicate titles, partial failures,
  timeout, malformed JSON, HTTP 429, oversized responses, header-only API key,
  concurrency and private-host refusal.
- Route tests cover session auth, validation, configuration state, partial/all-
  failed coverage and redaction.
- UI tests cover no search on load, explicit submission, empty/partial/all-failed
  states, unknown values, pagination offset and canceled late responses.
- The proxy test proves a P16 integration bearer token cannot reach
  `/api/search` or `/api/search/indexers`.
- 35 P19-focused tests plus the full suite on Node 24: 255 files / 6225 tests passed.
- Visual evidence uses a local fake Prowlarr service only. It captures light/dark
  desktop and 390px mobile. No real Prowlarr, tracker or client is contacted.
- Owner manual mock requirements and walkthrough: `docs/P19_MANUAL_ACCEPTANCE.md`.

## Limitations

- Prowlarr does not expose per-indexer failure details for a 200 empty response.
- No cross-indexer deduplication or equivalence inference; every returned row is
  shown separately.
- Prowlarr's offset is per indexer, so page boundaries are not a global cursor.
- No download accounting factor beyond explicit indexer flags.
- No P20 ranking/comparison, P21 grab/download/client mutation, P22 storage report
  or deployment.
