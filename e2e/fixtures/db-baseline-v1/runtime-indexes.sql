-- Runtime indexes created by src/lib/db/ensure-indexes.ts.
-- These are part of the supported baseline even though Drizzle's schema DSL
-- cannot express them, so the frozen fixture includes them explicitly.
CREATE INDEX IF NOT EXISTS idx_snapshots_tracker_polled_covering
ON tracker_snapshots (tracker_id, polled_at)
INCLUDE (
  uploaded_bytes, downloaded_bytes, ratio, buffer_bytes,
  seeding_count, leeching_count, seedbonus, hit_and_runs,
  required_ratio, warned, freeleech_tokens, share_score,
  username, group_name
);
