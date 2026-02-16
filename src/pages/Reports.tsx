// src/pages/Reports.tsx
import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useGym } from '@/contexts/GymContext';
import { DynamicHeader } from '@/components/layout/DynamicHeader';
import { Sidebar } from '@/components/layout/Sidebar';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, BarChart, Bar, ComposedChart, Area, AreaChart
} from 'recharts';

type UserGrowthPoint = { label: string; count: number };
type PackageDistPoint = { name: string; value: number; price?: number };
type RevenueComparePoint = { name: string; value: number }; // Package / One-to-one / Total
type StatusPoint = { name: string; value: number };
type StaffRoleCount = { role: string; count: number };

type StaffBreakdown = { roles: StaffRoleCount[]; counts: { total: number; active: number } };
type UserWithPkg = { user_id: string; package_name?: string | null; created_at?: string; status?: string; full_name?: string; email?: string; days_left?: number; membership_expiry?: string };
type StaffRow = { id: string; full_name: string; is_active: boolean; role_id?: string };
type CombinedRow = { id?: string; user_id?: string; package_price?: number | null; one_to_one_coaching_cost?: number | null; package_name?: string | null; created_at?: string };

type RevenuePoint = { name: string; value: number };

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#E57373', '#9575CD'];
const CTA_BG = '#6C9D9A'; // export & refresh button color requested

export default function ReportsPage(): JSX.Element {
  const { gym, loading: gymLoading } = useGym();
  // Controls
  const [timeRange, setTimeRange] = useState<'lifetime'|'90d' | '60d' | '30d' | '7d'>('lifetime');

  // Custom From / To date range (YYYY-MM-DD local values). When set, this overrides `timeRange`.
  const [customFrom, setCustomFrom] = useState<string | null>(null);
  const [customTo, setCustomTo] = useState<string | null>(null);
  const [customRangeError, setCustomRangeError] = useState<string | null>(null);

  // effectiveRange: if customFrom/customTo are set and valid they take precedence, otherwise use rangeToDates(timeRange)
  const effectiveRange = useMemo(() => {
    if (customFrom && customTo) {
      const [fy, fm, fd] = customFrom.split('-').map(Number);
      const [ty, tm, td] = customTo.split('-').map(Number);
      const fromDate = new Date(fy, (fm || 1) - 1, fd || 1, 0, 0, 0, 0);
      const toDate = new Date(ty, (tm || 1) - 1, td || 1, 23, 59, 59, 999);
      if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime()) || fromDate > toDate) return null;
      return { from: fromDate.toISOString(), to: toDate.toISOString() };
    }
    return rangeToDates(timeRange);
  }, [customFrom, customTo, timeRange]);

  // revenuePackageFilter is now an array of package names; ['__all__'] means all packages
  const [revenuePackageFilter, setRevenuePackageFilter] = useState<string[]>(['__all__']);
  // selection state used by the dropdown; start with all
  const [selectedPackages, setSelectedPackages] = useState<string[]>(['__all__']);
  const [packagesOpen, setPackagesOpen] = useState<boolean>(false);

  // Data
  const [userGrowth, setUserGrowth] = useState<UserGrowthPoint[]>([]);
  const [packageDist, setPackageDist] = useState<PackageDistPoint[]>([]);
  const [revenueCompare, setRevenueCompare] = useState<RevenueComparePoint[]>([]);
  const [memberStatus, setMemberStatus] = useState<StatusPoint[]>([]);
  const [memberStatusByPackage, setMemberStatusByPackage] = useState<Record<string, StatusPoint[]>>({});
  const [topPackages, setTopPackages] = useState<PackageDistPoint[]>([]);

  // currency formatter for ETB (used for package price display)
  const nfEtb = useMemo(() => new Intl.NumberFormat('en-ET', { style: 'currency', currency: 'ETB' }), []);
  // Dynamic chart width for User Growth (allow horizontal scrolling when many points)
  const growthChartWidth = useMemo(() => {
    const perPoint = 36; // pixels per data point
    const minWidth = 700; // minimum chart width
    const calculated = Math.max(minWidth, (userGrowth?.length || 0) * perPoint);
    return calculated;
  }, [userGrowth]);

  // Dynamic chart width for Top Packages (horizontal scroll to view many packages)
  const packageChartWidth = useMemo(() => {
    const perPackage = 120; // pixels per package column (reduced to fit more bars)
    const minWidth = 700;
    return Math.max(minWidth, (topPackages?.length || 0) * perPackage);
  }, [topPackages]);

  const [staffBreakdown, setStaffBreakdown] = useState<StaffBreakdown>({ roles: [], counts: { total: 0, active: 0 } });

  // Revenue time-series chart (same as Dashboard)
  const [revenueSeries, setRevenueSeries] = useState<Array<{ date: string; packages: number; coaching: number; total: number }>>([]);
  const [revenueSeriesLoading, setRevenueSeriesLoading] = useState<boolean>(false);
  const [revenueRangeDays, setRevenueRangeDays] = useState<number>(90);
  const [showPackages, setShowPackages] = useState<boolean>(true);
  const [showCoaching, setShowCoaching] = useState<boolean>(true);
  const [showTotal, setShowTotal] = useState<boolean>(true);

  // Update styling based on gym configuration (used by revenue chart)
  const dynamicStyles = useMemo(() => {
    if (!gym) return {
      primaryColor: '#2563eb',
      secondaryColor: '#1e40af',
      accentColor: '#f59e0b',
    };
    const primaryColor = gym.brand_color || '#2563eb';
    return {
      primaryColor: primaryColor,
      secondaryColor: primaryColor,
      accentColor: primaryColor,
      gradientBg: `linear-gradient(135deg, ${primaryColor}10 0%, ${primaryColor}20 100%)`,
    };
  }, [gym]);

  // helpers
  const [packagesList, setPackagesList] = useState<string[]>([]);
  const [rolesMap, setRolesMap] = useState<Record<string, string>>({}); // role_id -> name

  // Custom rotated tick renderer for XAxis (works around Recharts TypeScript typing limitations)
  const renderRotatedTick = (props: any) => {
    const { x, y, payload } = props || {};
    const label = payload?.value ?? '';
    const display = (label && label.length > 18) ? `${label.slice(0, 18)}...` : label;
    return (
      <g transform={`translate(${x}, ${y})`}>
        <text x={0} y={0} dy={16} textAnchor="end" transform="rotate(-45)" style={{ fontSize: 12 }}>
          {display}
        </text>
      </g>
    );
  };

  // derived active package filter (null = all)
  const activePackageFilter = revenuePackageFilter.includes('__all__') ? null : revenuePackageFilter;



  // UI & drill
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeDrill, setActiveDrill] = useState<{ type: 'package' | 'revenue'; id: string } | null>(null);
  const [drillUsers, setDrillUsers] = useState<UserWithPkg[]>([]);
  const [drillTransactions, setDrillTransactions] = useState<any[]>([]);
  const [revenueData, setRevenueData] = useState<RevenuePoint[]>([]);
  // Diagnostics for count mismatches
  const [countsMismatch, setCountsMismatch] = useState<string | null>(null);

  useEffect(() => {
    if (gym && !gymLoading) {
      fetchPackagesAndRoles();
      // Only fetch analytics when custom range is valid (both dates) or no custom range is set
      const customValid = !(customFrom || customTo) || (customFrom && customTo && new Date(customFrom) <= new Date(customTo));
      if (customValid) fetchAllAnalytics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gym, gymLoading, timeRange, revenuePackageFilter, customFrom, customTo]);

  function rangeToDates(range: string) {
    // lifetime returns null -> no date filters applied
    if (range === 'lifetime') return null;
    const now = new Date();
    let fromDate = new Date();
    switch (range) {
      case '7d': fromDate.setDate(now.getDate() - 6); break;
      case '30d': fromDate.setDate(now.getDate() - 29); break;
      case '60d': fromDate.setDate(now.getDate() - 59); break;
      case '90d': fromDate.setDate(now.getDate() - 89); break;
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

  // Currency formatter for revenue tooltip (ensure available before tooltip)
  const nf = useMemo(() => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }), []);

  // Tooltip for revenue series (mirrors Dashboard)
  const RevenueTooltip = (props: any) => {
    const { active, label } = props;
    if (!active) return null;
    const row = revenueSeries.find((r) => r.date === label);
    if (!row) return null;
    return (
      <div className="bg-white p-3 rounded shadow-md text-sm border">
        <div className="font-medium mb-1">{new Date(label).toLocaleDateString()}</div>
        {showPackages && <div>Packages: <strong>{nf.format(Number(row.packages || 0))}</strong></div>}
        {showCoaching && <div>1:1 Coaching: <strong>{nf.format(Number(row.coaching || 0))}</strong></div>}
        {showTotal && <div style={{ color: dynamicStyles.secondaryColor }}>Total: <strong>{nf.format(Number(row.total || 0))}</strong></div>}
      </div>
    );
  };

  // Load revenue time-series (daily buckets) - copied from Dashboard for parity
  const loadRevenueSeries = async () => {
    setRevenueSeriesLoading(true);
    try {
      let start: Date;
      let end: Date;
      if (effectiveRange) {
        start = new Date(effectiveRange.from);
        end = new Date(effectiveRange.to);
      } else {
        const now = new Date();
        start = new Date();
        start.setDate(now.getDate() - (revenueRangeDays - 1));
        start.setHours(0, 0, 0, 0);
        end = new Date();
        end.setHours(23, 59, 59, 999);
      }

      // Fetch per-user package and coaching values from user_combined_costs view and aggregate per day
      const { data: combinedRows } = await supabase
        .from('user_combined_costs')
        .select('created_at, package_price, one_to_one_coaching_cost, total_monthly_cost, gym_id')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .eq('gym_id', gym?.id);

      // Build day buckets
      const days: Array<{ date: string; packages: number; coaching: number; total: number }> = [];
      const copy = new Date(start);
      const daysCount = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      for (let i = 0; i < daysCount; i++) {
        const iso = copy.toISOString().slice(0, 10);
        days.push({ date: iso, packages: 0, coaching: 0, total: 0 });
        copy.setDate(copy.getDate() + 1);
      }

      if ((combinedRows || []).length === 0) {
        // Fallback: build packages & coaching from users and one_to_one_coaching
        const { data: usersCreated } = await supabase
          .from('users')
          .select('created_at, package_id, packages(price), gym_id')
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString())
          .eq('gym_id', gym?.id)
          .not('package_id', 'is', null);

        const { data: coachingRows } = await supabase
          .from('one_to_one_coaching')
          .select('start_date, end_date, hourly_rate, days_per_week, hours_per_session, daily_cost, daily_price, daily_revenue, status, gym_id, users(gym_id)')
          .eq('status', 'active');

        (usersCreated || []).forEach((u: any) => {
          if (!u?.created_at) return;
          const day = (new Date(u.created_at)).toISOString().slice(0, 10);
          const price = u?.packages?.price;
          const n = price == null ? 0 : Number(price);
          const idx = days.findIndex(d => d.date === day);
          if (idx >= 0 && Number.isFinite(n)) days[idx].packages += n;
        });

        (coachingRows || []).forEach((r: any) => {
          const rowGymId = r.gym_id ?? r?.users?.gym_id ?? null;
          if (rowGymId !== gym?.id) return;
          const startDate = r.start_date ? new Date(r.start_date).toISOString().slice(0, 10) : null;
          const endDate = r.end_date ? new Date(r.end_date).toISOString().slice(0, 10) : null;
          const explicitRaw = r?.daily_cost ?? r?.daily_price ?? r?.daily_revenue;
          const explicit = explicitRaw == null ? NaN : Number(explicitRaw);
          const hr = Number(r?.hourly_rate || 0);
          const d = Number(r?.days_per_week || 0);
          const hps = Number(r?.hours_per_session || 0);
          const weekly = hr * d * hps;
          const dailyEstimate = Number.isFinite(weekly) ? (weekly / 7) : NaN;

          for (let i = 0; i < days.length; i++) {
            const day = days[i].date;
            if (startDate && day < startDate) continue;
            if (endDate && day > endDate) continue;
            const val = (!Number.isNaN(explicit) && Number.isFinite(explicit)) ? explicit : (Number.isFinite(dailyEstimate) ? dailyEstimate : 0);
            days[i].coaching += val;
          }
        });

        days.forEach(d => d.total = d.packages + d.coaching);
        const normalizedFallback = days.map(d => ({ date: d.date, packages: d.packages, coaching: d.coaching, total: d.total }));
        setRevenueSeries(normalizedFallback);
        return;
      }

      // Aggregate combinedRows values into buckets
      (combinedRows || []).forEach((u: any) => {
        if (!u?.created_at) return;
        const day = (new Date(u.created_at)).toISOString().slice(0, 10);
        const pkg = u?.package_price == null ? 0 : Number(u.package_price);
        const coach = u?.one_to_one_coaching_cost == null ? 0 : Number(u.one_to_one_coaching_cost);
        const idx = days.findIndex(d => d.date === day);
        if (idx >= 0) {
          if (Number.isFinite(pkg)) days[idx].packages += pkg;
          if (Number.isFinite(coach)) days[idx].coaching += coach;
          days[idx].total = days[idx].packages + days[idx].coaching;
        }
      });

      const normalized = days.map(d => ({ date: d.date, packages: d.packages, coaching: d.coaching, total: d.total }));
      setRevenueSeries(normalized);
    } catch (err: any) {
      console.error('loadRevenueSeries error', err);
      setRevenueSeries([]);
    } finally {
      setRevenueSeriesLoading(false);
    }
  };

  // ensure revenue series loads when gym or range changes
  useEffect(() => {
    if (gym && !gymLoading) {
      // skip if custom range invalid
      if (customFrom && customTo && new Date(customFrom) > new Date(customTo)) return;
      loadRevenueSeries();
    }
  }, [gym, gymLoading, revenueRangeDays, customFrom, customTo]);

  async function fetchAllAnalytics() {
    setLoading(true);
    setError(null);
    
    try {
      const effective = effectiveRange;

      // package filter array (null = all)
      const packageFilter = revenuePackageFilter.includes('__all__') ? null : revenuePackageFilter;

      // --- User growth ---
      // Use users_with_membership_info when filtering by package so growth matches selected packages
      if (!packageFilter) {
        const usersQuery = supabase.from('users').select('id, created_at').eq('gym_id', gym?.id).order('created_at', { ascending: true });
        if (effective) usersQuery.gte('created_at', effective.from).lte('created_at', effective.to);
        const { data: usersData, error: usersErr } = await usersQuery;
        if (usersErr) throw usersErr;
        const users = (usersData ?? []) as { created_at: string }[];
        const growthMap: Record<string, number> = {};
        users.forEach(u => {
          const d = new Date(u.created_at);
          const key = d.toISOString().slice(0, 10);
          growthMap[key] = (growthMap[key] || 0) + 1;
        });
        var userGrowthArr = buildContinuousSeries(effective, growthMap).map(x => ({ label: x.label, count: Number(x.count) })) as UserGrowthPoint[];
      } else {
        const usersPkgQuery = supabase.from('users_with_membership_info').select('user_id, package_name, created_at, status').eq('gym_id', gym?.id).in('package_name', packageFilter).order('created_at', { ascending: true });
        if (effective) usersPkgQuery.gte('created_at', effective.from).lte('created_at', effective.to);
        const { data: usersData, error: usersErr } = await usersPkgQuery;
        if (usersErr) throw usersErr;
        const users = (usersData ?? []) as { created_at: string }[];
        const growthMap: Record<string, number> = {};
        users.forEach(u => {
          const d = new Date(u.created_at);
          const key = d.toISOString().slice(0, 10);
          growthMap[key] = (growthMap[key] || 0) + 1;
        });
        var userGrowthArr = buildContinuousSeries(effective, growthMap).map(x => ({ label: x.label, count: Number(x.count) })) as UserGrowthPoint[];
      }

      // Fetch packages for gym and initialize counts (so packages with zero active users are shown)
      const { data: pkgsForCount, error: pkgsForCountErr } = await supabase.from('packages').select('id, name, price').eq('gym_id', gym?.id).order('name');
      if (pkgsForCountErr) throw pkgsForCountErr;
      const packageNamesAll = (pkgsForCount ?? []).map((p: any) => p.name);
      const pkgCounts: Record<string, number> = {};
      packageNamesAll.forEach(n => { pkgCounts[n] = 0; });
      pkgCounts['Unassigned'] = 0;
      // build name->price map
      const packageNameToPrice: Record<string, number> = {};
      (pkgsForCount ?? []).forEach((p: any) => { packageNameToPrice[p.name] = Number(p.price || 0); });

      // Count active users (membership_expiry > asOf) grouped by package_name
      const asOf = effective ? effective.to : new Date().toISOString();
      // build package id -> name map
      const pkgIdToName: Record<string, string> = {};
      (pkgsForCount ?? []).forEach((p: any) => { pkgIdToName[p.id] = p.name; });

      const { data: activeUsers, error: activeErr } = await supabase
        .from('users')
        .select('id, package_id')
        .eq('gym_id', gym?.id)
        .gt('membership_expiry', asOf);
      if (activeErr) throw activeErr;
      (activeUsers ?? []).forEach((u: any) => {
        const name = (u.package_id && pkgIdToName[u.package_id]) ? pkgIdToName[u.package_id] : 'Unassigned';
        if (pkgCounts[name] === undefined) pkgCounts[name] = 0;
        pkgCounts[name] += 1;
      });

      // Apply packageFilter if present (only show selected packages)
      let packageDistArr = Object.entries(pkgCounts).map(([name, value]) => ({ name, value, price: packageNameToPrice[name] }));
      if (packageFilter) {
        packageDistArr = packageDistArr.filter(p => (packageFilter as string[]).includes(p.name));
      }
      const topPackagesArr = [...packageDistArr].sort((a, b) => b.value - a.value).slice(0, 10);

      // --- Revenue aggregation from user_combined_costs (NO created_at dependency) ---
      // We'll fetch package_price and one_to_one_coaching_cost (no date filter) and aggregate totals.
    // Aggregate revenue from user_combined_costs — apply effective range if provided
    let revenueQuery = supabase
      .from("user_combined_costs")
      .select("package_price, one_to_one_coaching_cost, total_monthly_cost")
      .eq('gym_id', gym?.id);
    if (effective) {
      revenueQuery = revenueQuery.gte('created_at', effective.from).lte('created_at', effective.to);
    }
    const { data: revenueRows, error: revenueError } = await revenueQuery;

    if (revenueError) {
      console.error("Revenue fetch error:", revenueError);
      setRevenueData([]);
    } else {
      const rows = revenueRows ?? [];
      const filteredRows = (revenuePackageFilter.includes('__all__')) ? rows : rows.filter((r: any) => revenuePackageFilter.includes(r.package_name ?? ''));

      const totalPackage = filteredRows.reduce(
        (sum, r) => sum + Number(r.package_price || 0),
        0
      );
      const totalCoaching = filteredRows.reduce(
        (sum, r) => sum + Number(r.one_to_one_coaching_cost || 0),
        0
      );
      const totalBoth = filteredRows.reduce(
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
      // Use the users table membership_expiry (as-of now) to compute active/expired counts so they match MembershipList

      // Fetch paused users separately and exclude them from active/expired sets
      const { data: pausedUsersRows, error: pausedErr } = await supabase
        .from('users')
        .select('id, package_id, status, membership_expiry')
        .eq('gym_id', gym?.id)
        .eq('status', 'paused');
      if (pausedErr) throw pausedErr;

      // Active (exclude paused)
      const { data: activeUsersRows, error: activeUsersErr } = await supabase
        .from('users')
        .select('id, package_id, status, membership_expiry')
        .eq('gym_id', gym?.id)
        .neq('status', 'paused')
        .gt('membership_expiry', asOf);
      if (activeUsersErr) throw activeUsersErr;

      // Expired (exclude paused)
      const { data: expiredUsersRows, error: expiredUsersErr } = await supabase
        .from('users')
        .select('id, package_id, status, membership_expiry')
        .eq('gym_id', gym?.id)
        .neq('status', 'paused')
        .lt('membership_expiry', asOf);
      if (expiredUsersErr) throw expiredUsersErr;

      // Unknown expiry (exclude paused)
      const { data: unknownExpiryRows } = await supabase
        .from('users')
        .select('id, package_id, status, membership_expiry')
        .eq('gym_id', gym?.id)
        .neq('status', 'paused')
        .is('membership_expiry', null);

      const activeCountNow = (activeUsersRows ?? []).length;
      const expiredCountNow = (expiredUsersRows ?? []).length;
      const unknownCountNow = (unknownExpiryRows ?? []).length;
      const pausedCountNow = (pausedUsersRows ?? []).length;

      const memberStatusArr: StatusPoint[] = [];
      if (activeCountNow > 0) memberStatusArr.push({ name: 'active', value: activeCountNow });
      if (expiredCountNow > 0) memberStatusArr.push({ name: 'expired', value: expiredCountNow });
      if (pausedCountNow > 0) memberStatusArr.push({ name: 'paused', value: pausedCountNow });
      if (unknownCountNow > 0) memberStatusArr.push({ name: 'unknown', value: unknownCountNow });

      // Per-package breakdown using package_id -> name mapping
      const msByPkg: Record<string, Record<string, number>> = {};
      // initialize packages
      (pkgsForCount ?? []).forEach((p: any) => { msByPkg[p.name] = msByPkg[p.name] || {}; });
      msByPkg['Unassigned'] = msByPkg['Unassigned'] || {};

      const pkgIdToNameLocal: Record<string, string> = {};
      (pkgsForCount ?? []).forEach((p: any) => { pkgIdToNameLocal[p.id] = p.name; });

      const addToPkg = (row: any, state: string) => {
        const pkgName = (row?.package_id && pkgIdToNameLocal[row.package_id]) ? pkgIdToNameLocal[row.package_id] : 'Unassigned';
        if (packageFilter && !packageFilter.includes(pkgName)) return; // respect selected package filter
        msByPkg[pkgName] = msByPkg[pkgName] || {};
        msByPkg[pkgName][state] = (msByPkg[pkgName][state] || 0) + 1;
      };

      (activeUsersRows || []).forEach(r => addToPkg(r, 'active'));
      (expiredUsersRows || []).forEach(r => addToPkg(r, 'expired'));
      (pausedUsersRows || []).forEach(r => addToPkg(r, 'paused'));
      (unknownExpiryRows || []).forEach(r => addToPkg(r, 'unknown'));

      const memberStatusByPackage: Record<string, StatusPoint[]> = {};
      Object.entries(msByPkg).forEach(([pkg, map]) => {
        memberStatusByPackage[pkg] = Object.entries(map).map(([name, value]) => ({ name, value }));
      });

      // ensure selected packages are present even if empty
      (pkgsForCount ?? []).forEach((p: any) => {
        if (!memberStatusByPackage[p.name]) memberStatusByPackage[p.name] = [];
      });

      setMemberStatus(memberStatusArr);
      setMemberStatusByPackage(memberStatusByPackage);

      // Cross-check counts for consistency with users table counts
      const totalFromStatus = memberStatusArr.reduce((s,x)=>s+Number(x.value||0),0);
      const totalFromUsers = (activeUsersRows?.length||0) + (expiredUsersRows?.length||0) + (unknownExpiryRows?.length||0) + (pausedUsersRows?.length||0);
      if (totalFromStatus !== totalFromUsers) {
        console.warn('Member status counts mismatch', { totalFromStatus, totalFromUsers });
        setCountsMismatch(`Member status counts mismatch: reports=${totalFromStatus} vs users=${totalFromUsers}`);
      } else {
        setCountsMismatch(null);
      }

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
      let usersQ = supabase
        .from('users_with_membership_info')
        .select('user_id, full_name, email, phone, created_at, membership_expiry, days_left, package_name')
        .eq('gym_id', gym?.id)
        .eq('package_name', pkgName);
      if (effectiveRange) {
        // package-distribution is treated as a point-in-time snapshot — show users active as-of `to`
        usersQ = usersQ.gt('membership_expiry', effectiveRange.to);
      }
      usersQ = usersQ.order('created_at', { ascending: true }).limit(1000);
      const { data, error } = await usersQ;
      if (error) throw error;
      setDrillUsers((data ?? []) as UserWithPkg[]);
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

  // Toggle package selection when user clicks a slice in the package distribution pie
  function handlePackageSliceClick(name?: string) {
    if (!name) return;
    setSelectedPackages(prev => {
      // if prev contains '__all__' or is empty, start with the clicked package
      const withoutAll = prev.filter(x => x !== '__all__');
      if (prev.includes('__all__') || prev.length === 0) return [name];
      if (withoutAll.includes(name)) return withoutAll.filter(x => x !== name);
      return [...withoutAll, name];
    });
    setPackagesOpen(true);
  }

  async function onDrillRevenue() {
    // show detailed rows from user_combined_costs matching current package filter — no created_at used
    setActiveDrill({ type: 'revenue', id: revenuePackageFilter.includes('__all__') ? 'All packages' : revenuePackageFilter.join(', ') });
    setDrillTransactions([]);
    setDrillUsers([]);
    setLoading(true);
    try {
      let drillQ = supabase
        .from('user_combined_costs')
        .select('id, user_id, package_price, one_to_one_coaching_cost, package_name, created_at')
        .eq('gym_id', gym?.id);
      if (effectiveRange) drillQ = drillQ.gte('created_at', effectiveRange.from).lte('created_at', effectiveRange.to);
      drillQ = drillQ.limit(5000);
      const { data: rows, error } = await drillQ;
      if (error) throw error;
      const raw = (rows ?? []) as CombinedRow[];
      const filtered = raw.filter(r => (revenuePackageFilter.includes('__all__')) ? true : revenuePackageFilter.includes(r.package_name ?? ''));
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

  // Derived total for package distribution (used for left-side percentage labels)
  const packageTotal = packageDist.reduce((s, p) => s + Number(p.value || 0), 0);
  // Helper to generate safe IDs for gradient definitions (remove unsafe chars)
  const sanitizeId = (s?: string) => (s || '').toString().replace(/[^a-z0-9\-]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase();

  // Member status color mapping (ensure expired = red and active = neon green)
  const getStatusColor = (status?: string) => {
    const s = (status || '').toString().trim().toLowerCase();
    const map: Record<string, string> = {
      active: '#39FF14', // neon green
      expired: '#E53935', // red
      paused: '#FFB300', // amber
      unknown: '#9E9E9E',
    };
    return map[s] || '#9575CD';
  };


  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <DynamicHeader onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto">
          <div className="p-6">
            <h1 className="text-2xl font-bold mb-4">Admin — Analytics & Reports</h1>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center mb-6">
        <div>
          <label className="block text-sm text-muted-foreground mb-1">Range</label>
          <div className="inline-flex bg-white rounded-md border p-1">
            {[
              { key: 'lifetime', label: 'Lifetime' },
              { key: '90d', label: '90d' },
              { key: '60d', label: '60d' },
              { key: '30d', label: '30d' },
              { key: '7d', label: '7d' },
            ].map((r) => (
              <button
                key={r.key}
                onClick={() => { setTimeRange(r.key as any); fetchAllAnalytics(); }}
                className={`px-3 py-1 text-sm rounded ${timeRange === r.key ? 'bg-sky-600 text-white' : 'bg-transparent'}`}
              >{r.label}</button>
            ))}
          </div>
        </div>

        <div className="relative">
          <label className="block text-sm text-muted-foreground mb-1">Revenue Package</label>
          <div className="flex items-center gap-3">
            <div>
              <button onClick={() => setPackagesOpen(!packagesOpen)} className="border rounded px-3 py-1 inline-flex items-center gap-2">
                <span className="truncate">
                  {selectedPackages.includes('__all__') || selectedPackages.length === 0 ? 'All packages' : selectedPackages.join(', ')}
                </span>
                <span className="text-xs text-slate-500">({selectedPackages.includes('__all__') ? 'All' : selectedPackages.length})</span>
              </button>
            </div>

            <div className="inline-flex items-center gap-2 bg-white rounded-md border p-1">
              <input
                type="date"
                value={customFrom || ''}
                onChange={(e) => setCustomFrom(e.target.value || null)}
                className="px-2 py-1 text-sm border rounded"
              />
              <input
                type="date"
                value={customTo || ''}
                onChange={(e) => setCustomTo(e.target.value || null)}
                className="px-2 py-1 text-sm border rounded"
              />
              <button
                className="px-2 py-1 text-sm border rounded"
                onClick={() => { setCustomFrom(null); setCustomTo(null); setCustomRangeError(null); }}
              >Clear</button>
            </div>
          </div>

          {customFrom && customTo && new Date(customFrom) > new Date(customTo) && (
            <div className="text-xs text-red-600 mt-1">Invalid range — 'From' must be before 'To'.</div>
          )}
          {customFrom && customTo && new Date(customFrom) <= new Date(customTo) && (
            <div className="text-xs text-slate-600 mt-1">Applied: {new Date(customFrom).toLocaleDateString()} — {new Date(customTo).toLocaleDateString()}</div>
          )}

          {packagesOpen && (
            <div className="absolute z-20 mt-2 bg-white border rounded shadow p-3 w-64 max-h-64 overflow-auto">
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={selectedPackages.includes('__all__')} onChange={(e) => {
                    if (e.target.checked) setSelectedPackages(['__all__']); else setSelectedPackages([]);
                  }} />
                  <span className="text-sm">All Packages</span>
                </label>
                <div className="text-sm">
                  <button className="text-sky-600" onClick={() => setSelectedPackages(packagesList.slice())}>Select all</button>
                  <button className="ml-2 text-slate-600" onClick={() => setSelectedPackages([])}>Clear</button>
                </div>
              </div>

              <div className="space-y-1">
                {packagesList.map(p => (
                  <label key={p} className="flex items-center gap-2">
                    <input type="checkbox" checked={selectedPackages.includes(p)} onChange={() => {
                      setSelectedPackages(prev => {
                        // remove '__all__' if present when selecting specific packages
                        const withoutAll = prev.filter(x => x !== '__all__');
                        if (withoutAll.includes(p)) return withoutAll.filter(x => x !== p);
                        return [...withoutAll, p];
                      });
                    }} />
                    <span className="truncate text-sm">{p}</span>
                  </label>
                ))}
              </div>

              <div className="mt-3 flex gap-2">
                <button className="px-3 py-1 bg-sky-600 text-white rounded text-sm" onClick={() => { setRevenuePackageFilter(selectedPackages.length ? selectedPackages : ['__all__']); setPackagesOpen(false); fetchAllAnalytics(); }}>Compare</button>
                <button className="px-3 py-1 border rounded text-sm" onClick={() => { setSelectedPackages([]); setRevenuePackageFilter(['__all__']); setPackagesOpen(false); fetchAllAnalytics(); }}>Reset</button>
              </div>
            </div>
          )}
        </div>
        <div className="ml-auto">
          <button style={ctaStyle} className={ctaClass} onClick={() => { setSelectedPackages([]); setRevenuePackageFilter(['__all__']); fetchAllAnalytics(); }}>Reset</button>
        </div>
      </div>

      {loading && <div className="py-8 text-center">Loading analytics...</div>}
      {error && <div className="text-red-600 mb-4">Error: {error}</div>}

      {/* Grid */}
      <div className="grid grid-cols-1 gap-6">
        {/* User Growth */}
        <section className="bg-white rounded shadow p-4">
          <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
            <h3 className="font-semibold">User Growth</h3>
            <button style={ctaStyle} className={ctaClass} onClick={() => exportCSV(userGrowth, 'user-growth.csv')}>Export CSV</button>
          </div>
          <div className="w-full h-72 sm:h-80 md:h-96 overflow-x-auto scrollbar-thin">
            {/* inner container uses a minWidth based on points so chart can scroll horizontally */}
            <div style={{ minWidth: growthChartWidth }} className="h-full">
              <ResponsiveContainer width={growthChartWidth} height="100%">
                <AreaChart data={userGrowth}>
                  <defs>
                    <linearGradient id="userGrowthGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0088FE" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="#0088FE" stopOpacity={0.08} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="label"
                    tickFormatter={(d: string) => {
                      const dt = new Date(d);
                      return isNaN(dt.getTime()) ? d : dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                    }}
                  />
                  <YAxis allowDecimals={false} />
                  <Tooltip labelFormatter={(label: string) => new Date(label).toLocaleDateString()} />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#0088FE"
                    strokeWidth={2}
                    fill="url(#userGrowthGrad)"
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* Package Distribution */}
        <section className="bg-white rounded shadow p-4">
          <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
            <h3 className="font-semibold">Package Distribution</h3>
            <button style={ctaStyle} className={ctaClass} onClick={() => exportCSV(packageDist, 'package-distribution.csv')}>Export CSV</button>
          </div>
          <div className="w-full h-72 sm:h-80 md:h-96">
            <div className="flex h-full">
              {/* Left stacked labels (wider to allow longer package names) */}
              <div className="w-66 p-3 border-r border-gray-100 overflow-auto">
                {packageDist.length === 0 ? (
                  <div className="text-sm text-gray-500">No packages available</div>
                ) : (
                  <div className="space-y-2">
                    {packageDist.map((p, idx) => {
                      const pct = packageTotal > 0 ? Math.round((Number(p.value || 0) / packageTotal) * 100) : 0;
                      return (
                        <div key={p.name} className="flex items-center gap-3">
                          <span style={{ width: 12, height: 12, backgroundColor: COLORS[idx % COLORS.length], display: 'inline-block', borderRadius: 3 }} />
                          <div className="flex-1 text-sm truncate">{p.name}</div>
                          <div className="text-sm text-gray-600">{pct}%</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Pie chart without labels (clean) - made larger by increasing radii */}
              <div className="flex-1 h-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={packageDist}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={96}
                      paddingAngle={6}
                      cornerRadius={8}
                      onClick={(data: any) => handlePackageSliceClick(data?.name)}
                      label={false}
                      labelLine={false}
                      stroke="transparent"
                    >
                      {packageDist.map((entry, idx) => (
                        <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any, name: any) => [value, name]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </section>

        {/* Revenue: Horizontal bar compare (Package vs One-to-one vs Total) */}
        <section className="bg-white rounded shadow p-4 relative">
          <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
            <h3 className="font-semibold">Revenue — compare totals</h3>
            <div className="flex gap-2 flex-wrap">
              <button style={ctaStyle} className={ctaClass} onClick={() => exportCSV(revenueCompare, 'revenue-compare.csv')}>Export CSV</button>
            </div>
          </div>

         

          <div className="flex items-center justify-between mb-3 gap-3">
            <div className="inline-flex items-center gap-2">
              <label className="text-sm text-muted-foreground">Range</label>
              <div className="inline-flex bg-white rounded-md border p-1">
                {[{ key: 7, label: '7d' }, { key: 30, label: '30d' }, { key: 90, label: '90d' }, { key: 180, label: '180d' }].map((r) => (
                  <button
                    key={r.key}
                    onClick={() => { setRevenueRangeDays(r.key); loadRevenueSeries(); }}
                    className={`px-3 py-1 text-sm rounded ${revenueRangeDays === r.key ? 'bg-sky-600 text-white' : 'bg-transparent'}`}
                  >{r.label}</button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                className={`flex items-center gap-2 text-sm px-2 py-1 rounded ${showPackages ? '' : 'opacity-40'}`}
                onClick={() => setShowPackages((s) => !s)}
                aria-pressed={showPackages}
              >
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: dynamicStyles.primaryColor }} />
                Packages
              </button>

              <button
                className={`flex items-center gap-2 text-sm px-2 py-1 rounded ${showCoaching ? '' : 'opacity-40'}`}
                onClick={() => setShowCoaching((s) => !s)}
                aria-pressed={showCoaching}
              >
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: dynamicStyles.accentColor }} />
                1:1 Coaching
              </button>

              <button
                className={`flex items-center gap-2 text-sm px-2 py-1 rounded ${showTotal ? '' : 'opacity-40'}`}
                onClick={() => setShowTotal((s) => !s)}
                aria-pressed={showTotal}
              >
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: dynamicStyles.secondaryColor }} />
                Total
              </button>
            </div>
          </div>

          {revenueSeriesLoading ? (
            <div className="text-sm text-gray-500 py-6">Loading chart...</div>
          ) : revenueSeries.length === 0 ? (
            <div className="text-sm text-gray-500 py-6">No revenue data available for the selected range.</div>
          ) : (
            <div className="w-full h-80 sm:h-96 md:h-96">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={revenueSeries} margin={{ top: 12, right: 24, left: 0, bottom: 6 }}>
                  <defs>
                    <linearGradient id="pkgFill_reports" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={dynamicStyles.primaryColor} stopOpacity="0.42" />
                      <stop offset="100%" stopColor={dynamicStyles.primaryColor} stopOpacity="0.08" />
                    </linearGradient>
                    <linearGradient id="coachFill_reports" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={dynamicStyles.accentColor} stopOpacity="0.36" />
                      <stop offset="100%" stopColor={dynamicStyles.accentColor} stopOpacity="0.06" />
                    </linearGradient>
                    <linearGradient id="totalFill_reports" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={dynamicStyles.secondaryColor} stopOpacity="0.48" />
                      <stop offset="100%" stopColor={dynamicStyles.secondaryColor} stopOpacity="0.18" />
                    </linearGradient>
                  </defs>

                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d: string) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    tick={{ fontSize: 11, fill: '#374151' }}
                    padding={{ left: 8, right: 8 }}
                  />
                  <YAxis domain={[0, Math.max(1, Math.ceil(Math.max(...revenueSeries.map(r => Number(r.total || 0))) * 1.15))]} tickFormatter={(v) => nf.format(Number(v))} tick={{ fontSize: 11, fill: '#374151' }} />

                  <Tooltip
                    content={<RevenueTooltip />}
                    labelFormatter={(label: string) => new Date(label).toLocaleDateString()}
                    wrapperStyle={{ borderRadius: 8 }}
                    cursor={{ stroke: dynamicStyles.secondaryColor, strokeDasharray: '3 3' }}
                  />

                  {showPackages && (
                    <>
                      <Area type="monotone" dataKey="packages" name="Packages" stroke={dynamicStyles.primaryColor} strokeOpacity={0.18} strokeWidth={1} fill="url(#pkgFill_reports)" fillOpacity={1} isAnimationActive={false} />
                      <Line type="monotone" dataKey="packages" name="Packages" stroke={dynamicStyles.primaryColor} dot={false} activeDot={{ r: 5 }} strokeWidth={2} isAnimationActive={false} />
                    </>
                  )}
                  {showCoaching && (
                    <>
                      <Area type="monotone" dataKey="coaching" name="1:1 Coaching" stroke={dynamicStyles.accentColor} strokeOpacity={0.18} strokeWidth={1} fill="url(#coachFill_reports)" fillOpacity={1} isAnimationActive={false} />
                      <Line type="monotone" dataKey="coaching" name="1:1 Coaching" stroke={dynamicStyles.accentColor} dot={false} activeDot={{ r: 5 }} strokeWidth={2} isAnimationActive={false} />
                    </>
                  )}
                  {showTotal && (
                    <>
                      <Area type="monotone" dataKey="total" name="Total" stroke={dynamicStyles.secondaryColor} strokeOpacity={0.18} strokeWidth={1} fill="url(#totalFill_reports)" fillOpacity={1} isAnimationActive={false} />
                      <Line type="monotone" dataKey="total" name="Total" stroke={dynamicStyles.secondaryColor} dot={false} activeDot={{ r: 7, stroke: '#fff', strokeWidth: 2 }} strokeWidth={3} isAnimationActive={false} />
                    </>
                  )}

                </ComposedChart>
              </ResponsiveContainer>


            </div>
          )}
        </section>

        {/* Member Status */}
        <section className="bg-white rounded shadow p-4">
          <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
            <h3 className="font-semibold">Member Status</h3>
            <div className="flex items-center gap-3">
              {countsMismatch && <div className="text-sm text-yellow-600">⚠ {countsMismatch}</div>}
              <button style={ctaStyle} className={ctaClass} onClick={() => exportCSV(memberStatus, 'member-status.csv')}>Export CSV</button>
            </div>
          </div>
          <div className="w-full h-72 sm:h-80 md:h-96">
            {activePackageFilter && !activePackageFilter.includes('__all__') ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {(activePackageFilter as string[]).map((pkgName) => (
                  <div key={pkgName} className="bg-white rounded p-2 shadow-sm">
                    <div className="text-sm font-medium mb-2">{pkgName}</div>
                    <div className="h-44">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          {/* Gradient defs per slice to create a soft gradient look */}
                          <defs>
                            {(memberStatusByPackage[pkgName] ?? []).map((entry, idx) => {
                              const gid = `msGrad-${sanitizeId(pkgName)}-${idx}`;
                              const color = getStatusColor(entry.name);
                              return (
                                <linearGradient id={gid} key={gid} x1="0" y1="0" x2="1" y2="1">
                                  <stop offset="0%" stopColor={color} stopOpacity={0.98} />
                                  <stop offset="100%" stopColor={color} stopOpacity={0.28} />
                                </linearGradient>
                              );
                            })}
                          </defs>

                          <Pie
                            data={memberStatusByPackage[pkgName] ?? []}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={56}
                            paddingAngle={4}
                            stroke="transparent"
                          >
                            {(memberStatusByPackage[pkgName] ?? []).map((entry, idx) => {
                              const gid = `msGrad-${sanitizeId(pkgName)}-${idx}`;
                              return <Cell key={`cell-ms-${pkgName}-${idx}`} fill={`url(#${gid})`} />;
                            })}
                          </Pie>

                          <Tooltip formatter={(value: any, name: any) => [value, name]} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  {/* Gradient defs for overall member status */}
                  <defs>
                    {memberStatus.map((entry, idx) => {
                      const gid = `msGrad-${idx}`;
                      const color = getStatusColor(entry.name);
                      return (
                        <linearGradient id={gid} key={gid} x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor={color} stopOpacity={0.98} />
                          <stop offset="100%" stopColor={color} stopOpacity={0.28} />
                        </linearGradient>
                      );
                    })}
                  </defs>

                  <Pie data={memberStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} stroke="transparent">
                    {memberStatus.map((entry, idx) => <Cell key={`cell-status-${idx}`} fill={`url(#msGrad-${idx})`} />)}
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        {/* Top Packages */}
        <section className="bg-white rounded shadow p-4">
          <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
            <h3 className="font-semibold">Top Packages</h3>
            <button style={ctaStyle} className={ctaClass} onClick={() => exportCSV(topPackages, 'top-packages.csv')}>Export CSV</button>
          </div>

          {/* Horizontal scroll wrapper - allows viewing many packages */}
          <div className="w-full h-80 sm:h-80 md:h-96 overflow-x-auto scrollbar-thin">
            <div style={{ minWidth: packageChartWidth }} className="h-full flex">
              {/* Chart area */}
              <div className="flex-1 h-full">
                <ResponsiveContainer width={packageChartWidth} height="100%">
                  <BarChart data={topPackages} margin={{ top: 10, right: 16, left: 16, bottom: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="name"
                      type="category"
                      tick={renderRotatedTick}
                      interval={0}
                    />
                    <YAxis type="number" />
                    <Tooltip content={({ active, payload }: any) => {
                      if (!active || !payload || !payload.length) return null;
                      const d = payload[0].payload as PackageDistPoint;
                      return (
                        <div className="bg-white p-2 border rounded shadow">
                          <div className="font-semibold">{d.name}</div>
                          <div>Count: {d.value}</div>
                          <div>Price: {d.price ? nfEtb.format(Number(d.price)) : 'N/A'}</div>
                        </div>
                      );
                    }} />
                    <Bar dataKey="value" barSize={18}>
                      {topPackages.map((entry, idx) => (
                        <Cell key={`cell-top-${idx}`} fill={COLORS[idx % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Right-side labels */}
              <div className="w-72 p-3 border-l border-gray-100 overflow-auto">
                {topPackages.length === 0 ? (
                  <div className="text-sm text-gray-500">No packages</div>
                ) : (
                  <div className="space-y-2">
                    {topPackages.map((p, idx) => (
                      <div key={p.name} className="flex items-center justify-between gap-3 py-1">
                        <div className="flex items-center gap-2">
                          <span style={{ width: 12, height: 12, backgroundColor: COLORS[idx % COLORS.length], display: 'inline-block', borderRadius: 3 }} />
                          <div className="text-sm truncate">{p.name}</div>
                        </div>
                        <div className="text-sm font-medium">{p.value}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        </section>

        {/* Staff */}
        <section className="bg-white rounded shadow p-4">
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
        </main>
      </div>
    </div>
  );
  
}
