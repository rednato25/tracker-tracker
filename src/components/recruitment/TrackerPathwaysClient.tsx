// src/components/recruitment/TrackerPathwaysClient.tsx

"use client"

import { H1, H2, H3, Paragraph, Subtext } from "@typography"
import { useId, useMemo, useRef, useState } from "react"
import { Badge, Button, Card, Input, Notice, Select } from "@/components/ui"
import { PinIcon, XIcon } from "@/components/ui/Icons"
import { Tooltip } from "@/components/ui/Tooltip"
import { ChevronDownSmallIcon } from "@/components/ui/Icons"
import { PATHWAYS_TRACKERS, pathwaysTrackerName } from "@/data/pathways/catalog"
import { RECRUITMENT_CATALOG } from "@/data/recruitment-catalog"
import { useClickOutside } from "@/hooks/useClickOutside"
import { formatAccountAge, formatDate } from "@/lib/formatters"
import type { ClassGateComparison } from "@/lib/rank-class-gate"
import {
  buildOwnedTrackerCards,
  buildRouteChoices,
  buildTrackerProfile,
  type NoRouteView,
  type OwnedTrackerCardView,
  type PathwayRouteChoiceView,
  type PathwayRouteSort,
  type ProfileRouteView,
  type ReachableSourceView,
  type TrackerProfileView,
} from "@/lib/recruitment-pathways"
import type { RecruitmentCatalog } from "@/lib/recruitment-routes"
import {
  buildPinnedRouteTrees,
  type PinnedRoutePathInput,
  type PinnedRouteTreeView,
  type PinnedTreeNodeView,
} from "@/lib/recruitment-pinned-tree"
import {
  normalizeRecruitmentState,
  type RecruitmentState,
} from "@/lib/recruitment-state"
import {
  buildWishlistPaths,
  hopWaitDays,
  pathWaitLabel,
  pathWaitValue,
  type WishlistPathView,
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

function ClassGateBadge({ gate }: { gate: ClassGateComparison }) {
  const label = `${gate.status === "met" ? "Met" : gate.status === "not-yet" ? "Not yet" : "Class unknown"}: ${gate.written.join(" or ")}`
  return (
    <span
      data-class-gate={gate.status}
      title={gate.detail}
      className={
        gate.status === "met"
          ? "text-2xs font-cond font-semibold uppercase tracking-[0.08em] text-success"
          : gate.status === "not-yet"
            ? "text-2xs font-cond font-semibold uppercase tracking-[0.08em] text-warn"
            : "text-2xs font-cond font-semibold uppercase tracking-[0.08em] text-tertiary"
      }
    >
      {label}
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
                <div className="flex max-w-[58%] flex-col items-end gap-0.5 text-right">
                  <span
                    className={`line-clamp-2 text-xs ${
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
                  {destination.classGate && <ClassGateBadge gate={destination.classGate} />}
                </div>
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

function RouteControls({
  sort,
  maxHops,
  startFrom,
  ownedOptions,
  onSort,
  onMaxHops,
  onStartFrom,
}: {
  sort: PathwayRouteSort
  maxHops: number
  startFrom: string | null
  ownedOptions: { id: string; name: string }[]
  onSort: (sort: PathwayRouteSort) => void
  onMaxHops: (hops: number) => void
  onStartFrom: (tracker: string | null) => void
}) {
  return (
    <div
      data-route-controls
      className="flex flex-col gap-3 border border-border bg-raised p-3 sm:flex-row sm:flex-wrap sm:items-end"
    >
      <div className="flex flex-col gap-1">
        <span className="font-cond text-2xs font-semibold uppercase tracking-[0.12em] text-tertiary">
          Sort
        </span>
        <div className="flex flex-wrap gap-1">
          <Button
            size="sm"
            variant={sort === "fastest" ? "primary" : "secondary"}
            aria-pressed={sort === "fastest"}
            text="Fastest"
            onClick={() => onSort("fastest")}
          />
          <Button
            size="sm"
            variant={sort === "fewest-hops" ? "primary" : "secondary"}
            aria-pressed={sort === "fewest-hops"}
            text="Fewest hops"
            onClick={() => onSort("fewest-hops")}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="font-cond text-2xs font-semibold uppercase tracking-[0.12em] text-tertiary">
          Max hops
        </span>
        <div className="flex gap-1">
          {[1, 2, 3].map((hops) => (
            <Button
              key={hops}
              size="sm"
              variant={maxHops === hops ? "primary" : "secondary"}
              aria-pressed={maxHops === hops}
              text={String(hops)}
              onClick={() => onMaxHops(hops)}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="font-cond text-2xs font-semibold uppercase tracking-[0.12em] text-tertiary">
          Start from
        </span>
        <Select
          value={startFrom ?? "all"}
          options={[
            { value: "all", label: "All my trackers" },
            ...ownedOptions.map((option) => ({ value: option.id, label: option.name })),
          ]}
          onChange={(value) => onStartFrom(value === "all" ? null : value)}
          ariaLabel="Start from"
          className="w-48 max-w-full"
        />
      </div>
    </div>
  )
}

function RouteChoiceRow({
  choice,
  onTogglePin,
}: {
  choice: PathwayRouteChoiceView
  onTogglePin: (key: string) => void
}) {
  return (
    <li
      data-route-choice={choice.path.key}
      data-pinned={choice.pinned}
      data-fastest={choice.fastest}
      data-needs-checking={choice.needsChecking}
      className="flex flex-col gap-2 border-t border-border pt-3 first:border-t-0 first:pt-0"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {choice.pinned && <Badge variant="accent">Pinned</Badge>}
            {choice.fastest && <Badge variant="success">Fastest</Badge>}
          </div>
          <RouteChips path={choice.path} />
        </div>
        <Button
          size="sm"
          variant={choice.pinned ? "primary" : "secondary"}
          aria-pressed={choice.pinned}
          className="min-h-11"
          text={choice.pinned ? "Unpin" : "Pin"}
          onClick={() => onTogglePin(choice.path.key)}
        />
      </div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-2xs">
        <span className="text-tertiary">
          {choice.hops} {choice.hops === 1 ? "hop" : "hops"}
        </span>
        <span className="text-secondary">{choice.waitLabel}</span>
        <span className={choice.needsChecking ? "text-warn" : "text-success"}>
          {choice.needsChecking ? "Needs checking" : "No checks pending"}
        </span>
      </div>
      {choice.classGate && <ClassGateBadge gate={choice.classGate} />}
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

function pinnedWaitLabel(days: number | null): string {
  if (days === null) return "Wait unknown"
  if (days === 0) return "Ready now"
  return `${days} day${days === 1 ? "" : "s"} left`
}

function nextStepWaitPhrase(days: number | null): string {
  if (days === null) return "in an unknown time"
  if (days === 0) return "ready now"
  return `in ${days} day${days === 1 ? "" : "s"}`
}

interface PinnedTreeActions {
  onUnpin: (targetId: string) => void
  onOpen: (targetId: string) => void
}

function UnpinRouteButton({
  targetId,
  targetName,
  onUnpin,
}: {
  targetId: string
  targetName: string
  onUnpin: (targetId: string) => void
}) {
  return (
    <Tooltip content={`Unpin route to ${targetName}`}>
      <span className="shrink-0 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
        <Button
          size="icon"
          variant="ghost"
          aria-label={`Unpin route to ${targetName}`}
          onClick={() => onUnpin(targetId)}
          leftIcon={<XIcon className="h-3.5 w-3.5" aria-hidden="true" />}
        />
      </span>
    </Tooltip>
  )
}

function PinnedMarker() {
  return (
    <span
      className="inline-flex shrink-0 items-center text-accent"
      role="img"
      aria-label="Pinned target"
      data-pin-marker
    >
      <PinIcon className="h-3.5 w-3.5" />
    </span>
  )
}

function PinnedTreeBranch({
  node,
  actions,
}: {
  node: PinnedTreeNodeView
  actions: PinnedTreeActions
}) {
  const targetName = node.pinnedTargetId ? pathwaysTrackerName(node.pinnedTargetId) : null

  return (
    <li
      className="min-w-0"
      data-tree-node={node.trackerId}
      data-pinned-route={node.pinnedTargetId ?? undefined}
    >
      <div className="group flex min-w-0 items-start gap-2 py-1.5">
        <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-0.5">
          {node.pinnedTargetId && targetName ? (
            <button
              type="button"
              onClick={() => actions.onOpen(node.pinnedTargetId ?? "")}
              aria-label={`Open ${targetName}`}
              className="min-w-0 break-words text-left text-sm text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-focus)] focus-visible:ring-offset-1"
            >
              {targetName}
            </button>
          ) : (
            <span className="min-w-0 break-words text-sm text-primary">
              {pathwaysTrackerName(node.trackerId)}
            </span>
          )}
          {targetName && <PinnedMarker />}
          <span
            className="shrink-0 font-mono text-xs text-secondary"
            data-node-wait
            data-pinned-route-summary={node.pinnedTargetId ? "" : undefined}
          >
            {pinnedWaitLabel(node.totalDays)}
          </span>
          {node.unlocks > 1 && (
            <span className="text-2xs text-tertiary" data-unlock-count>
              unlocks {node.unlocks} of your targets
            </span>
          )}
        </div>
        {node.pinnedTargetId && targetName && (
          <UnpinRouteButton
            targetId={node.pinnedTargetId}
            targetName={targetName}
            onUnpin={actions.onUnpin}
          />
        )}
      </div>
      {node.children.length > 0 && (
        <ul className="ml-1.5 flex min-w-0 flex-col border-l border-border pl-2 sm:ml-3 sm:pl-4">
          {node.children.map((child) => (
            <PinnedTreeBranch key={child.trackerId} node={child} actions={actions} />
          ))}
        </ul>
      )}
    </li>
  )
}

function PinnedTree({
  tree,
  actions,
}: {
  tree: PinnedRouteTreeView
  actions: PinnedTreeActions
}) {
  return (
    <div
      className="min-w-0 border border-border bg-raised p-3 sm:p-4"
      data-pinned-tree={tree.sourceTrackerId}
    >
      <H3>From {pathwaysTrackerName(tree.sourceTrackerId)}</H3>
      {tree.root.children.length > 0 && (
        <ul className="mt-2 flex min-w-0 flex-col">
          {tree.root.children.map((child) => (
            <PinnedTreeBranch key={child.trackerId} node={child} actions={actions} />
          ))}
        </ul>
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
  const [targets, setTargets] = useState<string[]>(() => {
    const initial = initialState.desiredTrackerSlug ? [initialState.desiredTrackerSlug] : []
    for (const target of Object.keys(initialState.pinnedRoutes)) {
      if (!initial.includes(target)) initial.push(target)
    }
    return initial
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [now] = useState(() => new Date())
  const [sort, setSort] = useState<PathwayRouteSort>("fastest")
  const [maxHops, setMaxHops] = useState(3)
  const [startFrom, setStartFrom] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

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
            maxHops: 3,
          })
        : null,
    [activeTarget, catalog, now, state, trackers]
  )

  const routeChoices = useMemo(
    () =>
      profile
        ? buildRouteChoices({
            paths: profile.paths,
            sort,
            maxHops,
            startFrom,
            pinnedKey: activeTarget ? (state.pinnedRoutes[activeTarget] ?? null) : null,
          })
        : null,
    [activeTarget, maxHops, profile, sort, startFrom, state.pinnedRoutes]
  )

  const ownedOptions = useMemo(
    () =>
      [...ownedIds]
        .map((id) => ({ id, name: pathwaysTrackerName(id) }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [ownedIds]
  )

  const chipLabels = useMemo(() => {
    const labels: Record<string, string> = {}
    for (const target of targets) {
      if (target === activeTarget) continue
      const name = pathwaysTrackerName(target)
      const pinnedKey = state.pinnedRoutes[target]
      if (!pinnedKey) {
        labels[target] = name
        continue
      }
      const result = buildWishlistPaths({
        catalog,
        desiredTrackerSlug: target,
        trackers,
        savedRankGoals: {},
        state,
        now,
        maxHops: 3,
        maxPathsPerSource: 200,
        maxTotal: 500,
      })
      const pinned = result.paths.find((path) => path.key === pinnedKey)
      labels[target] = pinned
        ? `${name} · ${pinned.routeIds.length} ${pinned.routeIds.length === 1 ? "hop" : "hops"} · ${pathWaitValue(pinned)}`
        : name
    }
    return labels
  }, [activeTarget, catalog, now, state, targets, trackers])

  // Every target keeps its own pin. This list reads them all, including targets
  // that are not the active one, so switching targets never hides a pin.
  const myPinnedRoutes = useMemo(() => {
    return Object.entries(state.pinnedRoutes)
      .map(([targetId, key]) => {
        const result = buildWishlistPaths({
          catalog,
          desiredTrackerSlug: targetId,
          trackers,
          savedRankGoals: {},
          state: { ...state, hiddenPathKeys: [] },
          now,
          maxHops: 3,
          maxPathsPerSource: 200,
          maxTotal: 500,
        })
        return {
          targetId,
          targetName: pathwaysTrackerName(targetId),
          path: result.paths.find((path) => path.key === key) ?? null,
        }
      })
      .sort((a, b) => a.targetName.localeCompare(b.targetName))
  }, [catalog, now, state, trackers])

  // One tree per source account. Shared prefixes merge inside the tree builder,
  // so a tracker that several pins pass through is drawn once on that branch.
  const pinnedTreeView = useMemo(() => {
    const paths: PinnedRoutePathInput[] = []
    const orphans: typeof myPinnedRoutes = []
    for (const pinned of myPinnedRoutes) {
      if (!pinned.path) {
        orphans.push(pinned)
        continue
      }
      paths.push({
        targetTrackerId: pinned.targetId,
        steps: pinned.path.steps.map((step, index) => ({
          sourceTrackerId: step.sourceTrackerId,
          destinationTrackerId: step.destinationTrackerId,
          waitDays: hopWaitDays(step, index),
        })),
      })
    }
    return { ...buildPinnedRouteTrees(paths), orphans }
  }, [myPinnedRoutes])

  const pinnedActions: PinnedTreeActions = {
    onUnpin: (targetId) => {
      void unpinTarget(targetId)
    },
    onOpen: (targetId) => {
      void chooseTarget(targetId)
    },
  }

  async function persistState(
    next: RecruitmentState,
    previous: RecruitmentState
  ): Promise<boolean> {
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
    setShowAll(false)
    const saved = await persistState({ ...state, desiredTrackerSlug: nextTarget }, state)
    if (!saved) setTargets(previousTargets)
  }

  async function togglePin(key: string) {
    if (!activeTarget) return
    const previous = state
    const pinnedRoutes = { ...state.pinnedRoutes }
    if (pinnedRoutes[activeTarget] === key) {
      delete pinnedRoutes[activeTarget]
    } else {
      pinnedRoutes[activeTarget] = key
    }
    await persistState({ ...state, pinnedRoutes }, previous)
  }

  async function unpinTarget(target: string) {
    if (!state.pinnedRoutes[target]) return
    const previous = state
    const pinnedRoutes = { ...state.pinnedRoutes }
    delete pinnedRoutes[target]
    await persistState({ ...state, pinnedRoutes }, previous)
  }

  const visibleChoices = routeChoices?.choices.slice(0, showAll ? undefined : 10) ?? []

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

      <section
        className="flex flex-col gap-3"
        aria-labelledby="my-pinned-routes-heading"
        data-my-pinned-routes
      >
        <div className="flex flex-col gap-1">
          <H2 id="my-pinned-routes-heading">My pinned routes</H2>
          <Paragraph>
            One tree per tracker you are on. Routes that share steps share a branch; pinned
            targets are marked, and every node shows its wait from the start.
          </Paragraph>
        </div>

        {pinnedTreeView.trees.length === 0 && pinnedTreeView.orphans.length === 0 ? (
          <p className="text-sm text-secondary">No pinned routes yet. Pin one below to keep it here.</p>
        ) : (
          <div className="flex min-w-0 flex-col gap-3">
            {pinnedTreeView.nextStep && (
              <p className="text-sm text-secondary" data-next-step>
                Next step:{" "}
                <span className="font-semibold text-primary">
                  {pathwaysTrackerName(pinnedTreeView.nextStep.trackerId)}
                </span>{" "}
                from{" "}
                <span className="font-semibold text-primary">
                  {pathwaysTrackerName(pinnedTreeView.nextStep.sourceTrackerId)}
                </span>{" "}
                <span className="font-mono">
                  {nextStepWaitPhrase(pinnedTreeView.nextStep.totalDays)}
                </span>
              </p>
            )}

            {pinnedTreeView.trees.length > 0 && (
              <div className="grid min-w-0 grid-cols-1 gap-3 xl:grid-cols-2">
                {pinnedTreeView.trees.map((tree) => (
                  <PinnedTree key={tree.sourceTrackerId} tree={tree} actions={pinnedActions} />
                ))}
              </div>
            )}

            {pinnedTreeView.orphans.length > 0 && (
              <div className="flex min-w-0 flex-col gap-2 border border-border bg-raised p-3">
                <H3>Pins with no current route</H3>
                <ul className="flex min-w-0 flex-col gap-1">
                  {pinnedTreeView.orphans.map((pinned) => (
                    <li
                      key={pinned.targetId}
                      className="group flex min-w-0 items-start justify-between gap-2"
                      data-pinned-route={pinned.targetId}
                    >
                      <div className="flex min-w-0 flex-col">
                        <span className="break-words text-sm text-primary">{pinned.targetName}</span>
                        <span className="text-xs text-warn">
                          Pinned route is not in the current data.
                        </span>
                      </div>
                      <UnpinRouteButton
                        targetId={pinned.targetId}
                        targetName={pinned.targetName}
                        onUnpin={pinnedActions.onUnpin}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

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

        {ownedCards.missingAccountAgeTrackers.length > 0 && (
          <p className="text-xs text-warn" data-missing-account-age>
            Account age missing:{" "}
            {ownedCards.missingAccountAgeTrackers.map((tracker) => tracker.name).join(", ")}. The
            first-hop wait on these trackers stays unknown until you add a join date.
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
            Pick a target to see its invite class, who leads there, and where it can take you. The
            first hop uses your account age on the tracker you start from.
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
                className="max-w-full whitespace-normal text-left"
                text={chipLabels[target] ?? pathwaysTrackerName(target)}
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
          <p className="text-sm text-secondary">Choose a tracker to see its profile and routes.</p>
        ) : profile ? (
          <div className="flex flex-col gap-4">
            {profile.paths.length > 0 ? (
              <div className="flex flex-col gap-3" data-target-routes>
                <RouteControls
                  sort={sort}
                  maxHops={maxHops}
                  startFrom={startFrom}
                  ownedOptions={ownedOptions}
                  onSort={(next) => {
                    setSort(next)
                    setShowAll(false)
                  }}
                  onMaxHops={(next) => {
                    setMaxHops(next)
                    setShowAll(false)
                  }}
                  onStartFrom={(next) => {
                    setStartFrom(next)
                    setShowAll(false)
                  }}
                />

                {routeChoices?.pinnedFilteredOut && (
                  <p className="text-xs text-tertiary">
                    Your pinned route is outside these filters.
                  </p>
                )}

                {routeChoices && routeChoices.total > 0 ? (
                  <>
                    <ul className="flex flex-col gap-3" data-route-list>
                      {visibleChoices.map((choice) => (
                        <RouteChoiceRow
                          key={choice.path.key}
                          choice={choice}
                          onTogglePin={togglePin}
                        />
                      ))}
                    </ul>
                    {routeChoices.total > 10 && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="min-h-11 self-start"
                        text={
                          showAll
                            ? "Show first 10"
                            : `Show all (${routeChoices.total})`
                        }
                        onClick={() => setShowAll((current) => !current)}
                      />
                    )}
                  </>
                ) : (
                  <p className="text-sm text-secondary">No routes match these filters.</p>
                )}
              </div>
            ) : (
              profile.noRoute && <NoRouteBlock noRoute={profile.noRoute} />
            )}
            <TargetProfile profile={profile} />
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
