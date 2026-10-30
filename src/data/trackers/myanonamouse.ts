// src/data/trackers/myanonamouse.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

const GiB = 1024 ** 3

export const myanonamouse: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "myanonamouse",
  name: "MyAnonaMouse",
  abbreviation: "MAM",
  url: "https://www.myanonamouse.net",
  description:
    "Book, audiobook, and comics tracker with an open interview for anyone who wants to join and an extremely friendly community.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "mam",
  apiPath: "/jsonLoad.php",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "Books / Audiobooks",
  contentCategories: ["Books", "Audiobooks", "Comics"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#ec407a",
  logo: "/tracker-logos/myanonamouse_logo.png",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "my-anona-mouse",
  statusPageUrl: "https://status.myanonamouse.net/",

  // ── Community ───────────────────────────────────────────────────────
  rankProgression: "mixed",
  rankRequirementsSource: {
    url: "https://www.myanonamouse.net/wiki/index.php?title=User_Classes",
    title: "MyAnonaMouse Wiki - User Classes",
    accessedAt: "2026-10-30",
    sourceLastModified: null,
    verification: "unresolved",
    note:
      "The official wiki is login-gated and returned 403 without a session. The numeric thresholds still come from the existing registry text and are not independently re-read here.",
  },
  rankUnresolved: [
    "Source is login-gated; promotion automation and class-appointment rules remain unresolved.",
    "No earned ladder class is missing structured thresholds: User and Power User are the only stat-earned classes with published numbers.",
    "GB/TB text without a stated unit basis is read as the larger binary GiB/TiB value.",
  ],
  userClasses: [
    { name: "Mouse", requirements: "Ratio below 1.0 (auto-demotion)", outsideLadder: "below" },
    {
      name: "User",
      requirements: "Ratio above 1.0",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "mam-user-ratio", metric: "accountRatio", comparison: "gt", requiredValue: 1.0, scope: "account", label: "Ratio above 1.0" },
        ],
      },
    },
    {
      name: "Power User",
      requirements: "4 weeks membership, 25 GB uploaded, 2.0 ratio",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "mam-power-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 28, scope: "account", label: "At least 4 weeks registered" },
          { kind: "numeric", id: "mam-power-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 25 * GiB, scope: "account", unitReading: "conservative", label: "At least 25 GiB uploaded" },
          { kind: "numeric", id: "mam-power-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 2.0, scope: "account", label: "Ratio at least 2.0" },
        ],
      },
    },
    { name: "Star", requirements: "Donor", outsideLadder: "above" },
    {
      name: "VIP",
      requirements: "Bonus points or donation (requires Power User first)",
      outsideLadder: "above",
    },
    {
      name: "Elite VIP",
      requirements: "Staff-selected for community contribution",
      outsideLadder: "above",
    },
    {
      name: "Elite",
      requirements: "Staff-selected, immune to auto-demotion",
      outsideLadder: "above",
    },
    { name: "Supporter", requirements: "Continuous supporter", outsideLadder: "above" },
    { name: "Mouseketeer", requirements: "Retired staff", outsideLadder: "above" },
    {
      name: "Uploader",
      requirements: "Staff-selected for consistent monthly uploads",
      outsideLadder: "above",
    },
  ],
  stats: {
    userCount: 114812,
    torrentCount: 1128625,
    statsUpdatedAt: "2026-03-26",
  },
  releaseGroups: [],
  bannedGroups: [],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  rules: {
    minimumRatio: 1.0,
    seedTimeHours: 72,
    loginIntervalDays: 120,
    fulfillmentPeriodHours: 720,
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: false,
  warningNote: "",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: false,
  profileUrlPattern: "",
}
