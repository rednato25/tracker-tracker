// src/components/recruitment/TrackerPathwaysClient.tsx

"use client"

import { H1, H2, H3, Paragraph, Subtext } from "@typography"
import { useId, useMemo, useRef, useState } from "react"
import { Badge, Button, Card, Input, Notice } from "@/components/ui"
import { ChevronDownSmallIcon } from "@/components/ui/Icons"
import { PATHWAYS_TRACKERS, pathwaysTrackerName } from "@/data/pathways/catalog"
import { RECRUITMENT_CATALOG } from "@/data/recruitment-catalog"
import { useClickOutside } from "@/hooks/useClickOutside"
import { formatAccountAge, formatDate } from "@/lib/formatters"
import {
  buildOwnedTrackerCards,
  buildTrackerProfile,
  type NoRouteView,
  type OwnedTrackerCardView,
  type ProfileRouteView,
  type ReachableSourceView,
  type TrackerProfileView,
} from "@/lib/recruitment-pathways"
import type { RecruitmentCatalog } from "@/lib/recruitment-routes"
import {
  normalizeRecruitmentState,
  type RecruitmentState,
} from "@/lib/recruitment-state"
import {
  buildWishlistPaths,
  pathWaitLabel,
  stepHasUncheckedRequirements,
  stepRequirementText,
  stepWaitLabel,
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

const TRACKERPATHWAYS_URL = "https://github.com/handokota/trackerpathways"
const DESTINATION_LIMIT = 6

function dateOnly(value: string | null): string {
  return value ? formatDate(value) : "unknown"
}

function routeChain(path: WishlistPathView): string {
  const first = path.steps[0]
  if (!first) return ""
  return [first.sourceName, ...path.steps.map((step) => step.destinationName)].join(" → ")
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

function stepSentence(step: WishlistStepView): string {
  const route = `From ${step.sourceName} to ${step.destinationName}`
  const requirement = stepRequirementText(step)
  const timeGate = step.evaluation.timeGate

  if (timeGate.status === "waiting") {
    const days = timeGate.daysRemaining
    const left = days === null ? "Wait unknown" : `${days} day${days === 1 ? "" : "s"} left`
    if (requirement) return `${route} · needs ${requirement} · ${left}`
    return stepHasUncheckedRequirements(step)
      ? `${route} · ${left} · needs checking`
      : `${route} · ${left}`
  }

  return `${route} · ${stepWaitLabel(step)}`
}

function StepDetails({ step }: { step: WishlistStepView }) {
  const evidence = step.evaluation.evidence
  const lastVerified = evidence.lastVerifiedAt ? formatDate(evidence.lastVerifiedAt) : "never"

  return (
    <details className="mt-2 border-t border-border pt-2">
      <summary className="cursor-pointer font-cond text-2xs font-semibold uppercase tracking-[0.12em] text-secondary">
        Details
      </summary>
      <p className="mt-2 text-xs text-secondary">
        Source updated {evidence.sourceUpdatedRaw ?? "unknown"} · last verified {lastVerified}
      </p>
    </details>
  )
}

function StepRow({ step }: { step: WishlistStepView }) {
  return (
    <li className="border-t border-border pt-2 first:border-t-0 first:pt-0">
      <p className="break-words text-xs text-secondary">{stepSentence(step)}</p>
      <StepDetails step={step} />
    </li>
  )
}

function FastestRoute({ path }: { path: WishlistPathView }) {
  return (
    <Card elevation="raised" className="flex flex-col gap-3 border-t-2 border-t-accent" data-best-path>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col items-start gap-2">
          <Badge variant="accent">Best path</Badge>
          <RouteChips path={path} />
          <p className="text-xs text-secondary">
            {path.steps.length === 1 ? "1 step" : `${path.steps.length} steps`}
          </p>
        </div>
        <div className="w-full text-left sm:w-auto sm:text-right" data-pathway-time>
          <p className="font-cond text-2xs font-semibold uppercase tracking-[0.14em] text-secondary">
            Total time left
          </p>
          <p className="font-mono text-sm text-primary">{pathWaitLabel(path)}</p>
        </div>
      </div>
      <ol className="flex flex-col gap-3">
        {path.steps.map((step) => (
          <StepRow key={step.routeId} step={step} />
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
              {pathWaitLabel(path)} · {path.steps.length}{" "}
              {path.steps.length === 1 ? "step" : "steps"}
            </span>
          </li>
        ))}
      </ul>
    </details>
  )
}

function inviteTimingLabel(card: OwnedTrackerCardView) {
  if (card.invitesOpen) {
    return <span className="text-success">Invites open now</span>
  }
  if (card.inviteDaysRemaining === null) {
    return <span className="text-tertiary">Invite timing unknown</span>
  }
  return (
    <span className="text-warn">
      Invites open in <span className="font-mono">{card.inviteDaysRemaining}</span>{" "}
      {card.inviteDaysRemaining === 1 ? "day" : "days"}
    </span>
  )
}

function OwnedTrackerCard({ card }: { card: OwnedTrackerCardView }) {
  const [expanded, setExpanded] = useState(false)
  const destinations = expanded ? card.destinations : card.destinations.slice(0, DESTINATION_LIMIT)
  const moreCount = Math.max(0, card.destinations.length - DESTINATION_LIMIT)
  const tracker = card.sourceTracker
  const accountAge = formatAccountAge(tracker.joinedAt) ?? "Unknown"

  return (
    <article
      data-owned-card={card.sourceTrackerId}
      className="flex min-w-0 flex-col gap-3 border border-border border-t-2 bg-raised p-4"
      style={{ borderTopColor: tracker.color }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words font-cond text-sm font-semibold tracking-[-0.01em] text-primary">
            {card.sourceName}
          </p>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs text-secondary">
            <span>{tracker.latestStats?.group ?? "Unknown class"}</span>
            <span className="text-tertiary">·</span>
            <span>{accountAge}</span>
          </p>
        </div>
        <p
          className="shrink-0 text-right text-xs"
          data-invite-timing
          data-invites-open={card.invitesOpen}
        >
          {inviteTimingLabel(card)}
        </p>
      </div>

      {card.destinations.length === 0 ? (
        <p className="border-t border-border pt-3 text-xs text-secondary">
          No destinations listed in the data.
        </p>
      ) : (
        <>
          <ul className="flex flex-col border-t border-border">
            {destinations.map((destination) => (
              <li
                key={destination.routeId}
                data-destination-row={destination.destinationTrackerId}
                data-closed={destination.closed ? "true" : undefined}
                className="flex items-baseline justify-between gap-3 border-b border-border/60 py-1.5 last:border-b-0"
              >
                <span
                  className={`min-w-0 break-words text-xs ${
                    destination.closed ? "text-tertiary" : "text-primary"
                  }`}
                >
                  {destination.destinationName}
                </span>
                <span
                  className={`line-clamp-2 max-w-[58%] text-right text-xs ${
                    destination.closed ? "text-tertiary" : "text-secondary"
                  }`}
                  title={destination.requirementText ?? undefined}
                >
                  {destination.closed && (
                    <span className="mr-1 font-cond text-2xs font-semibold uppercase tracking-[0.1em]">
                      Closed
                    </span>
                  )}
                  {destination.requirementText ?? "No requirement text"}
                </span>
              </li>
            ))}
          </ul>
          {moreCount > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((current) => !current)}
              aria-expanded={expanded}
              className="min-h-11 self-start text-xs text-accent underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-focus)] focus-visible:ring-offset-1"
            >
              {expanded ? "Show less" : `+${moreCount} more`}
            </button>
          )}
        </>
      )}
    </article>
  )
}

function ProfileRouteList({
  routes,
  direction,
  empty,
}: {
  routes: ProfileRouteView[]
  direction: "incoming" | "outgoing"
  empty: string
}) {
  if (routes.length === 0) {
    return <p className="mt-2 text-xs text-secondary">{empty}</p>
  }

  return (
    <ul className="mt-2 flex flex-col" data-profile-route-list={direction}>
      {routes.map((route) => (
        <li
          key={route.routeId}
          data-profile-route={route.routeId}
          data-closed={route.closed ? "true" : undefined}
          className="flex flex-col gap-1 border-t border-border py-1.5 first:border-t-0 first:pt-0"
        >
          <div className="flex items-baseline justify-between gap-3">
            <span
              className={`min-w-0 break-words text-xs ${
                route.closed ? "text-tertiary" : "text-primary"
              }`}
            >
              {route.trackerName}
            </span>
            <span className="shrink-0 font-mono text-2xs text-tertiary">
              {route.days === null ? "No wait" : `${route.days} days`}
              {route.closed ? " · Closed" : ""}
            </span>
          </div>
          <p
            className={`break-words text-xs ${
              route.closed ? "text-tertiary" : "text-secondary"
            }`}
          >
            {route.requirementText ?? "No requirement text"}
          </p>
        </li>
      ))}
    </ul>
  )
}

function TargetProfile({ profile }: { profile: TrackerProfileView }) {
  const badgeVariant =
    profile.recruitingStatus === "open"
      ? "success"
      : profile.recruitingStatus === "closed"
        ? "danger"
        : profile.recruitingStatus === "unknown"
          ? "warn"
          : "default"

  return (
    <Card
      elevation="raised"
      className="flex flex-col gap-4 border-t-2 border-t-border-strong"
      data-target-profile={profile.targetTrackerId}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <H3>{profile.targetName}</H3>
          <div className="flex flex-col gap-1">
            <span className="font-cond text-2xs font-semibold uppercase tracking-[0.1em] text-tertiary">
              Invite class
            </span>
            <p className="break-words text-sm text-primary">
              {profile.gateText ?? "No invite class listed in the data."}
            </p>
            {profile.gateDays !== null && (
              <p className="text-xs text-secondary">
                <span className="font-mono">{profile.gateDays} days</span> on the tracker
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={badgeVariant}>{profile.recruitingLabel}</Badge>
          <span className="font-mono text-2xs text-tertiary">
            Checked {profile.checkedRaw ?? "no date in the data"}
          </span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section data-invited-from>
          <div className="flex items-baseline justify-between gap-2">
            <h4 className="font-cond text-2xs font-semibold uppercase tracking-[0.12em] text-secondary">
              Invited from
            </h4>
            {profile.invitedFrom.length > 0 && (
              <span className="font-mono text-2xs text-tertiary">
                {profile.invitedOpenCount} open · {profile.invitedClosedCount} closed
              </span>
            )}
          </div>
          <ProfileRouteList
            routes={profile.invitedFrom}
            direction="incoming"
            empty="No invite routes in the data."
          />
        </section>

        <section data-can-invite-to>
          <div className="flex items-baseline justify-between gap-2">
            <h4 className="font-cond text-2xs font-semibold uppercase tracking-[0.12em] text-secondary">
              Can invite to
            </h4>
            {profile.canInviteTo.length > 0 && (
              <span className="font-mono text-2xs text-tertiary">
                {profile.canInviteTo.length} destinations
              </span>
            )}
          </div>
          <ProfileRouteList
            routes={profile.canInviteTo}
            direction="outgoing"
            empty="No outgoing invite routes in the data."
          />
        </section>
      </div>
    </Card>
  )
}

function NoRouteBlock({ noRoute }: { noRoute: NoRouteView }) {
  return (
    <Card elevation="raised" className="flex flex-col gap-3" data-no-route>
      <H3>No route from your trackers</H3>
      <Paragraph>{noRoute.message}</Paragraph>
      {noRoute.sources.length > 0 && (
        <ul className="flex flex-col gap-2">
          {noRoute.sources.map((source) => (
            <NoRouteSource key={source.sourceTrackerId} source={source} />
          ))}
        </ul>
      )}
    </Card>
  )
}

function NoRouteSource({ source }: { source: ReachableSourceView }) {
  return (
    <li
      data-no-route-source={source.sourceTrackerId}
      className="flex flex-col gap-1 border-t border-border pt-2 first:border-t-0 first:pt-0"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm text-primary">{source.sourceName}</span>
        <Badge variant={source.reachable ? "success" : "default"}>
          {source.reachable ? "Can reach" : "Can't reach"}
        </Badge>
      </div>
      {source.requirementText && (
        <p className="break-words text-xs text-secondary">{source.requirementText}</p>
      )}
      {source.owned ? (
        <p className="text-xs text-secondary">You are on this tracker.</p>
      ) : source.path ? (
        <p className="break-words font-mono text-xs text-secondary">
          {routeChain(source.path)} · {pathWaitLabel(source.path)}
        </p>
      ) : (
        <p className="text-xs text-secondary">No path from your trackers.</p>
      )}
    </li>
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
    <div ref={ref} className="relative w-full sm:w-96" data-pathway-picker>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-nm-md border border-border bg-elevated px-3 py-2 text-sm text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-focus)] focus-visible:ring-offset-1"
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
          className="absolute top-full right-0 left-0 z-40 mt-1 rounded-nm-md border border-border bg-overlay p-2"
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
            className="themed-scrollbar mt-2 max-h-72 overflow-y-auto"
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
                  className={`min-h-11 w-full cursor-pointer px-2 py-1.5 text-left font-mono text-xs ${
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
  const ownedCards = useMemo(
    () => buildOwnedTrackerCards({ catalog, trackers, now }),
    [catalog, now, trackers]
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
  const chips = targets.filter((target) => target !== activeTarget)

  const profile = useMemo(
    () =>
      activeTarget
        ? buildTrackerProfile({
            catalog,
            targetTrackerId: activeTarget,
            trackers,
            savedRankGoals: {},
            state,
            now,
          })
        : null,
    [activeTarget, catalog, now, state, trackers]
  )

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
    <div className="flex flex-col gap-6 pb-12" data-pathways-page data-page-frame>
      <div className="flex flex-col gap-3">
        <div className="flex min-h-12 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border py-1.5">
          <H1>Tracker pathways</H1>
        </div>
        <Paragraph className="max-w-3xl">
          See where your accounts can take you. Routes come from a pinned trackerpathways
          community snapshot; they are not applications and do not prove a recruiter is active.
        </Paragraph>
      </div>

      <section className="flex flex-col gap-3" aria-labelledby="where-your-trackers-heading">
        <div className="flex flex-col gap-1">
          <H2 id="where-your-trackers-heading">Where your trackers can take you</H2>
          <Paragraph>
            One card per account you are on, with the destinations it can invite to. Soonest
            invites come first.
          </Paragraph>
        </div>

        {ownedCards.cards.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {ownedCards.cards.map((card) => (
              <OwnedTrackerCard key={card.sourceTrackerId} card={card} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-secondary">
            {trackers.length === 0
              ? "Add a tracker to see where it can take you."
              : "No invite routes from your trackers in the data yet."}
          </p>
        )}

        {ownedCards.unsupportedOwnedTrackers.length > 0 && (
          <p className="text-xs text-tertiary">
            Not in trackerpathways data:{" "}
            {ownedCards.unsupportedOwnedTrackers.map((tracker) => tracker.name).join(", ")}.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="get-to-tracker-heading">
        <div className="flex flex-col gap-1">
          <H2 id="get-to-tracker-heading">Get to a tracker</H2>
          <Paragraph>
            Pick a target to see its invite class, who leads there, and where it can take you.
          </Paragraph>
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
          <p className="text-sm text-secondary">Choose a tracker to see its profile and route.</p>
        ) : profile ? (
          <div className="flex flex-col gap-4">
            {profile.fastest && <FastestRoute path={profile.fastest} />}
            {profile.noRoute && <NoRouteBlock noRoute={profile.noRoute} />}
            <TargetProfile profile={profile} />
            {profile.otherPaths.length > 0 && <OtherRoutes paths={profile.otherPaths} />}
          </div>
        ) : null}
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
