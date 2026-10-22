// src/components/ui/BackToTop.tsx
//
// Functions: BackToTop

"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronUpIcon } from "@/components/ui/Icons"

interface BackToTopProps {
  scrollRef: React.RefObject<HTMLElement | null>
}

export type { BackToTopProps }

export function BackToTop({ scrollRef }: BackToTopProps) {
  const [visible, setVisible] = useState(false)
  const rafRef = useRef(0)

  const handleScroll = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      const el = scrollRef.current
      if (!el) return
      setVisible(el.scrollTop > el.clientHeight * 0.015)
    })
  }, [scrollRef])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.addEventListener("scroll", handleScroll, { passive: true })
    return () => {
      el.removeEventListener("scroll", handleScroll)
      cancelAnimationFrame(rafRef.current)
    }
  }, [scrollRef, handleScroll])

  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })
  }, [scrollRef])

  return (
    <button
      type="button"
      onClick={scrollToTop}
      className="fixed bottom-6 right-6 z-30 grid h-9 w-9 cursor-pointer place-items-center rounded-nm-sm border border-border bg-raised text-secondary hover:text-primary"
      style={{
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? "auto" : "none",
        transform: visible ? "none" : "translateY(8px)",
        transition: "opacity 200ms ease-out, transform 200ms ease-out",
      }}
      aria-label="Back to top"
    >
      <ChevronUpIcon width={14} height={14} />
    </button>
  )
}
