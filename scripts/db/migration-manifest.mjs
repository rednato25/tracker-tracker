// scripts/db/migration-manifest.mjs
//
// Shared validation for the approved versioned migration manifest.
// This module has no database access and no CLI entry; the P02b runner and the
// security audit both use it.

import { createHash } from "node:crypto"
import fs from "node:fs"
import path from "node:path"

export const MANIFEST_FORMAT = 1
export const MANIFEST_NAME = "manifest.json"
export const BASELINE_VERSION = "0000_baseline"
export const VERSION_RE = /^[0-9]{4}_[a-z0-9_]+$/
export const CHECKSUM_RE = /^[0-9a-f]{64}$/

export function normalizeMigrationText(text) {
  return text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n")
}

export function computeChecksum(text) {
  return createHash("sha256").update(normalizeMigrationText(text), "utf8").digest("hex")
}

export function computeFileChecksum(file) {
  return computeChecksum(fs.readFileSync(file, "utf8"))
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function walkSqlFiles(dir) {
  if (!fs.existsSync(dir)) return []
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...walkSqlFiles(full))
    } else if (entry.isFile() && entry.name.endsWith(".sql")) {
      out.push(full)
    }
  }
  return out
}

function walkWorkflowFiles(dir) {
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(ya?ml)$/i.test(entry.name))
    .map((entry) => path.join(dir, entry.name))
}

function addIssue(issues, file, detail) {
  issues.push({ file, detail })
}

/**
 * Validate a migration directory and its manifest.
 *
 * @param {string} dir Absolute or cwd-relative migration directory.
 * @returns {{ ok: boolean, errors: {file:string,detail:string}[], manifest: unknown, entries: unknown[] }}
 */
export function validateMigrations(dir) {
  const migrationsDir = path.resolve(dir)
  const manifestPath = path.join(migrationsDir, MANIFEST_NAME)
  const errors = []

  if (!fs.existsSync(manifestPath)) {
    addIssue(errors, manifestPath, `Migration manifest is missing: ${manifestPath}`)
    return { ok: false, errors, manifest: null, entries: [] }
  }

  let manifest
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"))
  } catch (error) {
    addIssue(errors, manifestPath, `Migration manifest is not valid JSON: ${error.message}`)
    return { ok: false, errors, manifest: null, entries: [] }
  }

  if (!isPlainObject(manifest)) {
    addIssue(errors, manifestPath, "Migration manifest must be a JSON object")
    return { ok: false, errors, manifest, entries: [] }
  }
  if (manifest.format !== MANIFEST_FORMAT) {
    addIssue(errors, manifestPath, `Unsupported migration manifest format: ${String(manifest.format)}`)
  }
  if (manifest.baseline !== BASELINE_VERSION) {
    addIssue(errors, manifestPath, `Manifest baseline must be ${BASELINE_VERSION}`)
  }
  if (!Array.isArray(manifest.migrations) || manifest.migrations.length === 0) {
    addIssue(errors, manifestPath, "Manifest migrations must be a non-empty array")
    return { ok: false, errors, manifest, entries: [] }
  }

  const entries = []
  const versions = new Set()
  const files = new Set()
  let previousVersion = null

  for (const [index, raw] of manifest.migrations.entries()) {
    const label = `migrations[${index}]`
    if (!isPlainObject(raw)) {
      addIssue(errors, manifestPath, `${label} must be an object`)
      continue
    }
    const { version, file, sha256 } = raw
    if (typeof version !== "string" || !VERSION_RE.test(version)) {
      addIssue(errors, manifestPath, `${label}.version must match 0000_slug`)
      continue
    }
    if (versions.has(version)) {
      addIssue(errors, manifestPath, `Duplicate migration version: ${version}`)
      continue
    }
    versions.add(version)

    if (previousVersion !== null && version <= previousVersion) {
      addIssue(errors, manifestPath, `Migration versions must be strictly ascending: ${version} after ${previousVersion}`)
    }
    previousVersion = version

    if (typeof file !== "string" || file.length === 0) {
      addIssue(errors, manifestPath, `${label}.file must be a non-empty string`)
      continue
    }
    if (path.isAbsolute(file) || file !== path.basename(file) || file.includes("..")) {
      addIssue(errors, manifestPath, `Invalid migration path: ${file}`)
      continue
    }
    if (!file.endsWith(".sql")) {
      addIssue(errors, manifestPath, `Migration file must end in .sql: ${file}`)
      continue
    }
    if (files.has(file)) {
      addIssue(errors, manifestPath, `Duplicate migration file: ${file}`)
      continue
    }
    files.add(file)

    const fullPath = path.resolve(migrationsDir, file)
    const prefix = migrationsDir.endsWith(path.sep) ? migrationsDir : migrationsDir + path.sep
    if (!fullPath.startsWith(prefix)) {
      addIssue(errors, manifestPath, `Migration path escapes the managed directory: ${file}`)
      continue
    }
    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
      addIssue(errors, fullPath, `Migration file is missing: ${file}`)
      continue
    }

    try {
      const realDir = fs.realpathSync.native(migrationsDir)
      const realFile = fs.realpathSync.native(fullPath)
      const realPrefix = realDir.endsWith(path.sep) ? realDir : realDir + path.sep
      if (!realFile.startsWith(realPrefix)) {
        addIssue(errors, manifestPath, `Migration path resolves outside the managed directory: ${file}`)
        continue
      }
    } catch (error) {
      addIssue(errors, fullPath, `Migration path could not be resolved: ${error.message}`)
      continue
    }

    if (typeof sha256 !== "string" || !CHECKSUM_RE.test(sha256)) {
      addIssue(errors, manifestPath, `${label}.sha256 must be a lowercase SHA-256 hex digest`)
      continue
    }
    const actual = computeFileChecksum(fullPath)
    if (actual !== sha256) {
      addIssue(errors, fullPath, `Checksum mismatch for ${file}: expected ${sha256}, got ${actual}`)
      continue
    }

    entries.push({ version, file, sha256, path: fullPath })
  }

  if (manifest.migrations.length > 0) {
    const first = manifest.migrations[0]
    if (!isPlainObject(first) || first.version !== BASELINE_VERSION) {
      addIssue(errors, manifestPath, `First migration must be ${BASELINE_VERSION}`)
    }
  }
  if (!versions.has(BASELINE_VERSION)) {
    addIssue(errors, manifestPath, `Manifest must contain ${BASELINE_VERSION}`)
  }

  const listed = new Set(entries.map((entry) => path.resolve(entry.path)))
  for (const sqlFile of walkSqlFiles(migrationsDir)) {
    if (!listed.has(path.resolve(sqlFile))) {
      addIssue(errors, sqlFile, `Unlisted SQL file in managed migration directory: ${path.relative(migrationsDir, sqlFile)}`)
    }
  }

  return { ok: errors.length === 0, errors, manifest, entries }
}

/**
 * Static audit used by scripts/security-audit.ts and its regression tests.
 * Returns findings in the audit's {file, detail} shape.
 *
 * @param {string} root Repository root.
 */
export function auditMigrationFiles(root) {
  const findings = []
  const rootDir = path.resolve(root)

  const managedDir = path.join(rootDir, "db", "migrations")
  if (fs.existsSync(managedDir)) {
    const result = validateMigrations(managedDir)
    for (const error of result.errors) {
      findings.push({
        file: path.relative(rootDir, error.file) || error.file,
        detail: error.detail,
      })
    }
  }

  for (const relativeDir of ["src/lib/db/migrations", "drizzle"]) {
    const dir = path.join(rootDir, relativeDir)
    for (const sqlFile of walkSqlFiles(dir)) {
      findings.push({
        file: path.relative(rootDir, sqlFile),
        detail:
          "Unauthorized SQL migration file. Only manifest-listed files in db/migrations are allowed.",
      })
    }
  }

  const packagePath = path.join(rootDir, "package.json")
  if (fs.existsSync(packagePath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"))
      for (const [name, command] of Object.entries(pkg.scripts ?? {})) {
        if (typeof command === "string" && /drizzle-kit\s+(generate|migrate|push)\b/.test(command)) {
          findings.push({
            file: "package.json",
            detail: `Script "${name}" uses unauthorized drizzle-kit generate/migrate/push`,
          })
        }
      }
    } catch (error) {
      findings.push({
        file: "package.json",
        detail: `package.json could not be parsed for migration commands: ${error.message}`,
      })
    }
  }

  const workflowDir = path.join(rootDir, ".github", "workflows")
  for (const workflow of walkWorkflowFiles(workflowDir)) {
    const content = fs.readFileSync(workflow, "utf8")
    if (/drizzle-kit\s+(generate|migrate|push)\b/.test(content)) {
      findings.push({
        file: path.relative(rootDir, workflow),
        detail: "CI workflow uses unauthorized drizzle-kit generate/migrate/push",
      })
    }
  }

  const entrypointPath = path.join(rootDir, "docker-entrypoint.sh")
  if (fs.existsSync(entrypointPath)) {
    const entrypoint = fs.readFileSync(entrypointPath, "utf8")
    if (/drizzle-kit\s+push\b/i.test(entrypoint)) {
      findings.push({
        file: "docker-entrypoint.sh",
        detail: "Production entrypoint contains a drizzle-kit push path",
      })
    }
    if (!entrypoint.includes("scripts/db/migrate.mjs")) {
      findings.push({
        file: "docker-entrypoint.sh",
        detail: "Production entrypoint does not call scripts/db/migrate.mjs",
      })
    }
  }

  const dockerfilePath = path.join(rootDir, "Dockerfile")
  if (fs.existsSync(dockerfilePath)) {
    const dockerfile = fs.readFileSync(dockerfilePath, "utf8")
    if (/drizzle-kit\s+push\b/i.test(dockerfile)) {
      findings.push({
        file: "Dockerfile",
        detail: "Dockerfile contains a drizzle-kit push path",
      })
    }
  }

  return findings
}
