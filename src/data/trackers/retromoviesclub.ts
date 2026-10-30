// src/data/trackers/retromoviesclub.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

const TiB = 1024 ** 4

export const retromoviesclub: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "retromoviesclub",
  name: "Retro Movies Club",
  abbreviation: "RMC",
  url: "https://retro-movies.club",
  description:
    "Private movie tracker for films released in 2000 or earlier. Aims to be the definitive archive of classic films.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "unit3d",
  apiPath: "/api/user",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "Classic / Retro Movies",
  contentCategories: ["Movies"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#ff69b4",
  logo: "/tracker-logos/retromoviesclub_logo.png",

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
    "Average seed time and seed size are not supported rank metrics and stay as unsupported conditions.",
    "Mod bypass, freeleech and H&R immunity are perks, not promotion thresholds.",
    "TiB text is read as written.",
  ],
  userClasses: [
    {
      name: "Outtake",
      requirements: "Pruned accounts - removed due to prolonged inactivity.",
      outsideLadder: "below",
    },
    {
      name: "Blacklisted",
      requirements: "Banned for violating site rules - all privileges revoked.",
      outsideLadder: "below",
    },
    {
      name: "Shelved",
      requirements: "Disabled accounts - temporarily or permanently shelved by staff.",
      outsideLadder: "below",
    },
    {
      name: "Audience",
      requirements: "View/download only role - can't upload or invite.",
      outsideLadder: "below",
    },
    {
      name: "Auditioning",
      requirements: "Pending email verification",
      outsideLadder: "below",
    },
    {
      name: "Seat Filler",
      requirements: "0 B Uploaded, 0.00 Ratio",
      outsideLadder: "below",
    },
    {
      name: "Actor",
      requirements: "0 B Uploaded",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "rmc-actor-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 0, scope: "account", label: "At least 0 B uploaded" },
        ],
      },
    },
    {
      name: "Film Buff",
      requirements: "1 TiB Uploaded, 0.40 Ratio, 1 Month account age",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "rmc-film-buff-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 30, scope: "account", label: "At least 1 month registered" },
          { kind: "numeric", id: "rmc-film-buff-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 1 * TiB, scope: "account", label: "At least 1 TiB uploaded" },
          { kind: "numeric", id: "rmc-film-buff-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 0.4, scope: "account", label: "Ratio at least 0.40" },
        ],
      },
    },
    {
      name: "Supporting Actor",
      requirements: "5 TiB Uploaded, 0.40 Ratio, 2 Months account age",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "rmc-supporting-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 60, scope: "account", label: "At least 2 months registered" },
          { kind: "numeric", id: "rmc-supporting-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 5 * TiB, scope: "account", label: "At least 5 TiB uploaded" },
          { kind: "numeric", id: "rmc-supporting-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 0.4, scope: "account", label: "Ratio at least 0.40" },
        ],
      },
    },
    {
      name: "Leading Actor",
      requirements: "20 TiB Uploaded, 0.40 Ratio, 3 Months account age, Mod Bypass",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "rmc-leading-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 90, scope: "account", label: "At least 3 months registered" },
          { kind: "numeric", id: "rmc-leading-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 20 * TiB, scope: "account", label: "At least 20 TiB uploaded" },
          { kind: "numeric", id: "rmc-leading-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 0.4, scope: "account", label: "Ratio at least 0.40" },
        ],
      },
    },
    {
      name: "Movie Star",
      requirements: "50 TiB Uploaded, 0.40 Ratio, 6 Months account age, Mod Bypass",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "rmc-movie-star-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 180, scope: "account", label: "At least 6 months registered" },
          { kind: "numeric", id: "rmc-movie-star-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 50 * TiB, scope: "account", label: "At least 50 TiB uploaded" },
          { kind: "numeric", id: "rmc-movie-star-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 0.4, scope: "account", label: "Ratio at least 0.40" },
        ],
      },
    },
    {
      name: "Superstar",
      requirements:
        "0.40 Ratio, 1 Month account age, 1 Month avg seedtime, 5 TiB min seedsize, HnR Immune, Mod Bypass",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "rmc-superstar-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 30, scope: "account", label: "At least 1 month registered" },
          { kind: "numeric", id: "rmc-superstar-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 0.4, scope: "account", label: "Ratio at least 0.40" },
          { kind: "non-numeric", label: "Average seed time ≥ 1 month" },
          { kind: "non-numeric", label: "Seed size ≥ 5 TiB" },
        ],
      },
    },
    {
      name: "Preservationist",
      requirements:
        "0.40 Ratio, 3 Months account age, 2 Months avg seedtime, 10 TiB min seedsize, Freeleech, HnR Immune, Mod Bypass",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "rmc-preservationist-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 90, scope: "account", label: "At least 3 months registered" },
          { kind: "numeric", id: "rmc-preservationist-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 0.4, scope: "account", label: "Ratio at least 0.40" },
          { kind: "non-numeric", label: "Average seed time ≥ 2 months" },
          { kind: "non-numeric", label: "Seed size ≥ 10 TiB" },
        ],
      },
    },
    {
      name: "Screen Legend",
      requirements: "100 TiB Uploaded, 0.40 Ratio, 1 Year account age, Freeleech",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "rmc-legend-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 365, scope: "account", label: "At least 1 year registered" },
          { kind: "numeric", id: "rmc-legend-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 100 * TiB, scope: "account", label: "At least 100 TiB uploaded" },
          { kind: "numeric", id: "rmc-legend-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 0.4, scope: "account", label: "Ratio at least 0.40" },
        ],
      },
    },
    { name: "Executive", requirements: "Staff assigned", outsideLadder: "above" },
    { name: "Producer", requirements: "Staff assigned", outsideLadder: "above" },
    {
      name: "ViP",
      requirements: "Very Important Person - donors and honored members of the community",
      outsideLadder: "above",
    },
    { name: "Film Editor", requirements: "Staff assigned", outsideLadder: "above" },
    { name: "Script Supervisor", requirements: "Staff assigned", outsideLadder: "above" },
    { name: "Assistant Director", requirements: "Staff assigned", outsideLadder: "above" },
    { name: "Director", requirements: "Staff assigned", outsideLadder: "above" },
    { name: "Studio Mogul", requirements: "Staff assigned", outsideLadder: "above" },
    { name: "Animatronic", requirements: "Staff assigned", outsideLadder: "above" },
  ],
  releaseGroups: [
    { name: "EORMC", description: "Internal Encodes and Remux group." },
    { name: "RMWD", description: "Internal WebDL release group." },
  ],
  bannedGroups: [
    "[Oj]",
    "3LTON",
    "4yEo",
    "ADE",
    "AFG",
    "AniHLS",
    "AnimeRG",
    "AniURL",
    "AROMA",
    "aXXo",
    "CM8",
    "CrEwSaDe",
    "DeadFish",
    "DNL",
    "ELiTE",
    "eSc",
    "FaNGDiNG0",
    "FGT",
    "Flights",
    "FRDS",
    "FUM",
    "GalaxyRG",
    "HAiKU",
    "HDS",
    "HDTime",
    "INFINITY",
    "ION10",
    "iPlanet",
    "JIVE",
    "KiNGDOM",
    "LAMA",
    "Leffe",
    "LOAD",
    "mHD",
    "nHD",
    "NOIVTC",
    "nSD",
    "PiRaTeS",
    "RARBG",
    "RDN",
    "REsuRRecTioN",
    "RMTeam",
    "SANTi",
    "SicFoI",
    "SPASM",
    "STUTTERSHIT",
    "Telly",
    "TM",
    "UPiNSMOKE",
    "WAF",
    "xRed",
    "XS",
    "YELLO",
    "YIFY",
    "YTS",
    "ZKBL",
    "ZmN",
  ],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  rules: {
    minimumRatio: 0.4,
    seedTimeHours: 48,
    loginIntervalDays: 0,
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: true,
  warningNote: "Unverified! Not tested against a live account.",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: true,
  profileUrlPattern: "/users/{username}",
}
