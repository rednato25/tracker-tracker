# P19 Manual Acceptance (isolated mock Prowlarr)

Owner acceptance is pending. Run this against a throwaway instance and a local
fake Prowlarr service only. Do not point it at a real Prowlarr or tracker.

## Mock service requirements

The fake service must implement:

- `GET /api/v1/indexer` returning at least:
  - `{ id: 101, name: "AlphaRatio", implementation: "AlphaRatio", fields: [{ name: "baseUrl", value: "https://alpharatio.cc" }] }`
  - `{ id: 102, name: "Mystery Tracker", implementation: "Unknown", fields: [] }`
- `GET /api/v1/search` with `query`, `type=search`, `indexerIds`, `limit`, `offset`.
  - Require `X-Api-Key: synthetic-p19-key`; return 401 otherwise.
  - For `indexerIds=102`, return 429 to exercise partial coverage.
  - For `indexerIds=101` and query `empty`, return HTTP 200 `[]`.
  - For query `slow`, delay at least 8 seconds before returning.
  - Otherwise return offset-aware synthetic pages. Offset 0 and offset 10 should
    each return up to 10 rows so Next/Previous can be exercised.
  - Include at least one row with `size`, `seeders` and `publishDate`, and
    `indexerFlags: ["freeleech"]`.
  - Include one row with `size: 0`, `seeders: null`, a 0001 publish date and no
    flags. It must display Unknown for size, seeders, date and download factor.
  - Include duplicate/similar titles to confirm they are not merged.
  - Include `downloadUrl`, `magnetUrl` and `guid` values containing a sentinel
    string. The page must not render or return them.
- No `/grab`, `/download`, `/api/v1/search/bulk` or client route is needed. Log
  every request so the agent can confirm none are called.
- The existing inline fake in `e2e/visual.spec.ts` covers the indexer mapping,
  freeleech result, missing-metadata result and the 429 partial failure. Extend
  its search response with offset-aware pages and an optional slow response for
  this manual pass; do not use a real Prowlarr.

## Walkthrough

1. Configure Prowlarr URL to the mock, API key `synthetic-p19-key`, allow
   private/local access only for this throwaway setup.
2. Open `/search`. Confirm the request log shows the indexer-list GET only; no
   search request is sent on page load.
3. Select AlphaRatio and search a normal query. Confirm results render with
   indexer/tracker, title, size, seeders and publication date where supplied.
   The freeleech row shows a 0% download factor; the sparse row shows Unknown,
   not zero/normal/freeleech defaults.
4. Also select Mystery Tracker and search. Confirm the AlphaRatio results remain
   visible under a partial-results banner and the banner names the failed 429
   indexer.
5. Use Next/Previous. Confirm the request uses the displayed per-indexer offset
   and Page N label. Prowlarr offset is per selected indexer, not a global cursor.
6. Search `empty`. Confirm the empty state says the selected indexers returned no
   releases. Remember HTTP 200 is only a successful API response; it is not proof
   that an underlying indexer search succeeded.
7. Search `slow`, click Cancel, then submit a new search. Confirm the old response
   cannot replace the new one. The page states that upstream Prowlarr work may
   have already finished.
8. Confirm there are no grab, download, magnet or client controls, and the mock
   request log contains no such calls.
9. Check desktop light/dark and 390px widths: controls remain reachable, the
   Search title clears navigation, long titles wrap, and the partial banner is
   readable.
10. Verify the sentinel download/magnet/guid values never appear in the page,
    network response, logs or screenshots.

Record owner acceptance only after this guide is run. Automated CI and the
authenticated visual artifacts remain separate evidence.
