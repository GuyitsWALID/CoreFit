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
  Building, 
  Users, 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  MapPin,
  RefreshCw,
  Filter,
  Eye,
  ArrowUpDown,
  Menu
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { SuperAdSidebar } from '@/pages/admin/superAdSidebar';

interface GlobalStats {
  totalGyms: number;
  totalUsers: number;
  activeGyms: number;
  totalRevenue: number;
  totalStaff: number;
  totalCheckInsToday: number;
}

interface GymData {
  id: string;
  name: string;
  owner_name: string;
  owner_email?: string;
  owner_phone?: string;
  address?: string;
  city?: string;
  state?: string;
  brand_color?: string;
  status: 'active' | 'inactive' | 'pending' | 'archived';
  created_at: string;
  user_count: number;
  staff_count: number;
  revenue: number;
  recent_checkins: number;
}

interface GrowthData {
  date: string;
  users: number;
  gyms: number;
}

type SortOption = 'recent' | 'alphabetical' | 'users_desc' | 'users_asc' | 'revenue_desc';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export default function Analytics() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Global Stats
  const [globalStats, setGlobalStats] = useState<GlobalStats>({
    totalGyms: 0,
    totalUsers: 0,
    activeGyms: 0,
    totalRevenue: 0,
    totalStaff: 0,
    totalCheckInsToday: 0,
  });

  // Gym Data
  const [gyms, setGyms] = useState<GymData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  
  // Growth Data
  const [growthData, setGrowthData] = useState<GrowthData[]>([]);
  const [growthPeriod, setGrowthPeriod] = useState<'7d' | '30d' | '90d'>('30d');

  // Dynamic styling
  const dynamicStyles = {
    primaryColor: '#2563eb',
    secondaryColor: '#1e40af',
    accentColor: '#f59e0b',
  };

  useEffect(() => {
    loadAnalyticsData();
  }, []);

  useEffect(() => {
    loadGrowthData();
  }, [growthPeriod]);

  const loadAnalyticsData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadGlobalStats(),
        loadGymsData(),
      ]);
    } catch (error: any) {
      toast({
        title: "Error loading analytics",
        description: error.message || "Failed to load analytics data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadGlobalStats = async () => {
    try {
      // Total gyms
      const { count: gymCount } = await supabase
        .from('gyms')
        .select('*', { count: 'exact', head: true });

      // Active gyms
      const { count: activeGymCount } = await supabase
        .from('gyms')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      // Total users across all gyms
      const { count: userCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });

      // Total staff across all gyms
      const { count: staffCount } = await supabase
        .from('staff')
        .select('*', { count: 'exact', head: true });

      // Today's check-ins
      const todayDate = new Date().toISOString().split('T')[0];
      const { count: checkInCount } = await supabase
        .from('client_checkins')
        .select('*', { count: 'exact', head: true })
        .eq('checkin_date', todayDate);

      // Calculate total revenue (simplified - could be more complex)
      const { data: packagesData } = await supabase
        .from('packages')
        .select('price');
      
      const totalRevenue = (packagesData || []).reduce((sum, pkg) => 
        sum + (pkg.price || 0), 0
      );

      setGlobalStats({
        totalGyms: gymCount || 0,
        totalUsers: userCount || 0,
        activeGyms: activeGymCount || 0,
        totalRevenue,
        totalStaff: staffCount || 0,
        totalCheckInsToday: checkInCount || 0,
      });
    } catch (error: any) {
      console.error('Error loading global stats:', error);
    }
  };

  const loadGymsData = async () => {
    try {
      // Get all gyms with basic info
      const { data: gymsData, error: gymsError } = await supabase
        .from('gyms')
        .select('*')
        .order('created_at', { ascending: false });

      if (gymsError) throw gymsError;

      // For each gym, get user count, staff count, and recent activity
      const gymsWithStats = await Promise.all(
        (gymsData || []).map(async (gym) => {
          // User count for this gym
          const { count: userCount } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('gym_id', gym.id);

          // Staff count for this gym
          const { count: staffCount } = await supabase
            .from('staff')
            .select('*', { count: 'exact', head: true })
            .eq('gym_id', gym.id);

          // Recent check-ins (last 7 days)
          const lastWeek = new Date();
          lastWeek.setDate(lastWeek.getDate() - 7);
          const { count: recentCheckIns } = await supabase
            .from('client_checkins')
            .select('*', { count: 'exact', head: true })
            .eq('gym_id', gym.id)
            .gte('checkin_date', lastWeek.toISOString().split('T')[0]);

          // Calculate revenue for this gym (simplified)
          const { data: gymPackages } = await supabase
            .from('packages')
            .select('price')
            .eq('gym_id', gym.id);

          const revenue = (gymPackages || []).reduce((sum, pkg) => 
            sum + (pkg.price || 0), 0
          );

          return {
            ...gym,
            user_count: userCount || 0,
            staff_count: staffCount || 0,
            revenue,
            recent_checkins: recentCheckIns || 0,
          };
        })
      );

      setGyms(gymsWithStats);
    } catch (error: any) {
      console.error('Error loading gyms data:', error);
    }
  };

  const loadGrowthData = async () => {
    try {
      const days = growthPeriod === '7d' ? 7 : growthPeriod === '30d' ? 30 : 90;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Get daily user registrations
      const { data: userData } = await supabase
        .from('users')
        .select('created_at')
        .gte('created_at', startDate.toISOString())
        .order('created_at');

      // Get daily gym registrations
      const { data: gymData } = await supabase
        .from('gyms')
        .select('created_at')
        .gte('created_at', startDate.toISOString())
        .order('created_at');

      // Group by date
      const dateMap = new Map<string, { users: number; gyms: number }>();
      
      // Initialize all dates with 0
      for (let i = 0; i < days; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        dateMap.set(dateStr, { users: 0, gyms: 0 });
      }

      // Count users by date
      (userData || []).forEach(user => {
        const date = new Date(user.created_at).toISOString().split('T')[0];
        if (dateMap.has(date)) {
          dateMap.get(date)!.users++;
        }
      });

      // Count gyms by date
      (gymData || []).forEach(gym => {
        const date = new Date(gym.created_at).toISOString().split('T')[0];
        if (dateMap.has(date)) {
          dateMap.get(date)!.gyms++;
        }
      });

      // Convert to array for chart
      const growthArray = Array.from(dateMap.entries()).map(([date, counts]) => ({
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        users: counts.users,
        gyms: counts.gyms,
      }));

      setGrowthData(growthArray);
    } catch (error: any) {
      console.error('Error loading growth data:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAnalyticsData();
    await loadGrowthData();
    setRefreshing(false);
    toast({
      title: "Analytics refreshed",
      description: "All data has been updated with the latest information."
    });
  };

  const handleViewGym = (gym: GymData) => {
    const gymUrl = `/${gym.id}/dashboard`;
    window.open(gymUrl, '_blank');
  };

  // Filter and sort gyms
  const filteredAndSortedGyms = useMemo(() => {
    let filtered = gyms.filter(gym => {
      const matchesSearch = 
        searchTerm === '' ||
        gym.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        gym.owner_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (gym.owner_email && gym.owner_email.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStatus = 
        statusFilter === 'all' || gym.status === statusFilter;

      return matchesSearch && matchesStatus;
    });

    // Sort based on selected option
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'recent':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'alphabetical':
          return a.name.localeCompare(b.name);
        case 'users_desc':
          return b.user_count - a.user_count;
        case 'users_asc':
          return a.user_count - b.user_count;
        case 'revenue_desc':
          return b.revenue - a.revenue;
        default:
          return 0;
      }
    });

    return filtered;
  }, [gyms, searchTerm, statusFilter, sortBy]);

  // Prepare chart data
  const gymStatusData = useMemo(() => {
    const statusCounts = gyms.reduce((acc, gym) => {
      acc[gym.status] = (acc[gym.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(statusCounts).map(([status, count], index) => ({
      name: status.charAt(0).toUpperCase() + status.slice(1),
      value: count,
      color: COLORS[index % COLORS.length]
    }));
  }, [gyms]);

  const topGymsData = useMemo(() => {
    return [...gyms]
      .sort((a, b) => b.user_count - a.user_count)
      .slice(0, 10)
      .map(gym => ({
        name: gym.name.length > 15 ? gym.name.substring(0, 15) + '...' : gym.name,
        users: gym.user_count,
        revenue: gym.revenue
      }));
  }, [gyms]);

  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <SuperAdSidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse text-center">
            <div className="h-8 bg-gray-200 rounded w-64 mb-4"></div>
            <div className="text-gray-500">Loading analytics data...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <SuperAdSidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      
      <div className="flex-1 overflow-y-auto flex flex-col">
        {/* Mobile Header */}
        {isMobile && (
          <div className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={24} />
            </Button>
            <h1 className="font-semibold text-lg text-blue-600">Super Admin</h1>
          </div>
        )}
        <div className="p-4 md:p-6 space-y-6 flex-1">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 
                className="text-3xl font-bold tracking-tight"
                style={{ color: dynamicStyles.primaryColor }}
              >
                Super Admin Analytics
              </h1>
              <p className="text-gray-500 mt-1">
                Comprehensive analytics across all gym locations
              </p>
            </div>
            <Button 
              onClick={handleRefresh} 
              disabled={refreshing}
              className="text-white"
              style={{ backgroundColor: dynamicStyles.primaryColor }}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>

          {/* Global Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <Card style={{ backgroundColor: `${dynamicStyles.primaryColor}08` }}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Building className="h-5 w-5" style={{ color: dynamicStyles.primaryColor }} />
                  <div>
                    <div className="text-2xl font-bold" style={{ color: dynamicStyles.primaryColor }}>
                      {globalStats.totalGyms}
                    </div>
                    <div className="text-sm text-gray-500">Total Gyms</div>
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
                      {globalStats.totalUsers.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-500">Total Users</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card style={{ backgroundColor: `#10b98108` }}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  <div>
                    <div className="text-2xl font-bold text-green-600">
                      {globalStats.activeGyms}
                    </div>
                    <div className="text-sm text-gray-500">Active Gyms</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card style={{ backgroundColor: `${dynamicStyles.secondaryColor}08` }}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" style={{ color: dynamicStyles.secondaryColor }} />
                  <div>
                    <div className="text-2xl font-bold" style={{ color: dynamicStyles.secondaryColor }}>
                      ${globalStats.totalRevenue.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-500">Total Revenue</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card style={{ backgroundColor: `#8b5cf608` }}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-purple-600" />
                  <div>
                    <div className="text-2xl font-bold text-purple-600">
                      {globalStats.totalStaff}
                    </div>
                    <div className="text-sm text-gray-500">Total Staff</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card style={{ backgroundColor: `#06b6d408` }}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-cyan-600" />
                  <div>
                    <div className="text-2xl font-bold text-cyan-600">
                      {globalStats.totalCheckInsToday}
                    </div>
                    <div className="text-sm text-gray-500">Check-ins Today</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {/* Growth Chart */}
            <Card className="xl:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Growth Trends</CardTitle>
                  <p className="text-sm text-gray-500">Daily registrations over time</p>
                </div>
                <Select value={growthPeriod} onValueChange={(v: '7d' | '30d' | '90d') => setGrowthPeriod(v)}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7d">7d</SelectItem>
                    <SelectItem value="30d">30d</SelectItem>
                    <SelectItem value="90d">90d</SelectItem>
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={growthData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="users" stroke={dynamicStyles.primaryColor} strokeWidth={2} name="New Users" />
                    <Line type="monotone" dataKey="gyms" stroke={dynamicStyles.accentColor} strokeWidth={2} name="New Gyms" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Gym Status Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Gym Status Distribution</CardTitle>
                <p className="text-sm text-gray-500">Breakdown by status</p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={gymStatusData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      nameKey="name"
                    >
                      {gymStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Top Gyms Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Top Gyms by User Count</CardTitle>
              <p className="text-sm text-gray-500">Top 10 performing gyms</p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={topGymsData} layout="horizontal" margin={{ left: 100 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={100} />
                  <Tooltip />
                  <Bar dataKey="users" fill={dynamicStyles.primaryColor} name="Users" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Gyms List */}
          <Card>
            <CardHeader>
              <CardTitle>Gym Directory</CardTitle>
              <p className="text-sm text-gray-500">Complete list of all gym locations</p>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search gyms by name, owner, or email..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={(v: SortOption) => setSortBy(v)}>
                  <SelectTrigger className="w-48">
                    <ArrowUpDown className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recent">Recent Onboarded</SelectItem>
                    <SelectItem value="alphabetical">Alphabetical</SelectItem>
                    <SelectItem value="users_desc">Most Users</SelectItem>
                    <SelectItem value="users_asc">Least Users</SelectItem>
                    <SelectItem value="revenue_desc">Highest Revenue</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Gyms Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredAndSortedGyms.length === 0 ? (
                  <div className="col-span-full text-center py-8 text-gray-500">
                    No gyms found matching your criteria
                  </div>
                ) : (
                  filteredAndSortedGyms.map((gym) => (
                    <Card key={gym.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-12 w-12">
                              <AvatarFallback 
                                className="text-white font-bold"
                                style={{ backgroundColor: gym.brand_color || dynamicStyles.primaryColor }}
                              >
                                {gym.name.substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <h3 
                                className="font-semibold text-lg"
                                style={{ color: gym.brand_color || dynamicStyles.primaryColor }}
                              >
                                {gym.name}
                              </h3>
                              <Badge 
                                variant={gym.status === 'active' ? 'default' : 'secondary'}
                                className="text-xs"
                              >
                                {gym.status}
                              </Badge>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2 text-gray-600">
                            <Users className="h-4 w-4" />
                            <span>Owner: {gym.owner_name}</span>
                          </div>
                          {gym.address && (
                            <div className="flex items-center gap-2 text-gray-600">
                              <MapPin className="h-4 w-4" />
                              <span className="truncate">{gym.address}</span>
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t">
                          <div className="text-center">
                            <div className="text-lg font-bold" style={{ color: dynamicStyles.primaryColor }}>
                              {gym.user_count}
                            </div>
                            <div className="text-xs text-gray-500">Users</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-bold" style={{ color: dynamicStyles.accentColor }}>
                              {gym.staff_count}
                            </div>
                            <div className="text-xs text-gray-500">Staff</div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mt-2">
                          <div className="text-center">
                            <div className="text-sm font-semibold text-green-600">
                              ${gym.revenue.toLocaleString()}
                            </div>
                            <div className="text-xs text-gray-500">Revenue</div>
                          </div>
                          <div className="text-center">
                            <div className="text-sm font-semibold text-blue-600">
                              {gym.recent_checkins}
                            </div>
                            <div className="text-xs text-gray-500">Recent Check-ins</div>
                          </div>
                        </div>

                        <div className="flex justify-between items-center mt-4 pt-3 border-t">
                          <div className="text-xs text-gray-500">
                            Created: {new Date(gym.created_at).toLocaleDateString()}
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleViewGym(gym)}
                            style={{ backgroundColor: gym.brand_color || dynamicStyles.primaryColor }}
                            className="text-white"
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            View
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
