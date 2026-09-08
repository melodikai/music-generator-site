CREATE TABLE IF NOT EXISTS password_resets (
    token TEXT PRIMARY KEY,
    user_email TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS password_resets_email_idx
    ON password_resets (user_email, created_at DESC);
