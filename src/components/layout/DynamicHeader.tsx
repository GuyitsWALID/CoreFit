// deno-lint-ignore-file no-sloppy-imports
import React from 'react';
import { useGym } from '@/contexts/GymContext';
import { Badge } from '@/components/ui/badge';
import { MapPin, Globe } from 'lucide-react';

export const DynamicHeader: React.FC = () => {
  const { gym, loading, isDefaultGym } = useGym();

  if (loading) {
    return (
      <div className="border-b bg-white">
        <div className="container mx-auto px-4 py-3">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-48 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-32"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!gym) return null;

  return (
    <div 
      className="border-b shadow-sm"
      style={{ 
        background: `linear-gradient(135deg, ${gym.brand_color || '#2563eb'}10 0%, ${gym.brand_color || '#1e40af'}10 100%)`,
        borderBottomColor: `${gym.brand_color || '#2563eb'}20`
      }}
    >
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Note: logo field doesn't exist in new schema, you may want to add it */}
            <div>
              <h1 
                className="text-2xl font-bold"
                style={{ color: gym.brand_color || '#2563eb' }}
              >
                {gym.name}
              </h1>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                {gym.address && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    <span>{gym.address}</span>
                  </div>
                )}
                {gym.owner_email && (
                  <div className="flex items-center gap-1">
                    <Globe className="h-3 w-3" />
                    <span>{gym.owner_email}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {isDefaultGym && (
              <Badge variant="outline" className="text-xs">
                Default Configuration
              </Badge>
            )}
            <Badge 
              style={{ 
                backgroundColor: gym.status === 'active' ? gym.brand_color || '#10b981' : '#6b7280',
                color: 'white'
              }}
            >
              {gym.status}
            </Badge>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Globe className="h-3 w-3" />
              <span>/{gym.id}</span>
            </div>
          </div>
        </div>
        
        {gym.description && (
          <p className="mt-2 text-sm text-gray-600 max-w-2xl">
            {gym.description}
          </p>
        )}
        
        {gym.amenities && gym.amenities.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {gym.amenities.slice(0, 5).map((amenity, index) => (
              <Badge 
                key={index} 
                variant="outline" 
                className="text-xs"
                style={{ borderColor: `${gym.brand_color || '#2563eb'}40` }}
              >
                {amenity}
              </Badge>
            ))}
            {gym.amenities.length > 5 && (
              <Badge variant="outline" className="text-xs">
                +{gym.amenities.length - 5} more
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
