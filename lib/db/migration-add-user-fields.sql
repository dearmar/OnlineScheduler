-- Migration: Add user management fields to admin_users table
-- Run this in Neon SQL Editor to update existing database

-- Add new columns to admin_users table
ALTER TABLE admin_users 
ADD COLUMN IF NOT EXISTS name VARCHAR(255),
ADD COLUMN IF NOT EXISTS must_reset_password BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS reset_token VARCHAR(64),
ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES admin_users(id) ON DELETE SET NULL;

-- Update existing user to have a name
UPDATE admin_users SET name = 'Admin' WHERE name IS NULL;

-- Verify the changes
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'admin_users'
ORDER BY ordinal_position;
