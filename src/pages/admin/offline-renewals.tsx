import React, { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Menu, Plus, RefreshCw, Search, Snowflake, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/lib/supabaseClient';
import { recordPayment } from '@/lib/gymApi';
import { createPlaceholderEmail, createPlaceholderPhone, isPlaceholderEmail, isPlaceholderPhone } from '@/lib/placeholderEmail';
import { SuperAdSidebar } from '@/pages/admin/superAdSidebar';
import { OfflineRenewalModal, OfflineRenewalValues, type OfflineRenewalPackage } from '@/components/Modals/OfflineRenewalModal';
import { SimpleModal } from '@/components/SimpleModal';
import type { MembershipInfo, MembershipStatus } from '@/types/memberships';

type GymOption = {
  id: string;
  name: string;
  status?: string | null;
};

type AdminOfflinePackage = OfflineRenewalPackage & {
  requires_trainer?: boolean;
};

type TrainerOption = {
  id: string;
  full_name: string;
};

type OfflineRegistrationValues = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  gender: string;
  package_id: string;
  periods_paid: string;
  payment_date: string;
  amount: string;
  payment_method: string;
  remarks: string;
  emergency_name: string;
  emergency_phone: string;
  relationship: string;
  fitness_goal: string;
  trainer_id: string;
  password: string;
};

type OfflineFreezeValues = {
  freeze_start_date: string;
  freeze_days: string;
  remarks: string;
};

const allowedDurationUnits = ['days', 'weeks', 'months', 'years'] as const;

const emptyRegistrationValues = (): OfflineRegistrationValues => ({
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  date_of_birth: '',
  gender: '',
  package_id: '',
  periods_paid: '1',
  payment_date: new Date().toISOString().slice(0, 10),
  amount: '',
  payment_method: 'offline',
  remarks: '',
  emergency_name: '',
  emergency_phone: '',
  relationship: '',
  fitness_goal: '',
  trainer_id: '',
  password: '',
});

const emptyFreezeValues = (): OfflineFreezeValues => ({
  freeze_start_date: new Date().toISOString().slice(0, 10),
  freeze_days: '1',
  remarks: '',
});

const addPackageDuration = (date: Date, pkg: OfflineRenewalPackage, periods = 1) => {
  const next = new Date(date);
  const durationValue = pkg.duration_value * periods;
  switch (pkg.duration_unit) {
    case 'days':
      next.setDate(next.getDate() + durationValue);
      break;
    case 'weeks':
      next.setDate(next.getDate() + durationValue * 7);
      break;
    case 'months':
      next.setMonth(next.getMonth() + durationValue);
      break;
    case 'years':
      next.setFullYear(next.getFullYear() + durationValue);
      break;
  }
  return next;
};

const dateInputToAddisIso = (dateValue: string) => `${dateValue}T00:00:00+03:00`;

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const toMembershipRow = (row: any): MembershipInfo => {
  const expiry = row.membership_expiry ?? null;
  const daysLeft = typeof row.days_left === 'number'
    ? row.days_left
    : expiry
      ? Math.ceil((new Date(expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : Number.MAX_SAFE_INTEGER;
  const rawUnit = String(row.duration_unit ?? row.packages?.duration_unit ?? 'days').toLowerCase();
  const durationUnit = allowedDurationUnits.includes(rawUnit as any) ? rawUnit : 'days';

  return {
    user_id: row.user_id ?? row.id,
    full_name: (row.full_name ?? `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim()) || 'Unnamed member',
    email: row.email ?? '',
    phone: row.phone ?? '',
    package_id: row.package_id ?? row.packages?.id ?? '',
    package_name: row.package_name ?? row.packages?.name ?? 'No package',
    created_at: row.created_at ?? '',
    membership_expiry: expiry ?? '',
    status: (row.status ?? 'active') as MembershipStatus,
    days_left: daysLeft,
    duration_unit: durationUnit as MembershipInfo['duration_unit'],
    duration_value: Number(row.duration_value ?? row.packages?.duration_value ?? 0),
  };
};

const getInitials = (name: string) =>
  name.split(' ').filter(Boolean).map(part => part[0]).join('').slice(0, 2).toUpperCase() || 'M';

const formatDate = (value: string) => {
  if (!value || Number.isNaN(Date.parse(value))) return '-';
  return new Date(value).toLocaleDateString();
};

export default function AdminOfflineRenewals() {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [gyms, setGyms] = useState<GymOption[]>([]);
  const [selectedGymId, setSelectedGymId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [members, setMembers] = useState<MembershipInfo[]>([]);
  const [packages, setPackages] = useState<AdminOfflinePackage[]>([]);
  const [trainers, setTrainers] = useState<TrainerOption[]>([]);
  const [loadingGyms, setLoadingGyms] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [selectedMember, setSelectedMember] = useState<MembershipInfo | null>(null);
  const [renewalOpen, setRenewalOpen] = useState(false);
  const [freezeOpen, setFreezeOpen] = useState(false);
  const [freezeMember, setFreezeMember] = useState<MembershipInfo | null>(null);
  const [freezeValues, setFreezeValues] = useState<OfflineFreezeValues>(() => emptyFreezeValues());
  const [processingMemberId, setProcessingMemberId] = useState<string | null>(null);
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [registrationValues, setRegistrationValues] = useState<OfflineRegistrationValues>(() => emptyRegistrationValues());
  const [creatingUser, setCreatingUser] = useState(false);

  const selectedGym = useMemo(
    () => gyms.find(gym => gym.id === selectedGymId) ?? null,
    [gyms, selectedGymId],
  );

  useEffect(() => {
    fetchGyms();
  }, []);

  useEffect(() => {
    if (!selectedGymId) {
      setMembers([]);
      setPackages([]);
      setTrainers([]);
      return;
    }

    fetchPackages(selectedGymId);
    fetchTrainers(selectedGymId);
    const timeout = window.setTimeout(() => {
      fetchMembers(selectedGymId, searchTerm);
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [selectedGymId, searchTerm]);

  const fetchGyms = async () => {
    setLoadingGyms(true);
    try {
      const { data, error } = await supabase
        .from('gyms')
        .select('id, name, status')
        .order('name', { ascending: true });

      if (error) throw error;
      setGyms(data ?? []);
    } catch (err: any) {
      toast({
        title: 'Could not load gyms',
        description: err?.message || 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoadingGyms(false);
    }
  };

  const fetchPackages = async (gymId: string) => {
    try {
      const { data, error } = await supabase
        .from('packages')
        .select('id, name, price, duration_value, duration_unit, requires_trainer')
        .eq('gym_id', gymId)
        .eq('archived', false)
        .order('name', { ascending: true });

      if (error) throw error;
      setPackages((data ?? []).map((pkg: any) => ({
        id: pkg.id,
        name: pkg.name,
        price: Number(pkg.price ?? 0),
        duration_value: Number(pkg.duration_value ?? 0),
        duration_unit: allowedDurationUnits.includes(String(pkg.duration_unit).toLowerCase() as any)
          ? String(pkg.duration_unit).toLowerCase() as OfflineRenewalPackage['duration_unit']
          : 'days',
        requires_trainer: Boolean(pkg.requires_trainer),
      })));
    } catch (err: any) {
      toast({
        title: 'Could not load packages',
        description: err?.message || 'Unknown error',
        variant: 'destructive',
      });
      setPackages([]);
    }
  };

  const fetchTrainers = async (gymId: string) => {
    try {
      const { data: trainerRole, error: roleError } = await supabase
        .from('roles')
        .select('id')
        .eq('name', 'trainer')
        .maybeSingle();

      if (roleError) throw roleError;
      if (!trainerRole?.id) {
        setTrainers([]);
        return;
      }

      const { data, error } = await supabase
        .from('staff')
        .select('id, first_name, last_name, full_name')
        .eq('gym_id', gymId)
        .eq('role_id', trainerRole.id)
        .eq('is_active', true)
        .order('first_name', { ascending: true });

      if (error) throw error;
      setTrainers((data ?? []).map((trainer: any) => ({
        id: trainer.id,
        full_name: trainer.full_name || `${trainer.first_name ?? ''} ${trainer.last_name ?? ''}`.trim() || 'Unnamed trainer',
      })));
    } catch (err) {
      console.warn('Could not load trainers for offline registration:', err);
      setTrainers([]);
    }
  };

  const fetchMembers = async (gymId: string, term: string) => {
    setLoadingMembers(true);
    const safeTerm = term.trim().replace(/[%_]/g, '\\$&');

    try {
      let query: any = supabase
        .from('users_with_membership_info')
        .select('*')
        .eq('gym_id', gymId)
        .order('full_name', { ascending: true })
        .limit(100);

      if (safeTerm) {
        query = query.or(`full_name.ilike.%${safeTerm}%,email.ilike.%${safeTerm}%,phone.ilike.%${safeTerm}%`);
      }

      const { data, error } = await query;

      if (!error && Array.isArray(data)) {
        setMembers(data.map(toMembershipRow));
        return;
      }

      console.warn('users_with_membership_info failed for admin offline renewals, falling back to users:', error?.message || error);

      let fallbackQuery: any = supabase
        .from('users')
        .select('id, first_name, last_name, full_name, email, phone, status, created_at, membership_expiry, package_id, packages(id, name, duration_value, duration_unit)')
        .eq('gym_id', gymId)
        .order('full_name', { ascending: true })
        .limit(100);

      if (safeTerm) {
        fallbackQuery = fallbackQuery.or(`full_name.ilike.%${safeTerm}%,email.ilike.%${safeTerm}%,phone.ilike.%${safeTerm}%`);
      }

      const { data: fallbackData, error: fallbackError } = await fallbackQuery;
      if (fallbackError) throw fallbackError;
      setMembers((fallbackData ?? []).map(toMembershipRow));
    } catch (err: any) {
      toast({
        title: 'Could not load members',
        description: err?.message || 'Unknown error',
        variant: 'destructive',
      });
      setMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  };

  const openRenewal = (member: MembershipInfo) => {
    setSelectedMember(member);
    setRenewalOpen(true);
  };

  const openFreeze = (member: MembershipInfo) => {
    setFreezeMember(member);
    setFreezeValues(emptyFreezeValues());
    setFreezeOpen(true);
  };

  const freezeDaysNumber = Number(freezeValues.freeze_days);
  const freezePreview = useMemo(() => {
    if (!freezeMember || !freezeValues.freeze_start_date) return null;
    if (!Number.isInteger(freezeDaysNumber) || freezeDaysNumber <= 0) return null;
    if (!freezeMember.membership_expiry || Number.isNaN(Date.parse(freezeMember.membership_expiry))) return null;

    const startDate = new Date(dateInputToAddisIso(freezeValues.freeze_start_date));
    const currentExpiry = new Date(freezeMember.membership_expiry);
    return {
      freezeEndDate: addDays(startDate, freezeDaysNumber),
      newExpiryDate: addDays(currentExpiry, freezeDaysNumber),
    };
  }, [freezeDaysNumber, freezeMember, freezeValues.freeze_start_date]);

  const updateFreezeValue = (field: keyof OfflineFreezeValues, value: string) => {
    setFreezeValues(previous => ({ ...previous, [field]: value }));
  };

  const handleFreezeSubmit = async () => {
    if (!freezeMember) return;

    const freezeDays = Number(freezeValues.freeze_days);
    if (!freezeValues.freeze_start_date) {
      toast({
        title: 'Missing freeze date',
        description: 'Please enter the real freeze start date.',
        variant: 'destructive',
      });
      return;
    }

    if (!Number.isInteger(freezeDays) || freezeDays <= 0 || freezeDays > 365) {
      toast({
        title: 'Invalid freeze days',
        description: 'Freeze days must be a whole number between 1 and 365.',
        variant: 'destructive',
      });
      return;
    }

    setProcessingMemberId(freezeMember.user_id);

    try {
      const { data, error } = await supabase.rpc('record_offline_freeze', {
        p_user_id: freezeMember.user_id,
        p_freeze_start_date: dateInputToAddisIso(freezeValues.freeze_start_date),
        p_freeze_days: freezeDays,
        p_remarks: freezeValues.remarks.trim() || null,
      });

      if (error) throw error;

      const result = Array.isArray(data) && data.length > 0 ? data[0] : data;
      toast({
        title: 'Offline freeze recorded',
        description: result?.new_expiry_date
          ? `${freezeMember.full_name}'s new expiry is ${new Date(result.new_expiry_date).toLocaleDateString()}.`
          : `${freezeMember.full_name}'s freeze was recorded.`,
      });

      setFreezeOpen(false);
      setFreezeMember(null);
      setFreezeValues(emptyFreezeValues());
      await fetchMembers(selectedGymId, searchTerm);
    } catch (err: any) {
      toast({
        title: 'Offline freeze failed',
        description: err?.message || 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setProcessingMemberId(null);
    }
  };

  const handleRenewalSubmit = async (values: OfflineRenewalValues) => {
    if (!selectedMember) return;
    setProcessingMemberId(selectedMember.user_id);

    try {
      const { data, error } = await supabase.rpc('record_offline_renewal', {
        p_user_id: selectedMember.user_id,
        p_package_id: values.packageId,
        p_payment_date: values.paymentDate,
        p_periods_paid: values.periodsPaid,
        p_amount: values.amount,
        p_payment_method: values.paymentMethod,
        p_remarks: values.remarks || null,
      });

      if (error) throw error;

      const result = Array.isArray(data) && data.length > 0 ? data[0] : data;
      toast({
        title: 'Offline renewal recorded',
        description: result?.new_expiry_date
          ? `${selectedMember.full_name}'s new expiry is ${new Date(result.new_expiry_date).toLocaleDateString()}.`
          : `${selectedMember.full_name}'s renewal was recorded.`,
      });

      setRenewalOpen(false);
      setSelectedMember(null);
      await fetchMembers(selectedGymId, searchTerm);
    } catch (err: any) {
      toast({
        title: 'Offline renewal failed',
        description: err?.message || 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setProcessingMemberId(null);
    }
  };

  const selectedRegistrationPackage = packages.find(pkg => pkg.id === registrationValues.package_id) ?? null;
  const registrationPeriodsPaid = Number(registrationValues.periods_paid || 1);
  const registrationExpiryPreview = useMemo(() => {
    if (!selectedRegistrationPackage || !registrationValues.payment_date) return null;
    if (!Number.isInteger(registrationPeriodsPaid) || registrationPeriodsPaid < 1) return null;
    return addPackageDuration(new Date(dateInputToAddisIso(registrationValues.payment_date)), selectedRegistrationPackage, registrationPeriodsPaid);
  }, [registrationValues.payment_date, registrationPeriodsPaid, selectedRegistrationPackage]);

  const updateRegistrationValue = (field: keyof OfflineRegistrationValues, value: string) => {
    setRegistrationValues(previous => {
      const next = { ...previous, [field]: value };
      if (field === 'package_id') {
        const pkg = packages.find(packageOption => packageOption.id === value);
        const periods = Number(next.periods_paid || 1);
        next.amount = pkg && Number.isInteger(periods) && periods > 0 ? String(Number(pkg.price ?? 0) * periods) : next.amount;
        if (!pkg?.requires_trainer) next.trainer_id = '';
      }
      if (field === 'periods_paid') {
        const pkg = packages.find(packageOption => packageOption.id === next.package_id);
        const periods = Number(value || 1);
        if (pkg && Number.isInteger(periods) && periods > 0) {
          next.amount = String(Number(pkg.price ?? 0) * periods);
        }
      }
      return next;
    });
  };

  const openRegistration = () => {
    const defaultPackage = packages[0] ?? null;
    setRegistrationValues({
      ...emptyRegistrationValues(),
      package_id: defaultPackage?.id ?? '',
      amount: defaultPackage ? String(defaultPackage.price ?? 0) : '',
    });
    setRegistrationOpen(true);
  };

  const handleCreateOfflineUser = async () => {
    if (!selectedGymId || !selectedGym) return;

    const values = registrationValues;
    const selectedPackage = packages.find(pkg => pkg.id === values.package_id) ?? null;
    const requiredFields = [
      values.first_name.trim(),
      values.last_name.trim(),
      values.gender,
      values.package_id,
      values.payment_date,
    ];

    if (requiredFields.some(value => !value)) {
      toast({
        title: 'Missing registration details',
        description: 'Please complete the required client, package, and payment date fields.',
        variant: 'destructive',
      });
      return;
    }

    if (values.password && values.password.trim().length < 8) {
      toast({
        title: 'Password too short',
        description: 'Optional dashboard password must be at least 8 characters.',
        variant: 'destructive',
      });
      return;
    }

    if (values.password.trim() && !values.email.trim()) {
      toast({
        title: 'Email required for dashboard login',
        description: 'Leave password blank or provide an email address for the client dashboard account.',
        variant: 'destructive',
      });
      return;
    }

    if (!selectedPackage || selectedPackage.duration_value <= 0) {
      toast({
        title: 'Invalid package',
        description: 'Please select a package with a valid duration.',
        variant: 'destructive',
      });
      return;
    }

    const periodsPaid = Number(values.periods_paid);
    if (!Number.isInteger(periodsPaid) || periodsPaid < 1 || periodsPaid > 120) {
      toast({
        title: 'Invalid periods paid',
        description: 'Periods paid must be a whole number between 1 and 120.',
        variant: 'destructive',
      });
      return;
    }

    if (selectedPackage.requires_trainer && !values.trainer_id) {
      toast({
        title: 'Trainer required',
        description: 'This package requires assigning a trainer.',
        variant: 'destructive',
      });
      return;
    }

    const amount = Number(values.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      toast({
        title: 'Invalid amount',
        description: 'Payment amount must be zero or greater.',
        variant: 'destructive',
      });
      return;
    }

    setCreatingUser(true);

    try {
      let userId: string = crypto.randomUUID();
      const password = values.password.trim();

      if (password) {
        const { data: currentAuth } = await supabase.auth.getSession();
        const adminSession = currentAuth.session;
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: values.email.trim(),
          password,
        });

        if (signUpError) throw signUpError;
        if (!signUpData.user?.id) throw new Error('Client Auth account was not created.');
        userId = signUpData.user.id;

        if (
          adminSession?.access_token &&
          adminSession?.refresh_token &&
          adminSession.user.id !== userId
        ) {
          const { error: restoreSessionError } = await supabase.auth.setSession({
            access_token: adminSession.access_token,
            refresh_token: adminSession.refresh_token,
          });
          if (restoreSessionError) console.warn('Could not restore super-admin session after client signup:', restoreSessionError);
        }
      }

      const fullName = `${values.first_name.trim()} ${values.last_name.trim()}`.trim();
      const profileEmail = values.email.trim() || createPlaceholderEmail(userId);
      const profilePhone = values.phone.trim() || createPlaceholderPhone(userId);
      const paidAtIso = dateInputToAddisIso(values.payment_date);
      const expiryIso = addPackageDuration(new Date(paidAtIso), selectedPackage, periodsPaid).toISOString();
      const qrData = JSON.stringify({
        userId,
        firstName: values.first_name.trim(),
        lastName: values.last_name.trim(),
        packageId: values.package_id,
        gymId: selectedGymId,
      });

      const { error: insertError } = await supabase
        .from('users')
        .insert({
          id: userId,
          first_name: values.first_name.trim(),
          last_name: values.last_name.trim(),
          gender: values.gender,
          email: profileEmail,
          phone: profilePhone,
          emergency_name: values.emergency_name.trim() || null,
          emergency_phone: values.emergency_phone.trim() || null,
          relationship: values.relationship.trim() || null,
          fitness_goal: values.fitness_goal.trim() || null,
          package_id: values.package_id,
          created_at: paidAtIso,
          membership_expiry: expiryIso,
          status: 'active',
          date_of_birth: values.date_of_birth || null,
          qr_code_data: qrData,
          gym_id: selectedGymId,
        });

      if (insertError) throw insertError;

      if (values.trainer_id) {
        const { error: coachingError } = await supabase
          .from('one_to_one_coaching')
          .insert({
            user_id: userId,
            trainer_id: values.trainer_id,
            start_date: values.payment_date,
            end_date: expiryIso.slice(0, 10),
            is_active: true,
            notes: 'Assigned during super-admin offline registration.',
          });

        if (coachingError) console.warn('Offline registration trainer assignment failed:', coachingError);
      }

      if (amount > 0) {
        await recordPayment({
          user_id: userId,
          gym_id: selectedGymId,
          package_id: values.package_id,
          amount,
          payment_method: values.payment_method.trim() || 'offline',
          remarks: JSON.stringify({
            type: 'offline_backdated_registration',
            note: values.remarks.trim() || null,
            entered_at: new Date().toISOString(),
            payment_date: paidAtIso,
            gym_name: selectedGym.name,
            package_name: selectedPackage.name,
            periods_paid: periodsPaid,
            membership_expiry: expiryIso,
          }),
        });
      }

      toast({
        title: 'Offline user registered',
        description: `${fullName} was registered for ${selectedGym.name}.`,
      });
      setRegistrationOpen(false);
      setRegistrationValues(emptyRegistrationValues());
      await fetchMembers(selectedGymId, searchTerm);
    } catch (err: any) {
      toast({
        title: 'Offline registration failed',
        description: err?.message || 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setCreatingUser(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <SuperAdSidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

      <div className="flex-1 overflow-y-auto flex flex-col">
        {isMobile && (
          <div className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
              <Menu size={24} />
            </Button>
            <h1 className="font-semibold text-lg text-blue-600">Super Admin</h1>
          </div>
        )}

        <main className="p-4 md:p-6 space-y-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-blue-700">Offline Renewals</h1>
              <p className="mt-1 text-gray-500">
                Record backdated member renewals for any gym from one controlled system-admin area.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                onClick={openRegistration}
                disabled={!selectedGymId || packages.length === 0}
              >
                <Plus className="mr-2 h-4 w-4" />
                New User
              </Button>
              <Button
                variant="outline"
                onClick={() => selectedGymId ? fetchMembers(selectedGymId, searchTerm) : fetchGyms()}
                disabled={loadingGyms || loadingMembers}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${loadingGyms || loadingMembers ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-blue-600" />
                Select Gym
              </CardTitle>
              <CardDescription>
                Choose the gym first, then search that gym's members and record the correction.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-[minmax(260px,420px)_1fr]">
              <Select
                value={selectedGymId}
                onValueChange={(value) => {
                  setSelectedGymId(value);
                  setSearchTerm('');
                }}
                disabled={loadingGyms}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingGyms ? 'Loading gyms...' : 'Select a gym'} />
                </SelectTrigger>
                <SelectContent>
                  {gyms.map(gym => (
                    <SelectItem key={gym.id} value={gym.id}>
                      {gym.name}{gym.status ? ` (${gym.status})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedGym && (
                <div className="rounded-md bg-blue-50 px-4 py-3 text-sm text-blue-900">
                  Managing renewals for <strong>{selectedGym.name}</strong>
                </div>
              )}
            </CardContent>
          </Card>

          {selectedGym && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-600" />
                  Members
                </CardTitle>
                <CardDescription>
                  Search by name, email, or phone. Results are limited to the selected gym.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative max-w-xl">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search members..."
                    className="pl-9"
                  />
                </div>

                {loadingMembers ? (
                  <div className="py-12 text-center text-gray-500">Loading members...</div>
                ) : members.length === 0 ? (
                  <div className="py-12 text-center text-gray-400">
                    No members found for {selectedGym.name}.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {members.map(member => (
                      <div key={member.user_id} className="flex flex-col gap-4 rounded-lg border bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
                        <div className="flex min-w-0 items-center gap-4">
                          <Avatar className="h-12 w-12">
                            <AvatarFallback className="bg-blue-100 font-semibold text-blue-700">
                              {getInitials(member.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-900">{member.full_name}</div>
                            <div className="truncate text-sm text-gray-500">{isPlaceholderEmail(member.email) ? '-' : member.email || '-'}</div>
                            <div className="text-xs text-gray-400">{isPlaceholderPhone(member.phone) ? '-' : member.phone || '-'}</div>
                          </div>
                        </div>

                        <div className="grid gap-3 text-sm md:grid-cols-5 md:items-center">
                          <div>
                            <div className="text-xs uppercase tracking-wide text-gray-400">Package</div>
                            <Badge variant="outline" className="mt-1">{member.package_name}</Badge>
                          </div>
                          <div>
                            <div className="text-xs uppercase tracking-wide text-gray-400">Expiry</div>
                            <div className="mt-1 font-medium">{formatDate(member.membership_expiry)}</div>
                          </div>
                          <div>
                            <div className="text-xs uppercase tracking-wide text-gray-400">Days Left</div>
                            <div className={member.days_left > 0 ? 'mt-1 font-medium text-green-700' : 'mt-1 font-medium text-red-700'}>
                              {member.days_left === Number.MAX_SAFE_INTEGER
                                ? '-'
                                : member.days_left >= 0
                                  ? `${member.days_left} days`
                                  : `${Math.abs(member.days_left)} overdue`}
                            </div>
                          </div>
                          <Button
                            type="button"
                            onClick={() => openRenewal(member)}
                            disabled={processingMemberId === member.user_id || packages.length === 0}
                            className="justify-center"
                          >
                            <CalendarClock className="mr-2 h-4 w-4" />
                            {processingMemberId === member.user_id ? 'Recording...' : 'Record Offline Renewal'}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => openFreeze(member)}
                            disabled={processingMemberId === member.user_id}
                            className="justify-center"
                          >
                            <Snowflake className="mr-2 h-4 w-4" />
                            {processingMemberId === member.user_id ? 'Recording...' : 'Record Offline Freeze'}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </main>
      </div>

      <OfflineRenewalModal
        isOpen={renewalOpen}
        onClose={() => {
          setRenewalOpen(false);
          setSelectedMember(null);
        }}
        member={selectedMember}
        packages={packages}
        onSubmit={handleRenewalSubmit}
        isProcessing={processingMemberId === selectedMember?.user_id}
      />

      <SimpleModal
        isOpen={freezeOpen}
        onClose={() => {
          if (processingMemberId === freezeMember?.user_id) return;
          setFreezeOpen(false);
          setFreezeMember(null);
          setFreezeValues(emptyFreezeValues());
        }}
        title="Record Offline Freeze"
        icon={<Snowflake className="h-5 w-5" />}
      >
        <div className="space-y-5">
          <div className="rounded-md bg-gray-50 p-3 text-sm text-gray-700">
            <div className="font-medium text-gray-900">{freezeMember?.full_name ?? '-'}</div>
            <div>Current expiry: {formatDate(freezeMember?.membership_expiry ?? '')}</div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="offline-freeze-start">Freeze start date</Label>
              <Input
                id="offline-freeze-start"
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                value={freezeValues.freeze_start_date}
                onChange={(event) => updateFreezeValue('freeze_start_date', event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="offline-freeze-days">Freeze days</Label>
              <Input
                id="offline-freeze-days"
                type="number"
                min="1"
                step="1"
                value={freezeValues.freeze_days}
                onChange={(event) => updateFreezeValue('freeze_days', event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="offline-freeze-remarks">Note or source</Label>
            <Input
              id="offline-freeze-remarks"
              value={freezeValues.remarks}
              onChange={(event) => updateFreezeValue('remarks', event.target.value)}
              placeholder="Paper note, spreadsheet row, admin correction reason..."
            />
          </div>

          <div className="rounded-md border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">
            <div>Freeze start: <strong>{freezeValues.freeze_start_date || '-'}</strong></div>
            <div>Freeze end: <strong>{freezePreview ? freezePreview.freezeEndDate.toLocaleDateString() : '-'}</strong></div>
            <div>New expiry: <strong>{freezePreview ? freezePreview.newExpiryDate.toLocaleDateString() : '-'}</strong></div>
          </div>

          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setFreezeOpen(false);
                setFreezeMember(null);
                setFreezeValues(emptyFreezeValues());
              }}
              disabled={processingMemberId === freezeMember?.user_id}
              type="button"
            >
              Cancel
            </Button>
            <Button
              onClick={handleFreezeSubmit}
              disabled={!freezePreview || processingMemberId === freezeMember?.user_id}
              type="button"
            >
              {processingMemberId === freezeMember?.user_id ? 'Recording...' : 'Record Freeze'}
            </Button>
          </div>
        </div>
      </SimpleModal>

      <SimpleModal
        isOpen={registrationOpen}
        onClose={() => {
          if (creatingUser) return;
          setRegistrationOpen(false);
        }}
        title="Register Offline User"
        icon={<Plus className="h-5 w-5" />}
      >
        <div className="space-y-5">
          <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-900">
            Registering for <strong>{selectedGym?.name ?? 'selected gym'}</strong>. The real payment date will be used as the member registration date.
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="offline-first-name">First name</Label>
              <Input
                id="offline-first-name"
                value={registrationValues.first_name}
                onChange={(event) => updateRegistrationValue('first_name', event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="offline-last-name">Last name</Label>
              <Input
                id="offline-last-name"
                value={registrationValues.last_name}
                onChange={(event) => updateRegistrationValue('last_name', event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="offline-email">Email (optional)</Label>
              <Input
                id="offline-email"
                type="email"
                value={registrationValues.email}
                onChange={(event) => updateRegistrationValue('email', event.target.value)}
              />
              <p className="text-xs text-gray-500">
                Leave blank if the member does not want to share an email.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="offline-phone">Phone (optional)</Label>
              <Input
                id="offline-phone"
                value={registrationValues.phone}
                onChange={(event) => updateRegistrationValue('phone', event.target.value)}
              />
              <p className="text-xs text-gray-500">
                Leave blank if the member does not want to share a phone number.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="offline-dob">Date of birth (optional)</Label>
              <Input
                id="offline-dob"
                type="date"
                value={registrationValues.date_of_birth}
                onChange={(event) => updateRegistrationValue('date_of_birth', event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Gender</Label>
              <Select value={registrationValues.gender} onValueChange={(value) => updateRegistrationValue('gender', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Membership Package</Label>
            <Select value={registrationValues.package_id} onValueChange={(value) => updateRegistrationValue('package_id', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select package" />
              </SelectTrigger>
              <SelectContent>
                {packages.map(pkg => (
                  <SelectItem key={pkg.id} value={pkg.id}>
                    {pkg.name} - ETB {Number(pkg.price || 0).toLocaleString()} / {pkg.duration_value} {pkg.duration_unit}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedRegistrationPackage?.requires_trainer && (
            <div className="space-y-2">
              <Label>Trainer</Label>
              <Select value={registrationValues.trainer_id} onValueChange={(value) => updateRegistrationValue('trainer_id', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select trainer" />
                </SelectTrigger>
                <SelectContent>
                  {trainers.map(trainer => (
                    <SelectItem key={trainer.id} value={trainer.id}>
                      {trainer.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="offline-payment-date-register">Real payment / registration date</Label>
              <Input
                id="offline-payment-date-register"
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                value={registrationValues.payment_date}
                onChange={(event) => updateRegistrationValue('payment_date', event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="offline-register-periods">Periods paid</Label>
              <Input
                id="offline-register-periods"
                type="number"
                min="1"
                step="1"
                value={registrationValues.periods_paid}
                onChange={(event) => updateRegistrationValue('periods_paid', event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="offline-register-amount">Amount</Label>
              <Input
                id="offline-register-amount"
                type="number"
                min="0"
                step="0.01"
                value={registrationValues.amount}
                onChange={(event) => updateRegistrationValue('amount', event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="offline-register-method">Payment method</Label>
              <Input
                id="offline-register-method"
                value={registrationValues.payment_method}
                onChange={(event) => updateRegistrationValue('payment_method', event.target.value)}
                placeholder="offline"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="offline-register-password">Password (optional)</Label>
              <Input
                id="offline-register-password"
                type="password"
                value={registrationValues.password}
                onChange={(event) => updateRegistrationValue('password', event.target.value)}
                placeholder="Optional dashboard password"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="offline-emergency-name">Emergency contact name</Label>
              <Input
                id="offline-emergency-name"
                value={registrationValues.emergency_name}
                onChange={(event) => updateRegistrationValue('emergency_name', event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="offline-emergency-phone">Emergency contact phone</Label>
              <Input
                id="offline-emergency-phone"
                value={registrationValues.emergency_phone}
                onChange={(event) => updateRegistrationValue('emergency_phone', event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="offline-relationship">Relationship</Label>
              <Input
                id="offline-relationship"
                value={registrationValues.relationship}
                onChange={(event) => updateRegistrationValue('relationship', event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="offline-fitness-goal">Fitness goal</Label>
              <Input
                id="offline-fitness-goal"
                value={registrationValues.fitness_goal}
                onChange={(event) => updateRegistrationValue('fitness_goal', event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="offline-register-remarks">Note or source</Label>
            <Input
              id="offline-register-remarks"
              value={registrationValues.remarks}
              onChange={(event) => updateRegistrationValue('remarks', event.target.value)}
              placeholder="Paper form, spreadsheet row, receipt number..."
            />
          </div>

          <div className="rounded-md border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">
            <div>Registration date: <strong>{registrationValues.payment_date || '-'}</strong></div>
            <div>Periods paid: <strong>{registrationValues.periods_paid || '1'}</strong></div>
            <div>Calculated expiry: <strong>{registrationExpiryPreview ? registrationExpiryPreview.toLocaleDateString() : '-'}</strong></div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setRegistrationOpen(false)} disabled={creatingUser} type="button">
              Cancel
            </Button>
            <Button onClick={handleCreateOfflineUser} disabled={creatingUser} type="button">
              {creatingUser ? 'Registering...' : 'Register User'}
            </Button>
          </div>
        </div>
      </SimpleModal>
    </div>
  );
}
