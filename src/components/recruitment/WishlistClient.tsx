// src/components/recruitment/WishlistClient.tsx

"use client"

import { H1, H2, Paragraph, Subtext } from "@typography"
import { useMemo, useState } from "react"
import { Badge, Button, Card, Notice, Select } from "@/components/ui"
import { RECRUITMENT_CATALOG } from "@/data/recruitment-catalog"
import { getTrackerBySlug, TRACKER_REGISTRY } from "@/data/tracker-registry"
import { formatBytesNum, formatCount, formatRatioDisplay } from "@/lib/formatters"
import type {
  RankConditionResult,
  RankGroupResult,
  RankMetric,
} from "@/lib/rank-goals"
import type {
  RecruitmentCatalog,
  RecruitmentRouteEvaluation,
} from "@/lib/recruitment-routes"
import {
  normalizeRecruitmentState,
  type RecruitmentGoalLink,
  type RecruitmentState,
} from "@/lib/recruitment-state"
import {
  buildWishlistPaths,
  flattenRequirementResults,
  type GoalLinkCandidate,
  goalLinkIsCurrent,
  upsertGoalLink,
  type WishlistPathView,
  type WishlistStepView,
} from "@/lib/recruitment-wishlist"
import type { TrackerSummary } from "@/types/api"

interface WishlistClientProps {
  trackers: TrackerSummary[]
  initialState: RecruitmentState
  savedRankGoals: Record<string, { targetRank: string }>
  /** Test seam; production always uses the pinned catalog. */
  catalog?: RecruitmentCatalog
}

const NO_REQUIREMENT = /^(none|no requirements?|removed)$/i

function dateOnly(value: string | null): string {
  return value ? value.slice(0, 10) : "unknown"
}

function trackerName(slug: string): string {
  return getTrackerBySlug(slug)?.name ?? slug
}

function formatValue(metric: RankMetric, value: number | null): string {
  if (value === null) return "no stored value"
  if (
    metric === "uploadedBytes" ||
    metric === "downloadedBytes" ||
    metric === "bufferBytes"
  ) {
    return formatBytesNum(value)
  }
  if (metric === "accountRatio") return formatRatioDisplay(value)
  if (metric === "accountAgeDays") return `${formatCount(value)} days`
  return formatCount(value)
}

function conditionStatusLabel(result: RankConditionResult): string {
  if (result.status === "met") return "Met"
  if (result.status === "unmet") return "Unmet"
  return "Needs data"
}

function conditionBadgeVariant(result: RankConditionResult): "success" | "danger" | "warn" {
  if (result.status === "met") return "success"
  if (result.status === "unmet") return "danger"
  return "warn"
}

function pathStatusLabel(status: WishlistPathView["status"]): string {
  switch (status) {
    case "known-met":
      return "Known requirements met"
    case "unmet":
      return "Known requirement unmet"
    case "closed":
      return "Closed"
    default:
      return "Needs checking"
  }
}

function pathStatusVariant(
  status: WishlistPathView["status"]
): "success" | "danger" | "warn" | "default" {
  if (status === "known-met") return "success"
  if (status === "unmet") return "danger"
  if (status === "closed") return "danger"
  return "warn"
}

function availabilityLabel(evaluation: RecruitmentRouteEvaluation): string {
  if (evaluation.availability.status === "closed") return "Closed"
  if (evaluation.availability.status === "open") return "Community says open"
  return "Availability unconfirmed"
}

function availabilityVariant(
  evaluation: RecruitmentRouteEvaluation
): "success" | "danger" | "warn" {
  if (evaluation.availability.status === "closed") return "danger"
  if (evaluation.availability.status === "open") return "success"
  return "warn"
}

function requirementCounts(group: RankGroupResult | null): {
  met: number
  unmet: number
  unknown: number
} {
  return group?.progress ?? { met: 0, unmet: 0, unknown: 0 }
}

function numericResults(group: RankGroupResult | null): RankConditionResult[] {
  return flattenRequirementResults(group).filter((result) => result.kind === "numeric")
}

function StepRequirements({
  step,
  state,
  onLink,
  onUnlink,
}: {
  step: WishlistStepView
  state: RecruitmentState
  onLink: (candidate: GoalLinkCandidate) => void
  onUnlink: (link: RecruitmentGoalLink) => void
}) {
  const evaluation = step.evaluation
  const numeric = numericResults(evaluation.eligibility.structured)
  const notes = evaluation.eligibility.requirementNotes.filter(
    (note) => !NO_REQUIREMENT.test(note.trim())
  )
  const gate = evaluation.eligibility.sourceRequirements.inviteGate
  const days = evaluation.eligibility.sourceRequirements.days
  const hasUnresolved = notes.length > 0 || gate !== null || days !== null

  return (
    <div className="flex flex-col gap-3">
      {numeric.length > 0 && (
        <div className="flex flex-col gap-2">
          <h4 className="font-cond text-4xs font-semibold uppercase tracking-[0.14em] text-secondary">
            Structured requirements
          </h4>
          <ul className="flex flex-col gap-2">
            {numeric.map((result) => {
              const candidates = step.goalCandidates.filter(
                (candidate) => candidate.conditionId === result.id
              )
              const linked = state.goalLinks.find((link) =>
                candidates.some((candidate) => goalLinkIsCurrent(link, candidate))
              )
              return (
                <li
                  key={result.id}
                  className="flex flex-col gap-1 border-l border-border pl-2 text-xs"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={conditionBadgeVariant(result)}>
                      {conditionStatusLabel(result)}
                    </Badge>
                    <span className="font-medium text-primary">{result.label}</span>
                    <span className="font-mono text-2xs text-tertiary">
                      {formatValue(
                        result.metric ?? "accountAgeDays",
                        result.observedValue
                      )}{" "}
                      / {formatValue(result.metric ?? "accountAgeDays", result.requiredValue)}
                    </span>
                  </div>
                  {result.freshness === "stale" && (
                    <span className="text-2xs text-warn">Stored observation is stale.</span>
                  )}
                  {linked ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="accent">
                        Linked to {linked.goalTrackerSlug} · {linked.targetRank}
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        text="Unlink"
                        onClick={() => onUnlink(linked)}
                      />
                    </div>
                  ) : candidates.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {candidates.map((candidate) => (
                        <Button
                          key={`${candidate.routeId}:${candidate.conditionId}:${candidate.targetRank}`}
                          size="sm"
                          variant="secondary"
                          text={`Link to ${trackerName(candidate.goalTrackerSlug)} ${candidate.targetRank} goal`}
                          onClick={() => onLink(candidate)}
                        />
                      ))}
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {hasUnresolved ? (
        <div className="flex flex-col gap-2">
          <h4 className="font-cond text-4xs font-semibold uppercase tracking-[0.14em] text-secondary">
            Needs checking
          </h4>
          {notes.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {notes.map((note, index) => (
                <li key={`${step.routeId}:note:${index}`} className="flex gap-2 text-xs">
                  <Badge variant="warn">Source text</Badge>
                  <span className="break-words text-secondary">{note}</span>
                </li>
              ))}
            </ul>
          )}
          {gate && (
            <div className="flex flex-col gap-1 border border-border bg-control-bg px-2.5 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="warn">Source invite/forum gate</Badge>
                <span className="text-2xs text-tertiary">
                  {gate.days === null
                    ? "No upstream wait value"
                    : `${gate.days} days listed upstream`}
                </span>
              </div>
              <p className="break-words text-xs text-secondary">{gate.text}</p>
              <span className="text-2xs text-tertiary">
                Not evaluated: this is a source-side class/forum prerequisite, not a stored metric.
              </span>
            </div>
          )}
          {days !== null && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="warn">Upstream wait</Badge>
              <span className="text-secondary">
                {days} days listed. Upstream does not document whether this means account age,
                waiting time, or another gate, so it is not evaluated.
              </span>
            </div>
          )}
        </div>
      ) : numeric.length === 0 ? (
        <p className="text-xs text-secondary">
          No structured requirement or readable source prerequisite is available. Eligibility
          cannot be checked for this step.
        </p>
      ) : null}

      {evaluation.eligibility.originalRequirementNotes.length > 0 && (
        <details className="text-xs text-tertiary">
          <summary className="cursor-pointer text-2xs uppercase tracking-[0.12em]">
            Original source note
          </summary>
          <p className="mt-1 break-words whitespace-pre-wrap text-secondary">
            {evaluation.eligibility.originalRequirementNotes.join("\n")}
          </p>
        </details>
      )}
    </div>
  )
}

function StepCard({
  step,
  index,
  state,
  onLink,
  onUnlink,
}: {
  step: WishlistStepView
  index: number
  state: RecruitmentState
  onLink: (candidate: GoalLinkCandidate) => void
  onUnlink: (link: RecruitmentGoalLink) => void
}) {
  const evaluation = step.evaluation
  const counts = requirementCounts(evaluation.eligibility.structured)
  const evidence = evaluation.evidence

  return (
    <li className="flex flex-col gap-2 border-t border-border pt-3 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-xs text-tertiary">Step {index + 1}</p>
          <p className="break-words font-cond text-sm font-semibold uppercase tracking-[0.08em] text-primary">
            {step.sourceName} <span className="text-tertiary">→</span> {step.destinationName}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          <Badge variant={step.scenario ? "default" : "accent"}>
            {step.scenario ? "Scenario" : "Your account"}
          </Badge>
          <Badge variant={availabilityVariant(evaluation)}>
            {availabilityLabel(evaluation)}
          </Badge>
          {!step.scenario && (
            <Badge
              variant={
                evaluation.eligibility.status === "met"
                  ? "success"
                  : evaluation.eligibility.status === "unmet"
                    ? "danger"
                    : "warn"
              }
            >
              {evaluation.eligibility.status === "met"
                ? "Known requirements met"
                : evaluation.eligibility.status === "unmet"
                  ? "Known requirement unmet"
                  : "Needs checking"}
            </Badge>
          )}
        </div>
      </div>

      <p className="text-xs text-secondary">{step.observationNote}</p>

      {counts.unknown + counts.unmet + counts.met > 0 && (
        <p className="text-2xs text-tertiary">
          {counts.met} satisfied · {counts.unmet} unmet · {counts.unknown} need checking
        </p>
      )}

      <StepRequirements step={step} state={state} onLink={onLink} onUnlink={onUnlink} />

      <div className="flex flex-col gap-1 border-t border-border pt-2 text-2xs text-tertiary">
        <p>
          Recruitment: {evaluation.availability.note}
          {evaluation.availability.raw ? ` Source value: ${evaluation.availability.raw}.` : ""}
        </p>
        <p>
          Source updated {evidence.sourceUpdatedRaw ?? "unknown"} · snapshot accessed{" "}
          {dateOnly(evidence.sourceAccessedAt)} · last independent verification{" "}
          {evidence.lastVerifiedAt ? dateOnly(evidence.lastVerifiedAt) : "never"}.
        </p>
        {evidence.sourceFreshness === "stale" && (
          <p className="text-warn">
            The community source update is stale. A recent page visit would not make it verified.
          </p>
        )}
        {evidence.evidenceFreshness === "unknown" && (
          <p>This is community evidence, not a verified active recruiter or invitation.</p>
        )}
      </div>
    </li>
  )
}

function PathCard({
  path,
  state,
  onHide,
  onLink,
  onUnlink,
}: {
  path: WishlistPathView
  state: RecruitmentState
  onHide: () => void
  onLink: (candidate: GoalLinkCandidate) => void
  onUnlink: (link: RecruitmentGoalLink) => void
}) {
  const first = path.steps[0]
  const last = path.steps[path.steps.length - 1]
  return (
    <Card
      elevation="raised"
      className="flex flex-col gap-3"
      data-wishlist-path={path.key}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="break-words font-cond text-base font-semibold uppercase tracking-[0.06em] text-primary">
            {first.sourceName} <span className="text-tertiary">→</span> {last.destinationName}
          </p>
          <p className="text-xs text-secondary">
            {path.steps.length === 1
              ? "Direct route"
              : `${path.steps.length} steps · bounded scenario`}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <Badge variant={pathStatusVariant(path.status)}>{pathStatusLabel(path.status)}</Badge>
          <Button size="sm" variant="ghost" text="Hide route" onClick={onHide} />
        </div>
      </div>
      <p className="text-xs text-secondary">{path.statusDetail}</p>
      <ol className="flex flex-col gap-3">
        {path.steps.map((step, index) => (
          <StepCard
            key={step.routeId}
            step={step}
            index={index}
            state={state}
            onLink={onLink}
            onUnlink={onUnlink}
          />
        ))}
      </ol>
    </Card>
  )
}

export function WishlistClient({
  trackers,
  initialState,
  savedRankGoals,
  catalog = RECRUITMENT_CATALOG,
}: WishlistClientProps) {
  const [state, setState] = useState(initialState)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showHidden, setShowHidden] = useState(false)
  const [now] = useState(() => new Date())

  const result = useMemo(
    () =>
      buildWishlistPaths({
        catalog,
        desiredTrackerSlug: state.desiredTrackerSlug,
        trackers,
        savedRankGoals,
        state,
        now,
      }),
    [catalog, now, savedRankGoals, state, trackers]
  )

  const visiblePaths = result.paths.filter((path) => showHidden || !path.hidden)
  const hiddenCount = result.paths.filter((path) => path.hidden).length
  const desiredName = state.desiredTrackerSlug
    ? trackerName(state.desiredTrackerSlug)
    : null

  const trackerOptions = useMemo(
    () => [
      { value: "", label: "Choose a desired tracker" },
      ...[...TRACKER_REGISTRY]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((tracker) => ({
          value: tracker.slug,
          label: result.ownedSlugs.includes(tracker.slug)
            ? `${tracker.name} (owned)`
            : tracker.name,
        })),
    ],
    [result.ownedSlugs]
  )

  async function persist(next: RecruitmentState) {
    const previous = state
    setState(next)
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/recruitment/wishlist", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: next }),
      })
      if (!res.ok) throw new Error("The wishlist could not be saved")
      const data = (await res.json()) as { state?: unknown }
      if (data.state) setState(normalizeRecruitmentState(data.state))
    } catch (err) {
      setState(previous)
      setError(err instanceof Error ? err.message : "The wishlist could not be saved")
    } finally {
      setSaving(false)
    }
  }

  function chooseDesired(value: string) {
    void persist({
      ...state,
      desiredTrackerSlug: value || null,
    })
  }

  function toggleHidden(pathKey: string) {
    const hidden = state.hiddenPathKeys.includes(pathKey)
    void persist({
      ...state,
      hiddenPathKeys: hidden
        ? state.hiddenPathKeys.filter((key) => key !== pathKey)
        : [...state.hiddenPathKeys, pathKey],
    })
  }

  function linkGoal(candidate: GoalLinkCandidate) {
    void persist({ ...state, goalLinks: upsertGoalLink(state.goalLinks, candidate) })
  }

  function unlinkGoal(link: RecruitmentGoalLink) {
    void persist({
      ...state,
      goalLinks: state.goalLinks.filter(
        (candidate) =>
          !(candidate.routeId === link.routeId && candidate.conditionId === link.conditionId)
      ),
    })
  }

  const unsupportedNames = result.unsupportedOwnedTrackers.map((tracker) => tracker.name)

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 pt-14 md:pt-0" data-wishlist-page>
      <div className="flex flex-col gap-1">
        <H1>Wishlist</H1>
        <Paragraph className="max-w-3xl">
          Plan a route to a tracker you want. Routes are based on a pinned community snapshot;
          they are not applications and they do not prove that a recruiter is active.
        </Paragraph>
      </div>

      <Card elevation="raised" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <H2>Desired tracker</H2>
          <Paragraph>
            Select one destination. Saving it only stores the destination and your route
            preferences; it never contacts a tracker.
          </Paragraph>
        </div>
        <div className="max-w-md">
          <Select
            value={state.desiredTrackerSlug ?? ""}
            options={trackerOptions}
            onChange={chooseDesired}
            ariaLabel="Desired tracker"
            label="Desired tracker"
            size="md"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-2xs text-tertiary">
          <span>
            {result.ownedSlugs.length === 1
              ? "1 owned registry account"
              : `${result.ownedSlugs.length} owned registry accounts`}
          </span>
          {saving && <span>Saving…</span>}
          {hiddenCount > 0 && (
            <Button
              size="sm"
              variant="ghost"
              text={
                showHidden
                  ? `Hide ${hiddenCount} hidden route(s)`
                  : `Show ${hiddenCount} hidden route(s)`
              }
              onClick={() => setShowHidden((current) => !current)}
            />
          )}
        </div>
        <Notice message={error} />
      </Card>

      {result.unsupportedOwnedTrackers.length > 0 && (
        <Notice
          variant="info"
          box
          header="Some owned trackers cannot start a route"
          message={`${unsupportedNames.join(", ")} ${unsupportedNames.length === 1 ? "has" : "have"} no registry identity, so the recruitment catalog cannot match ${unsupportedNames.length === 1 ? "it" : "them"}.`}
        />
      )}

      {!state.desiredTrackerSlug ? (
        <Notice
          variant="info"
          box
          header="Choose a destination"
          message="Pick a tracker above to see routes from the accounts you own."
        />
      ) : result.desiredOwned ? (
        <Notice
          variant="info"
          box
          header={`You already own ${desiredName}`}
          message="Choose a tracker you do not already own to see recruitment routes."
        />
      ) : result.ownedSlugs.length === 0 ? (
        <Notice
          variant="warn"
          box
          header="No owned route starts"
          message="No owned tracker has a registry identity. Add a tracker and wait for it to match the registry before planning a route."
        />
      ) : !result.catalogHasDesired ? (
        <Notice
          variant="warn"
          box
          header={`No catalog coverage for ${desiredName}`}
          message="The pinned route catalog has no source or destination entry for this tracker. This does not prove that no route exists."
        />
      ) : visiblePaths.length === 0 ? (
        <Notice
          variant="warn"
          box
          header={hiddenCount > 0 ? "Matching routes are hidden" : "No known route"}
          message={
            hiddenCount > 0
              ? "All matching routes are hidden. Use Show hidden routes above to review them."
              : "No route from your owned accounts appears in the pinned catalog. This does not mean no route exists."
          }
        />
      ) : (
        <section className="flex flex-col gap-3" aria-label="Recruitment routes">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div className="flex flex-col gap-1">
              <H2>Known routes</H2>
              <p className="text-xs text-secondary">
                {visiblePaths.length === 1
                  ? "1 route"
                  : `${visiblePaths.length} routes`} to {desiredName}. Direct routes are shown first.
              </p>
            </div>
            {result.truncated && (
              <Badge variant="warn">Showing first {visiblePaths.length}; more may exist</Badge>
            )}
          </div>
          <div className="flex flex-col gap-3">
            {visiblePaths.map((path) => (
              <PathCard
                key={path.key}
                path={path}
                state={state}
                onHide={() => toggleHidden(path.key)}
                onLink={linkGoal}
                onUnlink={unlinkGoal}
              />
            ))}
          </div>
        </section>
      )}

      <Subtext className="max-w-3xl">
        Source: {catalog.source.attribution}{" "}
        <a
          className="text-accent underline underline-offset-2"
          href={catalog.source.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {catalog.source.name}
        </a>{" "}
        · {catalog.source.license} · accessed {dateOnly(catalog.source.accessedAt)}. No messages,
        applications or tracker requests are sent from this page.
      </Subtext>
    </div>
  )
}
