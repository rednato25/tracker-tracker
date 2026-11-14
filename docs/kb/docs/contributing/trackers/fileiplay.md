# FileIplay (FIP)

| Field        | Value                                              |
| ------------ | -------------------------------------------------- |
| Platform     | FileIplay (custom, Laravel)                        |
| Base URL     | `https://fileiplay.org`                            |
| API Endpoint | `https://fileiplay.org/profile/<username>` (HTML)  |
| Auth Method  | Username and password, Laravel session + CSRF      |
| Enrichment   | No, the profile page carries every reported figure |
| Auth Style   | N/A                                                |

## Notes

FileIplay has a small upload API under `/api/v1` (Bearer personal token) and a
Torznab feed at `/torznab/api` (integration key), but neither reports account
stats. The adapter logs in with the username and password, then reads the
profile page.

The login page is a Laravel form protected by a hidden `_token`. The adapter
reads the token and the session cookies from `GET /login`, posts the form, and
reuses the resulting session across polls. A login refused by the site answers
`302` back to `/login`; a good one redirects elsewhere. A `419` means the CSRF
token expired, so one fresh form is read and posted again.

The adapter discovers the profile URL from the signed-in home page rather than
assuming `/profile/<login>`, because the login form accepts an email address as
well as a username. It then reads the profile figures by the site's own
classes: `.profile-name`, `.profile-role-badge`, and the four
`.transfer-card.uploaded`, `.downloaded`, `.ratio` and `.seeding` cards. A label
scan handles figures outside those cards, such as bonus points, hit and runs and
dates.

The profile page prints binary quantities with decimal labels. `tryParseSiteBytes`
maps `KB`/`MB`/`GB`/`TB` to `KiB`/`MiB`/`GiB`/`TiB`, so the totals match the
site's own ratio.

## Verification status

The login request shapes were checked against the live site on 2026-11-14
(`GET /login` returns the CSRF form, a refused `POST` returns `302 /login`), and
the profile class names come from the site's public
`/build/assets/app-*.css` and `/css/profile.css`. Parsing a signed-in profile
page has **not** been exercised against a live account, so the registry entry
carries a warning until the first successful poll is confirmed.

## Rules source

Prowlarr Indexers `definitions/v11/fileiplay.yml` supplies the caps:
`minimumratio: 1.0` and `minimumseedtime: 43200` seconds (12 hours). The class
ladder is only visible to signed-in members and is not populated in the registry.
