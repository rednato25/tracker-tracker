// src/data/trackers/fileiplay.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

const GiB = 1024 ** 3
const TiB = 1024 ** 4

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
  // The normal ladder and its thresholds come from the site's User Classes
  // page, supplied by a member on 2026-11-15. The page is login-gated.
  rankProgression: "automatic",
  rankRequirementsSource: {
    url: null,
    title: "FileIplay User Classes and Downloading & Seeding pages",
    accessedAt: "2026-11-15",
    sourceLastModified: null,
    verification: "published",
    note:
      "The pages are login-gated; a member supplied their text on 2026-11-15. Promotion thresholds are quoted from that copy. The tracker does not expose per-torrent seeding debt or active seeding days to the app.",
  },
  rankUnresolved: [
    "Newbie to User also requires 12 verified seeding hours on every completed download; the app cannot see per-torrent seeding debt.",
    "Elite User and Addict promotions also require active seeding days (1 in the previous 7, or 30 in the previous 60); the tracker does not expose that activity.",
    "Ratio demotions (Elite below 0.4, Addict below 0.8), the 14-day recovery window and the uploader activity rule are not modelled as rank goals.",
    "VIP, Special User, Uploader, Moderator, Admin and Owner are granted or appointed outside the earned ladder.",
  ],
  userClasses: [
    {
      name: "Newbie",
      requirements: "Starting class for new registrations. Learn the rules and keep completed downloads seeding.",
    },
    {
      name: "User",
      requirements:
        "At least 7 days registered and 12 verified seeding hours on every completed download. No ratio or traffic minimum.",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "fip-user-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 7, scope: "account", label: "At least 7 days registered" },
        ],
      },
    },
    {
      name: "Elite User",
      requirements:
        "At least 30 days registered, ratio 0.6 or higher, 500 GiB uploaded, 250 GiB downloaded, and at least 1 active seeding day in the previous 7 complete days.",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "fip-elite-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 30, scope: "account", label: "At least 30 days registered" },
          { kind: "numeric", id: "fip-elite-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 0.6, scope: "account", label: "Ratio at least 0.6" },
          { kind: "numeric", id: "fip-elite-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 500 * GiB, scope: "account", label: "At least 500 GiB uploaded" },
          { kind: "numeric", id: "fip-elite-download", metric: "downloadedBytes", comparison: "gte", requiredValue: 250 * GiB, scope: "account", label: "At least 250 GiB downloaded" },
        ],
      },
    },
    {
      name: "Addict",
      requirements:
        "At least 90 days registered, ratio 1.1 or higher, 1 TiB uploaded, 500 GiB downloaded, and at least 30 active seeding days in the previous 60 complete days.",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "fip-addict-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 90, scope: "account", label: "At least 90 days registered" },
          { kind: "numeric", id: "fip-addict-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 1.1, scope: "account", label: "Ratio at least 1.1" },
          { kind: "numeric", id: "fip-addict-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 1 * TiB, scope: "account", label: "At least 1 TiB uploaded" },
          { kind: "numeric", id: "fip-addict-download", metric: "downloadedBytes", comparison: "gte", requiredValue: 500 * GiB, scope: "account", label: "At least 500 GiB downloaded" },
        ],
      },
    },
    {
      name: "VIP",
      requirements:
        "Supporter class. Active VIP benefits may run alongside another class for their granted duration or permanently.",
      outsideLadder: "above",
    },
    {
      name: "Special User",
      requirements: "Assigned by staff in recognition of contribution.",
      outsideLadder: "above",
    },
    {
      name: "Uploader",
      requirements:
        "Recognised content contributor. Five days without an upload triggers a warning; after three more days the class reverts to User.",
      outsideLadder: "above",
    },
    {
      name: "Moderator",
      requirements: "Staff member responsible for moderation and enforcing the rules.",
      outsideLadder: "above",
    },
    {
      name: "Admin",
      requirements: "Administrator responsible for site management.",
      outsideLadder: "above",
    },
    {
      name: "Owner",
      requirements: "Community owner with full site administration.",
      outsideLadder: "above",
    },
  ],
  releaseGroups: [],
  bannedGroups: [],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  // Member-provided copy of the Downloading & Seeding page, 2026-11-15.
  rules: {
    requiredAccountRatio: 0,
    requiredTorrentRatio: 1.0,
    minimumRatio: 0,
    seedTimeHours: 12,
    satisfactionMode: "any",
    fulfillmentPeriodHours: 168,
    hnrBanLimit: 20,
    loginIntervalDays: 0,
    fullRulesMarkdown: [
      "## Hit & Runs",
      "",
      "- Reach a 1:1 ratio or seed each torrent for at least 12 hours within 7 days of completing it.",
      "- 20 or more active Hit & Runs result in a download restriction.",
      "- Freeleech torrents still require seeding.",
      "- Active VIP membership protects against new Hit & Run penalties, including temporary VIP.",
      "- When temporary VIP expires naturally, torrents completed while it was active get a 7-day grace period to reach 12 hours of seeding or a 1:1 ratio.",
      "",
      "## Classes",
      "",
      "- Normal progression is Newbie -> User -> Elite User -> Addict; checks run hourly and change one class at a time.",
      "- There is no automatic User -> Newbie demotion.",
      "- Elite User below 0.4 or Addict below 0.8 gets a System message and 14 full days to recover before one class demotion; demotions are at least 30 days apart.",
      "- Uploader activity: after 5 days without an upload, a warning gives 3 full days to upload another torrent, otherwise the class reverts to User.",
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
