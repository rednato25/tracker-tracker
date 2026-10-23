// Frozen P02a database fixture metadata.
//
// These values describe a synthetic installation only. They are deliberately
// deterministic so the fixture can be recreated and compared, and they must
// never be used by a real deployment.

export const FIXTURE_SOURCE_COMMIT = "e9586d531b66b45ce7e4aa50b498e5c58cc9d76f"
export const FIXTURE_DATABASE_SUFFIX = "_p02a"
export const FIXTURE_MARKER = "tracker-tracker-p02a-disposable"

export const FIXTURE_PASSWORD = "p02a-fixture-master-password"
export const FIXTURE_SALT = "0123456789abcdef".repeat(4)
export const FIXTURE_SESSION_SECRET =
  "p02a-fixture-session-secret-0123456789abcdef0123456789abcdef"

export const FIXTURE_TRACKER_NAMES = ["Fixture Alpha", "Fixture Beta"] as const
