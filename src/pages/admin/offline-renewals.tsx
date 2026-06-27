import React, { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Menu, RefreshCw, Search, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/lib/supabaseClient';
import { SuperAdSidebar } from '@/pages/admin/superAdSidebar';
import { OfflineRenewalModal, OfflineRenewalValues, type OfflineRenewalPackage } from '@/components/Modals/OfflineRenewalModal';
import type { MembershipInfo, MembershipStatus } from '@/types/memberships';

type GymOption = {
  id: string;
  name: string;
  status?: string | null;
};

const allowedDurationUnits = ['days', 'weeks', 'months', 'years'] as const;

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
  const [packages, setPackages] = useState<OfflineRenewalPackage[]>([]);
  const [loadingGyms, setLoadingGyms] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [selectedMember, setSelectedMember] = useState<MembershipInfo | null>(null);
  const [renewalOpen, setRenewalOpen] = useState(false);
  const [processingMemberId, setProcessingMemberId] = useState<string | null>(null);

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
      return;
    }

    fetchPackages(selectedGymId);
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
        .select('id, name, price, duration_value, duration_unit')
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

  const handleRenewalSubmit = async (values: OfflineRenewalValues) => {
    if (!selectedMember) return;
    setProcessingMemberId(selectedMember.user_id);

    try {
      const { data, error } = await supabase.rpc('record_offline_renewal', {
        p_user_id: selectedMember.user_id,
        p_package_id: values.packageId,
        p_payment_date: values.paymentDate,
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
            <Button
              variant="outline"
              onClick={() => selectedGymId ? fetchMembers(selectedGymId, searchTerm) : fetchGyms()}
              disabled={loadingGyms || loadingMembers}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${loadingGyms || loadingMembers ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
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
                            <div className="truncate text-sm text-gray-500">{member.email || '-'}</div>
                            <div className="text-xs text-gray-400">{member.phone || '-'}</div>
                          </div>
                        </div>

                        <div className="grid gap-3 text-sm md:grid-cols-4 md:items-center">
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
    </div>
  );
}
