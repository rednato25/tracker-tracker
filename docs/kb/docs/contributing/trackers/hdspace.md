# HD-Space (HDS)

| Field        | Value                                                    |
| ------------ | -------------------------------------------------------- |
| Platform     | HD-Space (custom, xbtit)                                 |
| Base URL     | `https://hd-space.org`                                   |
| API Endpoint | `https://hd-space.org/index.php?page=usercp` (HTML)      |
| Auth Method  | Browser cookies (`cf_clearance` + site session) + User-Agent |
| Enrichment   | No, one page carries everything                          |
| Auth Style   | N/A                                                      |

## Notes

HD-Space runs a customised **xbtit** codebase with no API, and the site sits
behind a Cloudflare managed challenge that blocks server-side logins. The
adapter follows the AvistaZ/IPTorrents model: the user pastes the browser's
Cookie header, including Cloudflare's `cf_clearance`, and the dialog captures the
browser's User-Agent, which the clearance cookie is bound to. Requests must come
from the same public IP as the browser that minted the cookies. One page is read
per poll, the user control panel.

Everything comes from the header block xbtit renders on every authenticated
page plus one row of the panel:

| Stat                  | Source                                                |
| --------------------- | ----------------------------------------------------- |
| username              | `Welcome back <name> (Logout)` in the header          |
| class (`group`)       | `Rank: ...` in the header                              |
| uploaded / downloaded | `UP: 22.01 GB` / `DL: 10.90 MB`                       |
| ratio, buffer         | derived from the byte totals                          |
| seeding / leeching    | `Active Torrents : 16 0`                              |
| seedbonus             | `Bonus: 11,673.65`                                    |
| joined date           | `Joined on: September 03, 2026, 17:10:02`             |
| last access           | `Last access: 23/09/2026 21:41:18`                    |
| remote user id        | the `page=usercp&uid=...` link                        |

xbtit has no hit-and-run system, warning flag, required ratio or freeleech
tokens, so those stay `null`.

### Byte units

xbtit labels sizes `KB` / `MB` / `GB` but computes them in binary. For a header
reading `UP: 22.01 GB`, `DL: 10.90 MB`, the site's own ratio is
2,067.83 = 22.01 / 10.90 x 1024. `tryParseSiteBytes` therefore maps the labels to
KiB/MiB/GiB before parsing.

### Cloudflare

The challenge applies to non-browser clients. When `cf_clearance` expires or the
public IP changes, the adapter reports a Cloudflare challenge rather than
parsing the challenge page. Paste fresh cookies from the browser.

### Rate limiting

HD-Space answers automation user-agents that make roughly ten requests in a few
minutes with `403 Forbidden - due to excessive requests`. With one GET per poll
and the default 60-minute interval, the adapter stays well below that limit.
