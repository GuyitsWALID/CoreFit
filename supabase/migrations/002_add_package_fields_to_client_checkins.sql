-- Migration: add package metadata fields to client_checkins
-- Adds package_type_at_checkin and package_access_level_at_checkin to record package info at check-in time

ALTER TABLE IF EXISTS client_checkins
  ADD COLUMN IF NOT EXISTS package_type_at_checkin TEXT,
  ADD COLUMN IF NOT EXISTS package_access_level_at_checkin TEXT;

-- Optional: add index for faster queries by package_type
CREATE INDEX IF NOT EXISTS idx_client_checkins_package_type ON client_checkins (package_type_at_checkin);
