// src/app/(auth)/page.tsx

import { db } from "@/lib/db"
import { appSettings } from "@/lib/db/schema"
import { parseRankManualValuesFromSettings } from "@/lib/rank-manual-values"
import { normalizeRecruitmentState } from "@/lib/recruitment-state"
import {
  fetchSettings,
  getTagGroupsWithMembers,
  getTrackerListForDashboard,
} from "@/lib/server-data"
import { DashboardClient } from "./DashboardClient"

export default async function DashboardPage() {
  // Tag groups are opt-in via Settings and reading them is two small queries, so the server
  // can cheaply tell the client whether the Tag Groups section applies at all. The counts
  // themselves come from the cached fleet aggregation, fetched on the client. Computing
  // them here would put the whole fleet pass in front of this page's TTFB, and would freeze
  // the counts until a full reload.
  const [trackers, settingsResult, tagGroups, recruitmentRows] = await Promise.all([
    getTrackerListForDashboard(),
    fetchSettings().catch(() => []),
    getTagGroupsWithMembers().catch(() => []),
    db
      .select({ recruitmentState: appSettings.recruitmentState })
      .from(appSettings)
      .limit(1),
  ])
  const [settings] = settingsResult
  const rankChecks = normalizeRecruitmentState(
    recruitmentRows[0]?.recruitmentState ?? null
  ).rankChecks

  return (
    <DashboardClient
      initialTrackers={trackers}
      snapshotRetentionDays={settings?.snapshotRetentionDays ?? null}
      rankGoals={settings?.rankGoals ?? null}
      initialRankManualValues={parseRankManualValuesFromSettings(
        settings?.dashboardSettings ?? null
      )}
      initialRankChecks={rankChecks}
      hasTagGroups={tagGroups.length > 0}
      now={new Date().toISOString()}
    />
  )
}
