// src/data/trackers/retroflix.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const retroflix: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "retroflix",
  name: "RetroFlix",
  abbreviation: "RF",
  url: "https://retroflix.club",
  description:
    "Private movie and TV tracker for releases at least ten years old, built around a retro-film archive.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "apime",
  apiPath: "/api/me",
  // The site's own client sends the token as a Bearer credential, and its
  // 401 advertises `WWW-Authenticate: Bearer`. Raw stays available in the
  // adapter for a site that takes the bare key instead.
  apimeAuthStyle: "bearer",
  apimeClassMap: {
    "0": "Film Dummy",
    "1": "Film Stunt",
    "2": "Movie Lover",
    "3": "Cinema Addicted",
    "4": "Film Critic",
    "5": "VIP",
    "6": "Retiree",
    "7": "Uploader",
    "8": "Director",
    "9": "Producer",
    "10": "Executive Producer",
  },

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "Retro Movies / TV",
  contentCategories: ["Movies", "TV"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#daa520",
  logo: "/tracker-logos/retroflix_logo.png",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "",
  statusPageUrl: "",

  // ── Community ───────────────────────────────────────────────────────
  userClasses: [
    {
      name: "Film Dummy",
      requirements: "Demotion class below 0.4 ratio. Improve within 30 days or be banned.",
      outsideLadder: "below",
    },
    { name: "Film Stunt", requirements: "Entry class" },
    {
      name: "Movie Lover",
      requirements: "Downloaded ≥ 50 GB, ratio ≥ 1.05, account age ≥ 4 weeks",
    },
    {
      name: "Cinema Addicted",
      requirements: "Downloaded ≥ 120 GB, ratio ≥ 1.55, account age ≥ 8 weeks",
    },
    {
      name: "Film Critic",
      requirements: "Downloaded ≥ 300 GB, ratio ≥ 2.05, account age ≥ 15 weeks",
    },
    { name: "VIP", requirements: "Granted by staff", outsideLadder: "above" },
    { name: "Retiree", requirements: "Former staff", outsideLadder: "above" },
    { name: "Uploader", requirements: "Appointed by staff", outsideLadder: "above" },
    { name: "Director", requirements: "Moderator", outsideLadder: "above" },
    { name: "Producer", requirements: "Administrator", outsideLadder: "above" },
    { name: "Executive Producer", requirements: "SysOp", outsideLadder: "above" },
  ],
  releaseGroups: [],
  bannedGroups: [],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  rules: {
    minimumRatio: 0.4,
    seedTimeHours: 72,
    loginIntervalDays: 90,
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: false,
  warningNote: "",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: false,
  profileUrlPattern: "",
}
