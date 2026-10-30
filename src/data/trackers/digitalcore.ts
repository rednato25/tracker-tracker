// src/data/trackers/digitalcore.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

const GiB = 1024 ** 3
const TiB = 1024 ** 4

export const digitalcore: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "digitalcore",
  name: "DigitalCore.Club",
  abbreviation: "DCC",
  url: "https://digitalcore.club",
  description:
    "Scene-oriented 0day/general tracker with 1.5M+ torrents. Movies, TV, music, apps, games, ebooks.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "digitalcore",
  apiPath: "/api/v1/status",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "0day / General",
  contentCategories: ["Movies", "TV", "Music", "Games", "Apps", "Books"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#ffffff",
  logo: "/tracker-logos/digitalcore_logo.png",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "",
  statusPageUrl: "https://status.digitalcore.club/status/digitalcore",

  // ── Community ───────────────────────────────────────────────────────
  rankProgression: "automatic",
  rankRequirementsSource: {
    url: "https://digitalcore.club/",
    title: "DigitalCore user-class list",
    accessedAt: "2026-10-31",
    sourceLastModified: null,
    verification: "published",
    note:
      "Confirmed by the owner on 2026-10-31 from the site's user-class list. All comparisons are at least. GB/TB text without a stated basis is read as the larger binary GiB/TiB value.",
  },
  rankUnresolved: [
    "Request slots, invites, forums and upload moderation are perks, not promotion thresholds.",
    "GB/TB text without a stated basis is read as the larger binary unit.",
  ],
  userClasses: [
    { name: "Rogue", requirements: "Starting class" },
    {
      name: "Sentinel",
      requirements:
        "Age ≥ 14 days, upload ≥ 50 GiB, ratio ≥ 1.05. Requests, bonus system, moderated uploads",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "dc-sentinel-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 14, scope: "account", label: "At least 14 days registered" },
          { kind: "numeric", id: "dc-sentinel-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 50 * GiB, scope: "account", unitReading: "conservative", label: "At least 50 GiB uploaded" },
          { kind: "numeric", id: "dc-sentinel-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 1.05, scope: "account", label: "Ratio at least 1.05" },
        ],
      },
    },
    {
      name: "Viceroy",
      requirements:
        "Age ≥ 105 days, upload ≥ 300 GiB, ratio ≥ 1.10. Top lists, extended stats, IP logging cleared",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "dc-viceroy-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 105, scope: "account", label: "At least 105 days registered" },
          { kind: "numeric", id: "dc-viceroy-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 300 * GiB, scope: "account", unitReading: "conservative", label: "At least 300 GiB uploaded" },
          { kind: "numeric", id: "dc-viceroy-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 1.1, scope: "account", label: "Ratio at least 1.10" },
        ],
      },
    },
    {
      name: "Sentry",
      requirements:
        "Age ≥ 210 days, upload ≥ 1200 GiB, ratio ≥ 1.10. 3 request slots, 2 invites, Sentry+ forums",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "dc-sentry-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 210, scope: "account", label: "At least 210 days registered" },
          { kind: "numeric", id: "dc-sentry-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 1200 * GiB, scope: "account", unitReading: "conservative", label: "At least 1200 GiB uploaded" },
          { kind: "numeric", id: "dc-sentry-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 1.1, scope: "account", label: "Ratio at least 1.10" },
        ],
      },
    },
    {
      name: "Guardian",
      requirements:
        "Age ≥ 500 days, upload ≥ 5 TiB, ratio ≥ 20.0. 5 extra invites, 6 extra request slots, unmoderated uploads",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "dc-guardian-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 500, scope: "account", label: "At least 500 days registered" },
          { kind: "numeric", id: "dc-guardian-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 5 * TiB, scope: "account", unitReading: "conservative", label: "At least 5 TiB uploaded" },
          { kind: "numeric", id: "dc-guardian-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 20, scope: "account", label: "Ratio at least 20.0" },
        ],
      },
    },
    {
      name: "Vanguard",
      requirements:
        "Age ≥ 730 days, upload ≥ 20 TiB, ratio ≥ 20.0. 10 extra invites, 10 extra request slots",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "dc-vanguard-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 730, scope: "account", label: "At least 730 days registered" },
          { kind: "numeric", id: "dc-vanguard-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 20 * TiB, scope: "account", unitReading: "conservative", label: "At least 20 TiB uploaded" },
          { kind: "numeric", id: "dc-vanguard-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 20, scope: "account", label: "Ratio at least 20.0" },
        ],
      },
    },
    {
      name: "Uploader",
      requirements: "Staff-granted for high-volume uploaders",
      outsideLadder: "above",
    },
    {
      name: "Titan",
      requirements: "Staff-granted — highest community honor",
      outsideLadder: "above",
    },
    {
      name: "VIP",
      requirements: "Staff-granted for significant contributions or donation",
      outsideLadder: "above",
    },
    {
      name: "FLS",
      requirements: "Granted or staff class",
      outsideLadder: "above",
    },
    {
      name: "Moderator",
      requirements: "Granted or staff class",
      outsideLadder: "above",
    },
    {
      name: "Admin",
      requirements: "Granted or staff class",
      outsideLadder: "above",
    },
  ],
  releaseGroups: [],
  bannedGroups: [],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  rules: {
    minimumRatio: 0.5,
    seedTimeHours: 120,
    loginIntervalDays: 90,
    fullRulesMarkdown: [
      "## Ratio",
      "",
      "- Minimum ratio: 0.5",
      "- Below 0.5 → 5 days to recover (ratio watch), then download privileges revoked",
      "- Leech bonus system: every 10 GB actively seeded = 1% download discount, up to 100% (site-wide freeleech at 1 TiB seeded)",
      "- Inverse scarcity bonus: torrents with fewer seeders give higher bonus",
      "- 24-hour freeleech on all new uploads",
      "- Large torrents may also be freeleech",
      "",
      "## Hit & Run",
      "",
      "- A download is any torrent you have started to download 10% or more",
      "- Seed for 5 days or to 1:1 ratio, whichever comes first",
      "- If no announce for 1 hour, it shows as a Hit & Run",
      "- 10 day grace period to fix it before it becomes permanent",
      "- Permanent HnRs can be removed with bonus points, upload credit, or donation",
      "- 5 active HnRs triggers an account warning",
      "- Continued HnRs result in a download ban",
      "",
      "## Account Inactivity",
      "",
      "- Must remain active — inactive accounts are disabled",
      "",
      "## General",
      "",
      "- One account per person per lifetime",
      "- Torrent files are unique to you — do not share or use with debrid services",
      "- Cross-seeding is allowed",
      "- VPNs are allowed (bind to torrent client only recommended)",
      "- No buying/selling invites",
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
