// src/components/settings/IntegrationsSection.tsx
//
// P16 token management: create (one-time plaintext), list metadata, and revoke.
// The section also owns the explicit tracker-identity disclosure setting used by
// the read-only API. Tokens are never fetched back from the server.

"use client"

import { Paragraph } from "@typography"
import { useCallback, useEffect, useState } from "react"
import { SettingsSection } from "@/components/settings/SettingsSection"
import { Button, Checkbox, ConfirmAction, Input, Notice, Select } from "@/components/ui"
import { usePatchSettings } from "@/hooks/usePatchSettings"
import { extractApiError } from "@/lib/extract-api-error"
import {
  INTEGRATION_SCOPE_DESCRIPTIONS,
  INTEGRATION_SCOPE_LABELS,
  INTEGRATION_SCOPES,
  type IntegrationIdentityMode,
  type IntegrationScope,
  isIntegrationScope,
} from "@/lib/integration-scopes"

interface IntegrationTokenRecord {
  id: number
  name: string
  scopes: IntegrationScope[]
  createdAt: string
  lastUsedAt: string | null
  revokedAt: string | null
}

export interface IntegrationsSectionProps {
  initialIdentityMode: IntegrationIdentityMode
}

const IDENTITY_OPTIONS: { value: IntegrationIdentityMode; label: string }[] = [
  { value: "none", label: "Hidden (recommended)" },
  { value: "trackers", label: "Tracker names" },
  { value: "full", label: "Tracker names and usernames" },
]

function formatTimestamp(value: string | null): string {
  if (!value) return "Never"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString()
}

export function IntegrationsSection({ initialIdentityMode }: IntegrationsSectionProps) {
  const [identityMode, setIdentityMode] =
    useState<IntegrationIdentityMode>(initialIdentityMode)
  const [tokens, setTokens] = useState<IntegrationTokenRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState("")
  const [scopes, setScopes] = useState<IntegrationScope[]>([...INTEGRATION_SCOPES])
  const [createdToken, setCreatedToken] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [revokingId, setRevokingId] = useState<number | null>(null)
  const [confirmingId, setConfirmingId] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { saving, error: settingsError, patch } = usePatchSettings()

  const loadTokens = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/settings/integration-tokens")
      if (!res.ok) throw new Error(await extractApiError(res, "Failed to load tokens"))
      const data = (await res.json()) as { tokens?: IntegrationTokenRecord[] }
      setTokens(
        (data.tokens ?? []).map((token) => ({
          ...token,
          scopes: token.scopes.filter(isIntegrationScope),
        }))
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tokens")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadTokens()
  }, [loadTokens])

  async function handleIdentityChange(value: string) {
    const next = value as IntegrationIdentityMode
    const result = await patch({ integrationIdentityMode: next })
    if (result.ok) {
      const returned = result.data.integrationIdentityMode
      setIdentityMode(
        returned === "trackers" || returned === "full" || returned === "none"
          ? returned
          : next
      )
    }
  }

  function toggleScope(scope: IntegrationScope, checked: boolean) {
    setScopes((current) =>
      checked ? [...new Set([...current, scope])] : current.filter((item) => item !== scope)
    )
  }

  async function handleCreate() {
    setError(null)
    setCreatedToken(null)
    setCopied(false)
    if (!name.trim()) {
      setError("Give the token a name so you can recognize it later")
      return
    }
    if (scopes.length === 0) {
      setError("Select at least one read scope")
      return
    }
    setCreating(true)
    try {
      const res = await fetch("/api/settings/integration-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), scopes }),
      })
      if (!res.ok) throw new Error(await extractApiError(res, "Token creation failed"))
      const data = (await res.json()) as { token: string; record: IntegrationTokenRecord }
      setCreatedToken(data.token)
      setTokens((current) => [
        { ...data.record, scopes: data.record.scopes.filter(isIntegrationScope) },
        ...current,
      ])
      setName("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Token creation failed")
    } finally {
      setCreating(false)
    }
  }

  async function handleRevoke(id: number) {
    setError(null)
    setRevokingId(id)
    try {
      const res = await fetch(`/api/settings/integration-tokens/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error(await extractApiError(res, "Token revocation failed"))
      setTokens((current) => current.filter((token) => token.id !== id))
      setConfirmingId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Token revocation failed")
    } finally {
      setRevokingId(null)
    }
  }

  async function handleCopy() {
    if (!createdToken) return
    try {
      await navigator.clipboard.writeText(createdToken)
      setCopied(true)
    } catch {
      setError("Clipboard access failed. Select the token and copy it manually.")
    }
  }

  return (
    <SettingsSection
      id="integrations"
      title="Integrations"
      tooltip="Read-only bearer tokens for homelab widgets. Tokens are hashed at rest and never authorize admin or mutation routes."
      cardClassName="flex flex-col gap-6"
    >
      <Notice
        variant="info"
        box
        message="This API is read-only. Requests read stored data and never trigger polling, searches or downloads. Tokens are shown once and stored only as hashes."
      />

      <div className="flex flex-col gap-2">
        <Select
          value={identityMode}
          options={IDENTITY_OPTIONS}
          onChange={handleIdentityChange}
          ariaLabel="Tracker identity disclosure"
          label="Tracker identity in API responses"
          size="md"
        />
        <Paragraph className="text-xs text-secondary">
          Hidden is the default. Tracker names reveal which sites you use; usernames are added
          only when both the full mode and username storage are enabled. Base URLs, credentials
          and raw errors are never returned.
        </Paragraph>
        <Notice message={settingsError} />
      </div>

      <div className="flex flex-col gap-4 border-t border-border pt-5">
        <div className="flex flex-col gap-1">
          <h3 className="font-cond text-sm font-semibold uppercase tracking-[0.12em] text-primary">
            Create a token
          </h3>
          <Paragraph className="text-xs text-secondary">
            Give each widget its own token. Revoking one does not affect the others.
          </Paragraph>
        </div>

        <Input
          label="Token name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Living-room dashboard"
          maxLength={100}
          disabled={creating}
        />

        <fieldset className="flex flex-col gap-3">
          <legend className="font-cond text-4xs font-semibold uppercase tracking-[0.14em] text-secondary">
            Read scopes
          </legend>
          {INTEGRATION_SCOPES.map((scope) => (
            <Checkbox
              key={scope}
              checked={scopes.includes(scope)}
              onChange={(checked) => toggleScope(scope, checked)}
              disabled={creating}
            >
              <span className="font-mono text-xs text-primary">
                {INTEGRATION_SCOPE_LABELS[scope]}
              </span>
              <span className="block text-xs text-secondary">
                {INTEGRATION_SCOPE_DESCRIPTIONS[scope]}
              </span>
            </Checkbox>
          ))}
        </fieldset>

        <div>
          <Button
            text={creating ? "Creating..." : "Create token"}
            onClick={handleCreate}
            loading={creating}
            disabled={saving}
          />
        </div>

        {createdToken && (
          <Notice variant="warn" box header="Copy this token now">
            <div className="flex flex-col gap-3">
              <code
                data-integration-token
                className="block break-all rounded-nm-sm bg-control-bg px-3 py-2 font-mono text-xs text-primary"
              >
                {createdToken}
              </code>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  text={copied ? "Copied" : "Copy token"}
                  onClick={handleCopy}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  text="Dismiss"
                  onClick={() => {
                    setCreatedToken(null)
                    setCopied(false)
                  }}
                />
              </div>
              <span className="text-xs text-secondary">
                It will not be shown again. Store it in your widget's configuration now.
              </span>
            </div>
          </Notice>
        )}

        <Notice message={error} />
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-5">
        <h3 className="font-cond text-sm font-semibold uppercase tracking-[0.12em] text-primary">
          Active tokens
        </h3>
        {loading ? (
          <p className="font-mono text-xs text-secondary">Loading tokens...</p>
        ) : tokens.length === 0 ? (
          <p className="font-mono text-xs text-secondary">No active integration tokens.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {tokens.map((token) => (
              <li
                key={token.id}
                className="flex flex-col gap-2 rounded-nm-sm border border-border bg-control-bg px-3 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-sm text-primary">{token.name}</p>
                    <p className="text-xs text-secondary">
                      Created {formatTimestamp(token.createdAt)} · Last used{" "}
                      {formatTimestamp(token.lastUsedAt)}
                    </p>
                    <p className="mt-1 flex flex-wrap gap-2 font-mono text-2xs text-tertiary">
                      {token.scopes.map((scope) => (
                        <span key={scope} className="rounded-nm-sm border border-border px-1.5 py-0.5">
                          {scope}
                        </span>
                      ))}
                    </p>
                  </div>
                  {confirmingId !== token.id && (
                    <Button
                      size="sm"
                      variant="danger"
                      text="Revoke"
                      onClick={() => setConfirmingId(token.id)}
                      disabled={revokingId !== null}
                    />
                  )}
                </div>
                {confirmingId === token.id && (
                  <ConfirmAction
                    message={`Revoke "${token.name}"? Any widget using it will stop working immediately.`}
                    confirmLabel="Revoke token"
                    confirming={revokingId === token.id}
                    onConfirm={() => void handleRevoke(token.id)}
                    onCancel={() => setConfirmingId(null)}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </SettingsSection>
  )
}
