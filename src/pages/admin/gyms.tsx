import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Gym } from '@/lib/supabaseClient';

export default function AdminGyms() {
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive' | 'pending'>('all');

  useEffect(() => {
    fetchGyms();
  }, [filter]);

  const fetchGyms = async () => {
    setLoading(true);
    try {
      let query = supabase.from('gyms').select('*').order('created_at', { ascending: false });
      
      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      setGyms(data || []);
    } catch (error) {
      console.error('Error fetching gyms:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateGymStatus = async (gymId: string, status: string) => {
    try {
      const { error } = await supabase
        .from('gyms')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', gymId);

      if (error) throw error;
      
      // Update local state
      setGyms(prev => prev.map(gym => 
        gym.id === gymId ? { ...gym, status: status as any } : gym
      ));
    } catch (error) {
      console.error('Error updating gym status:', error);
      alert('Failed to update gym status');
    }
  };

  const deleteGym = async (gymId: string) => {
    if (!confirm('Are you sure you want to delete this gym?')) return;

    try {
      const { error } = await supabase
        .from('gyms')
        .delete()
        .eq('id', gymId);

      if (error) throw error;
      
      setGyms(prev => prev.filter(gym => gym.id !== gymId));
    } catch (error) {
      console.error('Error deleting gym:', error);
      alert('Failed to delete gym');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Gym Management</h1>
        <a
          href="/onboard"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Add New Gym
        </a>
      </div>

      {/* Filters */}
      <div className="mb-6 flex gap-2">
        {['all', 'active', 'inactive', 'pending'].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status as any)}
            className={`px-4 py-2 rounded-lg capitalize ${
              filter === status
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {status} ({gyms.filter(g => status === 'all' || g.status === status).length})
          </button>
        ))}
      </div>

      {/* Gyms Table */}
      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Gym
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Owner
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {gyms.map((gym) => (
                <tr key={gym.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {gym.logo_url && (
                        <img className="h-10 w-10 rounded-full mr-3" src={gym.logo_url} alt="" />
                      )}
                      <div>
                        <div className="text-sm font-medium text-gray-900">{gym.name}</div>
                        <div className="text-sm text-gray-500">/{gym.slug}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {gym.owner_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{gym.email}</div>
                    <div className="text-sm text-gray-500">{gym.phone}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(gym.status)}`}>
                      {gym.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(gym.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex gap-2">
                      <a
                        href={`/${gym.slug}`}
                        className="text-blue-600 hover:text-blue-900"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View
                      </a>
                      <select
                        value={gym.status}
                        onChange={(e) => updateGymStatus(gym.id, e.target.value)}
                        className="text-sm border rounded px-2 py-1"
                      >
                        <option value="pending">Pending</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                      <button
                        onClick={() => deleteGym(gym.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
