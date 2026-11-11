// src/data/trackers/latteam.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

const TiB = 1024 ** 4
const DAY = 86_400

export const latteam: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "latteam",
  name: "Lat-Team",
  abbreviation: "LT",
  url: "https://lat-team.com",
  description:
    "Spanish-language tracker for Latin American movies, TV, telenovelas and doramas, with music, books, games, courses and XXX alongside. Runs UNIT3D.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "unit3d",
  apiPath: "/api/user",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "Latino Movies / TV",
  contentCategories: [
    "Movies",
    "TV",
    "Anime",
    "Music",
    "Sports",
    "Books",
    "Audiobooks",
    "Games",
    "Apps",
    "XXX",
    "Education",
    "Comics",
    "Manga",
  ],
  language: "Spanish",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#f97316",
  logo: "",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "",
  statusPageUrl: "",

  // ── Community ───────────────────────────────────────────────────────
  rankProgression: "automatic",
  rankRequirementsSource: {
    url: "https://lat-team.com/",
    title: "Lat-Team user-class list, as transcribed by PT-depiler",
    accessedAt: "2026-11-10",
    sourceLastModified: null,
    verification: "unresolved",
    note:
      "The site's own class list is behind a login this project has no account on. Thresholds come from PT-depiler's latteam.ts (github.com/pt-plugins/PT-depiler), which transcribes them from the site. Read every threshold as at least; a month is 30 days and a year is 365.",
  },
  rankUnresolved: [
    "Thresholds are third-party and have not been read off the site by the owner.",
    "Seed size and average seed time are not in the UNIT3D API. They come from the opt-in profile page read and stay unknown without it.",
    "Download slots and H&R immunity are perks, not promotion thresholds.",
  ],
  userClasses: [
    {
      name: "User",
      requirements: "Ratio ≥ 0.25. 5 download slots",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "lt-user-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 0.25, scope: "account", label: "Ratio at least 0.25" },
        ],
      },
    },
    {
      name: "PowerUser",
      requirements: "Upload ≥ 1 TiB, ratio ≥ 0.40, age ≥ 1 month. 10 download slots",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "lt-power-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 30, scope: "account", label: "At least 1 month registered" },
          { kind: "numeric", id: "lt-power-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 1 * TiB, scope: "account", label: "At least 1 TiB uploaded" },
          { kind: "numeric", id: "lt-power-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 0.4, scope: "account", label: "Ratio at least 0.40" },
        ],
      },
    },
    {
      name: "SuperUser",
      requirements: "Upload ≥ 5 TiB, ratio ≥ 0.40, age ≥ 2 months. 15 download slots",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "lt-super-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 60, scope: "account", label: "At least 2 months registered" },
          { kind: "numeric", id: "lt-super-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 5 * TiB, scope: "account", label: "At least 5 TiB uploaded" },
          { kind: "numeric", id: "lt-super-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 0.4, scope: "account", label: "Ratio at least 0.40" },
        ],
      },
    },
    {
      name: "ExtremeUser",
      requirements: "Upload ≥ 20 TiB, ratio ≥ 0.40, age ≥ 3 months. 20 download slots",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "lt-extreme-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 90, scope: "account", label: "At least 3 months registered" },
          { kind: "numeric", id: "lt-extreme-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 20 * TiB, scope: "account", label: "At least 20 TiB uploaded" },
          { kind: "numeric", id: "lt-extreme-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 0.4, scope: "account", label: "Ratio at least 0.40" },
        ],
      },
    },
    {
      name: "InsaneUser",
      requirements: "Upload ≥ 50 TiB, ratio ≥ 0.40, age ≥ 6 months. 25 download slots",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "lt-insane-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 180, scope: "account", label: "At least 6 months registered" },
          { kind: "numeric", id: "lt-insane-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 50 * TiB, scope: "account", label: "At least 50 TiB uploaded" },
          { kind: "numeric", id: "lt-insane-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 0.4, scope: "account", label: "Ratio at least 0.40" },
        ],
      },
    },
    {
      name: "Veteran",
      requirements:
        "Upload ≥ 100 TiB, ratio ≥ 0.40, age ≥ 1 year. 30 download slots, H&R immune",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "lt-veteran-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 365, scope: "account", label: "At least 1 year registered" },
          { kind: "numeric", id: "lt-veteran-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 100 * TiB, scope: "account", label: "At least 100 TiB uploaded" },
          { kind: "numeric", id: "lt-veteran-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 0.4, scope: "account", label: "Ratio at least 0.40" },
        ],
      },
    },
    {
      name: "Seeder",
      requirements:
        "Ratio ≥ 0.40, age ≥ 1 month, seed size ≥ 5 TiB, avg seed time ≥ 1 month. 35 download slots, H&R immune",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "lt-seeder-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 30, scope: "account", label: "At least 1 month registered" },
          { kind: "numeric", id: "lt-seeder-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 0.4, scope: "account", label: "Ratio at least 0.40" },
          { kind: "numeric", metric: "seedSizeBytes", comparison: "gte", requiredValue: 5 * TiB, scope: "account", label: "Seed size ≥ 5 TiB" },
          { kind: "numeric", metric: "averageSeedTimeSeconds", comparison: "gte", requiredValue: 30 * DAY, scope: "account", label: "Average seed time ≥ 1 month" },
        ],
      },
    },
    {
      name: "Archivist",
      requirements:
        "Ratio ≥ 0.40, age ≥ 3 months, seed size ≥ 10 TiB, avg seed time ≥ 2 months. Unlimited download slots, sitewide freeleech, H&R immune",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "lt-archivist-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 90, scope: "account", label: "At least 3 months registered" },
          { kind: "numeric", id: "lt-archivist-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 0.4, scope: "account", label: "Ratio at least 0.40" },
          { kind: "numeric", metric: "seedSizeBytes", comparison: "gte", requiredValue: 10 * TiB, scope: "account", label: "Seed size ≥ 10 TiB" },
          { kind: "numeric", metric: "averageSeedTimeSeconds", comparison: "gte", requiredValue: 60 * DAY, scope: "account", label: "Average seed time ≥ 2 months" },
        ],
      },
    },
    { name: "Disabled", requirements: "Administrative state", outsideLadder: "below" },
    { name: "Banned", requirements: "Administrative state", outsideLadder: "below" },
    { name: "Validating", requirements: "Administrative state", outsideLadder: "below" },
    { name: "Vip", requirements: "Granted or staff class", outsideLadder: "above" },
    { name: "Uploader", requirements: "Granted or staff class", outsideLadder: "above" },
    { name: "Encoder", requirements: "Granted or staff class", outsideLadder: "above" },
    { name: "Moderator", requirements: "Granted or staff class", outsideLadder: "above" },
    { name: "Administrator", requirements: "Granted or staff class", outsideLadder: "above" },
  ],
  releaseGroups: [],
  bannedGroups: [],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  // Prowlarr Indexers definitions/v11/lat-team-api.yml: "global MR is 0.25 but
  // torrents must be seeded for 3 days regardless of ratio", and account
  // inactivity is a login once every 90 days or 5 torrents seeded.
  rules: {
    requiredAccountRatio: 0.25,
    // The 3-day seed is the only route out, so the per-torrent ratio is not one.
    requiredTorrentRatio: 0,
    minimumRatio: 0.25,
    seedTimeHours: 72,
    loginIntervalDays: 90,
    fullRulesMarkdown: [
      "## Ratio",
      "",
      "- The global minimum ratio is 0.25",
      "- Torrents must be seeded for 3 days regardless of ratio",
      "",
      "## Account",
      "",
      "- Log in once every 90 days, or keep at least 5 torrents seeding, or the account is deactivated",
      "",
      "## Classes",
      "",
      "- Promotion is automatic from upload, ratio and account age, then seed size and average seed time above Veteran",
      "- Download slots, invites and H&R immunity come with the higher classes",
    ],
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: false,
  warningNote: "",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: false,
  profileUrlPattern: "",
}
