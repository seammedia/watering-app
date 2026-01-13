-- Supabase Schema for Smart Watering App
-- Run this in your Supabase SQL Editor (Database > SQL Editor)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Zones table - stores information about each watering zone
CREATE TABLE zones (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Weather snapshots - captures weather conditions at a point in time
CREATE TABLE weather_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  temperature DECIMAL(5,2) NOT NULL,
  humidity INTEGER NOT NULL,
  precipitation DECIMAL(6,2) NOT NULL,
  weather_code INTEGER NOT NULL,
  weather_description TEXT NOT NULL,
  wind_speed DECIMAL(5,2) NOT NULL,
  rainfall_last_24h DECIMAL(6,2) NOT NULL,
  rainfall_last_7days DECIMAL(6,2) NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL
);

-- Watering events - logs every watering session
CREATE TABLE watering_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  zone_id TEXT NOT NULL REFERENCES zones(id),
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  trigger TEXT NOT NULL CHECK (trigger IN ('manual', 'scheduled', 'automated')),
  weather_snapshot_id UUID REFERENCES weather_snapshots(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Soil readings - for future soil moisture sensors
CREATE TABLE soil_readings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  zone_id TEXT NOT NULL REFERENCES zones(id),
  moisture_percent DECIMAL(5,2) NOT NULL,
  temperature DECIMAL(5,2),
  captured_at TIMESTAMPTZ NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX idx_watering_events_zone_id ON watering_events(zone_id);
CREATE INDEX idx_watering_events_started_at ON watering_events(started_at DESC);
CREATE INDEX idx_soil_readings_zone_id ON soil_readings(zone_id);
CREATE INDEX idx_soil_readings_captured_at ON soil_readings(captured_at DESC);
CREATE INDEX idx_weather_snapshots_captured_at ON weather_snapshots(captured_at DESC);

-- Enable Row Level Security (RLS) - but allow all operations for now
-- You can add more restrictive policies later if needed

ALTER TABLE zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE watering_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE weather_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE soil_readings ENABLE ROW LEVEL SECURITY;

-- Create policies to allow all operations (adjust for your security needs)
CREATE POLICY "Allow all operations on zones" ON zones FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on watering_events" ON watering_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on weather_snapshots" ON weather_snapshots FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on soil_readings" ON soil_readings FOR ALL USING (true) WITH CHECK (true);

-- Grant access to anon and authenticated users
GRANT ALL ON zones TO anon, authenticated;
GRANT ALL ON watering_events TO anon, authenticated;
GRANT ALL ON weather_snapshots TO anon, authenticated;
GRANT ALL ON soil_readings TO anon, authenticated;
