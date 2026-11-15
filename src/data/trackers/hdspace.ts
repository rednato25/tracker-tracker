// src/data/trackers/hdspace.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const hdspace: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "hdspace",
  name: "HD-Space",
  abbreviation: "HDS",
  url: "https://hd-space.org",
  description:
    "Long-running HD movie and TV tracker, online since 2009, running a customised xbtit codebase. Periodic open signups; there is no API, so stats come from the user panel with the browser's Cloudflare-cleared session.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "hdspace",
  apiPath: "/index.php?page=usercp",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "HD Movies & TV",
  contentCategories: ["Movies", "TV", "Music", "Anime", "XXX", "Documentaries", "Apps"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#1e6fb8",
  logo: "/tracker-logos/hdspace_logo.png",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "",
  statusPageUrl: "",

  // ── Community ───────────────────────────────────────────────────────
  // The site's own class legend, lowest to highest. Staff and donor classes
  // sit outside the earned ladder; Leecher is a ratio demotion and Parked is
  // an administrative state.
  userClasses: [
    { name: "Leecher", requirements: "Ratio below the site minimum", outsideLadder: "below" },
    { name: "Members", requirements: "Default class after signup" },
    { name: "HD Spacer" },
    { name: "HD Astronaut" },
    { name: "HD Alien" },
    { name: "HD Internal" },
    { name: "Uploader", requirements: "Staff", outsideLadder: "above" },
    { name: "V.I.P.", requirements: "Donor or staff appointment", outsideLadder: "above" },
    { name: "Moderator", requirements: "Staff", outsideLadder: "above" },
    { name: "Forum Moderator", requirements: "Staff", outsideLadder: "above" },
    { name: "Administrator", requirements: "Staff", outsideLadder: "above" },
    { name: "Owner", requirements: "Site owner", outsideLadder: "above" },
    { name: "Parked", requirements: "Account parked by the user", outsideLadder: "below" },
  ],
  releaseGroups: [],
  bannedGroups: [],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  // Prowlarr Indexers definitions/v11/hdspace.yml states minimumratio 1.0 and
  // minimumseedtime 86400 seconds (24 hours).
  rules: {
    minimumRatio: 1.0,
    seedTimeHours: 24,
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
