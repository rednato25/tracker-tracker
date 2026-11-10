// src/data/trackers/teamhd.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

const GiB = 1024 ** 3
const TiB = 1024 ** 4

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
  rankProgression: "automatic",
  rankRequirementsSource: {
    url: "https://teamhd.org/faq.php",
    title:
      'TeamHD FAQ, "Что такое разные классы пользователей?" and "А что такое мой рейтинг (ratio)?"',
    accessedAt: "2026-11-10",
    sourceLastModified: null,
    verification: "published",
    note:
      "Read from the site's own FAQ. The automatic ladder is built on account age, downloaded volume, ratio and bonus balance; ages are printed in weeks and read as 7 days each. GB/TB text without a stated basis is read as the larger binary unit. The demotion ratios printed beside each class are not promotion conditions.",
  },
  rankUnresolved: [
    "Keeper and Master keeper are granted by hand and rest on a seeding size the adapter does not collect, so they stay outside the earned ladder.",
    "UHD-Maniac also requires buying the class for 10,000,000 bonus points, so the thresholds alone do not assign it.",
    "The demotion ratios (0.95, 1.95, 2.95, 4.95, 6.95) are the floor for keeping a class, not a promotion condition.",
  ],
  userClasses: [
    { name: "Забанен", requirements: "Banned, off the ladder permanently", outsideLadder: "below" },
    {
      name: "Личер",
      requirements:
        "Demoted below 720p when at least 50 GB is downloaded, the ratio is under 0.25 and the account is 30 days old. Four weeks at ratio above 0.30 returns it to 720p",
      outsideLadder: "below",
    },
    {
      name: "720p",
      requirements: "Default class on signup. 3 torrents at once, 10 downloads a day",
    },
    {
      name: "1080i",
      requirements:
        "Age ≥ 5 weeks, downloaded > 200 GB, ratio ≥ 1.05 (demoted below 0.95). 5 torrents at once, 20 downloads a day",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "thd-1080i-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 35, scope: "account", label: "At least 5 weeks registered" },
          { kind: "numeric", id: "thd-1080i-download", metric: "downloadedBytes", comparison: "gt", requiredValue: 200 * GiB, scope: "account", unitReading: "conservative", label: "More than 200 GiB downloaded" },
          { kind: "numeric", id: "thd-1080i-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 1.05, scope: "account", label: "Ratio at least 1.05" },
        ],
      },
    },
    {
      name: "1080p",
      requirements:
        "Age ≥ 15 weeks, downloaded > 1000 GB, ratio ≥ 2.05 (demoted below 1.95). 15 torrents at once, 30 downloads a day, requests",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "thd-1080p-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 105, scope: "account", label: "At least 15 weeks registered" },
          { kind: "numeric", id: "thd-1080p-download", metric: "downloadedBytes", comparison: "gt", requiredValue: 1000 * GiB, scope: "account", unitReading: "conservative", label: "More than 1000 GiB downloaded" },
          { kind: "numeric", id: "thd-1080p-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 2.05, scope: "account", label: "Ratio at least 2.05" },
        ],
      },
    },
    {
      name: "2160p",
      requirements:
        "Age ≥ 25 weeks, downloaded > 5 TB, ratio ≥ 3.05, bonus ≥ 250,000 (demoted below 2.95). 20 torrents at once, 100 downloads a day, immune to inactivity pruning",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "thd-2160p-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 175, scope: "account", label: "At least 25 weeks registered" },
          { kind: "numeric", id: "thd-2160p-download", metric: "downloadedBytes", comparison: "gt", requiredValue: 5 * TiB, scope: "account", unitReading: "conservative", label: "More than 5 TiB downloaded" },
          { kind: "numeric", id: "thd-2160p-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 3.05, scope: "account", label: "Ratio at least 3.05" },
          { kind: "numeric", id: "thd-2160p-bonus", metric: "seedbonus", comparison: "gte", requiredValue: 250_000, scope: "account", label: "At least 250,000 bonus points" },
        ],
      },
    },
    {
      name: "4320p",
      requirements:
        "Age ≥ 35 weeks, downloaded > 10 TB, ratio ≥ 5.05, bonus ≥ 1,000,000 (demoted below 4.95). 30 torrents at once, 200 downloads a day, immune to inactivity pruning",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "thd-4320p-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 245, scope: "account", label: "At least 35 weeks registered" },
          { kind: "numeric", id: "thd-4320p-download", metric: "downloadedBytes", comparison: "gt", requiredValue: 10 * TiB, scope: "account", unitReading: "conservative", label: "More than 10 TiB downloaded" },
          { kind: "numeric", id: "thd-4320p-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 5.05, scope: "account", label: "Ratio at least 5.05" },
          { kind: "numeric", id: "thd-4320p-bonus", metric: "seedbonus", comparison: "gte", requiredValue: 1_000_000, scope: "account", label: "At least 1,000,000 bonus points" },
        ],
      },
    },
    {
      name: "UHD-Maniac",
      requirements:
        "Age ≥ 55 weeks, downloaded > 20 TB, ratio ≥ 7.05, bonus ≥ 50,000,000, and the class is bought for 10,000,000 bonus points (demoted below 6.95). 100 torrents at once, unlimited invites",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "thd-uhd-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 385, scope: "account", label: "At least 55 weeks registered" },
          { kind: "numeric", id: "thd-uhd-download", metric: "downloadedBytes", comparison: "gt", requiredValue: 20 * TiB, scope: "account", unitReading: "conservative", label: "More than 20 TiB downloaded" },
          { kind: "numeric", id: "thd-uhd-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 7.05, scope: "account", label: "Ratio at least 7.05" },
          { kind: "numeric", id: "thd-uhd-bonus", metric: "seedbonus", comparison: "gte", requiredValue: 50_000_000, scope: "account", label: "At least 50,000,000 bonus points" },
        ],
      },
    },
    {
      name: "Хранитель",
      requirements:
        "Granted by hand: more than 25 TB seeding for over a month. H&R immune",
      outsideLadder: "above",
    },
    {
      name: "Мастер Хранитель",
      requirements:
        "Granted by hand: more than 50 TB seeding with an average seed time over three months. Freeleech",
      outsideLadder: "above",
    },
    {
      name: "VIP",
      requirements: "Donation or other support. H&R immune and freeleech while it lasts",
      outsideLadder: "above",
    },
    { name: "Релизер-стажер", requirements: "Temporary upload rights, granted by staff", outsideLadder: "above" },
    { name: "Ветеран", requirements: "Granted by staff for long service. Upload rights", outsideLadder: "above" },
    { name: "Аплоадер", requirements: "Granted by staff. Upload rights", outsideLadder: "above" },
    { name: "Модератор", requirements: "Granted by staff", outsideLadder: "above" },
    { name: "Основатель, Администратор", requirements: "Site administration", outsideLadder: "above" },
  ],
  releaseGroups: [],
  bannedGroups: [],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  // Read from the public FAQ on 2026-11-10. The rules page, which the FAQ
  // defers to for Hit & Run, is behind the login.
  rules: {
    requiredAccountRatio: 0.3,
    requiredTorrentRatio: 1.0,
    minimumRatio: 0.3,
    seedTimeHours: 72,
    loginIntervalDays: 90,
    satisfactionMode: "any",
    fullRulesMarkdown: [
      "## Ratio",
      "",
      "- Keep the ratio from falling below 0.30 for long, or the account can be banned permanently",
      '- "Inf." means nothing was downloaded while something was uploaded; it is a real ratio, not missing data',
      "",
      "## Seeding and Hit & Run",
      "",
      "- The FAQ describes a torrent as satisfied once it has been seeded for 72 hours or has reached a local ratio above 1",
      "- The Hit & Run module is currently disabled on the site, so those conditions are not enforced right now",
      "- Gold releases count only the upload, silver releases count half of the download",
      "",
      "## Account",
      "",
      "- Inactive accounts are pruned; members are expected to log in and stay active",
      "- Several sessions from different IPs are allowed, but seeding one torrent from two IPs is not",
      "",
      "## Classes",
      "",
      "- Promotion is automatic on account age, downloaded volume, ratio and bonus balance",
      "- Demotion runs separately, at the ratio printed beside each class",
      "- Keeper, Master keeper, VIP, uploader and staff classes are granted by hand or bought",
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
