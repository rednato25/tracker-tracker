// src/lib/__tests__/migration-manifest.test.ts

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import {
  auditMigrationFiles,
  computeChecksum,
  validateMigrations,
} from "../../../scripts/db/migration-manifest.mjs"

const roots: string[] = []

function makeRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "tt-p02b1-"))
  roots.push(root)
  mkdirSync(join(root, "db", "migrations"), { recursive: true })
  return root
}

function writeMigration(root: string, file: string, sql: string): string {
  writeFileSync(join(root, "db", "migrations", file), sql, "utf8")
  return computeChecksum(sql)
}

function writeManifest(root: string, migrations: Array<{ version: string; file: string; sha256: string }>) {
  writeFileSync(
    join(root, "db", "migrations", "manifest.json"),
    `${JSON.stringify({ format: 1, baseline: "0000_baseline", migrations }, null, 2)}\n`,
    "utf8"
  )
}

function baseline(root: string, extra: Array<{ version: string; file: string; sha256: string }> = []) {
  const sha256 = writeMigration(root, "0000_baseline.sql", "CREATE TABLE fixture (id integer);\n")
  writeManifest(root, [{ version: "0000_baseline", file: "0000_baseline.sql", sha256 }, ...extra])
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe("migration manifest validation", () => {
  it("accepts the approved manifest and checksum", () => {
    const root = makeRepo()
    baseline(root)

    const result = validateMigrations(join(root, "db", "migrations"))
    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])
    expect(auditMigrationFiles(root)).toEqual([])
  })

  it("rejects duplicate versions", () => {
    const root = makeRepo()
    const sha = writeMigration(root, "0000_baseline.sql", "SELECT 1;\n")
    writeManifest(root, [
      { version: "0000_baseline", file: "0000_baseline.sql", sha256: sha },
      { version: "0000_baseline", file: "0001_dup.sql", sha256: sha },
    ])
    writeMigration(root, "0001_dup.sql", "SELECT 2;\n")

    const result = validateMigrations(join(root, "db", "migrations"))
    expect(result.ok).toBe(false)
    expect(result.errors.some((error) => error.detail.includes("Duplicate migration version"))).toBe(
      true
    )
  })

  it("rejects out-of-order versions", () => {
    const root = makeRepo()
    const sha0 = writeMigration(root, "0000_baseline.sql", "SELECT 0;\n")
    const sha1 = writeMigration(root, "0001_second.sql", "SELECT 1;\n")
    writeManifest(root, [
      { version: "0001_second", file: "0001_second.sql", sha256: sha1 },
      { version: "0000_baseline", file: "0000_baseline.sql", sha256: sha0 },
    ])

    const result = validateMigrations(join(root, "db", "migrations"))
    expect(result.ok).toBe(false)
    expect(
      result.errors.some((error) => error.detail.includes("strictly ascending"))
    ).toBe(true)
  })

  it("rejects a missing migration file", () => {
    const root = makeRepo()
    writeManifest(root, [
      { version: "0000_baseline", file: "0000_baseline.sql", sha256: "0".repeat(64) },
    ])

    const result = validateMigrations(join(root, "db", "migrations"))
    expect(result.ok).toBe(false)
    expect(result.errors.some((error) => error.detail.includes("missing"))).toBe(true)
  })

  it("rejects a checksum mismatch", () => {
    const root = makeRepo()
    writeMigration(root, "0000_baseline.sql", "SELECT 1;\n")
    writeManifest(root, [
      { version: "0000_baseline", file: "0000_baseline.sql", sha256: "0".repeat(64) },
    ])

    const result = validateMigrations(join(root, "db", "migrations"))
    expect(result.ok).toBe(false)
    expect(result.errors.some((error) => error.detail.includes("Checksum mismatch"))).toBe(true)
  })

  it("rejects path traversal and absolute paths", () => {
    const root = makeRepo()
    writeManifest(root, [
      { version: "0000_baseline", file: "../outside.sql", sha256: "0".repeat(64) },
    ])

    const result = validateMigrations(join(root, "db", "migrations"))
    expect(result.ok).toBe(false)
    expect(result.errors.some((error) => error.detail.includes("Invalid migration path"))).toBe(
      true
    )
  })

  it("rejects unlisted SQL in the managed directory", () => {
    const root = makeRepo()
    baseline(root)
    writeMigration(root, "0001_unlisted.sql", "SELECT 1;\n")

    const result = validateMigrations(join(root, "db", "migrations"))
    expect(result.ok).toBe(false)
    expect(result.errors.some((error) => error.detail.includes("Unlisted SQL file"))).toBe(true)
  })
})

describe("migration audit", () => {
  it("rejects SQL in old schema-only directories", () => {
    const root = makeRepo()
    baseline(root)
    mkdirSync(join(root, "src", "lib", "db", "migrations"), { recursive: true })
    writeFileSync(join(root, "src", "lib", "db", "migrations", "0001_bad.sql"), "SELECT 1;\n")
    mkdirSync(join(root, "drizzle"), { recursive: true })
    writeFileSync(join(root, "drizzle", "0001_bad.sql"), "SELECT 1;\n")

    const findings = auditMigrationFiles(root)
    const oldMigrations = join("src", "lib", "db", "migrations")
    expect(findings.some((finding) => finding.file.includes(oldMigrations))).toBe(true)
    expect(findings.some((finding) => finding.file.includes("drizzle"))).toBe(true)
  })

  it("rejects unauthorized drizzle-kit commands including push", () => {
    const root = makeRepo()
    baseline(root)
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({
        scripts: {
          "db:push": "drizzle-kit push",
          "db:generate": "drizzle-kit generate",
          "db:migrate": "drizzle-kit migrate",
        },
      })
    )
    mkdirSync(join(root, ".github", "workflows"), { recursive: true })
    writeFileSync(
      join(root, ".github", "workflows", "migrate.yml"),
      "run: drizzle-kit generate\n"
    )

    const findings = auditMigrationFiles(root)
    expect(findings.some((finding) => finding.detail.includes('"db:generate"'))).toBe(true)
    expect(findings.some((finding) => finding.detail.includes('"db:migrate"'))).toBe(true)
    expect(findings.some((finding) => finding.detail.includes('"db:push"'))).toBe(true)
    expect(findings.some((finding) => finding.detail.includes("CI workflow"))).toBe(true)
  })

  it("requires the production runner and rejects a push entrypoint", () => {
    const root = makeRepo()
    baseline(root)
    writeFileSync(
      join(root, "docker-entrypoint.sh"),
      "#!/bin/sh\nnode /app/scripts/db/migrate.mjs\nexec node server.js\n"
    )
    writeFileSync(join(root, "Dockerfile"), "FROM node:24-alpine\n")
    expect(auditMigrationFiles(root)).toEqual([])

    writeFileSync(
      join(root, "docker-entrypoint.sh"),
      "#!/bin/sh\nnpx drizzle-kit push --force\nexec node server.js\n"
    )
    let findings = auditMigrationFiles(root)
    expect(findings.some((finding) => finding.file === "docker-entrypoint.sh")).toBe(true)

    writeFileSync(join(root, "docker-entrypoint.sh"), "#!/bin/sh\nexec node server.js\n")
    findings = auditMigrationFiles(root)
    expect(
      findings.some((finding) =>
        finding.detail.includes("does not call scripts/db/migrate.mjs")
      )
    ).toBe(true)

    writeFileSync(join(root, "Dockerfile"), "FROM node:24-alpine\nRUN npx drizzle-kit push\n")
    findings = auditMigrationFiles(root)
    expect(findings.some((finding) => finding.file === "Dockerfile")).toBe(true)
  })

  it("rejects an unlisted SQL file through the audit path", () => {
    const root = makeRepo()
    baseline(root)
    writeMigration(root, "0001_unlisted.sql", "SELECT 1;\n")

    const findings = auditMigrationFiles(root)
    expect(findings.some((finding) => finding.detail.includes("Unlisted SQL file"))).toBe(true)
  })
})
