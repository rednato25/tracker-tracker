# P20 Manual Acceptance (isolated synthetic fixtures)

Owner accepted this fixture on isolated image digest
`sha256:4b2c3489a8d0fd4fe460abbe7b2692c95aa2b5ff7ecca833d9b9c4f016275856`.
The guide remains reproducible on the throwaway instance with the existing fake
Prowlarr test harness. Do not modify a home server, point at real Prowlarr,
or insert plaintext into encrypted columns.

## Fixture

Create one synthetic owned AlphaRatio account through the same encrypted-token
fixture mechanism used by the E2E visual tests:

- 900 GiB accounted upload.
- 600 GiB accounted download.
- fresh snapshot (`lastPolledAt` within 24 hours).
- tracker minimum 1.0, target ratio input 1.0.
- A valid encrypted API token produced by the application crypto helper; never
  put plaintext into `encrypted_api_token` or disable database constraints.
- Fake Prowlarr returns four independent 80 GiB releases:
  - normal charge (test fixture with explicit factor 1.0);
  - halfleech (`indexerFlags: ["halfleech"]`);
  - freeleech (`indexerFlags: ["freeleech"]`);
  - unknown factor (no accounting flags).

The live Prowlarr API has no official “normal charge” flag. Normal charge is
therefore verified with the deterministic P20 comparison fixture/test; absent
flags must remain unknown, never inferred as normal. Do not invent a normal flag
in the fake service to make the UI look complete.

## Walkthrough

1. Search and select all four independent alternatives. Enter target ratio `1.0`.
2. Normal-charge fixture: charged bytes = 80 GiB, projected ratio ~1.32,
   remaining allowance 220 GiB.
3. Halfleech: charged bytes = 40 GiB, projected ratio ~1.41, remaining allowance
   260 GiB.
4. Freeleech: charged bytes = 0, projected ratio 1.50, remaining allowance
   300 GiB, labelled **zero-charge scenario**; not proof of safety, H&R
   compliance or upload credit.
5. Unknown factor: charged bytes and projected ratio unavailable; do not show
   80 GiB charged or normal charge.
6. Confirm all four rows use the same 600 GiB accounted baseline independently.
   Selecting all alternatives must not cumulatively subtract four 80 GiB sizes.
7. Make the snapshot stale (older than 24 hours) or remove uploaded/downloaded
   data. Confirm account arithmetic becomes unavailable; it must not silently
   use zero.
8. Change the target from 1.0 to another positive value. Confirm projected
   ratio/allowance update while the tracker minimum stays displayed separately.
9. Confirm no row is labelled “best”, “safest” or “ready to apply”, and no
   freeleech row is automatically preferred.
10. Check desktop light/dark and 390px mobile: target control, Compare controls,
    row values and warnings remain reachable and readable.

## Expected deterministic results

| Alternative | Charged | Projected ratio | Remaining allowance |
| --- | ---: | ---: | ---: |
| Normal 80 GiB | 80 GiB | 900/680 ≈ 1.32 | 220 GiB |
| Halfleech 80 GiB | 40 GiB | 900/640 ≈ 1.41 | 260 GiB |
| Freeleech 80 GiB | 0 | 900/600 = 1.50 | 300 GiB |
| Unknown factor | Unknown | Unavailable | Unavailable |

The exact arithmetic regression lives in
`src/lib/__tests__/result-comparison.test.ts` and the account allow-list
regression in `src/lib/__tests__/prowlarr-search.test.ts`. Automated CI and the
authenticated comparison screenshots remain separate evidence.

Owner acceptance is recorded above; keep this guide for regression runs.
