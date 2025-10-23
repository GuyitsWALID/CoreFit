// deno-lint-ignore-file
import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface OnboardingData {
  name: string;
  website?: string;
  street?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  address: string;
  timezone?: string;
  logo?: string;
  brand_color: string;
  amenities: string[];
  tags: string[];
  max_capacity?: number | null;
  social_media: object;
  opening_hours: object;
}

export const useGymOnboard = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onboardGym = async (data: OnboardingData) => {
    setLoading(true);
    setError(null);

    try {
      // Generate unique slug from gym name
      const baseSlug = data.name
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 50);

      let slug = baseSlug;
      let counter = 1;

      // Note: Since 'slug' field doesn't exist in your schema, we'll create a unique identifier
      // using the name + id after insertion, or you can add slug field to your schema

      // Insert gym data matching your schema
      const { data: gym, error: gymError } = await supabase
        .from('gyms')
        .insert({
          name: data.name,
          website: data.website || null,
          street: data.street || null,
          city: data.city || null,
          state: data.state || null,
          postal_code: data.postal_code || null,
          country: data.country || null,
          address: data.address || null,
          timezone: data.timezone || null,
          logo: data.logo || null,
          brand_color: data.brand_color,
          amenities: data.amenities || [],
          tags: data.tags || [],
          max_capacity: data.max_capacity || null,
          social_media: data.social_media || {},
          opening_hours: data.opening_hours || {},
          status: 'active',
          is_featured: false
        })
        .select()
        .single();

      if (gymError) {
        throw new Error(`Failed to create gym: ${gymError.message}`);
      }

      // Use gym ID as route identifier since slug field doesn't exist
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
