// src/data/trackers/onlyencodes.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

const TiB = 1024 ** 4
const GiB = 1024 ** 3
const DAY = 86_400

export const onlyencodes: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "onlyencodes",
  name: "OnlyEncodes",
  abbreviation: "OE",
  url: "https://onlyencodes.cc",
  description:
    "Specializes exclusively in high-quality video encodes. Curated library focused on the best possible encode for each title. Strict quality standards.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "unit3d",
  apiPath: "/api/user",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "High-quality video encodes",
  contentCategories: ["Movies", "TV"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#facc15",
  logo: "/tracker-logos/onlyencodes_logo.png",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "only-encodes",
  statusPageUrl: "",

  // ── Community ───────────────────────────────────────────────────────
  rankProgression: "automatic",
  rankRequirementsSource: {
    url: "https://onlyencodes.cc/",
    title: "OnlyEncodes user-class list",
    accessedAt: "2026-10-31",
    sourceLastModified: null,
    verification: "published",
    note:
      "Confirmed by the owner on 2026-10-31 from the site's user-class list. Sizes are TiB/GiB as written; 1M means 30 days and 1Y means 365 days; all comparisons are at least.",
  },
  rankUnresolved: [
    "Seed size and average seed time are rank metrics, but this tracker's adapter does not collect them yet; their conditions stay unknown.",
    "Invite sending, freeleech, H&R immunity and upload slots are perks, not promotion thresholds.",
    "TiB/GiB text is read as written.",
  ],
  userClasses: [
    // Dynamic. upload-based
    {
      name: "User",
      requirements: "Ratio ≥ 0.4",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "oe-user-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 0.4, scope: "account", label: "Ratio at least 0.4" },
        ],
      },
    },
    {
      name: "Explorer",
      requirements: "Upload ≥ 1 TiB, ratio ≥ 0.4, age ≥ 1 month",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "oe-explorer-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 30, scope: "account", label: "At least 1 month registered" },
          { kind: "numeric", id: "oe-explorer-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 1 * TiB, scope: "account", label: "At least 1 TiB uploaded" },
          { kind: "numeric", id: "oe-explorer-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 0.4, scope: "account", label: "Ratio at least 0.4" },
        ],
      },
    },
    {
      name: "Trailblazer",
      requirements:
        "Upload ≥ 5 TiB, ratio ≥ 0.4, age ≥ 2 months, seed size ≥ 100 GiB. Invite sending",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "oe-trailblazer-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 60, scope: "account", label: "At least 2 months registered" },
          { kind: "numeric", id: "oe-trailblazer-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 5 * TiB, scope: "account", label: "At least 5 TiB uploaded" },
          { kind: "numeric", id: "oe-trailblazer-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 0.4, scope: "account", label: "Ratio at least 0.4" },
          { kind: "numeric", metric: "seedSizeBytes", comparison: "gte", requiredValue: 100 * GiB, scope: "account", label: "Seed size ≥ 100 GiB" },
        ],
      },
    },
    {
      name: "Adventurer",
      requirements:
        "Upload ≥ 20 TiB, ratio ≥ 0.4, age ≥ 3 months, seed size ≥ 100 GiB. Invite sending",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "oe-adventurer-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 90, scope: "account", label: "At least 3 months registered" },
          { kind: "numeric", id: "oe-adventurer-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 20 * TiB, scope: "account", label: "At least 20 TiB uploaded" },
          { kind: "numeric", id: "oe-adventurer-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 0.4, scope: "account", label: "Ratio at least 0.4" },
          { kind: "numeric", metric: "seedSizeBytes", comparison: "gte", requiredValue: 100 * GiB, scope: "account", label: "Seed size ≥ 100 GiB" },
        ],
      },
    },
    {
      name: "Legendary",
      requirements:
        "Upload ≥ 50 TiB, ratio ≥ 0.4, age ≥ 6 months, seed size ≥ 100 GiB. Invite sending",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "oe-legendary-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 180, scope: "account", label: "At least 6 months registered" },
          { kind: "numeric", id: "oe-legendary-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 50 * TiB, scope: "account", label: "At least 50 TiB uploaded" },
          { kind: "numeric", id: "oe-legendary-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 0.4, scope: "account", label: "Ratio at least 0.4" },
          { kind: "numeric", metric: "seedSizeBytes", comparison: "gte", requiredValue: 100 * GiB, scope: "account", label: "Seed size ≥ 100 GiB" },
        ],
      },
    },
    {
      name: "Ascendan",
      requirements:
        "Upload ≥ 100 TiB, ratio ≥ 0.4, age ≥ 1 year, seed size ≥ 100 GiB. Freeleech, H&R immune",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "oe-ascendan-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 365, scope: "account", label: "At least 1 year registered" },
          { kind: "numeric", id: "oe-ascendan-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 100 * TiB, scope: "account", label: "At least 100 TiB uploaded" },
          { kind: "numeric", id: "oe-ascendan-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 0.4, scope: "account", label: "Ratio at least 0.4" },
          { kind: "numeric", metric: "seedSizeBytes", comparison: "gte", requiredValue: 100 * GiB, scope: "account", label: "Seed size ≥ 100 GiB" },
        ],
      },
    },
    // Dynamic. seed-based
    {
      name: "Eternal",
      requirements:
        "Upload ≥ 1 TiB, ratio ≥ 0.4, age ≥ 1 month, avg seedtime ≥ 1 month, seed size ≥ 5 TiB. H&R immune",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "oe-eternal-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 30, scope: "account", label: "At least 1 month registered" },
          { kind: "numeric", id: "oe-eternal-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 1 * TiB, scope: "account", label: "At least 1 TiB uploaded" },
          { kind: "numeric", id: "oe-eternal-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 0.4, scope: "account", label: "Ratio at least 0.4" },
          { kind: "numeric", metric: "averageSeedTimeSeconds", comparison: "gte", requiredValue: 30 * DAY, scope: "account", label: "Average seed time ≥ 1 month" },
          { kind: "numeric", metric: "seedSizeBytes", comparison: "gte", requiredValue: 5 * TiB, scope: "account", label: "Seed size ≥ 5 TiB" },
        ],
      },
    },
    {
      name: "Video Virtuoso",
      requirements:
        "Upload ≥ 1 TiB, ratio ≥ 0.4, age ≥ 3 months, avg seedtime ≥ 2 months, seed size ≥ 10 TiB. Freeleech, H&R immune",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "oe-video-virtuoso-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 90, scope: "account", label: "At least 3 months registered" },
          { kind: "numeric", id: "oe-video-virtuoso-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 1 * TiB, scope: "account", label: "At least 1 TiB uploaded" },
          { kind: "numeric", id: "oe-video-virtuoso-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 0.4, scope: "account", label: "Ratio at least 0.4" },
          { kind: "numeric", metric: "averageSeedTimeSeconds", comparison: "gte", requiredValue: 60 * DAY, scope: "account", label: "Average seed time ≥ 2 months" },
          { kind: "numeric", metric: "seedSizeBytes", comparison: "gte", requiredValue: 10 * TiB, scope: "account", label: "Seed size ≥ 10 TiB" },
        ],
      },
    },
    {
      name: "Encode Lover",
      requirements:
        "Upload ≥ 1 TiB, ratio ≥ 0.4, age ≥ 6 months, avg seedtime ≥ 3 months, seed size ≥ 20 TiB. Freeleech, 2x upload, H&R immune",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "oe-encode-lover-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 180, scope: "account", label: "At least 6 months registered" },
          { kind: "numeric", id: "oe-encode-lover-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 1 * TiB, scope: "account", label: "At least 1 TiB uploaded" },
          { kind: "numeric", id: "oe-encode-lover-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 0.4, scope: "account", label: "Ratio at least 0.4" },
          { kind: "numeric", metric: "averageSeedTimeSeconds", comparison: "gte", requiredValue: 90 * DAY, scope: "account", label: "Average seed time ≥ 3 months" },
          { kind: "numeric", metric: "seedSizeBytes", comparison: "gte", requiredValue: 20 * TiB, scope: "account", label: "Seed size ≥ 20 TiB" },
        ],
      },
    },
    // Dynamic. hybrid
    {
      name: "BeachBum",
      requirements:
        "Upload ≥ 100 TiB, ratio ≥ 1.0, age ≥ 2 months, avg seedtime ≥ 6 days, seed size ≥ 20 TiB. Freeleech, 2x upload, H&R immune",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "oe-beachbum-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 60, scope: "account", label: "At least 2 months registered" },
          { kind: "numeric", id: "oe-beachbum-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 100 * TiB, scope: "account", label: "At least 100 TiB uploaded" },
          { kind: "numeric", id: "oe-beachbum-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 1.0, scope: "account", label: "Ratio at least 1.0" },
          { kind: "numeric", metric: "averageSeedTimeSeconds", comparison: "gte", requiredValue: 6 * DAY, scope: "account", label: "Average seed time ≥ 6 days" },
          { kind: "numeric", metric: "seedSizeBytes", comparison: "gte", requiredValue: 20 * TiB, scope: "account", label: "Seed size ≥ 20 TiB" },
        ],
      },
    },
    {
      name: "OnlyKings",
      requirements:
        "Upload ≥ 1 TiB, ratio ≥ 1.0, age ≥ 3 months, avg seedtime ≥ 2 months, seed size ≥ 10 TiB, 35+ uploads. Freeleech, 2x upload, H&R immune, torrent mod bypass",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "oe-onlykings-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 90, scope: "account", label: "At least 3 months registered" },
          { kind: "numeric", id: "oe-onlykings-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 1 * TiB, scope: "account", label: "At least 1 TiB uploaded" },
          { kind: "numeric", id: "oe-onlykings-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 1.0, scope: "account", label: "Ratio at least 1.0" },
          { kind: "numeric", id: "oe-onlykings-uploads", metric: "uploads", comparison: "gte", requiredValue: 35, scope: "account", label: "At least 35 uploads" },
          { kind: "numeric", metric: "averageSeedTimeSeconds", comparison: "gte", requiredValue: 60 * DAY, scope: "account", label: "Average seed time ≥ 2 months" },
          { kind: "numeric", metric: "seedSizeBytes", comparison: "gte", requiredValue: 10 * TiB, scope: "account", label: "Seed size ≥ 10 TiB" },
        ],
      },
    },
    // Off-ladder administrative and staff classes
    { name: "Pruned", requirements: "Administrative state", outsideLadder: "below" },
    { name: "Banned", requirements: "Administrative state", outsideLadder: "below" },
    { name: "Disabled", requirements: "Administrative state", outsideLadder: "below" },
    { name: "Guest", requirements: "Administrative state", outsideLadder: "below" },
    { name: "Validating", requirements: "Administrative state", outsideLadder: "below" },
    {
      name: "OnlyCoinSpender",
      requirements:
        "Upload ≥ 908.59 TiB, ratio ≥ 1.0, age ≥ 12 months, seed size ≥ 5 TiB. Freeleech, 2x upload, H&R immune",
      outsideLadder: "above",
    },
    // Staff-assigned
    {
      name: "Learner",
      requirements: "Staff — learning the ropes of uploading (Junior Uploader). Torrent mod bypass",
      outsideLadder: "above",
    },
    {
      name: "Supplier",
      requirements:
        "Staff — uploads without staff needing to edit or fix. Freeleech, H&R immune, torrent mod bypass",
      outsideLadder: "above",
    },
    {
      name: "ThunderKeeper",
      requirements:
        "Staff — internal uploaders. Freeleech, 2x upload, H&R immune, torrent mod bypass",
      outsideLadder: "above",
    },
    {
      name: "SnowGlober",
      requirements: "Staff — legacy VIP class. Freeleech, 2x upload, H&R immune",
      outsideLadder: "above",
    },
    {
      name: "Bot",
      requirements: "Staff — automated release bot. H&R immune, torrent mod bypass",
      outsideLadder: "above",
    },
    {
      name: "Torrent Moderator",
      requirements: "Staff — freeleech, H&R immune, torrent mod bypass",
      outsideLadder: "above",
    },
    {
      name: "Editor",
      requirements: "Staff — freeleech, H&R immune, torrent mod bypass",
      outsideLadder: "above",
    },
  ],
  releaseGroups: [
    "BiNGUS",
    "Breeze",
    "DarQ",
    "DBMS",
    "edge2020",
    "edwood",
    "Goki (TAoE)",
    "GRiMM",
    "noxxus",
    "OnlyWeb",
    "PrimeX",
    "Ralphy",
    "sCOOTER",
    "Vialle",
  ],
  bannedGroups: [
    "3motion",
    "3L73N",
    "4KU",
    "Autta",
    "Bucky",
    "BIQ",
    "Alcalde_Kira",
    "AFG",
    "AdrianNostalgia",
    "AnHLS",
    "Anime Time",
    "AnimERG",
    "AROZEL",
    "AOC",
    "AR",
    "AROMA",
    "ATUK",
    "aXXo",
    "BakedFish",
    "BTOR",
    "Bliop",
    "bonkai",
    "Cleo",
    "CMR",
    "CJK",
    "CrEwSaDe",
    "cyno",
    "d3g",
    "DDR",
    "DESPM",
    "DeadFish",
    "DirectlyMixed",
    "DNL",
    "ELITE",
    "EMBER",
    "dVi",
    "EVO",
    "EZTV",
    "FANDANGO",
    "FGT",
    "fario",
    "FLM",
    "FRE3",
    "FROZEN",
    "GalaxyTV",
    "GalaxyRG",
    "GalaxyRG265",
    "GERMini",
    "Grym",
    "GrymLegacy",
    "HONE",
    "H0GDHO",
    "H0Tme",
    "HRB",
    "HOZER",
    "IONVO",
    "iPlanet",
    "IVY",
    "JEFFY977",
    "JarettswaggerEddie",
    "JIVE",
    "Judas",
    "KINGDOM",
    "KONTRAST",
    "LAMA",
    "LetPa",
    "LaFiel",
    "LOAD",
    "Lucidore",
    "LAYAMIE",
    "McGabe",
    "MaxRips",
    "AHMD",
    "Mr.Deadpool",
    "HQC",
    "NemDiggers",
    "nooBELVC",
    "Notica",
    "NHAM3",
    "iHD",
    "sHD",
    "nHD",
    "MiD",
    "MULVAcoded",
    "NOVTC",
    "pathe.in",
    "PlayRO",
    "playBD",
    "PROOLA",
    "Profiles",
    "project-gxs",
    "PSA",
    "QoQ",
    "Ranger",
    "RANDOWNS",
    "RAMBO",
    "Race",
    "RCOVX",
    "RGR",
    "Riastor",
    "RGuitByRoTI",
    "RMTeam",
    "KkRony",
    "rulez",
    "SANTI",
    "SHUTTERSH1T",
    "SMUT",
    "SpaceFish",
    "SPASM",
    "SSA",
    "TBS",
    "Telly",
    "Tenrai-Sensei",
    "TERMINAL",
    "Trix",
    "TNI",
    "topek",
    "Tigalolt",
    "TOP",
    "TGPNL",
    "Unknown1",
    "UKAMME",
    "UTE",
    "ViqiaoSuoBao",
    "VISION",
    "WAF",
    "WarDrift",
    "xOr",
    "xRed",
    "X5",
    "YANNTC",
    "YANNX",
    "YakuboEncodes",
    "YFY",
    "YTE",
    "YuRuSka",
    "ZAFG",
    "Zhen",
    "ZHNY",
    "ZoNAT",
    "ZVMT",
  ],
  notableMembers: ["GRiMM"],

  // ── Rules ───────────────────────────────────────────────────────────
  rules: {
    minimumRatio: 0.4,
    seedTimeHours: 48,
    loginIntervalDays: 60,
    fulfillmentPeriodHours: 168,
    hnrBanLimit: 3,
    fullRulesMarkdown: [
      "## Internal Releases",
      "",
      "- All internal releases receive freeleech",
      "- 72-hour exclusivity before posting externally — violation = DL revoked, repeat = ban",
      "",
      "## Hit & Run",
      "",
      "- Must seed even on freeleech torrents",
      "- Warnings expire after 10 days but remain in history",
      "- Bonus points earned for seeding beyond 48 hours",
      "",
      "## Uploading",
      "",
      "- Personal releases must be seeded for 2 weeks",
      "- No series packs — seasons only. Season pack trumps individual episodes",
      "- Non-English content requires English subs or audio",
      "",
      "## Inactivity",
      "",
      "- 60 days no login or seeding = disabled",
      "- 180 days total inactivity = account deleted",
      "",
      "## Invites",
      "",
      "- Available at Trailblazer class and above",
      "- You are responsible for your invitees' actions",
    ],
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: false,
  warningNote: "",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: true,
  profileUrlPattern: "/users/{username}",

  // ── Stats (omit this block entirely if no real data is available) ───
  stats: {
    userCount: 5631,
    activeUsers: 4313,
    torrentCount: 91051,
    seedSize: "6.12 PiB",
    statsUpdatedAt: "March 2026",
  },
}
