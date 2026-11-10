// src/data/trackers/retroflix.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

const GiB = 1024 ** 3

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
  rankProgression: "automatic",
  rankRequirementsSource: {
    url: "https://retroflix.net/faq.php",
    title:
      'RetroFlix FAQ, "What are the different user classes?" and "How does this promotion thing work anyway?"',
    accessedAt: "2026-11-10",
    sourceLastModified: null,
    verification: "published",
    note:
      "Read from the site's own FAQ. The promotion table states weeks and GB; a week is 7 days and GB text with no stated basis is read as the larger binary unit. The demotion ratios printed beside each class are the floor for keeping it, not a promotion condition.",
  },
  rankUnresolved: [
    "Film Dummy is a demotion state reached through any one of five volume-dependent bands, so it is not a rung anyone is promoted to.",
    "The demotion ratios (0.95, 1.45, 1.95) only decide when a class is lost.",
  ],
  userClasses: [
    {
      name: "Film Dummy",
      requirements:
        "Demoted when any of: uploaded/downloaded over 50 GB and ratio under 0.40; over 100 GB and under 0.50; over 200 GB and under 0.60; over 400 GB and under 0.70; over 800 GB and under 0.80. 30 days to improve or be banned",
      outsideLadder: "below",
      structured: {
        mode: "any",
        conditions: [
          {
            mode: "all",
            conditions: [
              { kind: "numeric", id: "rf-dummy-50-download", metric: "downloadedBytes", comparison: "gt", requiredValue: 50 * GiB, scope: "account", unitReading: "conservative", label: "More than 50 GiB downloaded" },
              { kind: "numeric", id: "rf-dummy-50-ratio", metric: "accountRatio", comparison: "lt", requiredValue: 0.4, scope: "account", label: "Ratio under 0.40" },
            ],
          },
          {
            mode: "all",
            conditions: [
              { kind: "numeric", id: "rf-dummy-100-download", metric: "downloadedBytes", comparison: "gt", requiredValue: 100 * GiB, scope: "account", unitReading: "conservative", label: "More than 100 GiB downloaded" },
              { kind: "numeric", id: "rf-dummy-100-ratio", metric: "accountRatio", comparison: "lt", requiredValue: 0.5, scope: "account", label: "Ratio under 0.50" },
            ],
          },
          {
            mode: "all",
            conditions: [
              { kind: "numeric", id: "rf-dummy-200-download", metric: "downloadedBytes", comparison: "gt", requiredValue: 200 * GiB, scope: "account", unitReading: "conservative", label: "More than 200 GiB downloaded" },
              { kind: "numeric", id: "rf-dummy-200-ratio", metric: "accountRatio", comparison: "lt", requiredValue: 0.6, scope: "account", label: "Ratio under 0.60" },
            ],
          },
          {
            mode: "all",
            conditions: [
              { kind: "numeric", id: "rf-dummy-400-download", metric: "downloadedBytes", comparison: "gt", requiredValue: 400 * GiB, scope: "account", unitReading: "conservative", label: "More than 400 GiB downloaded" },
              { kind: "numeric", id: "rf-dummy-400-ratio", metric: "accountRatio", comparison: "lt", requiredValue: 0.7, scope: "account", label: "Ratio under 0.70" },
            ],
          },
          {
            mode: "all",
            conditions: [
              { kind: "numeric", id: "rf-dummy-800-download", metric: "downloadedBytes", comparison: "gt", requiredValue: 800 * GiB, scope: "account", unitReading: "conservative", label: "More than 800 GiB downloaded" },
              { kind: "numeric", id: "rf-dummy-800-ratio", metric: "accountRatio", comparison: "lt", requiredValue: 0.8, scope: "account", label: "Ratio under 0.80" },
            ],
          },
        ],
      },
    },
    { name: "Film Stunt", requirements: "Default class on signup" },
    {
      name: "Movie Lover",
      requirements:
        "Age ≥ 4 weeks, downloaded ≥ 50 GB, ratio ≥ 1.05 (demoted below 0.95). Top 10 and reseed requests",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "rf-lover-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 28, scope: "account", label: "At least 4 weeks registered" },
          { kind: "numeric", id: "rf-lover-download", metric: "downloadedBytes", comparison: "gte", requiredValue: 50 * GiB, scope: "account", unitReading: "conservative", label: "At least 50 GiB downloaded" },
          { kind: "numeric", id: "rf-lover-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 1.05, scope: "account", label: "Ratio at least 1.05" },
        ],
      },
    },
    {
      name: "Cinema Addicted",
      requirements:
        "Age ≥ 8 weeks, downloaded ≥ 120 GB, ratio ≥ 1.55 (demoted below 1.45). Never deleted while parked",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "rf-addicted-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 56, scope: "account", label: "At least 8 weeks registered" },
          { kind: "numeric", id: "rf-addicted-download", metric: "downloadedBytes", comparison: "gte", requiredValue: 120 * GiB, scope: "account", unitReading: "conservative", label: "At least 120 GiB downloaded" },
          { kind: "numeric", id: "rf-addicted-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 1.55, scope: "account", label: "Ratio at least 1.55" },
        ],
      },
    },
    {
      name: "Film Critic",
      requirements:
        "Age ≥ 15 weeks, downloaded ≥ 300 GB, ratio ≥ 2.05 (demoted below 1.95). Torrent structure and userbars",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "rf-critic-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 105, scope: "account", label: "At least 15 weeks registered" },
          { kind: "numeric", id: "rf-critic-download", metric: "downloadedBytes", comparison: "gte", requiredValue: 300 * GiB, scope: "account", unitReading: "conservative", label: "At least 300 GiB downloaded" },
          { kind: "numeric", id: "rf-critic-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 2.05, scope: "account", label: "Ratio at least 2.05" },
        ],
      },
    },
    { name: "VIP", requirements: "Granted by staff, or donated", outsideLadder: "above" },
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
  // Read from the public FAQ on 2026-11-10: the "Need Seed" answer gives the
  // seeding rule, and the inactivity answer gives the disable and delete days.
  rules: {
    requiredAccountRatio: 0.4,
    // The FAQ states no per-torrent ratio route: the 120 hours is the only way
    // out, so ratio is not one.
    requiredTorrentRatio: 0,
    minimumRatio: 0.4,
    seedTimeHours: 120,
    loginIntervalDays: 90,
    fulfillmentPeriodHours: 960,
    fullRulesMarkdown: [
      "## Ratio",
      "",
      "- There is no single printed ratio floor: the demotion table scales it with downloaded volume, from 0.40 above 50 GB up to 0.80 above 800 GB",
      "- \"Inf.\" means nothing was downloaded while something was uploaded, and is a real ratio",
      "",
      "## Seeding",
      "",
      "- Once a torrent is downloaded it must be seeded for 120 hours",
      "- The hours accumulate over the first 40 days after the download, they do not have to be consecutive",
      "- A freeleech torrent costs no download credit but still has to be seeded back",
      "",
      "## Account",
      "",
      "- Inactive accounts are disabled after 90 days without a login and deleted after 150 days parked",
      "- New members must stay active for their first 90 days",
      "",
      "## Classes",
      "",
      "- Promotion is automatic on account age, downloaded volume and ratio",
      "- Demotion is automatic too, at the ratio printed beside each class",
      "- Film Dummy is the demotion class: 30 days to recover or the account is banned",
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
