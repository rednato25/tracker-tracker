-- 0005_integration_tokens.sql
-- P16 read-only integration API.
--
-- Tokens are stored only as SHA-256 hashes. The plaintext is returned once at
-- creation and never persisted. app_settings.integration_identity_mode controls
-- whether responses may disclose tracker names and, separately, usernames.

ALTER TABLE "app_settings" ADD COLUMN "integration_identity_mode" varchar(10) NOT NULL DEFAULT 'none';

CREATE TABLE "integration_tokens" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" varchar(100) NOT NULL,
  "token_hash" varchar(64) NOT NULL,
  "scopes" jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "last_used_at" timestamp,
  "revoked_at" timestamp
);

CREATE UNIQUE INDEX "uq_integration_tokens_hash" ON "integration_tokens" ("token_hash");
CREATE INDEX "idx_integration_tokens_revoked" ON "integration_tokens" ("revoked_at");
