-- 0007_digest_monitoring.sql
-- P27: opt-in monitoring section for the existing scheduled digest.
-- Default off preserves the existing action-only digest behavior.

ALTER TABLE "app_settings"
  ADD COLUMN "digest_include_monitoring" boolean NOT NULL DEFAULT false;
