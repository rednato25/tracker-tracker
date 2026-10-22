// src/components/ui/Card.tsx
import { H2 } from "@typography"
import { cva } from "class-variance-authority"
import clsx from "clsx"
import type { HTMLAttributes } from "react"

type CardElevation = "raised" | "elevated"

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  elevation?: CardElevation
  glow?: boolean
  glowColor?: string
  trackerColor?: string
  title?: string
  subtitle?: string
  lazy?: boolean
}

const card = cva("border border-border p-4", {
  variants: {
    elevation: {
      raised: "bg-raised",
      elevated: "bg-elevated",
    },
  },
  defaultVariants: {
    elevation: "raised",
  },
})

function Card({
  elevation = "raised",
  glow: _glow = false,
  glowColor: _glowColor,
  trackerColor: _trackerColor,
  title,
  subtitle,
  lazy,
  className,
  style,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={clsx(card({ elevation }), "rounded-nm-lg", lazy && "lazy-card", className)}
      style={style}
      {...props}
    >
      {(title || subtitle) && (
        <div className="flex flex-col gap-1">
          {title && <H2 className="card-heading">{title}</H2>}
          {subtitle && <p className="text-xs font-mono text-tertiary">{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  )
}

export type { CardElevation, CardProps }
export { Card }
