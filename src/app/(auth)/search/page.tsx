// src/app/(auth)/search/page.tsx
//
// P37: the Search UI is hidden. The route redirects to the dashboard so an old
// bookmark does not reach the retained Prowlarr search implementation.

import { redirect } from "next/navigation"

export default function SearchPage() {
  redirect("/")
}
