-- Add ip_hash column for server-side rate limiting (1 submission per IP per day)
ALTER TABLE user_prompts ADD COLUMN IF NOT EXISTS ip_hash TEXT;

-- Index for fast lookup by ip_hash + date
CREATE INDEX IF NOT EXISTS idx_user_prompts_ip_hash_created
  ON user_prompts (ip_hash, created_at);
