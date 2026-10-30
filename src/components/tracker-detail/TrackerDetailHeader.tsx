// src/components/tracker-detail/TrackerDetailHeader.tsx
//
// Functions: TrackerDetailHeader

import { H1 } from "@typography"
import clsx from "clsx"
import Image from "next/image"
import { useRef, useState } from "react"
import { TrackerHubStatus } from "@/components/TrackerHubStatus"
import { MamMouseholeCard } from "@/components/tracker-detail/platform/MamMouseholeCard"
import { SlotRenderer } from "@/components/tracker-detail/SlotRenderer"
import { UserProfileCard } from "@/components/tracker-detail/UserProfileCard"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Dialog } from "@/components/ui/Dialog"
import {
  BugIcon,
  CheckIcon,
  ChevronDownSmallIcon,
  ExternalLinkSmallIcon,
  GearIcon,
  PauseIcon,
  PlayIcon,
  ShieldIcon,
} from "@/components/ui/Icons"
import { PulseDot } from "@/components/ui/PulseDot"
import { Tooltip } from "@/components/ui/Tooltip"
import { platformTypeLabel } from "@/data/platform-types"
import type { TrackerRegistryEntry } from "@/data/tracker-registry"
import type { RankGoalSummary } from "@/lib/rank-summary"
import {
  getHealthBadgeVariant,
  getHealthDescription,
  getHealthLabel,
  getHealthPulseDot,
  getTrackerHealth,
} from "@/lib/tracker-status"
import type { TrackerLatestStats, TrackerSummary } from "@/types/api"
import type { ResolvedSlot } from "@/types/slots"

interface TrackerDetailHeaderProps {
  tracker: TrackerSummary
  stats: TrackerLatestStats | null
  registryEntry: TrackerRegistryEntry | undefined
  accentColor: string
  polling: boolean
  onPollNow: () => void
  onOpenSettings: () => void
  /** Opens the credential vault sheet. Always available, the sheet itself
   *  renders the opt-in explanation when the feature is disabled, so hiding the
   *  button would leave a disabled user with no route to turning it on. */
  onOpenCredentials: () => void
  onDebugPoll: () => void
  debugLoading: boolean
  badgeSlots: ResolvedSlot[]
  onTogglePause: () => void
  pauseLoading: boolean
  onMarkLoginToday: () => void
  markLoginLoading: boolean
  settingsSaves: number
  rankSummary?: RankGoalSummary | null
}

function RankTargetSummary({
  summary,
  currentRank,
}: {
  summary?: RankGoalSummary | null
  currentRank: string | null
}) {
  const target = summary?.targetRank ?? summary?.automaticNextRank ?? null
  const distance = summary?.distanceText
  const prefix = target ? `${target}: ` : null
  const remaining =
    distance && prefix && distance.startsWith(prefix) ? distance.slice(prefix.length) : distance
  const current = summary?.currentRankHidden
    ? "Hidden"
    : (summary?.currentRank ?? currentRank ?? "Unknown")

  return (
    <section
      data-rank-target-summary
      aria-label="Rank target summary"
      className="grid grid-cols-3 gap-2 border-t border-border pt-4"
    >
      <div className="min-w-0">
        <span className="font-cond text-2xs font-semibold uppercase tracking-[0.1em] text-tertiary">
          Current
        </span>
        <p className="mt-0.5 break-words font-mono text-xs text-primary">{current}</p>
      </div>
      <div className="min-w-0">
        <span className="font-cond text-2xs font-semibold uppercase tracking-[0.1em] text-tertiary">
          Target
        </span>
        <p className="mt-0.5 break-words font-mono text-xs text-primary">{target ?? "No target"}</p>
      </div>
      <div className="min-w-0">
        <span className="font-cond text-2xs font-semibold uppercase tracking-[0.1em] text-tertiary">
          Distance
        </span>
        <p className="mt-0.5 break-words font-mono text-xs text-secondary">
          {remaining ?? summary?.nextRankRequirements ?? "Choose a target below"}
        </p>
      </div>
    </section>
  )
}

export function TrackerDetailHeader({
  tracker,
  stats,
  registryEntry,
  accentColor: tc,
  polling,
  onPollNow,
  onOpenSettings,
  onOpenCredentials,
  onDebugPoll,
  debugLoading,
  badgeSlots,
  onTogglePause,
  pauseLoading,
  onMarkLoginToday,
  markLoginLoading,
  settingsSaves,
  rankSummary,
}: TrackerDetailHeaderProps) {
  const health = getTrackerHealth(tracker)
  const menuRef = useRef<HTMLDetailsElement>(null)
  const [confirmLoginOpen, setConfirmLoginOpen] = useState(false)
  const loginDate = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date())

  return (
    <div
      className="flex flex-col gap-5 border border-border border-t-2 bg-raised p-4 md:p-5"
      style={{ borderTopColor: tc }}
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex flex-col gap-3">
          {/* Title row */}
          <div className="flex flex-wrap items-center gap-3">
            {registryEntry?.logo && (
              <Image
                src={registryEntry.logo}
                alt=""
                width={24}
                height={24}
                className="shrink-0 object-contain rounded-nm-sm max-h-6"
                aria-hidden="true"
              />
            )}
            <H1>{tracker.name}</H1>
            <span className="flex items-center gap-2">
              <PulseDot status={getHealthPulseDot(health)} size="md" />
              <span
                className="font-cond text-2xs font-semibold uppercase tracking-[0.1em] text-secondary"
                data-health-label
              >
                {getHealthLabel(health)}
              </span>
            </span>
            <Tooltip content={`Open ${tracker.name}`}>
              <a
                href={tracker.baseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-6 w-6 shrink-0 items-center justify-center text-muted transition-colors duration-150 hover:text-accent"
                aria-label={`Open ${tracker.name}`}
              >
                <ExternalLinkSmallIcon width="16" height="16" />
              </a>
            </Tooltip>
          </div>

          {/* Meta badges */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={getHealthBadgeVariant(health)}>
              {getHealthDescription(health, tracker)}
            </Badge>
            <Badge variant="default">{platformTypeLabel(tracker.platformType)}</Badge>
            {registryEntry?.language && <Badge variant="default">{registryEntry.language}</Badge>}
            {!tracker.isActive && <Badge variant="warn">Archived</Badge>}
            <SlotRenderer slots={badgeSlots} bare />
          </div>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 justify-start sm:w-auto sm:shrink-0">
          <Button
            variant="secondary"
            size="sm"
            onClick={onPollNow}
            disabled={polling}
            className="h-11 px-3"
            text={polling ? "Polling..." : "Poll now"}
          />
          <Button
            variant={tracker.userPausedAt ? "secondary" : "ghost"}
            size="sm"
            onClick={onTogglePause}
            disabled={pauseLoading || polling}
            aria-pressed={!!tracker.userPausedAt}
            className={clsx("h-11 px-3", tracker.userPausedAt && "border-warn text-warn")}
          >
            {tracker.userPausedAt ? <PlayIcon width="16" height="16" /> : <PauseIcon width="16" height="16" />}
            <span>{tracker.userPausedAt ? "Resume" : "Pause"}</span>
          </Button>
          <details ref={menuRef} className="relative">
            <summary className="flex h-11 cursor-pointer list-none items-center gap-1.5 border border-border bg-control-bg px-3 font-cond text-xs font-semibold uppercase tracking-[0.1em] text-secondary transition-colors duration-150 hover:text-primary [&::-webkit-details-marker]:hidden">
              More actions
              <ChevronDownSmallIcon width="10" height="7" />
            </summary>
            <div className="absolute top-full left-0 z-50 mt-1 w-56 max-w-[calc(100vw-2rem)] border border-border bg-overlay p-1 shadow-[0_12px_32px_rgb(0_0_0_/_0.18)] md:right-0 md:left-auto">
              <button
                type="button"
                disabled={debugLoading || polling}
                onClick={() => {
                  menuRef.current?.removeAttribute("open")
                  onDebugPoll()
                }}
                className="flex w-full items-center gap-2 px-2 py-2 text-left text-xs text-secondary hover:bg-elevated hover:text-primary disabled:opacity-50"
              >
                <BugIcon width="14" height="14" /> Debug poll
              </button>
              <button
                type="button"
                disabled={markLoginLoading || polling}
                onClick={() => {
                  menuRef.current?.removeAttribute("open")
                  setConfirmLoginOpen(true)
                }}
                className="flex w-full items-center gap-2 px-2 py-2 text-left text-xs text-secondary hover:bg-elevated hover:text-primary disabled:opacity-50"
              >
                <CheckIcon width="14" height="14" /> Mark login today
              </button>
              <button
                type="button"
                onClick={() => {
                  menuRef.current?.removeAttribute("open")
                  onOpenCredentials()
                }}
                className="flex w-full items-center gap-2 px-2 py-2 text-left text-xs text-secondary hover:bg-elevated hover:text-primary"
              >
                <ShieldIcon width="14" height="14" /> Credentials
              </button>
              <button
                type="button"
                onClick={() => {
                  menuRef.current?.removeAttribute("open")
                  onOpenSettings()
                }}
                className="flex w-full items-center gap-2 px-2 py-2 text-left text-xs text-secondary hover:bg-elevated hover:text-primary"
              >
                <GearIcon width="14" height="14" /> Settings
              </button>
            </div>
          </details>
        </div>
      </div>

      {(registryEntry?.trackerHubSlug ||
        (tracker.platformType === "mam" && tracker.mouseholeUrl)) && (
        <div className="flex flex-col gap-3 my-4">
          {registryEntry?.trackerHubSlug && (
            <TrackerHubStatus
              trackerHubSlug={registryEntry.trackerHubSlug}
              statusPageUrl={registryEntry.statusPageUrl}
            />
          )}
          {/* Remounted on each settings save so a new URL or token is fetched at once */}
          {tracker.platformType === "mam" && tracker.mouseholeUrl && (
            <MamMouseholeCard
              key={settingsSaves}
              trackerId={tracker.id}
              mouseholeUrl={tracker.mouseholeUrl}
            />
          )}
        </div>
      )}

      {stats && (
        <UserProfileCard
          tracker={tracker}
          stats={stats}
          registryEntry={registryEntry}
          accentColor={tc}
        />
      )}

      <RankTargetSummary summary={rankSummary} currentRank={stats?.group ?? null} />

      <Dialog
        open={confirmLoginOpen}
        onClose={() => setConfirmLoginOpen(false)}
        title="Record login today?"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              text="Cancel"
              onClick={() => setConfirmLoginOpen(false)}
            />
            <Button
              size="sm"
              text={markLoginLoading ? "Saving..." : "Record login"}
              disabled={markLoginLoading}
              onClick={() => {
                setConfirmLoginOpen(false)
                onMarkLoginToday()
              }}
            />
          </div>
        }
      >
        <p className="text-sm text-secondary">
          This records a login on <span className="font-mono text-primary">{loginDate}</span>. It
          does not change the tracker itself.
        </p>
      </Dialog>
    </div>
  )
}
