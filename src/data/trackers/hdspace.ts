// src/data/trackers/hdspace.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

const GiB = 1024 ** 3
const TiB = 1024 ** 4

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
  // The class legend and the three automatic promotion thresholds come from
  // the site's user class FAQ, supplied by a member on 2026-11-15.
  rankProgression: "automatic",
  rankRequirementsSource: {
    url: null,
    title: "HD-Space user classes and promotion FAQ",
    accessedAt: "2026-11-15",
    sourceLastModified: null,
    verification: "published",
    note:
      "The FAQ is login-gated; a member supplied its text on 2026-11-15. HD Spacer, HD Astronaut and HD Alien promotions are automatic; the other classes are granted or appointed.",
  },
  rankUnresolved: [
    "HD Internal, V.I.P., Uploader, Elite Uploader and the staff classes are granted or appointed outside the earned ladder.",
    "Elite Uploader also has a monthly top-five uploader route that the app does not track.",
    "Demotion thresholds (HD Spacer below 0.95, HD Astronaut below 2.05, HD Alien below 4.05) do not change next-class eligibility.",
  ],
  userClasses: [
    {
      name: "Leecher",
      requirements: "Dropped from Members for low ratio. Can view torrents but not download; recovery is by donation.",
      outsideLadder: "below",
    },
    {
      name: "Members",
      requirements: "Default class for new members. Access to torrents, seed bonus, upload, helpdesk and lottery.",
    },
    {
      name: "HD Spacer",
      requirements: "At least 100 GB uploaded and ratio at or above 1.05. Automatic demotion below 0.95.",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "hds-spacer-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 100 * GiB, scope: "account", label: "At least 100 GiB uploaded" },
          { kind: "numeric", id: "hds-spacer-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 1.05, scope: "account", label: "Ratio at least 1.05" },
        ],
      },
    },
    {
      name: "HD Astronaut",
      requirements: "At least 500 GB uploaded and ratio at or above 2.25. Automatic demotion below 2.05.",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "hds-astronaut-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 500 * GiB, scope: "account", label: "At least 500 GiB uploaded" },
          { kind: "numeric", id: "hds-astronaut-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 2.25, scope: "account", label: "Ratio at least 2.25" },
        ],
      },
    },
    {
      name: "HD Alien",
      requirements: "At least 2 TB uploaded and ratio at or above 4.25. Automatic demotion below 4.05.",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "hds-alien-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 2 * TiB, scope: "account", label: "At least 2 TiB uploaded" },
          { kind: "numeric", id: "hds-alien-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 4.25, scope: "account", label: "Ratio at least 4.25" },
        ],
      },
    },
    {
      name: "HD Internal",
      requirements: "Release your own Blu-ray images, remuxes and encodes on HD-Space. Staff-granted.",
      outsideLadder: "above",
    },
    {
      name: "V.I.P.",
      requirements:
        "Donation class. Access to HD Spacer and HD Astronaut extras; immune to automatic demotion and the Hit & Run and low-ratio systems.",
      outsideLadder: "above",
    },
    {
      name: "Uploader",
      requirements: "Ask staff after uploading 20 torrents. May upload and download any torrent.",
      outsideLadder: "above",
    },
    {
      name: "Elite Uploader",
      requirements:
        "Permanent after 100 uploads, 20 TB uploaded and ratio above 7; also granted for one month to the five top uploaders of the last 30 days.",
      outsideLadder: "above",
    },
    {
      name: "Forum Moderator",
      requirements: "Staff. Moderates forum posts, comments and the shoutbox.",
      outsideLadder: "above",
    },
    {
      name: "Moderator",
      requirements: "Staff. Can edit and delete any uploaded torrent and moderate comments.",
      outsideLadder: "above",
    },
    {
      name: "Administrator",
      requirements: "Staff. Site administration.",
      outsideLadder: "above",
    },
    {
      name: "Owner",
      requirements: "Site owner with full administration.",
      outsideLadder: "above",
    },
  ],
  releaseGroups: [],
  bannedGroups: [],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  // Prowlarr Indexers definitions/v11/hdspace.yml states minimumratio 1.0 and
  // minimumseedtime 86400 seconds (24 hours). The class FAQ does not restate
  // the seeding policy.
  rules: {
    minimumRatio: 1.0,
    seedTimeHours: 24,
    loginIntervalDays: 0,
    fullRulesMarkdown: [
      "## User classes",
      "",
      "- Members is the default class. Leecher is the low-ratio penalty state and cannot download.",
      "- HD Spacer: at least 100 GB uploaded and ratio 1.05; demoted below 0.95.",
      "- HD Astronaut: at least 500 GB uploaded and ratio 2.25; demoted below 2.05.",
      "- HD Alien: at least 2 TB uploaded and ratio 4.25; demoted below 4.05.",
      "- HD Internal, V.I.P., Uploader and the staff classes are granted or appointed.",
      "- Elite Uploader: 100 uploads, 20 TB uploaded and ratio above 7, or one month for the five top uploaders of the last 30 days.",
    ],
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: false,
  warningNote: "",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: false,
  profileUrlPattern: "",
}
