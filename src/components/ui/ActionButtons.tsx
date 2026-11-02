// src/components/ui/ActionButtons.tsx
"use client"

import { useCallback, useState } from "react"
import { Button } from "@/components/ui/Button"
import { CheckLargeIcon, CopyIcon, DownloadArrowIcon } from "@/components/ui/Icons"
import { type ClipboardOutcome, copyTextToClipboard } from "@/lib/clipboard"
import { downloadResponseBlob } from "@/lib/download"

// ── CopyButton ───────────────────────────────────────────────────────────────

interface CopyButtonProps {
  value: string
  label?: string
  className?: string
}

function CopyButton({ value, label, className }: CopyButtonProps) {
  // "idle" is not a ClipboardOutcome; the helper only reports the two results
  // that matter, and the button starts in neither of them.
  const [state, setState] = useState<ClipboardOutcome | "idle">("idle")

  const handleCopy = useCallback(async () => {
    const outcome = await copyTextToClipboard(value)
    setState(outcome)
    if (outcome === "copied") {
      setTimeout(() => setState("idle"), 2000)
    }
    // "unavailable" stays until the next attempt: the message is the point.
  }, [value])

  const copied = state === "copied"
  const unavailable = state === "unavailable"

  const icon = copied ? (
    <CheckLargeIcon width="12" height="12" className="text-success" />
  ) : (
    <CopyIcon width="12" height="12" />
  )

  // An icon-only button has no label to change when the copy fails, and a
  // silent failure makes the user paste whatever the clipboard held before.
  // Widening the button to say so is the only visible signal available here.
  const text = copied ? "Copied" : unavailable ? "Copy unavailable" : label

  return (
    <>
      <Button
        variant="secondary"
        size={text ? "sm" : "icon"}
        onClick={handleCopy}
        aria-label={unavailable ? "Clipboard unavailable" : "Copy to clipboard"}
        leftIcon={icon}
        text={text}
        className={className}
      />
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? "Copied to clipboard" : unavailable ? "Clipboard unavailable" : ""}
      </span>
    </>
  )
}

// ── DownloadButton ───────────────────────────────────────────────────────────

interface DownloadButtonProps {
  url: string
  fallbackFilename: string
  label?: string
  notFoundMessage?: string
  onError?: (message: string) => void
  className?: string
}

function DownloadButton({
  url,
  fallbackFilename,
  label,
  notFoundMessage = "File not found",
  onError,
  className,
}: DownloadButtonProps) {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleDownload = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(url)
      if (!res.ok) {
        onError?.(res.status === 404 ? notFoundMessage : "Download failed")
        return
      }
      await downloadResponseBlob(res, fallbackFilename)
      setDone(true)
      setTimeout(() => setDone(false), 2000)
    } catch {
      onError?.("Download failed")
    } finally {
      setLoading(false)
    }
  }, [url, fallbackFilename, notFoundMessage, onError])

  const icon = done ? (
    <CheckLargeIcon width="12" height="12" className="text-success" />
  ) : (
    <DownloadArrowIcon width="12" height="12" />
  )

  const text = label !== undefined ? (done ? "Done" : loading ? "…" : label) : undefined

  return (
    <Button
      variant="secondary"
      size={text ? "sm" : "icon"}
      onClick={handleDownload}
      disabled={loading}
      aria-label="Download file"
      leftIcon={icon}
      text={text}
      className={className}
    />
  )
}

export type { CopyButtonProps, DownloadButtonProps }
export { CopyButton, DownloadButton }
