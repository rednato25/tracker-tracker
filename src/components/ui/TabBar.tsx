// src/components/ui/TabBar.tsx
"use client"

import clsx from "clsx"

interface Tab<T extends string> {
  key: T
  label: string
}

interface TabBarProps<T extends string> {
  tabs: Tab<T>[]
  activeTab: T
  onChange: (tab: T) => void
  compact?: boolean
  wrap?: boolean
}

function TabBar<T extends string>({
  tabs,
  activeTab,
  onChange,
  compact = false,
  wrap = false,
}: TabBarProps<T>) {
  return (
    <div
      className={clsx(
        "border-b border-border",
        wrap
          ? "flex flex-wrap gap-x-2 gap-y-1 sm:gap-x-5"
          : clsx("flex overflow-x-auto", compact ? "gap-3" : "gap-5")
      )}
      role="tablist"
    >
      {tabs.map((tab) => {
        const active = activeTab === tab.key
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={clsx(
              "relative -mb-px shrink-0 cursor-pointer border-b-2 transition-colors duration-150",
              wrap ? "whitespace-normal text-left sm:whitespace-nowrap" : "whitespace-nowrap",
              compact
                ? "px-0 py-1.5 font-mono text-xs"
                : clsx(
                    "px-0 py-2 font-cond text-xs font-semibold uppercase",
                    wrap ? "tracking-[0.04em]" : "tracking-[0.12em]"
                  ),
              active
                ? "border-accent text-primary"
                : "border-transparent text-secondary hover:text-primary"
            )}
            aria-selected={active}
            role="tab"
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

export type { TabBarProps }
export { TabBar }
