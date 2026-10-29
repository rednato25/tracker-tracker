// src/components/layout/ThemeToggle.tsx
"use client"

import { useEffect, useState } from "react"
import { MoonIcon, SunIcon } from "@/components/ui/Icons"

type Theme = "light" | "dark"

function readTheme(): Theme {
  if (typeof document === "undefined") return "light"
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light"
}

function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light")

  useEffect(() => {
    setTheme(readTheme())
  }, [])

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark"
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem("theme", next)
    } catch {
      // A blocked storage API should not stop the theme change.
    }
    setTheme(next)
    // ECharts reads the token colors when its options are built. A reload is
    // the honest way to rebuild every chart with the new palette.
    window.location.reload()
  }

  const label = theme === "dark" ? "Switch to light theme" : "Switch to dark theme"

  return (
    <button
      type="button"
      onClick={toggle}
      className="flex h-11 w-11 cursor-pointer items-center justify-center text-secondary transition-colors duration-150 hover:text-primary"
      aria-label={label}
      title={label}
    >
      {theme === "dark" ? <SunIcon width="14" height="14" /> : <MoonIcon width="14" height="14" />}
    </button>
  )
}

export { ThemeToggle }
