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
    title: "NordicQuality Groups page",
    accessedAt: "2026-11-11",
    sourceLastModified: null,
    verification: "published",
    note:
      "Read off the site's Groups page by the owner on 2026-11-11 while logged in; every threshold matches PT-depiler's earlier transcription. Read every threshold as at least. UNIT3D counts a month as 30 days and a week as 7.",
  },
  rankUnresolved: [
    "Seed size and average seed time are not in the UNIT3D API. They come from the opt-in profile page read and stay unknown without it.",
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
    { name: "ViP", requirements: "Granted or staff class", outsideLadder: "above" },
    { name: "Trial Uploader", requirements: "Granted uploader class; uploads need moderator approval", outsideLadder: "above" },
    { name: "Uploader", requirements: "Granted or staff class", outsideLadder: "above" },
    { name: "Internal", requirements: "Granted or staff class", outsideLadder: "above" },
    { name: "Moderator", requirements: "Granted or staff class", outsideLadder: "above" },
    { name: "Administrator", requirements: "Granted or staff class", outsideLadder: "above" },
  ],
  releaseGroups: [],
  bannedGroups: [],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  // The site's rules and FAQ, read by the owner on 2026-11-11: ratio below 0.4
  // disables downloads; seed each torrent to 1:1 or for 72 hours once 20% is
  // downloaded; "login to the site at least once every 180 days". The older
  // Prowlarr definition said 90 days.
  rules: {
    requiredAccountRatio: 0.4,
    requiredTorrentRatio: 1.0,
    minimumRatio: 0.4,
    seedTimeHours: 72,
    loginIntervalDays: 180,
    satisfactionMode: "any",
    fullRulesMarkdown: [
      "## Ratio",
      "",
      "- The global minimum ratio is 0.40; below it download rights are disabled",
      "- Seed each torrent for 3 days, or to ratio 1:1, whichever comes first",
      "- A torrent counts only once at least 20% of it is downloaded; there is no part-seeding",
      "- These rules apply to freeleech and featured torrents too",
      "",
      "## Warnings",
      "",
      "- 24 hours disconnected from a torrent gives a pre-warning, 7 days a warning",
      "- 3 active warnings disable download rights; warnings expire after 8 weeks",
      "",
      "## Account",
      "",
      "- Log in at least once every 180 days or the account is disabled",
      "- A disabled account is pruned for good after another 180 days without a login",
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
