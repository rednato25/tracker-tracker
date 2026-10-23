// src/lib/restore-lock.ts
//
// Cross-process coordination for backup restore.
//
// `stopScheduler()` only stops cron tasks in the current process. The app can
// run more than one instance against the same database, so a process-local flag
// cannot stop another instance from polling and writing during a restore.
//
// The restore transaction takes an exclusive PostgreSQL advisory lock. Every
// background cycle takes the shared form for its whole duration with
// `pg_try_advisory_lock_shared` on one reserved connection. New cycles skip
// while a restore is active; a restore waits for already-running cycles to
// finish before it deletes anything. Session-level locks are used deliberately:
// a transaction-scoped lock would be released as soon as the guard query's
// transaction committed, long before the poll cycle finished.
//
// Functions: acquireRestoreLock, withBackgroundRestoreGuard

import { sql } from "drizzle-orm"
import { getDbClient } from "@/lib/db"
import { log } from "@/lib/logger"

export const RESTORE_LOCK_KEY = "tracker-tracker:restore-v1"
export const RESTORE_LOCK_NAMESPACE = 1

/** How long a restore waits for an in-flight background cycle before giving up. */
export const RESTORE_LOCK_TIMEOUT_MS = 10_000

const RETRY_INTERVAL_MS = 100

export class RestoreBusyError extends Error {
  constructor() {
    super("Another background operation is still running. Try the restore again shortly.")
    this.name = "RestoreBusyError"
  }
}

interface LockExecutor {
  execute(query: ReturnType<typeof sql>): Promise<unknown>
}

function acquiredFrom(result: unknown): boolean {
  const rows = result as Array<{ acquired?: boolean }> | undefined
  return rows?.[0]?.acquired === true
}

/**
 * Acquire the exclusive restore lock inside the restore transaction. Bounded
 * retries keep a broken/stuck background cycle from hanging the request
 * forever. The lock is released automatically when the transaction ends.
 */
export async function acquireRestoreLock(tx: LockExecutor): Promise<void> {
  const deadline = Date.now() + RESTORE_LOCK_TIMEOUT_MS

  for (;;) {
    const acquired = acquiredFrom(
      await tx.execute(
        sql`select pg_try_advisory_xact_lock(hashtext(${RESTORE_LOCK_KEY}), ${RESTORE_LOCK_NAMESPACE}) as acquired`
      )
    )
    if (acquired) return

    if (Date.now() >= deadline) {
      throw new RestoreBusyError()
    }
    await new Promise((resolve) => setTimeout(resolve, RETRY_INTERVAL_MS))
  }
}

/**
 * Run a background cycle while holding the shared side of the restore lock.
 * Returns null when a restore owns the lock, so the caller skips this cycle
 * instead of writing data that the restore is about to replace.
 *
 * The reserved connection is not optional: the lock must be acquired and
 * released on the same session.
 */
export async function withBackgroundRestoreGuard<T>(
  label: string,
  run: () => Promise<T>
): Promise<T | null> {
  const conn = await getDbClient().reserve()

  try {
    const [row] = await conn<{ acquired: boolean }[]>`
      select pg_try_advisory_lock_shared(hashtext(${RESTORE_LOCK_KEY}), ${RESTORE_LOCK_NAMESPACE}) as acquired
    `
    if (!row?.acquired) {
      log.info({ event: "background_skipped_during_restore", label }, "Skipping background cycle")
      return null
    }

    try {
      return await run()
    } finally {
      await conn`
        select pg_advisory_unlock_shared(hashtext(${RESTORE_LOCK_KEY}), ${RESTORE_LOCK_NAMESPACE})
      `
    }
  } finally {
    conn.release()
  }
}
