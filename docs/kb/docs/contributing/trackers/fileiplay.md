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
`/build/assets/app-*.css` and `/css/profile.css`. A member's tracker card on
2026-11-15 confirmed the adapter reads the uploaded, downloaded, ratio, seeding
and bonus figures and the current class. The join date is still reported as
unknown; the profile page does not expose a date the parser recognises.

## Classes

The normal ladder is Newbie, User, Elite User and Addict. Promotions are
checked hourly and move one class at a time:

| Promotion          | Requirements                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------ |
| Newbie to User     | 7 days registered and 12 verified seeding hours on every completed download. No ratio or traffic minimum.     |
| User to Elite User | 30 days registered, ratio 0.6 or higher, 500 GiB uploaded, 250 GiB downloaded, 1 active seeding day in 7 days. |
| Elite to Addict    | 90 days registered, ratio 1.1 or higher, 1 TiB uploaded, 500 GiB downloaded, 30 active seeding days in 60 days. |

VIP, Special User, Uploader and the staff classes are granted or appointed
outside that ladder. Elite User below 0.4 or Addict below 0.8 gets a 14-day
recovery window before one class demotion; there is no automatic User to Newbie
demotion. The active-seeding-day counts are not exposed to the app, so they stay
in the registry's unresolved notes.

## Rules source

The member-supplied copy of the site's Downloading & Seeding page (2026-11-15)
states the Hit & Run policy: reach a 1:1 ratio or seed each torrent for at least
12 hours within 7 days. Twenty active Hit & Runs restrict downloads. Freeleech
torrents still require seeding. The registry uses those figures, with a
168-hour fulfilment window and a 20-Hit&Run limit.
