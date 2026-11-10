// src/data/trackers/czteam.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

const GiB = 1024 ** 3
const TiB = 1024 ** 4
const DAY = 86_400

export const czteam: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "czteam",
  name: "CZTeam",
  abbreviation: "CZT",
  url: "https://czteam.me",
  description:
    "Romanian general tracker, formerly Czone, covering movies, TV, games, music, software, anime, sport and XXX. English and Romanian are allowed sitewide.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "czteam",
  apiPath: "/userdetails.php",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "General (Romanian)",
  contentCategories: ["Movies", "TV", "Games", "Music", "Apps", "Anime", "Sports", "XXX", "Books"],
  language: "Romanian",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#c93131",
  logo: "",
  bonusName: "Bonus points",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "",
  statusPageUrl: "",

  // ── Community ───────────────────────────────────────────────────────
  rankProgression: "automatic",
  rankRequirementsSource: {
    url: "https://czteam.me/faq.php",
    title: "CZTeam FAQ, \"User classes\" and \"Automatic promotion ladder\"",
    accessedAt: "2026-11-10",
    sourceLastModified: null,
    verification: "published",
    note:
      "Read from the public FAQ, which states every threshold. Promotions run every 15 minutes; demotions run on the 1st of each month against the same six metrics, so a class is also the floor you have to keep. Total seedtime and completed seeds are not supported rank metrics and stay text-only.",
  },
  rankUnresolved: [
    "Total seedtime (6 months / 2 years / 5 years) and completed seeds (25 / 50 / 60) are not supported rank metrics, so those conditions stay text-only.",
    "Average seedtime is the site's total seedtime divided by downloaded torrents, not the fleet average the app collects.",
    "VIP, Uploader and staff classes are awarded by staff, not by the promotion sweep.",
  ],
  userClasses: [
    {
      name: "User",
      requirements: "Default class on signup. Download, upload, comment, post on forums",
    },
    {
      name: "Power User",
      requirements:
        "Upload ≥ 500 GiB, ratio ≥ 1.50, ≥ 25 completed seeds (seeded 7+ days), avg seedtime ≥ 10 days, total seedtime ≥ 6 months, age ≥ 1 month",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "czt-power-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 30, scope: "account", label: "At least 1 month registered" },
          { kind: "numeric", id: "czt-power-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 500 * GiB, scope: "account", label: "At least 500 GiB uploaded" },
          { kind: "numeric", id: "czt-power-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 1.5, scope: "account", label: "Ratio at least 1.50" },
          { kind: "numeric", metric: "averageSeedTimeSeconds", comparison: "gte", requiredValue: 10 * DAY, scope: "account", label: "Average seed time ≥ 10 days" },
          { kind: "non-numeric", label: "At least 25 completed seeds", description: "Torrents seeded for at least 7 days" },
          { kind: "non-numeric", label: "Total seed time ≥ 6 months" },
        ],
      },
    },
    {
      name: "CZTeam Elite",
      requirements:
        "Upload ≥ 1 TiB, ratio ≥ 2.00, ≥ 50 completed seeds, avg seedtime ≥ 25 days, total seedtime ≥ 2 years, age ≥ 3 months",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "czt-elite-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 90, scope: "account", label: "At least 3 months registered" },
          { kind: "numeric", id: "czt-elite-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 1 * TiB, scope: "account", label: "At least 1 TiB uploaded" },
          { kind: "numeric", id: "czt-elite-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 2.0, scope: "account", label: "Ratio at least 2.00" },
          { kind: "numeric", metric: "averageSeedTimeSeconds", comparison: "gte", requiredValue: 25 * DAY, scope: "account", label: "Average seed time ≥ 25 days" },
          { kind: "non-numeric", label: "At least 50 completed seeds" },
          { kind: "non-numeric", label: "Total seed time ≥ 2 years" },
        ],
      },
    },
    {
      name: "CzT Devil",
      requirements:
        "Upload ≥ 1.5 TiB, ratio ≥ 2.50, ≥ 60 completed seeds, avg seedtime ≥ 45 days, total seedtime ≥ 5 years, age ≥ 6 months. +2 invites",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "czt-devil-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 180, scope: "account", label: "At least 6 months registered" },
          { kind: "numeric", id: "czt-devil-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 1536 * GiB, scope: "account", label: "At least 1.5 TiB uploaded" },
          { kind: "numeric", id: "czt-devil-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 2.5, scope: "account", label: "Ratio at least 2.50" },
          { kind: "numeric", metric: "averageSeedTimeSeconds", comparison: "gte", requiredValue: 45 * DAY, scope: "account", label: "Average seed time ≥ 45 days" },
          { kind: "non-numeric", label: "At least 60 completed seeds" },
          { kind: "non-numeric", label: "Total seed time ≥ 5 years" },
        ],
      },
    },
    { name: "Disabled", requirements: "Parked account, downloads blocked", outsideLadder: "below" },
    { name: "Banned", requirements: "Permanent ban", outsideLadder: "below" },
    { name: "VIP", requirements: "By staff decision. No ratio enforcement, custom title", outsideLadder: "above" },
    { name: "Uploader", requirements: "Application via uploadapp.php", outsideLadder: "above" },
    { name: "Junior Moderator", requirements: "By admin promotion", outsideLadder: "above" },
    { name: "Moderator", requirements: "By admin promotion", outsideLadder: "above" },
    { name: "Administrator", requirements: "By SysOp decision", outsideLadder: "above" },
    { name: "SysOp", requirements: "Site owner", outsideLadder: "above" },
  ],
  releaseGroups: [],
  bannedGroups: [],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  // Read from the public rules.php and faq.php on 2026-11-10.
  rules: {
    requiredAccountRatio: 0.5,
    requiredTorrentRatio: 1.0,
    minimumRatio: 0.5,
    seedTimeHours: 72,
    loginIntervalDays: 60,
    satisfactionMode: "any",
    fulfillmentPeriodHours: 240,
    hnrBanLimit: 10,
    fullRulesMarkdown: [
      "## Ratio",
      "",
      "- Maintain a ratio of at least 0.50 to keep download access",
      "- Below 0.50 you are warned; a persistent low ratio ends in a download lockout",
      "- Ratio top-ups can be bought from the bonus shop",
      "",
      "## Seeding and Hit & Runs",
      "",
      "- The rules ask you to seed every torrent for at least 72 hours after it completes",
      "- A torrent enters Hit & Run tracking once you have downloaded more than 50% of it",
      "- From that moment you have 10 days to reach a personal ratio of 1.0 on it, or to accumulate 72 hours of seed time on it — whichever comes first",
      "- 5 active Hit & Runs give a 2-week warning; 10 disable the account",
      "- A Hit & Run clears for 250 bonus points, or free after 144 hours of total seed time on that torrent",
      "",
      "## Warnings and sanctions",
      "",
      "- Three active warnings result in a temporary download lockout",
      "- Cheating clients, multi-accounting, illegal uploads and phishing links are instant permanent bans",
      "",
      "## Account",
      "",
      "- Inactive accounts are pruned automatically: 60 days for regular users, 21 days for disabled ones",
      "- One account per person; account sharing is treated as multi-accounting",
      "",
      "## Classes",
      "",
      "- Promotions run every 15 minutes once every threshold for the next class is met",
      "- Demotions run on the 1st of each month against the same six metrics, so a class has to be kept",
      "- A demotion shield costs one third of your bonus points and protects one monthly run",
    ],
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: true,
  warningNote: "New adapter. Not tested against a live account yet.",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: false,
  profileUrlPattern: "",
}
