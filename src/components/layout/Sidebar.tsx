// src/components/layout/Sidebar.tsx

"use client"

import { closestCenter, DndContext } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import {
  BookIcon,
  BookmarkIcon,
  ChevronLeftIcon,
  EyeIcon,
  EyeOffIcon,
  GearIcon,
  GitHubIcon,
  LockIcon,
  PlusIcon,
  PowerIcon,
  UnlockIcon,
} from "@icons"
import clsx from "clsx"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { AddTrackerDialog } from "@/components/AddTrackerDialog"
import { ChangelogDialog } from "@/components/layout/ChangelogDialog"
import { DownloadClientStatusWidget } from "@/components/layout/DownloadClientStatusWidget"
import { SortableTrackerItem } from "@/components/layout/SortableTrackerItem"
import { ThemeToggle } from "@/components/layout/ThemeToggle"
import { Button, ChevronToggle, PillTag, Select, Shimmer, Tooltip } from "@/components/ui"
import { useSidebarPreferences } from "@/hooks/useSidebarPreferences"
import { useTrackerList } from "@/hooks/useTrackerList"
import { useUpdateCheck } from "@/hooks/useUpdateCheck"
import { DOCS_URL } from "@/lib/constants"
import type { StatMode } from "@/lib/formatters"

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  isMobile?: boolean
}

const STAT_MODE_OPTIONS: { value: StatMode; label: string }[] = [
  { value: "ratio", label: "Ratio" },
  { value: "seeding", label: "Seeding" },
  { value: "uploaded", label: "Uploaded" },
  { value: "downloaded", label: "Downloaded" },
  { value: "buffer", label: "Buffer" },
]

const SIDEBAR_WIDTH = 248

function NavMark({ active }: { active: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={clsx(
        "h-1.5 w-1.5 shrink-0",
        active ? "bg-accent" : "border border-rail-line bg-transparent"
      )}
    />
  )
}

function Sidebar({ collapsed, onToggle, isMobile = false }: SidebarProps) {
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [changelogOpen, setChangelogOpen] = useState(false)

  const pathname = usePathname()
  const router = useRouter()
  const { latestVersion, updateAvailable } = useUpdateCheck()

  const prefs = useSidebarPreferences()
  const {
    trackers,
    loading: trackersLoading,
    displayedTrackers,
    trackerIds,
    archivedCount,
    toggleFavorite,
    handleDragEnd,
    refresh,
  } = useTrackerList({
    sortMode: prefs.sortMode,
    statMode: prefs.statMode,
    showFavoritesOnly: prefs.showFavoritesOnly,
    showArchived: prefs.showArchived,
    onSortModeChange: prefs.setSortMode,
  })

  const existingSlugs = useMemo(
    () => trackers.flatMap((t) => (t.registrySlug ? [t.registrySlug] : [])),
    [trackers]
  )

  const dragUnlocked = prefs.unlocked && prefs.sortMode !== "stat"
  const lockDisabled = prefs.sortMode === "stat"
  const lockLabel = lockDisabled
    ? "Reordering is disabled while sorted by datapoint"
    : dragUnlocked
      ? "Lock order"
      : "Unlock to reorder"

  function openChangelog() {
    setChangelogOpen(true)
  }

  const navItems = [
    { href: "/", label: "Dashboard", active: pathname === "/" },
    { href: "/#register", label: "Register", active: false },
    { href: "/#today", label: "Today", active: false },
    { href: "/settings", label: "Settings", active: pathname.startsWith("/settings") },
  ]

  return (
    <>
      <aside
        className={clsx(
          "h-screen flex flex-col bg-rail text-rail-text border-r border-rail-line overflow-x-clip",
          isMobile ? "fixed inset-y-0 left-0 z-30 shrink-0" : "shrink-0"
        )}
        aria-hidden={isMobile && collapsed ? true : undefined}
        inert={isMobile && collapsed ? true : undefined}
        style={
          isMobile
            ? {
                width: SIDEBAR_WIDTH,
                transform: collapsed ? "translateX(-100%)" : "translateX(0)",
                transition: "transform 300ms ease",
              }
            : {
                width: collapsed ? 0 : SIDEBAR_WIDTH,
                borderRightWidth: collapsed ? 0 : undefined,
                transition: "width 300ms ease, border-right-width 300ms ease",
              }
        }
      >
        <div className="w-[248px] min-w-[248px] h-full flex flex-col">
          <div className="px-4 pt-4 pb-4 border-b border-rail-line shrink-0">
            <div className="flex items-start justify-between gap-2">
              <button
                type="button"
                onClick={() => router.push("/")}
                className={clsx(
                  "flex flex-col items-start gap-1.5 cursor-pointer text-left transition-opacity duration-150",
                  pathname === "/" ? "opacity-100" : "opacity-80 hover:opacity-100"
                )}
                aria-label="Go to dashboard"
                aria-current={pathname === "/" ? "page" : undefined}
              >
                <span className="flex items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center bg-accent font-cond text-sm font-semibold text-on-accent">
                    TT
                  </span>
                  <span className="font-cond text-base font-semibold uppercase leading-[0.9] tracking-[0.14em] text-rail-text">
                    Tracker
                    <br />
                    Tracker
                  </span>
                </span>
                <span className="font-cond text-4xs font-semibold uppercase tracking-[0.2em] text-rail-muted">
                  Account vault
                </span>
              </button>
              <button
                type="button"
                onClick={onToggle}
                className="text-rail-muted hover:text-rail-text transition-colors duration-150 cursor-pointer p-1.5 -mr-1"
                aria-label="Collapse sidebar"
              >
                <ChevronLeftIcon width="15" height="15" />
              </button>
            </div>
          </div>

          <div className="px-2 pt-4 pb-2 shrink-0">
            <p className="px-2 pb-2 font-cond text-4xs font-semibold uppercase tracking-[0.18em] text-rail-muted">
              Vault
            </p>
            <nav className="flex flex-col gap-0.5" aria-label="Main">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "flex min-h-11 items-center gap-2.5 px-2 py-2 text-[13px] transition-colors duration-150 rounded-nm-sm md:min-h-0",
                    item.active
                      ? "bg-rail-raised text-rail-text"
                      : "text-rail-muted hover:bg-rail-raised hover:text-rail-text"
                  )}
                  aria-current={item.active ? "page" : undefined}
                >
                  <NavMark active={item.active} />
                  {item.label}
                </Link>
              ))}
              <a
                href={DOCS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-11 items-center gap-2.5 px-2 py-2 text-[13px] text-rail-muted transition-colors duration-150 hover:bg-rail-raised hover:text-rail-text rounded-nm-sm md:min-h-0"
              >
                <NavMark active={false} />
                Docs
              </a>
            </nav>
          </div>

          <div className="border-t border-rail-line shrink-0">
            <button
              type="button"
              onClick={() => prefs.setFiltersExpanded((prev) => !prev)}
              className="w-full flex items-center justify-between px-4 py-2 text-rail-muted hover:text-rail-text transition-colors duration-150 cursor-pointer"
              aria-expanded={prefs.filtersExpanded}
              aria-label={prefs.filtersExpanded ? "Collapse filters" : "Expand filters"}
            >
              <span className="font-cond text-4xs font-semibold uppercase tracking-[0.16em]">
                Drawer controls
              </span>
              <ChevronToggle expanded={prefs.filtersExpanded} variant="flip" />
            </button>
            <div
              className="grid transition-[grid-template-rows,opacity] duration-200 ease-out"
              style={{
                gridTemplateRows: prefs.filtersExpanded ? "1fr" : "0fr",
                opacity: prefs.filtersExpanded ? 1 : 0,
              }}
            >
              <div className={prefs.filtersExpanded ? "overflow-visible" : "overflow-hidden"}>
                <div className="mx-2 mb-2 flex items-center gap-1.5 border border-rail-line bg-raised p-1.5 text-primary">
                  <Select
                    value={prefs.statMode}
                    onChange={prefs.setStatMode}
                    ariaLabel="Stat display mode"
                    options={STAT_MODE_OPTIONS}
                  />

                  <Select
                    value={prefs.sortMode}
                    onChange={prefs.setSortMode}
                    ariaLabel="Sort order"
                    options={[
                      { value: "index", label: "Index" },
                      { value: "alpha", label: "A-Z" },
                      { value: "custom", label: "Custom" },
                      {
                        value: "stat",
                        label: `By ${STAT_MODE_OPTIONS.find((o) => o.value === prefs.statMode)?.label ?? "Datapoint"}`,
                      },
                    ]}
                  />

                  <button
                    type="button"
                    onClick={() => prefs.setShowFavoritesOnly((f) => !f)}
                    className={clsx(
                      "transition-colors duration-150 cursor-pointer px-2 py-2 shrink-0",
                      prefs.showFavoritesOnly ? "text-warn" : "text-tertiary hover:text-secondary"
                    )}
                    aria-label={
                      prefs.showFavoritesOnly ? "Show all trackers" : "Show favorites only"
                    }
                  >
                    <Tooltip
                      content={
                        prefs.showFavoritesOnly ? "Show all trackers" : "Show favorites only"
                      }
                    >
                      <BookmarkIcon width="14" height="14" filled={prefs.showFavoritesOnly} />
                    </Tooltip>
                  </button>

                  <button
                    type="button"
                    onClick={() => prefs.setUnlocked((u) => !u)}
                    disabled={lockDisabled}
                    className="text-tertiary hover:text-secondary transition-colors duration-150 cursor-pointer px-2 py-2 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label={lockLabel}
                  >
                    <Tooltip content={lockLabel}>
                      {dragUnlocked ? (
                        <UnlockIcon width="14" height="14" />
                      ) : (
                        <LockIcon width="14" height="14" />
                      )}
                    </Tooltip>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto py-2 styled-scrollbar" aria-label="Trackers">
            <div className="flex items-center justify-between px-4 pb-1.5">
              <p className="font-cond text-4xs font-semibold uppercase tracking-[0.18em] text-rail-muted">
                Drawers
              </p>
              <span className="font-mono text-4xs text-rail-muted">{trackers.length}</span>
            </div>
            {trackersLoading ? (
              <div className="flex flex-col gap-2 px-3">
                {Array.from({ length: 4 }, (_, i) => (
                  <div key={`tracker-${i}`} className="flex items-center gap-2 px-1 py-2">
                    <Shimmer rounded="full" className="h-3 w-3" />
                    <Shimmer size="text" className="flex-1" />
                    <Shimmer size="label" className="w-10" />
                  </div>
                ))}
              </div>
            ) : trackers.length === 0 ? (
              <p className="px-4 py-2 text-3xs text-rail-muted font-mono">No trackers added yet.</p>
            ) : (
              <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={trackerIds} strategy={verticalListSortingStrategy}>
                  <ul className="list-none m-0 p-0 flex flex-col px-2">
                    {displayedTrackers.map((tracker) => {
                      const isActive = pathname === `/trackers/${tracker.id}`
                      return (
                        <SortableTrackerItem
                          key={tracker.id}
                          tracker={tracker}
                          isActive={isActive}
                          unlocked={dragUnlocked}
                          statMode={prefs.statMode}
                          onToggleFavorite={toggleFavorite}
                        />
                      )
                    })}
                  </ul>
                </SortableContext>
              </DndContext>
            )}

          </nav>

          <div className="mx-2 shrink-0 border-t border-rail-line py-2 flex flex-col gap-1.5">
            {archivedCount > 0 && (
              <button
                type="button"
                onClick={() => prefs.setShowArchived((s) => !s)}
                className="flex w-full items-center gap-2 px-1 text-3xs text-rail-muted transition-colors duration-150 hover:text-rail-text cursor-pointer"
              >
                {prefs.showArchived ? (
                  <EyeOffIcon width="13" height="13" className="shrink-0" />
                ) : (
                  <EyeIcon width="13" height="13" className="shrink-0" />
                )}
                {prefs.showArchived ? "Hide" : "Show"} archived ({archivedCount})
              </button>
            )}
            <Button
              variant="rail"
              size="sm"
              className="w-full"
              onClick={() => setShowAddDialog(true)}
            >
              <PlusIcon width="13" height="13" />
              Add tracker
            </Button>
          </div>

          <DownloadClientStatusWidget />

          <div className="px-3 py-3 border-t border-rail-line shrink-0 flex flex-col gap-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={async () => {
                  await fetch("/api/auth/logout", { method: "POST" })
                  router.push("/login")
                }}
                className="text-rail-muted hover:text-rail-text text-3xs font-mono flex items-center gap-2 transition-colors duration-150 cursor-pointer flex-1 px-1 py-1"
              >
                <PowerIcon width="13" height="13" />
                Log out
              </button>
              <button
                type="button"
                onClick={() => router.push("/settings")}
                className="text-rail-muted hover:text-rail-text text-3xs font-mono flex items-center gap-2 transition-colors duration-150 cursor-pointer flex-1 px-1 py-1"
              >
                <GearIcon width="13" height="13" />
                Settings
              </button>
            </div>

            <div className="flex items-center gap-2.5 px-1 pt-2">
              <button
                type="button"
                onClick={openChangelog}
                className="flex h-6 items-center px-1 text-left font-mono text-4xs text-rail-muted transition-colors duration-150 hover:text-rail-text cursor-pointer"
              >
                v{process.env.NEXT_PUBLIC_APP_VERSION}
              </button>
              {process.env.NEXT_PUBLIC_RELEASE_CHANNEL === "development" && (
                <PillTag color="warn" size="sm" label="dev" />
              )}
              {updateAvailable && latestVersion && (
                <a
                  href={`https://github.com/jordanlambrecht/tracker-tracker/releases/tag/v${latestVersion}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 border border-rail-line bg-rail-raised px-1.5 py-0.5 text-4xs font-mono text-warn hover:border-warn transition-colors duration-150"
                >
                  <Tooltip content={`Update available: v${latestVersion}`}>
                    <span className="flex items-center gap-1">v{latestVersion} ↑</span>
                  </Tooltip>
                </a>
              )}
              <ThemeToggle />
              <a
                href="https://github.com/jordanlambrecht/tracker-tracker"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-6 w-6 shrink-0 items-center justify-center text-rail-muted transition-colors duration-150 hover:text-rail-text"
                aria-label="GitHub repository"
              >
                <GitHubIcon width="14" height="14" />
              </a>
              <a
                href={DOCS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-6 w-6 shrink-0 items-center justify-center text-rail-muted transition-colors duration-150 hover:text-rail-text"
                aria-label="Documentation"
              >
                <BookIcon width="14" height="14" />
              </a>
            </div>
          </div>
        </div>
      </aside>

      <AddTrackerDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onAdded={(id) => {
          setShowAddDialog(false)
          refresh()
          router.push(`/trackers/${id}`)
        }}
        existingSlugs={existingSlugs}
      />

      <ChangelogDialog open={changelogOpen} onClose={() => setChangelogOpen(false)} />
    </>
  )
}

export { Sidebar }
