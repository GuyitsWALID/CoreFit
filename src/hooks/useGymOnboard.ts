// deno-lint-ignore-file
import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface OnboardingData {
  name: string;
  owner_name: string;
  owner_phone?: string;
  owner_email?: string;
  street?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  address: string;
  timezone?: string;
  brand_color: string;
  amenities: string[];
  tags: string[];
  max_capacity?: number | null;
  latitude?: number;
  longitude?: number;
  description?: string;
}

export const useGymOnboard = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onboardGym = async (data: OnboardingData) => {
    setLoading(true);
    setError(null);

    try {
      // Insert gym data matching your updated schema
      const { data: gym, error: gymError } = await supabase
        .from('gyms')
        .insert({
          name: data.name,
          owner_name: data.owner_name,
          owner_phone: data.owner_phone || null,
          owner_email: data.owner_email || null,
          street: data.street || null,
          city: data.city || null,
          state: data.state || null,
          postal_code: data.postal_code || null,
          country: data.country || null,
          address: data.address || null,
          timezone: data.timezone || null,
          brand_color: data.brand_color,
          amenities: data.amenities || [],
          tags: data.tags || [],
          max_capacity: data.max_capacity || null,
          latitude: data.latitude || null,
          longitude: data.longitude || null,
          description: data.description || null,
          status: 'active'
        })
        .select()
        .single();

      if (gymError) {
        throw new Error(`Failed to create gym: ${gymError.message}`);
      }

      // Use gym ID as route identifier
      const gymRoute = gym.id;

      return {
        success: true,
        gym,
        slug: gymRoute,
        url: `/${gymRoute}`,
        message: `Gym "${data.name}" onboarded successfully!`
      };

    } catch (err: any) {
      const errorMessage = err.message || 'Failed to onboard gym';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return {
    onboardGym,
    loading,
    error
  };
};
