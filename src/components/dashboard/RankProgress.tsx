// src/components/dashboard/RankProgress.tsx
//
// P47 progression rows: one compact left-aligned row per earned ladder or
// branch, with the shared start shown once. Classes are targets: clicking one
// saves it as the rank goal and the previous choice stays available as Undo.
// Staff and off-ladder classes stay behind Show all classes.

"use client"

import clsx from "clsx"
import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/Button"
import { ChevronDownSmallIcon, ChevronUpSmallIcon } from "@/components/ui/Icons"
import { RedactedText } from "@/components/ui/RedactedText"
import { SectionToggle } from "@/components/ui/SectionToggle"
import type { TrackerRankPath, TrackerUserClass } from "@/data/tracker-registry"
import { isRedacted } from "@/lib/privacy"
import type { RankObservationMap } from "@/lib/rank-goals"
import { findClassIndex, ladderPosition, OUTSIDE_LADDER_NOTE } from "@/lib/rank-ladder"
import type { RankManualValues } from "@/lib/rank-manual-values"
import {
  buildRankProgression,
  type RankProgressionClass,
} from "@/lib/rank-progression"
import type { Snapshot } from "@/types/api"

// ── Types ──

interface RankChange {
  from: string
  to: string
  date: string
}

type TimelineEvent = {
  kind: "rank"
  from: string
  to: string
  date: string
  direction: "promotion" | "demotion" | "unknown"
}

interface RankTimelineProps {
  events: TimelineEvent[]
}

interface RankProgressProps {
  userClasses: TrackerUserClass[]
  rankPaths?: TrackerRankPath[]
  currentRank: string | null
  snapshots: Snapshot[]
  /** Saved target, owned by the parent so it survives a view switch. */
  savedTargetRank?: string | null
  /** Persists the target. Null clears it. */
  onSetTarget?: (target: string | null) => void | Promise<void>
  observations?: RankObservationMap
  manualValues?: RankManualValues
  now?: Date
  joinedAt?: string | null
}

// ── Helpers ──

function extractRankHistory(snapshots: Snapshot[]): RankChange[] {
  const changes: RankChange[] = []
  for (let i = 1; i < snapshots.length; i++) {
    const prev = snapshots[i - 1]
    const curr = snapshots[i]
    if (!prev.group || !curr.group) continue
    if (prev.group === curr.group) continue
    if (isRedacted(prev.group) || isRedacted(curr.group)) continue
    changes.push({
      from: prev.group,
      to: curr.group,
      date: curr.polledAt,
    })
  }
  return changes
}

type RankLocation =
  | { kind: "shared"; index: number }
  | { kind: "path"; pathId: string; index: number }

function locateRank(name: string, userClasses: TrackerUserClass[]): RankLocation | null {
  const match = userClasses.find(
    (userClass) => !userClass.outsideLadder && userClass.name.toLowerCase() === name.toLowerCase()
  )
  if (!match) return null

  const siblings = match.path
    ? userClasses.filter((userClass) => !userClass.outsideLadder && userClass.path === match.path)
    : userClasses.filter((userClass) => !userClass.outsideLadder && !userClass.path)
  const index = siblings.findIndex(
    (userClass) => userClass.name.toLowerCase() === name.toLowerCase()
  )
  if (index < 0) return null

  return match.path ? { kind: "path", pathId: match.path, index } : { kind: "shared", index }
}

/**
 * Shared classes come before every branch, so crossing the fork is a step in
 * either direction. A move between two different branches is neither: there is
 * no shared ordering between them.
 */
function classifyForestDirection(
  from: string,
  to: string,
  userClasses: TrackerUserClass[]
): "promotion" | "demotion" | "unknown" {
  const first = locateRank(from, userClasses)
  const second = locateRank(to, userClasses)
  if (!first || !second) return "unknown"

  if (first.kind === "shared" && second.kind === "shared") {
    if (first.index === second.index) return "unknown"
    return second.index > first.index ? "promotion" : "demotion"
  }
  if (first.kind === "path" && second.kind === "path") {
    if (first.pathId !== second.pathId || first.index === second.index) return "unknown"
    return second.index > first.index ? "promotion" : "demotion"
  }
  return first.kind === "shared" ? "promotion" : "demotion"
}

function classifyDirection(
  from: string,
  to: string,
  userClasses: TrackerUserClass[],
  rankPaths?: TrackerRankPath[]
): "promotion" | "demotion" | "unknown" {
  if (rankPaths && rankPaths.length > 0) {
    return classifyForestDirection(from, to, userClasses)
  }

  // An above class is granted or bought rather than earned, so a move into or
  // out of one is neither a promotion nor a demotion.
  const isAbove = (name: string) =>
    userClasses[findClassIndex(userClasses, name)]?.outsideLadder === "above"
  if (isAbove(from) || isAbove(to)) return "unknown"
  const fromPos = ladderPosition(userClasses, from)
  const toPos = ladderPosition(userClasses, to)
  if (fromPos === null || toPos === null || fromPos === toPos) return "unknown"
  return toPos > fromPos ? "promotion" : "demotion"
}

export function buildRankTimeline(
  snapshots: Snapshot[],
  userClasses: TrackerUserClass[],
  rankPaths?: TrackerRankPath[]
): TimelineEvent[] {
  return [...extractRankHistory(snapshots)].reverse().map((change) => ({
    kind: "rank" as const,
    from: change.from,
    to: change.to,
    date: change.date,
    direction: classifyDirection(change.from, change.to, userClasses, rankPaths),
  }))
}

function classChipTone(item: RankProgressionClass): string {
  if (item.outsideLadder) {
    return "border-dashed border-border bg-control-bg text-tertiary"
  }
  if (item.isCurrent) {
    return "border-accent bg-accent-dim font-semibold text-primary"
  }
  return "border-border bg-control-bg text-secondary"
}

function ClassChip({
  item,
  saving,
  onSelect,
}: {
  item: RankProgressionClass
  saving: boolean
  onSelect: (name: string) => void
}) {
  const progress = item.progress
  const progressText =
    progress && progress.total > 0
      ? `${progress.met}/${progress.total} met`
      : "No checks"
  const unknownText =
    progress && progress.unknown > 0
      ? `${progress.unknown} unknown`
      : null

  return (
    <button
      type="button"
      onClick={() => onSelect(item.name)}
      disabled={saving}
      aria-pressed={item.isTarget}
      aria-label={`${item.name}: ${progressText}${unknownText ? `, ${unknownText}` : ""}${
        item.isCurrent ? ", current class" : ""
      }${item.isTarget ? ", saved target" : ""}`}
      title={
        item.outsideLadder
          ? OUTSIDE_LADDER_NOTE[item.outsideLadder]
          : (item.requirements ?? undefined)
      }
      data-rank-class={item.name}
      data-outside-ladder={item.outsideLadder ?? undefined}
      data-current-class={item.isCurrent ? "true" : undefined}
      data-target-class={item.isTarget ? "true" : undefined}
      className={clsx(
        "flex min-h-11 min-w-0 flex-col items-start gap-0.5 rounded-nm-sm border px-2 py-1.5 text-left text-xs transition-colors duration-150 disabled:opacity-60 sm:min-h-8",
        classChipTone(item),
        item.isTarget && "outline outline-1 outline-offset-1 outline-accent"
      )}
    >
      <span className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
        <span className="break-words">{item.name}</span>
        {item.isCurrent && (
          <span className="font-cond text-2xs uppercase tracking-[0.1em] text-accent">
            current
          </span>
        )}
        {item.isTarget && (
          <span className="font-cond text-2xs uppercase tracking-[0.1em] text-accent">
            target
          </span>
        )}
      </span>
      <span className="font-mono text-2xs text-tertiary">
        {progressText}
        {unknownText ? <span className="text-warn"> · {unknownText}</span> : null}
      </span>
    </button>
  )
}

export function RankTimeline({ events }: RankTimelineProps) {
  if (events.length === 0) return null

  return (
    <div className="flex items-start gap-4 overflow-x-auto pb-2 styled-scrollbar">
      {events.map((event) => {
        const dirColor =
          event.direction === "promotion"
            ? "var(--color-success)"
            : event.direction === "demotion"
              ? "var(--color-danger)"
              : "var(--color-secondary)"
        const DirIcon =
          event.direction === "promotion" ? ChevronUpSmallIcon : ChevronDownSmallIcon
        const dirIconClass =
          event.direction === "promotion"
            ? "text-success"
            : event.direction === "demotion"
              ? "text-danger"
              : "-rotate-90 text-secondary"

        const dateStr = new Date(event.date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })

        return (
          <div key={`${event.date}-${event.to}`} className="flex shrink-0 flex-col gap-0.5">
            <div className="flex items-center gap-2 whitespace-nowrap">
              <span
                data-direction={event.direction}
                className={clsx("shrink-0 leading-none", dirIconClass)}
              >
                <DirIcon width="9" height="6" />
              </span>
              <span className="font-mono text-xs text-secondary">
                <RedactedText
                  value={event.from}
                  color="var(--color-tertiary)"
                  className="text-tertiary"
                />
                <ChevronDownSmallIcon
                  width="9"
                  height="6"
                  className="mx-1 inline-block -rotate-90 text-tertiary"
                />
                <RedactedText value={event.to} color={dirColor} className="font-semibold" />
              </span>
            </div>
            <span className="timestamp whitespace-nowrap pl-4">{dateStr}</span>
          </div>
        )
      })}
    </div>
  )
}

function RankProgress({
  userClasses,
  rankPaths,
  currentRank,
  savedTargetRank = null,
  onSetTarget,
  observations = {},
  manualValues,
  now = new Date(),
  joinedAt,
}: RankProgressProps) {
  const [expanded, setExpanded] = useState(true)
  const [showAllClasses, setShowAllClasses] = useState(false)
  const [displayTarget, setDisplayTarget] = useState<string | null>(savedTargetRank)
  const [undoState, setUndoState] = useState<{ previous: string | null; target: string } | null>(
    null
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setDisplayTarget(savedTargetRank)
  }, [savedTargetRank])

  const progression = useMemo(
    () =>
      buildRankProgression({
        userClasses,
        rankPaths,
        currentRank,
        targetRank: displayTarget,
        observations,
        manualValues,
        now,
        joinedAt,
      }),
    [userClasses, rankPaths, currentRank, displayTarget, observations, manualValues, now, joinedAt]
  )

  const hasRows = progression.rows.some((row) => row.classes.length > 0)

  async function selectClass(name: string) {
    if (saving) return
    const previous = displayTarget
    setDisplayTarget(name)
    setUndoState({ previous, target: name })
    setSaving(true)
    setError(null)
    try {
      await onSetTarget?.(name)
    } catch {
      setDisplayTarget(previous)
      setUndoState(null)
      setError("Could not save the rank target. Try again.")
    } finally {
      setSaving(false)
    }
  }

  async function undo() {
    if (!undoState || saving) return
    const { previous, target } = undoState
    setDisplayTarget(previous)
    setUndoState(null)
    setSaving(true)
    setError(null)
    try {
      await onSetTarget?.(previous)
    } catch {
      setDisplayTarget(target)
      setUndoState({ previous, target })
      setError("Could not undo the rank target. Try again.")
    } finally {
      setSaving(false)
    }
  }

  if (!hasRows) return null

  return (
    <div className="flex flex-col gap-4">
      <SectionToggle
        label="Rank Progression"
        expanded={expanded}
        onToggle={() => setExpanded((e) => !e)}
      />

      {expanded && hasRows && (
        <div className="flex flex-col gap-4" data-rank-progression>
              {!undoState && (
                <span className="text-2xs text-tertiary" data-rank-target-hint>
                  Click a class to set it as your target.
                </span>
              )}
              {progression.shared.length > 0 && (
                <div
                  className="flex flex-wrap items-center gap-x-2 gap-y-1.5"
                  data-rank-shared-start
                >
                  <span className="font-cond text-2xs font-semibold uppercase tracking-[0.1em] text-tertiary">
                    From
                  </span>
                  {progression.shared.map((item) => (
                    <ClassChip
                      key={item.name}
                      item={item}
                      saving={saving}
                      onSelect={(name) => void selectClass(name)}
                    />
                  ))}
                </div>
              )}

              <div className="flex flex-col gap-3">
                {progression.rows.map((row) => (
                  <div
                    key={row.id}
                    data-rank-ladder-row={row.id}
                    className="grid min-w-0 gap-2 border-t border-border pt-3 first:border-t-0 first:pt-0 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)] sm:items-start"
                  >
                    <div className="min-w-0">
                      <span className="block break-words font-cond text-xs font-semibold text-primary">
                        {row.label}
                      </span>
                      <span className="mt-0.5 block break-words text-2xs text-tertiary">
                        {row.hint}
                      </span>
                    </div>
                    <div className="flex min-w-0 flex-wrap items-start gap-1.5">
                      {row.classes.length > 0 ? (
                        row.classes.map((item) => (
                          <ClassChip
                            key={item.name}
                            item={item}
                            saving={saving}
                            onSelect={(name) => void selectClass(name)}
                          />
                        ))
                      ) : (
                        <span className="text-2xs text-tertiary">No classes published.</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {progression.outside.length > 0 && (
                <div className="flex flex-col gap-2 border-t border-border pt-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-cond text-2xs font-semibold uppercase tracking-[0.1em] text-tertiary">
                      Staff and other classes
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-pressed={showAllClasses}
                      onClick={() => setShowAllClasses((shown) => !shown)}
                      className="min-h-11 px-2 sm:min-h-8"
                      data-show-all-classes
                    >
                      {showAllClasses ? "Show earned classes" : "Show all classes"}
                    </Button>
                  </div>
                  {showAllClasses && (
                    <div className="flex min-w-0 flex-wrap items-start gap-1.5">
                      {progression.outside.map((item) => (
                        <ClassChip
                          key={item.name}
                          item={item}
                          saving={saving}
                          onSelect={(name) => void selectClass(name)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2" aria-live="polite">
                {undoState ? (
                  <>
                    <span className="text-2xs text-secondary">
                      Target set to <span className="font-mono text-primary">{undoState.target}</span>
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void undo()}
                      disabled={saving}
                      className="min-h-11 px-2 sm:min-h-8"
                    >
                      Undo
                    </Button>
                  </>
                ) : null}
              </div>
              {error && (
                <p className="text-xs text-danger" role="alert">
                  {error}
                </p>
              )}
        </div>
      )}
    </div>
  )
}

export type { RankChange, RankProgressProps, TimelineEvent }
export { extractRankHistory, RankProgress }
