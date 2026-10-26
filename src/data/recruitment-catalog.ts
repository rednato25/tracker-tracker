// src/data/recruitment-catalog.ts
//
// The production P17 catalog. Routes are a pinned, offline community snapshot;
// overrides are reviewed code. Nothing here fetches the upstream dataset.

import { RECRUITMENT_ROUTE_OVERRIDES } from "@/data/recruitment-overrides"
import {
  RECRUITMENT_ROUTES,
  RECRUITMENT_SOURCE,
} from "@/data/recruitment-routes"
import {
  RECRUITMENT_ROUTE_FORMAT_VERSION,
  type RecruitmentCatalog,
} from "@/lib/recruitment-routes"

export const RECRUITMENT_CATALOG: RecruitmentCatalog = {
  formatVersion: RECRUITMENT_ROUTE_FORMAT_VERSION,
  source: RECRUITMENT_SOURCE,
  routes: RECRUITMENT_ROUTES,
  overrides: RECRUITMENT_ROUTE_OVERRIDES,
}
