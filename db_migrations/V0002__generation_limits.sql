CREATE TABLE IF NOT EXISTS generation_log (
    id SERIAL PRIMARY KEY,
    user_email TEXT NOT NULL DEFAULT '',
    device_id TEXT NOT NULL DEFAULT '',
    kind TEXT NOT NULL DEFAULT 'free',
    engine TEXT NOT NULL DEFAULT '',
    seconds INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS generation_log_email_idx
    ON generation_log (user_email, kind, created_at DESC);

CREATE INDEX IF NOT EXISTS generation_log_device_idx
    ON generation_log (device_id, created_at DESC);

ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_until TIMESTAMPTZ;
