// src/data/trackers/speedapp.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const speedapp: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "speedapp",
  name: "SpeedApp",
  abbreviation: "SP",
  url: "https://speedapp.io",
  description: "Romanian private general tracker covering movies, TV, music, games and books.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "apime",
  apiPath: "/api/me",
  // The site's own client sends the token as a Bearer credential, and its
  // 401 advertises `WWW-Authenticate: Bearer`.
  apimeAuthStyle: "bearer",
  apimeClassMap: {
    "0": "Peasant",
    "1": "User",
    "2": "Power User",
    "3": "Elite User",
    "4": "Xtreme User",
    "5": "Super User",
    "6": "Legend User",
    "7": "VIP",
    "8": "Legend VIP",
    "9": "Hyperseeder",
    "10": "Hall of Fame",
    "11": "Helper",
    "12": "Junior Uploader",
    "13": "Uploader",
    "14": "Elite Uploader",
    "15": "Encoder",
    "16": "Junior Moderator",
    "17": "Moderator",
    "18": "Administrator",
    "19": "Supervisor",
    "20": "Owner",
    "21": "Coder",
  },

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "General / RO",
  contentCategories: ["Movies", "TV", "Music", "Games", "Books"],
  language: "Romanian",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#f7c60a",
  logo: "/tracker-logos/speedapp_logo.png",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "",
  statusPageUrl: "",

  // ── Community ───────────────────────────────────────────────────────
  userClasses: [
    {
      name: "Peasant",
      requirements: "Demotion class below 0.95 ratio or under one month old.",
      outsideLadder: "below",
    },
    {
      name: "User",
      requirements: "Account age ≥ 30 days, uploaded ≥ 25 GB, ratio ≥ 1.05",
    },
    {
      name: "Power User",
      requirements: "Account age ≥ 90 days, uploaded ≥ 200 GB, ratio ≥ 2.0",
    },
    {
      name: "Elite User",
      requirements: "Account age ≥ 180 days, uploaded ≥ 1 TB, ratio ≥ 3.0",
    },
    {
      name: "Xtreme User",
      requirements: "Account age ≥ 1 year, uploaded ≥ 5 TB, ratio ≥ 4.0",
    },
    {
      name: "Super User",
      requirements: "Account age ≥ 2 years, uploaded ≥ 20 TB, ratio ≥ 5.0",
    },
    {
      name: "Legend User",
      requirements: "Account age ≥ 6 years, uploaded ≥ 100 TB, ratio ≥ 6.0",
    },
    { name: "Star", requirements: "Donation package", outsideLadder: "above" },
    { name: "VIP", requirements: "Granted by staff", outsideLadder: "above" },
    { name: "Legend VIP", requirements: "Long-standing VIP", outsideLadder: "above" },
    {
      name: "Hyperseeder",
      requirements: "Top 10 by seed size, seeding over 90% of the last 72 hours",
      outsideLadder: "above",
    },
    { name: "Hall of Fame", requirements: "Granted by staff", outsideLadder: "above" },
    { name: "Helper", requirements: "Granted by moderators", outsideLadder: "above" },
    { name: "Junior Uploader", requirements: "Appointed by staff", outsideLadder: "above" },
    { name: "Uploader", requirements: "Appointed by staff", outsideLadder: "above" },
    { name: "Elite Uploader", requirements: "Appointed by staff", outsideLadder: "above" },
    { name: "Encoder", requirements: "Appointed by staff", outsideLadder: "above" },
    { name: "Junior Moderator", requirements: "Staff", outsideLadder: "above" },
    { name: "Moderator", requirements: "Staff", outsideLadder: "above" },
    { name: "Administrator", requirements: "Staff", outsideLadder: "above" },
    { name: "Supervisor", requirements: "Senior staff", outsideLadder: "above" },
    { name: "Owner", requirements: "SysOp", outsideLadder: "above" },
    { name: "Coder", requirements: "Developer", outsideLadder: "above" },
  ],
  releaseGroups: [],
  bannedGroups: [],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  rules: {
    minimumRatio: 0.95,
    seedTimeHours: 48,
    loginIntervalDays: 0,
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: false,
  warningNote: "",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: false,
  profileUrlPattern: "",
}
