// src/lib/scheduler.ts
//
// Functions: startScheduler, stopScheduler, ensureSchedulerRunning
//
// Master scheduler orchestrator. Coordinates all three polling subsystems:
//   tracker-scheduler. Polls tracker APIs for stats.
//   download-client-scheduler. Polls download clients for torrent data.
//   backup-scheduler. Runs automated backups.

import cron, { type ScheduledTask } from "node-cron"
import { startBackupScheduler, stopBackupScheduler } from "@/lib/backup-scheduler"
import { ensureIndexes } from "@/lib/db/ensure-indexes"
import { runDigestIfDue } from "@/lib/digest"
import {
  ensureClientSchedulerRunning,
  startClientScheduler,
  stopClientScheduler,
} from "@/lib/download-client-scheduler"
import { log } from "@/lib/logger"
import { withBackgroundRestoreGuard } from "@/lib/restore-lock"
import {
  isTrackerPollingRunning,
  startTrackerPolling,
  stopTrackerPolling,
} from "@/lib/tracker-scheduler"

let digestTask: ScheduledTask | null = null

function startDigestScheduler(encryptionKey: Buffer): void {
  if (digestTask) return
  digestTask = cron.schedule("* * * * *", async () => {
    try {
      await withBackgroundRestoreGuard("digest", () => runDigestIfDue(encryptionKey))
    } catch (err) {
      log.error(err, "Digest scheduler error")
    }
  })
}

function stopDigestScheduler(): void {
  digestTask?.stop()
  digestTask = null
}

export function startScheduler(encryptionKey: Buffer): void {
  startTrackerPolling(encryptionKey)
  startClientScheduler(encryptionKey)
  startBackupScheduler(encryptionKey)
  startDigestScheduler(encryptionKey)
}

export function stopScheduler(): void {
  stopTrackerPolling()
  stopClientScheduler()
  stopBackupScheduler()
  stopDigestScheduler()
}

// Graceful shutdown: zero-fill encryption key and stop cron tasks before exit.
// Without this, Docker stop leaves the key buffer in process memory until the
// OS reclaims the pages and skips any flush/cleanup in subsystem stop functions.
process.on("SIGTERM", () => {
  log.info("SIGTERM received, shutting down")
  stopScheduler()
  process.exit(0)
})

/**
 * Restarts all schedulers if they died (i.e. after server restart).
 * Called from the auth layout on every authenticated page load.
 */
export function ensureSchedulerRunning(encryptionKeyHex: string): void {
  if (isTrackerPollingRunning()) return
  const key = Buffer.from(encryptionKeyHex, "hex")
  startScheduler(key)
  ensureClientSchedulerRunning(encryptionKeyHex)
  // Fire-and-forget: create covering indexes that Drizzle's schema DSL can't express.
  // Idempotent (IF NOT EXISTS), guarded by globalThis flag, non-fatal on failure.
  ensureIndexes().catch((err) => {
    log.warn(err, "ensureIndexes fire-and-forget failed")
  })
}
