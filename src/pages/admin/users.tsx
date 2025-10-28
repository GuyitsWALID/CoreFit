import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { 
  Search, 
  Users, 
  UserCheck, 
  UserX, 
  Building, 
  Filter, 
  RefreshCw, 
  Eye, 
  Edit, 
  Trash2,
  ArrowUpDown,
  Download,
  MoreHorizontal,
  MapPin,
  Mail,
  Phone,
  Calendar
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SuperAdSidebar } from '@/pages/admin/superAdSidebar';

interface UserData {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone?: string;
  status: 'active' | 'inactive' | 'expired' | 'paused';
  user_type: 'client' | 'staff' | 'admin';
  created_at: string;
  last_active?: string;
  gym_id?: string;
  gym_name?: string;
  role_name?: string;
  package_name?: string;
  membership_expiry?: string;
  days_left?: number;
}

interface UserStats {
  totalUsers: number;
  clients: number;
  staff: number;
  admins: number;
  activeUsers: number;
  inactiveUsers: number;
  expiredUsers: number;
  pausedUsers: number;
  gymCounts: Array<{ gym_name: string; count: number; gym_id: string }>;
  roleCounts: Array<{ role_name: string; count: number }>;
}

type SortField = 'name' | 'email' | 'created_at' | 'last_active' | 'gym_name' | 'status';
type SortDirection = 'asc' | 'desc';

export default function AdminUsers() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserData[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserData[]>([]);
  const [stats, setStats] = useState<UserStats>({
    totalUsers: 0,
    clients: 0,
    staff: 0,
    admins: 0,
    activeUsers: 0,
    inactiveUsers: 0,
    expiredUsers: 0,
    pausedUsers: 0,
    gymCounts: [],
    roleCounts: []
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [userTypeFilter, setUserTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [gymFilter, setGymFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Available filter options
  const [gyms, setGyms] = useState<Array<{ id: string; name: string }>>([]);
  const [roles, setRoles] = useState<Array<{ id: string; name: string }>>([]);

  // Dynamic styling
  const dynamicStyles = {
    primaryColor: '#2563eb',
    secondaryColor: '#1e40af',
    accentColor: '#f59e0b',
  };

  useEffect(() => {
    loadData();
    loadFilterOptions();
  }, []);

  useEffect(() => {
    filterAndSortUsers();
  }, [users, searchTerm, userTypeFilter, statusFilter, gymFilter, roleFilter, sortField, sortDirection]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadUsers(),
        loadStats()
      ]);
    } catch (error: any) {
      toast({
        title: "Error loading data",
        description: error.message || "Failed to load user data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      // Load regular users (clients)
      const { data: clientsData, error: clientsError } = await supabase
        .from('users')
        .select(`
          id,
          first_name,
          last_name,
          full_name,
          email,
          phone,
          status,
          created_at,
          membership_expiry,
          gym_id,
          gyms (
            name
          ),
          packages (
            name
          )
        `)
        .order('created_at', { ascending: false });

      if (clientsError) throw clientsError;

      // Load staff users
      const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select(`
          id,
          first_name,
          last_name,
          full_name,
          email,
          phone,
          is_active,
          created_at,
          gym_id,
          gyms (
            name
          ),
          roles (
            name
          )
        `)
        .order('created_at', { ascending: false });

      if (staffError) throw staffError;

      // Transform and combine data
      const clientUsers: UserData[] = (clientsData || []).map(user => {
        const membershipExpiry = user.membership_expiry ? new Date(user.membership_expiry) : null;
        const now = new Date();
        const daysLeft = membershipExpiry ? Math.ceil((membershipExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
        
        return {
          id: user.id,
          first_name: user.first_name,
          last_name: user.last_name,
          full_name: user.full_name,
          email: user.email,
          phone: user.phone,
          status: user.status,
          user_type: 'client' as const,
          created_at: user.created_at,
          gym_id: user.gym_id,
          gym_name: (user.gyms as any)?.name,
          package_name: (user.packages as any)?.name,
          membership_expiry: user.membership_expiry,
          days_left: daysLeft
        };
      });

      const staffUsers: UserData[] = (staffData || []).map(staff => ({
        id: staff.id,
        first_name: staff.first_name,
        last_name: staff.last_name,
        full_name: staff.full_name,
        email: staff.email,
        phone: staff.phone,
        status: staff.is_active ? 'active' : 'inactive',
        user_type: (staff.roles as any)?.name?.toLowerCase() === 'admin' ? 'admin' : 'staff',
        created_at: staff.created_at,
        gym_id: staff.gym_id,
        gym_name: (staff.gyms as any)?.name,
        role_name: (staff.roles as any)?.name
      }));

      const allUsers = [...clientUsers, ...staffUsers];
      setUsers(allUsers);
    } catch (error: any) {
      console.error('Error loading users:', error);
      throw error;
    }
  };

  const loadStats = async () => {
    try {
      // Get client counts
      const { count: clientCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });

      // Get staff counts
      const { count: staffCount } = await supabase
        .from('staff')
        .select('*', { count: 'exact', head: true });

      // Get admin counts (staff with admin role)
      const { data: adminRole } = await supabase
        .from('roles')
        .select('id')
        .eq('name', 'admin')
        .single();

      const { count: adminCount } = await supabase
        .from('staff')
        .select('*', { count: 'exact', head: true })
        .eq('role_id', adminRole?.id || '');

      // Get active/inactive counts
      const { count: activeClientCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      const { count: activeStaffCount } = await supabase
        .from('staff')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      const { count: expiredCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'expired');

      const { count: pausedCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'paused');

      // Get gym distribution
      const { data: gymDistribution } = await supabase
        .from('gyms')
        .select(`
          id,
          name,
          users!gym_id (count),
          staff!gym_id (count)
        `);

      const gymCounts = (gymDistribution || []).map(gym => ({
        gym_id: gym.id,
        gym_name: gym.name,
        count: ((gym.users as any)?.length || 0) + ((gym.staff as any)?.length || 0)
      })).sort((a, b) => b.count - a.count);

      // Get role distribution
      const { data: roleDistribution } = await supabase
        .from('roles')
        .select(`
          id,
          name,
          staff!role_id (count)
        `);

      const roleCounts = (roleDistribution || []).map(role => ({
        role_name: role.name,
        count: (role.staff as any)?.length || 0
      })).sort((a, b) => b.count - a.count);

      const totalUsers = (clientCount || 0) + (staffCount || 0);
      const activeUsers = (activeClientCount || 0) + (activeStaffCount || 0);
      const inactiveUsers = totalUsers - activeUsers;

      setStats({
        totalUsers,
        clients: clientCount || 0,
        staff: (staffCount || 0) - (adminCount || 0),
        admins: adminCount || 0,
        activeUsers,
        inactiveUsers,
        expiredUsers: expiredCount || 0,
        pausedUsers: pausedCount || 0,
        gymCounts,
        roleCounts
      });
    } catch (error: any) {
      console.error('Error loading stats:', error);
      throw error;
    }
  };

  const loadFilterOptions = async () => {
    try {
      // Load gyms
      const { data: gymsData } = await supabase
        .from('gyms')
        .select('id, name')
        .order('name');

      // Load roles
      const { data: rolesData } = await supabase
        .from('roles')
        .select('id, name')
        .order('name');

      setGyms(gymsData || []);
      setRoles(rolesData || []);
    } catch (error: any) {
      console.error('Error loading filter options:', error);
    }
  };

  const filterAndSortUsers = () => {
    let filtered = users.filter(user => {
      // Search filter
      const matchesSearch = 
        searchTerm === '' ||
        user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.phone && user.phone.toLowerCase().includes(searchTerm.toLowerCase()));

      // User type filter
      const matchesUserType = 
        userTypeFilter === 'all' || user.user_type === userTypeFilter;

      // Status filter
      const matchesStatus = 
        statusFilter === 'all' || user.status === statusFilter;

      // Gym filter
      const matchesGym = 
        gymFilter === 'all' || user.gym_id === gymFilter;

      // Role filter (only applies to staff/admin)
      const matchesRole = 
        roleFilter === 'all' || 
        (user.user_type === 'client' && roleFilter === 'all') ||
        user.role_name === roleFilter;

      return matchesSearch && matchesUserType && matchesStatus && matchesGym && matchesRole;
    });

    // Sort users
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortField) {
        case 'name':
          aValue = a.full_name.toLowerCase();
          bValue = b.full_name.toLowerCase();
          break;
        case 'email':
          aValue = a.email.toLowerCase();
          bValue = b.email.toLowerCase();
          break;
        case 'created_at':
          aValue = new Date(a.created_at);
          bValue = new Date(b.created_at);
          break;
        case 'last_active':
          aValue = a.last_active ? new Date(a.last_active) : new Date(0);
          bValue = b.last_active ? new Date(b.last_active) : new Date(0);
          break;
        case 'gym_name':
          aValue = a.gym_name || '';
          bValue = b.gym_name || '';
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredUsers(filtered);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
    toast({
      title: "Data refreshed",
      description: "User data has been updated with the latest information."
    });
  };

  const handleExportCSV = () => {
    const csvData = filteredUsers.map(user => ({
      Name: user.full_name,
      Email: user.email,
      Phone: user.phone || '',
      Type: user.user_type,
      Status: user.status,
      Gym: user.gym_name || '',
      Role: user.role_name || user.package_name || '',
      'Created At': new Date(user.created_at).toLocaleDateString(),
      'Days Left': user.days_left || ''
    }));

    const headers = Object.keys(csvData[0] || {});
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => headers.map(header => `"${(row as any)[header]}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      case 'expired': return 'bg-red-100 text-red-800';
      case 'paused': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getUserTypeColor = (type: string) => {
    switch (type) {
      case 'client': return 'bg-blue-100 text-blue-800';
      case 'staff': return 'bg-purple-100 text-purple-800';
      case 'admin': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <SuperAdSidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse text-center">
            <div className="h-8 bg-gray-200 rounded w-64 mb-4"></div>
            <div className="text-gray-500">Loading user data...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <SuperAdSidebar />
      
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 
                className="text-3xl font-bold tracking-tight"
                style={{ color: dynamicStyles.primaryColor }}
              >
                User Management
              </h1>
              <p className="text-gray-500 mt-1">
                Manage all users across the platform by role, gym, and status
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                onClick={handleRefresh} 
                disabled={refreshing}
                variant="outline"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </Button>
              <Button 
                onClick={handleExportCSV}
                className="text-white"
                style={{ backgroundColor: dynamicStyles.primaryColor }}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4">
            <Card style={{ backgroundColor: `${dynamicStyles.primaryColor}08` }}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5" style={{ color: dynamicStyles.primaryColor }} />
                  <div>
                    <div className="text-2xl font-bold" style={{ color: dynamicStyles.primaryColor }}>
                      {stats.totalUsers}
                    </div>
                    <div className="text-sm text-gray-500">Total Users</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card style={{ backgroundColor: `#3b82f608` }}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-600" />
                  <div>
                    <div className="text-2xl font-bold text-blue-600">
                      {stats.clients}
                    </div>
                    <div className="text-sm text-gray-500">Clients</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card style={{ backgroundColor: `#8b5cf608` }}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-purple-600" />
                  <div>
                    <div className="text-2xl font-bold text-purple-600">
                      {stats.staff}
                    </div>
                    <div className="text-sm text-gray-500">Staff</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card style={{ backgroundColor: `#ef444408` }}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <UserX className="h-5 w-5 text-red-600" />
                  <div>
                    <div className="text-2xl font-bold text-red-600">
                      {stats.admins}
                    </div>
                    <div className="text-sm text-gray-500">Admins</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card style={{ backgroundColor: `#10b98108` }}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-green-600" />
                  <div>
                    <div className="text-2xl font-bold text-green-600">
                      {stats.activeUsers}
                    </div>
                    <div className="text-sm text-gray-500">Active</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card style={{ backgroundColor: `#6b728008` }}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <UserX className="h-5 w-5 text-gray-600" />
                  <div>
                    <div className="text-2xl font-bold text-gray-600">
                      {stats.inactiveUsers}
                    </div>
                    <div className="text-sm text-gray-500">Inactive</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card style={{ backgroundColor: `#f5930808` }}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <UserX className="h-5 w-5 text-orange-600" />
                  <div>
                    <div className="text-2xl font-bold text-orange-600">
                      {stats.expiredUsers}
                    </div>
                    <div className="text-sm text-gray-500">Expired</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card style={{ backgroundColor: `${dynamicStyles.accentColor}08` }}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5" style={{ color: dynamicStyles.accentColor }} />
                  <div>
                    <div className="text-2xl font-bold" style={{ color: dynamicStyles.accentColor }}>
                      {stats.pausedUsers}
                    </div>
                    <div className="text-sm text-gray-500">Paused</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Distribution Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gym Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Users by Gym
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stats.gymCounts.slice(0, 10).map((gym, index) => (
                    <div key={gym.gym_id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: `hsl(${index * 45}, 70%, 50%)` }}
                        />
                        <span className="text-sm font-medium">{gym.gym_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-sm text-gray-500">{gym.count} users</div>
                        <div 
                          className="h-2 w-20 bg-gray-200 rounded-full overflow-hidden"
                        >
                          <div 
                            className="h-full rounded-full transition-all"
                            style={{ 
                              width: `${(gym.count / Math.max(...stats.gymCounts.map(g => g.count))) * 100}%`,
                              backgroundColor: `hsl(${index * 45}, 70%, 50%)`
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Role Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5" />
                  Staff by Role
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stats.roleCounts.map((role, index) => (
                    <div key={role.role_name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: `hsl(${index * 60}, 70%, 50%)` }}
                        />
                        <span className="text-sm font-medium">{role.role_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-sm text-gray-500">{role.count} staff</div>
                        <div 
                          className="h-2 w-20 bg-gray-200 rounded-full overflow-hidden"
                        >
                          <div 
                            className="h-full rounded-full transition-all"
                            style={{ 
                              width: `${(role.count / Math.max(...stats.roleCounts.map(r => r.count))) * 100}%`,
                              backgroundColor: `hsl(${index * 60}, 70%, 50%)`
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <Select value={userTypeFilter} onValueChange={setUserTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="User Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="client">Clients</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="admin">Admins</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={gymFilter} onValueChange={setGymFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Gym" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Gyms</SelectItem>
                    {gyms.map(gym => (
                      <SelectItem key={gym.id} value={gym.id}>{gym.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    {roles.map(role => (
                      <SelectItem key={role.id} value={role.name}>{role.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs">
                    {filteredUsers.length} of {users.length} users
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Users Table */}
          <Card>
            <CardHeader>
              <CardTitle>Users Directory</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead 
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => handleSort('name')}
                      >
                        <div className="flex items-center gap-1">
                          Name
                          <ArrowUpDown className="h-3 w-3" />
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => handleSort('email')}
                      >
                        <div className="flex items-center gap-1">
                          Email
                          <ArrowUpDown className="h-3 w-3" />
                        </div>
                      </TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => handleSort('status')}
                      >
                        <div className="flex items-center gap-1">
                          Status
                          <ArrowUpDown className="h-3 w-3" />
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => handleSort('gym_name')}
                      >
                        <div className="flex items-center gap-1">
                          Gym
                          <ArrowUpDown className="h-3 w-3" />
                        </div>
                      </TableHead>
                      <TableHead>Role/Package</TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => handleSort('created_at')}
                      >
                        <div className="flex items-center gap-1">
                          Created
                          <ArrowUpDown className="h-3 w-3" />
                        </div>
                      </TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                          No users found matching your criteria
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback>
                                  {user.first_name[0]}{user.last_name[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium">{user.full_name}</div>
                                {user.phone && (
                                  <div className="text-xs text-gray-500 flex items-center gap-1">
                                    <Phone className="h-3 w-3" />
                                    {user.phone}
                                  </div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Mail className="h-3 w-3 text-gray-400" />
                              {user.email}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={getUserTypeColor(user.user_type)}>
                              {user.user_type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(user.status)}>
                              {user.status}
                            </Badge>
                            {user.user_type === 'client' && user.days_left !== null && (
                              <div className="text-xs text-gray-500 mt-1">
                                {user.days_left > 0 ? `${user.days_left} days left` : 
                                 user.days_left === 0 ? 'Expires today' : 
                                 `Expired ${Math.abs(user.days_left)} days ago`}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {user.gym_name ? (
                              <div className="flex items-center gap-1">
                                <Building className="h-3 w-3 text-gray-400" />
                                <span className="text-sm">{user.gym_name}</span>
                              </div>
                            ) : (
                              <span className="text-gray-400 text-sm">No gym</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {user.role_name || user.package_name ? (
                              <Badge variant="outline">
                                {user.role_name || user.package_name}
                              </Badge>
                            ) : (
                              <span className="text-gray-400 text-sm">None</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-gray-400" />
                              <span className="text-sm">
                                {new Date(user.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>
                                  <Eye className="mr-2 h-4 w-4" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit User
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-red-600">
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete User
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
