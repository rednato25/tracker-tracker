// src/data/trackers/fileiplay.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const fileiplay: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "fileiplay",
  name: "FileIplay",
  abbreviation: "FIP",
  url: "https://fileiplay.org",
  description:
    "Romanian general tracker covering movies, TV, music, games and XXX. A long-running site that has been rebuilt on a modern Laravel front end; signing up takes an invite or an application.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "fileiplay",
  apiPath: "/profile",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "General",
  contentCategories: ["Movies", "TV", "Music", "Games", "XXX", "Sports"],
  language: "Romanian",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#7ac943",
  logo: "/tracker-logos/fileiplay_logo.png",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "",
  statusPageUrl: "",

  // ── Community ───────────────────────────────────────────────────────
  // The class ladder is not published to members who are not signed in, so it
  // stays empty rather than being guessed from a screenshot.
  userClasses: [],
  releaseGroups: [],
  bannedGroups: [],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  // Prowlarr Indexers definitions/v11/fileiplay.yml carries both figures in its
  // caps: minimumratio 1.0 and minimumseedtime 43200 seconds (12 hours).
  rules: {
    minimumRatio: 1.0,
    seedTimeHours: 12,
    loginIntervalDays: 0,
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: true,
  warningNote:
    "Profile parsing has not been checked against a live account. FileIplay has no stats API, so the adapter reads the profile page; confirm the first poll before relying on it.",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: false,
  profileUrlPattern: "",
}
