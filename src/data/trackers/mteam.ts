// src/data/trackers/mteam.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

const GiB = 1024 ** 3

export const mteam: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "mteam",
  name: "M-Team",
  abbreviation: "MT",
  url: "https://kp.m-team.cc",
  description: "Chinese private tracker covering movies, TV, music, games, anime and more.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "mteam",
  apiPath: "/api/member/profile",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "General",
  contentCategories: [
    "Movies",
    "TV",
    "Music",
    "Games",
    "Anime",
    "Sports",
    "Books",
    "Audiobooks",
    "Apps",
    "Documentaries",
    "Education",
  ],
  language: "Chinese",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#2F80ED",
  logo: "/tracker-logos/mteam_logo.png",
  bonusName: "Bonus Points",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "",
  statusPageUrl: "",

  // ── Community ───────────────────────────────────────────────────────
  // The rules page confirms the nine ladder classes and VIP. It does not name
  // the administrative roles, so they are deliberately absent here.
  rankProgression: "automatic",
  rankRequirementsSource: {
    url: "https://kp.m-team.cc/",
    title: "M-Team user-class and account-rules pages",
    accessedAt: "2026-10-31",
    sourceLastModified: null,
    verification: "published",
    note:
      "Confirmed by the owner on 2026-10-31 from the site's user-class and account-rules pages. Level comparisons are strict (more than). GB text without a stated basis is read as the larger binary GiB value. The login deadline is 40 days.",
  },
  rankUnresolved: [
    "GB text without a stated basis is read as the larger binary GiB value.",
    "Demoted-below ratios in the source text are demotion states, not promotion conditions.",
    "The first-30-days newbie assessment (upload > 30 GiB, download > 15 GiB, more than 6,000 Bonus Points) is recorded in the rules text; the rank ladder cannot evaluate it.",
    "The minimum ratio is tiered by downloaded volume (0.6 above 10 GiB to 1.0 above 500 GiB); rules.minimumRatio carries the strictest tier of 1.0.",
  ],
  userClasses: [
    {
      name: "User",
      requirements: "Entry class",
      perks: [
        { type: "custom", label: "Post candidates" },
        { type: "custom", label: "Fun Box access" },
        { type: "custom", label: "Spend Bonus Points" },
      ],
    },
    {
      name: "Power User",
      requirements: "Registered > 4 weeks, download > 200 GB, ratio > 2 (demoted below 1.9)",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "mt-power-age", metric: "accountAgeDays", comparison: "gt", requiredValue: 28, scope: "account", label: "More than 4 weeks registered" },
          { kind: "numeric", id: "mt-power-download", metric: "downloadedBytes", comparison: "gt", requiredValue: 200 * GiB, scope: "account", unitReading: "conservative", label: "More than 200 GiB downloaded" },
          { kind: "numeric", id: "mt-power-ratio", metric: "accountRatio", comparison: "gt", requiredValue: 2, scope: "account", label: "Ratio above 2" },
        ],
      },
      perks: [
        { type: "custom", label: "Post candidates" },
        { type: "custom", label: "Fun Box access" },
        { type: "custom", label: "Spend Bonus Points" },
      ],
    },
    {
      name: "Elite User",
      requirements: "Registered > 8 weeks, download > 400 GB, ratio > 3 (demoted below 2.9)",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "mt-elite-age", metric: "accountAgeDays", comparison: "gt", requiredValue: 56, scope: "account", label: "More than 8 weeks registered" },
          { kind: "numeric", id: "mt-elite-download", metric: "downloadedBytes", comparison: "gt", requiredValue: 400 * GiB, scope: "account", unitReading: "conservative", label: "More than 400 GiB downloaded" },
          { kind: "numeric", id: "mt-elite-ratio", metric: "accountRatio", comparison: "gt", requiredValue: 3, scope: "account", label: "Ratio above 3" },
        ],
      },
      perks: [
        { type: "invite", label: "Send Invite" },
        { type: "custom", label: "Post candidates" },
        { type: "custom", label: "Spend Bonus Points" },
      ],
    },
    {
      name: "Crazy User",
      requirements: "Registered > 12 weeks, download > 500 GB, ratio > 4 (demoted below 3.9)",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "mt-crazy-age", metric: "accountAgeDays", comparison: "gt", requiredValue: 84, scope: "account", label: "More than 12 weeks registered" },
          { kind: "numeric", id: "mt-crazy-download", metric: "downloadedBytes", comparison: "gt", requiredValue: 500 * GiB, scope: "account", unitReading: "conservative", label: "More than 500 GiB downloaded" },
          { kind: "numeric", id: "mt-crazy-ratio", metric: "accountRatio", comparison: "gt", requiredValue: 4, scope: "account", label: "Ratio above 4" },
        ],
      },
      perks: [
        { type: "invite", label: "Send Invite" },
        { type: "custom", label: "Post candidates" },
        { type: "custom", label: "Spend Bonus Points" },
      ],
    },
    {
      name: "Insane User",
      requirements: "Registered > 16 weeks, download > 800 GB, ratio > 5 (demoted below 4.9)",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "mt-insane-age", metric: "accountAgeDays", comparison: "gt", requiredValue: 112, scope: "account", label: "More than 16 weeks registered" },
          { kind: "numeric", id: "mt-insane-download", metric: "downloadedBytes", comparison: "gt", requiredValue: 800 * GiB, scope: "account", unitReading: "conservative", label: "More than 800 GiB downloaded" },
          { kind: "numeric", id: "mt-insane-ratio", metric: "accountRatio", comparison: "gt", requiredValue: 5, scope: "account", label: "Ratio above 5" },
        ],
      },
      perks: [
        { type: "invite", label: "Send Invite" },
        { type: "custom", label: "Post candidates" },
        { type: "custom", label: "Spend Bonus Points" },
      ],
    },
    {
      name: "Veteran User",
      requirements: "Registered > 20 weeks, download > 1000 GB, ratio > 6 (demoted below 5.9)",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "mt-veteran-age", metric: "accountAgeDays", comparison: "gt", requiredValue: 140, scope: "account", label: "More than 20 weeks registered" },
          { kind: "numeric", id: "mt-veteran-download", metric: "downloadedBytes", comparison: "gt", requiredValue: 1000 * GiB, scope: "account", unitReading: "conservative", label: "More than 1000 GiB downloaded" },
          { kind: "numeric", id: "mt-veteran-ratio", metric: "accountRatio", comparison: "gt", requiredValue: 6, scope: "account", label: "Ratio above 6" },
        ],
      },
      perks: [
        { type: "invite", label: "Send Invite" },
        { type: "custom", label: "Permanent retention when archived" },
        { type: "custom", label: "Spend Bonus Points" },
      ],
    },
    {
      name: "Extreme User",
      requirements: "Registered > 24 weeks, download > 2000 GB, ratio > 7 (demoted below 6.9)",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "mt-extreme-age", metric: "accountAgeDays", comparison: "gt", requiredValue: 168, scope: "account", label: "More than 24 weeks registered" },
          { kind: "numeric", id: "mt-extreme-download", metric: "downloadedBytes", comparison: "gt", requiredValue: 2000 * GiB, scope: "account", unitReading: "conservative", label: "More than 2000 GiB downloaded" },
          { kind: "numeric", id: "mt-extreme-ratio", metric: "accountRatio", comparison: "gt", requiredValue: 7, scope: "account", label: "Ratio above 7" },
        ],
      },
      perks: [
        { type: "invite", label: "Send Invite" },
        { type: "custom", label: "Permanent account retention" },
        { type: "custom", label: "Spend Bonus Points" },
      ],
    },
    {
      name: "Ultimate User",
      requirements: "Registered > 28 weeks, download > 2500 GB, ratio > 8 (demoted below 7.9)",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "mt-ultimate-age", metric: "accountAgeDays", comparison: "gt", requiredValue: 196, scope: "account", label: "More than 28 weeks registered" },
          { kind: "numeric", id: "mt-ultimate-download", metric: "downloadedBytes", comparison: "gt", requiredValue: 2500 * GiB, scope: "account", unitReading: "conservative", label: "More than 2500 GiB downloaded" },
          { kind: "numeric", id: "mt-ultimate-ratio", metric: "accountRatio", comparison: "gt", requiredValue: 8, scope: "account", label: "Ratio above 8" },
        ],
      },
      perks: [
        { type: "invite", label: "Send Invite" },
        { type: "custom", label: "Permanent account retention" },
        { type: "custom", label: "Spend Bonus Points" },
      ],
    },
    {
      name: "mTorrent Master",
      requirements: "Registered > 32 weeks, download > 3000 GB, ratio > 9 (demoted below 8.9)",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "mt-master-age", metric: "accountAgeDays", comparison: "gt", requiredValue: 224, scope: "account", label: "More than 32 weeks registered" },
          { kind: "numeric", id: "mt-master-download", metric: "downloadedBytes", comparison: "gt", requiredValue: 3000 * GiB, scope: "account", unitReading: "conservative", label: "More than 3000 GiB downloaded" },
          { kind: "numeric", id: "mt-master-ratio", metric: "accountRatio", comparison: "gt", requiredValue: 9, scope: "account", label: "Ratio above 9" },
        ],
      },
      perks: [
        { type: "invite", label: "Send Invite" },
        { type: "custom", label: "Permanent account retention" },
        { type: "custom", label: "Spend Bonus Points" },
      ],
    },
    { name: "VIP", requirements: "Donation", outsideLadder: "above" },
  ],
  releaseGroups: [],
  bannedGroups: [],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  rules: {
    // Ratio requirements are tiered by download volume, from 0.6 above 10 GB
    // up to 1.0 above 500 GB. The registry holds one account figure, so it
    // carries the strictest tier; the tiers themselves are rule notes.
    minimumRatio: 1.0,
    seedTimeHours: 0,
    // 40 days without a browser login deletes the account (90 days if archived).
    loginIntervalDays: 40,
    fullRulesMarkdown: [
      "## Newbie assessment",
      "",
      "- Within the first 30 days: upload > 30 GB, download > 15 GB and more than 6000 Bonus Points",
      "- Failing any one item bans the account",
      "- Spending Bonus Points during the assessment can fail it",
      "- Under 30 days old with more than 10 GB downloaded and ratio below 0.3 is an immediate ban",
      "",
      "## Account retention",
      "",
      "- No traffic (0 upload and 0 download) after 5 days: account deleted",
      "- 40 consecutive days without a browser login: account deleted (90 days if the account is archived)",
      "- Seeding and third-party tools do not count as a login",
      "- Veteran User and above are never deleted when archived; Extreme User and above are kept permanently",
      "- A banned account is cleared after 15 days (immediately if it was already inactive for 40 days)",
      "- Logging in means opening the site in a browser",
      "",
      "## Ratio",
      "",
      "- Below 0.6 with more than 10 GB downloaded",
      "- Below 0.7 with more than 50 GB downloaded",
      "- Below 0.8 with more than 100 GB downloaded",
      "- Below 0.9 with more than 200 GB downloaded",
      "- Below 1.0 with more than 500 GB downloaded",
      "- A breach starts a 5-day warning period; no improvement means a ban",
      "- Accounts under 30 days old with more than 10 GB downloaded and ratio below 0.3 are banned immediately",
      "",
      "## Classes",
      "",
      "- Power User: 4 weeks, 200 GB downloaded, ratio 2 (demoted below 1.9)",
      "- Elite User: 8 weeks, 400 GB, ratio 3 (below 2.9)",
      "- Crazy User: 12 weeks, 500 GB, ratio 4 (below 3.9)",
      "- Insane User: 16 weeks, 800 GB, ratio 5 (below 4.9)",
      "- Veteran User: 20 weeks, 1000 GB, ratio 6 (below 5.9)",
      "- Extreme User: 24 weeks, 2000 GB, ratio 7 (below 6.9)",
      "- Ultimate User: 28 weeks, 2500 GB, ratio 8 (below 7.9)",
      "- mTorrent Master: 32 weeks, 3000 GB, ratio 9 (below 8.9)",
      "- All three conditions must be met; dropping below the demotion line demotes automatically",
      "",
      "## Warnings and bans",
      "",
      "- Warnings last 1-8 weeks; a second warning during a warning period is a ban",
      "- Three accumulated warnings are a ban",
      "- Direct bans include multiple accounts, account or Bonus Point trading, cheating, stolen accounts and invite trading",
      "- Sharing torrents or passkeys, malicious throttling, mismatched subtitles and redistribution can warn or ban",
      "- Using a downloader not on the official list is a ban",
      "- Abuse, advertising, political statements and harassment can warn or ban",
      "- Invitation trading bans the whole downstream invite chain; the upstream inviter is not pursued",
      "",
      "## Registration and security",
      "",
      "- Accepted email providers: Gmail, QQ and Foxmail",
      "- Members must be 18 or older",
      "- Two-step verification is strongly recommended; an account stolen without it is banned",
      "- Keep proof of invitation; spot checks are irregular",
      "- Maximum upload speed per torrent is 1 Gbps",
      "- There is no paid unban; VIPs must follow the rules",
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
