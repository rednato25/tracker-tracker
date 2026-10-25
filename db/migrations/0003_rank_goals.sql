-- 0003_rank_goals.sql
-- P11 selected target rank per tracker. A single settings JSON is enough for
-- the personal goal; it follows app-settings backup/restore and lifecycle.

ALTER TABLE "app_settings" ADD COLUMN "rank_goals" text;
