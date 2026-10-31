ALTER TABLE notification_targets
  ADD COLUMN IF NOT EXISTS notify_login_due boolean NOT NULL DEFAULT false;
