// src/components/tracker-detail/UserProfileCard.tsx

import { RankTooltip } from "@/components/tracker-detail/RankTooltip"
import { TrackerAvatar } from "@/components/tracker-detail/TrackerAvatar"
import { Badge } from "@/components/ui/Badge"
import { UserIcon } from "@/components/ui/Icons"
import { RedactedText } from "@/components/ui/RedactedText"
import type { TrackerRegistryEntry } from "@/data/tracker-registry"
import { hexToRgba } from "@/lib/color-utils"
import { formatAccountAge, formatJoinedDate } from "@/lib/formatters"
import { isRedacted } from "@/lib/privacy"
import type { TrackerLatestStats, TrackerSummary } from "@/types/api"

interface UserProfileCardProps {
  tracker: TrackerSummary
  stats: TrackerLatestStats
  registryEntry: TrackerRegistryEntry | undefined
  accentColor: string
}

export function UserProfileCard({
  tracker,
  stats,
  registryEntry,
  accentColor: tc,
}: UserProfileCardProps) {
  if (!stats.username && !stats.group) return null

  const accountAge = formatAccountAge(tracker.joinedAt)
  const joinedDate = formatJoinedDate(tracker.joinedAt)

  return (
    <div className="w-full border border-border bg-raised p-4 sm:w-fit sm:min-w-[24rem]">
      <div className="flex items-center gap-6">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden border border-border bg-elevated">
          {tracker.remoteUserId ? (
            <TrackerAvatar trackerId={tracker.id} accentColor={tc} />
          ) : (
            <UserIcon width="24" height="24" stroke={tc} />
          )}
        </div>
        <div className="flex flex-col gap-2">
          {stats.username && (
            <RedactedText
              value={stats.username}
              color={tc}
              className="text-lg font-mono text-primary font-semibold"
            />
          )}
          <div className="flex items-center gap-3 flex-wrap">
            {stats.group && registryEntry?.userClasses && !isRedacted(stats.group) ? (
              <RankTooltip
                currentRank={stats.group}
                userClasses={registryEntry.userClasses}
                rankPaths={registryEntry.rankPaths}
                accentColor={tc}
              />
            ) : stats.group ? (
              <Badge style={{ backgroundColor: hexToRgba(tc, 0.15), color: tc }}>
                <RedactedText value={stats.group} color={tc} />
              </Badge>
            ) : null}
          </div>
          {(joinedDate || accountAge) && (
            <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5">
              {joinedDate && (
                <span className="whitespace-nowrap text-xs font-mono text-secondary">Joined {joinedDate}</span>
              )}
              {joinedDate && accountAge && (
                <span className="text-xs font-mono text-tertiary">·</span>
              )}
              {accountAge && (
                <span className="whitespace-nowrap text-xs font-mono text-secondary">{accountAge}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
