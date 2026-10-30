// src/data/trackers/retrotoon.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

const GiB = 1024 ** 3

export const retrotoon: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "retrotoon",
  name: "RetroToon World",
  abbreviation: "RTW",
  url: "https://retrotoon.world",
  description:
    "Private tracker dedicated exclusively to animation: classic Western cartoons, animated series and films, anime, and shorts. Aims to archive rare and hard-to-find animation from any country or era.",

  // ── Platform & API ──────────────────────────────────────────────────
  // TBDev derivative. The `rt_` API key only authenticates uploads and the
  // passkey only Torznab search, so no endpoint returns user stats and the
  // adapter scrapes the logged-in pages with browser cookies.
  platform: "retrotoon",
  apiPath: "/userdetails.php",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "Animation",
  // The site lists an Adult category, but rules.php forbids adult content
  // outright, so it is not mapped to XXX.
  contentCategories: ["Movies", "TV", "Anime", "Comics", "Manga", "Music"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#455a64",
  logo: "/tracker-logos/retrotoon_logo.png",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "",
  statusPageUrl: "https://status.retrotoon.world",

  // ── Community ───────────────────────────────────────────────────────
  // Thresholds from faq.php. The starting class is "Toon" in the live header
  // and statistics.php, not "Sketch" as the FAQ still calls it.
  rankProgression: "automatic",
  rankRequirementsSource: {
    url: "https://retrotoon.world/faq.php",
    title: "RetroToon World FAQ - User Classes",
    accessedAt: "2026-10-30",
    sourceLastModified: null,
    verification: "published",
    note:
      "Confirmed by the owner on 2026-10-30 from the site's user-class documentation. GB text without a stated unit basis is read as the larger binary GiB value.",
  },
  rankUnresolved: [
    "Awarded ranks (Silver Star, The Creator) sit outside the earned ladder and are not targets.",
    "GB text without a stated unit basis is read as the larger binary GiB value.",
    "The stated demotion ratios are demotion states, not promotion conditions.",
  ],
  userClasses: [
    { name: "Toon", requirements: "Starting class" },
    {
      name: "Toon Hero",
      requirements: "14 days registered, 50 GB uploaded, ratio 1.05 or higher. Demoted below 0.95",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "rtw-hero-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 14, scope: "account", label: "At least 14 days registered" },
          { kind: "numeric", id: "rtw-hero-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 50 * GiB, scope: "account", unitReading: "conservative", label: "At least 50 GiB uploaded" },
          { kind: "numeric", id: "rtw-hero-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 1.05, scope: "account", label: "Ratio at least 1.05" },
        ],
      },
    },
    {
      name: "Toon Legend",
      requirements: "30 days registered, 150 GB uploaded, ratio 1.50 or higher. Demoted below 1.45",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "rtw-legend-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 30, scope: "account", label: "At least 30 days registered" },
          { kind: "numeric", id: "rtw-legend-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 150 * GiB, scope: "account", unitReading: "conservative", label: "At least 150 GiB uploaded" },
          { kind: "numeric", id: "rtw-legend-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 1.5, scope: "account", label: "Ratio at least 1.50" },
        ],
      },
    },
    {
      name: "Toon Superstar",
      requirements: "60 days registered, 500 GB uploaded, ratio 2.00 or higher. Demoted below 1.95",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "rtw-superstar-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 60, scope: "account", label: "At least 60 days registered" },
          { kind: "numeric", id: "rtw-superstar-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 500 * GiB, scope: "account", unitReading: "conservative", label: "At least 500 GiB uploaded" },
          { kind: "numeric", id: "rtw-superstar-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 2.0, scope: "account", label: "Ratio at least 2.00" },
        ],
      },
    },
    {
      name: "Silver Star",
      requirements: "Awarded rank. Requirements not published",
      outsideLadder: "above",
    },
    {
      name: "The Creator",
      requirements: "Awarded rank. Requirements not published",
      outsideLadder: "above",
    },
  ],
  releaseGroups: [],
  bannedGroups: [],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  // rules.php: "Every torrent you upload must be seeded for a minimum of 3 full
  // days (72 hours) ... Those 72 hours should be reached in the first 10 days
  // after download." myhr.php: "Reaching a 1:1 ratio immediately clears a Hit &
  // Run", which is the per-torrent OR. faq.php: accounts are disabled after 3
  // months without a login, and no account-level ratio is enforced.
  rules: {
    minimumRatio: 1, // per-torrent rule applied to the account ratio, so health reads critical below 1
    seedTimeHours: 72,
    loginIntervalDays: 90,
    satisfactionMode: "any",
    fulfillmentPeriodHours: 240,
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: false,
  warningNote: "",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: true,
  profileUrlPattern: "/userdetails.php?id={id}",

  // ── Stats ───────────────────────────────────────────────────────────
  // statistics.php
  stats: {
    userCount: 11124,
    activeUsers: 11114,
    torrentCount: 4852,
    seedSize: "48.969 TB",
    statsUpdatedAt: "August 2026",
  },
}
