-- Tracker Tracker schema baseline 0000.
-- Frozen from commit e9586d531b66b45ce7e4aa50b498e5c58cc9d76f.
-- Do not regenerate from schema.ts; this file is the historical baseline.
-- Runtime covering index from src/lib/db/ensure-indexes.ts follows the schema.

CREATE TABLE "app_coverage_gaps" (
	"id" serial PRIMARY KEY NOT NULL,
	"started_at" timestamp NOT NULL,
	"ended_at" timestamp NOT NULL,
	"reason" varchar(20) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_liveness" (
	"id" serial PRIMARY KEY NOT NULL,
	"first_seen_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"stopped_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"password_hash" text NOT NULL,
	"encryption_salt" text NOT NULL,
	"username" varchar(100),
	"store_usernames" boolean DEFAULT true NOT NULL,
	"totp_secret" text,
	"totp_backup_codes" text,
	"session_timeout_minutes" integer,
	"lockout_enabled" boolean DEFAULT true NOT NULL,
	"lockout_threshold" integer DEFAULT 5 NOT NULL,
	"lockout_duration_minutes" integer DEFAULT 15 NOT NULL,
	"failed_login_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp,
	"snapshot_retention_days" integer,
	"retention_prompted_at" timestamp,
	"tracker_poll_interval_minutes" integer DEFAULT 60 NOT NULL,
	"proxy_enabled" boolean DEFAULT false NOT NULL,
	"proxy_type" varchar(10) DEFAULT 'socks5' NOT NULL,
	"proxy_host" varchar(255),
	"proxy_port" integer DEFAULT 1080,
	"proxy_username" varchar(255),
	"encrypted_proxy_password" text,
	"qbitmanage_enabled" boolean DEFAULT false NOT NULL,
	"qbitmanage_tags" text,
	"backup_schedule_enabled" boolean DEFAULT false NOT NULL,
	"backup_schedule_frequency" varchar(10) DEFAULT 'daily' NOT NULL,
	"backup_retention_count" integer DEFAULT 14 NOT NULL,
	"backup_encryption_enabled" boolean DEFAULT false NOT NULL,
	"encrypted_backup_password" text,
	"backup_storage_path" varchar(500),
	"draft_quicklinks" text,
	"dashboard_settings" text,
	"encrypted_ptpimg_api_key" text,
	"encrypted_oeimg_api_key" text,
	"encrypted_imgbb_api_key" text,
	"encrypted_scheduler_key" text,
	"credential_vault_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "backup_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"size_bytes" integer NOT NULL,
	"encrypted" boolean DEFAULT false NOT NULL,
	"frequency" varchar(10),
	"status" varchar(20) DEFAULT 'completed' NOT NULL,
	"storage_path" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "client_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"polled_at" timestamp DEFAULT now() NOT NULL,
	"total_seeding_count" integer,
	"total_leeching_count" integer,
	"upload_speed_bytes" bigint,
	"download_speed_bytes" bigint,
	"tag_stats" text
);
--> statement-breakpoint
CREATE TABLE "client_uptime_buckets" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"bucket_ts" timestamp NOT NULL,
	"ok" integer DEFAULT 0 NOT NULL,
	"fail" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "db_size_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"recorded_at" date NOT NULL,
	"total_bytes" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dismissed_alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"alert_key" varchar(255) NOT NULL,
	"alert_type" varchar(30) NOT NULL,
	"dismissed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "download_clients" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" varchar(50) DEFAULT 'qbittorrent' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"host" varchar(255) NOT NULL,
	"port" integer DEFAULT 8080 NOT NULL,
	"use_ssl" boolean DEFAULT false NOT NULL,
	"auth_method" varchar(20) DEFAULT 'password' NOT NULL,
	"encrypted_username" text NOT NULL,
	"encrypted_password" text NOT NULL,
	"encrypted_api_key" text DEFAULT '' NOT NULL,
	"encrypted_url_path" text DEFAULT '' NOT NULL,
	"poll_interval_seconds" integer DEFAULT 300 NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"cross_seed_tags" text[] DEFAULT '{}' NOT NULL,
	"last_polled_at" timestamp,
	"last_error" text,
	"error_since" timestamp,
	"cached_torrents" jsonb,
	"cached_torrents_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_delivery_state" (
	"id" serial PRIMARY KEY NOT NULL,
	"target_id" integer NOT NULL,
	"tracker_id" integer,
	"event_type" varchar(50) NOT NULL,
	"last_notified_at" timestamp NOT NULL,
	"snoozed_until" timestamp
);
--> statement-breakpoint
CREATE TABLE "notification_targets" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" varchar(30) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"encrypted_config" text NOT NULL,
	"notify_ratio_drop" boolean DEFAULT false NOT NULL,
	"notify_hit_and_run" boolean DEFAULT false NOT NULL,
	"notify_tracker_down" boolean DEFAULT false NOT NULL,
	"notify_buffer_milestone" boolean DEFAULT false NOT NULL,
	"notify_warned" boolean DEFAULT false NOT NULL,
	"notify_ratio_danger" boolean DEFAULT false NOT NULL,
	"notify_zero_seeding" boolean DEFAULT false NOT NULL,
	"notify_rank_change" boolean DEFAULT false NOT NULL,
	"notify_anniversary" boolean DEFAULT false NOT NULL,
	"notify_bonus_cap" boolean DEFAULT false NOT NULL,
	"notify_vip_expiring" boolean DEFAULT false NOT NULL,
	"notify_unsatisfied_limit" boolean DEFAULT false NOT NULL,
	"notify_active_hnrs" boolean DEFAULT false NOT NULL,
	"notify_download_disabled" boolean DEFAULT false NOT NULL,
	"thresholds" jsonb,
	"include_tracker_name" boolean DEFAULT true NOT NULL,
	"scope" integer[],
	"last_delivery_status" varchar(20),
	"last_delivery_at" timestamp,
	"last_delivery_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tag_group_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" integer NOT NULL,
	"tag" varchar(100) NOT NULL,
	"label" varchar(100) NOT NULL,
	"color" varchar(20),
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tag_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"emoji" varchar(10),
	"chart_type" varchar(20) DEFAULT 'bar' NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"count_unmatched" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "torrent_daily_checkpoints" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"hash" varchar(64) NOT NULL,
	"name" text NOT NULL,
	"checkpoint_date" date NOT NULL,
	"uploaded_start" bigint NOT NULL,
	"downloaded_start" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tracker_daily_checkpoints" (
	"id" serial PRIMARY KEY NOT NULL,
	"tracker_id" integer NOT NULL,
	"checkpoint_date" date NOT NULL,
	"uploaded_bytes_end" bigint NOT NULL,
	"downloaded_bytes_end" bigint NOT NULL,
	"buffer_bytes_end" bigint,
	"ratio_end" real,
	"seedbonus_end" real,
	"snapshot_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tracker_outages" (
	"id" serial PRIMARY KEY NOT NULL,
	"tracker_id" integer NOT NULL,
	"started_at" timestamp NOT NULL,
	"ended_at" timestamp NOT NULL,
	"reason" varchar(20) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tracker_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"tracker_id" integer NOT NULL,
	"role_name" varchar(255) NOT NULL,
	"achieved_at" timestamp DEFAULT now() NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "tracker_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"tracker_id" integer NOT NULL,
	"polled_at" timestamp DEFAULT now() NOT NULL,
	"uploaded_bytes" bigint NOT NULL,
	"downloaded_bytes" bigint NOT NULL,
	"ratio" real,
	"buffer_bytes" bigint,
	"seeding_count" integer,
	"leeching_count" integer,
	"seedbonus" real,
	"hit_and_runs" integer,
	"required_ratio" real,
	"warned" boolean,
	"freeleech_tokens" integer,
	"share_score" real,
	"username" varchar(255),
	"group_name" varchar(255),
	"is_manual" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trackers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"base_url" text NOT NULL,
	"api_path" varchar(255) DEFAULT '/api/user' NOT NULL,
	"platform_type" varchar(50) DEFAULT 'unit3d' NOT NULL,
	"registry_slug" varchar(100),
	"encrypted_api_token" text NOT NULL,
	"encrypted_credentials" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_polled_at" timestamp,
	"last_error" text,
	"last_error_at" timestamp,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"paused_at" timestamp,
	"user_paused_at" timestamp,
	"color" varchar(20) DEFAULT '#9e3f1f',
	"qbt_tag" varchar(100),
	"remote_user_id" integer,
	"platform_meta" text,
	"mousehole_url" text,
	"encrypted_mousehole_token" text,
	"avatar_data" text,
	"avatar_mime_type" varchar(50),
	"avatar_cached_at" timestamp,
	"avatar_remote_url" text,
	"use_proxy" boolean DEFAULT false NOT NULL,
	"count_cross_seed_unsatisfied" boolean DEFAULT false NOT NULL,
	"hide_unread_badges" boolean DEFAULT false NOT NULL,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"sort_order" integer,
	"joined_at" date,
	"last_access_at" date,
	"profile_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "client_snapshots" ADD CONSTRAINT "client_snapshots_client_id_download_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."download_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_uptime_buckets" ADD CONSTRAINT "client_uptime_buckets_client_id_download_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."download_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_delivery_state" ADD CONSTRAINT "fk_delivery_state_target" FOREIGN KEY ("target_id") REFERENCES "public"."notification_targets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag_group_members" ADD CONSTRAINT "tag_group_members_group_id_tag_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."tag_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "torrent_daily_checkpoints" ADD CONSTRAINT "torrent_daily_checkpoints_client_id_download_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."download_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracker_daily_checkpoints" ADD CONSTRAINT "tracker_daily_checkpoints_tracker_id_trackers_id_fk" FOREIGN KEY ("tracker_id") REFERENCES "public"."trackers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracker_outages" ADD CONSTRAINT "tracker_outages_tracker_id_trackers_id_fk" FOREIGN KEY ("tracker_id") REFERENCES "public"."trackers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracker_roles" ADD CONSTRAINT "tracker_roles_tracker_id_trackers_id_fk" FOREIGN KEY ("tracker_id") REFERENCES "public"."trackers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracker_snapshots" ADD CONSTRAINT "tracker_snapshots_tracker_id_trackers_id_fk" FOREIGN KEY ("tracker_id") REFERENCES "public"."trackers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_app_coverage_gaps_started" ON "app_coverage_gaps" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "idx_app_coverage_gaps_ended" ON "app_coverage_gaps" USING btree ("ended_at");--> statement-breakpoint
CREATE INDEX "idx_client_snapshots_client_polled" ON "client_snapshots" USING btree ("client_id","polled_at");--> statement-breakpoint
CREATE INDEX "idx_client_snapshots_polled_brin" ON "client_snapshots" USING brin ("polled_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_client_uptime_bucket" ON "client_uptime_buckets" USING btree ("client_id","bucket_ts");--> statement-breakpoint
CREATE INDEX "idx_uptime_bucket_ts" ON "client_uptime_buckets" USING btree ("bucket_ts");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_db_size_recorded_at" ON "db_size_history" USING btree ("recorded_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_dismissed_alert_key" ON "dismissed_alerts" USING btree ("alert_key");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_delivery_state_target_tracker_event" ON "notification_delivery_state" USING btree ("target_id","tracker_id","event_type");--> statement-breakpoint
CREATE INDEX "idx_delivery_state_tracker_id" ON "notification_delivery_state" USING btree ("tracker_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_torrent_checkpoint_client_hash_date" ON "torrent_daily_checkpoints" USING btree ("client_id","hash","checkpoint_date");--> statement-breakpoint
CREATE INDEX "idx_torrent_checkpoint_date" ON "torrent_daily_checkpoints" USING btree ("checkpoint_date");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tracker_checkpoint_tracker_date" ON "tracker_daily_checkpoints" USING btree ("tracker_id","checkpoint_date");--> statement-breakpoint
CREATE INDEX "idx_tracker_outages_tracker_started" ON "tracker_outages" USING btree ("tracker_id","started_at");--> statement-breakpoint
CREATE INDEX "idx_tracker_outages_ended" ON "tracker_outages" USING btree ("ended_at");--> statement-breakpoint
CREATE INDEX "idx_tracker_roles_tracker_id" ON "tracker_roles" USING btree ("tracker_id");--> statement-breakpoint
CREATE INDEX "idx_snapshots_tracker_polled" ON "tracker_snapshots" USING btree ("tracker_id","polled_at");--> statement-breakpoint
CREATE INDEX "idx_snapshots_polled_brin" ON "tracker_snapshots" USING brin ("polled_at");

-- p02a runtime indexes
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
