// src/lib/profile-login.ts
//
// The bridge between a stored P49 profile read and the dashboard's login ring.
// Only UNIT3D profiles publish a "Last login" row, and only an opt-in reader
// can fetch it. When that value exists it is stronger evidence than the API's
// last_access/last_login because it is the login itself, not any later action.

import { trackerDateStr } from "@/lib/formatters"
import { readProfileReadRecord } from "@/lib/profile-reading/types"

/** Tooltip label for a date the profile page supplied. */
export const PROFILE_LOGIN_FIELD = "Last login (profile page)"

export interface ProfileLogin {
  /** Calendar date (YYYY-MM-DD) the profile page reported. */
  date: string
  /** ISO instant of the successful read, when the record has one. */
  fetchedAt: string | null
}

/**
 * The detected login a stored profile read carries, or undefined when the
 * tracker is not a UNIT3D reader, the opt-in is off, the last read stopped, or
 * the page had no usable "Last login" row.
 */
export function profileLoginFromMeta(input: {
  platformType: string
  profileReadingEnabled: boolean
  platformMeta: unknown
}): ProfileLogin | undefined {
  if (input.platformType !== "unit3d" || !input.profileReadingEnabled) return undefined
  const record = readProfileReadRecord(input.platformMeta)
  if (!record || record.status || !record.values.lastLoginAt) return undefined
  const date = trackerDateStr(record.values.lastLoginAt)
  if (!date) return undefined
  return { date, fetchedAt: record.fetchedAt }
}
