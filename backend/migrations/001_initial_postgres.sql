BEGIN;

CREATE TABLE IF NOT EXISTS app_migrations (
  version       TEXT PRIMARY KEY,
  applied_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  email         TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT users_email_normalized CHECK (email = LOWER(BTRIM(email)))
);

CREATE TABLE IF NOT EXISTS brand (
  id            SMALLINT PRIMARY KEY DEFAULT 1,
  data          JSONB NOT NULL DEFAULT '{"name":"ShopManager","image":""}'::jsonb,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT brand_singleton CHECK (id = 1)
);

CREATE TABLE IF NOT EXISTS shops (
  id            TEXT PRIMARY KEY,
  data          JSONB NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT shops_data_object CHECK (jsonb_typeof(data) = 'object')
);

CREATE INDEX IF NOT EXISTS shops_updated_at_idx ON shops (updated_at DESC);
CREATE INDEX IF NOT EXISTS shops_data_gin_idx ON shops USING GIN (data jsonb_path_ops);

INSERT INTO brand (id, data)
VALUES (1, '{"name":"ShopManager","image":""}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO app_migrations (version)
VALUES ('001_initial_postgres')
ON CONFLICT (version) DO NOTHING;

COMMIT;
