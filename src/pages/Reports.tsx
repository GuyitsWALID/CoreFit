import React, { useEffect, useState } from 'react';
import { supabase } from "@/supabaseClient";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, BarChart, Bar
} from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#E57373', '#9575CD'];

export default function Reports() {
  const [userGrowth, setUserGrowth] = useState([]);
  const [packageDist, setPackageDist] = useState([]);
  const [revenueData, setRevenueData] = useState([]);
  const [memberStatus, setMemberStatus] = useState([]);
  const [topPackages, setTopPackages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  async function fetchAnalytics() {
    setLoading(true);

    // User Growth: registrations per month
    const { data: users } = await supabase
      .from('users')
      .select('id, created_at');

    const userGrowthMap: Record<string, number> = {};
    users?.forEach(u => {
      const month = new Date(u.created_at).toLocaleString('default', { month: 'short', year: '2-digit' });
      userGrowthMap[month] = (userGrowthMap[month] || 0) + 1;
    });
    const userGrowthArr = Object.entries(userGrowthMap).map(([month, count]) => ({ month, count }));

    // Package Distribution
    const { data: memberships } = await supabase
      .from('memberships')
      .select('id, package_name, status, price, created_at');

    const packageMap: Record<string, number> = {};
    memberships?.forEach(m => {
      packageMap[m.package_name] = (packageMap[m.package_name] || 0) + 1;
    });
    const packageDistArr = Object.entries(packageMap).map(([name, value]) => ({ name, value }));

    // Revenue Tracking (by month)
    const revenueMap: Record<string, number> = {};
    memberships?.forEach(m => {
      const month = new Date(m.created_at).toLocaleString('default', { month: 'short', year: '2-digit' });
      revenueMap[month] = (revenueMap[month] || 0) + (m.price || 0);
    });
    const revenueArr = Object.entries(revenueMap).map(([month, revenue]) => ({ month, revenue }));

    // Member Status Distribution
    const statusMap: Record<string, number> = {};
    memberships?.forEach(m => {
      statusMap[m.status] = (statusMap[m.status] || 0) + 1;
    });
    const memberStatusArr = Object.entries(statusMap).map(([name, value]) => ({ name, value }));

    // Top Packages (by count)
    const topPackagesArr = packageDistArr
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    setUserGrowth(userGrowthArr);
    setPackageDist(packageDistArr);
    setRevenueData(revenueArr);
    setMemberStatus(memberStatusArr);
    setTopPackages(topPackagesArr);
    setLoading(false);
  }

  return (
    <div className="animate-fade-in">
      <h2 className="text-3xl font-bold tracking-tight mb-6">Analytics & Reports</h2>
      {loading ? (
        <div className="text-center py-20 text-lg">Loading analytics...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* User Growth */}
          <div className="bg-white rounded-lg p-6 shadow">
            <h3 className="font-semibold mb-2">User Growth</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={userGrowth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#0088FE" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Package Distribution */}
          <div className="bg-white rounded-lg p-6 shadow">
            <h3 className="font-semibold mb-2">Package Distribution</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={packageDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                  {packageDist.map((entry, idx) => (
                    <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Revenue Tracking */}
          <div className="bg-white rounded-lg p-6 shadow">
            <h3 className="font-semibold mb-2">Revenue Tracking</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="revenue" stroke="#00C49F" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Member Status */}
          <div className="bg-white rounded-lg p-6 shadow">
            <h3 className="font-semibold mb-2">Member Status</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={memberStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                  {memberStatus.map((entry, idx) => (
                    <Cell key={`cell-status-${idx}`} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Top Packages */}
          <div className="bg-white rounded-lg p-6 shadow col-span-1 md:col-span-2">
            <h3 className="font-semibold mb-2">Top Packages</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topPackages}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#FFBB28" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
