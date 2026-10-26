-- 0004_prowlarr.sql
-- P14 Prowlarr connection settings. The API key is encrypted at rest and is
-- never returned by the settings API.

ALTER TABLE "app_settings" ADD COLUMN "prowlarr_url" text;
ALTER TABLE "app_settings" ADD COLUMN "encrypted_prowlarr_api_key" text;
ALTER TABLE "app_settings" ADD COLUMN "prowlarr_allow_private" boolean NOT NULL DEFAULT false;
