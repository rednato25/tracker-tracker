// src/components/dashboard/useDashboardView.ts

"use client"

import { useCallback } from "react"
import { useLocalStorage } from "@/hooks/useLocalStorage"
import { STORAGE_KEYS } from "@/lib/storage-keys"

export type DashboardView = "grid" | "table" | "ranks"

const VIEWS: DashboardView[] = ["grid", "table", "ranks"]

/** Dashboard view preference, remembered per browser. */
export function useDashboardView(): [DashboardView, (view: DashboardView) => void] {
  const [stored, setStored] = useLocalStorage<DashboardView>(
    STORAGE_KEYS.DASHBOARD_VIEW,
    "grid"
  )
  const view: DashboardView = VIEWS.includes(stored) ? stored : "grid"
  const setView = useCallback(
    (next: DashboardView) => {
      setStored(next)
    },
    [setStored]
  )
  return [view, setView]
}