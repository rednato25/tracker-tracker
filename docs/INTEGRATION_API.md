# Read-only Integration API (v1)

P16 adds a small, versioned, token-authenticated API for homelab widgets. It is
read-only: requests read stored tracker snapshots and run the existing
deterministic action evaluator. They never poll a tracker, search, download,
test a connection, or contact a tracker or download client.

The admin UI and the integration API are separate trust boundaries:

- Admin routes accept only the browser session cookie.
- Integration routes accept only `Authorization: Bearer <token>`.
- An integration token cannot authorize admin, mutation, backup, secret-export
  or credential routes.
- Tokens in query strings are rejected with `400`, even when a valid header is
  also present.

## Create and manage tokens

Settings > Integrations creates tokens. The plaintext value is shown exactly
once; only a SHA-256 hash is stored. Each token has a name and one or more read
scopes:

| Scope | Capability |
| --- | --- |
| `summary:read` | Health counts, totals, latest stored snapshot per tracker |
| `actions:read` | Existing action evaluator output |
| `history:read` | Bounded stored tracker snapshot history |

Tokens can be revoked immediately in the same panel. Revocation sets a timestamp
and the authentication path rejects the token from the next request. Up to 20
active tokens may exist.

## Authentication

```http
Authorization: Bearer tt_int_<43 base64url characters>
```

A missing, malformed, unknown, or revoked token returns `401 Unauthorized` with
`WWW-Authenticate: Bearer`. A valid token without the endpoint's scope returns
`403 Forbidden` with `requiredScope`. Error bodies never echo token material.

```bash
# Replace the placeholder. Do not put the token in a query string.
export TT_TOKEN='tt_int_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
export TT_BASE='http://localhost:3000'

curl -sS -H "Authorization: Bearer $TT_TOKEN" \
  "$TT_BASE/api/integrations/v1/summary"

curl -sS -H "Authorization: Bearer $TT_TOKEN" \
  "$TT_BASE/api/integrations/v1/actions"

curl -sS -H "Authorization: Bearer $TT_TOKEN" \
  "$TT_BASE/api/integrations/v1/history?days=7&limit=100"

curl -sS -H "Authorization: Bearer $TT_TOKEN" \
  "$TT_BASE/api/integrations/v1/history?trackerId=1&days=30&limit=500&before=2026-10-26T12:00:00.000Z"
```

All responses use `Cache-Control: no-store` and `Vary: Authorization`.

## Privacy controls

`integrationIdentityMode` is explicit and defaults to `none`:

| Mode | Tracker name | Username | Last access |
| --- | --- | --- | --- |
| `none` (default) | omitted | omitted | omitted |
| `trackers` | included | omitted | omitted |
| `full` | included | included only if username storage is enabled and the stored value is not redacted | included |

Responses never include base URLs, registry slugs, API tokens, cookies,
passkeys, announce URLs, credential vault contents, raw tracker errors, or
private platform configuration. A numeric `trackerId` is always present as a
stable reference, even when names are hidden.

## Endpoints

### `GET /api/integrations/v1/summary`

Scope: `summary:read`.

```json
{
  "apiVersion": "v1",
  "generatedAt": "2026-10-26T12:00:00.000Z",
  "privacy": { "trackerIdentity": "none", "usernamesIncluded": false },
  "counts": {
    "total": 2,
    "active": 2,
    "paused": 0,
    "unknownData": 0,
    "byStatus": {
      "healthy": 2,
      "warning": 0,
      "noSeeds": 0,
      "critical": 0,
      "error": 0,
      "paused": 0,
      "pausedUser": 0,
      "offline": 0
    }
  },
  "totals": {
    "uploadedBytes": "1000",
    "downloadedBytes": "500",
    "bufferBytes": "500",
    "avgRatio": 2,
    "seeding": 3,
    "leeching": 1,
    "hitAndRuns": { "total": 0, "reportingTrackers": 2 }
  },
  "trackers": [
    {
      "trackerId": 1,
      "status": "healthy",
      "dataState": "current",
      "isActive": true,
      "isPaused": false,
      "isUserPaused": false,
      "lastPolledAt": "2026-10-26T11:55:00.000Z",
      "latestStats": {
        "ratio": 2,
        "ratioIsInfinite": false,
        "uploadedBytes": "1000",
        "downloadedBytes": "500",
        "bufferBytes": "500",
        "seeding": 3,
        "leeching": 1,
        "requiredRatio": 1,
        "warned": false,
        "hitAndRuns": 0,
        "freeleechTokens": 0,
        "seedbonus": 10
      }
    }
  ],
  "truncated": false
}
```

`dataState` is derived from stored timestamps: `unknown` (no snapshot or
timestamp), `stale` (last poll older than two hours), or `current`. `status`
preserves the dashboard health vocabulary including paused and offline states.

At most 200 trackers are returned. `truncated` is true when more existed. The
loader reads at most 201 rows, so counts and totals describe that bounded window
rather than scanning an unbounded tracker table.

### `GET /api/integrations/v1/actions`

Scope: `actions:read`.

The response uses the existing P04 action evaluator, with explicit fields only:
`key`, `type`, `status`, `priority`, `trackerId`, optional `trackerName`,
`reason`, `nextAction`, `deadline`, and selected evidence fields. It never
returns `dismissible`, client ids, torrent hashes, raw errors or client names.

```json
{
  "apiVersion": "v1",
  "generatedAt": "2026-10-26T12:00:00.000Z",
  "privacy": { "trackerIdentity": "none", "usernamesIncluded": false },
  "counts": {
    "total": 1,
    "returned": 1,
    "actionRequired": 1,
    "needsVerification": 0,
    "truncated": false
  },
  "actions": [
    {
      "key": "ratio-below-account:tracker:1",
      "type": "ratio-below-account",
      "status": "action-required",
      "priority": "critical",
      "trackerId": 1,
      "reason": "The account ratio is below the confirmed requirement.",
      "nextAction": "Upload or reduce downloads before the next check.",
      "deadline": null,
      "evidence": { "value": 0.8, "required": 1, "source": "api", "freshness": "fresh" }
    }
  ]
}
```

At most 200 actions are returned. `status` and `evidence.freshness` preserve
unknown/stale distinctions from the evaluator.

### `GET /api/integrations/v1/history`

Scope: `history:read`.

| Parameter | Default | Bounds |
| --- | --- | --- |
| `days` | `7` | `1`-`90` |
| `limit` | `100` | `1`-`500` |
| `trackerId` | all trackers | positive integer |
| `before` | none | ISO-8601 UTC cursor |

Invalid or oversized values return `400`; values are not silently clamped. Items
are oldest-first. `nextBefore` is set only when more rows exist; pass it as the
next `before` value to page older.

```json
{
  "apiVersion": "v1",
  "generatedAt": "2026-10-26T12:00:00.000Z",
  "range": {
    "days": 7,
    "maxDays": 90,
    "limit": 100,
    "maxLimit": 500,
    "trackerId": null,
    "before": null
  },
  "items": [
    {
      "trackerId": 1,
      "polledAt": "2026-10-26T10:00:00.000Z",
      "uploadedBytes": "1000",
      "downloadedBytes": "500",
      "ratio": 2,
      "bufferBytes": "500",
      "seeding": 3,
      "leeching": 1,
      "isManual": false
    }
  ],
  "truncated": false,
  "nextBefore": null
}
```

History never includes usernames, groups, tracker names, raw errors or
credential-bearing URLs, regardless of identity mode.

## Token lifecycle

- **Create:** plaintext returned once; only SHA-256 hash, name, scopes and
  timestamps are stored.
- **Revoke:** `DELETE /api/settings/integration-tokens/<id>` from an authenticated
  session; effective on the next integration request.
- **Password change:** every integration token is revoked in the same
  transaction, with a warning in the response.
- **Emergency lockdown / nuke:** every integration token is deleted.
- **Backup:** integration tokens are deliberately excluded from backup payloads.
- **Restore:** every integration token is deleted. A restore can therefore never
  resurrect a token that was revoked after the backup was taken.
- **Recovery CLI:** token hashes are independent of the master password and
  encryption salt, so recovery does not re-key them. Existing tokens remain
  valid until revoked; run lockdown or revoke them explicitly if recovery was
  triggered by a credential compromise.

## Limitations

- Same-instance, same-origin by default; no CORS policy is added by this task.
- No token expiry timestamps; revocation is explicit and immediate.
- No write scopes, webhooks, search, download actions or live polling.
- History is snapshot metadata only; it is not a torrent-level feed.
