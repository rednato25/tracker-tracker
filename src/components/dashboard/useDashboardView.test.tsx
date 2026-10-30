import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useDashboardView } from "@/components/dashboard/useDashboardView"
import { STORAGE_KEYS } from "@/lib/storage-keys"

function memoryStorage(): Storage {
  const values = new Map<string, string>()
  return {
    get length() {
      return values.size
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => {
      values.delete(key)
    },
    setItem: (key, value) => {
      values.set(key, value)
    },
  }
}

describe("useDashboardView", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage())
  })

  it("defaults to the grid view", () => {
    const { result } = renderHook(() => useDashboardView())
    expect(result.current[0]).toBe("grid")
  })

  it("remembers the table view in this browser", () => {
    const first = renderHook(() => useDashboardView())
    act(() => first.result.current[1]("table"))
    expect(localStorage.getItem(STORAGE_KEYS.DASHBOARD_VIEW)).toBe('"table"')

    const second = renderHook(() => useDashboardView())
    expect(second.result.current[0]).toBe("table")
  })

  it("remembers the ranks view in this browser", () => {
    const first = renderHook(() => useDashboardView())
    act(() => first.result.current[1]("ranks"))
    expect(localStorage.getItem(STORAGE_KEYS.DASHBOARD_VIEW)).toBe('"ranks"')

    const second = renderHook(() => useDashboardView())
    expect(second.result.current[0]).toBe("ranks")
  })

  it("falls back to grid for an unknown stored value", () => {
    localStorage.setItem(STORAGE_KEYS.DASHBOARD_VIEW, '"list"')
    const { result } = renderHook(() => useDashboardView())
    expect(result.current[0]).toBe("grid")
  })
})
