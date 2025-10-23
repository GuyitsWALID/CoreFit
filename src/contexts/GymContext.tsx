import React, { createContext, useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { fetchGymBySlug, GymConfig } from '@/lib/gymApi';

interface GymContextType {
  gym: GymConfig | null;
  loading: boolean;
  error: string | null;
  isDefaultGym: boolean;
  loadGym: (slug: string) => Promise<void>;
}

const GymContext = createContext<GymContextType | undefined>(undefined);

export const useGym = () => {
  const context = useContext(GymContext);
  if (context === undefined) {
    throw new Error('useGym must be used within a GymProvider');
  }
  return context;
};

// Default gym configuration (fallback) - updated to match actual schema
const DEFAULT_GYM: GymConfig = {
  id: 'default',
  name: 'CoreFit Fitness Hub',
  address: 'Sample Address, Atlanta, GA',
  brand_color: '#2563eb',
  amenities: ['Gym Equipment', 'Locker Room'],
  tags: ['Fitness', 'Training'],
  status: 'active',
  timezone: 'America/New_York',
  max_capacity: 100,
  created_at: new Date().toISOString(),
  street: 'Sample Street',
  city: 'Atlanta',
  state: 'GA',
  country: 'United States',
  website: 'https://example.com',
  social_media: {},
  opening_hours: {},
  is_featured: false
};

export const GymProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [gym, setGym] = useState<GymConfig | null>(DEFAULT_GYM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDefaultGym, setIsDefaultGym] = useState(true);
  const location = useLocation();

  const loadGym = async (slug: string) => {
    if (slug === 'default' || !slug) {
      setGym(DEFAULT_GYM);
      setIsDefaultGym(true);
      applyTheme(DEFAULT_GYM);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetchGymBySlug(slug);

      if (!result.success || !result.gym) {
        console.error('API error loading gym:', result);
        setError(result.error || 'Gym not found');
        setGym(DEFAULT_GYM);
        setIsDefaultGym(true);
        applyTheme(DEFAULT_GYM);
        return;
      }

      // Ensure all required fields are present with fallbacks
      const gymWithDefaults: GymConfig = {
        ...DEFAULT_GYM,
        ...result.gym,
        brand_color: result.gym.brand_color || DEFAULT_GYM.brand_color,
        amenities: result.gym.amenities || DEFAULT_GYM.amenities,
        tags: result.gym.tags || DEFAULT_GYM.tags,
      };

      setGym(gymWithDefaults);
      setIsDefaultGym(false);
      
      // Apply dynamic theme
      applyTheme(gymWithDefaults);
      
    } catch (err: any) {
      console.error('Unexpected error loading gym:', err);
      setError(err.message || 'Failed to load gym configuration');
      setGym(DEFAULT_GYM);
      setIsDefaultGym(true);
      applyTheme(DEFAULT_GYM);
    } finally {
      setLoading(false);
    }
  };

  const applyTheme = (gymConfig: GymConfig) => {
    const root = document.documentElement;
    const primaryColor = gymConfig.brand_color || '#2563eb';
    
    root.style.setProperty('--gym-primary', primaryColor);
    root.style.setProperty('--gym-secondary', primaryColor);
    root.style.setProperty('--gym-accent', primaryColor);
    
    // Update CSS custom properties for fitness theme
    root.style.setProperty('--fitness-primary', primaryColor);
    root.style.setProperty('--fitness-secondary', primaryColor);
    
    // Update document title
    document.title = `${gymConfig.name} - Admin Dashboard`;
  };

  // Extract gym slug from React Router location
  useEffect(() => {
    const pathSegments = location.pathname.split('/').filter(Boolean);
    let gymSlug = 'default';
    
    // Handle different route patterns:
    // /{gym-slug}/dashboard
    // /{gym-slug}/memberships
    // etc.
    if (pathSegments.length > 0) {
      const firstSegment = pathSegments[0];
      
      // Skip admin routes
      if (firstSegment !== 'admin' && firstSegment !== 'onboard') {
        gymSlug = firstSegment;
      }
    }
    
    loadGym(gymSlug);
  }, [location.pathname]);

  return (
    <GymContext.Provider value={{ gym, loading, error, isDefaultGym, loadGym }}>
      {children}
    </GymContext.Provider>
  );
};
