// src/lib/download-budget.ts
//
// P12 pure download-budget calculator. All quantities must be in the same
// unit. This is arithmetic only: it cannot certify an account as "safe to
// download" and it does not model per-torrent H&R/seed obligations.

export type DownloadBudgetStatus =
  | "available"
  | "scenario-only"
  | "unavailable"
  | "not-applicable"

export interface DownloadBudgetInput {
  /** Accounted upload. */
  uploaded: number | null
  /** Accounted download already counted by the tracker. */
  downloaded: number | null
  /** Proposed torrent size. */
  size: number | null
  /** Explicit charged fraction of size, 0..1. null = unknown accounting. */
  chargedFraction: number | null
  /** Positive user-selected ratio target, not the tracker minimum. */
  targetRatio: number | null
  /** Additional charged traffic already committed but not in downloaded. */
  committedDownload?: number | null
  /** Charged-traffic reserve, not the raw upload/download buffer. */
  reserveChargedBytes?: number | null
  /** The tracker's minimum ratio, kept separate from the user target. */
  minimumRatio?: number | null
}

export interface DownloadBudgetResult {
  status: DownloadBudgetStatus
  chargedBytes: number | null
  projectedDownloaded: number | null
  projectedRatio: number | null
  headroom: number | null
  /** Charged traffic available before the proposed download. */
  remainingChargedAllowance: number | null
  /** Charged traffic available after this proposal (the UI's main number). */
  remainingChargedAfterProposed: number | null
  /** Physical size allowance at the charged fraction. */
  transferBudget: number | null
  additionalUploadRequired: number | null
  reserveChargedBytes: number
  targetRatio: number | null
  assumptions: string[]
  /** Arithmetic never asserts that the download is operationally safe. */
  safetyVerdict: "not-assessed"
  reason: string
}

function nonNegative(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
}

function unavailable(reason: string, assumptions: string[] = []): DownloadBudgetResult {
  return {
    status: "unavailable",
    chargedBytes: null,
    projectedDownloaded: null,
    projectedRatio: null,
    headroom: null,
    remainingChargedAllowance: null,
    remainingChargedAfterProposed: null,
    transferBudget: null,
    additionalUploadRequired: null,
    reserveChargedBytes: 0,
    targetRatio: null,
    assumptions,
    safetyVerdict: "not-assessed",
    reason,
  }
}

/**
 * Computes projected ratio, headroom and additional allowance at the chosen
 * target ratio. A null/unknown accounting fraction is unavailable; an explicit
 * zero fraction is an explicitly labelled scenario, never unlimited safe space.
 */
export function calculateDownloadBudget(input: DownloadBudgetInput): DownloadBudgetResult {
  const target = input.targetRatio
  if (target === 0) {
    return {
      ...unavailable("Tracker has no ratio requirement; not applicable."),
      status: "not-applicable",
    }
  }
  if (target !== null && (!Number.isFinite(target) || target < 0)) {
    return unavailable("Target ratio must be a positive finite number.")
  }
  if (target === null) return unavailable("A positive target ratio is required.")

  if (!nonNegative(input.uploaded) || !nonNegative(input.downloaded) || !nonNegative(input.size)) {
    return unavailable("Uploaded, downloaded and size must be known non-negative numbers.")
  }
  const committed = input.committedDownload ?? 0
  const reserve = input.reserveChargedBytes ?? 0
  if (!nonNegative(committed) || !nonNegative(reserve)) {
    return unavailable("Committed traffic and reserve must be non-negative numbers.")
  }
  const chargedFraction = input.chargedFraction
  if (chargedFraction === null) {
    return unavailable("Accounting charged fraction is unknown; a verified allowance cannot be computed.")
  }
  if (!Number.isFinite(chargedFraction) || chargedFraction < 0 || chargedFraction > 1) {
    return unavailable("Accounting charged fraction must be between 0 and 1.")
  }

  const chargedBytes = input.size * chargedFraction
  const projectedDownloaded = input.downloaded + committed + chargedBytes
  const projectedRatio = projectedDownloaded > 0 ? input.uploaded / projectedDownloaded : null
  const headroom = input.uploaded / target - input.downloaded - committed
  const usableHeadroom = Math.max(0, headroom - reserve)
  const remainingChargedAfterProposed = Math.max(0, usableHeadroom - chargedBytes)
  const transferBudget =
    chargedFraction > 0 && Number.isFinite(usableHeadroom) ? usableHeadroom / chargedFraction : null
  const additionalUploadRequired =
    projectedDownloaded > 0
      ? Math.max(0, target * projectedDownloaded - input.uploaded)
      : null

  return {
    status: chargedFraction === 0 ? "scenario-only" : "available",
    chargedBytes,
    projectedDownloaded,
    projectedRatio,
    headroom,
    remainingChargedAllowance: usableHeadroom,
    remainingChargedAfterProposed,
    transferBudget,
    additionalUploadRequired,
    reserveChargedBytes: reserve,
    targetRatio: target,
    assumptions: [
      "uploaded/downloaded are accounted amounts in the same unit as size",
      "committed traffic is already charged but not included in downloaded",
      "reserve is charged traffic, not the raw upload-minus-download buffer",
      chargedFraction === 0
        ? "zero charged fraction is a scenario; freeleech expiry and future accounting are not assumed"
        : "charged fraction is explicit; the tracker's dynamic accounting rule is not predicted",
    ],
    safetyVerdict: "not-assessed",
    reason:
      chargedFraction === 0
        ? "Zero-charge scenario only; it does not prove unlimited or safe downloading."
        : "Arithmetic allowance only; per-torrent H&R/seeding obligations and tracker policy still apply.",
  }
}
