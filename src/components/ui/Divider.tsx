// src/components/ui/Divider.tsx

import clsx from "clsx"

interface DividerProps {
  /** Removes horizontal margin for use inside cards/sheets */
  compact?: boolean
  className?: string
}

function Divider({ className }: DividerProps) {
  return <div className={clsx("h-px w-full bg-border", className)} />
}

export { Divider }
