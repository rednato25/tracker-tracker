// src/app/(auth)/pathways/page.tsx

import type { Metadata } from "next"
import { WishlistClient } from "@/components/recruitment/WishlistClient"
import { db } from "@/lib/db"
import { appSettings } from "@/lib/db/schema"
import {
  normalizeRecruitmentState,
  parseSavedRankGoals,
} from "@/lib/recruitment-state"
import { getTrackerListForDashboard } from "@/lib/server-data"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Tracker pathways",
}

export default async function PathwaysPage() {
  const [trackers, settingsRows] = await Promise.all([
    getTrackerListForDashboard(),
    db
      .select({
        recruitmentState: appSettings.recruitmentState,
        rankGoals: appSettings.rankGoals,
      })
      .from(appSettings)
      .limit(1),
  ])
  const settings = settingsRows[0]

  return (
    <WishlistClient
      trackers={trackers}
      initialState={normalizeRecruitmentState(settings?.recruitmentState ?? null)}
      savedRankGoals={parseSavedRankGoals(settings?.rankGoals ?? null)}
    />
  )
}
