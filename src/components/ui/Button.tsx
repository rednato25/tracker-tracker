// src/components/ui/Button.tsx
import { cva } from "class-variance-authority"
import clsx from "clsx"
import type { ButtonHTMLAttributes, ReactNode, Ref } from "react"
import { SpinnerIcon } from "@/components/ui/Icons"

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "rail" | "minimal"
type ButtonSize = "icon" | "sm" | "md" | "lg"

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  text?: string
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  loading?: boolean
  ref?: Ref<HTMLButtonElement>
}

const button = cva(
  [
    "inline-flex items-center justify-center font-cond font-semibold uppercase tracking-[0.1em]",
    "transition-colors duration-150 cursor-pointer select-none",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-control-focus)] focus-visible:ring-offset-1 focus-visible:ring-offset-base",
    "disabled:cursor-not-allowed disabled:pointer-events-none disabled:border-border! disabled:bg-elevated! disabled:text-secondary! disabled:opacity-100!",
  ],
  {
    variants: {
      variant: {
        primary: "border border-accent-fill bg-accent-fill text-on-accent hover:bg-accent-fill-hover",
        secondary:
          "border border-border bg-raised text-primary hover:border-border-emphasis hover:bg-elevated",
        ghost: "border border-transparent text-secondary hover:bg-elevated hover:text-primary",
        danger: "border border-danger bg-danger text-on-danger hover:bg-danger/90",
        rail: "border border-rail-line bg-rail-raised text-rail-text hover:border-accent hover:bg-vault-800",
        minimal: "border border-transparent text-muted hover:text-secondary",
      },
      size: {
        icon: "p-1.5 rounded-nm-sm",
        sm: "px-4 py-2 text-xs gap-2 rounded-nm-sm",
        md: "px-5 py-2 text-sm gap-2 rounded-nm-md",
        lg: "px-6 py-3 text-base gap-3 rounded-nm-md",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
)

function Button({
  variant = "primary",
  size = "md",
  text,
  leftIcon,
  rightIcon,
  loading = false,
  type = "button",
  className,
  disabled,
  children,
  style,
  ref,
  ...props
}: ButtonProps) {
  const content = children ?? text

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={clsx(button({ variant, size }), className)}
      style={style}
      {...props}
    >
      {loading ? <SpinnerIcon className="animate-spin h-4 w-4 shrink-0" /> : leftIcon}
      {content}
      {rightIcon}
    </button>
  )
}

export type { ButtonProps, ButtonSize, ButtonVariant }
export { Button, button as buttonVariants }
