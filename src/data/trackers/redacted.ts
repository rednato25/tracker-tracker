// src/data/trackers/redacted.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

const GiB = 1024 ** 3

export const redacted: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "redacted",
  name: "REDacted",
  abbreviation: "RED",
  url: "https://redacted.sh",
  description:
    "The largest general music tracker (also has some software). Has an interview to join, although the wait can be notoriously long.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "gazelle",
  // RED expects a bare `Authorization: <key>` with no `token ` prefix.
  // Sending the prefix returns 401.
  gazelleAuthStyle: "raw",
  gazelleEnrich: true,
  apiPath: "/ajax.php",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "Music",
  contentCategories: ["Music", "Apps"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#f44336",
  logo: "/tracker-logos/redacted_logo.png",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "redacted",
  statusPageUrl: "https://red.trackerstatus.info/",

  // ── Community ───────────────────────────────────────────────────────
  // wiki.php?action=article&name=classes (r27). Counts are torrents uploaded,
  // not seeding, and every earned class demotes to User below ratio 0.60.
  // Secondary classes (FLS, Interviewer, TC, PT) are not primary classes and
  // never come back as `class` from the API.
  rankProgression: "mixed",
  rankRequirementsSource: {
    url: null,
    title: "Existing registry free text; official wiki requires a login",
    accessedAt: null,
    sourceLastModified: null,
    verification: "unresolved",
    note:
      "The official wiki is login-gated. Only the clear numeric thresholds already present in the registry text are structured; the source itself is not independently verified here.",
  },
  rankUnresolved: [
    "Need official excerpts for branch/manual classes and demotion thresholds.",
    "GB/TB text without a stated unit basis is read as the larger binary GiB/TiB value.",
    "Power TM and Elite TM remain text-only because their unique-group/perfect-FLAC conditions are not supported metrics.",
  ],
  userClasses: [
    { name: "User", requirements: "Default class on registration" },
    {
      name: "Member",
      requirements: "1 week, 10 GB up, ratio above 0.65. 25 Merit Tokens on first promotion",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "red-member-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 7, scope: "account", label: "At least 1 week registered" },
          { kind: "numeric", id: "red-member-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 10 * GiB, scope: "account", unitReading: "conservative", label: "At least 10 GiB uploaded" },
          { kind: "numeric", id: "red-member-ratio", metric: "accountRatio", comparison: "gt", requiredValue: 0.65, scope: "account", label: "Ratio above 0.65" },
        ],
      },
    },
    {
      name: "Power User",
      requirements: "2 weeks, 5 uploads, 25 GB up, ratio above 0.65. Invites, personal collage",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "red-power-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 14, scope: "account", label: "At least 2 weeks registered" },
          { kind: "numeric", id: "red-power-uploads", metric: "uploads", comparison: "gte", requiredValue: 5, scope: "account", label: "At least 5 uploads" },
          { kind: "numeric", id: "red-power-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 25 * GiB, scope: "account", unitReading: "conservative", label: "At least 25 GiB uploaded" },
          { kind: "numeric", id: "red-power-ratio", metric: "accountRatio", comparison: "gt", requiredValue: 0.65, scope: "account", label: "Ratio above 0.65" },
        ],
      },
    },
    {
      name: "Elite",
      requirements: "4 weeks, 50 uploads, 100 GB up, ratio above 0.65. Torrent editing",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "red-elite-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 28, scope: "account", label: "At least 4 weeks registered" },
          { kind: "numeric", id: "red-elite-uploads", metric: "uploads", comparison: "gte", requiredValue: 50, scope: "account", label: "At least 50 uploads" },
          { kind: "numeric", id: "red-elite-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 100 * GiB, scope: "account", unitReading: "conservative", label: "At least 100 GiB uploaded" },
          { kind: "numeric", id: "red-elite-ratio", metric: "accountRatio", comparison: "gt", requiredValue: 0.65, scope: "account", label: "Ratio above 0.65" },
        ],
      },
    },
    {
      name: "Torrent Master",
      requirements:
        "8 weeks, 500 uploads, 500 GB up, ratio above 0.65. Custom title, unlimited invites",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "red-master-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 56, scope: "account", label: "At least 8 weeks registered" },
          { kind: "numeric", id: "red-master-uploads", metric: "uploads", comparison: "gte", requiredValue: 500, scope: "account", label: "At least 500 uploads" },
          { kind: "numeric", id: "red-master-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 500 * GiB, scope: "account", unitReading: "conservative", label: "At least 500 GiB uploaded" },
          { kind: "numeric", id: "red-master-ratio", metric: "accountRatio", comparison: "gt", requiredValue: 0.65, scope: "account", label: "Ratio above 0.65" },
        ],
      },
    },
    {
      name: "Power TM",
      requirements: "8 weeks, 500 GB up, ratio above 0.65, uploads in 500 unique groups",
    },
    {
      name: "Elite TM",
      requirements:
        "8 weeks, 500 GB up, ratio above 0.65, 500 perfect FLAC uploads, Power TM criteria",
    },
    {
      name: "VIP",
      requirements: "Staff-granted. VIP forum, custom title, unlimited invites",
      outsideLadder: "above",
    },
    { name: "Legend", requirements: "Former staff", outsideLadder: "above" },
    { name: "Forum Moderator", requirements: "Staff", outsideLadder: "above" },
    { name: "Moderator", requirements: "Staff", outsideLadder: "above" },
    { name: "Senior Moderator", requirements: "Staff", outsideLadder: "above" },
    { name: "Developer", requirements: "Staff", outsideLadder: "above" },
    { name: "Administrator", requirements: "Staff", outsideLadder: "above" },
    { name: "Sysop", requirements: "Staff", outsideLadder: "above" },
  ],
  releaseGroups: [],
  bannedGroups: [],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  rules: {
    minimumRatio: 0.6,
    seedTimeHours: 72,
    loginIntervalDays: 120,
    fullRulesMarkdown: [
      "## Ratio Requirements",
      "",
      "| Amount Downloaded | Required Ratio |",
      "|---|---|",
      "| 0-5 GB | 0.00 |",
      "| 5-10 GB | 0.15 |",
      "| 10-20 GB | 0.20 |",
      "| 20-30 GB | 0.30 |",
      "| 30-40 GB | 0.35 |",
      "| 40-50 GB | 0.40 |",
      "| 50-60 GB | 0.45 |",
      "| 60-80 GB | 0.50 |",
      "| 80-100 GB | 0.60 |",
      "| 100+ GB | 0.60 |",
      "",
      "## Seeding Rules",
      "",
      "- Torrents must be seeded for **72 hours** after snatching.",
      "- You may be put on ratio watch if your ratio drops below the required level for your download amount.",
      "- Ratio watch lasts **2 weeks**. If you don't improve your ratio within that time, your leeching privileges will be suspended.",
      "",
      "## Account Activity",
      "",
      "- Accounts inactive for **120 days** (no login) will be disabled.",
      "- Disabled accounts can be re-enabled by logging into the site (if within the pruning window) or by contacting staff via IRC.",
      "",
      "## FL Tokens",
      "",
      "- Freeleech tokens let you download a torrent without it counting against your download stats.",
      "- Tokens can be earned through various means including uploads, bounties, and bonus points.",
      "",
      "## Merit Tokens",
      "",
      "- Merit tokens can be used to highlight or recommend releases.",
      "- Earned through community contributions.",
    ],
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: false,
  warningNote: "",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: true,
  profileUrlPattern: "/user.php?id={id}",
}
