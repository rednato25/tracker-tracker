// src/data/trackers/nordicq.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

const GiB = 1024 ** 3
const TiB = 1024 ** 4
const DAY = 86_400

export const nordicq: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "nordicq",
  name: "NordicQuality",
  abbreviation: "NQ",
  url: "https://nordicq.org",
  description:
    "Nordic general tracker for movies, TV, music, audiobooks, books, podcasts, games, software and XXX, with a strong seeder class ladder. Runs UNIT3D.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "unit3d",
  apiPath: "/api/user",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "General (Nordic)",
  contentCategories: ["Movies", "TV", "Music", "Books", "Audiobooks", "Games", "Apps", "XXX"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#38bdf8",
  logo: "",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "",
  statusPageUrl: "",

  // ── Community ───────────────────────────────────────────────────────
  rankProgression: "automatic",
  rankRequirementsSource: {
    url: "https://nordicq.org/",
    title: "NordicQuality user-class list, as transcribed by PT-depiler",
    accessedAt: "2026-11-10",
    sourceLastModified: null,
    verification: "unresolved",
    note:
      "The site's own class list is behind a login this project has no account on. Thresholds come from PT-depiler's nordicquality.ts (github.com/pt-plugins/PT-depiler), which transcribes them from the site. Read every threshold as at least; a week is 7 days.",
  },
  rankUnresolved: [
    "Thresholds are third-party and have not been read off the site by the owner.",
    "Seed size and average seed time are structured conditions the UNIT3D adapter does not collect, so they stay unknown until collected.",
    "Download slots, freeleech and H&R immunity are perks, not promotion thresholds.",
  ],
  userClasses: [
    {
      name: "User",
      requirements: "Ratio ≥ 0.40. 4 download slots",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "nq-user-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 0.4, scope: "account", label: "Ratio at least 0.40" },
        ],
      },
    },
    {
      name: "Power User",
      requirements:
        "Upload ≥ 250 GiB, ratio ≥ 1.00, age ≥ 1 month. 10 download slots",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "nq-power-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 30, scope: "account", label: "At least 1 month registered" },
          { kind: "numeric", id: "nq-power-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 250 * GiB, scope: "account", label: "At least 250 GiB uploaded" },
          { kind: "numeric", id: "nq-power-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 1.0, scope: "account", label: "Ratio at least 1.00" },
        ],
      },
    },
    {
      name: "Super User",
      requirements:
        "Upload ≥ 750 GiB, ratio ≥ 1.20, age ≥ 2 months. 25 download slots",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "nq-super-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 60, scope: "account", label: "At least 2 months registered" },
          { kind: "numeric", id: "nq-super-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 750 * GiB, scope: "account", label: "At least 750 GiB uploaded" },
          { kind: "numeric", id: "nq-super-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 1.2, scope: "account", label: "Ratio at least 1.20" },
        ],
      },
    },
    {
      name: "Extreme User",
      requirements: "Upload ≥ 4 TiB, ratio ≥ 1.40, age ≥ 3 months. 35 download slots",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "nq-extreme-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 90, scope: "account", label: "At least 3 months registered" },
          { kind: "numeric", id: "nq-extreme-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 4 * TiB, scope: "account", label: "At least 4 TiB uploaded" },
          { kind: "numeric", id: "nq-extreme-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 1.4, scope: "account", label: "Ratio at least 1.40" },
        ],
      },
    },
    {
      name: "Insane User",
      requirements: "Upload ≥ 15 TiB, ratio ≥ 1.50, age ≥ 6 months. 50 download slots",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "nq-insane-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 180, scope: "account", label: "At least 6 months registered" },
          { kind: "numeric", id: "nq-insane-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 15 * TiB, scope: "account", label: "At least 15 TiB uploaded" },
          { kind: "numeric", id: "nq-insane-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 1.5, scope: "account", label: "Ratio at least 1.50" },
        ],
      },
    },
    {
      name: "Super Seeder",
      requirements:
        "Ratio ≥ 1.00, seed size ≥ 5 TiB, avg seed time ≥ 1 week. 50 download slots, H&R immune",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "nq-superseeder-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 1.0, scope: "account", label: "Ratio at least 1.00" },
          { kind: "numeric", metric: "seedSizeBytes", comparison: "gte", requiredValue: 5 * TiB, scope: "account", label: "Seed size ≥ 5 TiB" },
          { kind: "numeric", metric: "averageSeedTimeSeconds", comparison: "gte", requiredValue: 7 * DAY, scope: "account", label: "Average seed time ≥ 1 week" },
        ],
      },
    },
    {
      name: "Torrent King",
      requirements:
        "Ratio ≥ 1.00, seed size ≥ 10 TiB, avg seed time ≥ 4 weeks. Downloads not counted, H&R immune",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "nq-king-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 1.0, scope: "account", label: "Ratio at least 1.00" },
          { kind: "numeric", metric: "seedSizeBytes", comparison: "gte", requiredValue: 10 * TiB, scope: "account", label: "Seed size ≥ 10 TiB" },
          { kind: "numeric", metric: "averageSeedTimeSeconds", comparison: "gte", requiredValue: 28 * DAY, scope: "account", label: "Average seed time ≥ 4 weeks" },
        ],
      },
    },
    { name: "Disabled", requirements: "Administrative state", outsideLadder: "below" },
    { name: "Banned", requirements: "Administrative state", outsideLadder: "below" },
    { name: "Vip", requirements: "Granted or staff class", outsideLadder: "above" },
    { name: "Uploader", requirements: "Granted or staff class", outsideLadder: "above" },
    { name: "Internal", requirements: "Granted or staff class", outsideLadder: "above" },
    { name: "Moderator", requirements: "Granted or staff class", outsideLadder: "above" },
    { name: "Administrator", requirements: "Granted or staff class", outsideLadder: "above" },
  ],
  releaseGroups: [],
  bannedGroups: [],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  // Prowlarr Indexers definitions/v11/nordicquality.yml: "global MR is 0.4 but
  // torrents must be seeded for 3 days or 1:1", and the site's own inactivity
  // text: "you are required to login to the site at least once every 90 days".
  rules: {
    requiredAccountRatio: 0.4,
    requiredTorrentRatio: 1.0,
    minimumRatio: 0.4,
    seedTimeHours: 72,
    loginIntervalDays: 90,
    satisfactionMode: "any",
    fullRulesMarkdown: [
      "## Ratio",
      "",
      "- The global minimum ratio is 0.40",
      "- Seed each torrent for 3 days, or to ratio 1:1, whichever comes first",
      "",
      "## Account",
      "",
      "- Log in at least once every 90 days or the account is disabled",
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
