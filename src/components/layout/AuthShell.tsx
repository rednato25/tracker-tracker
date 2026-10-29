// src/components/layout/AuthShell.tsx
"use client"

import { usePathname } from "next/navigation"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { RetentionPrompt } from "@/components/dashboard/RetentionPromptDialog"
import { AppHeader } from "@/components/layout/AppHeader"
import { WhatsNew } from "@/components/layout/WhatsNew"
import { BackToTop } from "@/components/ui/BackToTop"

export function AuthShell({ children }: { children: ReactNode }) {
  const [isMobile, setIsMobile] = useState(false)
  const mainRef = useRef<HTMLElement>(null)
  const pathname = usePathname()

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)")
    setIsMobile(mq.matches)
    const handler = (event: MediaQueryListEvent) => setIsMobile(event.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  // Scroll main content to top on route change (main is the scroll container, not window)
  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname is the trigger, so we intentionally re-run on route change
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-base" data-mobile={String(isMobile)}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-nm-sm focus:border focus:border-accent focus:bg-raised focus:px-3 focus:py-2 focus:text-xs focus:font-semibold focus:text-primary"
      >
        Skip to main content
      </a>
      {/* Mounted in the persistent shell, not a page: the first-run prompt must
          survive the add-first-tracker redirect instead of vanishing with the
          dashboard. It renders nothing once answered. */}
      <RetentionPrompt />
      <AppHeader />
      <main
        id="main-content"
        ref={mainRef}
        tabIndex={-1}
        className="relative flex-1 overflow-y-auto overscroll-contain themed-scrollbar"
      >
        <div className="mx-auto w-full max-w-[1600px] px-4 py-6 md:px-6">{children}</div>
        <BackToTop scrollRef={mainRef} />
      </main>
      <WhatsNew />
    </div>
  )
}
