import React, { useEffect, useMemo, useState } from 'react';
import { Users, Calendar, BadgeCheck, DollarSign, Bell } from 'lucide-react';
import { StatCard } from '@/components/dashboard/StatCard';
import { supabase } from '@/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Dashboard component
export default function Dashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Stats
  const [totalMembers, setTotalMembers] = useState<number>(0);
  const [todayCheckIns, setTodayCheckIns] = useState<number>(0);
  const [activeMembers, setActiveMembers] = useState<number>(0);
  const [revenueTodayPackages, setRevenueTodayPackages] = useState<number>(0);

  // Revenues (overall) from user_combined_costs
  const [totalPackageRevenue, setTotalPackageRevenue] = useState<number>(0);
  const [totalCoachingRevenue, setTotalCoachingRevenue] = useState<number>(0);
  const [combinedRevenue, setCombinedRevenue] = useState<number>(0);

  // Expiring soon
  type ExpiringMember = {
    user_id: string;
    full_name: string;
    package_name?: string | null;
    days_left: number;
    phone?: string | null;
  };
  const [expiringMembers, setExpiringMembers] = useState<ExpiringMember[]>([]);
  const [loadingExpiring, setLoadingExpiring] = useState<boolean>(false);

  // Recent check-ins
  type RecentCI = { id: string; name: string; time: string; package?: string | null };
  const [recentCheckIns, setRecentCheckIns] = useState<RecentCI[]>([]);
  const [loadingRecent, setLoadingRecent] = useState<boolean>(false);
  // Staff recent check-ins state and filter
  const [recentStaffCheckIns, setRecentStaffCheckIns] = useState<Array<{ id: string; name: string; time: string; role?: string | null }>>([]);
  const [loadingRecentStaff, setLoadingRecentStaff] = useState<boolean>(false);
  const [recentFilter, setRecentFilter] = useState<'clients' | 'staff'>('clients');

  // Templates and Notify Modal
  const [templates, setTemplates] = useState<Array<{ id: string; name: string; title: string; body: string }>>([]);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifyTarget, setNotifyTarget] = useState<ExpiringMember | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [sending, setSending] = useState(false);

  // Growth chart state
  type GrowthRange = '1d' | '7d' | '30d' | '90d' | '12m';
  const [growthRange, setGrowthRange] = useState<GrowthRange>('30d');
  const [growthPoints, setGrowthPoints] = useState<Array<{ label: string; value: number; raw: string }>>([]);
  const [growthLoading, setGrowthLoading] = useState(false);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const nf = useMemo(() => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }), []);

  // Load initial data
  useEffect(() => {
    loadStats();
    loadRevenues();
    loadExpiringSoon();
    loadRecentCheckIns();
    // Load staff recent check-ins as well
    loadRecentStaffCheckIns();
    loadTemplates();
  }, []);

  useEffect(() => {
    loadGrowthData(growthRange);
  }, [growthRange]);

  // Date utilities
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const dayStartISO = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString();
  }, []);
  const dayEndISO = useMemo(() => {
    const d = new Date(); d.setHours(23, 59, 59, 999); return d.toISOString();
  }, []);

  // Fetch growth data with range (cumulative users over time)
  const loadGrowthData = async (range: GrowthRange) => {
    setGrowthLoading(true);
    try {
      const now = new Date();
      let start = new Date(now);
      // New short ranges
      if (range === '1d') start.setHours(0, 0, 0, 0);
      else if (range === '7d') start.setDate(now.getDate() - 6);
      else if (range === '30d') start.setDate(now.getDate() - 29);
      else if (range === '90d') start.setDate(now.getDate() - 89);
      else if (range === '12m') {
        start = new Date(now.getFullYear(), now.getMonth() - 11, 1, 0, 0, 0, 0);
      }

      const { data, error } = await supabase
        .from('users')
        .select('created_at')
        .gte('created_at', start.toISOString())
        .lte('created_at', now.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;
      const created = (data || []).map((r: any) => new Date(r.created_at));

      if (range === '12m') {
        // Monthly buckets (last 12 months)
        const buckets: Array<{ key: string; date: Date; count: number }> = [];
        for (let i = 11; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          buckets.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, date: d, count: 0 });
        }
        created.forEach((dt) => {
          const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
          const b = buckets.find((x) => x.key === key);
          if (b) b.count += 1;
        });
        // cumulative
        let cum = 0;
        setGrowthPoints(
          buckets.map((b) => {
            cum += b.count;
            // raw as first day of month to format later
            const raw = `${b.key}-01`;
            return { label: b.key, value: cum, raw };
          })
        );
      } else {
        // Daily buckets for 1d/7d/30d/90d
        const days: Array<{ key: string; date: Date; count: number }> = [];
        const copy = new Date(start);
        copy.setHours(0, 0, 0, 0);
        const end = new Date(now);
        end.setHours(0, 0, 0, 0);
        while (copy <= end) {
          days.push({ key: copy.toISOString().slice(0, 10), date: new Date(copy), count: 0 });
          copy.setDate(copy.getDate() + 1);
        }
        created.forEach((dt) => {
          const key = dt.toISOString().slice(0, 10);
          const d = days.find((x) => x.key === key);
          if (d) d.count += 1;
        });
        let cum = 0;
        setGrowthPoints(
          days.map((d) => {
            cum += d.count;
            // keep raw ISO date; label will be formatted at render time
            return { label: d.key.slice(5), value: cum, raw: d.key };
          })
        );
      }
    } catch {
      setGrowthPoints([]);
    } finally {
      setGrowthLoading(false);
    }
  };

  // Load dashboard stats
  const loadStats = async () => {
    try {
      // Total Members: users count
      const { count: usersCount, error: usersErr } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });
      if (!usersErr && typeof usersCount === 'number') setTotalMembers(usersCount || 0);

      // Today's client check-ins (from client_checkins)
      const { count: ciCount, error: ciErr } = await supabase
        .from('client_checkins')
        .select('*', { count: 'exact' })
        .eq('checkin_date', todayStr);
      if (!ciErr && typeof ciCount === 'number') setTodayCheckIns(ciCount || 0);

      // Active memberships: users where status like 'active%' and membership_expiry >= now()
      const { count: activeCnt } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .ilike('status', 'active%')
        .gte('membership_expiry', new Date().toISOString());
      if (typeof activeCnt === 'number') setActiveMembers(activeCnt || 0);

      // Revenue Today (Packages): sum price for users created today with a package
      const { data: newUsers } = await supabase
        .from('users')
        .select('id, created_at, package_id, packages(price)')
        .not('package_id', 'is', null)
        .gte('created_at', dayStartISO)
        .lte('created_at', dayEndISO);
      const pkgSum = (newUsers || []).reduce((sum: number, u: any) => {
        const price = u?.packages?.price;
        const n = typeof price === 'number' ? price : Number(price || 0);
        return sum + (Number.isFinite(n) ? n : 0);
      }, 0);
      setRevenueTodayPackages(pkgSum);
    } catch {
      // swallow
    }
  };

  // Load revenue data (based on available schema)
  const loadRevenues = async () => {
    try {
      // Total Package Revenue: sum package price for users with active memberships (status active and not expired)
      const { data: activeUsers } = await supabase
        .from('users')
        .select('id, package_id, packages(price)')
        .not('package_id', 'is', null)
        .ilike('status', 'active%')
        .gte('membership_expiry', new Date().toISOString());
      const totalPkg = (activeUsers || []).reduce((sum: number, u: any) => {
        const price = u?.packages?.price;
        const n = typeof price === 'number' ? price : Number(price || 0);
        return sum + (Number.isFinite(n) ? n : 0);
      }, 0);

      // Total 1:1 Coaching Revenue (estimated monthly): active rows
      const { data: activeCoaching } = await supabase
        .from('one_to_one_coaching')
        .select('hourly_rate, days_per_week, hours_per_session, status')
        .eq('status', 'active');
      const coachingTotal = (activeCoaching || []).reduce((sum: number, r: any) => {
        const hr = Number(r?.hourly_rate || 0);
        const d = Number(r?.days_per_week || 0);
        const hps = Number(r?.hours_per_session || 0);
        const weekly = hr * d * hps; // hourly * hours per session * days/week
        const monthlyEstimate = weekly * 4; // approx.
        return sum + (Number.isFinite(monthlyEstimate) ? monthlyEstimate : 0);
      }, 0);

      setTotalPackageRevenue(totalPkg);
      setTotalCoachingRevenue(coachingTotal);
      setCombinedRevenue(totalPkg + coachingTotal);
    } catch {
      setTotalPackageRevenue(0);
      setTotalCoachingRevenue(0);
      setCombinedRevenue(0);
    }
  };

  // Load expiring memberships (based on users table)
  const loadExpiringSoon = async () => {
    setLoadingExpiring(true);
    try {
      const now = new Date();
      const in10 = new Date();
      in10.setDate(now.getDate() + 10);
      const { data } = await supabase
        .from('users')
        .select('id, full_name, phone, membership_expiry, packages(name)')
        .not('membership_expiry', 'is', null)
        .gte('membership_expiry', now.toISOString())
        .lte('membership_expiry', in10.toISOString())
        .order('membership_expiry', { ascending: true });
      const list = (data || [])
        .map((u: any) => {
          const expiry = new Date(u.membership_expiry);
          const days = Math.max(0, Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
          return {
            user_id: u.id,
            full_name: u.full_name,
            package_name: u.packages?.name || null,
            days_left: days,
            phone: u.phone || null,
          };
        })
        .sort((a: any, b: any) => a.days_left - b.days_left)
        .slice(0, 5);
      setExpiringMembers(list);
    } catch {
      setExpiringMembers([]);
    } finally {
      setLoadingExpiring(false);
    }
  };

  // Load recent check-ins
  const loadRecentCheckIns = async () => {
    setLoadingRecent(true);
    try {
      const { data, error } = await supabase
        .from('client_checkins')
        .select('id, checkin_time, users(full_name, packages(name))')
        .eq('checkin_date', todayStr)
        .order('checkin_time', { ascending: false })
        .limit(10);
      if (error) throw error;
      const mapped: RecentCI[] = (data || []).map((row: any) => ({
        id: row.id,
        name: row.users?.full_name || 'Unknown',
        time: new Date(row.checkin_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        package: row.users?.packages?.name || null,
      }));
      setRecentCheckIns(mapped);
    } catch {
      setRecentCheckIns([]);
    } finally {
      setLoadingRecent(false);
    }
  };

  // Load recent staff check-ins (today)
  const loadRecentStaffCheckIns = async () => {
    setLoadingRecentStaff(true);
    try {
      const { data, error } = await supabase
        .from('staff_checkins')
        .select('id, checkin_time, staff(first_name, last_name, roles(name))')
        .eq('checkin_date', todayStr)
        .order('checkin_time', { ascending: false })
        .limit(10);
      if (error) throw error;
      const mapped = (data || []).map((row: any) => ({
        id: row.id,
        name: `${row.staff?.first_name ?? ''} ${row.staff?.last_name ?? ''}`.trim() || 'Unknown',
        time: new Date(row.checkin_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        role: row.staff?.roles?.name || null,
      }));
      setRecentStaffCheckIns(mapped);
    } catch {
      setRecentStaffCheckIns([]);
    } finally {
      setLoadingRecentStaff(false);
    }
  };

  // Load SMS templates
  const loadTemplates = async () => {
    try {
      const { data } = await supabase
        .from('notification_templates')
        .select('id, name, title, body')
        .order('created_at', { ascending: false });
      setTemplates(data || []);
      if ((data || []).length > 0) setSelectedTemplateId((data as any[])[0].id);
    } catch {
      setTemplates([]);
    }
  };

  // Open notification modal
  const openNotify = (member: ExpiringMember) => {
    setNotifyTarget(member);
    setNotifyOpen(true);
  };

  // Close notification modal
  const closeNotify = () => {
    setNotifyOpen(false);
    setNotifyTarget(null);
    setSelectedTemplateId(templates[0]?.id || '');
  };

  // Handle sending notification SMS
  const handleSendNotify = async () => {
    if (!notifyTarget?.phone || !selectedTemplateId) {
      toast({ title: 'Missing info', description: 'Select a template and ensure member has a phone.', variant: 'destructive' });
      return;
    }
    const tpl = templates.find(t => t.id === selectedTemplateId);
    if (!tpl) return;
    const msg = tpl.body
      .replace(/\{full_name\}/gi, notifyTarget.full_name || '')
      .replace(/\{package\}/gi, notifyTarget.package_name || '')
      .replace(/\{days_left\}/gi, String(notifyTarget.days_left));
    setSending(true);
    try {
      // Call Supabase Edge Function (adjust name if different)
      const resp = await fetch('/functions/v1/sms-sender', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: notifyTarget.phone,
          message: msg,
          metadata: { reason: 'membership_expiry', user_id: notifyTarget.user_id },
        }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      toast({ title: 'Notification sent', description: `SMS sent to ${notifyTarget.full_name}` });
      closeNotify();
    } catch (e: any) {
      toast({ title: 'Send failed', description: e?.message || 'Could not send SMS', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  // Chart dimensions and helpers (restore larger size and reduce left pad)
  const chartW = 800;
  const chartH = 260;
  const pad = { top: 20, right: 20, bottom: 30, left: 36 };
  const innerW = chartW - pad.left - pad.right;
  const innerH = chartH - pad.top - pad.bottom;
  const maxY = Math.max(1, ...growthPoints.map((p) => p.value));
  const xAt = (i: number) => pad.left + (growthPoints.length <= 1 ? 0 : (i * innerW) / (growthPoints.length - 1));
  const yAt = (v: number) => pad.top + innerH * (1 - v / maxY);

  // Nice Y ticks
  const niceStep = (() => {
    const rough = maxY / 4 || 1;
    const pow10 = Math.pow(10, Math.floor(Math.log10(rough)));
    const n = rough / pow10;
    const step = n >= 5 ? 5 : n >= 2 ? 2 : 1;
    return step * pow10;
  })();
  const yTicks = Array.from({ length: Math.floor(maxY / niceStep) + 1 }, (_, i) => Math.round(i * niceStep));

  // Smooth path (Catmull-Rom to Bezier)
  const buildSmoothLinePath = (pts: Array<{ x: number; y: number }>, alpha = 0.5) => {
    if (pts.length < 2) return '';
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      const cp1x = p1.x + ((p2.x - p0.x) / 6) * alpha;
      const cp1y = p1.y + ((p2.y - p0.y) / 6) * alpha;
      const cp2x = p2.x - ((p3.x - p1.x) / 6) * alpha;
      const cp2y = p2.y - ((p3.y - p1.y) / 6) * alpha;
      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return d;
  };

  // Helpers: format X label and choose label step to avoid overlap
  const formatXLabel = (raw: string, range: GrowthRange) => {
    const d = new Date(raw);
    if (range === '12m') return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };
  const labelStep = Math.max(1, Math.ceil(growthPoints.length / 8));
  const xTickIdxs = growthPoints.map((_, i) => i).filter(i => i === 0 || i === growthPoints.length - 1 || i % labelStep === 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-3xl font-bold tracking-tight">Dashboard Overview</h2>

      {/* Stat cards - clickable, add subtle color accents */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div onClick={() => navigate('/membership-list')} className="cursor-pointer transition hover:-translate-y-0.5">
          <div className="rounded-lg bg-blue-50 p-0.5">
            <StatCard
              title="Total Members"
              value={String(totalMembers)}
              icon={Users}
              trend={{ value: '', positive: true }}
            />
          </div>
        </div>
        <div onClick={() => navigate('/check-ins')} className="cursor-pointer transition hover:-translate-y-0.5">
          <div className="rounded-lg bg-emerald-50 p-0.5">
            <StatCard
              title="Today's Check-Ins"
              value={String(todayCheckIns)}
              icon={Calendar}
              trend={{ value: '', positive: true }}
            />
          </div>
        </div>
        <div onClick={() => navigate('/membership-list')} className="cursor-pointer transition hover:-translate-y-0.5">
          <div className="rounded-lg bg-purple-50 p-0.5">
            <StatCard
              title="Active Memberships"
              value={String(activeMembers)}
              icon={BadgeCheck}
              trend={{ value: '', positive: true }}
            />
          </div>
        </div>
        <div className="cursor-default transition">
          <div className="rounded-lg bg-amber-50 p-0.5">
            <StatCard
              title="Revenue Today (Packages)"
              value={nf.format(revenueTodayPackages)}
              icon={DollarSign}
              trend={{ value: 'Packages only', positive: true }}
            />
          </div>
        </div>
      </div>

      {/* Revenue summary with color styling */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Summary</CardTitle>
          <CardDescription>
            Current active totals.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-md bg-blue-50">
              <div className="text-sm text-blue-700">Total Package Revenue</div>
              <div className="text-2xl font-bold text-blue-900">{nf.format(totalPackageRevenue)}</div>
            </div>
            <div className="p-4 border rounded-md bg-emerald-50">
              <div className="text-sm text-emerald-700">Total 1:1 Coaching Revenue</div>
              <div className="text-2xl font-bold text-emerald-900">{nf.format(totalCoachingRevenue)}</div>
            </div>
            <div className="p-4 border rounded-md bg-purple-50">
              <div className="text-sm text-purple-700">Combined Revenue</div>
              <div className="text-2xl font-bold text-purple-900">{nf.format(combinedRevenue)}</div>
            </div>
          </div>
          <div className="text-xs text-gray-600 mt-2">
            Note: Today’s revenue counts package registrations today only (not 1:1). Package price and 1:1 cadence may represent different billing periods.
          </div>
        </CardContent>
      </Card>

      {/* Expiring soon and Recent check-ins stacked (not side-by-side) */}
      <div className="space-y-4 mt-2">
        {/* Expiring soon */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Memberships Expiring Soon</CardTitle>
              <CardDescription>Members expiring within 10 days</CardDescription>
            </div>
            <Button variant="outline" onClick={() => navigate('/membership-list')}>
              View All
            </Button>
          </CardHeader>
          <CardContent>
            {loadingExpiring ? (
              <div className="text-sm text-gray-500 py-6">Loading...</div>
            ) : expiringMembers.length === 0 ? (
              <div className="text-sm text-gray-500 py-6">No members expiring soon</div>
            ) : (
              <div className="space-y-3">
                {expiringMembers.map((m) => (
                  <div key={m.user_id} className="flex items-center justify-between p-3 border rounded-md bg-orange-50">
                    <div>
                      <div className="font-medium text-orange-900">{m.full_name}</div>
                      <div className="text-xs text-orange-700">
                        <Badge variant="secondary">{m.package_name || 'No Package'}</Badge>
                        <span className="ml-2">Expires in {m.days_left} day{m.days_left === 1 ? '' : 's'}</span>
                      </div>
                    </div>
                    <Button size="sm" onClick={() => openNotify(m)}>
                      <Bell className="h-4 w-4 mr-1" /> Notify
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent check-ins - add Clients/Staff filter */}
        <Card>
          <CardHeader className="flex flex-row justify-between">
            <div>
              <CardTitle>Recent Check-Ins (Today)</CardTitle>
              <CardDescription>
                Last 10 {recentFilter === 'clients' ? 'client' : 'staff'} check-ins
              </CardDescription>
            </div>
            <Select value={recentFilter} onValueChange={(v: 'clients' | 'staff') => setRecentFilter(v)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="clients">Clients</SelectItem>
                <SelectItem value="staff">Staff</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {recentFilter === 'clients' ? (
              loadingRecent ? (
                <div className="text-sm text-gray-500 py-6">Loading...</div>
              ) : recentCheckIns.length === 0 ? (
                <div className="text-sm text-gray-500 py-6">No client check-ins recorded today</div>
              ) : (
                <div className="space-y-3">
                  {recentCheckIns.map((ci) => (
                    <div key={ci.id} className="flex items-center justify-between p-2 border rounded-md bg-sky-50">
                      <div>
                        <div className="font-medium text-sky-900">{ci.name}</div>
                        <div className="text-xs text-sky-700">{ci.package || 'No Package'}</div>
                      </div>
                      <div className="text-sm text-sky-800">{ci.time}</div>
                    </div>
                  ))}
                </div>
              )
            ) : loadingRecentStaff ? (
              <div className="text-sm text-gray-500 py-6">Loading...</div>
            ) : recentStaffCheckIns.length === 0 ? (
              <div className="text-sm text-gray-500 py-6">No staff check-ins recorded today</div>
            ) : (
              <div className="space-y-3">
                {recentStaffCheckIns.map((ci) => (
                  <div key={ci.id} className="flex items-center justify-between p-2 border rounded-md bg-violet-50">
                    <div>
                      <div className="font-medium text-violet-900">{ci.name}</div>
                      <div className="text-xs text-violet-700">{ci.role || 'No Role'}</div>
                    </div>
                    <div className="text-sm text-violet-800">{ci.time}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Member Growth chart */}
      <Card>
        <CardHeader className="flex items-start justify-between gap-4">
          <div className="text-left">
            <CardTitle>Member Growth</CardTitle>
            <CardDescription>
              Cumulative users over time. 
            </CardDescription>
          </div>
          <div className="ml-auto">
            <Select value={growthRange} onValueChange={(v: GrowthRange) => setGrowthRange(v)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1d">Today</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="12m">Last 12 months</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {growthLoading ? (
            <div className="text-sm text-gray-500 py-4">Loading growth...</div>
          ) : growthPoints.length === 0 ? (
            <div className="text-sm text-gray-500 py-4">No data in selected range.</div>
          ) : (
            <div className="w-full">
              <svg
                className="w-full"
                viewBox={`0 0 ${chartW} ${chartH}`}
                role="img"
                aria-label="Member growth area chart"
              >
                <defs>
                  <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity="0.05" />
                  </linearGradient>
                  <filter id="softShadow" x="-10%" y="-10%" width="120%" height="120%">
                    <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
                    <feOffset dx="0" dy="1" result="off" />
                    <feComponentTransfer>
                      <feFuncA type="linear" slope="0.25" />
                    </feComponentTransfer>
                    <feMerge>
                      <feMergeNode />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* Y grid + ticks */}
                {yTicks.map((t, i) => {
                  const y = yAt(t);
                  return (
                    <g key={i}>
                      <line x1={pad.left} y1={y} x2={chartW - pad.right} y2={y} stroke="#e5e7eb" strokeWidth="1" />
                      <text x={pad.left - 6} y={y} textAnchor="end" dominantBaseline="middle" fontSize="9" fill="#4b5563">
                        {t}
                      </text>
                    </g>
                  );
                })}

                {/* X labels (small, normal, limited to avoid overlap) */}
                {xTickIdxs.map((i) => (
                  <text key={i} x={xAt(i)} y={chartH - 8} textAnchor="middle" fontSize="9" fill="#4b5563">
                    {formatXLabel(growthPoints[i].raw, growthRange)}
                  </text>
                ))}

                {/* Axis labels */}
                <text x={pad.left + innerW / 2} y={8} textAnchor="middle" fontSize="10" fill="#374151">
                  Date
                </text>
                <text
                  x={8}
                  y={pad.top + innerH / 2}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#374151"
                  transform={`rotate(-90, 8, ${pad.top + innerH / 2})`}
                >
                  Cumulative Members
                </text>

                {/* Smooth line + gradient area */}
                {(() => {
                  const pts = growthPoints.map((p, i) => ({ x: xAt(i), y: yAt(p.value) }));
                  const linePath = buildSmoothLinePath(pts, 0.7);
                  const areaPath = `${linePath} L ${xAt(growthPoints.length - 1)} ${pad.top + innerH} L ${xAt(0)} ${pad.top + innerH} Z`;
                  return (
                    <>
                      <path d={areaPath} fill="url(#growthGrad)" />
                      <path d={linePath} fill="none" stroke="#6366f1" strokeWidth={2.5} strokeLinecap="round" filter="url(#softShadow)" />
                      {pts.map((pt, i) => (
                        <circle key={i} cx={pt.x} cy={pt.y} r={3} fill="#6366f1" />
                      ))}
                    </>
                  );
                })()}

                {/* hover capture */}
                <rect
                  x={pad.left}
                  y={pad.top}
                  width={innerW}
                  height={innerH}
                  fill="transparent"
                  onMouseMove={(e) => {
                    const rect = (e.currentTarget as SVGRectElement).getBoundingClientRect();
                    const mouseX = e.clientX - rect.left;
                    const relX = Math.max(0, Math.min(innerW, mouseX));
                    const step = growthPoints.length > 1 ? innerW / (growthPoints.length - 1) : innerW;
                    const idx = Math.max(0, Math.min(growthPoints.length - 1, Math.round(relX / step)));
                    setHoverIdx(idx);
                  }}
                  onMouseLeave={() => setHoverIdx(null)}
                />

                {/* hover tooltip */}
                {hoverIdx !== null && (
                  <g>
                    <line
                      x1={xAt(hoverIdx)}
                      y1={pad.top}
                      x2={xAt(hoverIdx)}
                      y2={pad.top + innerH}
                      stroke="#94a3b8"
                      strokeDasharray="3 3"
                    />
                    <circle cx={xAt(hoverIdx)} cy={yAt(growthPoints[hoverIdx].value)} r={4} fill="#6366f1" />
                    {(() => {
                      const x = xAt(hoverIdx);
                      const y = yAt(growthPoints[hoverIdx].value);
                      const tipW = 150;
                      const tipH = 44;
                      const tipX = Math.min(Math.max(x - tipW / 2, pad.left), pad.left + innerW - tipW);
                      const tipY = Math.max(pad.top + 4, y - tipH - 10);
                      return (
                        <g transform={`translate(${tipX}, ${tipY})`}>
                          <rect width={tipW} height={tipH} rx={6} ry={6} fill="#111827" opacity="0.9" />
                          <text x={8} y={16} fontSize="11" fill="#e5e7eb">
                            {`Date: ${formatXLabel(growthPoints[hoverIdx].raw, growthRange)}`}
                          </text>
                          <text x={8} y={30} fontSize="11" fill="#e5e7eb">
                            {`Members: ${growthPoints[hoverIdx].value}`}
                          </text>
                        </g>
                      );
                    })()}
                  </g>
                )}
              </svg>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notify Modal */}
      {notifyOpen && notifyTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={closeNotify}
          aria-modal="true"
          role="dialog"
        >
          <div
            className="relative bg-white rounded-lg shadow-lg max-w-xl w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">Notify {notifyTarget.full_name}</h3>
                <p className="text-xs text-gray-500">Send SMS using a template</p>
              </div>
              <Button variant="outline" size="sm" onClick={closeNotify}>×</Button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Template</label>
                <select
                  className="mt-1 w-full border rounded px-2 py-2 text-sm"
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.title} ({t.name})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Preview</label>
                <div className="mt-1 p-3 border rounded bg-gray-50 text-sm">
                  {(templates.find(t => t.id === selectedTemplateId)?.body || '')
                    .replace(/\{full_name\}/gi, notifyTarget.full_name || '')
                    .replace(/\{package\}/gi, notifyTarget.package_name || '')
                    .replace(/\{days_left\}/gi, String(notifyTarget.days_left))}
                </div>
                <div className="text-xs text-gray-500 mt-1">Sent to: {notifyTarget.phone || 'No phone on file'}</div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={closeNotify}>Cancel</Button>
              <Button disabled={sending} onClick={handleSendNotify}>
                {sending ? 'Sending...' : 'Send SMS'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
