import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useRegisterSort } from "@/components/dashboard/useRegisterSort"
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

describe("useRegisterSort", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage())
  })

  it("starts unsorted", () => {
    const { result } = renderHook(() => useRegisterSort())
    expect(result.current.sort).toBeNull()
  })

  it("toggles direction and remembers the sort", () => {
    const first = renderHook(() => useRegisterSort())
    act(() => first.result.current.toggle("ratio"))
    expect(first.result.current.sort).toEqual({ key: "ratio", direction: "asc" })
    act(() => first.result.current.toggle("ratio"))
    expect(first.result.current.sort).toEqual({ key: "ratio", direction: "desc" })
    expect(localStorage.getItem(STORAGE_KEYS.REGISTER_SORT)).toBe('"ratio:desc"')

    const second = renderHook(() => useRegisterSort())
    expect(second.result.current.sort).toEqual({ key: "ratio", direction: "desc" })
  })

  it("ignores an unknown stored key", () => {
    localStorage.setItem(STORAGE_KEYS.REGISTER_SORT, '"unknown:asc"')
    const { result } = renderHook(() => useRegisterSort())
    expect(result.current.sort).toBeNull()
  })
})
