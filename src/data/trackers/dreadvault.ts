// src/data/trackers/dreadvault.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

const TiB = 1024 ** 4

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
    url: null,
    title: "Existing registry free text; rules page is login-gated",
    accessedAt: null,
    sourceLastModified: null,
    verification: "unresolved",
    note:
      "Thresholds come from the existing registry text. The tracker's rules page is login-gated, so this change does not independently re-read it.",
  },
  rankUnresolved: [
    "Seed size and average seed time are not supported rank metrics and stay as unsupported conditions.",
    "TiB text is read as written.",
    "VIP, patron and staff-assigned classes are outside the earned ladder.",
  ],
  userClasses: [
    { name: "Leech", requirements: "Ratio below 0.4. Downloads disabled", outsideLadder: "below" },
    {
      name: "User",
      requirements: "Ratio ≥ 0.4",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "dv-user-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 0.4, scope: "account", label: "Ratio at least 0.4" },
        ],
      },
    },
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
      requirements: "Ratio ≥ 0.4, min upload ≥ 5TiB, account age ≥ 2 months",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "dv-survivor-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 60, scope: "account", label: "At least 2 months registered" },
          { kind: "numeric", id: "dv-survivor-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 5 * TiB, scope: "account", label: "At least 5 TiB uploaded" },
          { kind: "numeric", id: "dv-survivor-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 0.4, scope: "account", label: "Ratio at least 0.4" },
        ],
      },
    },
    {
      name: "Night Stalker",
      requirements: "Ratio ≥ 0.4, min upload ≥ 20TiB, account age ≥ 3 months",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "dv-night-stalker-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 90, scope: "account", label: "At least 3 months registered" },
          { kind: "numeric", id: "dv-night-stalker-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 20 * TiB, scope: "account", label: "At least 20 TiB uploaded" },
          { kind: "numeric", id: "dv-night-stalker-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 0.4, scope: "account", label: "Ratio at least 0.4" },
        ],
      },
    },
    {
      name: "Grave Keeper",
      requirements: "Ratio ≥ 0.4, min upload ≥ 50TiB, account age ≥ 6 months",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "dv-grave-keeper-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 180, scope: "account", label: "At least 6 months registered" },
          { kind: "numeric", id: "dv-grave-keeper-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 50 * TiB, scope: "account", label: "At least 50 TiB uploaded" },
          { kind: "numeric", id: "dv-grave-keeper-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 0.4, scope: "account", label: "Ratio at least 0.4" },
        ],
      },
    },
    {
      name: "Dreadborn",
      requirements: "Ratio ≥ 0.4, min upload ≥ 100TiB, account age ≥ 1 year",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "dv-dreadborn-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 365, scope: "account", label: "At least 1 year registered" },
          { kind: "numeric", id: "dv-dreadborn-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 100 * TiB, scope: "account", label: "At least 100 TiB uploaded" },
          { kind: "numeric", id: "dv-dreadborn-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 0.4, scope: "account", label: "Ratio at least 0.4" },
        ],
      },
    },
    {
      name: "Shadow Walker",
      requirements:
        "Ratio ≥ 0.4, min seedsize ≥ 5TiB, min avg. seedtime ≥ 1 month, account age ≥ 1 month",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "dv-shadow-walker-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 30, scope: "account", label: "At least 1 month registered" },
          { kind: "numeric", id: "dv-shadow-walker-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 0.4, scope: "account", label: "Ratio at least 0.4" },
          { kind: "non-numeric", label: "Seed size ≥ 5 TiB" },
          { kind: "non-numeric", label: "Average seed time ≥ 1 month" },
        ],
      },
    },
    {
      name: "Bloodbound",
      requirements:
        "Ratio ≥ 0.4, min seedsize ≥ 10TiB, min avg. seedtime ≥ 2 months, account age ≥ 3 months",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "dv-bloodbound-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 90, scope: "account", label: "At least 3 months registered" },
          { kind: "numeric", id: "dv-bloodbound-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 0.4, scope: "account", label: "Ratio at least 0.4" },
          { kind: "non-numeric", label: "Seed size ≥ 10 TiB" },
          { kind: "non-numeric", label: "Average seed time ≥ 2 months" },
        ],
      },
    },
    {
      name: "Ancient One",
      requirements:
        "Ratio ≥ 1.5, min upload ≥ 10TiB, account age ≥ 6 months, min avg. seedtime ≥ 1 month, min seedsize ≥ 5TiB, min uploads 500",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "dv-ancient-one-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 180, scope: "account", label: "At least 6 months registered" },
          { kind: "numeric", id: "dv-ancient-one-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 10 * TiB, scope: "account", label: "At least 10 TiB uploaded" },
          { kind: "numeric", id: "dv-ancient-one-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 1.5, scope: "account", label: "Ratio at least 1.5" },
          { kind: "numeric", id: "dv-ancient-one-uploads", metric: "uploads", comparison: "gte", requiredValue: 500, scope: "account", label: "At least 500 uploads" },
          { kind: "non-numeric", label: "Average seed time ≥ 1 month" },
          { kind: "non-numeric", label: "Seed size ≥ 5 TiB" },
        ],
      },
    },
    {
      name: "Elder",
      requirements: "An ancient presence whose experience commands respect",
      outsideLadder: "above",
    },
    {
      name: "Harbinger",
      requirements: "A feared and respected presence among the realm's greatest",
      outsideLadder: "above",
    },
    {
      name: "VIP",
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
