// src/data/trackers/teamhd.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const teamhd: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "teamhd",
  name: "TeamHD",
  abbreviation: "THD",
  url: "https://teamhd.org",
  description:
    "Russian HD tracker for movies, TV, documentaries, hi-res audio, music videos, sport and demos. Login is behind a reCAPTCHA and there is no user API.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "teamhd",
  apiPath: "/index.php",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "HD Movies / TV (Russian)",
  contentCategories: ["Movies", "TV", "Documentaries", "Music", "Sports", "Anime"],
  language: "Russian",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#1d4ed8",
  logo: "",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "",
  statusPageUrl: "",

  // ── Community ───────────────────────────────────────────────────────
  rankProgression: "unknown",
  rankRequirementsSource: {
    url: null,
    title: "No class thresholds are published outside the login",
    accessedAt: null,
    sourceLastModified: null,
    verification: "unresolved",
    note:
      "The site's rules and class pages are behind a login this project has no account on, so the ladder is the three class names PT-depiler observes, with no thresholds.",
  },
  rankUnresolved: [
    "No promotion thresholds are published outside the login; the ladder lists class names only.",
  ],
  userClasses: [
    { name: "User", requirements: "Entry class" },
    { name: "Power User", requirements: "Thresholds not published" },
    { name: "VIP", requirements: "Granted or staff class", outsideLadder: "above" },
  ],
  releaseGroups: [],
  bannedGroups: [],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  // The audit rule and the 90-day inactivity sweep are the two rules a public
  // page states: Jackett's teamhd.yml records the inactivity text verbatim, and
  // Prowlarr's teamhd.yml records the 1.0 per-torrent ratio. The site's own
  // ratio floor and seed-time minimum are behind the login, so the account
  // ratio stays explicitly unknown rather than being reported as "no minimum".
  rules: {
    requiredAccountRatio: null,
    requiredTorrentRatio: 1.0,
    minimumRatio: 0,
    seedTimeHours: 0,
    loginIntervalDays: 90,
    satisfactionMode: "any",
    fullRulesMarkdown: [
      "## Ratio",
      "",
      "- Seed each torrent to ratio 1:1 (Prowlarr's teamhd.yml)",
      "- The site's own minimum ratio is not published outside the login",
      "",
      "## Account",
      "",
      "- Inactive users are regularly deleted: no download or upload activity, or no site visit, for 90 days",
      "- Long absences should use account parking",
      "",
      "## Seeding",
      "",
      "- The per-torrent seed-time minimum is not published outside the login",
    ],
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: true,
  warningNote:
    "Totals, seeding count and bonus poll correctly. Class and join date do not parse yet, and no class thresholds are published.",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: false,
  profileUrlPattern: "",
}
