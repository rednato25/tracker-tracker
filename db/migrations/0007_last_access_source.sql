ALTER TABLE "trackers" ADD COLUMN "last_access_source" varchar(16);
ALTER TABLE "trackers" ADD CONSTRAINT "trackers_last_access_source_check" CHECK ("last_access_source" IN ('detected', 'manual'));