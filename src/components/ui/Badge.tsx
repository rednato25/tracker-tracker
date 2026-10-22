// src/components/ui/Badge.tsx
import { cva } from "class-variance-authority"
import clsx from "clsx"
import type { HTMLAttributes } from "react"

type BadgeVariant = "default" | "accent" | "warn" | "danger" | "success"

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

const badge = cva(
  "inline-flex items-center border border-current/20 px-1.5 py-0.5 font-cond text-4xs font-semibold uppercase tracking-[0.1em]",
  {
  variants: {
    variant: {
      default: "bg-elevated text-secondary",
      accent: "border-accent/30 bg-accent-dim text-primary",
      warn: "border-warn/30 bg-warn-dim text-primary",
      danger: "border-danger/30 bg-danger-dim text-primary",
      success: "border-success/30 bg-success-dim text-primary",
    },
  },
  defaultVariants: {
    variant: "default",
  },
})

function Badge({ variant = "default", className, style, children, ...props }: BadgeProps) {
  return (
    <span
      className={clsx(badge({ variant }), "rounded-nm-pill", className)}
      style={style}
      {...props}
    >
      {children}
    </span>
  )
}

export type { BadgeProps, BadgeVariant }
export { Badge }
