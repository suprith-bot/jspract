-- Migration: Social Authentication Tables
-- Description: Adds tables for social provider linkages, OAuth states, and updates users table
-- Date: 2024-01-25

-- Add new columns to users table for social authentication
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS display_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS account_source VARCHAR(20) DEFAULT 'email' CHECK (account_source IN ('email', 'google', 'facebook', 'github')),
  ADD COLUMN IF NOT EXISTS refresh_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS refresh_token_expiry TIMESTAMP;

-- Make password nullable to allow social-only accounts
ALTER TABLE users ALTER COLUMN password DROP NOT NULL;

-- Create social_providers table
CREATE TABLE IF NOT EXISTS social_providers (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_type VARCHAR(20) NOT NULL CHECK (provider_type IN ('google', 'facebook', 'github')),
  provider_id VARCHAR(255) NOT NULL,
  provider_email VARCHAR(255),
  access_token TEXT,
  refresh_token TEXT,
  token_expiry TIMESTAMP,
  profile_data JSONB DEFAULT '{}',
  connected_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(provider_type, provider_id),
  UNIQUE(user_id, provider_type)
);

-- Create indexes for social_providers
CREATE INDEX IF NOT EXISTS idx_social_providers_user_id ON social_providers(user_id);
CREATE INDEX IF NOT EXISTS idx_social_providers_provider ON social_providers(provider_type, provider_id);

-- Create oauth_states table for CSRF protection
CREATE TABLE IF NOT EXISTS oauth_states (
  id SERIAL PRIMARY KEY,
  state_token VARCHAR(255) UNIQUE NOT NULL,
  provider_type VARCHAR(20) NOT NULL,
  redirect_url VARCHAR(500),
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL
);

-- Create indexes for oauth_states
CREATE INDEX IF NOT EXISTS idx_oauth_states_token ON oauth_states(state_token);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expiry ON oauth_states(expires_at);

-- Add comments for documentation
COMMENT ON TABLE social_providers IS 'Stores social authentication provider linkages for users';
COMMENT ON TABLE oauth_states IS 'Temporary storage for OAuth CSRF state tokens (expire after 10 minutes)';
COMMENT ON COLUMN users.avatar_url IS 'Profile picture URL from social provider';
COMMENT ON COLUMN users.display_name IS 'Display name from social provider';
COMMENT ON COLUMN users.account_source IS 'Original account creation method (email or social provider)';
COMMENT ON COLUMN users.refresh_token_hash IS 'Hashed refresh token for session persistence';
COMMENT ON COLUMN users.refresh_token_expiry IS 'Refresh token expiration timestamp (typically 30 days)';
