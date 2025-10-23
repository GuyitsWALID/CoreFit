import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)


export interface Gym {
  id: string;
  name: string;
  slug: string;
  owner_name: string;
  manager_name?: string;
  email: string;
  phone: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  logo_url?: string;
  description?: string;
  amenities: string[];
  status: 'active' | 'inactive' | 'pending';
  created_at: string;
  updated_at?: string;
}

//C:\Users\walid\OneDrive\Desktop\atl-fitness-hub-main\src\supabaseClient.ts