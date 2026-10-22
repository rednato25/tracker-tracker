# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Technical self-hosters who run Tracker Tracker on their own server. They are
comfortable with Docker, Postgres and environment configuration, and they
monitor roughly 5-50 private tracker accounts. They check the dashboard to
keep those accounts healthy and to follow their progress, not to explore a
social product.

## Product Purpose

A self-hosted dashboard that watches private tracker accounts: ratio, seeding,
H&R, login deadlines and rank progress. It exists so a member never loses an
account to an unnoticed inactivity window or a missed rule, replacing the
spreadsheet-and-calendar routine. Success means the account stays healthy and
the member can see, at a glance, what needs attention.

## Positioning

The mechanism a neighboring dashboard could not truthfully copy is the
rules-aware health engine: each tracker's own ratio, H&R, seed-time and login
rules are encoded per tracker and combined with live snapshots, qBittorrent /
Mousehole correlation, and rank progression history. It is not a generic
torrent stats viewer.

## Operating Context

- Runs as a single-admin web app on the operator's own server, usually with
  Docker Compose and Postgres.
- Trackers authenticate through official APIs or pasted browser cookies; the
  poller fetches snapshots on a schedule and stores history.
- qBittorrent is the expected client integration, with Mousehole support for
  trackers that require it; notification targets are configured by the
  operator.
- The incumbent visual world is the dark, data-dense neumorphic interface
  already in the repository.

## Capabilities and Constraints

- Tracker support is registry-driven: platform adapters, per-tracker rules,
  user classes and metadata.
- Only sanctioned authentication paths are allowed: official APIs and pasted
  cookies. Scraping or automation that violates tracker rules is out.
- Data stays on the operator's server; no external service is required for
  core function.
- Stack constraints: Next.js, Postgres, Docker; database migrations must not
  break existing installations.
- WCAG AA is the accessibility floor for new and changed UI: contrast,
  keyboard operation, reduced motion and usable touch targets.
- Explicitly undecided: whether the incumbent visual language is binding or
  replaceable, whether a light theme is wanted, and whether multi-user or
  hosted operation is ever in scope.

## Brand Commitments

- Product name: Tracker Tracker. Logo and icon assets live in `public/` and are
  used by the dashboard and the documentation site.
- Voice: technical, direct, operator-to-operator; no marketing tone.

## Evidence on Hand

- Working codebase with a tracker registry, platform adapters, tests and a
  documentation site in `docs/`.
- No customer testimonials, benchmarks, pricing or press exist; future work
  must not fabricate them.

## Product Principles

1. Rules first: every health signal maps to a tracker's actual rule, not a
   generic ratio threshold.
2. Dense and honest: one screen answers "what needs attention", without vanity
   metrics.
3. Self-hosted by default: no mandatory cloud, no data leaving the box.
4. Compliance over convenience: only sanctioned auth and automation paths.
5. Progress is visible: snapshots, ranks and timelines drive decisions.

## Accessibility & Inclusion

WCAG AA is the confirmed standard for the interface: text contrast at or above
4.5:1, full keyboard operation, a reduced-motion path, and touch targets usable
on mobile.
