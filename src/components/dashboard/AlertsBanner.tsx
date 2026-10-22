// src/components/dashboard/AlertsBanner.tsx
"use client"

import { cva } from "class-variance-authority"
import clsx from "clsx"
import Link from "next/link"
import { useCallback, useState } from "react"
import { XIcon } from "@/components/ui/Icons"
import type { DashboardAlert } from "@/lib/dashboard"
import { formatDateTime } from "@/lib/formatters"

// ── CVA variants ──

type AlertSeverity = "danger" | "warn" | "accent"

const alertRowVariants = cva(
  "flex items-start sm:items-center gap-2 sm:gap-3 border border-border bg-raised px-3 py-2.5 transition-transform duration-200 ease-out",
  {
    variants: {
      severity: {
        danger: "border-danger/40",
        warn: "border-warn/40",
        accent: "border-accent/40",
      },
    },
    defaultVariants: { severity: "danger" },
  }
)

const severityMark: Record<AlertSeverity, string> = {
  danger: "bg-danger",
  warn: "bg-warn",
  accent: "bg-accent",
}

// ── Type config ──

interface AlertsBannerProps {
  alerts: DashboardAlert[]
  onDismiss: (key: string, type: string) => void
  onDismissAll?: () => void
}

const typeConfig: Record<string, { severity: AlertSeverity; label: string }> = {
  error: { severity: "danger", label: "Error" },
  "ratio-danger": { severity: "danger", label: "Ratio" },
  "stale-data": { severity: "warn", label: "Stale" },
  "rank-change": { severity: "accent", label: "Rank" },
  "zero-seeding": { severity: "warn", label: "Seeds" },
  warned: { severity: "danger", label: "Warning" },
  anniversary: { severity: "accent", label: "Anniversary" },
  "update-available": { severity: "accent", label: "Update" },
  "backup-failed": { severity: "warn", label: "Backup" },
  "client-error": { severity: "danger", label: "Client" },
  "poll-paused": { severity: "danger", label: "Paused" },
}

function AlertsBanner({ alerts, onDismiss, onDismissAll }: AlertsBannerProps) {
  const [dismissing, setDismissing] = useState<Set<string>>(new Set())

  const handleDismiss = useCallback(
    (key: string, type: string) => {
      setDismissing((prev) => new Set([...prev, key]))
      setTimeout(() => {
        onDismiss(key, type)
        setDismissing((prev) => {
          const next = new Set(prev)
          next.delete(key)
          return next
        })
      }, 250)
    },
    [onDismiss]
  )

  const handleDismissAll = useCallback(() => {
    const dismissibleKeys = alerts.filter((a) => a.dismissible !== false).map((a) => a.key)
    setDismissing(new Set(dismissibleKeys))
    setTimeout(() => {
      onDismissAll?.()
      setDismissing(new Set())
    }, 250)
  }, [alerts, onDismissAll])

  if (alerts.length === 0) return null

  const dismissibleAlerts = alerts.filter((a) => a.dismissible !== false)

  return (
    <div className="flex flex-col gap-2">
      {onDismissAll && dismissibleAlerts.length > 1 && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleDismissAll}
            className="timestamp inline-flex min-h-6 items-center px-1 uppercase tracking-wider transition-colors duration-150 hover:text-secondary cursor-pointer"
          >
            Clear All
          </button>
        </div>
      )}
      {alerts.map((alert, i) => {
        const config = typeConfig[alert.type] ?? typeConfig.error
        const isDismissing = dismissing.has(alert.key)
        return (
          <div
            key={alert.key}
            className="overflow-hidden transition-all duration-200 ease-out"
            style={{
              maxHeight: isDismissing ? 0 : 80,
              marginBottom: isDismissing ? -8 : 0,
              opacity: isDismissing ? 0 : 1,
              animationName: "alertSlideIn",
              animationDuration: "200ms",
              animationTimingFunction: "ease-out",
              animationFillMode: "backwards",
              animationDelay: `${i * 30}ms`,
            }}
          >
            <div
              className={clsx(
                alertRowVariants({ severity: config.severity }),
                isDismissing ? "-translate-x-3" : "translate-x-0"
              )}
            >
              <span
                className={clsx(
                  "mt-1 h-1.5 w-1.5 shrink-0 sm:mt-0",
                  severityMark[config.severity]
                )}
                aria-hidden="true"
              />
              <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-3">
                {alert.trackerId !== null ? (
                  <Link
                    href={`/trackers/${alert.trackerId}`}
                    className="flex min-h-6 shrink-0 items-center font-cond text-4xs font-semibold uppercase tracking-[0.12em] text-secondary transition-colors duration-150 hover:text-primary"
                  >
                    {alert.trackerName}
                  </Link>
                ) : (
                  <span className="shrink-0 font-cond text-4xs font-semibold uppercase tracking-[0.12em] text-secondary">
                    {alert.trackerName}
                  </span>
                )}
                <span className="font-mono text-xs text-tertiary truncate">{alert.message}</span>
              </div>
              {alert.timestamp && (
                <span className="timestamp shrink-0 hidden sm:block">
                  {formatDateTime(alert.timestamp)}
                </span>
              )}
              {alert.dismissible !== false && (
                <button
                  type="button"
                  onClick={() => handleDismiss(alert.key, alert.type)}
                  className="mt-0.5 flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center text-muted transition-colors duration-150 hover:text-secondary sm:mt-0"
                  aria-label={`Dismiss ${config.label} alert for ${alert.trackerName}`}
                >
                  <XIcon width="12" height="12" />
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export { AlertsBanner }
