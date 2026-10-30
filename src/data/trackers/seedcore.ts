// src/data/trackers/seedcore.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

const TiB = 1024 ** 4

export const seedcore: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "seedcore",
  name: "SeedCore",
  abbreviation: "",
  url: "https://seedcore.net",
  description:
    "Romanian general tracker, formerly RoTorrent, covering movies, TV, music, games and XXX. Joining takes an invite or an application.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "unit3d",
  apiPath: "/api/user",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "General",
  contentCategories: ["Movies", "TV", "Music", "Games", "XXX"],
  language: "Romanian",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#1fa2ff",
  logo: "/tracker-logos/seedcore_logo.png",

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
    "VIP, trustee, internal and staff classes are outside the earned ladder.",
  ],
  userClasses: [
    { name: "Disabled", requirements: "Disabled account, no privileges", outsideLadder: "below" },
    { name: "Banned", requirements: "Violated site rules", outsideLadder: "below" },
    { name: "Pruned", requirements: "Pruned for inactivity", outsideLadder: "below" },
    { name: "Leech", requirements: "Ratio below 0.40. Downloads disabled", outsideLadder: "below" },
    {
      name: "User",
      requirements: "Ratio ≥ 0.40",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "sc-user-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 0.4, scope: "account", label: "Ratio at least 0.40" },
        ],
      },
    },
    {
      name: "PowerUser",
      requirements: "Upload ≥ 1 TiB, ratio ≥ 0.40, age ≥ 1 month",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "sc-power-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 30, scope: "account", label: "At least 1 month registered" },
          { kind: "numeric", id: "sc-power-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 1 * TiB, scope: "account", label: "At least 1 TiB uploaded" },
          { kind: "numeric", id: "sc-power-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 0.4, scope: "account", label: "Ratio at least 0.40" },
        ],
      },
    },
    {
      name: "SuperUser",
      requirements: "Upload ≥ 5 TiB, ratio ≥ 0.40, age ≥ 2 months",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "sc-super-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 60, scope: "account", label: "At least 2 months registered" },
          { kind: "numeric", id: "sc-super-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 5 * TiB, scope: "account", label: "At least 5 TiB uploaded" },
          { kind: "numeric", id: "sc-super-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 0.4, scope: "account", label: "Ratio at least 0.40" },
        ],
      },
    },
    {
      name: "ExtremeUser",
      requirements: "Upload ≥ 20 TiB, ratio ≥ 0.40, age ≥ 3 months",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "sc-extreme-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 90, scope: "account", label: "At least 3 months registered" },
          { kind: "numeric", id: "sc-extreme-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 20 * TiB, scope: "account", label: "At least 20 TiB uploaded" },
          { kind: "numeric", id: "sc-extreme-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 0.4, scope: "account", label: "Ratio at least 0.40" },
        ],
      },
    },
    {
      name: "InsaneUser",
      requirements: "Upload ≥ 50 TiB, ratio ≥ 0.40, age ≥ 6 months",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "sc-insane-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 180, scope: "account", label: "At least 6 months registered" },
          { kind: "numeric", id: "sc-insane-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 50 * TiB, scope: "account", label: "At least 50 TiB uploaded" },
          { kind: "numeric", id: "sc-insane-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 0.4, scope: "account", label: "Ratio at least 0.40" },
        ],
      },
    },
    {
      name: "Veteran",
      requirements: "Upload ≥ 100 TiB, ratio ≥ 0.40, age ≥ 1 year",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "sc-veteran-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 365, scope: "account", label: "At least 1 year registered" },
          { kind: "numeric", id: "sc-veteran-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 100 * TiB, scope: "account", label: "At least 100 TiB uploaded" },
          { kind: "numeric", id: "sc-veteran-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 0.4, scope: "account", label: "Ratio at least 0.40" },
        ],
      },
    },
    {
      name: "Seeder",
      requirements: "Ratio ≥ 0.40, age ≥ 1 month, seed size ≥ 5 TiB, avg seedtime ≥ 1 month",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "sc-seeder-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 30, scope: "account", label: "At least 1 month registered" },
          { kind: "numeric", id: "sc-seeder-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 0.4, scope: "account", label: "Ratio at least 0.40" },
          { kind: "non-numeric", label: "Seed size ≥ 5 TiB" },
          { kind: "non-numeric", label: "Average seed time ≥ 1 month" },
        ],
      },
    },
    {
      name: "Archivist",
      requirements: "Ratio ≥ 0.40, age ≥ 3 months, seed size ≥ 10 TiB, avg seedtime ≥ 2 months",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "sc-archivist-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 90, scope: "account", label: "At least 3 months registered" },
          { kind: "numeric", id: "sc-archivist-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 0.4, scope: "account", label: "Ratio at least 0.40" },
          { kind: "non-numeric", label: "Seed size ≥ 10 TiB" },
          { kind: "non-numeric", label: "Average seed time ≥ 2 months" },
        ],
      },
    },
    { name: "VIP", requirements: "Staff assigned", outsideLadder: "above" },
    { name: "Trustee", requirements: "Staff assigned", outsideLadder: "above" },
    { name: "Internal", requirements: "Staff assigned", outsideLadder: "above" },
    { name: "Uploader", requirements: "Staff", outsideLadder: "above" },
    { name: "Editor", requirements: "Staff", outsideLadder: "above" },
    { name: "Torrent Moderator", requirements: "Staff", outsideLadder: "above" },
    { name: "Moderator", requirements: "Staff", outsideLadder: "above" },
    { name: "Administrator", requirements: "Staff", outsideLadder: "above" },
  ],
  releaseGroups: [],
  bannedGroups: [
    "300MB Movies",
    "AFG",
    "AnimeRG",
    "BONE",
    "CMRG",
    "Cinemaluxe",
    "Cleo",
    "EMBER",
    "ETRG",
    "EVO",
    "EliteMovieRG",
    "ExtraTorrentRG",
    "GalaxyRG",
    "Ganool",
    "ION10",
    "IceBane",
    "KiNGDOM",
    "MeGusta",
    "MiniHD",
    "PSA",
    "Pahe",
    "RARBG",
    "RMTeam",
    "RMTeamX",
    "RZeroX",
    "SPHD",
    "SPWEB",
    "ShAaNiG",
    "TARTAR",
    "TERMiNAL",
    "TGx",
    "UTR",
    "VXT",
    "Vyndros",
    "YIFY",
    "YTS",
    "mSD",
    "nItRo",
  ],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  // Prowlarr Indexers definitions/v11/seedcore-api.yml sets minimumseedtime: 259200
  rules: {
    minimumRatio: 0.4,
    seedTimeHours: 72,
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
