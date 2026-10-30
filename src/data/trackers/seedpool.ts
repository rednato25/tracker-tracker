// src/data/trackers/seedpool.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

const GiB = 1024 ** 3
const TiB = 1024 ** 4

export const seedpool: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "seedpool",
  name: "seedpool",
  abbreviation: "SP",
  url: "https://seedpool.org",
  description:
    "General private tracker with a focus on long term seeding and a welcoming community. Known for its active IRC.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "unit3d",
  apiPath: "/api/user",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "",
  contentCategories: [
    "Movies",
    "TV",
    "Music",
    "Games",
    "Apps",
    "Sports",
    "Education",
    "Audiobooks",
  ],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#22c55e",
  logo: "/tracker-logos/seedpool_logo.png",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "",
  statusPageUrl: "https://status.seedpool.org/",

  // ── Community ───────────────────────────────────────────────────────
  rankProgression: "automatic",
  rankRequirementsSource: {
    url: "https://seedpool.org/",
    title: "seedpool user-class list",
    accessedAt: "2026-10-31",
    sourceLastModified: null,
    verification: "published",
    note:
      "Confirmed by the owner on 2026-10-31 from the site's user-class list. Every automatic class needs ratio 1.00; 1M means 30 days; all comparisons are at least.",
  },
  rankUnresolved: [
    "Seed size is a structured rank condition; the UNIT3D adapter does not collect it yet, so it stays unknown until collected.",
    "ProPool is bought or gifted in IRC and sits outside the earned ladder.",
    "Request, invite, freeleech and unsatisfied-slot counts are perks, not promotion thresholds.",
  ],
  userClasses: [
    {
      name: "User",
      requirements: "Ratio ≥ 1.00 — DL Slots: ∞, Unsatisfied Slots: 20",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "sp-user-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 1.0, scope: "account", label: "Ratio at least 1.00" },
        ],
      },
    },
    {
      name: "Pool",
      requirements:
        "Ratio ≥ 1.00; Seedsize ≥ 256 GiB; Age ≥ 1 month — Can Request, Send Invite, Unsatisfied Slots: 30",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "sp-pool-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 1.0, scope: "account", label: "Ratio at least 1.00" },
          { kind: "numeric", id: "sp-pool-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 30, scope: "account", label: "At least 1 month registered" },
          { kind: "numeric", metric: "seedSizeBytes", comparison: "gte", requiredValue: 256 * GiB, scope: "account", label: "Seed size ≥ 256 GiB" },
        ],
      },
    },
    {
      name: "PowerPool",
      requirements:
        "Ratio ≥ 1.00; Seedsize ≥ 512 GiB; Age ≥ 3 months — Can Fill Requests, Unsatisfied Slots: 50",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "sp-powerpool-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 1.0, scope: "account", label: "Ratio at least 1.00" },
          { kind: "numeric", id: "sp-powerpool-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 90, scope: "account", label: "At least 3 months registered" },
          { kind: "numeric", metric: "seedSizeBytes", comparison: "gte", requiredValue: 512 * GiB, scope: "account", label: "Seed size ≥ 512 GiB" },
        ],
      },
    },
    {
      name: "SuperPool",
      requirements:
        "Ratio ≥ 1.00; Seedsize ≥ 1 TiB; Age ≥ 6 months — Invite Forums, Freeleech, Unsatisfied Slots: 75",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "sp-superpool-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 1.0, scope: "account", label: "Ratio at least 1.00" },
          { kind: "numeric", id: "sp-superpool-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 180, scope: "account", label: "At least 6 months registered" },
          { kind: "numeric", metric: "seedSizeBytes", comparison: "gte", requiredValue: 1 * TiB, scope: "account", label: "Seed size ≥ 1 TiB" },
        ],
      },
    },
    {
      name: "UberPool",
      requirements:
        "Ratio ≥ 1.00; Seedsize ≥ 5 TiB; Age ≥ 9 months — Freeleech, Unsatisfied Slots: 100",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "sp-uberpool-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 1.0, scope: "account", label: "Ratio at least 1.00" },
          { kind: "numeric", id: "sp-uberpool-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 270, scope: "account", label: "At least 9 months registered" },
          { kind: "numeric", metric: "seedSizeBytes", comparison: "gte", requiredValue: 5 * TiB, scope: "account", label: "Seed size ≥ 5 TiB" },
        ],
      },
    },
    {
      name: "MegaPool",
      requirements:
        "Ratio ≥ 1.00; Seedsize ≥ 25 TiB; Age ≥ 12 months — Upload Torrents, Freeleech, Double Upload, Unsatisfied Slots: 125",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "sp-megapool-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 1.0, scope: "account", label: "Ratio at least 1.00" },
          { kind: "numeric", id: "sp-megapool-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 365, scope: "account", label: "At least 12 months registered" },
          { kind: "numeric", metric: "seedSizeBytes", comparison: "gte", requiredValue: 25 * TiB, scope: "account", label: "Seed size ≥ 25 TiB" },
        ],
      },
    },
    {
      name: "GodPool",
      requirements:
        "Ratio ≥ 1.00; Seedsize ≥ 100 TiB; Age ≥ 12 months — Upload Torrents, Freeleech, Double Upload, Unsatisfied Slots: 150",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "sp-godpool-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 1.0, scope: "account", label: "Ratio at least 1.00" },
          { kind: "numeric", id: "sp-godpool-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 365, scope: "account", label: "At least 12 months registered" },
          { kind: "numeric", metric: "seedSizeBytes", comparison: "gte", requiredValue: 100 * TiB, scope: "account", label: "Seed size ≥ 100 TiB" },
        ],
      },
    },
    // Off-ladder administrative and staff classes
    { name: "KiddiePool", requirements: "Timeoutzone", outsideLadder: "below" },
    { name: "NewPool", requirements: "Administrative state", outsideLadder: "below" },
    {
      name: "ProPool",
      requirements:
        "Can be bought or gifted with buffer in IRC — Freeleech, Double Upload, Unsatisfied Slots: 50",
      outsideLadder: "above",
    },
    {
      name: "FoundingPool",
      requirements: "Staff — founding members of Seed Pool. Freeleech, Unsatisfied Slots: 75",
      outsideLadder: "above",
    },
    {
      name: "SpecialPool",
      requirements:
        "Staff — outstanding members. Upload Torrents, Freeleech, Double Upload, Torrent Mod bypass, Unsatisfied Slots: 100",
      outsideLadder: "above",
    },
    {
      name: "External",
      requirements:
        "Staff — recognized release groups and respected tracker staff. Upload Torrents, Freeleech, Torrent Mod bypass, Unsatisfied Slots: 100",
      outsideLadder: "above",
    },
  ],
  releaseGroups: [],
  bannedGroups: [],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  rules: {
    minimumRatio: 1,
    seedTimeHours: 240,
    loginIntervalDays: 0,
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: false,
  warningNote: "",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: true,
  profileUrlPattern: "/users/{username}",
}
