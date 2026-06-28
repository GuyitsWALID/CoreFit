import React, { useState, useEffect, useMemo } from "react";
import { Users, Clock, AlertTriangle, CheckCircle, CalendarDays, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";
import { useGym } from "@/contexts/GymContext";
import { recordPayment } from '@/lib/gymApi';
import {
  convertGregorianDatesWithEthioall,
  formatEthiopianDate,
  formatGregorianDate,
  toGregorianDateKey,
} from "@/lib/ethiopianCalendar";
import { isPlaceholderEmail, isPlaceholderPhone } from "@/lib/placeholderEmail";
import { DynamicHeader } from "@/components/layout/DynamicHeader";
import { Sidebar } from "@/components/layout/Sidebar";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { SimpleModal } from "@/components/SimpleModal";

// Import all the extracted components
import {
  StatsCard,
  SearchFilters,
  MembershipTabs,
  MemberCard,
  NotificationModal,
  UpgradeModal,
  ExportButton,
} from "@/components";
import { OneToOneCoachingModal } from "@/components/OneToOneCoachingModal";
import FreezeModal, { FreezeMode } from "@/components/Modals/FreezeActionModal";
import { MembershipInfo } from "@/types/memberships";
import { CoachingSessionData, Trainer } from "@/types/coaching"; // Ensure this matches your types
import { fetchTrainers } from "@/lib/supabase_trainer_query";
import FreezeActionModal from "../components/Modals/FreezeActionModal.tsx";
import type { OfflineRenewalPackage } from "@/components/Modals/OfflineRenewalModal";

type CouponMembershipInfo = MembershipInfo & {
  is_coupon?: boolean;
  number_of_passes?: number | null;
  coupon_used_passes?: number;
  coupon_remaining_passes?: number;
};

const statusColors: Record<string, string> = {
  active: "text-green-600 bg-green-50",
  expired: "text-red-600 bg-red-50",
  used_up: "text-red-600 bg-red-50",
  paused: "text-yellow-600 bg-yellow-50",
};

const MEMBERSHIP_CALENDAR_PREF_KEY = "corefit:membership-calendar";

export default function MembershipList() {
  const { toast } = useToast();
  const { gym, loading: gymLoading } = useGym();
  
  // State management
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [packageFilter, setPackageFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("all");
  const [members, setMembers] = useState<CouponMembershipInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshingMembers, setIsRefreshingMembers] = useState(false);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | 'none'>('none');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [useEthiopianCalendar, setUseEthiopianCalendar] = useState(() => {
    return localStorage.getItem(MEMBERSHIP_CALENDAR_PREF_KEY) === "ethiopian";
  });
  const [ethioallDateMap, setEthioallDateMap] = useState<Record<string, string>>({});

  // Client-side pagination
  const PAGE_SIZE = 60;
  const [currentPage, setCurrentPage] = useState(1);
  
  // Modal states
  const [notifyDialog, setNotifyDialog] = useState(false);
  const [notifyMember, setNotifyMember] = useState<MembershipInfo | null>(null);
  const [notifTitle, setNotifTitle] = useState("");
  const [notifMessage, setNotifMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleteMember, setDeleteMember] = useState<MembershipInfo | null>(null);
  
  const [upgradeDialog, setUpgradeDialog] = useState(false);
  const [upgradeMember, setUpgradeMember] = useState<MembershipInfo | null>(null);
  const [selectedPackage, setSelectedPackage] = useState("");
  const [availablePackages, setAvailablePackages] = useState<OfflineRenewalPackage[]>([]);
  
  // New coaching modal states
  const [coachingDialog, setCoachingDialog] = useState(false);
  const [coachingMember, setCoachingMember] = useState<MembershipInfo | null>(null);
  const [trainers, setTrainers] = useState<Trainer[]>([]);

  // Modal for freezing memberships
  const [freezeDialog, setFreezeDialog] = useState(false);
  const [freezeModalOpen, setFreezeModalOpen] = useState(false);
  const [freezeMode, setFreezeMode]         = useState<FreezeMode>('freeze');
  const [freezeMember, setFreezeMember]     = useState<MembershipInfo | null>(null);
  

  // Handlers to open modal in each mode
  const openFreeze = (member: MembershipInfo) => {
    setFreezeMode('freeze');
    setFreezeMember(member);
    setFreezeModalOpen(true);
  };
  const openExtend = (member: MembershipInfo) => {
    setFreezeMode('extend');
    setFreezeMember(member);
    setFreezeModalOpen(true);
  };

  // unified confirm for both
  const handleFreezeConfirm = async (days: number) => {
    if (!freezeMember) return;
    const key = `${freezeMode}-${freezeMember.user_id}`;
    setProcessingAction(key);

    try {
      let rpcResult;
      if (freezeMode === 'freeze') {
        rpcResult = await supabase.rpc('freeze_membership', {
          p_user_id: freezeMember.user_id,
          p_days: days,
        });
        if (rpcResult.error) throw rpcResult.error;
        toast({
          title: 'Membership frozen',
          description: `${freezeMember.full_name} frozen for ${days} days.`,
        });
      } else {
        rpcResult = await supabase.rpc('extend_freeze_membership', {
          p_user_id: freezeMember.user_id,
          p_extra_days: days,
        });
        if (rpcResult.error) throw rpcResult.error;
        toast({
          title: 'Freeze extended',
          description: `${freezeMember.full_name} extended by ${days} days.`,
        });
      }
      await fetchMembershipData();
      await fetchCounts();
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Unknown error', variant: 'destructive' });
    } finally {
      setProcessingAction(null);
    }
  };

  
  // Action states
  const [canFreeze, setCanFreeze] = useState<Record<string, boolean>>({});
  const [processingAction, setProcessingAction] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [staffRole, setStaffRole] = useState<'admin' | 'receptionist' | null>(null);

  // Data fetching
  useEffect(() => {
    fetchMembershipData();
    
  }, []);

  useEffect(() => {
    if (gym && gym.id !== 'default') fetchStaffRole();
  }, [gym]);

  const fetchStaffRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setStaffRole('admin');
        return;
      }

      let query = supabase
        .from('staff')
        .select(`id, email, roles!inner ( name )`)
        .eq('id', user.id);

      if (gym?.id) query = query.eq('gym_id', gym.id);

      let { data: staffData, error } = await query.single();

      if (error || !staffData) {
        let emailQuery = supabase
          .from('staff')
          .select(`id, email, roles!inner ( name )`)
          .eq('email', user.email);

        if (gym?.id) emailQuery = emailQuery.eq('gym_id', gym.id);

        const { data: emailData, error: emailError } = await emailQuery.single();
        if (!emailError && emailData) staffData = emailData;
      }

      const rawRole = Array.isArray((staffData as any)?.roles)
        ? (staffData as any).roles[0]?.name
        : (staffData as any)?.roles?.name;
      const roleName = (rawRole ?? '').toString().trim().toLowerCase();

      setStaffRole(roleName === 'receptionist' ? 'receptionist' : 'admin');
    } catch {
      setStaffRole('admin');
    }
  };

  // Update styling based on gym configuration
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
    };
  }, [gym]);

  const formatMembershipDate = useMemo(
    () => (value: string | null | undefined) => {
      if (!useEthiopianCalendar) return formatGregorianDate(value);
      const dateKey = toGregorianDateKey(value);
      return (dateKey && ethioallDateMap[dateKey]) || formatEthiopianDate(value);
    },
    [ethioallDateMap, useEthiopianCalendar],
  );

  const handleCalendarToggle = (checked: boolean) => {
    setUseEthiopianCalendar(checked);
    localStorage.setItem(MEMBERSHIP_CALENDAR_PREF_KEY, checked ? "ethiopian" : "gregorian");
  };

  const calculateDateDaysLeft = (expiry: string | null | undefined) => {
    if (!expiry) return Number.MAX_SAFE_INTEGER;
    return Math.ceil((new Date(expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  };

  const calculateCouponPeriodStart = (row: CouponMembershipInfo, packageMeta?: any) => {
    const expiry = row.membership_expiry ? new Date(row.membership_expiry) : null;
    if (!expiry || Number.isNaN(expiry.getTime())) {
      return row.created_at || '1970-01-01T00:00:00.000Z';
    }

    const durationValue = Number(packageMeta?.duration_value ?? row.duration_value ?? 0);
    const durationUnit = String(packageMeta?.duration_unit ?? row.duration_unit ?? 'days').toLowerCase();
    if (!Number.isFinite(durationValue) || durationValue <= 0) {
      return row.created_at || '1970-01-01T00:00:00.000Z';
    }

    const start = new Date(expiry);
    if (durationUnit.startsWith('month')) start.setMonth(start.getMonth() - durationValue);
    else if (durationUnit.startsWith('year')) start.setFullYear(start.getFullYear() - durationValue);
    else if (durationUnit.startsWith('week')) start.setDate(start.getDate() - durationValue * 7);
    else start.setDate(start.getDate() - durationValue);

    return start.toISOString();
  };

  const enrichCouponMembershipRows = async (rows: any[]): Promise<CouponMembershipInfo[]> => {
    if (!Array.isArray(rows) || rows.length === 0) return [];

    const normalizedRows = rows.map((row) => ({
      ...row,
      user_id: row.user_id ?? row.id,
      days_left: typeof row.days_left === 'number' ? row.days_left : calculateDateDaysLeft(row.membership_expiry),
    })) as CouponMembershipInfo[];

    const packageIds = Array.from(new Set(normalizedRows.map((row) => row.package_id).filter(Boolean))) as string[];
    if (packageIds.length === 0) return normalizedRows;

    const { data: packageRows, error: packageError } = await supabase
      .from('packages')
      .select('id, is_coupon, number_of_passes, duration_value, duration_unit')
      .in('id', packageIds);

    if (packageError) {
      console.warn('Could not load coupon package metadata:', packageError.message);
      return normalizedRows;
    }

    const packageById = new Map((packageRows || []).map((pkg: any) => [pkg.id, pkg]));
    const couponRows = normalizedRows.filter((row) => Boolean(packageById.get(row.package_id || '')?.is_coupon));

    const couponUsageByUser = new Map<string, number>();
    await Promise.all(couponRows.map(async (row) => {
      if (!row.user_id || !row.membership_expiry) {
        couponUsageByUser.set(row.user_id, 0);
        return;
      }

      const packageMeta = packageById.get(row.package_id || '');
      const periodStart = calculateCouponPeriodStart(row, packageMeta);
      const { count, error } = await supabase
        .from('client_checkins')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', row.user_id)
        .gte('checkin_time', periodStart)
        .lte('checkin_time', row.membership_expiry);

      if (error) {
        console.warn(`Could not count coupon check-ins for ${row.user_id}:`, error.message);
        couponUsageByUser.set(row.user_id, 0);
        return;
      }

      couponUsageByUser.set(row.user_id, count ?? 0);
    }));

    return normalizedRows.map((row) => {
      const packageMeta = packageById.get(row.package_id || '');
      const isCoupon = Boolean(packageMeta?.is_coupon);
      if (!isCoupon) return { ...row, is_coupon: false };

      const passLimit = Number(packageMeta?.number_of_passes || 0);
      const usedPasses = couponUsageByUser.get(row.user_id) ?? 0;
      const remainingPasses = Math.max(0, passLimit - usedPasses);
      const dateDaysLeft = calculateDateDaysLeft(row.membership_expiry);

      return {
        ...row,
        is_coupon: true,
        number_of_passes: passLimit,
        coupon_used_passes: usedPasses,
        coupon_remaining_passes: remainingPasses,
        days_left: dateDaysLeft,
      };
    });
  };

  // Filter members by gym if gym context is available
  // This version performs DB-side filtering so selecting a status/tab triggers an API query
  const fetchMembershipData = async (opts?: { searchTerm?: string; statusFilter?: string; packageFilter?: string; activeTab?: string; page?: number; showPageLoading?: boolean; }) => {
    const showPageLoading = opts?.showPageLoading ?? members.length === 0;
    if (showPageLoading) setIsLoading(true);
    else setIsRefreshingMembers(true);
    const sTerm = opts?.searchTerm ?? searchTerm;
    const stFilter = opts?.statusFilter ?? statusFilter;
    const pkFilter = opts?.packageFilter ?? packageFilter;
    const tab = opts?.activeTab ?? activeTab;
    const canUseRawStatusFilter = ['active', 'paused', 'inactive'].includes(stFilter);
    try {
      // If active tab — prefer the `users_with_membership_info` view (ensures package fields are populated)
      if (tab === 'active') {
        const nowIso = new Date().toISOString();
        const safe = sTerm ? sTerm.replace(/[%_]/g, "\\$&") : '';

        // First attempt: query the users_with_membership_info view which contains package and membership metadata
        try {
          let viewQuery: any = supabase.from('users_with_membership_info').select('*').gt('membership_expiry', nowIso);
          if (gym && gym.id !== 'default') viewQuery = viewQuery.eq('gym_id', gym.id);
          if (canUseRawStatusFilter) viewQuery = viewQuery.eq('status', stFilter);
          if (safe) viewQuery = viewQuery.or(`full_name.ilike.%${safe}%,email.ilike.%${safe}%,phone.ilike.%${safe}%`);
          if (pkFilter && pkFilter !== 'all') {
            if (pkFilter === '__none__') viewQuery = viewQuery.is('package_name', null);
            else viewQuery = viewQuery.eq('package_name', pkFilter);
          }

          if (sortOrder === 'asc') viewQuery = viewQuery.order('full_name', { ascending: true });
          else if (sortOrder === 'desc') viewQuery = viewQuery.order('full_name', { ascending: false });
          else viewQuery = viewQuery.order('days_left', { ascending: true });

          const { data: viewData, error: viewErr } = await viewQuery;
          if (!viewErr && Array.isArray(viewData)) {
            setMembers(await enrichCouponMembershipRows(viewData || []));
            setIsLoading(false);
            setIsRefreshingMembers(false);
            return;
          }

          console.warn('users_with_membership_info active query failed, falling back to users+combined:', viewErr?.message || viewErr);
        } catch (e) {
          console.warn('users_with_membership_info active query threw error, falling back:', e);
        }

        // Fallback: query active users and merge combined info (legacy behavior)
        const nowIsoFallback = new Date().toISOString();
        let usersQuery: any = supabase
          .from('users')
          .select('id, full_name, email, phone, status, created_at, membership_expiry')
          .gt('membership_expiry', nowIsoFallback);

        if (gym && gym.id !== 'default') usersQuery = usersQuery.eq('gym_id', gym.id);
        if (canUseRawStatusFilter) usersQuery = usersQuery.eq('status', stFilter);
        if (safe) usersQuery = usersQuery.or(`full_name.ilike.%${safe}%,email.ilike.%${safe}%,phone.ilike.%${safe}%`);

        const { data: userRows, error: usersError } = await usersQuery;
        const usersFetched = !usersError;
        const fetchedUsers = usersFetched ? (userRows || []) : [];
        if (!usersFetched) {
          console.warn('users query failed, falling back to combined view:', usersError?.message || usersError);
        } else {
          const userIds = fetchedUsers.map((u: any) => u.id);
          let combinedRows: any[] = [];
          if (userIds.length > 0) {
            try {
              let combQ: any = supabase.from('user_combined_costs').select('*').in('user_id', userIds);
              if (gym && gym.id !== 'default') combQ = combQ.eq('gym_id', gym.id);
              const { data: cr, error: crErr } = await combQ;
              if (!crErr && cr) combinedRows = cr;
            } catch (e) {
              console.warn('Error fetching combined rows for active users:', e);
            }
          }

          const merged: any[] = [];
          (fetchedUsers || []).forEach((u: any) => {
            const combForUser = combinedRows.filter((c: any) => c.user_id === u.id);

            if (combForUser.length > 0) {
              combForUser.forEach((c: any) => {
                const daysLeft = c.membership_expiry ? Math.ceil((new Date(c.membership_expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : Number.MAX_SAFE_INTEGER;
                merged.push({
                  user_id: u.id,
                  full_name: u.full_name,
                  email: u.email,
                  phone: u.phone,
                  package_id: c.package_id,
                  package_name: c.package_name,
                  created_at: c.created_at || u.created_at,
                  membership_expiry: c.membership_expiry ?? u.membership_expiry,
                  status: u.status,
                  days_left: daysLeft,
                  duration_unit: c.duration_unit ?? 'days',
                  duration_value: c.duration_value ?? 0,
                });
              });
            } else {
              const daysLeft = u.membership_expiry ? Math.ceil((new Date(u.membership_expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : Number.MAX_SAFE_INTEGER;
              merged.push({
                user_id: u.id,
                full_name: u.full_name,
                email: u.email,
                phone: u.phone,
                package_id: null,
                package_name: null,
                created_at: u.created_at,
                membership_expiry: u.membership_expiry,
                status: u.status,
                days_left: daysLeft,
                duration_unit: 'days',
                duration_value: 0,
              });
            }
          });

          setMembers(await enrichCouponMembershipRows(merged));
          setIsLoading(false);
          setIsRefreshingMembers(false);
          return;
        }
      }

      // Non-active path: prefer the `users_with_membership_info` view, fall back to `user_combined_costs`
      try {
        let viewQuery: any = supabase.from('users_with_membership_info').select('*');

        if (gym && gym.id !== 'default') viewQuery = viewQuery.eq('gym_id', gym.id);
        if (canUseRawStatusFilter) viewQuery = viewQuery.eq('status', stFilter);

        if (sTerm && sTerm.trim() !== "") {
          const safe = sTerm.replace(/[%_]/g, "\\$&");
          viewQuery = viewQuery.or(`full_name.ilike.%${safe}%,email.ilike.%${safe}%,phone.ilike.%${safe}%`);
        }

        if (pkFilter && pkFilter !== 'all') {
          if (pkFilter === '__none__') viewQuery = viewQuery.is('package_name', null);
          else viewQuery = viewQuery.eq('package_name', pkFilter);
        }

        if (sortOrder === 'asc') {
          viewQuery = viewQuery.order('full_name', { ascending: true });
        } else if (sortOrder === 'desc') {
          viewQuery = viewQuery.order('full_name', { ascending: false });
        } else {
          viewQuery = viewQuery.order('days_left', { ascending: true });
        }

        const { data: viewData, error: viewErr } = await viewQuery;

        if (!viewErr && Array.isArray(viewData)) {
          setMembers(await enrichCouponMembershipRows(viewData || []));
          setIsLoading(false);
          setIsRefreshingMembers(false);
          return;
        }
      } catch (viewErr) {
        console.warn('users_with_membership_info query failed, falling back to user_combined_costs:', viewErr?.message || viewErr);
      }

      // Fallback to querying user_combined_costs
      let query: any = supabase
        .from("user_combined_costs")
        .select("*");

      if (gym && gym.id !== 'default') {
        query = query.eq('gym_id', gym.id);
      }

      if (canUseRawStatusFilter) {
        query = query.eq('status', stFilter);
      }

      if (sTerm && sTerm.trim() !== "") {
        const safe = sTerm.replace(/[%_]/g, "\\$&");
        query = query.or(`full_name.ilike.%${safe}%,email.ilike.%${safe}%,phone.ilike.%${safe}%`);
      }

      if (pkFilter && pkFilter !== 'all') {
        if (pkFilter === '__none__') query = query.is('package_name', null);
        else query = query.eq('package_name', pkFilter);
      }

      if (sortOrder === 'asc') {
        query = query.order('full_name', { ascending: true });
      } else if (sortOrder === 'desc') {
        query = query.order('full_name', { ascending: false });
      } else {
        query = query.order('days_left', { ascending: true });
      }

      const { data, error } = await query;

      if (error) {
        toast({
          title: "Error loading data",
          description: error.message,
          variant: "destructive"
        });
      } else {
        setMembers(await enrichCouponMembershipRows(data || []));
      }
    } catch (error: any) {
      toast({
        title: "Error loading data",
        description: `Unexpected error: ${error?.message || 'Unknown error'}`,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
      setIsRefreshingMembers(false);
    }
  };

   const loadTrainers = async () => {
    console.log('loadTrainers: Starting trainer fetch.');
    try {
      const trainersData = await fetchTrainers();
      console.log('loadTrainers: Trainers data received:', trainersData);
      setTrainers(trainersData);
    } catch (error) {
      console.error('loadTrainers: Error fetching trainers:', error);
      // Set empty array if fetch fails
      setTrainers([]);
      toast({
        title: "Error loading trainers",
        description: "Could not load trainer data. Please try refreshing the page.",
        variant: "destructive"
      });
    }
  };

  const fetchCounts = async () => {
    if (!gym || gym.id === 'default') return;
    try {
      const { count: usersCount, error: usersErr } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('gym_id', gym.id);
      if (!usersErr && typeof usersCount === 'number') setDbTotalCount(usersCount ?? 0);

      const nowIso = new Date().toISOString();

      // Prefer using the `users` table for counts so they match the Reports implementation
      // If the users query fails for some reason, fall back to the users_with_membership_info view.
      const futureIso = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
      try {
        // Total users
        const { count: usersCount, error: usersErr } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('gym_id', gym.id);
        if (!usersErr && typeof usersCount === 'number') setDbTotalCount(usersCount ?? 0);

        // Active users: membership_expiry > NOW()
        const { count: activeCnt } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('gym_id', gym.id)
          .gt('membership_expiry', nowIso);
        if (typeof activeCnt === 'number') setDbActiveCount(activeCnt ?? 0);

        // Expiring soon
        const { count: expCnt } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('gym_id', gym.id)
          .gt('membership_expiry', nowIso)
          .lte('membership_expiry', futureIso);
        if (typeof expCnt === 'number') setDbExpiringCount(expCnt ?? 0);

        // Expired
        const { count: expiredCnt } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('gym_id', gym.id)
          .lt('membership_expiry', nowIso);
        if (typeof expiredCnt === 'number') setDbExpiredCount(expiredCnt ?? 0);
      } catch (e) {
        console.warn('users table count queries failed, falling back to users_with_membership_info view:', e);

        // Fallback to view
        const { count: totalCntView, error: totalErr } = await supabase
          .from('users_with_membership_info')
          .select('*', { count: 'exact', head: true })
          .eq('gym_id', gym.id);
        if (!totalErr && typeof totalCntView === 'number') setDbTotalCount(totalCntView ?? 0);

        const { count: activeCntView } = await supabase
          .from('users_with_membership_info')
          .select('*', { count: 'exact', head: true })
          .eq('gym_id', gym.id)
          .gt('membership_expiry', nowIso);
        if (typeof activeCntView === 'number') setDbActiveCount(activeCntView ?? 0);

        const { count: expCntView } = await supabase
          .from('users_with_membership_info')
          .select('*', { count: 'exact', head: true })
          .eq('gym_id', gym.id)
          .gt('membership_expiry', nowIso)
          .lte('membership_expiry', futureIso);
        if (typeof expCntView === 'number') setDbExpiringCount(expCntView ?? 0);

        const { count: expiredCntView } = await supabase
          .from('users_with_membership_info')
          .select('*', { count: 'exact', head: true })
          .eq('gym_id', gym.id)
          .lt('membership_expiry', nowIso);
        if (typeof expiredCntView === 'number') setDbExpiredCount(expiredCntView ?? 0);
      }
    } catch (e) {
      console.error('fetchCounts error', e);
    }
  };

  useEffect(() => {
    
  const loadAllData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        fetchMembershipData({ showPageLoading: true }),
        loadTrainers(),
        fetchCounts()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  loadAllData();
}, []);
  

  // Computed values - Update all counts to use frontend logic
  const packageTypes = Array.from(new Set(members.map((m) => m.package_name).filter(Boolean))) as string[];
  packageTypes.sort();
  
  // Use DB-driven counts for accuracy (keeps Dashboard and Membership counts consistent)
  const [dbTotalCount, setDbTotalCount] = useState<number>(0);
  const [dbActiveCount, setDbActiveCount] = useState<number>(0);
  const [dbExpiringCount, setDbExpiringCount] = useState<number>(0);
  const [dbExpiredCount, setDbExpiredCount] = useState<number>(0);



  const isCouponUsedUp = (m: CouponMembershipInfo) =>
    Boolean(m.is_coupon) && typeof m.coupon_remaining_passes === 'number' && m.coupon_remaining_passes <= 0;

  const computeStatus = (m: CouponMembershipInfo) => {
    const st = (m.status ?? '').toLowerCase();
    if (typeof m.days_left === 'number') {
      if (m.days_left <= 0) return 'expired';
    }
    if (isCouponUsedUp(m)) return 'used_up';
    if (st === 'paused') return 'paused';
    if (st === 'inactive') return 'inactive';
    if (st === 'expired') return 'expired';
    return 'active';
  };

  const isExpiringMembership = (m: CouponMembershipInfo) => {
    if (m.is_coupon) {
      return computeStatus(m) === 'active' && (m.coupon_remaining_passes ?? m.days_left) <= 10;
    }

    return m.days_left <= 10 && m.days_left > 0;
  };

  const hasCouponMembers = members.some((member) => member.is_coupon);

  // Fallback client-side calculations kept for local UI. Coupon packages use client-side counts
  // because "used up" is derived from check-in history rather than membership_expiry alone.
  const allMembersCount = dbTotalCount ?? members.length;
  const expiringCount = hasCouponMembers ? members.filter(isExpiringMembership).length : dbExpiringCount ?? members.filter((m) => m.days_left <= 10 && m.days_left > 0).length;
  const expiredCount = hasCouponMembers ? members.filter((m) => computeStatus(m) === 'expired').length : dbExpiredCount ?? members.filter((m) => m.days_left <= 0).length;
  const activeCount = hasCouponMembers ? members.filter((m) => computeStatus(m) === 'active').length : dbActiveCount ?? members.filter((m) => m.days_left > 0 && (m.status ?? '').toLowerCase() !== 'paused').length;

  const filteredMembers = members.filter((member) => {
    const searchableEmail = isPlaceholderEmail(member.email) ? '' : member.email || '';
    const searchablePhone = isPlaceholderPhone(member.phone) ? '' : member.phone || '';
    const matchesSearch =
      searchTerm === "" ||
      (member.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      searchableEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      searchablePhone.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "all" || computeStatus(member) === statusFilter;
    const matchesPackage = packageFilter === "all" || (packageFilter === "__none__" ? !member.package_name : member.package_name === packageFilter);

    let matchesTab = true;
    if (activeTab === "all") matchesTab = true;
    if (activeTab === "active") matchesTab = computeStatus(member) === 'active';
    if (activeTab === "expiring") matchesTab = isExpiringMembership(member);
    if (activeTab === "expired") matchesTab = computeStatus(member) === 'expired';

    return matchesSearch && matchesStatus && matchesPackage && matchesTab;
  }).sort((a, b) => {
    if (sortOrder === 'asc') return a.full_name.localeCompare(b.full_name);
    if (sortOrder === 'desc') return b.full_name.localeCompare(a.full_name);
    return 0;
  });
  const canDeactivateOrDeleteMembers = staffRole !== null && staffRole !== 'receptionist';

  // Pagination (client-side slicing for all filters)
  const totalPages = Math.max(1, Math.ceil(filteredMembers.length / PAGE_SIZE));
  const paginatedMembers = filteredMembers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const visibleMembershipDateKeys = useMemo(() => {
    if (!useEthiopianCalendar) return [];

    return Array.from(new Set(
      paginatedMembers
        .flatMap(member => [
          toGregorianDateKey(member.created_at),
          toGregorianDateKey(member.membership_expiry),
        ])
        .filter((dateKey): dateKey is string => Boolean(dateKey))
    ));
  }, [paginatedMembers, useEthiopianCalendar]);

  useEffect(() => {
    if (!useEthiopianCalendar || visibleMembershipDateKeys.length === 0) return;

    const missingDateKeys = visibleMembershipDateKeys.filter(dateKey => !ethioallDateMap[dateKey]);
    if (missingDateKeys.length === 0) return;

    let cancelled = false;

    convertGregorianDatesWithEthioall(missingDateKeys)
      .then((convertedDates) => {
        if (cancelled || Object.keys(convertedDates).length === 0) return;
        setEthioallDateMap(previousMap => ({ ...previousMap, ...convertedDates }));
      })
      .catch((error) => {
        console.warn('Ethioall date conversion failed; using local Ethiopian calendar fallback.', error);
      });

    return () => {
      cancelled = true;
    };
  }, [ethioallDateMap, useEthiopianCalendar, visibleMembershipDateKeys]);

  // Reset to first page whenever filters/search/sort change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, packageFilter, activeTab, sortOrder, members.length]);

  // When filters/search/sort change, perform a debounced server-side fetch to keep results accurate
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchMembershipData({ searchTerm, statusFilter, packageFilter, activeTab, showPageLoading: false });
      // refresh counts to reflect database state
      fetchCounts();
    }, 350);

    return () => clearTimeout(timer);
  }, [searchTerm, statusFilter, packageFilter, activeTab, sortOrder, gym?.id]);

  const handleSort = () => {
    if (sortOrder === 'none') {
      setSortOrder('asc');
    } else if (sortOrder === 'asc') {
      setSortOrder('desc');
    } else {
      setSortOrder('none');
    }
  };

  /* Check freeze eligibility
  useEffect(() => {
    const checkFreezeEligibility = async () => {
      const results: Record<string, boolean> = {};
      for (const member of filteredMembers) {
        if (member.status === 'active') {
          try {
            const { data } = await supabase.rpc('can_freeze_membership', { user_id: member.user_id });
            results[member.user_id] = !!data;
          } catch {
            results[member.user_id] = false;
          }
        } else {
          results[member.user_id] = false;
        }
      }
      setCanFreeze(results);
    };

    if (filteredMembers.length > 0) {
      checkFreezeEligibility();
    }
  }, [filteredMembers]);*/

  // Fetch available packages for upgrade
  const fetchPackages = async () => {
    if (!gym || gym.id === 'default') return;
    try {
      const { data, error } = await supabase
        .from('packages')
        .select('id, name, price, duration_value, duration_unit')
        .eq('gym_id', gym.id)
        .order('price', { ascending: true });
      
      if (!error) {
        setAvailablePackages((data || []).map((pkg: any) => ({
          id: pkg.id,
          name: pkg.name,
          price: Number(pkg.price ?? 0),
          duration_value: Number(pkg.duration_value ?? 0),
          duration_unit: pkg.duration_unit ?? 'days',
        })));
      }
    } catch (error) {
      console.error('Error fetching packages:', error);
    }
  };

  // Action handlers
  const handleNotify = (member: MembershipInfo) => {
    toast({
      title: "Feature Coming Soon",
      description: "SMS notifications are currently under development. This feature will be available soon!",
      variant: "default"
    });
  };

  const refreshMembershipList = async () => {
    await Promise.all([
      fetchMembershipData({ searchTerm, statusFilter, packageFilter, activeTab, showPageLoading: false }),
      fetchCounts(),
    ]);
  };

  const openDeleteMemberModal = (member: MembershipInfo) => {
    if (staffRole === 'receptionist') {
      toast({
        title: "Action not allowed",
        description: "Receptionists cannot delete members.",
        variant: "destructive"
      });
      return;
    }

    setDeleteMember(member);
    setDeleteDialog(true);
    setOpenDropdown(null);
  };

  const handleDeleteMember = async () => {
    if (!deleteMember) return;
    if (staffRole === 'receptionist') {
      toast({
        title: "Action not allowed",
        description: "Receptionists cannot delete members.",
        variant: "destructive"
      });
      setDeleteDialog(false);
      setDeleteMember(null);
      return;
    }

    const member = deleteMember;

    setProcessingAction(`delete-${member.user_id}`);

    try {
      const { error: rpcError } = await supabase.rpc('delete_member_completely', {
        p_user_id: member.user_id,
      });

      if (rpcError) {
        const functionMissing = /function .*delete_member_completely|could not find the function|schema cache/i.test(rpcError.message || '');
        if (!functionMissing) throw rpcError;

        console.warn('delete_member_completely RPC is not deployed yet; falling back to public table cleanup.', rpcError);
        const relatedDeletes = [
          supabase.from('client_checkins').delete().eq('user_id', member.user_id),
          supabase.from('one_to_one_coaching').delete().eq('user_id', member.user_id),
          supabase.from('payments').delete().eq('user_id', member.user_id),
        ];

        for (const deletePromise of relatedDeletes) {
          const { error } = await deletePromise;
          if (error) throw error;
        }

        const { error: userDeleteError } = await supabase
          .from('users')
          .delete()
          .eq('id', member.user_id);

        if (userDeleteError) throw userDeleteError;
      }

      setMembers(previous => previous.filter(existing => existing.user_id !== member.user_id));
      await fetchCounts();

      toast({
        title: "Member deleted",
        description: `${member.full_name} has been removed from CoreFit.`,
      });
      setDeleteDialog(false);
      setDeleteMember(null);
    } catch (err: any) {
      console.error("Failed to delete member:", err);
      toast({
        title: "Delete failed",
        description: err?.message || `Could not delete ${member.full_name}.`,
        variant: "destructive",
      });
    } finally {
      setProcessingAction(null);
    }
  };

  const handleSendNotification = async () => {
    if (!notifTitle.trim() || !notifMessage.trim()) {
      toast({ title: "Fill all fields", description: "Title and message are required.", variant: "destructive" });
      return;
    }
    setIsSending(true);
    // Simulate notification send
    setTimeout(() => {
      setIsSending(false);
      setNotifyDialog(false);
      setNotifyMember(null);
      setNotifTitle("");
      setNotifMessage("");
      toast({ title: "Notification sent", description: "Your notification has been sent successfully." });
    }, 1200);
  };

  const handleRenew = async (member: MembershipInfo) => {
  setProcessingAction(`renew-${member.user_id}`);
  setOpenDropdown(null);

  try {
    const { error } = await supabase.rpc('renew_membership', {
      p_package_id: member.package_id,
      p_user_id:    member.user_id,
    });

    if (error) {
      toast({
        title: "Renewal failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      // Record the renewal payment
      const pkg = availablePackages.find(p => p.id === member.package_id);
      if (pkg && pkg.price > 0 && gym) {
        try {
          await recordPayment({
            user_id: member.user_id,
            gym_id: gym.id,
            package_id: member.package_id,
            amount: pkg.price,
            payment_method: 'admin',
            remarks: `Renewal: ${pkg.name}`,
          });
        } catch (payErr) {
          console.warn('Payment recording failed (non-blocking):', payErr);
        }
      }
      toast({
        title: "Membership renewed",
        description: `${member.full_name}'s membership has been renewed successfully.`,
      });
      await fetchMembershipData();
      await fetchCounts();
    }
  } catch (err: any) {
    toast({
      title: "Renewal failed",
      description: `Unexpected error: ${err.message || 'Unknown error'}`,
      variant: "destructive",
    });
  } finally {
    setProcessingAction(null);
  }
};


  

// 2) Unfreeze immediately (apply all pending freeze days and set status = active)
const handleUnfreeze = async (member: MembershipInfo) => {
  setProcessingAction(`unfreeze-${member.user_id}`);
  try {
    const { error } = await supabase.rpc('unfreeze_membership', {
      p_user_id: member.user_id,
    });
    if (error) {
      throw error;
    }
    toast({
      title: 'Membership Unfrozen',
      description: `${member.full_name} is now active again.`,
    });
    await fetchMembershipData();
    await fetchCounts();
  } catch (error: any) {
    toast({
      title: 'Unfreeze Failed',
      description: error.message || 'Unknown error',
      variant: 'destructive',
    });
  } finally {
    setProcessingAction(null);
  }
};


// keep your existing handleUpgrade or replace with this exact one
const handleUpgrade = (member: MembershipInfo) => {
  setUpgradeMember(member);
  setSelectedPackage("");
  setUpgradeDialog(true);
  setOpenDropdown(null);
  fetchPackages();
};

const handleUpgradeSubmit = async () => {
  if (!upgradeMember || !selectedPackage) {
    toast({
      title: "Select a package",
      description: "Please select a package to upgrade to.",
      variant: "destructive",
    });
    return;
  }

  setProcessingAction(`upgrade-${upgradeMember.user_id}`);

  try {
    // NOTE: parameter names must match the PostgreSQL function signature
    const { data, error } = await supabase.rpc("upgrade_membership", {
      p_user_id: upgradeMember.user_id,
      p_new_package_id: selectedPackage,
    });

    if (error) {
      toast({
        title: "Upgrade failed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    // rpc that RETURNS TABLE will usually return an array of rows
    const result = Array.isArray(data) && data.length > 0 ? data[0] : data;

    // Record the upgrade payment
    const upgradePkg = availablePackages.find(p => p.id === selectedPackage);
    if (upgradePkg && upgradePkg.price > 0 && gym) {
      try {
        await recordPayment({
          user_id: upgradeMember.user_id,
          gym_id: gym.id,
          package_id: selectedPackage,
          amount: upgradePkg.price,
          payment_method: 'admin',
          remarks: `Upgrade: ${upgradePkg.name}`,
        });
      } catch (payErr) {
        console.warn('Payment recording failed (non-blocking):', payErr);
      }
    }

    // Show success toast — include returned values if available
    toast({
      title: "Package upgraded",
      description: result
        ? `${upgradeMember.full_name}'s package upgraded. New expiry: ${formatMembershipDate(result.new_expiry_date)}.`
        : `${upgradeMember.full_name}'s package has been upgraded successfully.`,
    });

    setUpgradeDialog(false);
    setSelectedPackage("");
    setUpgradeMember(null);

    // refresh list to reflect updated expiry/status/days_left
    await fetchMembershipData();
    await fetchCounts();  } catch (err: any) {
    toast({
      title: "Upgrade failed",
      description: `Unexpected error: ${err?.message ?? "Unknown error"}`,
      variant: "destructive",
    });
  } finally {
    setProcessingAction(null);
  }
};


  // New coaching handlers
  const handleCoaching = (member: MembershipInfo) => {
    setCoachingMember(member);
    setCoachingDialog(true);
    setOpenDropdown(null);
  };

  // Updated handleCoachingSubmit to match the new CoachingSessionData interface
  const handleCoachingSubmit = (coachingData: CoachingSessionData) => {
    console.log('handleCoachingSubmit: Submitting coaching data:', coachingData);
    setProcessingAction(`coaching-${coachingData.user_id}`);
    
    const insertCoaching = async () => {
      try {
        const { error } = await supabase
          .from('one_to_one_coaching')
          .insert([{
            user_id: coachingData.user_id,
            trainer_id: coachingData.trainer_id,
            hourly_rate: coachingData.hourly_rate,
            days_per_week: coachingData.days_per_week,
            hours_per_session: coachingData.hours_per_session,
            start_date: coachingData.start_date,
            end_date: coachingData.end_date,
            status: coachingData.status || 'active',
            gym_id: gym?.id || null // ensure gym association so Dashboard queries can filter by gym
          }]);

        if (error) {
          console.error('handleCoachingSubmit: Supabase insert error:', error);
          toast({
            title: "Coaching setup failed",
            description: error.message,
            variant: "destructive"
          });
        } else {
          console.log('handleCoachingSubmit: Coaching setup successful.');
          toast({
            title: "Coaching setup successful",
            description: `One-to-one coaching has been set up for ${coachingMember?.full_name}.`
          });
          setCoachingDialog(false);
          setCoachingMember(null);
          await fetchMembershipData(); // Refresh to show updated data
          await fetchCounts();
        }
      } catch (error: any) {
        console.error('handleCoachingSubmit: Unexpected error during insert:', error);
        toast({
          title: "Coaching setup failed",
          description: `Unexpected error: ${error?.message || 'Unknown error'}`,
          variant: "destructive"
        });
      } finally {
        console.log('handleCoachingSubmit: Setting processingAction to null.');
        setProcessingAction(null);
      }
    };

    insertCoaching();
  };


  // Loading state
  if (gymLoading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-64 mb-4"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-32 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <DynamicHeader onMenuClick={() => setSidebarOpen(true)} />
          <main className="flex-1 flex items-center justify-center">
            <div className="animate-pulse text-center text-gray-500">
              Loading membership data for {gym?.name || 'gym'}...
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <DynamicHeader onMenuClick={() => setSidebarOpen(true)} />
        
        <main className="flex-1 overflow-x-hidden overflow-y-auto">
          <div className="animate-fade-in bg-white min-h-full px-0 md:px-8 py-8">
            <div className="max-w-7xl mx-auto">
              {/* Header with dynamic styling */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
                <div>
                  <h2 
                    className="text-3xl font-bold tracking-tight"
                    style={{ color: dynamicStyles.primaryColor }}
                  >
                    Membership Management
                  </h2>
                  <p className="text-gray-500 mt-1">
                    Manage member subscriptions for {gym?.name || 'your gym'}
                  </p>
                </div>
                <ExportButton filteredMembers={filteredMembers} />
              </div>
              
              {/* Stats Cards with dynamic colors */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div 
                  className="rounded-lg p-0.5"
                  style={{ backgroundColor: `${dynamicStyles.primaryColor}10` }}
                >
                  <StatsCard
                    title="All Members"
                    value={allMembersCount}
                    description="Total memberships"
                    icon={<Users className="h-4 w-4" />}
                  />
                </div>
                <div 
                  className="rounded-lg p-0.5"
                  style={{ backgroundColor: `${dynamicStyles.primaryColor}10` }}
                >
                  <StatsCard
                    title="Active"
                    value={activeCount}
                    description="Currently active memberships"
                    icon={<CheckCircle className="h-4 w-4" />}
                    iconColor="text-green-600"
                  />
                </div>
                <div 
                  className="rounded-lg p-0.5"
                  style={{ backgroundColor: `${dynamicStyles.accentColor}10` }}
                >
                  <StatsCard
                    title="Expiring Soon"
                    value={expiringCount}
                    description="Within 10 days"
                    icon={<Clock className="h-4 w-4" />}
                    iconColor="text-yellow-600"
                  />
                </div>
                <div className="rounded-lg p-0.5 bg-red-50">
                  <StatsCard
                    title="Expired"
                    value={expiredCount}
                    description="Require attention"
                    icon={<AlertTriangle className="h-4 w-4" />}
                    iconColor="text-red-600"
                  />
                </div>
              </div>
              
              {/* Search and Filters */}
              <SearchFilters
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                packageFilter={packageFilter}
                setPackageFilter={setPackageFilter}
                packageTypes={packageTypes}
                sortOrder={sortOrder}
                onSort={handleSort}
              />

              <div className="mb-4 flex flex-col gap-2 rounded-lg border bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-50 text-blue-700">
                    <CalendarDays className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">Membership date display</div>
                    <div className="text-xs text-gray-500">
                      {useEthiopianCalendar
                        ? "Showing membership dates in Ethiopian calendar. Stored dates remain Gregorian."
                        : "Showing membership dates in Gregorian calendar."}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm ${!useEthiopianCalendar ? "font-semibold text-gray-900" : "text-gray-500"}`}>
                    Gregorian
                  </span>
                  <Switch
                    checked={useEthiopianCalendar}
                    onCheckedChange={handleCalendarToggle}
                    aria-label="Toggle Ethiopian calendar display"
                  />
                  <span className={`text-sm ${useEthiopianCalendar ? "font-semibold text-gray-900" : "text-gray-500"}`}>
                    Ethiopian
                  </span>
                </div>
              </div>
              
              {/* Tabs */}
              <MembershipTabs
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                totalMembers={allMembersCount}
                activeCount={activeCount}
                expiringCount={expiringCount}
                expiredCount={expiredCount}
              />
              
              {/* Member List */}
              <div>
                {isRefreshingMembers && (
                  <div className="mb-3 text-sm text-gray-500">
                    Refreshing results...
                  </div>
                )}
                {filteredMembers.length === 0 ? (
                  <div className="text-center text-gray-400 py-16">
                    No members found for {gym?.name || 'this gym'}
                  </div>
                ) : (
                  paginatedMembers.map((member) => (
                    <MemberCard
                      key={member.user_id}
                      member={member}
                      statusColorMap={statusColors}
                      openDropdown={openDropdown}
                      setOpenDropdown={setOpenDropdown}
                      canFreeze={canFreeze}
                      processingAction={processingAction}
                      onNotify={handleNotify}
                      onFreeze={openFreeze}
                      onExtendFreeze={openExtend}
                      onUnfreeze={handleUnfreeze}
                      onRenew={handleRenew}
                      onUpgrade={handleUpgrade}
                      onCoaching={handleCoaching}
                      onDelete={openDeleteMemberModal}
                      onRefresh={refreshMembershipList}
                      formatDate={formatMembershipDate}
                      canDeactivateOrDelete={canDeactivateOrDeleteMembers}
                    />
                  ))
                )}

                {/* Pagination controls */}
                {filteredMembers.length > PAGE_SIZE && (
                  <div className="mt-6 flex items-center justify-between">
                    <div className="text-sm text-gray-500">
                      Showing {(currentPage - 1) * PAGE_SIZE + 1} - {Math.min(currentPage * PAGE_SIZE, filteredMembers.length)} of {filteredMembers.length}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className={`px-3 py-1 rounded border ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'}`}
                      >
                        Previous
                      </button>
                      <span className="text-sm text-gray-600">Page {currentPage} / {totalPages}</span>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className={`px-3 py-1 rounded border ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'}`}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
      
      {/* Modals */}
      <NotificationModal
        isOpen={notifyDialog}
        onClose={() => {
          setNotifyDialog(false);
          setNotifyMember(null);
          setNotifTitle("");
          setNotifMessage("");
        }}
        member={notifyMember}
        title={notifTitle}
        setTitle={setNotifTitle}
        message={notifMessage}
        setMessage={setNotifMessage}
        onSend={handleSendNotification}
        isSending={isSending}
      />
      <FreezeActionModal
        isOpen={freezeModalOpen}
        mode={freezeMode}
        userId={freezeMember?.user_id || ''}
        userName={freezeMember?.full_name || ''}
        defaultDays={freezeMode === 'extend' ? /* optionally compute remaining freeze days */ 1 : 1}
        onClose={() => setFreezeModalOpen(false)}
        onConfirm={handleFreezeConfirm}
        isProcessing={!!processingAction?.startsWith(freezeMode)}
      />
      
      <UpgradeModal
        isOpen={upgradeDialog}
        onClose={() => {
          setUpgradeDialog(false);
          setSelectedPackage("");
          setUpgradeMember(null);
        }}
        member={upgradeMember}
        availablePackages={availablePackages}
        selectedPackage={selectedPackage}
        setSelectedPackage={setSelectedPackage}
        onSubmit={handleUpgradeSubmit}
        isProcessing={processingAction === `upgrade-${upgradeMember?.user_id}`}
      />

      <SimpleModal
        isOpen={deleteDialog}
        onClose={() => {
          if (processingAction === `delete-${deleteMember?.user_id}`) return;
          setDeleteDialog(false);
          setDeleteMember(null);
        }}
        title="Delete Member"
        icon={<Trash2 className="h-5 w-5 text-red-600" />}
      >
        <div className="space-y-5">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
              <div>
                <p className="font-semibold text-red-900">
                  Permanently delete {deleteMember?.full_name || "this member"}?
                </p>
                <p className="mt-2 text-sm text-red-800">
                  This removes the member profile, check-in history, payments, and coaching assignments from CoreFit. This cannot be undone.
                </p>
              </div>
            </div>
          </div>

          {deleteMember && (
            <div className="rounded-md border bg-gray-50 p-3 text-sm text-gray-700">
              <div><strong>Name:</strong> {deleteMember.full_name}</div>
              <div><strong>Email:</strong> {isPlaceholderEmail(deleteMember.email) ? "-" : deleteMember.email || "-"}</div>
              <div><strong>Phone:</strong> {isPlaceholderPhone(deleteMember.phone) ? "-" : deleteMember.phone || "-"}</div>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={processingAction === `delete-${deleteMember?.user_id}`}
              onClick={() => {
                setDeleteDialog(false);
                setDeleteMember(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={!deleteMember || processingAction === `delete-${deleteMember?.user_id}`}
              onClick={handleDeleteMember}
            >
              {processingAction === `delete-${deleteMember?.user_id}` ? "Deleting..." : "Delete Member"}
            </Button>
          </div>
        </div>
      </SimpleModal>

      {/* New Coaching Modal */}
      <OneToOneCoachingModal
        isOpen={coachingDialog}
        onClose={() => {
          setCoachingDialog(false);
          setCoachingMember(null);
        }}
        member={coachingMember}
        trainers={trainers}
        onSubmit={handleCoachingSubmit}
        isProcessing={processingAction === `coaching-${coachingMember?.user_id}`}
      />
    </div>
  );
}

