"use client"

import { H2 } from "@typography"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/Button"
import { Checkbox } from "@/components/ui/Checkbox"
import { Input } from "@/components/ui/Input"
import { Notice } from "@/components/ui/Notice"
import { Toggle } from "@/components/ui/Toggle"

interface DigestTarget {
  id: number
  name: string
  type: string
  enabled: boolean
}

interface DigestSectionProps {
  initialConfig: {
    enabled: boolean
    time: string
    timezone: string
    emptyBehavior: string
    targetIds: string | null
    quietEnabled: boolean
    quietStart: string
    quietEnd: string
    quietTimezone: string
    quietCriticalBypass: boolean
  }
}

function parseTargetIds(raw: string | null): number[] | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return null
    return parsed.filter((id): id is number => Number.isInteger(id))
  } catch {
    return null
  }
}

export function DigestSection({ initialConfig }: DigestSectionProps) {
  const [enabled, setEnabled] = useState(initialConfig.enabled)
  const [time, setTime] = useState(initialConfig.time)
  const [timezone, setTimezone] = useState(initialConfig.timezone)
  const [emptyBehavior, setEmptyBehavior] = useState(initialConfig.emptyBehavior)
  const [targetIds, setTargetIds] = useState<number[] | null>(
    parseTargetIds(initialConfig.targetIds)
  )
  const [targets, setTargets] = useState<DigestTarget[]>([])
  const [quietEnabled, setQuietEnabled] = useState(initialConfig.quietEnabled)
  const [quietStart, setQuietStart] = useState(initialConfig.quietStart)
  const [quietEnd, setQuietEnd] = useState(initialConfig.quietEnd)
  const [quietTimezone, setQuietTimezone] = useState(initialConfig.quietTimezone)
  const [quietCriticalBypass, setQuietCriticalBypass] = useState(
    initialConfig.quietCriticalBypass
  )
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch("/api/notifications")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: DigestTarget[]) => {
        if (!cancelled) setTargets(Array.isArray(data) ? data : [])
      })
      .catch(() => {
        if (!cancelled) setError("Could not load notification targets")
      })
    return () => {
      cancelled = true
    }
  }, [])

  const selected = targetIds === null ? targets.map((target) => target.id) : targetIds
  const timezonePreview = (() => {
    try {
      return new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        timeZoneName: "long",
      })
        .formatToParts(new Date())
        .find((part) => part.type === "timeZoneName")?.value
    } catch {
      return null
    }
  })()

  async function save() {
    setSaving(true)
    setMessage(null)
    setError(null)
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          digestEnabled: enabled,
          digestTime: time,
          digestTimezone: timezone,
          digestEmptyBehavior: emptyBehavior,
          digestTargetIds:
            targetIds === null || selected.length === targets.length ? null : selected,
          quietHoursEnabled: quietEnabled,
          quietHoursStart: quietStart,
          quietHoursEnd: quietEnd,
          quietHoursTimezone: quietTimezone,
          quietHoursCriticalBypass: quietCriticalBypass,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setError(data.error || "Could not save digest settings")
        return
      }
      setTargetIds(
        targetIds === null || selected.length === targets.length ? null : selected
      )
      setMessage("Digest settings saved")
    } catch {
      setError("Network error. Could not save digest settings")
    } finally {
      setSaving(false)
    }
  }

  function toggleTarget(id: number, checked: boolean) {
    const next = new Set(selected)
    if (checked) next.add(id)
    else next.delete(id)
    setTargetIds([...next])
  }

  return (
    <section className="flex flex-col gap-4 border border-border bg-raised p-4">
      <H2 className="uppercase tracking-wider">Scheduled digest</H2>
      <Toggle
        label="Enable scheduled digest"
        checked={enabled}
        onChange={setEnabled}
        description="Sends a summary of active actions. Immediate notifications keep their existing behavior."
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Send at"
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          name="digest-time"
        />
        <Input
          label="Timezone"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          placeholder="UTC"
          hint={timezonePreview ? `Schedule uses ${timezonePreview}` : "Use an IANA timezone"}
          name="digest-timezone"
        />
      </div>
      <label className="flex flex-col gap-1">
        <span className="font-cond text-4xs font-semibold uppercase tracking-[0.14em] text-secondary">
          When there is nothing to report
        </span>
        <select
          className="w-full border border-border bg-field px-3 py-2 font-mono text-sm text-primary"
          value={emptyBehavior}
          onChange={(e) => setEmptyBehavior(e.target.value)}
        >
          <option value="skip">Skip this digest</option>
          <option value="send">Send an all-clear summary</option>
        </select>
      </label>
      <div className="flex flex-col gap-2">
        <span className="font-cond text-4xs font-semibold uppercase tracking-[0.14em] text-secondary">
          Destinations (all enabled targets by default)
        </span>
        {targets.length === 0 ? (
          <p className="font-mono text-4xs text-muted">No notification targets configured.</p>
        ) : (
          targets.map((target) => (
            <Checkbox
              key={target.id}
              checked={selected.includes(target.id)}
              onChange={(checked) => toggleTarget(target.id, checked)}
              label={`${target.name} (${target.type})`}
              disabled={!target.enabled}
            />
          ))
        )}
        {selected.length === 0 && targets.length > 0 && (
          <p className="font-mono text-4xs text-warn">
            No destinations selected; the digest will not send.
          </p>
        )}
      </div>
      <div className="border-t border-border" />
      <H2 className="uppercase tracking-wider">Quiet hours</H2>
      <Toggle
        label="Enable quiet hours"
        checked={quietEnabled}
        onChange={setQuietEnabled}
        description="Routine immediate notifications are coalesced into the next summary. Nothing is dropped; resolved items are omitted. Critical bypass is explicit below."
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <Input
          label="Start"
          type="time"
          value={quietStart}
          onChange={(e) => setQuietStart(e.target.value)}
          name="quiet-hours-start"
        />
        <Input
          label="End"
          type="time"
          value={quietEnd}
          onChange={(e) => setQuietEnd(e.target.value)}
          name="quiet-hours-end"
        />
        <Input
          label="Timezone"
          value={quietTimezone}
          onChange={(e) => setQuietTimezone(e.target.value)}
          placeholder="UTC"
          hint="Explicit IANA timezone; handles DST and midnight crossing"
          name="quiet-hours-timezone"
        />
      </div>
      <Checkbox
        checked={quietCriticalBypass}
        onChange={setQuietCriticalBypass}
        label="Let hit-and-run and tracker-down events bypass quiet hours"
        disabled={!quietEnabled}
      />
      <p className="font-mono text-4xs text-muted">
        No other event bypasses quiet hours. Non-critical events are summarized after the window.
      </p>
      <Notice message={message} />
      <Notice message={error} />
      <div className="flex items-center gap-2">
        <Button size="sm" variant="primary" onClick={save} disabled={saving} text="Save digest" />
      </div>
    </section>
  )
}
