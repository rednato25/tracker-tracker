"use client"

import { H2 } from "@typography"
import { useState } from "react"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Notice } from "@/components/ui/Notice"
import { Toggle } from "@/components/ui/Toggle"

interface Item {
  indexerId: string
  name: string
  implementation: string
  baseUrl: string | null
  status: "ready" | "already-added" | "ambiguous" | "unsupported"
  matchedName: string | null
  reason: string
  credentialNote: string | null
}

export function JackettImportSection() {
  const [url, setUrl] = useState("")
  const [password, setPassword] = useState("")
  const [allowPrivate, setAllowPrivate] = useState(false)
  const [items, setItems] = useState<Item[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const body = { jackettUrl: url.trim(), jackettPassword: password, jackettAllowPrivate: allowPrivate }

  async function preview() {
    setBusy(true); setError(null); setMessage(null)
    try {
      const res = await fetch("/api/integrations/jackett/preview", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      })
      const data = (await res.json().catch(() => ({}))) as { items?: Item[]; error?: string }
      if (!res.ok) { setError(data.error || "Jackett preview failed"); return }
      setItems(data.items ?? [])
      setSelected(new Set((data.items ?? []).filter((item) => item.status === "ready").map((item) => item.indexerId)))
      setMessage(`${data.items?.length ?? 0} indexers loaded`)
    } catch { setError("Network error while contacting Jackett") } finally { setBusy(false) }
  }

  async function importSelected() {
    setBusy(true); setError(null); setMessage(null)
    try {
      const res = await fetch("/api/integrations/jackett/import", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, indexerIds: [...selected] }),
      })
      const data = (await res.json().catch(() => ({}))) as { created?: number[]; skipped?: unknown[]; error?: string }
      if (!res.ok) { setError(data.error || "Jackett import failed"); return }
      setMessage(`${data.created?.length ?? 0} tracker(s) created; ${data.skipped?.length ?? 0} skipped. Configure credentials and polling separately.`)
      setItems((current) => current.map((item) => selected.has(item.indexerId) && item.status === "ready" ? { ...item, status: "already-added", reason: "Imported in this run" } : item))
      setSelected(new Set())
    } catch { setError("Network error while importing from Jackett") } finally { setBusy(false) }
  }

  return (
    <section className="flex flex-col gap-4 border border-border bg-raised p-4" data-jackett-import>
      <div>
        <H2 className="uppercase tracking-wider">Jackett import</H2>
        <p className="mt-1 text-xs text-secondary">
          Read-only import of configured Jackett indexers. The admin password is used only for this request and is not stored; indexer secrets are never copied.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Jackett URL" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="http://jackett:9117" name="jackett-url" autoComplete="off" />
        <Input label="Jackett admin password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Admin password" name="jackett-password" autoComplete="off" data-1p-ignore />
      </div>
      <Toggle label="Allow private network" checked={allowPrivate} onChange={setAllowPrivate} description="Required for a home-server Jackett on a private/local address." />
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="primary" onClick={preview} disabled={busy || !url.trim() || !password} text={busy ? "Checking…" : "Test and preview"} />
        <span className="font-mono text-4xs text-muted">Read-only: indexers are listed, never modified.</span>
      </div>
      <Notice message={message} />
      <Notice message={error} />
      {items.length > 0 && (
        <div className="border-t border-border pt-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <H2 className="uppercase tracking-wider">Preview</H2>
            <Button size="sm" variant="secondary" onClick={importSelected} disabled={busy || selected.size === 0} text={`Import selected (${selected.size})`} />
          </div>
          <ul className="mt-1">
            {items.map((item) => (
              <li key={item.indexerId} className="w-full border-t border-border py-2">
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                  <label className="flex min-w-0 items-start gap-2">
                    <input type="checkbox" className="mt-1" checked={selected.has(item.indexerId)} disabled={item.status !== "ready"} onChange={(e) => {
                      const next = new Set(selected); if (e.target.checked) next.add(item.indexerId); else next.delete(item.indexerId); setSelected(next)
                    }} aria-label={`Select ${item.name}`} />
                    <span className="min-w-0 break-words">
                      <span className="text-xs text-primary">{item.name}</span>
                      <span className="ml-2 font-mono text-4xs text-muted">{item.implementation}</span>
                      {item.baseUrl && <span className="ml-2 break-all font-mono text-4xs text-tertiary">{item.baseUrl}</span>}
                    </span>
                  </label>
                  <Badge variant={item.status === "ready" ? "success" : item.status === "already-added" ? "default" : "warn"}>{item.status.replace("-", " ")}</Badge>
                </div>
                <p className="mt-1 w-full break-words font-mono text-4xs text-secondary">{item.matchedName ? `Matched: ${item.matchedName}. ` : ""}{item.reason}</p>
                {item.credentialNote && <p className="w-full break-all font-mono text-4xs text-warn">{item.credentialNote}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
