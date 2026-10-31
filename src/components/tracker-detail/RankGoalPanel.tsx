"use client"

import { H2 } from "@typography"
import { useEffect, useMemo, useState } from "react"
import { ManualValueEditor } from "@/components/dashboard/ManualValueEditor"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Notice } from "@/components/ui/Notice"
import { RequirementBarTrack } from "@/components/ui/RequirementBarTrack"
import type { TrackerRankPath, TrackerUserClass } from "@/data/tracker-registry"
import { formatBytesNum, formatDate, formatRatio, formatSeedSize, formatSeedTime } from "@/lib/formatters"
import { formatProfileReadAge } from "@/lib/profile-reading/labels"
import { readProfileReadRecord } from "@/lib/profile-reading/types"
import { estimateUploadCompletion } from "@/lib/rank-eta"
import {
  evaluateRankGoal,
  evaluateRequirementGroup,
  type RankConditionResult,
  type RankGoalInput,
  type RankGroupResult,
  type RankMetric,
  type RankNumericCondition,
  type RankObservationMap,
  type RankRequirementGroup,
  rankDefinitionForSlug,
} from "@/lib/rank-goals"
import { buildRankLadder } from "@/lib/rank-ladder"
import {
  apiDoesNotReportMessage,
  type RankManualValue,
  type RankManualValues,
} from "@/lib/rank-manual-values"
import { buildRankObservations } from "@/lib/rank-observations"
import { requirementBarGeometry, strictThresholdRequirement } from "@/lib/requirement-bar"
import type { PlatformMeta, Snapshot, TrackerLatestStats } from "@/types/api"

interface RankGoalPanelProps {
  trackerId: number
  trackerName: string
  registrySlug: string | null
  userClasses: TrackerUserClass[]
  rankPaths?: TrackerRankPath[]
  currentRank: string | null
  stats: TrackerLatestStats | null
  snapshots: Snapshot[]
  joinedAt: string | null
  lastPolledAt: string | null
  accentColor: string
  platformType: string
  platformMeta: PlatformMeta | null
  initialSavedGoals?: Record<string, { targetRank: string }>
  onSavedGoalsChange?: (goals: Record<string, { targetRank: string }>) => void
  manualValues?: RankManualValues
  onSaveManualValue?: (metric: RankMetric, value: RankManualValue) => Promise<void>
  onClearManualValue?: (metric: RankMetric) => Promise<void>
}


function findUploadCondition(
  goal: RankRequirementGroup
): RankNumericCondition | null {
  for (const condition of goal.conditions) {
    if ("conditions" in condition) {
      const found = findUploadCondition(condition)
      if (found) return found
    } else if (
      condition.kind === "numeric" &&
      condition.metric === "uploadedBytes" &&
      condition.scope !== "per-torrent"
    ) {
      return condition
    }
  }
  return null
}

function findAgeCondition(goal: RankRequirementGroup): RankNumericCondition | null {
  for (const condition of goal.conditions) {
    if ("conditions" in condition) {
      const found = findAgeCondition(condition)
      if (found) return found
    } else if (condition.kind === "numeric" && condition.metric === "accountAgeDays") {
      return condition
    }
  }
  return null
}

function formatValue(metric: RankMetric | undefined, value: number | null): string {
  if (value === null) return "Unknown"
  if (metric === "uploadedBytes" || metric === "downloadedBytes" || metric === "bufferBytes") {
    return formatBytesNum(value)
  }
  if (metric === "seedSizeBytes") return formatSeedSize(value)
  if (metric === "averageSeedTimeSeconds") return formatSeedTime(value)
  if (metric === "accountAgeDays") return `${value} day${value === 1 ? "" : "s"}`
  if (metric === "accountRatio") return formatRatio(value)
  return String(value)
}

function statusLabel(status: "met" | "unmet" | "unknown"): string {
  return status === "met" ? "Met" : status === "unmet" ? "Unmet" : "Unknown"
}

function ConditionRow({
  trackerName,
  condition,
  now,
  manual,
  onSaveManual,
  onClearManual,
}: {
  trackerName: string
  condition: RankConditionResult
  now: Date
  manual: RankManualValue | null
  onSaveManual?: (value: RankManualValue) => Promise<void>
  onClearManual?: () => Promise<void>
}) {
  const [editingManual, setEditingManual] = useState(false)
  const isTimeOnly = condition.metric === "accountAgeDays"
  const timeOnlyUnmet = isTimeOnly && condition.status === "unmet"
  const statusClass =
    condition.status === "met"
      ? "text-success"
      : timeOnlyUnmet
        ? "text-secondary"
        : condition.status === "unmet"
          ? "text-danger"
          : "text-warn"
  const barClass =
    condition.status === "met"
      ? "bg-success"
      : timeOnlyUnmet
        ? "bg-secondary"
        : condition.status === "unmet"
          ? "bg-danger"
          : "bg-warn"
  const comparison = condition.comparison ?? "gte"
  const geometry =
    condition.requiredValue !== null
      ? requirementBarGeometry({
          currentValue: condition.observedValue,
          requiredValue: condition.requiredValue,
          comparison,
          status: condition.status,
        })
      : null
  const requirementText =
    geometry?.atStrictThreshold && condition.requiredValue !== null
      ? strictThresholdRequirement(
          comparison,
          formatValue(condition.metric ?? "accountRatio", condition.observedValue),
          formatValue(condition.metric ?? "accountRatio", condition.requiredValue)
        )
      : null
  const observed =
    condition.observedValue !== null && condition.source !== "manual" && condition.manual !== true
  const canEnter =
    condition.status === "unknown" &&
    !observed &&
    !manual &&
    condition.metric !== undefined &&
    condition.scope !== "per-torrent" &&
    condition.verification !== "unresolved" &&
    Boolean(onSaveManual && onClearManual)
  const showEditor =
    Boolean(onSaveManual && onClearManual && condition.metric) && (manual !== null || editingManual)
  const statusText =
    timeOnlyUnmet && condition.remaining !== null
      ? `in ${condition.remaining} day${condition.remaining === 1 ? "" : "s"}`
      : statusLabel(condition.status)

  return (
    <li
      className="border-t border-border py-2 first:border-t-0"
      data-rank-condition
      data-time-only={isTimeOnly}
    >
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,auto)_auto_minmax(6rem,0.35fr)]">
        <span className="min-w-0 break-words text-xs text-primary">{condition.label}</span>
        <span className="whitespace-nowrap font-mono text-xs text-secondary">
          {formatValue(condition.metric, condition.observedValue)} /{" "}
          {formatValue(condition.metric, condition.requiredValue)}
        </span>
        <span className="col-span-2 flex flex-wrap items-center gap-x-2 gap-y-1 sm:col-span-1">
          {condition.manual && (
            <span className="font-mono text-3xs uppercase tracking-[0.1em] text-accent">
              Manual
            </span>
          )}
          <span className={`font-mono text-2xs uppercase tracking-[0.1em] ${statusClass}`}>
            {statusText}
          </span>
          {canEnter && !editingManual && (
            <button
              type="button"
              onClick={() => setEditingManual(true)}
              className="w-fit text-2xs font-medium text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-focus)] focus-visible:ring-offset-1"
              data-enter-manual-value
            >
              Enter value
            </button>
          )}
        </span>
        <div className="col-span-2 sm:col-span-1" data-rank-condition-bar>
          {geometry ? (
            <RequirementBarTrack
              percent={geometry.percent}
              fillClassName={barClass}
              shortfall={geometry.atStrictThreshold}
            />
          ) : (
            <div className="h-1 rounded-full bg-control-bg" aria-hidden="true" />
          )}
        </div>
      </div>
      {requirementText && (
        <p className="mt-1 font-mono text-2xs text-danger" data-strict-requirement>
          {requirementText}
        </p>
      )}
      {showEditor && condition.metric && (
        <ManualValueEditor
          trackerName={trackerName}
          metric={condition.metric}
          label={condition.label}
          manual={manual}
          manualUsed={condition.manual === true}
          manualStale={condition.manualStale === true}
          observed={observed}
          canEnter={canEnter}
          now={now}
          onSave={onSaveManual as (value: RankManualValue) => Promise<void>}
          onClear={onClearManual as () => Promise<void>}
          triggerVariant="link"
          hideTrigger
          open={editingManual ? true : undefined}
          onOpenChange={setEditingManual}
        />
      )}
    </li>
  )
}

function groupConditions(
  result: RankGroupResult | null
): RankConditionResult[] {
  if (!result) return []
  return result.conditions.flatMap((condition) =>
    "conditions" in condition ? groupConditions(condition) : [condition]
  )
}

export function RankGoalPanel({
  trackerId,
  trackerName,
  registrySlug,
  userClasses,
  rankPaths,
  currentRank,
  stats,
  snapshots,
  joinedAt,
  lastPolledAt,
  accentColor,
  platformType,
  platformMeta,
  initialSavedGoals,
  onSavedGoalsChange,
  manualValues = {},
  onSaveManualValue,
  onClearManualValue,
}: RankGoalPanelProps) {
  const pilot = useMemo(() => rankDefinitionForSlug(registrySlug), [registrySlug])
  const targetOptions = useMemo(() => Object.keys(pilot?.goals ?? {}), [pilot])
  const nextRequirements = useMemo(() => {
    const ladder = buildRankLadder(userClasses, currentRank)
    const next = ladder?.rungs[ladder.currentIndex + 1]
    return next?.requirements ?? null
  }, [userClasses, currentRank])
  const initialTarget = initialSavedGoals?.[String(trackerId)]?.targetRank ?? null
  const [target, setTarget] = useState<string | null>(
    initialTarget && targetOptions.includes(initialTarget) ? initialTarget : null
  )
  const [savedGoals, setSavedGoals] = useState<Record<string, { targetRank: string }>>(
    initialSavedGoals ?? {}
  )
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    fetch("/api/settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { rankGoals?: string | null } | null) => {
        let parsed: Record<string, { targetRank: string }> = {}
        try {
          if (data?.rankGoals) {
            parsed = JSON.parse(data.rankGoals) as Record<string, { targetRank: string }>
          }
        } catch {
          parsed = {}
        }
        setSavedGoals(parsed)
        onSavedGoalsChange?.(parsed)
        const saved = parsed[String(trackerId)]?.targetRank
        setTarget(saved && targetOptions.includes(saved) ? saved : null)
      })
      .catch(() => setTarget(null))
      .finally(() => setLoaded(true))
  }, [trackerId, targetOptions, onSavedGoalsChange])

  const profileRead = readProfileReadRecord(platformMeta)
  const profileStopped =
    profileRead?.status === "session_expired"
      ? "Session expired"
      : profileRead?.status === "page_changed"
        ? "Page changed"
        : null

  const observationMap = useMemo<RankObservationMap>(
    () =>
      buildRankObservations({
        latestStats: stats,
        lastPolledAt,
        platformType,
        platformMeta,
        now: now ?? new Date(0),
      }),
    [stats, lastPolledAt, now, platformType, platformMeta]
  )
  const savedTarget = savedGoals[String(trackerId)]?.targetRank ?? null
  const targetInvalid = Boolean(savedTarget && !targetOptions.includes(savedTarget))
  const goalInput = useMemo<RankGoalInput>(
    () => ({
      userClasses,
      rankPaths,
      currentRank,
      observations: observationMap,
      manualValues,
      now: now ?? new Date(0),
      joinedAt,
      structuredGoals: pilot?.goals,
    }),
    [userClasses, rankPaths, currentRank, observationMap, manualValues, now, joinedAt, pilot]
  )
  const goal = target ? pilot?.goals[target] : undefined
  const result = goal && now ? evaluateRequirementGroup(goal, goalInput) : null
  const suggestion = !target && now ? evaluateRankGoal(goalInput).nextRank : null
  const conditions = groupConditions(result)
  const upload = goal ? findUploadCondition(goal) : null
  const age = goal ? findAgeCondition(goal) : null
  const uploadUnresolved = upload?.verification === "unresolved"
  const uploadEstimate =
    goal && upload && !uploadUnresolved && stats && now
      ? estimateUploadCompletion(
          snapshots,
          upload.requiredValue,
          stats.uploadedBytes === null ? Number.NaN : Number(stats.uploadedBytes),
          now
        )
      : null
  const joined = joinedAt ? new Date(joinedAt) : null
  const ageDate =
    age && joined && now && !Number.isNaN(joined.getTime())
      ? formatDate(new Date(joined.getTime() + age.requiredValue * 86_400_000))
      : null
  const counts = result?.progress ?? { met: 0, unmet: 0, unknown: 0, total: 0 }
  const eligible = result?.status === "met"

  async function chooseTarget(nextTarget: string) {
    const previous = target
    setTarget(nextTarget)
    setSaving(true)
    setError(null)
    try {
      const updated = {
        ...savedGoals,
        [String(trackerId)]: { targetRank: nextTarget },
      }
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rankGoals: updated }),
      })
      if (!res.ok) {
        setTarget(previous)
        setError("Could not save the selected rank goal")
        return
      }
      setSavedGoals(updated)
      onSavedGoalsChange?.(updated)
    } catch {
      setTarget(previous)
      setError("Network error. Could not save the selected rank goal")
    } finally {
      setSaving(false)
    }
  }

  async function clearTarget() {
    if (!savedTarget) {
      setTarget(null)
      return
    }
    const updated = { ...savedGoals }
    delete updated[String(trackerId)]
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rankGoals: updated }),
      })
      if (!res.ok) {
        setError("Could not clear the selected rank goal")
        return
      }
      setSavedGoals(updated)
      onSavedGoalsChange?.(updated)
      setTarget(null)
    } catch {
      setError("Network error. Could not clear the selected rank goal")
    } finally {
      setSaving(false)
    }
  }

  if (!pilot || targetOptions.length === 0) {
    return (
      <section id="rank-goal" className="scroll-mt-16 border border-border border-t-2 bg-raised p-4">
        <H2 className="uppercase tracking-wider">Rank goal</H2>
        {nextRequirements ? (
          <div className="mt-2 flex flex-col gap-0.5">
            <span className="text-xs text-tertiary">
              From tracker rules (not tracked automatically)
            </span>
            <p className="text-xs text-secondary">{nextRequirements}</p>
          </div>
        ) : (
          <p className="mt-2 text-xs text-secondary">
            No next-class requirements are published for this tracker.
          </p>
        )}
      </section>
    )
  }

  return (
    <section
      id="rank-goal"
      className="scroll-mt-16 border border-border border-t-2 bg-raised p-4"
      style={{ borderTopColor: accentColor }}
      data-rank-goal-panel
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <H2 className="uppercase tracking-wider">Rank goal</H2>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="font-cond text-4xs uppercase tracking-[0.12em] text-secondary">
              Target rank
            </span>
            <select
              className="border border-border bg-control-bg px-3 py-2 font-mono text-xs text-primary"
              value={target ?? ""}
              onChange={(e) => {
                if (e.target.value) void chooseTarget(e.target.value)
              }}
              disabled={saving || !loaded}
              aria-label="Target rank"
            >
              <option value="">Choose a target</option>
              {targetOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          {savedTarget && (
            <Button
              size="sm"
              variant="ghost"
              text="Clear target"
              onClick={() => void clearTarget()}
              disabled={saving}
            />
          )}
        </div>
      </div>

      {profileStopped && (
        <p className="mt-3 font-mono text-4xs text-warn" data-profile-read-stopped>
          <span className="font-semibold">{profileStopped}.</span> Profile reading is stopped for
          this tracker; the last values are stale. Save a new cookie in Settings to retry.
        </p>
      )}

      {!loaded || !now ? (
        <p className="mt-3 font-mono text-xs text-secondary" role="status">
          Loading rank evidence…
        </p>
      ) : !target ? (
        <div className="mt-3 flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="default">Choose a target</Badge>
            <span className="font-mono text-4xs text-secondary">
              No saved target for this tracker.
            </span>
          </div>
          {targetInvalid && savedTarget && (
            <p className="font-mono text-4xs text-warn">
              Saved target "{savedTarget}" is no longer available in this ladder. Clear it or
              choose another.
            </p>
          )}
          {suggestion && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-4xs text-secondary">
                Suggested next rank: {suggestion} (not saved).
              </span>
              <Button
                size="sm"
                variant="secondary"
                text={`Use ${suggestion} as target`}
                onClick={() => void chooseTarget(suggestion)}
                disabled={saving}
              />
            </div>
          )}
          <p className="font-mono text-4xs text-tertiary">
            Selecting a suggestion saves it explicitly; no automatic target is persisted.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant={eligible ? "success" : "default"}>
              {counts.met} of {counts.total} · {counts.unmet} unmet · {counts.unknown} unknown
            </Badge>
            {eligible && (
              <span className="font-mono text-4xs text-secondary">
                Thresholds met; promotion still depends on tracker/manual rules.
              </span>
            )}
          </div>
          {uploadUnresolved && (
            <p className="mt-2 font-mono text-4xs text-warn">
              Upload requirement is unknown: the official source does not establish binary vs decimal units.
            </p>
          )}
          <ul className="mt-2">
            {conditions.map((condition) => (
              <ConditionRow
                key={condition.id}
                trackerName={trackerName}
                condition={condition}
                now={now ?? new Date(0)}
                manual={
                  condition.metric ? (manualValues[condition.metric] ?? null) : null
                }
                onSaveManual={
                  onSaveManualValue && condition.metric
                    ? (value) => onSaveManualValue(condition.metric as RankMetric, value)
                    : undefined
                }
                onClearManual={
                  onClearManualValue && condition.metric
                    ? () => onClearManualValue(condition.metric as RankMetric)
                    : undefined
                }
              />
            ))}
          </ul>
          <details className="mt-3 border-t border-border pt-2" data-rank-details>
            <summary className="cursor-pointer font-mono text-2xs text-tertiary">Details</summary>
            <div className="mt-2 flex flex-col gap-3">
              <ul className="flex flex-col gap-2">
                {conditions.map((condition) => {
                  const observed =
                    condition.observedValue !== null &&
                    condition.source !== "manual" &&
                    condition.manual !== true
                  return (
                    <li
                      key={`detail-${condition.id}`}
                      className="flex flex-col gap-0.5 font-mono text-2xs text-tertiary"
                      data-rank-condition-detail
                    >
                      <span className="text-secondary">{condition.label}</span>
                      <span>
                        source={condition.source} Â· freshness={condition.freshness}
                        {condition.source === "profile" && condition.observedAt
                          ? ` Â· ${formatProfileReadAge(condition.observedAt, now ?? new Date(0))}`
                          : ""}
                      </span>
                      {condition.unitReading === "conservative" && (
                        <span>conservative unit reading</span>
                      )}
                      {condition.status === "unknown" && (
                        <span className="text-warn">
                          {observed
                            ? (condition.reason ?? "The observation needs checking.")
                            : condition.metric
                              ? apiDoesNotReportMessage(trackerName, condition.metric)
                              : (condition.reason ??
                                "This condition cannot be read from the tracker's API.")}
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
              <div className="grid gap-2 font-mono text-2xs text-secondary sm:grid-cols-2">
                <p>Account-age threshold date: {ageDate ?? "unavailable"}</p>
                <p>
                  Upload estimate:{" "}
                  {uploadUnresolved
                    ? "unavailable â€” unit unresolved"
                    : uploadEstimate
                      ? `${uploadEstimate.date} Â· ${uploadEstimate.daysRemaining.toFixed(0)} days at the recent ${uploadEstimate.basisDays}-day trend`
                      : "unavailable â€” insufficient, stale or non-positive history"}
                </p>
              </div>
              <p className="font-mono text-2xs text-muted">
                An upload estimate is not a promotion date; bonuses, donations and manual rules can
                change it.
              </p>
              <div className="space-y-1 font-mono text-2xs text-tertiary">
                <p>{pilot.source.title}</p>
                <p>
                  accessed{" "}
                  {pilot.source.accessedAt
                    ? formatDate(pilot.source.accessedAt)
                    : "not available"}{" "}
                  Â· page modified{" "}
                  {pilot.source.sourceLastModified
                    ? formatDate(pilot.source.sourceLastModified)
                    : "unknown"}
                </p>
                <p>{pilot.source.note}</p>
                {pilot.unresolved.map((item) => (
                  <p key={item} className="text-warn">
                    unresolved: {item}
                  </p>
                ))}
              </div>
            </div>
          </details>
          <Notice message={error} />
        </>
      )}
    </section>
  )
}
