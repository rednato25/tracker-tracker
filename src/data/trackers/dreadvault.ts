// src/data/trackers/dreadvault.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

const TiB = 1024 ** 4
const DAY = 86_400

export const dreadvault: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "dreadvault",
  name: "DreadVault",
  abbreviation: "DV",
  url: "https://dreadvault.org",
  description: "Private tracker for horror movies and TV.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "unit3d",
  apiPath: "/api/user",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "Horror content",
  contentCategories: ["Movies", "TV", "Books", "Music"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#d40207",
  logo: "/tracker-logos/dreadvault_logo.png",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "",
  statusPageUrl: "",

  // ── Community ───────────────────────────────────────────────────────
  rankProgression: "automatic",
  rankRequirementsSource: {
    url: "https://dreadvault.org/",
    title: "DreadVault Groups page",
    accessedAt: "2026-11-11",
    sourceLastModified: null,
    verification: "published",
    note:
      "Read off the site's Groups page by the owner on 2026-11-11 while logged in. Every threshold is at least. UNIT3D counts a month as 30 days and a year as 365.",
  },
  rankUnresolved: [
    "Seed size, average seed time and the upload count are not in the UNIT3D API. They come from the opt-in profile page read and stay unknown without it.",
    "TiB text is read as written.",
    "VIP, patron and staff-assigned classes are outside the earned ladder.",
    "The Groups page lists a 0.60 minimum ratio on Leech and none on User; the site-wide minimum ratio below comes from a Jackett report and is not on that page.",
  ],
  userClasses: [
    { name: "Validating", requirements: "Email address not confirmed yet", outsideLadder: "below" },
    { name: "Guest", requirements: "Administrative state", outsideLadder: "below" },
    { name: "Disabled", requirements: "Administrative state", outsideLadder: "below" },
    { name: "Banned", requirements: "Exiled from the realm", outsideLadder: "below" },
    { name: "Pruned", requirements: "The Forgotten: removed for inactivity", outsideLadder: "below" },
    {
      name: "Leech",
      requirements: "Demotion class, no download slots. The Groups page lists a 0.60 ratio for it",
    },
    { name: "User", requirements: "No class requirement on the Groups page. Unlimited download slots" },
    {
      name: "Wanderer",
      requirements: "Ratio ≥ 0.4, min upload ≥ 1TiB, account age ≥ 1 month",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "dv-wanderer-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 30, scope: "account", label: "At least 1 month registered" },
          { kind: "numeric", id: "dv-wanderer-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 1 * TiB, scope: "account", label: "At least 1 TiB uploaded" },
          { kind: "numeric", id: "dv-wanderer-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 0.4, scope: "account", label: "Ratio at least 0.4" },
        ],
      },
    },
    {
      name: "Survivor",
      requirements: "Ratio ≥ 0.4, min upload ≥ 5TiB, account age ≥ 2 months, at least 5 uploads",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "dv-survivor-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 60, scope: "account", label: "At least 2 months registered" },
          { kind: "numeric", id: "dv-survivor-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 5 * TiB, scope: "account", label: "At least 5 TiB uploaded" },
          { kind: "numeric", id: "dv-survivor-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 0.4, scope: "account", label: "Ratio at least 0.4" },
          { kind: "numeric", id: "dv-survivor-uploads", metric: "uploads", comparison: "gte", requiredValue: 5, scope: "account", label: "At least 5 uploads" },
        ],
      },
    },
    {
      name: "Night Stalker",
      requirements: "Ratio ≥ 0.4, min upload ≥ 20TiB, account age ≥ 3 months, at least 20 uploads",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "dv-night-stalker-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 90, scope: "account", label: "At least 3 months registered" },
          { kind: "numeric", id: "dv-night-stalker-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 20 * TiB, scope: "account", label: "At least 20 TiB uploaded" },
          { kind: "numeric", id: "dv-night-stalker-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 0.4, scope: "account", label: "Ratio at least 0.4" },
          { kind: "numeric", id: "dv-night-stalker-uploads", metric: "uploads", comparison: "gte", requiredValue: 20, scope: "account", label: "At least 20 uploads" },
        ],
      },
    },
    {
      name: "Grave Keeper",
      requirements: "Ratio ≥ 0.4, min upload ≥ 50TiB, account age ≥ 6 months, at least 50 uploads",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "dv-grave-keeper-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 180, scope: "account", label: "At least 6 months registered" },
          { kind: "numeric", id: "dv-grave-keeper-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 50 * TiB, scope: "account", label: "At least 50 TiB uploaded" },
          { kind: "numeric", id: "dv-grave-keeper-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 0.4, scope: "account", label: "Ratio at least 0.4" },
          { kind: "numeric", id: "dv-grave-keeper-uploads", metric: "uploads", comparison: "gte", requiredValue: 50, scope: "account", label: "At least 50 uploads" },
        ],
      },
    },
    {
      name: "Dreadborn",
      requirements: "Ratio ≥ 0.4, min upload ≥ 100TiB, account age ≥ 1 year, at least 100 uploads",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "dv-dreadborn-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 365, scope: "account", label: "At least 1 year registered" },
          { kind: "numeric", id: "dv-dreadborn-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 100 * TiB, scope: "account", label: "At least 100 TiB uploaded" },
          { kind: "numeric", id: "dv-dreadborn-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 0.4, scope: "account", label: "Ratio at least 0.4" },
          { kind: "numeric", id: "dv-dreadborn-uploads", metric: "uploads", comparison: "gte", requiredValue: 100, scope: "account", label: "At least 100 uploads" },
        ],
      },
    },
    {
      name: "Shadow Walker",
      requirements:
        "Ratio ≥ 0.4, min seedsize ≥ 5TiB, min avg. seedtime ≥ 1 month, account age ≥ 1 month, at least 5 uploads",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "dv-shadow-walker-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 30, scope: "account", label: "At least 1 month registered" },
          { kind: "numeric", id: "dv-shadow-walker-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 0.4, scope: "account", label: "Ratio at least 0.4" },
          { kind: "numeric", id: "dv-shadow-walker-uploads", metric: "uploads", comparison: "gte", requiredValue: 5, scope: "account", label: "At least 5 uploads" },
          { kind: "numeric", metric: "seedSizeBytes", comparison: "gte", requiredValue: 5 * TiB, scope: "account", label: "Seed size ≥ 5 TiB" },
          { kind: "numeric", metric: "averageSeedTimeSeconds", comparison: "gte", requiredValue: 30 * DAY, scope: "account", label: "Average seed time ≥ 1 month" },
        ],
      },
    },
    {
      name: "Bloodbound",
      requirements:
        "Ratio ≥ 0.4, min seedsize ≥ 10TiB, min avg. seedtime ≥ 2 months, account age ≥ 3 months, at least 10 uploads",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "dv-bloodbound-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 90, scope: "account", label: "At least 3 months registered" },
          { kind: "numeric", id: "dv-bloodbound-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 0.4, scope: "account", label: "Ratio at least 0.4" },
          { kind: "numeric", id: "dv-bloodbound-uploads", metric: "uploads", comparison: "gte", requiredValue: 10, scope: "account", label: "At least 10 uploads" },
          { kind: "numeric", metric: "seedSizeBytes", comparison: "gte", requiredValue: 10 * TiB, scope: "account", label: "Seed size ≥ 10 TiB" },
          { kind: "numeric", metric: "averageSeedTimeSeconds", comparison: "gte", requiredValue: 60 * DAY, scope: "account", label: "Average seed time ≥ 2 months" },
        ],
      },
    },
    {
      name: "Plague Doctor",
      requirements: "An ancient presence whose experience commands respect",
      outsideLadder: "above",
    },
    { name: "DVL", requirements: "Internal group", outsideLadder: "above" },
    {
      name: "Harbinger",
      requirements: "A feared and respected presence among the realm's greatest",
      outsideLadder: "above",
    },
    {
      name: "Elite Harbinger",
      requirements: "A legendary veteran who has stood beyond the passage of time",
      outsideLadder: "above",
    },
    { name: "Crypt Patron", requirements: "Supporter class: the first offering", outsideLadder: "above" },
    {
      name: "Vault Sovereign",
      requirements:
        "A supporter of DreadVault who has chosen to fuel the darkness. VIP status grants exclusive benefits for the selected duration",
      outsideLadder: "above",
    },
    {
      name: "The Eternal",
      requirements:
        "A timeless supporter of DreadVault. The Eternal has earned a permanent place within the darkness",
      outsideLadder: "above",
    },
    {
      name: "The Dread Ascendant",
      requirements:
        "A supreme patron of DreadVault. The Dread Ascendant has risen beyond ordinary supporters and stands among the highest ranks of the darkness",
      outsideLadder: "above",
    },
    { name: "Grim Reaper", requirements: "VIP supporter class", outsideLadder: "above" },
    { name: "Lorekeeper", requirements: "Granted or staff class", outsideLadder: "above" },
    { name: "Vault Warden", requirements: "Granted or staff class", outsideLadder: "above" },
    { name: "Bot", requirements: "System account", outsideLadder: "above" },
  ],
  releaseGroups: [],
  bannedGroups: ["YTS", "YIFY", "RARBG", "VXT", "BONE", "NeoNoir", "PSA", "EVO"],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  // Jackett issue #17027: "MST 120 hrs (Global MR 0.7)"
  rules: {
    minimumRatio: 0.7,
    seedTimeHours: 120,
    loginIntervalDays: 0,
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: true,
  warningNote: "Unverified! Not tested against a live account.",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: false,
  profileUrlPattern: "",
}
