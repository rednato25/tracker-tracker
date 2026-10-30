// src/app/(auth)/DashboardClient.tsx
"use client"

import { useQuery } from "@tanstack/react-query"
import dynamic from "next/dynamic"
import { useMemo, useState, useTransition } from "react"
import { DashboardSkeleton } from "@/app/(auth)/DashboardSkeleton"
import { CHART_THEME } from "@/components/charts/lib/theme"
import { AlertsBanner } from "@/components/dashboard/AlertsBanner"
import { AnalyticsSection } from "@/components/dashboard/AnalyticsSection"
import { AttentionNeeded } from "@/components/dashboard/AttentionNeeded"
import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState"
import { DashboardTotals } from "@/components/dashboard/DashboardTotals"
import { DayRangeSidebar } from "@/components/dashboard/DayRangeSidebar"
import { EcosystemStatsSection } from "@/components/dashboard/EcosystemStatsSection"
import { FleetDashboard } from "@/components/dashboard/FleetDashboard"
import { LoginTimers } from "@/components/dashboard/LoginTimers"
import { PollAllButton } from "@/components/dashboard/PollAllButton"
import { TagGroupsSection } from "@/components/dashboard/TagGroupsSection"
import { TodayAtAGlance } from "@/components/dashboard/TodayAtAGlance"
import { TodayAtAGlanceSkeleton } from "@/components/dashboard/TodayAtAGlanceSkeleton"
import { TrackerGrid } from "@/components/dashboard/TrackerGrid"
import { TrackerLeaderboard } from "@/components/dashboard/TrackerLeaderboard"
import { TrackerRegister } from "@/components/dashboard/TrackerRegister"
import { useChartPreferences } from "@/components/dashboard/useChartPreferences"
import { useDashboardSettings } from "@/components/dashboard/useDashboardSettings"
import { useDashboardView } from "@/components/dashboard/useDashboardView"
import { Button, Divider, GearIcon, TabBar } from "@/components/ui"
import { SectionToggle } from "@/components/ui/SectionToggle"
import { ChartGridSkeleton } from "@/components/ui/skeletons"
import { H1 } from "@/components/ui/Typography"
import { useDashboardData } from "@/hooks/useDashboardData"
import { usePollingIntervals } from "@/hooks/usePollingIntervals"
import { useSectionCollapse } from "@/hooks/useSectionCollapse"
import { computeTrackerActions } from "@/lib/actions"
import { computeAggregateStats } from "@/lib/dashboard"
import type { FleetAggregation } from "@/lib/fleet-aggregation"
import { fleetCachedQueryOptions } from "@/lib/query-options"
import { buildRankGoalSummaries, parseSavedRankGoals } from "@/lib/rank-summary"
import type { Snapshot, TrackerSummary } from "@/types/api"
import type { TrackerSnapshotSeries } from "@/types/charts"

const DashboardSettingsSheet = dynamic(
  () =>
    import("@/components/dashboard/DashboardSettingsSheet").then((m) => m.DashboardSettingsSheet),
  { ssr: false }
)

const DASHBOARD_TABS = [
  { key: "tracker-stats" as const, label: "Tracker Stats" },
  { key: "torrent-fleet" as const, label: "Torrent Fleet" },
]

function buildTrackerSeries(
  trackers: TrackerSummary[],
  snapshotMap: Map<number, Snapshot[]>
): TrackerSnapshotSeries[] {
  return trackers.map((t) => ({
    name: t.name,
    color: t.color,
    snapshots: snapshotMap.get(t.id) ?? [],
  }))
}

// Stable select: the dashboard only needs the tag group counts, so the fleet tab's own
// refetches of this cache do not re-render the rest of the page.
const selectTagGroupBreakdowns = (data: FleetAggregation) => data.tagGroupBreakdowns

interface DashboardClientProps {
  initialTrackers: TrackerSummary[]
  snapshotRetentionDays: number | null
  rankGoals: string | null
  /** Read server-side from two small queries. False skips the Tag Groups fetch entirely. */
  hasTagGroups: boolean
  /** Server time keeps the first client render aligned with the server. */
  now: string
}

export function DashboardClient({
  initialTrackers,
  snapshotRetentionDays,
  rankGoals,
  hasTagGroups,
  now,
}: DashboardClientProps) {
  const data = useDashboardData({ initialTrackers, snapshotRetentionDays })
  const savedRankGoals = useMemo(() => parseSavedRankGoals(rankGoals), [rankGoals])
  const dashSettings = useDashboardSettings()
  const sectionCollapse = useSectionCollapse()
  // One instance for the whole page, like sectionCollapse above. The analytics grid and the
  // settings sheet are mounted together and each write stores the whole preferences object,
  // so a second instance would revert the other surface's last change.
  const chartPrefs = useChartPreferences()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [dashboardView, setDashboardView] = useDashboardView()
  // Two-state tab pattern: dashboardTab updates immediately (drives TabBar pill animation),
  // deferredTab updates via startTransition (drives content switch + query gating).
  // This keeps the content render from blocking the pill's CSS transition.
  const [dashboardTab, setDashboardTab] = useState<"tracker-stats" | "torrent-fleet">(
    "tracker-stats"
  )
  const [deferredTab, setDeferredTab] = useState<"tracker-stats" | "torrent-fleet">("tracker-stats")
  const [, startTransition] = useTransition()
  const intervals = usePollingIntervals()

  // Tag group counts read the Torrent Fleet tab's cached aggregation, so they cost nothing
  // before first paint and refresh on the fleet's schedule, its refresh button included.
  const { data: tagGroupBreakdowns = [], isPending: tagGroupsPending } = useQuery({
    ...fleetCachedQueryOptions,
    staleTime: intervals.clientRefetchMs,
    enabled: hasTagGroups,
    select: selectTagGroupBreakdowns,
  })

  const aggregateStats = useMemo(() => computeAggregateStats(data.trackers), [data.trackers])
  const rankSummaries = useMemo(
    () => buildRankGoalSummaries(data.trackers, savedRankGoals, new Date(now)),
    [data.trackers, savedRankGoals, now]
  )
  const trackerSeries = useMemo(
    () => buildTrackerSeries(data.trackers, data.snapshotMap),
    [data.trackers, data.snapshotMap]
  )
  const actions = useMemo(
    () =>
      computeTrackerActions({
        trackers: data.trackers,
        clients: data.clients,
        now: new Date(now),
      }),
    [data.trackers, data.clients, now]
  )
  const attentionCount = useMemo(
    () => actions.filter((action) => action.status === "action-required").length,
    [actions]
  )
  const verificationCount = useMemo(
    () => actions.filter((action) => action.status === "needs-verification").length,
    [actions]
  )

  // Sections render expanded until localStorage has been read. Charts gate the other way
  // (collapsed until hydrated) because mounting echarts is expensive; section content is
  // already in the server-rendered HTML, so hiding it until hydration would blank the page
  // and pop it back open for the common case of nothing being collapsed at all.
  const isExpanded = (id: string) => !sectionCollapse.isCollapsed(id)

  const todayAtAGlanceExpanded = isExpanded("today-at-a-glance")
  const leaderboardExpanded = isExpanded("leaderboard")
  const ecosystemStatsExpanded = isExpanded("ecosystem-stats")
  const loginTimersExpanded = isExpanded("login-timers")
  const tagGroupsExpanded = isExpanded("tag-groups")

  if (data.loading) {
    return <DashboardSkeleton />
  }

  if (data.trackersError) {
    return (
      <div className="flex flex-col gap-3 rounded-nm-lg border border-border bg-raised px-4 py-6">
        <p className="font-mono text-sm text-danger" role="alert">
          Dashboard data could not be loaded.
        </p>
        <p className="font-mono text-xs text-secondary">
          No clear status is claimed while tracker data is unavailable.
        </p>
        <Button variant="secondary" size="sm" onClick={() => void data.refresh()}>
          Retry
        </Button>
      </div>
    )
  }

  if (data.trackers.length === 0) {
    return <DashboardEmptyState onAdded={data.refresh} />
  }

  return (
    <div className="min-h-full" data-page-frame>
      <div className="mb-4 flex min-h-12 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border py-1.5">
        <H1>Dashboard</H1>
        <div className="flex flex-wrap items-center gap-2">
          <fieldset className="m-0 flex min-w-0 items-center rounded-nm-sm border border-border bg-elevated p-0.5">
            <legend className="sr-only">Dashboard view</legend>
            {(["grid", "table"] as const).map((view) => (
              <button
                key={view}
                type="button"
                aria-pressed={dashboardView === view}
                onClick={() => setDashboardView(view)}
                className={`min-h-8 cursor-pointer rounded-nm-sm px-2.5 font-cond text-xs font-semibold uppercase tracking-[0.1em] transition-colors duration-150 ${
                  dashboardView === view
                    ? "bg-raised text-primary shadow-[0_0_0_1px_var(--color-border)]"
                    : "text-tertiary hover:text-secondary"
                }`}
              >
                {view === "grid" ? "Grid" : "Table"}
              </button>
            ))}
          </fieldset>
          <PollAllButton onPollComplete={data.refresh} />
          <Button
            variant="secondary"
            size="icon"
            onClick={() => setSettingsOpen(true)}
            aria-label="Dashboard settings"
          >
            <GearIcon width="16" height="16" />
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-6 pb-12" data-dashboard-view={dashboardView}>
        <DashboardTotals
          trackers={data.trackers}
          aggregateStats={aggregateStats}
          attentionCount={attentionCount}
          verificationCount={verificationCount}
          snapshotMap={data.snapshotMap}
          now={new Date(now)}
        />

        {dashboardView === "grid" ? (
          <TrackerGrid
            trackers={data.trackers}
            summaries={rankSummaries}
            now={new Date(now)}
          />
        ) : (
          <TrackerRegister
            trackers={data.trackers}
            aggregateStats={aggregateStats}
            attentionCount={attentionCount}
            now={new Date(now)}
            showTotals={false}
            summaries={rankSummaries}
          />
        )}

        <AttentionNeeded
          trackers={data.trackers}
          actions={actions}
          loading={data.clientsLoading}
          error={data.trackersError}
          clientsUnavailable={data.clientsError}
          asOf={now}
        />

        {/* Alerts */}
        {data.alerts.length > 0 && (
          <AlertsBanner
            alerts={data.alerts}
            onDismiss={data.dismissAlert}
            onDismissAll={data.dismissAllAlerts}
          />
        )}

        {/* Login Timers */}
      {dashSettings.settings.showLoginTimers && (
        <LoginTimers
          trackers={data.trackers}
          expanded={loginTimersExpanded}
          onToggleExpanded={() => sectionCollapse.toggle("login-timers")}
        />
      )}

      {/* Today At A Glance */}
        {dashSettings.settings.showTodayAtAGlance && (
          <div className="flex w-full flex-col gap-4">
            <SectionToggle
              label="Fleet activity"
              expanded={todayAtAGlanceExpanded}
              onToggle={() => sectionCollapse.toggle("today-at-a-glance")}
            />
            {todayAtAGlanceExpanded &&
              (data.todayData ? (
                <TodayAtAGlance data={data.todayData} />
              ) : data.todayLoading ? (
                <TodayAtAGlanceSkeleton />
              ) : null)}
          </div>
        )}

      {/* Leaderboard */}
      <div className="flex flex-col gap-4">
        <SectionToggle
          label="Leaderboard"
          expanded={leaderboardExpanded}
          onToggle={() => sectionCollapse.toggle("leaderboard")}
        />
        {leaderboardExpanded && <TrackerLeaderboard trackers={data.trackers} />}
      </div>

      <Divider />

      {/* Aggregate Stats */}
      <div className="flex flex-col gap-4">
        <SectionToggle
          label="Ecosystem"
          expanded={ecosystemStatsExpanded}
          onToggle={() => sectionCollapse.toggle("ecosystem-stats")}
        />
        {ecosystemStatsExpanded && (
          <EcosystemStatsSection trackers={data.trackers} aggregateStats={aggregateStats} />
        )}
      </div>

      {/* Tag Groups. Omitted entirely when none are configured or none of them match */}
      {hasTagGroups && (tagGroupsPending || tagGroupBreakdowns.length > 0) && (
        <div className="flex flex-col gap-4">
          <SectionToggle
            label="Tag Groups"
            expanded={tagGroupsExpanded}
            onToggle={() => sectionCollapse.toggle("tag-groups")}
          />
          {tagGroupsExpanded &&
            (tagGroupBreakdowns.length > 0 ? (
              <TagGroupsSection breakdowns={tagGroupBreakdowns} accentColor={CHART_THEME.accent} />
            ) : (
              <ChartGridSkeleton count={2} />
            ))}
        </div>
      )}

      <Divider />

      {/* Tab Switcher */}
      <TabBar
        tabs={DASHBOARD_TABS}
        activeTab={dashboardTab}
        onChange={(tab) => {
          setDashboardTab(tab)
          startTransition(() => setDeferredTab(tab))
        }}
      />

      {/*  Analytics / Fleet  */}
      <div className="flex flex-col md:flex-row gap-4 md:gap-8">
        <div className="flex-1 min-w-0">
          <div className={deferredTab !== "torrent-fleet" ? "hidden" : undefined}>
            <FleetDashboard dayRange={data.dayRange} isActive={deferredTab === "torrent-fleet"} />
          </div>
          <div className={deferredTab !== "tracker-stats" ? "hidden" : undefined}>
            <AnalyticsSection
              trackerSeries={trackerSeries}
              trackers={data.trackers}
              chartPrefs={chartPrefs}
              dashSettings={dashSettings}
            />
          </div>
        </div>

        {/* Sticky sidebar*/}
        <DayRangeSidebar days={data.dayRange} onChange={data.setDayRange} />
      </div>

      {/* Settings Sheet */}
      <DashboardSettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        chartPrefs={chartPrefs}
        dashSettings={dashSettings}
      />
      </div>
    </div>
  )
}
