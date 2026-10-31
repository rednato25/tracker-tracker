// src/components/dashboard/WhatsNext.tsx
//
// P52: the top-of-dashboard answer to "what needs me next?". At most five rows,
// soonest first. Rows are links, not actions: the tracker page owns the work.

"use client"

import Link from "next/link"
import type { WhatsNextItem } from "@/lib/whats-next"

interface WhatsNextProps {
  items: WhatsNextItem[]
}

function detailClass(kind: WhatsNextItem["kind"]): string {
  if (kind === "promotion-waiting") return "text-success"
  if (kind === "login") return "text-warn"
  if (kind === "ratio") return "text-warn"
  return "text-secondary"
}

export function WhatsNext({ items }: WhatsNextProps) {
  if (items.length === 0) return null

  return (
    <section
      aria-labelledby="whats-next-heading"
      data-whats-next
      className="flex flex-col gap-2 border border-border border-t-2 bg-raised p-4"
      style={{ borderTopColor: "var(--color-accent)" }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2
          id="whats-next-heading"
          className="font-cond text-xs font-semibold uppercase tracking-wider text-secondary"
        >
          What&apos;s next
        </h2>
        <span className="text-2xs text-tertiary">Soonest first</span>
      </div>

      <ul className="flex flex-col">
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
    </section>
  )
}
