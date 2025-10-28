import React, { useState } from 'react';
import { useGymOnboard } from '@/hooks/useGymOnboard';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { SuperAdSidebar } from '@/pages/admin/superAdSidebar';

// Helper for free address geocoding (OpenStreetMap/Nominatim)
const geocodeAddress = async (address) => {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.length > 0) {
    return { latitude: parseFloat(data[0].lat), longitude: parseFloat(data[0].lon) };
  }
  return { latitude: null, longitude: null };
};

const timeZones = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Phoenix', 'America/Anchorage', 'Pacific/Honolulu', 'UTC'
];

export default function OnboardingForm() {
  const { onboardGym, loading, error } = useGymOnboard();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [form, setForm] = useState({
    name: '',
    owner_name: '',
    owner_phone: '',
    owner_email: '',
    street: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'Ethiopia',
    address: '',
    timezone: 'utc',
    brand_color: '#2563eb',
    amenities: [],
    tags: [],
    max_capacity: null,
    latitude: null,
    longitude: null,
    description: '',
    status: 'active'
  });

  const [step, setStep] = useState(1);
  const [newAmenity, setNewAmenity] = useState('');
  const [newTag, setNewTag] = useState('');
  const [geocoding, setGeocoding] = useState(false);

  const updateForm = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const addAmenity = () => {
    if (newAmenity && !form.amenities.includes(newAmenity)) {
      updateForm('amenities', [...form.amenities, newAmenity]);
      setNewAmenity('');
    }
  };

  const removeAmenity = (amenity) => {
    updateForm('amenities', form.amenities.filter(a => a !== amenity));
  };

  const addTag = () => {
    if (newTag && !form.tags.includes(newTag)) {
      updateForm('tags', [...form.tags, newTag]);
      setNewTag('');
    }
  };

  const removeTag = (tag) => {
    updateForm('tags', form.tags.filter(t => t !== tag));
  };

  // Generate full address from components
  const generateFullAddress = () => {
    const parts = [form.street, form.city, form.state, form.postal_code, form.country].filter(Boolean);
    return parts.join(', ');
  };

  // Geocode and update latitude/longitude
  const handleGeocode = async () => {
    setGeocoding(true);
    const fullAddress = generateFullAddress();
    const coords = await geocodeAddress(fullAddress);
    updateForm('latitude', coords.latitude);
    updateForm('longitude', coords.longitude);
    updateForm('address', fullAddress);
    setGeocoding(false);
  };

  const handleSubmit = async () => {
    if (!form.name || !form.address || !form.owner_name) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields (Gym Name, Owner Name, and Address).",
        variant: "destructive"
      });
      return;
    }
    
    try {
      const result = await onboardGym(form);
      
      // Show success toast
      toast({
        title: "Gym Onboarded Successfully!",
        description: `${result.message} Redirecting to gym management...`,
      });
      
      // Redirect to admin gyms page (gyms.tsx) after a short delay
      setTimeout(() => {
        navigate('/admin/gyms');
      }, 2000);
      
    } catch (error) {
      toast({
        title: "Onboarding Failed",
        description: error.message || "An error occurred during gym onboarding.",
        variant: "destructive"
      });
    }
  };

  const nextStep = () => setStep(prev => Math.min(prev + 1, 4));
  const prevStep = () => setStep(prev => Math.max(prev - 1, 1));

  return (
    <div className="flex h-screen bg-gray-50">
      <SuperAdSidebar />
      
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex justify-center items-start min-h-full">
          <div className="w-full max-w-4xl">
            {/* Card Container */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
              {/* Progress Bar */}
              <div className="mb-8">
                <div className="flex justify-between items-center mb-4">
                  <h1 className="text-3xl font-bold text-gray-800">Gym Onboarding</h1>
                  <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                    Step {step} of 4
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-blue-600 h-3 rounded-full transition-all duration-300 shadow-sm"
                    style={{ width: `${(step / 4) * 100}%` }}
                  />
                </div>
              </div>

              {/* Step 1: Basic Info */}
              {step === 1 && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold text-gray-800">Basic Information</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                      type="text"
                      placeholder="Gym Name *"
                      value={form.name}
                      onChange={e => updateForm('name', e.target.value)}
                      className="p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                    <input
                      type="text"
                      placeholder="Owner Name *"
                      value={form.owner_name}
                      onChange={e => updateForm('owner_name', e.target.value)}
                      className="p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                    <input
                      type="text"
                      placeholder="Owner Phone"
                      value={form.owner_phone}
                      onChange={e => updateForm('owner_phone', e.target.value)}
                      className="p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <input
                      type="email"
                      placeholder="Owner Email"
                      value={form.owner_email}
                      onChange={e => updateForm('owner_email', e.target.value)}
                      className="p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-700">Brand Color</label>
                      <input
                        type="color"
                        value={form.brand_color}
                        onChange={e => updateForm('brand_color', e.target.value)}
                        className="w-full h-12 border border-gray-300 rounded-lg cursor-pointer"
                      />
                    </div>
                    <input
                      type="number"
                      placeholder="Max Capacity"
                      value={form.max_capacity || ''}
                      onChange={e => updateForm('max_capacity', e.target.value ? parseInt(e.target.value) : null)}
                      className="p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <select
                      value={form.timezone}
                      onChange={e => updateForm('timezone', e.target.value)}
                      className="p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {timeZones.map(tz => (
                        <option key={tz} value={tz}>{tz}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Step 2: Address & Geocoding */}
              {step === 2 && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold text-gray-800">Address Information</h2>
                  <div className="grid grid-cols-1 gap-4">
                    <input
                      type="text"
                      placeholder="Street Address"
                      value={form.street}
                      onChange={e => updateForm('street', e.target.value)}
                      className="p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <input
                        type="text"
                        placeholder="City"
                        value={form.city}
                        onChange={e => updateForm('city', e.target.value)}
                        className="p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <input
                        type="text"
                        placeholder="State/Province"
                        value={form.state}
                        onChange={e => updateForm('state', e.target.value)}
                        className="p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <input
                        type="text"
                        placeholder="Postal Code"
                        value={form.postal_code}
                        onChange={e => updateForm('postal_code', e.target.value)}
                        className="p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Country"
                      value={form.country}
                      onChange={e => updateForm('country', e.target.value)}
                      className="p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="flex items-center space-x-4">
                    <button
                      type="button"
                      className="px-6 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors shadow-sm"
                      onClick={handleGeocode}
                      disabled={geocoding}
                    >
                      {geocoding ? 'Locating...' : 'Auto-Fill Location'}
                    </button>
                    {(form.latitude && form.longitude) && (
                      <span className="text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full">
                        Latitude: {form.latitude}, Longitude: {form.longitude}
                      </span>
                    )}
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg border">
                    <h4 className="font-medium mb-2 text-gray-700">Full Address Preview:</h4>
                    <p className="text-gray-600">{generateFullAddress() || 'Enter address components above'}</p>
                  </div>
                </div>
              )}

              {/* Step 3: Amenities & Tags */}
              {step === 3 && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold text-gray-800">Amenities & Tags</h2>
                  {/* Amenities */}
                  <div>
                    <h3 className="text-lg font-medium mb-3 text-gray-700">Amenities</h3>
                    <div className="flex gap-2 mb-4">
                      <input
                        type="text"
                        placeholder="Add amenity (e.g., Swimming Pool, Sauna)"
                        value={newAmenity}
                        onChange={e => setNewAmenity(e.target.value)}
                        className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        onKeyPress={e => e.key === 'Enter' && addAmenity()}
                      />
                      <button
                        onClick={addAmenity}
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                      >
                        Add
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {form.amenities.map((amenity, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-blue-100 rounded-full text-sm flex items-center gap-2 border border-blue-200"
                        >
                          {amenity}
                          <button
                            onClick={() => removeAmenity(amenity)}
                            className="text-red-500 hover:text-red-700 font-bold"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                  {/* Tags */}
                  <div>
                    <h3 className="text-lg font-medium mb-3 text-gray-700">Tags</h3>
                    <div className="flex gap-2 mb-4">
                      <input
                        type="text"
                        placeholder="Add tag (e.g., 24-hour, Family-friendly)"
                        value={newTag}
                        onChange={e => setNewTag(e.target.value)}
                        className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        onKeyPress={e => e.key === 'Enter' && addTag()}
                      />
                      <button
                        onClick={addTag}
                        className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm"
                      >
                        Add
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {form.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-green-100 rounded-full text-sm flex items-center gap-2 border border-green-200"
                        >
                          {tag}
                          <button
                            onClick={() => removeTag(tag)}
                            className="text-red-500 hover:text-red-700 font-bold"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Description & Review/Submit */}
              {step === 4 && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold text-gray-800">Description & Complete</h2>
                  <textarea
                    value={form.description}
                    onChange={e => updateForm('description', e.target.value)}
                    placeholder="Short description of the gym (optional)"
                    className="w-full min-h-[120px] p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {/* Preview */}
                  <div className="p-6 border-2 rounded-lg shadow-sm" style={{
                    backgroundColor: form.brand_color + '10',
                    borderColor: form.brand_color
                  }}>
                    <h3 style={{ color: form.brand_color }} className="text-xl font-bold mb-2">
                      Preview: {form.name || 'Your Gym Name'}
                    </h3>
                    <p className="text-gray-600 mb-2">{generateFullAddress()}</p>
                    <p className="text-gray-600 mb-2">Owner: {form.owner_name} {form.owner_phone && (`| ${form.owner_phone}`)} {form.owner_email && (`| ${form.owner_email}`)}</p>
                    <p className="text-gray-600 mb-4">Max Capacity: {form.max_capacity || 'Not specified'}</p>
                    <p className="text-gray-600 mb-4">{form.description}</p>
                    <div className="flex flex-wrap gap-2">
                      {form.amenities.slice(0, 3).map((amenity, i) => (
                        <span key={i} className="px-2 py-1 bg-white rounded text-sm shadow-sm">{amenity}</span>
                      ))}
                      {form.amenities.length > 3 && (
                        <span className="px-2 py-1 bg-white rounded text-sm shadow-sm">+{form.amenities.length - 3} more</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {form.tags.map((tag, i) => (
                        <span key={i} className="px-2 py-1 bg-white rounded text-sm shadow-sm">{tag}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
                <button
                  onClick={prevStep}
                  disabled={step === 1}
                  className="px-6 py-3 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                >
                  Previous
                </button>
                {step < 4 ? (
                  <button
                    onClick={nextStep}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                  >
                    Next
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={loading || !form.name || !form.owner_name || !form.address}
                    className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                  >
                    {loading ? 'Creating...' : 'Complete Onboarding'}
                  </button>
                )}
              </div>
              {error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
                  Error: {error}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
