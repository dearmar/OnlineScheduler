-- Calendar Scheduler Database Schema for Neon PostgreSQL

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Admin users table
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  password_hash VARCHAR(255) NOT NULL,
  must_reset_password BOOLEAN DEFAULT FALSE,
  reset_token VARCHAR(64),
  reset_token_expires TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP WITH TIME ZONE
);

-- Scheduler configuration table
CREATE TABLE IF NOT EXISTS scheduler_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- Single row table
  business_name VARCHAR(255) DEFAULT 'Your Business',
  logo TEXT,
  primary_color VARCHAR(7) DEFAULT '#1a1a2e',
  accent_color VARCHAR(7) DEFAULT '#4f46e5',
  start_hour INTEGER DEFAULT 9 CHECK (start_hour >= 0 AND start_hour <= 23),
  end_hour INTEGER DEFAULT 17 CHECK (end_hour >= 1 AND end_hour <= 24),
  timezone VARCHAR(50) DEFAULT 'America/New_York',
  outlook_email VARCHAR(255),
  outlook_connected BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Meeting types table
CREATE TABLE IF NOT EXISTS meeting_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  duration INTEGER NOT NULL CHECK (duration IN (15, 30, 60)),
  description TEXT,
  color VARCHAR(7) DEFAULT '#4f46e5',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  time TIME NOT NULL,
  duration INTEGER NOT NULL,
  meeting_type_id UUID REFERENCES meeting_types(id) ON DELETE SET NULL,
  meeting_type_name VARCHAR(255) NOT NULL, -- Denormalized for history
  client_name VARCHAR(255) NOT NULL,
  client_email VARCHAR(255) NOT NULL,
  notes TEXT,
  outlook_event_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Microsoft OAuth tokens table
CREATE TABLE IF NOT EXISTS microsoft_tokens (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- Single row table
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at BIGINT NOT NULL,
  scope TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Webhook subscriptions table
CREATE TABLE IF NOT EXISTS webhook_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  url TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT ARRAY['booking.created', 'booking.updated', 'booking.cancelled'],
  secret VARCHAR(64) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_triggered TIMESTAMP WITH TIME ZONE
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(date);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_client_email ON bookings(client_email);
CREATE INDEX IF NOT EXISTS idx_meeting_types_active ON meeting_types(is_active);

-- Insert default configuration if not exists
INSERT INTO scheduler_config (id) 
VALUES (1) 
ON CONFLICT (id) DO NOTHING;

-- Insert default meeting types if table is empty
INSERT INTO meeting_types (name, duration, description, color, sort_order)
SELECT * FROM (VALUES
  ('Quick Chat', 15, 'A brief 15-minute consultation', '#10b981', 1),
  ('Standard Meeting', 30, 'A focused 30-minute discussion', '#4f46e5', 2),
  ('Deep Dive', 60, 'An in-depth 60-minute session', '#8b5cf6', 3)
) AS defaults(name, duration, description, color, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM meeting_types LIMIT 1);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_scheduler_config_updated_at ON scheduler_config;
CREATE TRIGGER update_scheduler_config_updated_at
  BEFORE UPDATE ON scheduler_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_meeting_types_updated_at ON meeting_types;
CREATE TRIGGER update_meeting_types_updated_at
  BEFORE UPDATE ON meeting_types
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_bookings_updated_at ON bookings;
CREATE TRIGGER update_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_microsoft_tokens_updated_at ON microsoft_tokens;
CREATE TRIGGER update_microsoft_tokens_updated_at
  BEFORE UPDATE ON microsoft_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
