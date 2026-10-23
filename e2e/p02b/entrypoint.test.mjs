// e2e/p02b/entrypoint.test.mjs
//
// Stub-based control-flow tests for docker-entrypoint.sh. These prove ordering
// and exit behavior; they are not Docker or real-application validation.

import assert from "node:assert/strict"
import { spawn, spawnSync } from "node:child_process"
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import test, { after } from "node:test"
import { fileURLToPath } from "node:url"

const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)))
const ENTRYPOINT = join(ROOT, "docker-entrypoint.sh")
const SH =
  process.env.SH_BIN ||
  (process.platform === "win32"
    ? "C:\\Program Files\\Git\\usr\\bin\\sh.exe"
    : "/bin/sh")

const FIXTURE_DATABASE_URL = "postgresql://fixture:fixture@127.0.0.1:5432/fixture"
const FIXTURE_SESSION_SECRET = "p02b5-fixture-session-secret-0123456789abcdef"

const tempDirs = []

function posixPath(value) {
  return value
    .replace(/^([A-Za-z]):/, (_, drive) => `/${drive.toLowerCase()}`)
    .replace(/\\/g, "/")
}

function makeHarness() {
  const dir = mkdtempSync(join(tmpdir(), "tt-p02b5-"))
  tempDirs.push(dir)
  const bin = join(dir, "bin")
  mkdirSync(bin)
  const stub = `#!/bin/sh
LOG="\${STUB_LOG:-stub.log}"
case "$*" in
  *"/app/scripts/db/migrate.mjs"*)
    if [ "\${STUB_MIGRATE_SLEEP:-0}" = "1" ]; then
      trap 'echo MIGRATE_TERM >> "$LOG"; exit 143' TERM INT
    fi
    echo MIGRATE >> "$LOG"
    if [ -n "\${STUB_PID_FILE:-}" ]; then echo $$ > "$STUB_PID_FILE"; fi
    if [ "\${STUB_MIGRATE_SLEEP:-0}" = "1" ]; then
      while :; do sleep 1; done
    fi
    exit "\${STUB_MIGRATE_EXIT:-0}"
    ;;
  *"server.js"*)
    echo SERVER >> "$LOG"
    exit 0
    ;;
  *"process.stdout.write"*)
    echo "2.13.5"
    exit 0
    ;;
  *)
    exit 0
    ;;
esac
`
  writeFileSync(join(bin, "node"), stub, "utf8")
  const log = join(dir, "stub.log")
  const runner = join(dir, "run.sh")
  writeFileSync(
    runner,
    `#!/bin/sh
chmod +x ${posixPath(join(bin, "node"))}
export PATH=${posixPath(bin)}:/usr/bin:/bin
export STUB_LOG=${posixPath(log)}
export STUB_MIGRATE_EXIT="\${STUB_MIGRATE_EXIT:-0}"
export STUB_MIGRATE_SLEEP="\${STUB_MIGRATE_SLEEP:-0}"
exec sh ${posixPath(ENTRYPOINT)}
`,
    "utf8"
  )
  return { dir, runner, log }
}

function runEntrypoint({ migrateExit = 0, migrateSleep = false } = {}) {
  if (!existsSync(SH)) return Promise.reject(new Error(`POSIX shell not found: ${SH}`))
  const harness = makeHarness()
  return new Promise((resolvePromise, reject) => {
    const child = spawn(SH, [harness.runner], {
      cwd: harness.dir,
      env: {
        ...process.env,
        DATABASE_URL: FIXTURE_DATABASE_URL,
        SESSION_SECRET: FIXTURE_SESSION_SECRET,
        PORT: "3000",
        STUB_MIGRATE_EXIT: String(migrateExit),
        STUB_MIGRATE_SLEEP: migrateSleep ? "1" : "0",
      },
      stdio: ["ignore", "pipe", "pipe"],
    })
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (chunk) => {
      stdout += chunk
    })
    child.stderr.on("data", (chunk) => {
      stderr += chunk
    })
    child.on("error", reject)
    child.on("close", (code, signal) => {
      const log = existsSync(harness.log) ? readFileSync(harness.log, "utf8") : ""
      resolvePromise({ code, signal, stdout, stderr, log, child })
    })
  })
}

test("successful migration runs before the application", async () => {
  const result = await runEntrypoint()
  assert.equal(result.code, 0, result.stderr || result.stdout)
  assert.match(result.log, /MIGRATE/)
  assert.match(result.log, /SERVER/)
  assert.ok(
    result.log.indexOf("MIGRATE") < result.log.indexOf("SERVER"),
    "migration must precede application startup"
  )
  assert.doesNotMatch(result.log, /drizzle-kit|push/i)
})

test("migration failure prevents application startup", async () => {
  const result = await runEntrypoint({ migrateExit: 7 })
  assert.notEqual(result.code, 0)
  assert.match(result.log, /MIGRATE/)
  assert.doesNotMatch(result.log, /SERVER/)
  assert.match(result.stderr, /migration failed/i)
  assert.doesNotMatch(result.log, /drizzle-kit|push/i)
})

test("the entrypoint has no push or reset fallback", () => {
  const entrypoint = readFileSync(ENTRYPOINT, "utf8")
  assert.doesNotMatch(entrypoint, /drizzle-kit\s+push|push\s+--force|--force\s+--config/i)
  assert.match(entrypoint, /scripts\/db\/migrate\.mjs/)
})

const WSL_AVAILABLE =
  process.platform === "win32" &&
  spawnSync(process.env.WSL_BASH || "bash.exe", ["-lc", "true"], {
    stdio: "ignore",
    timeout: 10_000,
  }).status === 0

function wslPath(value) {
  return value
    .replace(/^([A-Za-z]):/, (_, drive) => `/mnt/${drive.toLowerCase()}`)
    .replace(/\\/g, "/")
}

test(
  "termination during migration does not start the application",
  { timeout: 30_000, skip: !WSL_AVAILABLE && "WSL is unavailable for POSIX signal control-flow test" },
  async () => {
    const harness = makeHarness()
    const wrapper = join(harness.dir, "terminate.sh")
    const pidFile = join(harness.dir, "migrate.pid")
    writeFileSync(
      wrapper,
      `#!/bin/sh
chmod +x ${wslPath(join(harness.dir, "bin", "node"))}
export PATH=${wslPath(join(harness.dir, "bin"))}:/usr/bin:/bin
export DATABASE_URL='${FIXTURE_DATABASE_URL}'
export SESSION_SECRET='${FIXTURE_SESSION_SECRET}'
export PORT=3000
export STUB_LOG='${wslPath(harness.log)}'
export STUB_PID_FILE='${wslPath(pidFile)}'
export STUB_MIGRATE_SLEEP=1
sh ${wslPath(ENTRYPOINT)} &
EP=$!
i=0
while [ "$i" -lt 100 ]; do
  if [ -f "$STUB_LOG" ] && grep -q '^MIGRATE$' "$STUB_LOG"; then break; fi
  sleep 0.1
  i=$((i + 1))
done
kill -TERM $EP
wait $EP
STATUS=$?
if [ -f "$STUB_PID_FILE" ] && kill -0 "$(cat "$STUB_PID_FILE")" 2>/dev/null; then
  echo ORPHAN >> "$STUB_LOG"
fi
exit $STATUS
`,
      "utf8"
    )

    const result = await new Promise((resolvePromise, reject) => {
      const child = spawn(process.env.WSL_BASH || "bash.exe", ["-lc", `sh ${wslPath(wrapper)}`], {
        cwd: harness.dir,
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
      })
      let stderr = ""
      child.stderr.on("data", (chunk) => {
        stderr += chunk
      })
      child.on("error", reject)
      child.on("close", (code, signal) => {
        const log = existsSync(harness.log) ? readFileSync(harness.log, "utf8") : ""
        resolvePromise({ code, signal, stderr, log })
      })
    })

    assert.notEqual(result.code, 0, result.stderr)
    assert.doesNotMatch(result.log, /SERVER/)
    assert.match(result.log, /MIGRATE_TERM/)
    assert.doesNotMatch(result.log, /ORPHAN/)
  }
)

after(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})
