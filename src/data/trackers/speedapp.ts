// src/data/trackers/speedapp.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

const GiB = 1024 ** 3
const TiB = 1024 ** 4

export const speedapp: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "speedapp",
  name: "SpeedApp",
  abbreviation: "SP",
  url: "https://speedapp.io",
  description: "Romanian private general tracker covering movies, TV, music, games and books.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "apime",
  apiPath: "/api/me",
  // The site's own client sends the token as a Bearer credential, and its
  // 401 advertises `WWW-Authenticate: Bearer`.
  apimeAuthStyle: "bearer",
  apimeClassMap: {
    "0": "Peasant",
    "1": "User",
    "2": "Power User",
    "3": "Elite User",
    "4": "Xtreme User",
    "5": "Super User",
    "6": "Legend User",
    "7": "VIP",
    "8": "Legend VIP",
    "9": "Hyperseeder",
    "10": "Hall of Fame",
    "11": "Helper",
    "12": "Junior Uploader",
    "13": "Uploader",
    "14": "Elite Uploader",
    "15": "Encoder",
    "16": "Junior Moderator",
    "17": "Moderator",
    "18": "Administrator",
    "19": "Supervisor",
    "20": "Owner",
    "21": "Coder",
  },

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "General / RO",
  contentCategories: ["Movies", "TV", "Music", "Games", "Books"],
  language: "Romanian",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#f7c60a",
  logo: "/tracker-logos/speedapp_logo.png",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "",
  statusPageUrl: "",

  // ── Community ───────────────────────────────────────────────────────
  rankProgression: "automatic",
  rankRequirementsSource: {
    url: "https://speedapp.io/wiki/en/classes",
    title: "SpeedApp wiki, Classes and promotion",
    accessedAt: "2026-11-11",
    sourceLastModified: null,
    verification: "published",
    note:
      "Read off the wiki's Classes and promotion page by the owner on 2026-11-11 while logged in. A class needs all three of account age, upload and ratio; the site promotes and demotes every hour, and each class is kept while the ratio stays above its keep ratio.",
  },
  rankUnresolved: [
    "GB and TB on the wiki are read as GiB and TiB, the larger values, so progress is never overstated.",
    "Each class's keep ratio is in its requirement text; the dashboard tracks the promotion thresholds.",
  ],
  userClasses: [
    {
      name: "Peasant",
      requirements: "Starting class for every new account, and where an account drops below the User keep ratio of 0.95",
    },
    {
      name: "User",
      requirements: "Age ≥ 28 days, uploaded ≥ 25 GB, ratio ≥ 1.05. Kept above 0.95",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "sp-user-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 28, scope: "account", label: "At least 28 days registered" },
          { kind: "numeric", id: "sp-user-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 25 * GiB, scope: "account", unitReading: "conservative", label: "At least 25 GiB uploaded" },
          { kind: "numeric", id: "sp-user-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 1.05, scope: "account", label: "Ratio at least 1.05" },
        ],
      },
    },
    {
      name: "Power User",
      requirements: "Age ≥ 90 days, uploaded ≥ 200 GB, ratio ≥ 2.0. Kept above 1.75",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "sp-power-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 90, scope: "account", label: "At least 90 days registered" },
          { kind: "numeric", id: "sp-power-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 200 * GiB, scope: "account", unitReading: "conservative", label: "At least 200 GiB uploaded" },
          { kind: "numeric", id: "sp-power-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 2.0, scope: "account", label: "Ratio at least 2.0" },
        ],
      },
    },
    {
      name: "Elite User",
      requirements: "Age ≥ 180 days, uploaded ≥ 1 TB, ratio ≥ 3.0. Kept above 2.75",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "sp-elite-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 180, scope: "account", label: "At least 180 days registered" },
          { kind: "numeric", id: "sp-elite-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 1 * TiB, scope: "account", unitReading: "conservative", label: "At least 1 TiB uploaded" },
          { kind: "numeric", id: "sp-elite-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 3.0, scope: "account", label: "Ratio at least 3.0" },
        ],
      },
    },
    {
      name: "Xtreme User",
      requirements: "Age ≥ 360 days, uploaded ≥ 5 TB, ratio ≥ 4.0. Kept above 3.75",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "sp-xtreme-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 360, scope: "account", label: "At least 360 days registered" },
          { kind: "numeric", id: "sp-xtreme-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 5 * TiB, scope: "account", unitReading: "conservative", label: "At least 5 TiB uploaded" },
          { kind: "numeric", id: "sp-xtreme-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 4.0, scope: "account", label: "Ratio at least 4.0" },
        ],
      },
    },
    {
      name: "Super User",
      requirements: "Age ≥ 720 days, uploaded ≥ 20 TB, ratio ≥ 5.0. Kept above 4.75",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "sp-super-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 720, scope: "account", label: "At least 720 days registered" },
          { kind: "numeric", id: "sp-super-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 20 * TiB, scope: "account", unitReading: "conservative", label: "At least 20 TiB uploaded" },
          { kind: "numeric", id: "sp-super-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 5.0, scope: "account", label: "Ratio at least 5.0" },
        ],
      },
    },
    {
      name: "Legend User",
      requirements: "Age ≥ 2160 days, uploaded ≥ 100 TB, ratio ≥ 6.0. Kept above 5.75",
      structured: {
        mode: "all",
        conditions: [
          { kind: "numeric", id: "sp-legend-age", metric: "accountAgeDays", comparison: "gte", requiredValue: 2160, scope: "account", label: "At least 2160 days registered" },
          { kind: "numeric", id: "sp-legend-upload", metric: "uploadedBytes", comparison: "gte", requiredValue: 100 * TiB, scope: "account", unitReading: "conservative", label: "At least 100 TiB uploaded" },
          { kind: "numeric", id: "sp-legend-ratio", metric: "accountRatio", comparison: "gte", requiredValue: 6.0, scope: "account", label: "Ratio at least 6.0" },
        ],
      },
    },
    { name: "Star", requirements: "Donation package", outsideLadder: "above" },
    { name: "VIP", requirements: "Granted by staff, or bought with bonus points", outsideLadder: "above" },
    { name: "Legend VIP", requirements: "For donors, or VIP time bought with bonus points", outsideLadder: "above" },
    {
      name: "Hyperseeder",
      requirements: "The ten members who seed the most by size, steadily over the last three days, from Elite User up",
      outsideLadder: "above",
    },
    { name: "Hall of Fame", requirements: "Granted by staff", outsideLadder: "above" },
    { name: "Helper", requirements: "Granted by moderators", outsideLadder: "above" },
    { name: "Junior Uploader", requirements: "Appointed by staff", outsideLadder: "above" },
    { name: "Uploader", requirements: "Appointed by staff", outsideLadder: "above" },
    { name: "Elite Uploader", requirements: "Appointed by staff", outsideLadder: "above" },
    { name: "Encoder", requirements: "Appointed by staff", outsideLadder: "above" },
    { name: "Junior Moderator", requirements: "Staff", outsideLadder: "above" },
    { name: "Moderator", requirements: "Staff", outsideLadder: "above" },
    { name: "Administrator", requirements: "Staff", outsideLadder: "above" },
    { name: "Supervisor", requirements: "Senior staff", outsideLadder: "above" },
    { name: "Owner", requirements: "SysOp", outsideLadder: "above" },
    { name: "Coder", requirements: "Developer", outsideLadder: "above" },
  ],
  releaseGroups: [],
  bannedGroups: [],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  // Read from the public FAQ on 2026-11-10: the seeding answer gives the 30
  // minute head start, the 48 hours within 30 days and the 1:1 alternative, and
  // the hit & run answer gives the 50 that stops downloads.
  rules: {
    requiredAccountRatio: 0.95,
    requiredTorrentRatio: 1.0,
    minimumRatio: 0.95,
    seedTimeHours: 48,
    loginIntervalDays: 0,
    satisfactionMode: "any",
    fulfillmentPeriodHours: 720,
    hnrBanLimit: 50,
    fullRulesMarkdown: [
      "## Seeding and Hit & Runs",
      "",
      "- Keep a finished download running for the first 30 minutes",
      "- Then seed until the torrent has 48 hours of seed time within 30 days, or until the torrent has uploaded as much as it downloaded",
      "- The hours add up; they do not have to be consecutive",
      "- A torrent whose seeding rule is still unmet 30 days after it finished is a hit & run",
      "- Clear one by seeding it to 48 hours, by buying it off with bonus points, or by being a VIP",
      "- At 50 hit & runs new downloads are blocked; fewer already limit invites, messages and seedboxes",
      "- The site checks hit & runs every six hours",
      "",
      "## Ratio and freeleech",
      "",
      "- Ratio is uploaded divided by downloaded, over the whole account and per torrent",
      "- A freeleech torrent costs no download credit while your upload still counts",
      "",
      "## Classes",
      "",
      "- Classes grow with account age, uploaded volume and ratio, and the site moves members up or down on its own every hour",
      "- Invites, requests and uploader applications open at Power User",
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
