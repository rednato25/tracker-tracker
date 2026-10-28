// src/data/recruitment-catalog.ts
//
// P30: the production catalog is a build-time view of the raw trackerpathways
// snapshot in src/data/pathways/. Nothing fetches at render time.

export {
  normalizePathwaysTarget,
  PATHWAYS_TRACKERS,
  pathwaysTrackerIdForRegistrySlug,
  pathwaysTrackerName,
  RECRUITMENT_CATALOG,
  RECRUITMENT_ROUTES,
  registrySlugForPathwaysTracker,
} from "@/data/pathways/catalog"
