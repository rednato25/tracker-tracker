-- 0001_digest_settings.sql
-- P08 digest configuration and durable per-target schedule state.
-- The state is JSON because it is a single settings row, not a new domain table.

ALTER TABLE "app_settings" ADD COLUMN "digest_enabled" boolean NOT NULL DEFAULT false;
ALTER TABLE "app_settings" ADD COLUMN "digest_time" varchar(5) NOT NULL DEFAULT '09:00';
ALTER TABLE "app_settings" ADD COLUMN "digest_timezone" varchar(64) NOT NULL DEFAULT 'UTC';
ALTER TABLE "app_settings" ADD COLUMN "digest_empty_behavior" varchar(10) NOT NULL DEFAULT 'skip';
ALTER TABLE "app_settings" ADD COLUMN "digest_target_ids" text;
ALTER TABLE "app_settings" ADD COLUMN "digest_state" text;
