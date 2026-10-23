export interface MigrationManifestEntry {
  version: string
  file: string
  sha256: string
}

export interface MigrationManifest {
  format: 1
  baseline: string
  migrations: MigrationManifestEntry[]
}

export interface MigrationManifestIssue {
  file: string
  detail: string
}

export interface MigrationValidationResult {
  ok: boolean
  errors: MigrationManifestIssue[]
  manifest: MigrationManifest | null
  entries: Array<MigrationManifestEntry & { path: string }>
}

export const MANIFEST_FORMAT: 1
export const MANIFEST_NAME: string
export const BASELINE_VERSION: string
export const VERSION_RE: RegExp
export const CHECKSUM_RE: RegExp

export function normalizeMigrationText(text: string): string
export function computeChecksum(text: string): string
export function computeFileChecksum(file: string): string
export function validateMigrations(dir: string): MigrationValidationResult
export function auditMigrationFiles(root: string): MigrationManifestIssue[]
