import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export interface Gym {
  id: string;
  name: string;
  owner_name: string;
  owner_phone?: string;
  owner_email?: string;
  street?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  address?: string;
  timezone?: string;
  brand_color?: string;
  amenities?: string[];
  tags?: string[];
  max_capacity?: number;
  latitude?: number;
  longitude?: number;
  description?: string;
  status: 'active' | 'inactive' | 'pending' | 'archived';
  created_at: string;
  updated_at?: string;
  deleted_at?: string;
}