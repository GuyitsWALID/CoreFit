import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Search, Download, Users, Clock, RefreshCw, Snowflake, ArrowUpRight, CalendarDays, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/supabaseClient';

interface MembershipInfo {
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  package_id: string;
  package_name: string;
  duration_value: number;
  duration_unit: string;
  start_date: string;
  expiry_date: string;
  status: string;
  days_left: number;
  total_frozen_days: number;
  current_freeze_start?: string | null;
  current_freeze_end?: string | null;
  membership_id: string;
}

interface FreezeHistory {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  days_frozen: number;
  reason?: string;
  created_at: string;
}

export default function MembershipList() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [packageFilter, setPackageFilter] = useState('all');
  const [daysLeftFilter, setDaysLeftFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('all');
  const [members, setMembers] = useState<MembershipInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [canFreeze, setCanFreeze] = useState<Record<string, boolean>>({});
  const [freezingId, setFreezingId] = useState<string | null>(null);
  const [renewingId, setRenewingId] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<MembershipInfo | null>(null);
  const [freezeHistory, setFreezeHistory] = useState<FreezeHistory[]>([]);
  const [showFreezeDialog, setShowFreezeDialog] = useState(false);

  useEffect(() => {
    fetchMembershipData();
  }, []);

  // Fetch membership data from users_with_membership_info view
  const fetchMembershipData = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('users_with_membership_info')
        .select('*')
        .order('days_left', { ascending: true });

      if (error) {
        console.error('Error fetching membership data:', error);
        toast({
          title: "Error loading memberships",
          description: `Could not load membership data: ${error.message}`,
          variant: "destructive"
        });
      } else {
        console.log('Membership data fetched successfully:', data);
        setMembers(data || []);
      }
    } catch (error: any) {
      console.error('Unexpected error:', error);
      toast({
        title: "Error loading memberships",
        description: `Unexpected error: ${error?.message || 'Unknown error'}`,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Check freeze eligibility for visible members
  useEffect(() => {
    const fetchCanFreeze = async () => {
      if (filteredMembers.length === 0) return;
      
      const results: Record<string, boolean> = {};
      
      // Check freeze eligibility for each member
      for (const member of filteredMembers) {
        if (member.status === 'active') {
          try {
            const { data, error } = await supabase.rpc('can_freeze_membership', { 
              user_id: member.user_id 
            });
            results[member.user_id] = !error && !!data;
          } catch (err) {
            results[member.user_id] = false;
          }
        } else {
          results[member.user_id] = false;
        }
      }
      
      setCanFreeze(results);
    };

    if (filteredMembers.length > 0) {
      fetchCanFreeze();
    }
  }, [members, statusFilter, packageFilter, searchTerm, activeTab, daysLeftFilter]);

  // Get unique package types for filter dropdown
  const packageTypes = Array.from(new Set(members.map(m => m.package_name))).sort();

  // Filter members based on all criteria
  const filteredMembers = members.filter(member => {
    // Search filter
    const matchesSearch = searchTerm === '' ||
      member.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.phone.toLowerCase().includes(searchTerm.toLowerCase());

    // Status filter
    const matchesStatus = statusFilter === 'all' || member.status.toLowerCase() === statusFilter.toLowerCase();

    // Package filter
    const matchesPackage = packageFilter === 'all' || member.package_name === packageFilter;

    // Days left filter
    let matchesDaysLeft = true;
    if (daysLeftFilter === 'expiring') {
      matchesDaysLeft = member.days_left <= 30 && member.days_left >= 0;
    } else if (daysLeftFilter === 'expired') {
      matchesDaysLeft = member.days_left < 0;
    } else if (daysLeftFilter === 'critical') {
      matchesDaysLeft = member.days_left <= 7 && member.days_left >= 0;
    }

    // Tab filter
    let matchesTab = true;
    if (activeTab === 'expiring') {
      matchesTab = member.days_left <= 30 && member.days_left >= 0;
    } else if (activeTab === 'expired') {
      matchesTab = member.days_left < 0;
    }

    return matchesSearch && matchesStatus && matchesPackage && matchesDaysLeft && matchesTab;
  });

  // Get counts for tabs
  const expiringCount = members.filter(m => m.days_left <= 30 && m.days_left >= 0).length;
  const expiredCount = members.filter(m => m.days_left < 0).length;

  // Freeze membership handler
  const handleFreeze = async (member: MembershipInfo) => {
    setSelectedMember(member);
    
    // Fetch freeze history for this member
    const { data: history } = await supabase
      .from('membership_freezes')
      .select('*')
      .eq('user_id', member.user_id)
      .order('created_at', { ascending: false });
    
    setFreezeHistory(history || []);
    setShowFreezeDialog(true);
  };

  // Execute freeze
  const executeFreeze = async () => {
    if (!selectedMember) return;
    
    setFreezingId(selectedMember.user_id);
    try {
      const { error } = await supabase.rpc('freeze_membership', { 
        user_id: selectedMember.user_id 
      });
      
      if (error) {
        toast({
          title: "Freeze failed",
          description: error.message,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Membership frozen",
          description: `${selectedMember.full_name}'s membership has been frozen successfully.`
        });
        fetchMembershipData();
        setShowFreezeDialog(false);
      }
    } catch (error: any) {
      toast({
        title: "Freeze failed",
        description: `Unexpected error: ${error?.message || 'Unknown error'}`,
        variant: "destructive"
      });
    } finally {
      setFreezingId(null);
    }
  };

  // Renew membership handler
  const handleRenew = async (member: MembershipInfo) => {
    setRenewingId(member.user_id);
    try {
      const { error } = await supabase.rpc('renew_membership', { 
        user_id: member.user_id,
        package_id: member.package_id
      });
      
      if (error) {
        toast({
          title: "Renewal failed",
          description: error.message,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Membership renewed",
          description: `${member.full_name}'s membership has been renewed successfully.`
        });
        fetchMembershipData();
      }
    } catch (error: any) {
      toast({
        title: "Renewal failed",
        description: `Unexpected error: ${error?.message || 'Unknown error'}`,
        variant: "destructive"
      });
    } finally {
      setRenewingId(null);
    }
  };

  // Package upgrade handler (placeholder)
  const handleUpgrade = async (member: MembershipInfo) => {
    toast({
      title: "Package Upgrade",
      description: "Package upgrade feature coming soon.",
    });
  };

  // Get badge variant for status
  const getStatusBadgeVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'default';
      case 'expired':
        return 'destructive';
      case 'paused':
      case 'frozen':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  // Get days left badge with color coding
  const getDaysLeftBadge = (member: MembershipInfo) => {
    let variant: "default" | "destructive" | "outline" | "secondary" = "outline";
    
    if (member.days_left < 0) {
      variant = "destructive";
    } else if (member.days_left <= 7) {
      variant = "destructive";
    } else if (member.days_left <= 30) {
      variant = "secondary";
    } else {
      variant = "default";
    }

    return (
      <Badge variant={variant} className="whitespace-nowrap">
        {member.days_left >= 0
          ? `${member.days_left} days left`
          : `${Math.abs(member.days_left)} days overdue`}
      </Badge>
    );
  };

  // Get freeze badge
  const getFreezeBadge = (member: MembershipInfo) => {
    if (!member.total_frozen_days) return null;
    
    // Determine freeze limit based on package
    let limit = 0;
    if (member.package_name.toLowerCase().includes("3 month")) limit = 30;
    else if (member.package_name.toLowerCase().includes("6 month")) limit = 60;
    
    let variant: "default" | "destructive" | "outline" | "secondary" = "outline";
    if (limit && member.total_frozen_days >= limit) variant = "destructive";
    else if (limit && member.total_frozen_days >= limit * 0.8) variant = "secondary";
    
    return (
      <Badge variant={variant} className="ml-2 whitespace-nowrap">
        {member.total_frozen_days} frozen days
        {limit > 0 && ` (${limit} max)`}
      </Badge>
    );
  };

  // Export to CSV
  const exportToCSV = () => {
    if (filteredMembers.length === 0) {
      toast({
        title: "No data to export",
        description: "There are no members matching the current filters.",
        variant: "destructive"
      });
      return;
    }

    const headers = [
      'Full Name', 'Email', 'Phone', 'Package', 'Start Date', 'Expiry Date', 
      'Days Left', 'Total Frozen Days', 'Status'
    ];
    
    const csvContent = [
      headers.join(','),
      ...filteredMembers.map(member => [
        `"${member.full_name}"`,
        `"${member.email}"`,
        `"${member.phone}"`,
        `"${member.package_name}"`,
        `"${member.start_date}"`,
        `"${member.expiry_date}"`,
        member.days_left,
        member.total_frozen_days || 0,
        `"${member.status}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `membership_list_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Export successful",
      description: `${filteredMembers.length} member records exported to CSV.`,
    });
  };

  // Render member row
  const renderMemberRow = (member: MembershipInfo) => (
    <TableRow key={member.user_id} className="hover:bg-gray-50/50">
      <TableCell className="font-medium">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-fitness-primary text-white text-sm">
              {member.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="font-semibold">{member.full_name}</div>
            <div className="text-sm text-gray-500">{member.email}</div>
            <div className="text-xs text-gray-400">{member.phone}</div>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="whitespace-nowrap">
          {member.package_name}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="text-sm">
          <div>Start: {new Date(member.start_date).toLocaleDateString()}</div>
          <div>Expires: {new Date(member.expiry_date).toLocaleDateString()}</div>
        </div>
      </TableCell>
      <TableCell>
        {getDaysLeftBadge(member)}
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-1">
          {getFreezeBadge(member)}
          {member.current_freeze_start && member.current_freeze_end && (
            <Badge variant="secondary" className="text-xs whitespace-nowrap">
              <Snowflake className="h-3 w-3 mr-1" />
              Frozen until {new Date(member.current_freeze_end).toLocaleDateString()}
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={getStatusBadgeVariant(member.status)} className="capitalize whitespace-nowrap">
          {member.status}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-2 justify-end">
          {/* Freeze Button */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleFreeze(member)}
            disabled={!canFreeze[member.user_id] || freezingId === member.user_id || member.status !== 'active'}
            className="text-xs"
          >
            <Snowflake className="h-4 w-4 mr-1" />
            {freezingId === member.user_id ? "Freezing..." : "Freeze"}
          </Button>

          {/* Renew Button (only for expired/expiring) */}
          {(member.status === 'expired' || member.days_left <= 30) && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleRenew(member)}
              disabled={renewingId === member.user_id}
              className="text-xs"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              {renewingId === member.user_id ? "Renewing..." : "Renew"}
            </Button>
          )}

          {/* Upgrade Button */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleUpgrade(member)}
            className="text-xs"
          >
            <ArrowUpRight className="h-4 w-4 mr-1" />
            Upgrade
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );

  if (isLoading) {
    return (
      <div className="animate-fade-in">
        <h2 className="text-3xl font-bold tracking-tight mb-6">Membership Management</h2>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-fitness-primary mx-auto"></div>
          <p className="mt-4 text-gray-500">Loading membership data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Membership Management</h2>
          <p className="text-gray-500 mt-1">Manage member subscriptions, renewals, and freezes</p>
        </div>
        <Button variant="outline" onClick={exportToCSV} disabled={filteredMembers.length === 0}>
          <Download className="h-4 w-4 mr-2" />
          Export ({filteredMembers.length})
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            All Members ({members.length})
          </TabsTrigger>
          <TabsTrigger value="expiring" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Expiring Soon ({expiringCount})
          </TabsTrigger>
          <TabsTrigger value="expired" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Expired ({expiredCount})
          </TabsTrigger>
        </TabsList>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="search"
              placeholder="Search by name, email, or phone..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="frozen">Frozen</SelectItem>
            </SelectContent>
          </Select>

          <Select value={packageFilter} onValueChange={setPackageFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All Packages" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Packages</SelectItem>
              {packageTypes.map((pkg) => (
                <SelectItem key={pkg} value={pkg}>{pkg}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={daysLeftFilter} onValueChange={setDaysLeftFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Days Left" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Periods</SelectItem>
              <SelectItem value="critical">Critical (≤7 days)</SelectItem>
              <SelectItem value="expiring">Expiring (≤30 days)</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Content */}
        <TabsContent value="all" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Members ({filteredMembers.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Package</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Days Left</TableHead>
                      <TableHead>Freeze Info</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMembers.length > 0 ? (
                      filteredMembers.map(renderMemberRow)
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12 text-gray-500">
                          No members found matching your filters
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expiring" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Expiring Memberships ({filteredMembers.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Package</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Days Left</TableHead>
                      <TableHead>Freeze Info</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMembers.length > 0 ? (
                      filteredMembers.map(renderMemberRow)
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12 text-gray-500">
                          No expiring memberships found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expired" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Expired Memberships ({filteredMembers.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Package</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Days Overdue</TableHead>
                      <TableHead>Freeze Info</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMembers.length > 0 ? (
                      filteredMembers.map(renderMemberRow)
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12 text-gray-500">
                          No expired memberships found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Freeze Confirmation Dialog */}
      <Dialog open={showFreezeDialog} onOpenChange={setShowFreezeDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Freeze Membership</DialogTitle>
            <DialogDescription>
              Are you sure you want to freeze {selectedMember?.full_name}'s membership?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedMember && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold mb-2">Member Details</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>Name: {selectedMember.full_name}</div>
                  <div>Package: {selectedMember.package_name}</div>
                  <div>Days Left: {selectedMember.days_left}</div>
                  <div>Total Frozen: {selectedMember.total_frozen_days || 0} days</div>
                </div>
              </div>
            )}
            
            {freezeHistory.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">Previous Freezes</h4>
                <div className="max-h-32 overflow-y-auto space-y-2">
                  {freezeHistory.slice(0, 3).map((freeze) => (
                    <div key={freeze.id} className="text-sm bg-gray-50 p-2 rounded">
                      {new Date(freeze.start_date).toLocaleDateString()} - {new Date(freeze.end_date).toLocaleDateString()} 
                      ({freeze.days_frozen} days)
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFreezeDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={executeFreeze} 
              disabled={freezingId === selectedMember?.user_id}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Snowflake className="h-4 w-4 mr-2" />
              {freezingId === selectedMember?.user_id ? "Freezing..." : "Confirm Freeze"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
