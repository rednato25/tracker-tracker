// src/hooks/useExistingTrackerSlugs.ts

"use client"

import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"
import { trackerQueryOptions } from "@/lib/query-options"

/**
 * Registry slugs this vault already holds, so the Add Tracker dialog can stop
 * offering them a second time.
 *
 * The dialog itself is given the list rather than reading it, because it is a
 * presentational form with one job per prop. Every mount that renders it has to
 * supply the list, and the top navigation mounting it without one is how the
 * duplicate entries showed up. Reading the shared ["trackers"] query here keeps
 * the derivation in a single place for those mounts.
 *
 * Rows with no registrySlug — a pre-registry custom site — are skipped: the
 * dialog only offers registry entries, so they have nothing to filter.
 */
export function useExistingTrackerSlugs(): string[] {
  const { data } = useQuery(trackerQueryOptions)
  return useMemo(
    () => (data ?? []).flatMap((tracker) => (tracker.registrySlug ? [tracker.registrySlug] : [])),
    [data]
  )
}
