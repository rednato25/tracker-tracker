// src/components/dashboard/WhatsNext.tsx
//
// P52: the dashboard answer to "what needs me next?". At most five rows,
// soonest first. Rows are links, not actions: the tracker page owns the work.
// P66: the panel sits below the totals and collapses through the dashboard's
// shared section toggle.

"use client"

import Link from "next/link"
import { SectionToggle } from "@/components/ui/SectionToggle"
import type { WhatsNextItem } from "@/lib/whats-next"

interface WhatsNextProps {
  items: WhatsNextItem[]
  expanded: boolean
  onToggleExpanded: () => void
}

function detailClass(kind: WhatsNextItem["kind"]): string {
  if (kind === "promotion-waiting") return "text-success"
  if (kind === "login") return "text-warn"
  if (kind === "ratio") return "text-warn"
  return "text-secondary"
}

export function WhatsNext({ items, expanded, onToggleExpanded }: WhatsNextProps) {
  if (items.length === 0) return null

  return (
    <section aria-label="What's next" data-whats-next className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <SectionToggle label="What's next" expanded={expanded} onToggle={onToggleExpanded} />
        <span className="text-2xs text-tertiary">Soonest first</span>
      </div>

      {expanded && (
        <ul
          className="flex flex-col border border-border border-t-2 bg-raised p-4"
          style={{ borderTopColor: "var(--color-accent)" }}
        >
          {items.map((item, index) => (
            <li
              key={item.id}
              data-whats-next-row
              data-whats-next-kind={item.kind}
              className={index > 0 ? "border-t border-border" : undefined}
            >
              <Link
                href={item.href}
                className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-0.5 py-2 hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-focus)] focus-visible:ring-offset-1"
              >
                <span
                  className="color-dot row-span-2 self-center"
                  style={{ backgroundColor: item.color || "var(--color-accent)" }}
                  aria-hidden="true"
                />
                <span className="min-w-0 break-words text-xs text-primary">{item.title}</span>
                <span
                  className={`min-w-0 break-words text-2xs ${detailClass(item.kind)}`}
                  data-whats-next-detail
                >
                  {item.detail}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
