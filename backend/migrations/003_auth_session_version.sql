BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS auth_version INTEGER NOT NULL DEFAULT 0;

INSERT INTO app_migrations (version)
VALUES ('003_auth_session_version')
ON CONFLICT (version) DO NOTHING;

COMMIT;
