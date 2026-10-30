// src/components/dashboard/TrackerChecksStrip.tsx

import clsx from "clsx"
import type { TrackerChecks, TrackerCheckTone } from "@/lib/tracker-checks"

const TONE_MARK: Record<TrackerCheckTone, string> = {
  ok: "bg-success",
  warn: "bg-warn",
  crit: "bg-danger",
  muted: "bg-muted",
}

function TrackerChecksStrip({ checks, className }: { checks: TrackerChecks; className?: string }) {
  return (
    <span
      className={clsx("flex items-center gap-2", className)}
      aria-label={checks.known ? `Checks: ${checks.passed} of 4` : "Checks unknown"}
      role="img"
    >
      <span className="flex h-[7px] w-[92px] shrink-0 gap-[2px]" aria-hidden="true">
        {checks.segments.map((tone, index) => (
          <span key={index} className={clsx("block h-full flex-1", TONE_MARK[tone])} />
        ))}
      </span>
      <span className="font-mono text-xs text-secondary">
        {checks.known ? `${checks.passed}/4` : "\u2014"}
      </span>
    </span>
  )
}

export { TrackerChecksStrip }
