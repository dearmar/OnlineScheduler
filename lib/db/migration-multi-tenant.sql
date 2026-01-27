-- Migration: Convert to multi-tenant architecture
-- Run this in Neon SQL Editor to update existing database
-- WARNING: This is a destructive migration. Backup your data first!

-- Step 1: Add slug column to admin_users
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS slug VARCHAR(100) UNIQUE;

-- Step 2: Generate slugs for existing users
UPDATE admin_users SET slug = LOWER(REGEXP_REPLACE(REGEXP_REPLACE(COALESCE(name, 'admin'), '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'))
WHERE slug IS NULL;

-- Step 3: Add user_id to scheduler_config (for existing single-tenant data)
-- First, get the ID of the first admin user
DO $$
DECLARE
  first_user_id UUID;
BEGIN
  -- Get first admin user ID
  SELECT id INTO first_user_id FROM admin_users ORDER BY created_at ASC LIMIT 1;
  
  IF first_user_id IS NOT NULL THEN
    -- Check if scheduler_config needs migration
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scheduler_config' AND column_name = 'id' AND data_type = 'integer') THEN
      -- Create new table with correct schema
      CREATE TABLE IF NOT EXISTS scheduler_config_new (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
        business_name VARCHAR(255) DEFAULT 'Your Business',
        logo TEXT,
        primary_color VARCHAR(7) DEFAULT '#1a1a2e',
        accent_color VARCHAR(7) DEFAULT '#4f46e5',
        start_hour INTEGER DEFAULT 9,
        end_hour INTEGER DEFAULT 17,
        timezone VARCHAR(50) DEFAULT 'America/New_York',
        outlook_email VARCHAR(255),
        outlook_connected BOOLEAN DEFAULT FALSE,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id)
      );
      
      -- Copy existing data
      INSERT INTO scheduler_config_new (user_id, business_name, logo, primary_color, accent_color, start_hour, end_hour, timezone, outlook_email, outlook_connected)
      SELECT first_user_id, business_name, logo, primary_color, accent_color, start_hour, end_hour, timezone, outlook_email, outlook_connected
      FROM scheduler_config LIMIT 1;
      
      -- Drop old table and rename
      DROP TABLE scheduler_config;
      ALTER TABLE scheduler_config_new RENAME TO scheduler_config;
    END IF;
    
    -- Add user_id to meeting_types if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_types' AND column_name = 'user_id') THEN
      ALTER TABLE meeting_types ADD COLUMN user_id UUID REFERENCES admin_users(id) ON DELETE CASCADE;
      UPDATE meeting_types SET user_id = first_user_id WHERE user_id IS NULL;
      ALTER TABLE meeting_types ALTER COLUMN user_id SET NOT NULL;
    END IF;
    
    -- Add user_id to bookings if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'user_id') THEN
      ALTER TABLE bookings ADD COLUMN user_id UUID REFERENCES admin_users(id) ON DELETE CASCADE;
      UPDATE bookings SET user_id = first_user_id WHERE user_id IS NULL;
      ALTER TABLE bookings ALTER COLUMN user_id SET NOT NULL;
    END IF;
    
    -- Migrate microsoft_tokens
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'microsoft_tokens' AND column_name = 'id' AND data_type = 'integer') THEN
      CREATE TABLE IF NOT EXISTS microsoft_tokens_new (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
        access_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        expires_at BIGINT NOT NULL,
        scope TEXT,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id)
      );
      
      INSERT INTO microsoft_tokens_new (user_id, access_token, refresh_token, expires_at, scope)
      SELECT first_user_id, access_token, refresh_token, expires_at, scope
      FROM microsoft_tokens LIMIT 1;
      
      DROP TABLE microsoft_tokens;
      ALTER TABLE microsoft_tokens_new RENAME TO microsoft_tokens;
    END IF;
    
    -- Add user_id to webhook_subscriptions if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'webhook_subscriptions' AND column_name = 'user_id') THEN
      ALTER TABLE webhook_subscriptions ADD COLUMN user_id UUID REFERENCES admin_users(id) ON DELETE CASCADE;
      UPDATE webhook_subscriptions SET user_id = first_user_id WHERE user_id IS NULL;
      ALTER TABLE webhook_subscriptions ALTER COLUMN user_id SET NOT NULL;
    END IF;
  END IF;
END $$;

-- Step 4: Create indexes
CREATE INDEX IF NOT EXISTS idx_scheduler_config_user ON scheduler_config(user_id);
CREATE INDEX IF NOT EXISTS idx_meeting_types_user ON meeting_types(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_slug ON admin_users(slug);

-- Verify migration
SELECT 'admin_users' as table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'admin_users' AND column_name IN ('id', 'slug')
UNION ALL
SELECT 'scheduler_config', column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'scheduler_config' AND column_name IN ('id', 'user_id')
UNION ALL
SELECT 'meeting_types', column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'meeting_types' AND column_name IN ('id', 'user_id')
ORDER BY table_name, column_name;
