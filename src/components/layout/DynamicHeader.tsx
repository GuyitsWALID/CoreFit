// deno-lint-ignore-file no-sloppy-imports
import React from 'react';
import { useGym } from '@/contexts/GymContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Globe, Menu } from 'lucide-react';

export const DynamicHeader: React.FC<{ onMenuClick?: () => void }> = ({ onMenuClick }) => {
  const { gym, loading, isDefaultGym } = useGym();

  const getReadableTextColor = (hexColor: string) => {
    const normalized = hexColor.replace('#', '');
    if (normalized.length !== 6) return 'white';
    const red = parseInt(normalized.slice(0, 2), 16);
    const green = parseInt(normalized.slice(2, 4), 16);
    const blue = parseInt(normalized.slice(4, 6), 16);
    const brightness = (red * 299 + green * 587 + blue * 114) / 1000;
    return brightness > 155 ? '#111827' : 'white';
  };

  if (loading) {
    return (
      <>
        {/* Mobile compact skeleton */}
        <div className="border-b bg-white sm:hidden">
          <div className="container mx-auto px-4 py-3">
            <div className="animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-36 mb-1"></div>
            </div>
          </div>
        </div>

        {/* Desktop skeleton */}
        <div className="border-b bg-white hidden sm:block">
          <div className="container mx-auto px-4 py-3">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-48 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-32"></div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (!gym) return null;

  const brandColor = gym.brand_color || '#2563eb';
  const activeBadgeStyle = {
    backgroundColor: gym.status === 'active' ? brandColor : '#6b7280',
    color: gym.status === 'active' ? getReadableTextColor(brandColor) : 'white',
    boxShadow: gym.status === 'active' ? `0 0 0 1px ${brandColor}30, 0 6px 16px ${brandColor}25` : 'none',
    border: gym.status === 'active' ? `1px solid ${brandColor}40` : undefined,
  };
  const themedOutlineStyle = {
    borderColor: `${brandColor}60`,
    color: brandColor,
    backgroundColor: `${brandColor}10`,
  };

  return (
    <>
      {/* Compact mobile header - only show essential info */}
      <div 
        className="border-b shadow-sm sm:hidden"
        style={{ 
          background: `linear-gradient(135deg, ${brandColor}10 0%, ${brandColor}10 100%)`,
          borderBottomColor: `${brandColor}20`
        }}
      >
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="md:hidden">
                <Button variant="ghost" size="icon" onClick={onMenuClick} aria-label="Open menu">
                  <Menu size={18} />
                </Button>
              </div>
              <h2 className="text-lg font-semibold truncate" style={{ color: brandColor }}>{gym.name}</h2>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                style={activeBadgeStyle}
                className="text-xs px-2 py-1"
              >
                {gym.status}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Full header for larger screens */}
      <div 
        className="border-b shadow-sm hidden sm:block"
        style={{ 
          background: `linear-gradient(135deg, ${brandColor}10 0%, ${brandColor}10 100%)`,
          borderBottomColor: `${brandColor}20`
        }}
      >
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Note: logo field doesn't exist in new schema, you may want to add it */}
              <div>
                <h1 
                  className="text-2xl font-bold"
                  style={{ color: brandColor }}
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
                <Badge variant="outline" className="text-xs" style={themedOutlineStyle}>
                  Default Configuration
                </Badge>
              )}
              <Badge 
                style={activeBadgeStyle}
              >
                {gym.status}
              </Badge>
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
                  style={{ borderColor: `${brandColor}40` }}
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
    </>
  );
};
