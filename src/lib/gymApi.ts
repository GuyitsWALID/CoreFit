import { supabase } from '@/lib/supabaseClient';

/* ─── Payment recording ─── */

export interface RecordPaymentParams {
  user_id: string;
  gym_id: string;
  package_id?: string | null;
  amount: number;
  payment_method?: string;
  payment_status?: string;
  transaction_id?: string | null;
  remarks?: string | null;
}

/**
 * Insert a row into the `payments` table for any revenue event
 * (registration, renewal, upgrade, manual addition, etc.).
 * Returns the inserted payment row or throws on error.
 */
export const recordPayment = async (params: RecordPaymentParams) => {
  const {
    user_id,
    gym_id,
    package_id = null,
    amount,
    payment_method = 'admin',
    payment_status = 'completed',
    transaction_id = null,
    remarks = null,
  } = params;

  const { data, error } = await supabase
    .from('payments')
    .insert({
      user_id,
      gym_id,
      package_id,
      amount,
      payment_method,
      payment_status,
      transaction_id,
      remarks,
      migrated_from_legacy: false,
    })
    .select()
    .single();

  if (error) {
    console.error('[recordPayment] insert failed:', error);
    throw error;
  }
  return data;
};

/* ─── Revenue summary ─── */

export interface RevenueSummary {
  gym_id: string;
  total_payments: number;
  total_revenue: number;
  legacy_revenue: number;
  live_revenue: number;
  revenue_this_month: number;
  revenue_today: number;
  payments_today: number;
  payments_this_month: number;
}

/**
 * Fetch the pre-computed revenue summary from the `revenue_summary` view.
 */
export const fetchRevenueSummary = async (gymId: string): Promise<RevenueSummary | null> => {
  const { data, error } = await supabase
    .from('revenue_summary')
    .select('*')
    .eq('gym_id', gymId)
    .maybeSingle();

  if (error) {
    console.error('[fetchRevenueSummary] query failed:', error);
    return null;
  }
  return data as RevenueSummary | null;
};

/* ─── Gym config ─── */
export interface GymConfig {
  id: string;
  slug?: string;
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
