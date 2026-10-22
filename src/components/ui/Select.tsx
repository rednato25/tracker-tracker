// src/components/ui/Select.tsx

"use client"

import clsx from "clsx"
import { useId, useRef, useState } from "react"
import { ChevronDownSmallIcon } from "@/components/ui/Icons"
import { useClickOutside } from "@/hooks/useClickOutside"

type SelectSize = "sm" | "md"

interface SelectOption<T extends string> {
  value: T
  label: string
  disabled?: boolean
}

interface SelectProps<T extends string> {
  value: T
  options: SelectOption<T>[]
  onChange: (value: T) => void
  ariaLabel: string
  label?: string
  size?: SelectSize
  className?: string
}

const sizeStyles: Record<SelectSize, { trigger: string; option: string; radius: string }> = {
  sm: {
    trigger: "text-xs px-2 py-1.5 nm-inset-sm rounded-nm-sm",
    option: "px-2 py-1.5 text-xs",
    radius: "var(--radius-sm)",
  },
  md: {
    trigger: "text-sm px-3 py-2 nm-inset rounded-nm-md",
    option: "px-3 py-2 text-sm",
    radius: "var(--radius-md)",
  },
}

function Select<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  label,
  size = "sm",
  className,
}: SelectProps<T>) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const generatedId = useId()
  const s = sizeStyles[size]

  const selectedLabel = options.find((o) => o.value === value)?.label ?? value

  useClickOutside(ref, () => setOpen(false), open)

  return (
    <div ref={ref} className={clsx("relative flex-1 min-w-0", className)}>
      {label && (
        <label
          htmlFor={generatedId}
          className="mb-1 block font-cond text-4xs font-semibold text-secondary uppercase tracking-[0.14em]"
        >
          {label}
        </label>
      )}
      <button
        type="button"
        id={generatedId}
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          "w-full bg-control-bg text-primary font-mono flex items-center justify-between gap-1 cursor-pointer border-0",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-control-focus)] focus-visible:ring-offset-1 focus-visible:ring-offset-base",
          s.trigger
        )}
        aria-label={ariaLabel}
        aria-expanded={open}
      >
        <span className="truncate">{selectedLabel}</span>
        <span className="shrink-0 text-tertiary" aria-hidden="true">
          <ChevronDownSmallIcon width="10" height="7" />
        </span>
      </button>

      {open && (
        <div
          className="absolute top-full left-0 right-0 mt-1 z-40 bg-overlay nm-float-sm py-1 overflow-hidden rounded-nm-md"
          role="listbox"
          aria-label={ariaLabel}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              aria-disabled={option.disabled || undefined}
              disabled={option.disabled}
              onClick={() => {
                onChange(option.value)
                setOpen(false)
              }}
              className={clsx(
                "w-full text-left font-mono transition-colors duration-100",
                s.option,
                option.disabled
                  ? "text-muted cursor-not-allowed opacity-50"
                  : option.value === value
                    ? "text-accent bg-accent-dim cursor-pointer"
                    : "text-secondary hover:text-primary hover:bg-elevated cursor-pointer"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export type { SelectOption, SelectProps, SelectSize }
export { Select }
