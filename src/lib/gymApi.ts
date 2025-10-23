import { supabase } from '@/lib/supabaseClient';

export interface GymConfig {
  id: string;
  name: string;
  created_by?: string;
  timezone?: string;
  website?: string;
  social_media?: object;
  is_featured?: boolean;
  tags?: string[];
  street?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  address?: string;
  opening_hours?: object;
  facilities_schedule?: object;
  max_capacity?: number;
  deleted_at?: string;
  owner_id?: string;
  manager_id?: string;
  logo?: string;
  images?: string[];
  amenities?: string[];
  brand_color?: string;
  status: 'active' | 'inactive' | 'archived';
  created_at: string;
  updated_at?: string;
  // Add computed/virtual fields for compatibility
  description?: string;
}

export interface GymApiResponse {
  success: boolean;
  gym?: GymConfig;
  error?: string;
  details?: string;
  message?: string;
}

export const fetchGymBySlug = async (slugOrId: string): Promise<GymApiResponse> => {
  try {
    if (!slugOrId || typeof slugOrId !== 'string') {
      return {
        success: false,
        error: 'Invalid gym identifier'
      };
    }

    // Since your schema doesn't have a slug field, we'll search by ID first, then by name
    let gym: GymConfig | null = null;
    
    // Try by ID first (UUID format)
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i;
    if (uuidRegex.test(slugOrId)) {
      const { data: gymById, error: idError } = await supabase
        .from('gyms')
        .select('*')
        .eq('id', slugOrId)
        .eq('status', 'active')
        .single();
      
      if (!idError && gymById) {
        gym = gymById;
      }
    }
    
    // If not found by ID, try by name (partial match)
    if (!gym) {
      const { data: gymByName, error: nameError } = await supabase
        .from('gyms')
        .select('*')
        .ilike('name', `%${slugOrId}%`)
        .eq('status', 'active')
        .limit(1)
        .single();
      
      if (!nameError && gymByName) {
        gym = gymByName;
      }
    }

    if (!gym) {
      return {
        success: false,
        error: 'Gym not found',
        details: `No active gym found with identifier: ${slugOrId}`
      };
    }

    // Return gym data with success flag
    return {
      success: true,
      gym,
      message: `Successfully fetched gym: ${gym.name}`
    };

  } catch (error: any) {
    console.error('Error fetching gym:', error);
    return {
      success: false,
      error: 'Internal error',
      details: error?.message || 'Unknown error occurred'
    };
  }
};
