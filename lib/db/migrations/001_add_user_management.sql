-- Migration: Add user management and password reset fields to admin_users table
-- Run this in your Neon SQL Editor if upgrading from an existing installation

-- Add new columns if they don't exist
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS name VARCHAR(255);
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS must_reset_password BOOLEAN DEFAULT FALSE;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(64);
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP WITH TIME ZONE;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES admin_users(id) ON DELETE SET NULL;

-- Update existing user to have a name if null
UPDATE admin_users SET name = 'Admin' WHERE name IS NULL;
