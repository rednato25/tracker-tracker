// src/lib/profile-reading/support.ts
//
// P49 client-safe vocabulary. The setting is opt-in per tracker because some
// trackers do not permit automated page reads, and the cookie is pasted by the
// user rather than obtained by the app.

export const PROFILE_READING_WARNING =
  "Check this tracker's rules allow automated access before enabling."

/** Registry slugs whose profile or groups page this feature can read. */
export const PROFILE_READING_SLUGS = [
  "uploadcx",
  "onlyencodes",
  "seedpool",
  "yuscene",
  "portugas",
  "zenith",
  "v3x",
] as const

const PROFILE_READING_SLUG_SET: ReadonlySet<string> = new Set(PROFILE_READING_SLUGS)

export function supportsProfileReading(tracker: {
  registrySlug?: string | null
}): boolean {
  return Boolean(tracker.registrySlug && PROFILE_READING_SLUG_SET.has(tracker.registrySlug))
}

export const PROFILE_COOKIE_MAX = 5000
