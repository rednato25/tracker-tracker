// src/lib/profile-reading/urls.ts
//
// P49 pure helpers shared by the runner and its tests: which page to read and
// whether a 200 response is the tracker's login page.

/** The page to read, relative to the tracker's stored base URL. */
export function profilePageUrl(
  registrySlug: string | null | undefined,
  baseUrl: string,
  username: string
): string | null {
  const root = baseUrl.replace(/\/+$/, "")
  if (registrySlug === "zenith") return `${root}/groups`
  const encoded = encodeURIComponent(username)
  if (registrySlug === "v3x") return `${root}/u/${encoded}`
  if (
    registrySlug === "uploadcx" ||
    registrySlug === "onlyencodes" ||
    registrySlug === "seedpool" ||
    registrySlug === "yuscene" ||
    registrySlug === "portugas"
  ) {
    return `${root}/users/${encoded}`
  }
  return null
}

/** Conservative login-page detector for a 200 response instead of a redirect. */
export function looksLikeLoginPage(html: string): boolean {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? ""
  if (/\b(log ?in|sign ?in|connexion)\b/i.test(title)) return true
  const form = html.match(/<form[^>]*action=["']([^"']*login[^"']*)["'][^>]*>/i)
  if (form && /name=["']password["']/i.test(html)) return true
  return false
}
