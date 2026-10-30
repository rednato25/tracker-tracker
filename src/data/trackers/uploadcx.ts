// src/data/trackers/uploadcx.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

const TiB = 1024 ** 4
const DAY = 86_400
const MONTH = 30 * DAY
const YEAR_DAYS = 365

export const uploadcx: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "uploadcx",
  name: "Upload.cx",
  abbreviation: "UCX",
  url: "https://upload.cx",
  description:
    "Community-built Movie/TV/FANRES database with a strong HD focus, a proactive userbase, and one of the best FANRES selections available. Experienced staff, security-focused codebase, and no donation pestering.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "unit3d",
  apiPath: "/api/user",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "General / HD content / FANRES",
  contentCategories: ["Movies", "TV"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#538dab",
  logo: "/tracker-logos/ulcx_logo.png",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "",
  statusPageUrl: "",

  // ── Community ───────────────────────────────────────────────────────
  rankProgression: "automatic",
  rankRequirementsSource: {
    url: "https://upload.cx/",
    title: "Upload.cx user-class list",
    accessedAt: "2026-10-30",
    sourceLastModified: null,
    verification: "published",
    note:
      "Confirmed by the owner on 2026-10-30 from the site's user-class list. Sizes are TiB; 1M means 30 days and 1Y means 365 days; all comparisons are at least.",
  },
  rankUnresolved: [
    "Seed, upload-count and combined classes are parallel ladders from User; no single automatic next class is inferred.",
    "Average seed time and seed size are supported rank metrics, but the UNIT3D adapter does not collect them yet, so those conditions stay unknown until collected.",
  ],
  rankPaths: [
    {
      id: "seed",
      label: "Seed ladder",
      description: "Upload, ratio, account age, average seed time and seed size",
    },
    {
      id: "upload-count",
      label: "Upload-count ladder",
      description: "Ratio, account age, average seed time and uploaded torrents",
    },
    {
      id: "combined",
      label: "Combined ladder",
      description: "Every seed-ladder requirement plus uploaded torrents",
    },
  ],
  userClasses: [
    {
      name: "Leech",
      requirements: "No requirements",
      outsideLadder: "below",
    },
    {
      name: "User",
      requirements: "Ratio ≥ 0.60",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "ucx-user-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 0.6, scope: "account", label: "Ratio at least 0.60" },
        ],
      },
    },
    // Seed ladder
    {
      name: "Seeder",
      path: "seed",
      requirements:
        "Upload ≥ 10 TiB, ratio ≥ 0.80, age ≥ 1 month, average seed time ≥ 1 month, seed size ≥ 5 TiB",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "ucx-seeder-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 10 * TiB, scope: "account", label: "At least 10 TiB uploaded" },
          { kind: "numeric", id: "ucx-seeder-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 0.8, scope: "account", label: "Ratio at least 0.80" },
          { kind: "numeric", id: "ucx-seeder-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 30, scope: "account", label: "At least 1 month registered" },
          { kind: "numeric", id: "ucx-seeder-seedtime", metric: "averageSeedTimeSeconds", comparison: "gte", requiredValue: MONTH, scope: "account", label: "Average seed time at least 1 month" },
          { kind: "numeric", id: "ucx-seeder-seedsize", metric: "seedSizeBytes", comparison: "gte", requiredValue: 5 * TiB, scope: "account", label: "Seed size at least 5 TiB" },
        ],
      },
    },
    {
      name: "Collector",
      path: "seed",
      requirements:
        "Upload ≥ 25 TiB, ratio ≥ 1.00, age ≥ 3 months, average seed time ≥ 2 months, seed size ≥ 10 TiB",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "ucx-collector-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 25 * TiB, scope: "account", label: "At least 25 TiB uploaded" },
          { kind: "numeric", id: "ucx-collector-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 1.0, scope: "account", label: "Ratio at least 1.00" },
          { kind: "numeric", id: "ucx-collector-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 90, scope: "account", label: "At least 3 months registered" },
          { kind: "numeric", id: "ucx-collector-seedtime", metric: "averageSeedTimeSeconds", comparison: "gte", requiredValue: 2 * MONTH, scope: "account", label: "Average seed time at least 2 months" },
          { kind: "numeric", id: "ucx-collector-seedsize", metric: "seedSizeBytes", comparison: "gte", requiredValue: 10 * TiB, scope: "account", label: "Seed size at least 10 TiB" },
        ],
      },
    },
    {
      name: "Archivist",
      path: "seed",
      requirements:
        "Upload ≥ 50 TiB, ratio ≥ 1.50, age ≥ 6 months, average seed time ≥ 3 months, seed size ≥ 20 TiB",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "ucx-archivist-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 50 * TiB, scope: "account", label: "At least 50 TiB uploaded" },
          { kind: "numeric", id: "ucx-archivist-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 1.5, scope: "account", label: "Ratio at least 1.50" },
          { kind: "numeric", id: "ucx-archivist-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 180, scope: "account", label: "At least 6 months registered" },
          { kind: "numeric", id: "ucx-archivist-seedtime", metric: "averageSeedTimeSeconds", comparison: "gte", requiredValue: 3 * MONTH, scope: "account", label: "Average seed time at least 3 months" },
          { kind: "numeric", id: "ucx-archivist-seedsize", metric: "seedSizeBytes", comparison: "gte", requiredValue: 20 * TiB, scope: "account", label: "Seed size at least 20 TiB" },
        ],
      },
    },
    {
      name: "Hoarder",
      path: "seed",
      requirements:
        "Upload ≥ 100 TiB, ratio ≥ 1.80, age ≥ 1 year, average seed time ≥ 4 months, seed size ≥ 30 TiB",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "ucx-hoarder-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 100 * TiB, scope: "account", label: "At least 100 TiB uploaded" },
          { kind: "numeric", id: "ucx-hoarder-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 1.8, scope: "account", label: "Ratio at least 1.80" },
          { kind: "numeric", id: "ucx-hoarder-age", metric: "accountAgeDays", comparison: "gte", requiredValue: YEAR_DAYS, scope: "account", label: "At least 1 year registered" },
          { kind: "numeric", id: "ucx-hoarder-seedtime", metric: "averageSeedTimeSeconds", comparison: "gte", requiredValue: 4 * MONTH, scope: "account", label: "Average seed time at least 4 months" },
          { kind: "numeric", id: "ucx-hoarder-seedsize", metric: "seedSizeBytes", comparison: "gte", requiredValue: 30 * TiB, scope: "account", label: "Seed size at least 30 TiB" },
        ],
      },
    },
    // Upload-count ladder
    {
      name: "Sharer",
      path: "upload-count",
      requirements:
        "Ratio ≥ 0.80, age ≥ 1 month, average seed time ≥ 1 month, uploads ≥ 50",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "ucx-sharer-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 0.8, scope: "account", label: "Ratio at least 0.80" },
          { kind: "numeric", id: "ucx-sharer-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 30, scope: "account", label: "At least 1 month registered" },
          { kind: "numeric", id: "ucx-sharer-seedtime", metric: "averageSeedTimeSeconds", comparison: "gte", requiredValue: MONTH, scope: "account", label: "Average seed time at least 1 month" },
          { kind: "numeric", id: "ucx-sharer-uploads", metric: "uploads", comparison: "gte", requiredValue: 50, scope: "account", label: "At least 50 uploaded torrents" },
        ],
      },
    },
    {
      name: "Provider",
      path: "upload-count",
      requirements:
        "Ratio ≥ 1.00, age ≥ 3 months, average seed time ≥ 2 months, uploads ≥ 100",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "ucx-provider-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 1.0, scope: "account", label: "Ratio at least 1.00" },
          { kind: "numeric", id: "ucx-provider-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 90, scope: "account", label: "At least 3 months registered" },
          { kind: "numeric", id: "ucx-provider-seedtime", metric: "averageSeedTimeSeconds", comparison: "gte", requiredValue: 2 * MONTH, scope: "account", label: "Average seed time at least 2 months" },
          { kind: "numeric", id: "ucx-provider-uploads", metric: "uploads", comparison: "gte", requiredValue: 100, scope: "account", label: "At least 100 uploaded torrents" },
        ],
      },
    },
    {
      name: "Distributor",
      path: "upload-count",
      requirements:
        "Ratio ≥ 1.50, age ≥ 6 months, average seed time ≥ 3 months, uploads ≥ 250",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "ucx-distributor-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 1.5, scope: "account", label: "Ratio at least 1.50" },
          { kind: "numeric", id: "ucx-distributor-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 180, scope: "account", label: "At least 6 months registered" },
          { kind: "numeric", id: "ucx-distributor-seedtime", metric: "averageSeedTimeSeconds", comparison: "gte", requiredValue: 3 * MONTH, scope: "account", label: "Average seed time at least 3 months" },
          { kind: "numeric", id: "ucx-distributor-uploads", metric: "uploads", comparison: "gte", requiredValue: 250, scope: "account", label: "At least 250 uploaded torrents" },
        ],
      },
    },
    {
      name: "Supplier",
      path: "upload-count",
      requirements:
        "Ratio ≥ 1.80, age ≥ 1 year, average seed time ≥ 4 months, uploads ≥ 500",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "ucx-supplier-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 1.8, scope: "account", label: "Ratio at least 1.80" },
          { kind: "numeric", id: "ucx-supplier-age", metric: "accountAgeDays", comparison: "gte", requiredValue: YEAR_DAYS, scope: "account", label: "At least 1 year registered" },
          { kind: "numeric", id: "ucx-supplier-seedtime", metric: "averageSeedTimeSeconds", comparison: "gte", requiredValue: 4 * MONTH, scope: "account", label: "Average seed time at least 4 months" },
          { kind: "numeric", id: "ucx-supplier-uploads", metric: "uploads", comparison: "gte", requiredValue: 500, scope: "account", label: "At least 500 uploaded torrents" },
        ],
      },
    },
    // Combined ladder
    {
      name: "Adept",
      path: "combined",
      requirements:
        "Upload ≥ 10 TiB, ratio ≥ 0.80, age ≥ 1 month, average seed time ≥ 1 month, seed size ≥ 5 TiB, uploads ≥ 50",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "ucx-adept-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 10 * TiB, scope: "account", label: "At least 10 TiB uploaded" },
          { kind: "numeric", id: "ucx-adept-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 0.8, scope: "account", label: "Ratio at least 0.80" },
          { kind: "numeric", id: "ucx-adept-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 30, scope: "account", label: "At least 1 month registered" },
          { kind: "numeric", id: "ucx-adept-seedtime", metric: "averageSeedTimeSeconds", comparison: "gte", requiredValue: MONTH, scope: "account", label: "Average seed time at least 1 month" },
          { kind: "numeric", id: "ucx-adept-seedsize", metric: "seedSizeBytes", comparison: "gte", requiredValue: 5 * TiB, scope: "account", label: "Seed size at least 5 TiB" },
          { kind: "numeric", id: "ucx-adept-uploads", metric: "uploads", comparison: "gte", requiredValue: 50, scope: "account", label: "At least 50 uploaded torrents" },
        ],
      },
    },
    {
      name: "Master",
      path: "combined",
      requirements:
        "Upload ≥ 25 TiB, ratio ≥ 1.00, age ≥ 3 months, average seed time ≥ 2 months, seed size ≥ 10 TiB, uploads ≥ 100",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "ucx-master-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 25 * TiB, scope: "account", label: "At least 25 TiB uploaded" },
          { kind: "numeric", id: "ucx-master-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 1.0, scope: "account", label: "Ratio at least 1.00" },
          { kind: "numeric", id: "ucx-master-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 90, scope: "account", label: "At least 3 months registered" },
          { kind: "numeric", id: "ucx-master-seedtime", metric: "averageSeedTimeSeconds", comparison: "gte", requiredValue: 2 * MONTH, scope: "account", label: "Average seed time at least 2 months" },
          { kind: "numeric", id: "ucx-master-seedsize", metric: "seedSizeBytes", comparison: "gte", requiredValue: 10 * TiB, scope: "account", label: "Seed size at least 10 TiB" },
          { kind: "numeric", id: "ucx-master-uploads", metric: "uploads", comparison: "gte", requiredValue: 100, scope: "account", label: "At least 100 uploaded torrents" },
        ],
      },
    },
    {
      name: "Veteran",
      path: "combined",
      requirements:
        "Upload ≥ 50 TiB, ratio ≥ 1.50, age ≥ 6 months, average seed time ≥ 3 months, seed size ≥ 20 TiB, uploads ≥ 250",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "ucx-veteran-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 50 * TiB, scope: "account", label: "At least 50 TiB uploaded" },
          { kind: "numeric", id: "ucx-veteran-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 1.5, scope: "account", label: "Ratio at least 1.50" },
          { kind: "numeric", id: "ucx-veteran-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 180, scope: "account", label: "At least 6 months registered" },
          { kind: "numeric", id: "ucx-veteran-seedtime", metric: "averageSeedTimeSeconds", comparison: "gte", requiredValue: 3 * MONTH, scope: "account", label: "Average seed time at least 3 months" },
          { kind: "numeric", id: "ucx-veteran-seedsize", metric: "seedSizeBytes", comparison: "gte", requiredValue: 20 * TiB, scope: "account", label: "Seed size at least 20 TiB" },
          { kind: "numeric", id: "ucx-veteran-uploads", metric: "uploads", comparison: "gte", requiredValue: 250, scope: "account", label: "At least 250 uploaded torrents" },
        ],
      },
    },
    {
      name: "Champion",
      path: "combined",
      requirements:
        "Upload ≥ 100 TiB, ratio ≥ 1.80, age ≥ 1 year, average seed time ≥ 4 months, seed size ≥ 30 TiB, uploads ≥ 500",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "ucx-champion-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 100 * TiB, scope: "account", label: "At least 100 TiB uploaded" },
          { kind: "numeric", id: "ucx-champion-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 1.8, scope: "account", label: "Ratio at least 1.80" },
          { kind: "numeric", id: "ucx-champion-age", metric: "accountAgeDays", comparison: "gte", requiredValue: YEAR_DAYS, scope: "account", label: "At least 1 year registered" },
          { kind: "numeric", id: "ucx-champion-seedtime", metric: "averageSeedTimeSeconds", comparison: "gte", requiredValue: 4 * MONTH, scope: "account", label: "Average seed time at least 4 months" },
          { kind: "numeric", id: "ucx-champion-seedsize", metric: "seedSizeBytes", comparison: "gte", requiredValue: 30 * TiB, scope: "account", label: "Seed size at least 30 TiB" },
          { kind: "numeric", id: "ucx-champion-uploads", metric: "uploads", comparison: "gte", requiredValue: 500, scope: "account", label: "At least 500 uploaded torrents" },
        ],
      },
    },
    {
      name: "Legend",
      path: "combined",
      requirements:
        "Upload ≥ 150 TiB, ratio ≥ 2.00, age ≥ 2 years, average seed time ≥ 6 months, seed size ≥ 50 TiB, uploads ≥ 1000",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "ucx-legend-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 150 * TiB, scope: "account", label: "At least 150 TiB uploaded" },
          { kind: "numeric", id: "ucx-legend-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 2.0, scope: "account", label: "Ratio at least 2.00" },
          { kind: "numeric", id: "ucx-legend-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 2 * YEAR_DAYS, scope: "account", label: "At least 2 years registered" },
          { kind: "numeric", id: "ucx-legend-seedtime", metric: "averageSeedTimeSeconds", comparison: "gte", requiredValue: 6 * MONTH, scope: "account", label: "Average seed time at least 6 months" },
          { kind: "numeric", id: "ucx-legend-seedsize", metric: "seedSizeBytes", comparison: "gte", requiredValue: 50 * TiB, scope: "account", label: "Seed size at least 50 TiB" },
          { kind: "numeric", id: "ucx-legend-uploads", metric: "uploads", comparison: "gte", requiredValue: 1000, scope: "account", label: "At least 1000 uploaded torrents" },
        ],
      },
    },
    // Off-ladder administrative and staff classes
    { name: "Pruned", requirements: "Administrative state", outsideLadder: "below" },
    { name: "Banned", requirements: "Administrative state", outsideLadder: "below" },
    { name: "Disabled", requirements: "Administrative state", outsideLadder: "below" },
    { name: "Validating", requirements: "Administrative state", outsideLadder: "below" },
    { name: "Parked", requirements: "Administrative state", outsideLadder: "below" },
    { name: "Network Affiliate", requirements: "Granted or staff class", outsideLadder: "above" },
    { name: "Junior Uploader", requirements: "Granted or staff class", outsideLadder: "above" },
    { name: "Uploader", requirements: "Granted or staff class", outsideLadder: "above" },
    { name: "Trustee", requirements: "Granted or staff class", outsideLadder: "above" },
    { name: "Internal", requirements: "Granted or staff class", outsideLadder: "above" },
    { name: "Editor", requirements: "Granted or staff class", outsideLadder: "above" },
    { name: "Torrent Moderator", requirements: "Granted or staff class", outsideLadder: "above" },
    { name: "Consultant", requirements: "Granted or staff class", outsideLadder: "above" },
    { name: "Bot", requirements: "Granted or staff class", outsideLadder: "above" },
  ],
  releaseGroups: ["BLOOM", "Xewdy"],
  bannedGroups: [
    "4K4U",
    "Alcaide_Kira",
    "AROMA",
    "d3g",
    "EDGE2020",
    "EMBER",
    "FGT",
    "FnP",
    "FRDS",
    "Grym",
    "HDT",
    "Hi10",
    "iAHD",
    "INFINITY",
    "ION10",
    "iVy",
    "Judas",
    "LAMA",
    "MeGusta",
    "NAHOM",
    "Niblets",
    "nikt0",
    "NuBz",
    "OFT",
    "PHOCiS",
    "QxR",
    "R&H",
    "Ralphy",
    "RARBG",
    "seedpool",
    "Sicario",
    "SM737",
    "SPDVD",
    "SPx",
    "SWTYBLZ",
    "TAoE",
    "TGx",
    "Tigole",
    "TSP",
    "TSPxL",
    "VXT",
    "Vyndros",
    "Will1869",
    "x0r",
    "YIFY",
  ],
  notableMembers: ["vandaag", "Xewdy", "Zips"],

  // ── Rules ───────────────────────────────────────────────────────────
  rules: {
    minimumRatio: 0.6,
    seedTimeHours: 48,
    loginIntervalDays: 90,
    fulfillmentPeriodHours: 336,
    hnrBanLimit: 3,
    fullRulesMarkdown: [
      "## Seeding Requirements",
      "",
      "- All downloaded torrents must be seeded for at least 2 days, regardless of ratio or freeleech status",
      "- Seeding rules apply only to torrents with ≥ 10% downloaded; seed time tracking begins after 100% downloaded",
      "- Files must be immediately available on your system — remote services like Google Drive forbidden",
      "- Do not share your client or use debrid services",
      "",
      "## Ratio Guidelines",
      "",
      "- Global ratio must be ≥ 0.6 to retain downloading privileges",
      "",
      "## Hit & Run Warnings",
      "",
      "- Pre-warning sent after 24h disconnected without meeting seed time",
      "- H&R warning issued after 72h disconnected without meeting seed time",
      "- Warnings last 30 days but remain on record permanently",
      "- Warnings expire after 30 days or when torrent is seeded for ≥ 2 days",
      "- 1-2 active warnings: no consequences",
      "- 3 active warnings: download and request privileges disabled",
      "",
      "## Upload Rules — General",
      "",
      "- Only Movies and TV Shows listed on TMDB",
      "- No books, audio, software, concerts, social media content, music videos, porn, or camera recordings",
      "- No pre-release content — must have had a retail release",
      "- No RAR/archive files, proofs, extras, or external subtitles",
      "- Single files must not be inside folders; multi-season TV packs must be full-disc format",
      "- Torrent files/folders must remain unaltered from original release group",
      "- Modified torrents must have release group removed and source mentioned in description",
      "- Must include ≥ 3 screenshots embedded with thumbnails in same aspect ratio as release",
      "- Uploaders must be connectable (open ports, not IPv6-only)",
      "- Must seed uploads for ≥ 2 weeks or until a few other seeders are present",
      "- Must respond to postpone messages within 1 week or upload is rejected",
      "- Content from banned release groups rejected unless specific exceptions apply",
      "",
      "## Upload Rules — Video",
      "",
      "- Remuxes allowed in any resolution",
      "- Encodes must be ≥ 720p, include encode settings, use CRF or multi-pass, primarily source from Blu-rays",
      "- WEBRips must include encode settings",
      "- x265 for live-action only if source is UHD; for animation, HD or UHD source allowed",
      "- AV1 content must include comparisons to source to verify quality",
      "- Upscales only allowed if title was never released in HD (subject to quality review)",
      "- SD WEB-DLs only allowed if title was never released in HD",
      "- Handbrake generally discouraged (suboptimal quality)",
      "",
      "## Upload Rules — Audio & Subtitles",
      "",
      "- Audio must include original language or English dub; other languages only → rejection",
      "- TrueHD tracks must include a compatibility track (not required for other codecs)",
      "- Foreign-language content must include English subtitles or English audio dub",
      "- Commentaries and isolated scores must be retail quality",
      "- Subtitles should be from reputable sources (streaming services, discs)",
      "",
      "## Coexistence",
      "",
      "- Remuxes coexist if significant subjective differences (coloring, framing, cuts)",
      "- Encodes coexist with different benefits (size, quality, DV, HDR)",
      "- WEB-DLs/WEBRips coexist if different source provider or highest quality at that resolution/codec/color space",
      "- WEBRips do NOT coexist with same-source WEB-DL",
      "- Internal uploads may coexist with any release; reverse does not apply (internal fills the slot)",
      "",
      "## Trumping",
      "",
      "- Unseeded uploads may be trumped by similar quality",
      "- REPACK/PROPER/RERIP/RE-ISSUE trumps original release",
      "- Flaws (out-of-sync, defective tracks, missing forced subs) can be trumped",
      "- Remuxes with superior video/audio/source trump other remuxes",
      "- English dual-audio trumps foreign non-English audio",
      "- Hardcoded subtitles trumped by comparable encode without them",
      "- NoGrp trumped by reputable group release of similar quality",
      "- Untouched/retail Blu-ray and DVD-R trump homebrew versions",
      "- Season packs from same source trump individual episodes",
      "",
      "## Requesting",
      "",
      "- One movie or season per request",
      "- Only request content that can be uploaded (no rule-violating content)",
      "- No spamming votes/BON to bump requests",
      "- No begging in chat for request attention",
      "",
      "## Account Inactivity",
      "",
      "- Account auto-disabled if ALL conditions met: account ≥ 90 days old, last login ≥ 90 days ago, not actively seeding",
      "- After disable: 120 days to log back in and reactivate",
      "- After 120 days disabled: account permanently pruned (data anonymized, cannot be recovered)",
      "- Prevention: log in once every 90 days OR keep actively seeding",
      "- If not auto-reactivated within 24h of login, create a helpdesk ticket",
      "",
      "## Account & General",
      "",
      "- One account per person — no sharing, distributing, or selling accounts",
      "- No selling or trading invites; you are accountable for your invitees",
      "- VPNs and proxies encouraged and allowed",
      "- No cheating (posting false information to tracker)",
      "- English for site communication; no harassment, discrimination, or abuse",
      "- No revealing personal information about yourself or others",
    ],
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: false,
  warningNote: "",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: true,
  profileUrlPattern: "/users/{username}",
}
