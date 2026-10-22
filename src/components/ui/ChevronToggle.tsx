// src/components/ui/ChevronToggle.tsx
import { clsx } from "clsx"
import { ChevronDownSmallIcon } from "@/components/ui/Icons"

interface ChevronToggleProps {
  expanded: boolean
  variant?: "pivot" | "flip"
  className?: string
}

function ChevronToggle({ expanded, variant = "pivot", className }: ChevronToggleProps) {
  if (variant === "flip") {
    return (
      <span
        className={clsx(
          "inline-flex shrink-0 text-tertiary transition-transform duration-150 ease-in-out",
          expanded ? "rotate-0" : "rotate-180",
          className
        )}
      >
        <ChevronDownSmallIcon width="11" height="8" />
      </span>
    )
  }

  return (
    <span
      className={clsx(
        "inline-flex text-tertiary transition-transform duration-150",
        expanded ? "rotate-0" : "-rotate-90",
        className
      )}
    >
      <ChevronDownSmallIcon width="11" height="8" />
    </span>
  )
}

export type { ChevronToggleProps }
export { ChevronToggle }
