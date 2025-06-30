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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, Filter, Bell, Download, Users, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/supabaseClient';

interface MembershipStatus {
  membership_id: string;
  user_id: string;
  full_name: string;
  email: string;
  package_name: string;
  start_date: string;
  expiry_date: string;
  status: string;
  duration_value: number;
  duration_unit: string;
  remaining_days: number;
  notify_soon: boolean;
}

export default function MembershipList() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('all');
  const [members, setMembers] = useState<MembershipStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchMembershipData();
  }, []);

  const fetchMembershipData = async () => {
    try {
      console.log('Fetching membership data...');
      const { data, error } = await supabase
        .from('membership_status_view')
        .select('*')
        .order('remaining_days', { ascending: true });

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

  const filteredMembers = members.filter(member => {
    // Search filter
    const matchesSearch = searchTerm === '' || 
      member.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email.toLowerCase().includes(searchTerm.toLowerCase());

    // Status filter
    const matchesStatus = statusFilter === 'all' || member.status.toLowerCase() === statusFilter;

    // Tab filter
    let matchesTab = true;
    if (activeTab === 'expiring') {
      // Show members expiring within 30 days or marked as notify_soon
      matchesTab = (member.remaining_days <= 30 && member.remaining_days >= 0) || member.notify_soon;
    }

    return matchesSearch && matchesStatus && matchesTab;
  });

  const expiringMembers = members.filter(member => 
    (member.remaining_days <= 30 && member.remaining_days >= 0) || member.notify_soon
  );

  const handleNotify = async (memberId: string) => {
    const member = members.find(m => m.membership_id === memberId);
    if (member) {
      // In a real implementation, you would send an actual notification
      // For now, we'll simulate it
      toast({
        title: "Notification sent",
        description: `${member.full_name} has been notified about their membership.`,
      });
    }
  };

  const handleNotifyAll = () => {
    const targetMembers = activeTab === 'expiring' ? expiringMembers : filteredMembers;
    toast({
      title: "All notifications sent",
      description: `${targetMembers.length} members have been notified about their memberships.`,
    });
  };

  const exportToCSV = () => {
    const targetMembers = filteredMembers;
    
    if (targetMembers.length === 0) {
      toast({
        title: "No data to export",
        description: "There are no members matching the current filters.",
        variant: "destructive"
      });
      return;
    }

    const headers = ['Name', 'Email', 'Package', 'Start Date', 'Expiry Date', 'Remaining Days', 'Status'];
    const csvContent = [
      headers.join(','),
      ...targetMembers.map(member => [
        `"${member.full_name}"`,
        `"${member.email}"`,
        `"${member.package_name}"`,
        `"${member.start_date}"`,
        `"${member.expiry_date}"`,
        member.remaining_days,
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
      description: `${targetMembers.length} member records exported to CSV.`,
    });
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'default';
      case 'paused':
        return 'secondary';
      case 'expired':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getDaysLeftBadgeVariant = (remainingDays: number, status: string) => {
    if (status.toLowerCase() !== 'active') return 'outline';
    if (remainingDays <= 7) return 'destructive';
    if (remainingDays <= 30) return 'secondary';
    return 'outline';
  };

  const renderMemberRow = (member: MembershipStatus) => (
    <TableRow key={member.membership_id}>
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-fitness-primary text-white text-xs">
              {member.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p>{member.full_name}</p>
            <p className="text-sm text-gray-500">{member.email}</p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline">{member.package_name}</Badge>
      </TableCell>
      <TableCell>
        <div className="flex flex-col">
          <span className="text-sm text-gray-500">Start: {new Date(member.start_date).toLocaleDateString()}</span>
          <span>Expires: {new Date(member.expiry_date).toLocaleDateString()}</span>
        </div>
      </TableCell>
      <TableCell>
        <Badge 
          variant={getDaysLeftBadgeVariant(member.remaining_days, member.status)}
          className="w-fit"
        >
          {member.remaining_days >= 0 ? `${member.remaining_days} days left` : `${Math.abs(member.remaining_days)} days overdue`}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge variant={getStatusBadgeVariant(member.status)} className="capitalize">
          {member.status}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <Button 
          size="sm" 
          variant="outline"
          onClick={() => handleNotify(member.membership_id)}
        >
          <Bell className="mr-1 h-4 w-4" /> Notify
        </Button>
      </TableCell>
    </TableRow>
  );

  if (isLoading) {
    return (
      <div className="animate-fade-in">
        <h2 className="text-3xl font-bold tracking-tight mb-6">Membership Management</h2>
        <div className="text-center py-8">Loading membership data...</div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-bold tracking-tight">Membership Management</h2>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={exportToCSV}
          >
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
          <Button 
            className="bg-fitness-primary hover:bg-fitness-primary/90 text-white"
            onClick={handleNotifyAll}
          >
            <Bell className="mr-2 h-4 w-4" /> Notify All
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList>
          <TabsTrigger value="all" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            All Members ({members.length})
          </TabsTrigger>
          <TabsTrigger value="expiring" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Expiring Soon ({expiringMembers.length})
          </TabsTrigger>
        </TabsList>

        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              type="search"
              placeholder="Search by name or phone number..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <TabsContent value="all">
          <Card>
            <CardHeader className="p-4">
              <CardTitle className="text-xl">All Members</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Package</TableHead>
                      <TableHead>Membership Period</TableHead>
                      <TableHead>Days Remaining</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMembers.length > 0 ? (
                      filteredMembers.map(renderMemberRow)
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No members found matching the current filters
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expiring">
          <Card>
            <CardHeader className="p-4">
              <CardTitle className="text-xl">Members With Expiring Memberships (Next 30 Days)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Package</TableHead>
                      <TableHead>Membership Period</TableHead>
                      <TableHead>Days Remaining</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMembers.length > 0 ? (
                      filteredMembers.map(renderMemberRow)
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
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
      </Tabs>
    </div>
  );
}
