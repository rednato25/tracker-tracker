"use client"

import { useCallback } from "react"
import { useLocalStorage } from "@/hooks/useLocalStorage"
import { STORAGE_KEYS } from "@/lib/storage-keys"

export type RegisterSortKey = "ratio" | "buffer" | "login" | "rank"
export type RegisterSortDirection = "asc" | "desc"
export interface RegisterSort {
  key: RegisterSortKey
  direction: RegisterSortDirection
}

const KEYS: RegisterSortKey[] = ["ratio", "buffer", "login", "rank"]

function parse(raw: string): RegisterSort | null {
  const [key, direction] = raw.split(":")
  if (!KEYS.includes(key as RegisterSortKey)) return null
  if (direction !== "asc" && direction !== "desc") return null
  return { key: key as RegisterSortKey, direction }
}

/** Register sort preference, remembered per browser. */
export function useRegisterSort() {
  const [raw, setRaw] = useLocalStorage<string>(STORAGE_KEYS.REGISTER_SORT, "")
  const sort = parse(raw)
  const toggle = useCallback(
    (key: RegisterSortKey) => {
      setRaw(
        sort?.key === key
          ? `${key}:${sort.direction === "asc" ? "desc" : "asc"}`
          : `${key}:asc`
      )
    },
    [setRaw, sort]
  )
  return { sort, toggle }
}
