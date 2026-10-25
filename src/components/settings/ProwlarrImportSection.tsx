"use client"

import { H2 } from "@typography"
import { useState } from "react"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Notice } from "@/components/ui/Notice"
import { Toggle } from "@/components/ui/Toggle"

interface PreviewItem {
  indexerId: number
  name: string
  implementation: string
  baseUrl: string | null
  status: "ready" | "already-added" | "ambiguous" | "unsupported"
  matchedSlug: string | null
  matchedName: string | null
  reason: string
  credentialNote: string | null
}

interface ProwlarrImportSectionProps {
  initialUrl: string | null
  initialHasKey: boolean
  initialAllowPrivate: boolean
}

function statusVariant(status: PreviewItem["status"]) {
  if (status === "ready") return "success" as const
  if (status === "already-added") return "default" as const
  return "warn" as const
}

export function ProwlarrImportSection({
  initialUrl,
  initialHasKey,
  initialAllowPrivate,
}: ProwlarrImportSectionProps) {
  const [url, setUrl] = useState(initialUrl ?? "")
  const [apiKey, setApiKey] = useState("")
  const [allowPrivate, setAllowPrivate] = useState(initialAllowPrivate)
  const [hasKey, setHasKey] = useState(initialHasKey)
  const [items, setItems] = useState<PreviewItem[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function testAndPreview() {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const settingsRes = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prowlarrUrl: url.trim() || null,
          prowlarrAllowPrivate: allowPrivate,
          ...(apiKey.trim() ? { prowlarrApiKey: apiKey.trim() } : {}),
        }),
      })
      const settingsBody = (await settingsRes.json().catch(() => ({}))) as { error?: string }
      if (!settingsRes.ok) {
        setError(settingsBody.error || "Could not save Prowlarr settings")
        return
      }
      if (apiKey.trim()) setHasKey(true)
      const previewRes = await fetch("/api/integrations/prowlarr/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prowlarrUrl: url.trim(),
          prowlarrAllowPrivate: allowPrivate,
          ...(apiKey.trim() ? { prowlarrApiKey: apiKey.trim() } : {}),
        }),
      })
      const previewBody = (await previewRes.json().catch(() => ({}))) as {
        items?: PreviewItem[]
        error?: string
      }
      if (!previewRes.ok) {
        setError(previewBody.error || "Prowlarr preview failed")
        return
      }
      setItems(previewBody.items ?? [])
      setSelected(
        new Set((previewBody.items ?? []).filter((item) => item.status === "ready").map((item) => item.indexerId))
      )
      setMessage(`${previewBody.items?.length ?? 0} indexers loaded`)
      setApiKey("")
    } catch {
      setError("Network error while contacting Prowlarr")
    } finally {
      setBusy(false)
    }
  }

  async function importSelected() {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch("/api/integrations/prowlarr/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ indexerIds: [...selected] }),
      })
      const body = (await res.json().catch(() => ({}))) as {
        created?: number[]
        skipped?: { indexerId: number; reason: string }[]
        error?: string
      }
      if (!res.ok) {
        setError(body.error || "Prowlarr import failed")
        return
      }
      setMessage(
        `${body.created?.length ?? 0} tracker(s) created; ${body.skipped?.length ?? 0} skipped. Configure credentials and polling separately.`
      )
      setItems((current) =>
        current.map((item) =>
          selected.has(item.indexerId) && item.status === "ready"
            ? { ...item, status: "already-added", reason: "Imported in this run" }
            : item
        )
      )
      setSelected(new Set())
    } catch {
      setError("Network error while importing from Prowlarr")
    } finally {
      setBusy(false)
    }
  }

  function toggle(id: number, checked: boolean) {
    const next = new Set(selected)
    if (checked) next.add(id)
    else next.delete(id)
    setSelected(next)
  }

  return (
    <section className="flex flex-col gap-4 border border-border bg-raised p-4" data-prowlarr-import>
      <div>
        <H2 className="uppercase tracking-wider">Prowlarr import</H2>
        <p className="mt-1 text-xs text-secondary">
          Import supported trackers from Prowlarr. The Prowlarr API key authenticates Prowlarr only;
          tracker credentials are never copied.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Prowlarr URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="http://prowlarr:9696"
          name="prowlarr-url"
          autoComplete="off"
        />
        <Input
          label={hasKey ? "Prowlarr API key (configured)" : "Prowlarr API key"}
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={hasKey ? "Leave blank to keep current key" : "API key"}
          name="prowlarr-api-key"
          autoComplete="off"
          data-1p-ignore
        />
      </div>
      <Toggle
        label="Allow private network"
        checked={allowPrivate}
        onChange={setAllowPrivate}
        description="Required for a home-server Prowlarr on a private/local address."
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="primary"
          onClick={testAndPreview}
          disabled={busy || !url.trim() || (!hasKey && !apiKey.trim())}
          text={busy ? "Checking…" : "Test and preview"}
        />
        <span className="font-mono text-4xs text-muted">Read-only: indexers are listed, never modified.</span>
      </div>
      <Notice message={message} />
      <Notice message={error} />
      {items.length > 0 && (
        <div className="border-t border-border pt-2">
          <div className="flex items-center justify-between gap-2">
            <H2 className="uppercase tracking-wider">Preview</H2>
            <Button
              size="sm"
              variant="secondary"
              onClick={importSelected}
              disabled={busy || selected.size === 0}
              text={`Import selected (${selected.size})`}
            />
          </div>
          <ul className="mt-1">
            {items.map((item) => (
              <li key={item.indexerId} className="border-t border-border py-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={selected.has(item.indexerId)}
                      disabled={item.status !== "ready"}
                      onChange={(e) => toggle(item.indexerId, e.target.checked)}
                      aria-label={`Select ${item.name}`}
                    />
                    <span>
                      <span className="text-xs text-primary">{item.name}</span>
                      <span className="ml-2 font-mono text-4xs text-muted">{item.implementation}</span>
                      {item.baseUrl && (
                        <span className="ml-2 font-mono text-4xs text-tertiary">{item.baseUrl}</span>
                      )}
                    </span>
                  </label>
                  <Badge variant={statusVariant(item.status)}>{item.status.replace("-", " ")}</Badge>
                </div>
                <p className="mt-1 font-mono text-4xs text-secondary">
                  {item.matchedName ? `Matched: ${item.matchedName}. ` : ""}
                  {item.reason}
                </p>
                {item.credentialNote && (
                  <p className="font-mono text-4xs text-warn">{item.credentialNote}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
