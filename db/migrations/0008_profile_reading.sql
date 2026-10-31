ALTER TABLE "trackers" ADD COLUMN "profile_reading_enabled" boolean DEFAULT false NOT NULL;
ALTER TABLE "trackers" ADD COLUMN "encrypted_profile_cookie" text;
