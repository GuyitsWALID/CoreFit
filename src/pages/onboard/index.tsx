import React, { useState } from 'react';
import { useGymOnboard } from '@/hooks/useGymOnboard';

interface OnboardingForm {
  name: string;
  website: string;
  street: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  address: string;
  timezone: string;
  logo: string;
  brand_color: string;
  amenities: string[];
  tags: string[];
  max_capacity: number | null;
  social_media: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    youtube?: string;
  };
  opening_hours: {
    monday?: { open: string; close: string; closed?: boolean };
    tuesday?: { open: string; close: string; closed?: boolean };
    wednesday?: { open: string; close: string; closed?: boolean };
    thursday?: { open: string; close: string; closed?: boolean };
    friday?: { open: string; close: string; closed?: boolean };
    saturday?: { open: string; close: string; closed?: boolean };
    sunday?: { open: string; close: string; closed?: boolean };
  };
}

export default function OnboardingForm() {
  const { onboardGym, loading, error } = useGymOnboard();
  
  const [form, setForm] = useState<OnboardingForm>({
    name: '',
    website: '',
    street: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'United States',
    address: '',
    timezone: 'America/New_York',
    logo: '',
    brand_color: '#2563eb',
    amenities: [],
    tags: [],
    max_capacity: null,
    social_media: {},
    opening_hours: {
      monday: { open: '06:00', close: '22:00' },
      tuesday: { open: '06:00', close: '22:00' },
      wednesday: { open: '06:00', close: '22:00' },
      thursday: { open: '06:00', close: '22:00' },
      friday: { open: '06:00', close: '22:00' },
      saturday: { open: '08:00', close: '20:00' },
      sunday: { open: '08:00', close: '18:00' }
    }
  });
  
  const [step, setStep] = useState(1);
  const [newAmenity, setNewAmenity] = useState('');
  const [newTag, setNewTag] = useState('');
  
  const updateForm = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const updateSocialMedia = (platform: string, value: string) => {
    setForm(prev => ({
      ...prev,
      social_media: {
        ...prev.social_media,
        [platform]: value
      }
    }));
  };

  const updateOpeningHours = (day: string, field: string, value: any) => {
    setForm(prev => ({
      ...prev,
      opening_hours: {
        ...prev.opening_hours,
        [day]: {
          ...prev.opening_hours[day as keyof typeof prev.opening_hours],
          [field]: value
        }
      }
    }));
  };

  const addAmenity = () => {
    if (newAmenity && !form.amenities.includes(newAmenity)) {
      updateForm('amenities', [...form.amenities, newAmenity]);
      setNewAmenity('');
    }
  };

  const removeAmenity = (amenity: string) => {
    updateForm('amenities', form.amenities.filter(a => a !== amenity));
  };

  const addTag = () => {
    if (newTag && !form.tags.includes(newTag)) {
      updateForm('tags', [...form.tags, newTag]);
      setNewTag('');
    }
  };

  const removeTag = (tag: string) => {
    updateForm('tags', form.tags.filter(t => t !== tag));
  };

  // Generate full address from components
  const generateFullAddress = () => {
    const parts = [form.street, form.city, form.state, form.postal_code, form.country].filter(Boolean);
    return parts.join(', ');
  };

  const handleSubmit = async () => {
    if (!form.name) {
      alert('Please fill in required fields');
      return;
    }

    // Auto-generate full address
    const fullAddress = generateFullAddress();

    try {
      const result = await onboardGym({
        ...form,
        address: fullAddress
      });

      alert(`${result.message} Your workspace URL: ${result.url}`);
      window.location.href = result.url;
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const nextStep = () => setStep(prev => Math.min(prev + 1, 5));
  const prevStep = () => setStep(prev => Math.max(prev - 1, 1));

  const timeZones = [
    'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
    'America/Phoenix', 'America/Anchorage', 'Pacific/Honolulu', 'UTC'
  ];

  const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white min-h-screen">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold">Gym Onboarding</h1>
          <span className="text-sm text-gray-500">Step {step} of 5</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(step / 5) * 100}%` }}
          />
        </div>
      </div>

      {/* Step 1: Basic Information */}
      {step === 1 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold">Basic Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Gym Name *"
              value={form.name}
              onChange={(e) => updateForm('name', e.target.value)}
              className="p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <input
              type="url"
              placeholder="Website URL"
              value={form.website}
              onChange={(e) => updateForm('website', e.target.value)}
              className="p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="url"
              placeholder="Logo URL"
              value={form.logo}
              onChange={(e) => updateForm('logo', e.target.value)}
              className="p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div>
              <label className="block text-sm font-medium mb-2">Brand Color</label>
              <input
                type="color"
                value={form.brand_color}
                onChange={(e) => updateForm('brand_color', e.target.value)}
                className="w-full h-12 border rounded-lg cursor-pointer"
              />
            </div>
            <input
              type="number"
              placeholder="Max Capacity"
              value={form.max_capacity || ''}
              onChange={(e) => updateForm('max_capacity', e.target.value ? parseInt(e.target.value) : null)}
              className="p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={form.timezone}
              onChange={(e) => updateForm('timezone', e.target.value)}
              className="p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {timeZones.map(tz => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Step 2: Address Information */}
      {step === 2 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold">Address Information</h2>
          <div className="grid grid-cols-1 gap-4">
            <input
              type="text"
              placeholder="Street Address"
              value={form.street}
              onChange={(e) => updateForm('street', e.target.value)}
              className="p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input
                type="text"
                placeholder="City"
                value={form.city}
                onChange={(e) => updateForm('city', e.target.value)}
                className="p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="State/Province"
                value={form.state}
                onChange={(e) => updateForm('state', e.target.value)}
                className="p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="Postal Code"
                value={form.postal_code}
                onChange={(e) => updateForm('postal_code', e.target.value)}
                className="p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <input
              type="text"
              placeholder="Country"
              value={form.country}
              onChange={(e) => updateForm('country', e.target.value)}
              className="p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium mb-2">Full Address Preview:</h4>
            <p className="text-gray-700">{generateFullAddress() || 'Enter address components above'}</p>
          </div>
        </div>
      )}

      {/* Step 3: Opening Hours */}
      {step === 3 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold">Opening Hours</h2>
          <div className="space-y-4">
            {daysOfWeek.map(day => (
              <div key={day} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center p-4 border rounded-lg">
                <div className="font-medium capitalize">{day}</div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!form.opening_hours[day as keyof typeof form.opening_hours]?.closed}
                    onChange={(e) => updateOpeningHours(day, 'closed', !e.target.checked)}
                  />
                  <span className="text-sm">Open</span>
                </div>
                <input
                  type="time"
                  value={form.opening_hours[day as keyof typeof form.opening_hours]?.open || ''}
                  onChange={(e) => updateOpeningHours(day, 'open', e.target.value)}
                  disabled={form.opening_hours[day as keyof typeof form.opening_hours]?.closed}
                  className="p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
                <input
                  type="time"
                  value={form.opening_hours[day as keyof typeof form.opening_hours]?.close || ''}
                  onChange={(e) => updateOpeningHours(day, 'close', e.target.value)}
                  disabled={form.opening_hours[day as keyof typeof form.opening_hours]?.closed}
                  className="p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 4: Social Media */}
      {step === 4 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold">Social Media (Optional)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="url"
              placeholder="Facebook URL"
              value={form.social_media.facebook || ''}
              onChange={(e) => updateSocialMedia('facebook', e.target.value)}
              className="p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="url"
              placeholder="Instagram URL"
              value={form.social_media.instagram || ''}
              onChange={(e) => updateSocialMedia('instagram', e.target.value)}
              className="p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="url"
              placeholder="Twitter URL"
              value={form.social_media.twitter || ''}
              onChange={(e) => updateSocialMedia('twitter', e.target.value)}
              className="p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="url"
              placeholder="YouTube URL"
              value={form.social_media.youtube || ''}
              onChange={(e) => updateSocialMedia('youtube', e.target.value)}
              className="p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      {/* Step 5: Amenities & Tags */}
      {step === 5 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold">Amenities & Tags</h2>
          
          {/* Amenities */}
          <div>
            <h3 className="text-lg font-medium mb-3">Amenities</h3>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="Add amenity (e.g., Swimming Pool, Sauna)"
                value={newAmenity}
                onChange={(e) => setNewAmenity(e.target.value)}
                className="flex-1 p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyPress={(e) => e.key === 'Enter' && addAmenity()}
              />
              <button
                onClick={addAmenity}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {form.amenities.map((amenity, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-blue-100 rounded-full text-sm flex items-center gap-2"
                >
                  {amenity}
                  <button
                    onClick={() => removeAmenity(amenity)}
                    className="text-red-500 hover:text-red-700"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <h3 className="text-lg font-medium mb-3">Tags</h3>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="Add tag (e.g., 24-hour, Family-friendly)"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                className="flex-1 p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyPress={(e) => e.key === 'Enter' && addTag()}
              />
              <button
                onClick={addTag}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {form.tags.map((tag, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-green-100 rounded-full text-sm flex items-center gap-2"
                >
                  {tag}
                  <button
                    onClick={() => removeTag(tag)}
                    className="text-red-500 hover:text-red-700"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="p-6 border rounded-lg" style={{ 
            backgroundColor: form.brand_color + '10',
            borderColor: form.brand_color 
          }}>
            <h3 style={{ color: form.brand_color }} className="text-xl font-bold mb-2">
              Preview: {form.name || 'Your Gym Name'}
            </h3>
            <p className="text-gray-600 mb-2">{generateFullAddress()}</p>
            <p className="text-gray-600 mb-4">Max Capacity: {form.max_capacity || 'Not specified'}</p>
            <div className="flex flex-wrap gap-2">
              {form.amenities.slice(0, 3).map((amenity, i) => (
                <span key={i} className="px-2 py-1 bg-white rounded text-sm">{amenity}</span>
              ))}
              {form.amenities.length > 3 && (
                <span className="px-2 py-1 bg-white rounded text-sm">+{form.amenities.length - 3} more</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-8">
        <button
          onClick={prevStep}
          disabled={step === 1}
          className="px-6 py-3 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
        >
          Previous
        </button>
        
        {step < 5 ? (
          <button
            onClick={nextStep}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Next
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={loading || !form.name}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating...' : 'Complete Onboarding'}
          </button>
        )}
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          Error: {error}
        </div>
      )}
    </div>
  );
}
