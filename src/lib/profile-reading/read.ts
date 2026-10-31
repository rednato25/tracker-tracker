// src/lib/profile-reading/read.ts
//
// P49 pure decision after one page is in hand. It is separate from fetch.ts so
// the tests can drive saved HTML without the server-only transport.

import { parseProfilePage } from "@/lib/profile-reading/parse"
import type {
  ProfileReadRecord,
  ProfileReadStatus,
  ProfileReadValues,
} from "@/lib/profile-reading/types"
import { looksLikeLoginPage } from "@/lib/profile-reading/urls"

export interface ProfileReadOutcome {
  record: ProfileReadRecord
  /** True when the fetch itself succeeded, even if no value was parsed. */
  fetched: boolean
}

export function profileReadStopped(
  previous: ProfileReadRecord | null,
  attemptedAt: string,
  status: ProfileReadStatus,
  message: string
): ProfileReadOutcome {
  return {
    fetched: false,
    record: {
      fetchedAt: previous?.fetchedAt ?? null,
      attemptedAt,
      status,
      values: previous?.values ?? {},
      message,
    },
  }
}

export function profileReadFailed(
  previous: ProfileReadRecord | null,
  attemptedAt: string,
  message: string
): ProfileReadOutcome {
  return {
    fetched: false,
    record: {
      fetchedAt: previous?.fetchedAt ?? null,
      attemptedAt,
      status: null,
      values: previous?.values ?? {},
      message,
    },
  }
}

function succeeded(attemptedAt: string, values: ProfileReadValues): ProfileReadOutcome {
  return {
    fetched: true,
    record: {
      fetchedAt: attemptedAt,
      attemptedAt,
      status: null,
      values,
    },
  }
}

/** Decides the stored record from one fetched page. */
export function readProfilePageOnce(input: {
  registrySlug: string
  html: string
  previous: ProfileReadRecord | null
  now: Date
}): ProfileReadOutcome {
  const attemptedAt = input.now.toISOString()
  if (looksLikeLoginPage(input.html)) {
    return profileReadStopped(
      input.previous,
      attemptedAt,
      "session_expired",
      "Session expired. Paste a new profile cookie."
    )
  }
  const parsed = parseProfilePage(input.registrySlug, input.html)
  if (!parsed) {
    return profileReadStopped(
      input.previous,
      attemptedAt,
      "page_changed",
      "Page changed. The tracker layout no longer matches."
    )
  }
  return succeeded(attemptedAt, parsed.values)
}
