// src/pages/Reports.tsx
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useGym } from '@/contexts/GymContext';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, BarChart, Bar
} from 'recharts';

type UserGrowthPoint = { label: string; count: number };
type PackageDistPoint = { name: string; value: number };
type RevenueComparePoint = { name: string; value: number }; // Package / One-to-one / Total
type StatusPoint = { name: string; value: number };
type StaffRoleCount = { role: string; count: number };

type StaffBreakdown = { roles: StaffRoleCount[]; counts: { total: number; active: number } };
type UserWithPkg = { user_id: string; package_name?: string | null; created_at?: string; status?: string; full_name?: string; email?: string; days_left?: number };
type StaffRow = { id: string; full_name: string; is_active: boolean; role_id?: string };
type CombinedRow = { id?: string; user_id?: string; package_price?: number | null; one_to_one_coaching_cost?: number | null; package_name?: string | null; created_at?: string };

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#E57373', '#9575CD'];
const CTA_BG = '#6C9D9A'; // export & refresh button color requested

export default function ReportsPage(): JSX.Element {
  const { gym, loading: gymLoading } = useGym();
  // Controls
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'custom'>('30d');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');
  const [revenuePackageFilter, setRevenuePackageFilter] = useState<string>('__all__');

  // Data
  const [userGrowth, setUserGrowth] = useState<UserGrowthPoint[]>([]);
  const [packageDist, setPackageDist] = useState<PackageDistPoint[]>([]);
  const [revenueCompare, setRevenueCompare] = useState<RevenueComparePoint[]>([]);
  const [memberStatus, setMemberStatus] = useState<StatusPoint[]>([]);
  const [topPackages, setTopPackages] = useState<PackageDistPoint[]>([]);
  const [staffBreakdown, setStaffBreakdown] = useState<StaffBreakdown>({ roles: [], counts: { total: 0, active: 0 } });

  // helpers
  const [packagesList, setPackagesList] = useState<string[]>([]);
  const [rolesMap, setRolesMap] = useState<Record<string, string>>({}); // role_id -> name

  // UI & drill
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeDrill, setActiveDrill] = useState<{ type: 'package' | 'revenue'; id: string } | null>(null);
  const [drillUsers, setDrillUsers] = useState<UserWithPkg[]>([]);
  const [drillTransactions, setDrillTransactions] = useState<any[]>([]);
  type RevenuePoint = { name: string; value: number };
  const [revenueData, setRevenueData] = useState<RevenuePoint[]>([]);

  useEffect(() => {
    if (gym && !gymLoading) {
      fetchPackagesAndRoles();
      fetchAllAnalytics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gym, gymLoading, timeRange, customFrom, customTo, revenuePackageFilter]);

  function rangeToDates(range: string) {
    const now = new Date();
    let fromDate = new Date();
    switch (range) {
      case '7d': fromDate.setDate(now.getDate() - 6); break;
      case '30d': fromDate.setDate(now.getDate() - 29); break;
      case '90d': fromDate.setDate(now.getDate() - 89); break;
      case 'custom':
        if (!customFrom || !customTo) return null;
        fromDate = new Date(customFrom + 'T00:00:00');
        return { from: fromDate.toISOString(), to: new Date(customTo + 'T23:59:59').toISOString() };
      default: fromDate.setDate(now.getDate() - 29);
    }
    const to = new Date();
    return { from: fromDate.toISOString(), to: to.toISOString() };
  }

  async function fetchPackagesAndRoles() {
    try {
      const { data: pkgs } = await supabase.from('packages').select('name').eq('gym_id', gym?.id).order('name');
      if (pkgs?.length) setPackagesList(pkgs.map((p: any) => p.name));
    } catch (e) {
      // ignore
    }
    try {
      const { data: roles } = await supabase.from('roles').select('id, name');
      if (roles) {
        const map: Record<string, string> = {};
        roles.forEach((r: any) => (map[r.id] = r.name));
        setRolesMap(map);
      }
    } catch (e) {
      // ignore
    }
  }

  async function fetchAllAnalytics() {
    setLoading(true);
    setError(null);
    
    try {
      const range = rangeToDates(timeRange);

      // --- User growth ---
      const usersQuery = supabase.from('users').select('id, created_at').eq('gym_id', gym?.id).order('created_at', { ascending: true });
      if (range) usersQuery.gte('created_at', range.from).lte('created_at', range.to);
      const { data: usersData, error: usersErr } = await usersQuery;
      if (usersErr) throw usersErr;
      const users = (usersData ?? []) as { created_at: string }[];
      const growthMap: Record<string, number> = {};
      users.forEach(u => {
        const d = new Date(u.created_at);
        const key = d.toISOString().slice(0, 10);
        growthMap[key] = (growthMap[key] || 0) + 1;
      });
      const userGrowthArr = buildContinuousSeries(range, growthMap).map(x => ({ label: x.label, count: Number(x.count) })) as UserGrowthPoint[];

      // --- Packages & member status ---
      const pkgQuery = supabase.from('users_with_membership_info').select('user_id, package_name, created_at, status').eq('gym_id', gym?.id).order('created_at', { ascending: true });
      if (range) pkgQuery.gte('created_at', range.from).lte('created_at', range.to);
      const { data: pkgData, error: pkgErr } = await pkgQuery;
      if (pkgErr) throw pkgErr;
      const usersWithPkg = (pkgData ?? []) as UserWithPkg[];
      const pkgCounts: Record<string, number> = {};
      usersWithPkg.forEach(r => {
        const name = r.package_name || 'Unassigned';
        pkgCounts[name] = (pkgCounts[name] || 0) + 1;
      });
      const packageDistArr = Object.entries(pkgCounts).map(([name, value]) => ({ name, value }));
      const topPackagesArr = [...packageDistArr].sort((a, b) => b.value - a.value).slice(0, 10);

      // --- Revenue aggregation from user_combined_costs (NO created_at dependency) ---
      // We'll fetch package_price and one_to_one_coaching_cost (no date filter) and aggregate totals.
    const { data: revenueRows, error: revenueError } = await supabase
      .from("user_combined_costs")
      .select("package_price, one_to_one_coaching_cost, total_monthly_cost")
      .eq('gym_id', gym?.id);

    if (revenueError) {
      console.error("Revenue fetch error:", revenueError);
      setRevenueData([]);
    } else {
      const totalPackage = revenueRows.reduce(
        (sum, r) => sum + Number(r.package_price || 0),
        0
      );
      const totalCoaching = revenueRows.reduce(
        (sum, r) => sum + Number(r.one_to_one_coaching_cost || 0),
        0
      );
      const totalBoth = revenueRows.reduce(
        (sum, r) => sum + Number(r.total_monthly_cost || 0),
        0
      );

      setRevenueData([
        { name: "Package Revenue", value: totalPackage },
        { name: "1-on-1 Coaching Revenue", value: totalCoaching },
        { name: "Total Revenue", value: totalBoth }
      ]);
    }

      // --- Member status ---
      const statusMap: Record<string, number> = {};
      usersWithPkg.forEach(r => {
        const st = r.status || 'unknown';
        statusMap[st] = (statusMap[st] || 0) + 1;
      });
      const memberStatusArr = Object.entries(statusMap).map(([name, value]) => ({ name, value }));

      // --- Staff breakdown (resolve role names) ---
      const { data: staffData, error: staffErr } = await supabase.from('staff').select('id, full_name, is_active, role_id').eq('gym_id', gym?.id).order('created_at', { ascending: true });
      if (staffErr) throw staffErr;
      const staff = (staffData ?? []) as StaffRow[];
      const roleCounts: Record<string, number> = {};
      let active = 0;
      staff.forEach(s => {
        const roleKey = s.role_id || 'unassigned';
        roleCounts[roleKey] = (roleCounts[roleKey] || 0) + 1;
        if (s.is_active) active += 1;
      });
      const staffRolesArr = Object.entries(roleCounts).map(([role, count]) => ({ role: rolesMap[role] ?? role, count }));

      // Commit state
      setUserGrowth(userGrowthArr);
      setPackageDist(packageDistArr);
      
      setMemberStatus(memberStatusArr);
      setTopPackages(topPackagesArr);
      setStaffBreakdown({ roles: staffRolesArr, counts: { total: staff.length, active } });

    } catch (err: any) {
      console.error('Analytics fetch error', err);
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

  function buildContinuousSeries(range: { from: string; to: string } | null, countsMap: Record<string, number> = {}) {
    if (!range) return Object.entries(countsMap).map(([k, v]) => ({ label: k, count: v }));
    const from = new Date(range.from);
    const to = new Date(range.to);
    const arr: any[] = [];
    for (let dt = new Date(from); dt <= to; dt.setDate(dt.getDate() + 1)) {
      const date = new Date(dt);
      const label = date.toISOString().slice(0, 10);
      arr.push({ label, count: countsMap[label] || 0 });
    }
    return arr;
  }

  // Drill handlers
  async function onDrillPackage(pkgName?: string) {
    if (!pkgName) return;
    setActiveDrill({ type: 'package', id: pkgName });
    setDrillTransactions([]);
    setDrillUsers([]);
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('users_with_membership_info')
        .select('user_id, full_name, email, phone, created_at, membership_expiry, days_left, package_name')
        .eq('gym_id', gym?.id)
        .eq('package_name', pkgName)
        .order('created_at', { ascending: true })
        .limit(1000);
      if (error) throw error;
      setDrillUsers((data ?? []) as UserWithPkg[]);
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

  async function onDrillRevenue() {
    // show detailed rows from user_combined_costs matching current package filter — no created_at used
    setActiveDrill({ type: 'revenue', id: revenuePackageFilter === '__all__' ? 'All packages' : revenuePackageFilter });
    setDrillTransactions([]);
    setDrillUsers([]);
    setLoading(true);
    try {
      const { data: rows, error } = await supabase
        .from('user_combined_costs')
        .select('id, user_id, package_price, one_to_one_coaching_cost, package_name, created_at')
        .eq('gym_id', gym?.id)
        .limit(5000);
      if (error) throw error;
      const raw = (rows ?? []) as CombinedRow[];
      const filtered = raw.filter(r => (revenuePackageFilter === '__all__') ? true : (r.package_name ?? '') === revenuePackageFilter);
      setDrillTransactions(filtered.map(r => ({
        id: (r as any).id,
        user_id: (r as any).user_id,
        package_price: r.package_price,
        one_to_one_coaching_cost: r.one_to_one_coaching_cost,
        package_name: r.package_name,
        created_at: r.created_at
      })));
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

  // CSV export
  function exportCSV(rows: any[], filename = 'export.csv') {
    if (!rows || rows.length === 0) return;
    const keys = Object.keys(rows[0]);
    const csv = [keys.join(',')].concat(rows.map(r => keys.map(k => JSON.stringify(r[k] ?? '')).join(','))).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  const ctaClass = 'text-white px-3 py-1 rounded';
  const ctaStyle: React.CSSProperties = { backgroundColor: CTA_BG, color: 'white' };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Admin — Analytics & Reports</h1>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center mb-6">
        <div>
          <label className="block text-sm text-muted-foreground">Time range</label>
          <select value={timeRange} onChange={e => setTimeRange(e.target.value as any)} className="border rounded px-3 py-1">
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="custom">Custom</option>
          </select>
        </div>

        {timeRange === 'custom' && (
          <div className="flex gap-2">
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="border rounded px-2 py-1" />
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="border rounded px-2 py-1" />
          </div>
        )}

        <div>
          <label className="block text-sm text-muted-foreground">Revenue Package</label>
          <select value={revenuePackageFilter} onChange={e => setRevenuePackageFilter(e.target.value)} className="border rounded px-3 py-1">
            <option value="__all__">All packages</option>
            {packagesList.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        <div className="ml-auto">
          <button style={ctaStyle} className={ctaClass} onClick={() => fetchAllAnalytics()}>Refresh</button>
        </div>
      </div>

      {loading && <div className="py-8 text-center">Loading analytics...</div>}
      {error && <div className="text-red-600 mb-4">Error: {error}</div>}

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* User Growth */}
        <section className="bg-white rounded shadow p-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold">User Growth</h3>
            <button style={ctaStyle} className={ctaClass} onClick={() => exportCSV(userGrowth, 'user-growth.csv')}>Export CSV</button>
          </div>
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <LineChart data={userGrowth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#0088FE" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Package Distribution */}
        <section className="bg-white rounded shadow p-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold">Package Distribution</h3>
            <button style={ctaStyle} className={ctaClass} onClick={() => exportCSV(packageDist, 'package-distribution.csv')}>Export CSV</button>
          </div>
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={packageDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} onClick={(data: any) => onDrillPackage(data?.name)}>
                  {packageDist.map((entry, idx) => <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />)}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Revenue: Horizontal bar compare (Package vs One-to-one vs Total) */}
        <section className="bg-white rounded shadow p-4 relative">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold">Revenue — compare totals</h3>
            <div className="flex gap-2">
              <button style={ctaStyle} className={ctaClass} onClick={() => exportCSV(revenueCompare, 'revenue-compare.csv')}>Export CSV</button>
            </div>
          </div>

         

          <div style={{ width: "100%", height: 320 }}>
            <ResponsiveContainer>
              <BarChart data={revenueData} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="category" dataKey="name" />
                <YAxis type="number" />
                <Tooltip />
                <Bar dataKey="value" fill="#6C9D9A" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Member Status */}
        <section className="bg-white rounded shadow p-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold">Member Status</h3>
            <button style={ctaStyle} className={ctaClass} onClick={() => exportCSV(memberStatus, 'member-status.csv')}>Export CSV</button>
          </div>
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={memberStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70}>
                  {memberStatus.map((entry, idx) => <Cell key={`cell-status-${idx}`} fill={COLORS[idx % COLORS.length]} />)}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Top Packages */}
        <section className="bg-white rounded shadow p-4 md:col-span-2">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold">Top Packages</h3>
            <button style={ctaStyle} className={ctaClass} onClick={() => exportCSV(topPackages, 'top-packages.csv')}>Export CSV</button>
          </div>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <BarChart layout="vertical" data={topPackages} margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" />
                <Tooltip />
                <Bar dataKey="value" fill="#FFBB28" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Staff */}
        <section className="bg-white rounded shadow p-4 md:col-span-2">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold">Staff</h3>
            <div className="flex gap-2">
              <div className="text-sm">Total: {staffBreakdown.counts.total}</div>
              <div className="text-sm">Active: {staffBreakdown.counts.active}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium mb-2">Roles</h4>
              <ul className="space-y-1">
                {staffBreakdown.roles.map((r, idx) => (
                  <li key={r.role} className="flex justify-between border rounded p-2 items-center">
                    <div className="flex items-center gap-3">
                      <span style={{ width: 12, height: 12, backgroundColor: COLORS[idx % COLORS.length], display: 'inline-block', borderRadius: 4 }} />
                      <span className="truncate">{r.role}</span>
                    </div>
                    <span>{r.count}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-medium mb-2">Quick table</h4>
              <table className="w-full text-sm">
                <thead><tr><th className="text-left">Role</th><th className="text-right">Count</th></tr></thead>
                <tbody>
                  {staffBreakdown.roles.map(r => (
                    <tr key={r.role}><td className="py-1">{r.role}</td><td className="py-1 text-right">{r.count}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      {/* Drilldown */}
      {activeDrill && (
        <div className="mt-6 bg-white rounded shadow p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold">Drilldown — {activeDrill.type} — {activeDrill.id}</h3>
            <div className="flex gap-2">
              <button style={ctaStyle} className={ctaClass} onClick={() => { if (drillUsers.length) exportCSV(drillUsers, 'drill-users.csv'); }}>Export Users</button>
              <button style={ctaStyle} className={ctaClass} onClick={() => { if (drillTransactions.length) exportCSV(drillTransactions, 'drill-transactions.csv'); }}>Export Transactions</button>
              <button className="text-sm" onClick={() => { setActiveDrill(null); setDrillUsers([]); setDrillTransactions([]); }}>Close</button>
            </div>
          </div>

          {drillUsers.length > 0 && (
            <div className="mb-4">
              <h4 className="font-medium mb-2">Users</h4>
              <div className="overflow-auto max-h-80 border rounded p-2">
                <table className="w-full text-sm">
                  <thead><tr><th>Name</th><th>Email</th><th>Joined</th><th>Days left</th></tr></thead>
                  <tbody>
                    {drillUsers.map(u => (
                      <tr key={u.user_id}>
                        <td className="py-1">{u.full_name}</td>
                        <td className="py-1">{u.email}</td>
                        <td className="py-1">{u.created_at ? new Date(u.created_at).toLocaleString() : '—'}</td>
                        <td className="py-1">{u.days_left ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {drillTransactions.length > 0 && (
            <div>
              <h4 className="font-medium mb-2">Transactions</h4>
              <div className="overflow-auto max-h-80 border rounded p-2">
                <table className="w-full text-sm">
                  <thead><tr><th>ID</th><th>User</th><th>Package price</th><th>One-to-one</th><th>Package</th><th>Created</th></tr></thead>
                  <tbody>
                    {drillTransactions.map(t => (
                      <tr key={t.id ?? t.user_id}>
                        <td className="py-1">{t.id ?? t.user_id}</td>
                        <td className="py-1">{t.user_id}</td>
                        <td className="py-1">{t.package_price ?? '—'}</td>
                        <td className="py-1">{t.one_to_one_coaching_cost ?? '—'}</td>
                        <td className="py-1">{t.package_name ?? '—'}</td>
                        <td className="py-1">{t.created_at ? new Date(t.created_at).toLocaleString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!drillUsers.length && !drillTransactions.length && <div className="text-sm text-muted-foreground">No results for this drill.</div>}
        </div>
      )}
    </div>
  );
}
