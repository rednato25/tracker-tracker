// src/data/trackers/torrentleech.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

const GiB = 1024 ** 3
const TiB = 1024 ** 4

export const torrentleech: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "torrentleech",
  name: "TorrentLeech",
  abbreviation: "TL",
  url: "https://www.torrentleech.org",
  description:
    "Large general tracker known for having open signups very often. Broad content library across most categories.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "torrentleech",
  apiPath: "/profile",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "General",
  contentCategories: ["Movies", "TV", "Games", "Music", "Apps", "Books"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#2ecc71",
  logo: "/tracker-logos/torrentleech_logo.png",
  bonusName: "TL Points",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "torrent-leech",
  statusPageUrl: "",

  // ── Community ───────────────────────────────────────────────────────
  // wiki.torrentleech.org/doku.php/user_classes. Staff roles (Uploader, FLS,
  // Moderator, ...) are omitted: they are jobs, not classes.
  rankProgression: "automatic",
  rankRequirementsSource: {
    url: "https://wiki.torrentleech.org/doku.php/user_classes",
    title: "TorrentLeech Wiki - User Classes",
    accessedAt: "2026-10-25",
    sourceLastModified: "2021-09-03",
    verification: "published",
    note:
      "Official public wiki consulted 2026-10-25. Its own last-modified date is 2021-09-03 and is not treated as a fresh rule verification. The page calls promotion automatic; this app still only reports eligibility.",
  },
  rankUnresolved: [
    "Seeding-time, points bonuses and VIP/staff appointment are not promotion thresholds for the structured next-rank goal.",
    "GB/TB text without a stated unit basis is read as the larger binary GiB/TiB value.",
  ],
  userClasses: [
    { name: "Registered", requirements: "Default class. Seed time 10 days" },
    {
      name: "Power User",
      requirements:
        "2 weeks registered, 200 GB uploaded, ratio above 1.1. 3% points bonus, seed time 8 days",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "tl-power-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 14, scope: "account", label: "At least 2 weeks registered" },
          { kind: "numeric", id: "tl-power-upload", metric: "uploadedBytes", comparison: "gt", requiredValue: 200 * GiB, scope: "account", unitReading: "conservative", label: "More than 200 GiB uploaded" },
          { kind: "numeric", id: "tl-power-ratio", metric: "accountRatio", comparison: "gt", requiredValue: 1.1, scope: "account", label: "Ratio above 1.1" },
        ],
      },
    },
    {
      name: "Super User",
      requirements:
        "12 weeks registered, 1 TB uploaded, ratio above 2.0. 5% points bonus, seed time 7 days",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "tl-super-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 84, scope: "account", label: "At least 12 weeks registered" },
          { kind: "numeric", id: "tl-super-upload", metric: "uploadedBytes", comparison: "gt", requiredValue: 1 * TiB, scope: "account", unitReading: "conservative", label: "More than 1 TiB uploaded" },
          { kind: "numeric", id: "tl-super-ratio", metric: "accountRatio", comparison: "gt", requiredValue: 2.0, scope: "account", label: "Ratio above 2.0" },
        ],
      },
    },
    {
      name: "Extreme User",
      requirements:
        "24 weeks registered, 10 TB uploaded, ratio above 5.0. 6% points bonus, seed time 6 days",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "tl-extreme-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 168, scope: "account", label: "At least 24 weeks registered" },
          { kind: "numeric", id: "tl-extreme-upload", metric: "uploadedBytes", comparison: "gt", requiredValue: 10 * TiB, scope: "account", unitReading: "conservative", label: "More than 10 TiB uploaded" },
          { kind: "numeric", id: "tl-extreme-ratio", metric: "accountRatio", comparison: "gt", requiredValue: 5.0, scope: "account", label: "Ratio above 5.0" },
        ],
      },
    },
    {
      name: "TL GOD",
      requirements:
        "52 weeks registered, 50 TB uploaded, ratio above 8.0. 8% points bonus, seed time 4 days",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "tl-god-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 364, scope: "account", label: "At least 52 weeks registered" },
          { kind: "numeric", id: "tl-god-upload", metric: "uploadedBytes", comparison: "gt", requiredValue: 50 * TiB, scope: "account", unitReading: "conservative", label: "More than 50 TiB uploaded" },
          { kind: "numeric", id: "tl-god-ratio", metric: "accountRatio", comparison: "gt", requiredValue: 8.0, scope: "account", label: "Ratio above 8.0" },
        ],
      },
    },
    {
      name: "VIP",
      requirements: "Assigned to donors by staff. 10% points bonus, no minimum seed time",
      outsideLadder: "above",
    },
  ],
  releaseGroups: [],
  bannedGroups: [],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  rules: {
    // wiki.torrentleech.org/doku.php/hnr gives two routes. Seed a torrent to at
    // least 1:1, or seed it for your class's minimum time. Hence `any`.
    // Freeleech is not exempt from either.
    minimumRatio: 1.0,
    // 10 days, the Registered-class requirement and the longest on the site.
    // The member's class is not knowable from the registry, and over-seeding
    // is the safe direction to be wrong in.
    seedTimeHours: 240,
    satisfactionMode: "any",
    loginIntervalDays: 0,
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: false,
  warningNote: "",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: false,
  profileUrlPattern: "/profile/{username}",
}
