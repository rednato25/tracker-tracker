// src/components/ui/DeadlineRing.tsx
//
// The countdown ring shared by the dashboard Login timers and the compact ring
// in each tracker card footer. Geometry lives here once, so both sizes draw the
// same circle and expose one accessible label.

"use client"

import clsx from "clsx"
import type { ReactNode } from "react"

interface DeadlineRingProps {
  /** 0 (just started) to 1 (deadline reached). Clamped before drawing. */
  progress: number
  color: string
  ariaLabel: string
  children: ReactNode
  size?: number
  strokeWidth?: number
  className?: string
}

function DeadlineRing({
  progress,
  color,
  ariaLabel,
  children,
  size = 80,
  strokeWidth = 6,
  className,
}: DeadlineRingProps) {
  const clamped = Math.min(Math.max(progress, 0), 1)
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  // Round to 2 decimal places to prevent SSR/client hydration mismatch
  const dashOffset = Math.round(circumference * clamped * 100) / 100

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className={clsx("relative shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{
            transition: "stroke-dashoffset 0.5s ease, stroke 0.3s ease",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  )
}

export type { DeadlineRingProps }
export { DeadlineRing }
