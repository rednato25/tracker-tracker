// src/hooks/__tests__/useExistingTrackerSlugs.test.tsx
//
// The Add Tracker dialog filters on this list. It must carry every registry slug
// the vault holds and nothing else: a missing slug offers a duplicate, and a
// null one would be compared against entries the registry does not own.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it } from "vitest"
import { useExistingTrackerSlugs } from "@/hooks/useExistingTrackerSlugs"
import { trackerQueryOptions } from "@/lib/query-options"
import type { TrackerSummary } from "@/types/api"

const base: TrackerSummary = {
  id: 1,
  name: "Aither",
  baseUrl: "https://aither.cc",
  registrySlug: "aither",
  platformType: "unit3d",
  isActive: true,
  lastPolledAt: null,
  lastError: null,
  lastErrorAt: null,
  consecutiveFailures: 0,
  pausedAt: null,
  userPausedAt: null,
  color: "#00d4ff",
  qbtTag: null,
  mouseholeUrl: null,
  hasMouseholeToken: false,
  hideUnreadBadges: false,
  useProxy: false,
  countCrossSeedUnsatisfied: false,
  isFavorite: false,
  sortOrder: null,
  joinedAt: null,
  lastAccessAt: null,
  remoteUserId: null,
  platformMeta: null,
  createdAt: new Date().toISOString(),
  latestStats: null,
}

function renderSlugs(trackers: TrackerSummary[]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: Number.POSITIVE_INFINITY, retry: false } },
  })
  queryClient.setQueryData(trackerQueryOptions.queryKey, trackers)

  return renderHook(() => useExistingTrackerSlugs(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  })
}

describe("useExistingTrackerSlugs", () => {
  it("returns the registry slug of every tracker in the vault", () => {
    const { result } = renderSlugs([
      base,
      { ...base, id: 2, name: "Orpheus", registrySlug: "orpheus" },
    ])

    expect(result.current).toEqual(["aither", "orpheus"])
  })

  it("skips a pre-registry row that has no registry slug", () => {
    // A row without a slug is a custom site, not a registry entry, so the dialog
    // has nothing to hide for it. Returning null here would be an entry the
    // filter can never match and a crash for any caller that assumes strings.
    const { result } = renderSlugs([base, { ...base, id: 2, registrySlug: null }])

    expect(result.current).toEqual(["aither"])
  })

  it("returns an empty list for an empty vault", () => {
    const { result } = renderSlugs([])

    expect(result.current).toEqual([])
  })
})
