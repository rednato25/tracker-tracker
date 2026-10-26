// src/data/recruitment-overrides.ts
//
// P17 local route overrides. There is intentionally no editor UI in P17: a
// validated override is a reviewed code change with an author, authoring date,
// provenance URL and verification date. The base community record stays in
// src/data/recruitment-routes.ts; evaluation exposes both the effective and
// original values.
//
// Keep this list empty unless a human has actually checked the route against a
// public, attributable source. Do not turn a guess or an old page visit into an
// override.

import type { RecruitmentRouteOverride } from "@/lib/recruitment-routes"

export const RECRUITMENT_ROUTE_OVERRIDES: RecruitmentRouteOverride[] = []
