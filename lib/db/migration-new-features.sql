-- Migration: Add Gmail support, meeting locations, and per-day availability
-- Run this migration to add the new features

-- 1. Add Google Calendar support
CREATE TABLE IF NOT EXISTS google_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at BIGINT NOT NULL,
  scope TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);

-- 2. Add calendar provider and Google email to scheduler_config
ALTER TABLE scheduler_config 
ADD COLUMN IF NOT EXISTS calendar_provider VARCHAR(20) DEFAULT 'none',
ADD COLUMN IF NOT EXISTS google_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS google_connected BOOLEAN DEFAULT false;

-- Update existing records to set calendar_provider based on outlook_connected
UPDATE scheduler_config 
SET calendar_provider = CASE WHEN outlook_connected = true THEN 'outlook' ELSE 'none' END
WHERE calendar_provider IS NULL OR calendar_provider = 'none';

-- 3. Add weekly availability JSON column
ALTER TABLE scheduler_config 
ADD COLUMN IF NOT EXISTS weekly_availability JSONB;

-- Set default weekly availability based on existing start_hour and end_hour
UPDATE scheduler_config 
SET weekly_availability = jsonb_build_object(
  'sunday', jsonb_build_object('enabled', false, 'startHour', start_hour, 'endHour', end_hour),
  'monday', jsonb_build_object('enabled', true, 'startHour', start_hour, 'endHour', end_hour),
  'tuesday', jsonb_build_object('enabled', true, 'startHour', start_hour, 'endHour', end_hour),
  'wednesday', jsonb_build_object('enabled', true, 'startHour', start_hour, 'endHour', end_hour),
  'thursday', jsonb_build_object('enabled', true, 'startHour', start_hour, 'endHour', end_hour),
  'friday', jsonb_build_object('enabled', true, 'startHour', start_hour, 'endHour', end_hour),
  'saturday', jsonb_build_object('enabled', false, 'startHour', start_hour, 'endHour', end_hour)
)
WHERE weekly_availability IS NULL;

-- 4. Add location fields to meeting_types
ALTER TABLE meeting_types
ADD COLUMN IF NOT EXISTS location_type VARCHAR(20) DEFAULT 'virtual',
ADD COLUMN IF NOT EXISTS location TEXT;

-- 5. Add location and phone fields to bookings
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS client_phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS location_type VARCHAR(20),
ADD COLUMN IF NOT EXISTS location TEXT;

-- 6. Rename outlook_event_id to calendar_event_id (if not already done)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bookings' AND column_name = 'outlook_event_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bookings' AND column_name = 'calendar_event_id'
  ) THEN
    ALTER TABLE bookings RENAME COLUMN outlook_event_id TO calendar_event_id;
  END IF;
END $$;

-- Add calendar_event_id column if it doesn't exist (for fresh installs)
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS calendar_event_id TEXT;

-- Create index for google_tokens
CREATE INDEX IF NOT EXISTS idx_google_tokens_user_id ON google_tokens(user_id);
