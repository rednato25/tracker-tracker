// src/components/recruitment/TrackerPathwaysClient.tsx

"use client"

import { H1, H2, Paragraph, Subtext } from "@typography"
import { useId, useMemo, useRef, useState } from "react"
import { Badge, Button, Card, Input, Notice } from "@/components/ui"
import { ChevronDownSmallIcon } from "@/components/ui/Icons"
import {
  PATHWAYS_TRACKERS,
  pathwaysTrackerIdForRegistrySlug,
  pathwaysTrackerName,
} from "@/data/pathways/catalog"
import { RECRUITMENT_CATALOG } from "@/data/recruitment-catalog"
import { useClickOutside } from "@/hooks/useClickOutside"
import {
  formatAccountAge,
  formatBytesNum,
  formatCount,
  formatRatio,
} from "@/lib/formatters"
import type { RankGoalStatus } from "@/lib/rank-goals"
import type { RecruitmentCatalog } from "@/lib/recruitment-routes"
import {
  normalizeRecruitmentState,
  type RecruitmentState,
} from "@/lib/recruitment-state"
import {
  buildWishlistPaths,
  flattenRequirementResults,
  type WishlistPathView,
  type WishlistStepView,
} from "@/lib/recruitment-wishlist"
import type { TrackerSummary } from "@/types/api"

interface TrackerPathwaysClientProps {
  trackers: TrackerSummary[]
  initialState: RecruitmentState
  /** Test seam; production always uses the pinned catalog. */
  catalog?: RecruitmentCatalog
}

const NO_REQUIREMENT = /^(none|no requirements?|removed)$/i
const TRACKERPATHWAYS_URL = "https://github.com/handokota/trackerpathways"

function dateOnly(value: string | null): string {
  return value ? value.slice(0, 10) : "unknown"
}

function waitLabel(days: number | null): string {
  if (days === null) return "Unknown"
  if (days === 0) return "Ready now"
  return `${days} day${days === 1 ? "" : "s"} left`
}

function stepWaitDays(step: WishlistStepView): number | null {
  const timeGate = step.evaluation.timeGate
  if (step.scenario) return timeGate.effectiveDays
  if (timeGate.status === "unknown") return null
  if (timeGate.status === "open") return 0
  return timeGate.daysRemaining
}

function inviteClassLabel(step: WishlistStepView): string {
  const gate = step.evaluation.eligibility.sourceRequirements.inviteGate
  if (!gate) return "No invite class listed"
  const label = gate.text.split(":")[0]?.trim()
  return label || gate.text
}

function routeChain(path: WishlistPathView): string {
  const first = path.steps[0]
  if (!first) return ""
  return [first.sourceName, ...path.steps.map((step) => step.destinationName)].join(" → ")
}

interface StepRequirementBar {
  id: string
  label: string
  current: string
  required: string
  currentValue: number | null
  requiredValue: number
  status: RankGoalStatus
}

function formatBarValue(metric: string | undefined, value: number | null): string {
  if (value === null || metric === undefined) return "?"
  if (metric === "uploadedBytes" || metric === "downloadedBytes" || metric === "bufferBytes") {
    return formatBytesNum(value)
  }
  if (metric === "accountRatio") return formatRatio(value)
  if (metric === "accountAgeDays") return `${formatCount(value)} day${value === 1 ? "" : "s"}`
  return formatCount(value)
}

function stepRequirementBars(step: WishlistStepView): StepRequirementBar[] {
  const evaluation = step.evaluation
  const bars: StepRequirementBar[] = []
  const timeGate = evaluation.timeGate

  if (timeGate.effectiveDays !== null && timeGate.effectiveDays > 0) {
    const accountAge = step.scenario ? null : timeGate.accountAgeDays
    bars.push({
      id: "time-on-source",
      label: "Time on source",
      current: accountAge === null ? "?" : `${formatCount(accountAge)} days`,
      required: `${formatCount(timeGate.effectiveDays)} days`,
      currentValue: accountAge,
      requiredValue: timeGate.effectiveDays,
      status:
        timeGate.status === "open"
          ? "met"
          : timeGate.status === "waiting"
            ? "unmet"
            : "unknown",
    })
  }

  for (const condition of flattenRequirementResults(evaluation.eligibility.structured)) {
    if (
      condition.kind !== "numeric" ||
      condition.requiredValue === null ||
      condition.metric === undefined ||
      condition.metric === "accountAgeDays"
    ) {
      continue
    }
    bars.push({
      id: condition.id,
      label: condition.label,
      current: formatBarValue(condition.metric, condition.observedValue),
      required: formatBarValue(condition.metric, condition.requiredValue),
      currentValue: condition.observedValue,
      requiredValue: condition.requiredValue,
      status: condition.status,
    })
  }

  return bars
}

function requirementPercent(bar: StepRequirementBar): number {
  if (bar.currentValue === null || bar.requiredValue <= 0) return 0
  const ratio = Math.min(1, bar.currentValue / bar.requiredValue)
  return bar.status === "unmet" && ratio >= 1 ? 0.98 : ratio
}

function requirementTone(status: RankGoalStatus): string {
  if (status === "unmet") return "bg-danger"
  if (status === "unknown") return "bg-warn"
  return "bg-success"
}

function StepRequirementBars({ step }: { step: WishlistStepView }) {
  const bars = stepRequirementBars(step)
  if (bars.length === 0) return null

  return (
    <div className="flex flex-col gap-2" data-step-requirement-bars>
      <span className="text-2xs uppercase tracking-[0.12em] text-tertiary">
        Requirement bars
      </span>
      {bars.map((bar) => (
        <div key={bar.id} className="flex flex-col gap-1" data-step-requirement-bar={bar.id}>
          <div className="flex items-baseline justify-between gap-2">
            <span className="min-w-0 truncate text-xs text-secondary">{bar.label}</span>
            <span className="flex shrink-0 items-baseline gap-2">
              <span
                className={`font-cond text-2xs font-semibold uppercase tracking-[0.1em] ${
                  bar.status === "met"
                    ? "text-success"
                    : bar.status === "unmet"
                      ? "text-danger"
                      : "text-warn"
                }`}
              >
                {bar.status === "met" ? "Met" : bar.status === "unmet" ? "Unmet" : "Unknown"}
              </span>
              <span className="font-mono text-xs tabular-nums text-tertiary">
                {bar.current} / {bar.required}
              </span>
            </span>
          </div>
          <div className="relative h-1.5 overflow-hidden bg-elevated" aria-hidden="true">
            <span
              className={`block h-full ${requirementTone(bar.status)}`}
              style={{ width: `${Math.round(requirementPercent(bar) * 100)}%` }}
            />
            <span className="absolute inset-y-0 right-0 w-px bg-primary/70" data-threshold-tick />
          </div>
        </div>
      ))}
    </div>
  )
}

function RouteChips({ path }: { path: WishlistPathView }) {
  const first = path.steps[0]
  if (!first) return null
  const names = [first.sourceName, ...path.steps.map((step) => step.destinationName)]
  return (
    <ol className="flex flex-wrap items-center gap-1" aria-label="Route">
      {names.map((name, index) => (
        <li key={`${name}-${index}`} className="flex items-center gap-1">
          <span
            className="rounded-nm-sm border border-border bg-elevated px-2 py-1 font-mono text-xs text-primary"
            data-route-chip
          >
            {name}
          </span>
          {index < names.length - 1 && (
            <span className="font-mono text-xs text-tertiary" aria-hidden="true">
              →
            </span>
          )}
        </li>
      ))}
    </ol>
  )
}

function StepDetails({ step }: { step: WishlistStepView }) {
  const evaluation = step.evaluation
  const notes = evaluation.eligibility.requirementNotes.filter(
    (note) => !NO_REQUIREMENT.test(note.trim())
  )
  const gate = evaluation.eligibility.sourceRequirements.inviteGate
  const structured = flattenRequirementResults(evaluation.eligibility.structured)
  const evidence = evaluation.evidence
  const hasStale = evidence.sourceFreshness === "stale"

  return (
    <details className="mt-2 border-t border-border pt-2">
      <summary className="cursor-pointer font-cond text-2xs font-semibold uppercase tracking-[0.12em] text-secondary">
        Details
      </summary>
      <div className="mt-2 flex flex-col gap-2 text-xs text-secondary">
        <StepRequirementBars step={step} />
        {gate && (
          <div className="flex flex-col gap-0.5">
            <span className="text-2xs uppercase tracking-[0.12em] text-tertiary">
              Full invite text
            </span>
            <p className="break-words">{gate.text}</p>
            {gate.days !== null && (
              <p className="text-2xs text-tertiary">{gate.days} days listed by trackerpathways.</p>
            )}
          </div>
        )}
        {notes.length > 0 && (
          <div className="flex flex-col gap-0.5">
            <span className="text-2xs uppercase tracking-[0.12em] text-tertiary">Source text</span>
            <p className="break-words whitespace-pre-wrap">{notes.join("\n")}</p>
          </div>
        )}
        {structured.length > 0 && (
          <div className="flex flex-col gap-0.5">
            <span className="text-2xs uppercase tracking-[0.12em] text-tertiary">
              Structured requirements
            </span>
            <p className="break-words">
              {structured
                .map((result) => `${result.label}: ${result.status}`)
                .join(" · ")}
            </p>
          </div>
        )}
        <p className="break-words">{step.observationNote}</p>
        <p className="break-words">
          Availability: {evaluation.availability.note}
          {evaluation.availability.raw ? ` Source value: ${evaluation.availability.raw}.` : ""}
        </p>
        <p className="break-words">
          Source updated {evidence.sourceUpdatedRaw ?? "unknown"} · snapshot accessed{" "}
          {dateOnly(evidence.sourceAccessedAt)} · last independent verification{" "}
          {evidence.lastVerifiedAt ? dateOnly(evidence.lastVerifiedAt) : "never"}.
        </p>
        {hasStale && (
          <p className="text-warn">
            The community source update is stale. A recent page visit does not make it verified.
          </p>
        )}
        {evidence.evidenceFreshness === "unknown" && (
          <p>This is community evidence, not a verified active recruiter or invitation.</p>
        )}
      </div>
    </details>
  )
}

function StepRow({ step, index }: { step: WishlistStepView; index: number }) {
  const warn = stepWaitDays(step) === null
  return (
    <li className="border-t border-border pt-3 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-2xs text-tertiary">Step {index + 1}</p>
          <p className="break-words font-cond text-sm font-semibold uppercase tracking-[0.08em] text-primary">
            {step.sourceName} <span className="text-tertiary">→</span>{" "}
            {step.destinationName}
          </p>
          <p className="mt-0.5 break-words text-xs text-secondary">
            Invite class: <span className="text-primary">{inviteClassLabel(step)}</span>
          </p>
        </div>
        <Badge variant={warn ? "warn" : "default"}>{waitLabel(stepWaitDays(step))}</Badge>
      </div>
      <StepDetails step={step} />
    </li>
  )
}

function FastestRoute({ path }: { path: WishlistPathView }) {
  return (
    <Card elevation="raised" className="flex flex-col gap-3" data-best-path>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col items-start gap-2">
          <Badge variant="accent">Best path</Badge>
          <RouteChips path={path} />
          <p className="text-xs text-secondary">
            {path.steps.length === 1 ? "1 step" : `${path.steps.length} steps`}
          </p>
        </div>
        <div className="text-right">
          <p className="font-cond text-2xs font-semibold uppercase tracking-[0.14em] text-secondary">
            Total time left
          </p>
          <p className="font-mono text-sm text-primary">
            {waitLabel(path.totalDaysRemaining)}
          </p>
        </div>
      </div>
      <ol className="flex flex-col gap-3">
        {path.steps.map((step, index) => (
          <StepRow key={step.routeId} step={step} index={index} />
        ))}
      </ol>
    </Card>
  )
}

function OtherRoutes({ paths }: { paths: WishlistPathView[] }) {
  if (paths.length === 0) return null
  return (
    <details className="border-t border-border pt-3">
      <summary className="cursor-pointer font-cond text-xs font-semibold uppercase tracking-[0.12em] text-secondary">
        Other routes ({paths.length})
      </summary>
      <ul className="mt-2 flex flex-col gap-2">
        {paths.slice(0, 5).map((path) => (
          <li
            key={path.key}
            className="flex flex-wrap items-baseline justify-between gap-2 border-t border-border pt-2 text-xs first:border-t-0 first:pt-0"
          >
            <span className="min-w-0 break-words text-secondary">{routeChain(path)}</span>
            <span className="font-mono text-2xs text-tertiary">
              {waitLabel(path.totalDaysRemaining)} · {path.steps.length}{" "}
              {path.steps.length === 1 ? "step" : "steps"}
            </span>
          </li>
        ))}
      </ul>
    </details>
  )
}

interface PickerOption {
  id: string
  name: string
}

function TrackerPicker({
  value,
  options,
  onChoose,
}: {
  value: string | null
  options: PickerOption[]
  onChoose: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const ref = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const selected = value
    ? (PATHWAYS_TRACKERS.find((option) => option.id === value)?.name ??
      pathwaysTrackerName(value))
    : null
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return options
    return options.filter((option) => option.name.toLowerCase().includes(needle))
  }, [options, query])

  useClickOutside(ref, () => setOpen(false), open)

  function choose(id: string) {
    onChoose(id)
    setOpen(false)
    setQuery("")
  }

  return (
    <div ref={ref} className="relative max-w-xl">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full cursor-pointer items-center justify-between gap-2 border-0 bg-control-bg px-3 py-2 text-sm text-primary nm-inset rounded-nm-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-control-focus)] focus-visible:ring-offset-1 focus-visible:ring-offset-base"
        aria-label="Choose a tracker"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={panelId}
      >
        <span className="truncate">{selected ?? "Choose a tracker"}</span>
        <span className="shrink-0 text-tertiary" aria-hidden="true">
          <ChevronDownSmallIcon width="10" height="7" />
        </span>
      </button>

      {open && (
        <div
          id={panelId}
          className="absolute top-full right-0 left-0 z-40 mt-1 bg-overlay nm-float-sm p-2 rounded-nm-md"
        >
          <Input
            autoFocus
            type="search"
            role="combobox"
            aria-expanded={true}
            aria-controls={panelId}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setOpen(false)
              if (event.key === "Enter" && filtered[0]) {
                event.preventDefault()
                choose(filtered[0].id)
              }
            }}
            placeholder="Search trackerpathways"
            aria-label="Search trackerpathways"
          />
          <div
            role="listbox"
            aria-label="Trackerpathways trackers"
            className="mt-2 max-h-72 overflow-y-auto themed-scrollbar"
          >
            {filtered.length === 0 ? (
              <p className="px-2 py-3 text-xs text-tertiary">No trackers match.</p>
            ) : (
              filtered.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="option"
                  aria-selected={option.id === value}
                  onClick={() => choose(option.id)}
                  className={`w-full cursor-pointer px-2 py-1.5 text-left font-mono text-xs ${
                    option.id === value
                      ? "bg-accent-dim text-accent"
                      : "text-secondary hover:bg-elevated hover:text-primary"
                  }`}
                >
                  {option.name}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

interface OwnedRow {
  tracker: TrackerSummary
  pathwayId: string | null
  userClass: string
  age: string
  directCount: number
}

export function TrackerPathwaysClient({
  trackers,
  initialState,
  catalog = RECRUITMENT_CATALOG,
}: TrackerPathwaysClientProps) {
  const [state, setState] = useState(initialState)
  const [targets, setTargets] = useState<string[]>(() =>
    initialState.desiredTrackerSlug ? [initialState.desiredTrackerSlug] : []
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [now] = useState(() => new Date())

  const result = useMemo(
    () =>
      buildWishlistPaths({
        catalog,
        desiredTrackerSlug: state.desiredTrackerSlug,
        trackers,
        savedRankGoals: {},
        state,
        now,
      }),
    [catalog, now, state, trackers]
  )

  const ownedIds = useMemo(() => new Set(result.ownedSlugs), [result.ownedSlugs])
  const directDestinations = useMemo(() => {
    const counts = new Map<string, Set<string>>()
    for (const route of catalog.routes) {
      const destinations = counts.get(route.sourceTrackerId) ?? new Set<string>()
      destinations.add(route.destinationTrackerId)
      counts.set(route.sourceTrackerId, destinations)
    }
    return counts
  }, [catalog])

  const ownedRows = useMemo<OwnedRow[]>(
    () =>
      trackers.map((tracker) => {
        const pathwayId = tracker.registrySlug
          ? pathwaysTrackerIdForRegistrySlug(tracker.registrySlug)
          : null
        return {
          tracker,
          pathwayId,
          userClass: tracker.latestStats?.group?.trim() || "Unknown",
          age: formatAccountAge(tracker.joinedAt) ?? "Unknown",
          directCount: pathwayId ? (directDestinations.get(pathwayId)?.size ?? 0) : 0,
        }
      }),
    [directDestinations, trackers]
  )

  const pickerOptions = useMemo<PickerOption[]>(
    () =>
      PATHWAYS_TRACKERS.filter((tracker) => !ownedIds.has(tracker.id)).map((tracker) => ({
        id: tracker.id,
        name: tracker.name,
      })),
    [ownedIds]
  )

  const activeTarget = state.desiredTrackerSlug
  const activeTargetName = activeTarget ? pathwaysTrackerName(activeTarget) : null
  const activeTargetOwned = activeTarget ? ownedIds.has(activeTarget) : false
  const fastest = result.paths[0] ?? null
  const otherPaths = result.paths.slice(1)
  const chips = targets.filter((target) => target !== activeTarget)

  async function persistTarget(nextTarget: string): Promise<boolean> {
    const previous = state
    const next = { ...state, desiredTrackerSlug: nextTarget }
    setState(next)
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/recruitment/wishlist", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: next }),
      })
      if (!res.ok) throw new Error("Tracker pathways could not be saved")
      const data = (await res.json()) as { state?: unknown }
      if (data.state) setState(normalizeRecruitmentState(data.state))
      return true
    } catch (err) {
      setState(previous)
      setError(err instanceof Error ? err.message : "Tracker pathways could not be saved")
      return false
    } finally {
      setSaving(false)
    }
  }

  async function chooseTarget(nextTarget: string) {
    if (!nextTarget || nextTarget === activeTarget) return
    const previousTargets = targets
    if (!targets.includes(nextTarget)) setTargets([...targets, nextTarget])
    const saved = await persistTarget(nextTarget)
    if (!saved) setTargets(previousTargets)
  }

  return (
    <div className="flex flex-col gap-10 pb-24" data-pathways-page>
      <div className="flex flex-col gap-1">
        <H1>Tracker pathways</H1>
        <Paragraph className="max-w-3xl">
          See where your accounts can take you. Routes come from a pinned trackerpathways
          community snapshot; they are not applications and do not prove a recruiter is active.
        </Paragraph>
      </div>

      <section className="flex flex-col gap-3" aria-labelledby="your-trackers-heading">
        <div className="flex flex-col gap-1">
          <H2 id="your-trackers-heading">Your trackers</H2>
          <Paragraph>Current class, account age and direct trackerpathways routes.</Paragraph>
        </div>
        <Card elevation="raised">
          {ownedRows.length === 0 ? (
            <p className="text-sm text-secondary">No trackers yet.</p>
          ) : (
            <ul className="flex flex-col">
              {ownedRows.map((row) => (
                <li
                  key={row.tracker.id}
                  data-owned-tracker={row.tracker.id}
                  className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-border py-2.5 first:border-t-0 first:pt-0 last:pb-0"
                >
                  <span className="min-w-0 break-words font-cond text-sm font-semibold uppercase tracking-[0.06em] text-primary">
                    {row.tracker.name}
                  </span>
                  {row.pathwayId === null ? (
                    <span className="text-xs text-tertiary">Not in trackerpathways data</span>
                  ) : (
                    <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-secondary">
                      <span>{row.userClass}</span>
                      <span>{row.age}</span>
                      <span>
                        {row.directCount} direct{" "}
                        {row.directCount === 1 ? "lead" : "leads"}
                      </span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="get-to-tracker-heading">
        <div className="flex flex-col gap-1">
          <H2 id="get-to-tracker-heading">Get to a tracker</H2>
          <Paragraph>Search trackers you are not on and open their fastest known route.</Paragraph>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <TrackerPicker value={activeTarget} options={pickerOptions} onChoose={chooseTarget} />
          {saving && <span className="text-2xs text-tertiary">Saving…</span>}
        </div>

        {chips.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-2xs uppercase tracking-[0.12em] text-tertiary">
              Other targets
            </span>
            {chips.map((target) => (
              <Button
                key={target}
                size="sm"
                variant="secondary"
                text={pathwaysTrackerName(target)}
                onClick={() => chooseTarget(target)}
              />
            ))}
          </div>
        )}

        <p className="text-xs text-secondary">
          <a
            href={TRACKERPATHWAYS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline underline-offset-2"
          >
            Tracker missing? It isn&apos;t in the trackerpathways data yet.
          </a>
        </p>

        <Notice message={error} />

        {activeTarget && activeTargetOwned ? (
          <Notice
            variant="info"
            box
            header={`You already track ${activeTargetName}`}
            message="Choose a tracker you are not on to see a route."
          />
        ) : !activeTarget ? (
          <p className="text-sm text-secondary">Choose a tracker to see the fastest route.</p>
        ) : fastest ? (
          <div className="flex flex-col gap-3">
            <FastestRoute path={fastest} />
            <OtherRoutes paths={otherPaths} />
          </div>
        ) : (
          <p className="text-sm text-secondary">No known route from your trackers.</p>
        )}
      </section>

      <Subtext className="text-2xs">
        Source: {catalog.source.attribution}{" "}
        <a
          className="text-accent underline underline-offset-2"
          href={catalog.source.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {catalog.source.name}
        </a>{" "}
        · {catalog.source.license} · accessed {dateOnly(catalog.source.accessedAt)}.
      </Subtext>
    </div>
  )
}
