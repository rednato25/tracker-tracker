// src/app/(auth)/wishlist/page.tsx

import { WishlistClient } from "@/components/recruitment/WishlistClient"
import { db } from "@/lib/db"
import { appSettings } from "@/lib/db/schema"
import {
  normalizeRecruitmentState,
  parseSavedRankGoals,
} from "@/lib/recruitment-state"
import { getTrackerListForDashboard } from "@/lib/server-data"

export const dynamic = "force-dynamic"

export default async function WishlistPage() {
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
