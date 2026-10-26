-- 0006_recruitment_state.sql
-- P18: one JSON column for wishlist UI state.
--
-- Tracker references inside the JSON are registry slugs, not database ids, so a
-- restore cannot point at a remapped tracker id. Hidden path keys and goal links
-- may become stale when the bundled route catalog changes; the UI resolves them
-- defensively and drops unknown references.

ALTER TABLE "app_settings" ADD COLUMN "recruitment_state" text;
