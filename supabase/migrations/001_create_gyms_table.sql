-- Create gyms table with schema matching onboarding form
CREATE TABLE gyms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  owner_name VARCHAR(255) NOT NULL,
  manager_name VARCHAR(255),
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(50) NOT NULL,
  address TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  primary_color VARCHAR(7) DEFAULT '#2563eb' NOT NULL,
  secondary_color VARCHAR(7) DEFAULT '#1e40af' NOT NULL,
  accent_color VARCHAR(7) DEFAULT '#f59e0b' NOT NULL,
  logo_path TEXT, -- Path to logo in Supabase storage (e.g., 'gyms/logos/gym-id-123.png')
  description TEXT,
  amenities TEXT[] DEFAULT '{}', -- Array of strings instead of JSONB for simpler handling
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('active', 'inactive', 'pending')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_gyms_slug ON gyms(slug);
CREATE INDEX idx_gyms_status ON gyms(status);
CREATE INDEX idx_gyms_email ON gyms(email);
CREATE INDEX idx_gyms_created_at ON gyms(created_at);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_gyms_updated_at
    BEFORE UPDATE ON gyms
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE gyms ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Allow public read for active gyms" ON gyms
  FOR SELECT USING (status = 'active');

-- Allow gym owners to update their own gym
CREATE POLICY "Allow gym owners to update own gym" ON gyms
  FOR UPDATE USING (
    auth.jwt() ->> 'email' = email OR 
    auth.uid()::text IN (
      SELECT staff.id::text FROM staff 
      WHERE staff.email = gyms.email 
      AND staff.is_active = true
    )
  );

-- Allow admins full access (replace with proper admin role check)
CREATE POLICY "Allow super admin full access" ON gyms
  FOR ALL USING (
    auth.jwt() ->> 'role' = 'super_admin' OR
    auth.uid()::text IN (
      SELECT staff.id::text FROM staff 
      JOIN roles ON staff.role_id = roles.id 
      WHERE roles.name = 'super_admin' 
      AND staff.is_active = true
    )
  );

-- Allow authenticated users to insert new gyms (for onboarding)
CREATE POLICY "Allow authenticated users to create gyms" ON gyms
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Create storage bucket for gym logos if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('gym-logos', 'gym-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies for gym logos
CREATE POLICY "Allow public read access to gym logos" ON storage.objects
  FOR SELECT USING (bucket_id = 'gym-logos');

CREATE POLICY "Allow authenticated users to upload gym logos" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'gym-logos' AND 
    auth.role() = 'authenticated'
  );

CREATE POLICY "Allow gym owners to update their logos" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'gym-logos' AND 
    auth.role() = 'authenticated'
  );

CREATE POLICY "Allow gym owners to delete their logos" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'gym-logos' AND 
    auth.role() = 'authenticated'
  );

-- Create a helper function to get full logo URL
CREATE OR REPLACE FUNCTION get_gym_logo_url(logo_path TEXT)
RETURNS TEXT AS $$
BEGIN
  IF logo_path IS NULL OR logo_path = '' THEN
    RETURN NULL;
  END IF;
  
  RETURN concat(
    current_setting('app.settings.supabase_url', true),
    '/storage/v1/object/public/gym-logos/',
    logo_path
  );
END;
$$ LANGUAGE plpgsql;

-- Create a view with logo URLs for easier frontend consumption
CREATE VIEW gyms_with_logo_urls AS
SELECT 
  g.*,
  get_gym_logo_url(g.logo_path) as logo_url
FROM gyms g;

-- Grant access to the view
GRANT SELECT ON gyms_with_logo_urls TO authenticated;
GRANT SELECT ON gyms_with_logo_urls TO anon;
