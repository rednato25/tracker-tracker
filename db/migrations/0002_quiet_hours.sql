-- 0002_quiet_hours.sql
-- P08 quiet hours configuration. Separate migration so 0001 checksum stays frozen.

ALTER TABLE "app_settings" ADD COLUMN "quiet_hours_enabled" boolean NOT NULL DEFAULT false;
ALTER TABLE "app_settings" ADD COLUMN "quiet_hours_start" varchar(5) NOT NULL DEFAULT '22:00';
ALTER TABLE "app_settings" ADD COLUMN "quiet_hours_end" varchar(5) NOT NULL DEFAULT '07:00';
ALTER TABLE "app_settings" ADD COLUMN "quiet_hours_timezone" varchar(64) NOT NULL DEFAULT 'UTC';
ALTER TABLE "app_settings" ADD COLUMN "quiet_hours_critical_bypass" boolean NOT NULL DEFAULT false;
