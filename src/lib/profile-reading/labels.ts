// src/lib/profile-reading/labels.ts
//
// P49 source label shared by the dashboard rank rows and the tracker detail
// panel. Hours are exact whole hours; a read inside the first hour says so
// rather than claiming "0 hours ago".

export function profileReadAgeHours(fetchedAt: string, now: Date): number | null {
  const at = Date.parse(fetchedAt)
  if (Number.isNaN(at)) return null
  return Math.max(0, Math.floor((now.getTime() - at) / 3_600_000))
}

export function formatProfileReadAge(fetchedAt: string, now: Date): string {
  const hours = profileReadAgeHours(fetchedAt, now)
  if (hours === null) return "from profile page"
  if (hours === 0) return "from profile page · less than an hour ago"
  return `from profile page · ${hours} hour${hours === 1 ? "" : "s"} ago`
}
