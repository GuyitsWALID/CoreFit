import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/supabaseClient';
import { Search, Users, Package, Mail, Phone, Filter, MoreHorizontal, Eye } from 'lucide-react';

interface Trainer {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  hire_date: string;
  is_active: boolean;
  member_count: number;
  packages: Array<{
    id: string;
    name: string;
    price: number;
  }>;
  members: Array<{
    id: string;
    full_name: string;
    package_name: string;
    membership_expiry: string;
    status: string;
  }>;
  // Add one-to-one coaching properties
  one_to_one_count: number;
  one_to_one_members: Array<{
    id: string;
    full_name: string;
    session_count: number;
    last_session: string;
    status: string;
  }>;
}
// TrainersList.tsx (at the top)
type MemberRow = {
  user_id:           string;
  first_name:        string;
  last_name:         string;
  membership_expiry: string;
  status:            string;
  package_name:      string;
};

type Assignment = {
  user_id: string;
  users: {
    id: string;
    first_name: string;
    last_name: string;
    membership_expiry: string;
    status: string;
    packages: { id: string; name: string }[];
  };
};

export default function TrainersList() {
  const { toast } = useToast();
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [filteredTrainers, setFilteredTrainers] = useState<Trainer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [packageFilter, setPackageFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [availablePackages, setAvailablePackages] = useState<Array<{id: string, name: string}>>([]);
  const [selectedTrainer, setSelectedTrainer] = useState<Trainer | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  // Add coaching type state
  const [coachingType, setCoachingType] = useState<'package' | 'one-to-one'>('package');

  useEffect(() => {
    fetchTrainers();
    fetchPackages();
  }, []);

  useEffect(() => {
    filterAndSortTrainers();
  }, [trainers, searchTerm, statusFilter, packageFilter, sortBy, coachingType]);

  const fetchTrainers = async () => {
    setIsLoading(true);
    try {
      // 1) Fetch the trainer role ID
      const { data: trainerRole, error: roleError } = await supabase
        .from('roles')
        .select('id')
        .eq('name', 'trainer')
        .single();
      if (roleError || !trainerRole) throw roleError ?? new Error('Trainer role not found');

      // 2) Fetch all active staff with role = trainer
      const { data: trainersData, error: staffError } = await supabase
        .from('staff')
        .select(`
          id,
          first_name,
          last_name,
          email,
          phone,
          hire_date,
          is_active
        `)
        .eq('role_id', trainerRole.id)
        .order('first_name');
      if (staffError || !trainersData) throw staffError ?? new Error('No trainers returned');

      // 3) For each trainer, fetch both package-based and one-to-one assignments
      const trainersWithDetails = await Promise.all(
        trainersData.map(async (trainer) => {
          // Fetch package-based members
          const { data: memberRows, error: memberError } = await supabase
            .from('trainer_member_details')
            .select(`
              user_id,
              first_name,
              last_name,
              membership_expiry,
              status,
              package_name
            `)
            .eq('trainer_id', trainer.id);

          if (memberError) throw memberError;

          const formattedMembers = (memberRows || []).map(row => ({
            id: row.user_id,
            full_name: `${row.first_name} ${row.last_name}`,
            package_name: row.package_name,
            membership_expiry: row.membership_expiry,
            status: row.status,
          }));

          // Initialize one-to-one data
          let oneToOneMembers: any[] = [];
          
          // Fetch one-to-one coaching assignments using the correct table
          try {
            const { data: oneToOneRows, error: oneToOneError } = await supabase
              .from('one_to_one_coaching')
              .select(`
                id,
                user_id,
                hourly_rate,
                days_per_week,
                hours_per_session,
                start_date,
                end_date,
                status,
                users!inner (
                  id,
                  first_name,
                  last_name,
                  status
                )
              `)
              .eq('trainer_id', trainer.id)
              .eq('status', 'active');

            if (!oneToOneError && oneToOneRows) {
              // Format one-to-one members and fetch their session data
              oneToOneMembers = await Promise.all(
                oneToOneRows.map(async (coaching: any) => {
                  // Fetch session count and last session for this member
                  const { data: sessions } = await supabase
                    .from('training_sessions')
                    .select('id, session_date')
                    .eq('trainer_id', trainer.id)
                    .eq('user_id', coaching.user_id)
                    .order('session_date', { ascending: false });

                  const sessionCount = sessions?.length || 0;
                  const lastSession = sessions && sessions.length > 0 ? sessions[0].session_date : null;

                  return {
                    id: coaching.user_id,
                    full_name: `${coaching.users.first_name} ${coaching.users.last_name}`,
                    session_count: sessionCount,
                    last_session: lastSession || 'No sessions yet',
                    status: coaching.users.status,
                    hourly_rate: coaching.hourly_rate,
                    days_per_week: coaching.days_per_week,
                    hours_per_session: coaching.hours_per_session,
                    start_date: coaching.start_date,
                    end_date: coaching.end_date,
                    coaching_status: coaching.status,
                  };
                })
              );
            }
          } catch (e) {
            // If one-to-one tables don't exist, just continue with empty array
            oneToOneMembers = [];
          }

          // Fetch packages they could be assigned to
          const { data: packages } = await supabase
            .from('packages')
            .select('id, name, price')
            .eq('requires_trainer', true)
            .order('name');

          return {
            ...trainer,
            member_count: formattedMembers.length,
            packages: packages ?? [],
            members: formattedMembers,
            one_to_one_count: oneToOneMembers.length,
            one_to_one_members: oneToOneMembers,
          };
        })
      );

      setTrainers(trainersWithDetails);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch trainers data",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };


  const fetchPackages = async () => {
    const { data } = await supabase
      .from('packages')
      .select('id, name')
      .eq('requires_trainer', true)
      .order('name');
    
    setAvailablePackages(data || []);
  };

  const filterAndSortTrainers = () => {
    let filtered = trainers.filter(trainer => {
      const matchesSearch = 
        searchTerm === '' ||
        trainer.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        trainer.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        trainer.email.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = 
        statusFilter === 'all' ||
        (statusFilter === 'active' && trainer.is_active) ||
        (statusFilter === 'inactive' && !trainer.is_active);

      const matchesPackage = 
        packageFilter === 'all' ||
        trainer.packages.some(pkg => pkg.id === packageFilter);

      return matchesSearch && matchesStatus && matchesPackage;
    });

    // Sort trainers
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
        case 'members':
          const aCount = coachingType === 'package' ? a.member_count : a.one_to_one_count;
          const bCount = coachingType === 'package' ? b.member_count : b.one_to_one_count;
          return bCount - aCount;
        case 'hire_date':
          return new Date(b.hire_date).getTime() - new Date(a.hire_date).getTime();
        default:
          return 0;
      }
    });

    setFilteredTrainers(filtered);
  };

  const handleViewDetails = (trainer: Trainer) => {
    setSelectedTrainer(trainer);
    setShowDetails(true);
  };

  const TrainerCard = ({ trainer }: { trainer: Trainer }) => {
    const memberCount = coachingType === 'package' ? trainer.member_count : trainer.one_to_one_count;
    
    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="bg-fitness-primary text-white text-lg font-bold">
                  {trainer.first_name[0]}{trainer.last_name[0]}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-lg">
                    {trainer.first_name} {trainer.last_name}
                  </h3>
                  <Badge variant={trainer.is_active ? "default" : "secondary"}>
                    {trainer.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Mail className="h-4 w-4" />
                  {trainer.email}
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Phone className="h-4 w-4" />
                  {trainer.phone}
                </div>
              </div>
            </div>
            <div className="text-right space-y-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-gray-500" />
                <span className="font-semibold">{memberCount}</span>
                <span className="text-sm text-gray-600">
                  {coachingType === 'package' ? 'members' : 'clients'}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleViewDetails(trainer)}
              >
                <Eye className="h-4 w-4 mr-2" />
                View Details
              </Button>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <div>
                {coachingType === 'package' ? (
                  <>
                    <span className="text-sm text-gray-600">Assigned Packages:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {trainer.packages.length > 0 ? (
                        trainer.packages.map(pkg => (
                          <Badge key={pkg.id} variant="outline" className="text-xs">
                            {pkg.name}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-gray-400">No packages assigned</span>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <span className="text-sm text-gray-600">One-to-One Coaching:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {trainer.one_to_one_count} Active Clients
                      </Badge>
                    </div>
                  </>
                )}
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-600">
                  Joined: {new Date(trainer.hire_date).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const TrainerDetailsModal = () => {
    if (!selectedTrainer || !showDetails) return null;

    const currentMembers = coachingType === 'package' ? selectedTrainer.members : selectedTrainer.one_to_one_members;
    const memberCount = coachingType === 'package' ? selectedTrainer.member_count : selectedTrainer.one_to_one_count;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowDetails(false)} />
        <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-6 border-b">
            <h2 className="text-xl font-semibold">
              {selectedTrainer.first_name} {selectedTrainer.last_name} - {coachingType === 'package' ? 'Package Based' : 'One-to-One'} Details
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDetails(false)}
              className="h-6 w-6 p-0"
            >
              ×
            </Button>
          </div>
          
          <div className="p-6 space-y-6">
            {/* Trainer Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="font-semibold mb-2">Trainer Information</h3>
                <div className="space-y-2 text-sm">
                  <div><strong>Email:</strong> {selectedTrainer.email}</div>
                  <div><strong>Phone:</strong> {selectedTrainer.phone}</div>
                  <div><strong>Hire Date:</strong> {new Date(selectedTrainer.hire_date).toLocaleDateString()}</div>
                  <div><strong>Status:</strong> 
                    <Badge variant={selectedTrainer.is_active ? "default" : "secondary"} className="ml-2">
                      {selectedTrainer.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Statistics</h3>
                <div className="space-y-2 text-sm">
                  <div><strong>Package Members:</strong> {selectedTrainer.member_count}</div>
                  <div><strong>One-to-One Clients:</strong> {selectedTrainer.one_to_one_count}</div>
                  <div><strong>Assigned Packages:</strong> {selectedTrainer.packages.length}</div>
                </div>
              </div>
            </div>

            {/* Members/Clients List */}
            <div>
              <h3 className="font-semibold mb-3">
                {coachingType === 'package' ? `Assigned Members (${memberCount})` : `One-to-One Clients (${memberCount})`}
              </h3>
              {currentMembers.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-sm font-medium">
                          {coachingType === 'package' ? 'Member Name' : 'Client Name'}
                        </th>
                        {coachingType === 'package' ? (
                          <>
                            <th className="px-4 py-2 text-left text-sm font-medium">Package</th>
                            <th className="px-4 py-2 text-left text-sm font-medium">Expiry Date</th>
                          </>
                        ) : (
                          <>
                            <th className="px-4 py-2 text-left text-sm font-medium">Hourly Rate</th>
                            <th className="px-4 py-2 text-left text-sm font-medium">Schedule</th>
                            <th className="px-4 py-2 text-left text-sm font-medium">Start Date</th>
                          </>
                        )}
                        <th className="px-4 py-2 text-left text-sm font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {currentMembers.map(member => (
                        <tr key={member.id}>
                          <td className="px-4 py-2 text-sm">{member.full_name}</td>
                          {coachingType === 'package' ? (
                            <>
                              <td className="px-4 py-2 text-sm">
                                <Badge variant="outline">{(member as any).package_name}</Badge>
                              </td>
                              <td className="px-4 py-2 text-sm">
                                {new Date((member as any).membership_expiry).toLocaleDateString()}
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-4 py-2 text-sm">
                                ${(member as any).hourly_rate}/hr
                              </td>
                              <td className="px-4 py-2 text-sm">
                                {(member as any).days_per_week} days/week, {(member as any).hours_per_session}h/session
                              </td>
                              <td className="px-4 py-2 text-sm">
                                {new Date((member as any).start_date).toLocaleDateString()}
                              </td>
                            </>
                          )}
                          <td className="px-4 py-2 text-sm">
                            <Badge variant={member.status === 'active' ? 'default' : 'secondary'}>
                              {member.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  {coachingType === 'package' 
                    ? 'No members assigned to this trainer' 
                    : 'No one-to-one clients assigned to this trainer'
                  }
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="animate-fade-in py-24 text-center text-gray-500">
        Loading trainers data...
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Trainers List</h2>
          <p className="text-gray-500 mt-1">Manage trainers and view their member assignments</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="px-3 py-1">
            Total: {trainers.length} trainers
          </Badge>
          <Badge variant="outline" className="px-3 py-1">
            Active: {trainers.filter(t => t.is_active).length}
          </Badge>
        </div>
      </div>

      {/* Coaching Type Toggle */}
      
        <CardContent className="p-6">
          <div className="flex justify-center">
            <div className="flex bg-gray-100 rounded-full p-1 w-full max-w-md">
              <Button
                variant={coachingType === 'package' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setCoachingType('package')}
                className={`flex-1 py-2 rounded-full font-medium transition-all duration-200 ${
                  coachingType === 'package' 
                    ? 'bg-white shadow-sm text-gray-900 hover:bg-white' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-transparent'
                }`}
              >
                <Package className="h-4 w-4 mr-2" />
                Package Based
              </Button>
              <Button
                variant={coachingType === 'one-to-one' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setCoachingType('one-to-one')}
                className={`flex-1 py-2 rounded-full font-medium transition-all duration-200 ${
                  coachingType === 'one-to-one' 
                    ? 'bg-white shadow-sm text-gray-900 hover:bg-white' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-transparent'
                }`}
              >
                <Users className="h-4 w-4 mr-2" />
                One-to-One
              </Button>
            </div>
          </div>
        </CardContent>
      

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search trainers by name, email, or specialization..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            {coachingType === 'package' && (
              <Select value={packageFilter} onValueChange={setPackageFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Package" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Packages</SelectItem>
                  {availablePackages.map(pkg => (
                    <SelectItem key={pkg.id} value={pkg.id}>{pkg.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="members">{coachingType === 'package' ? 'Member Count' : 'Client Count'}</SelectItem>
                <SelectItem value="hire_date">Hire Date</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-fitness-primary" />
              <div>
                <div className="text-2xl font-bold">{trainers.filter(t => t.is_active).length}</div>
                <div className="text-sm text-gray-500">Active Trainers</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-fitness-primary" />
              <div>
                <div className="text-2xl font-bold">
                  {coachingType === 'package' 
                    ? trainers.reduce((sum, t) => sum + t.member_count, 0)
                    : trainers.reduce((sum, t) => sum + t.one_to_one_count, 0)
                  }
                </div>
                <div className="text-sm text-gray-500">
                  {coachingType === 'package' ? 'Total Members' : 'Total Clients'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-fitness-primary" />
              <div>
                <div className="text-2xl font-bold">
                  {trainers.length > 0 ? Math.round(
                    (coachingType === 'package' 
                      ? trainers.reduce((sum, t) => sum + t.member_count, 0)
                      : trainers.reduce((sum, t) => sum + t.one_to_one_count, 0)
                    ) / trainers.filter(t => t.is_active).length
                  ) || 0 : 0}
                </div>
                <div className="text-sm text-gray-500">
                  Avg {coachingType === 'package' ? 'Members' : 'Clients'}/Trainer
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-fitness-primary" />
              <div>
                <div className="text-2xl font-bold">
                  {coachingType === 'package' ? availablePackages.length : trainers.filter(t => t.one_to_one_count > 0).length}
                </div>
                <div className="text-sm text-gray-500">
                  {coachingType === 'package' ? 'Available Packages' : 'Active 1-on-1 Trainers'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trainers List */}
      <div className="space-y-4">
        {filteredTrainers.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="text-gray-500">No trainers found matching your filters</div>
            </CardContent>
          </Card>
        ) : (
          filteredTrainers.map(trainer => (
            <TrainerCard key={trainer.id} trainer={trainer} />
          ))
        )}
      </div>

      {/* Trainer Details Modal */}
      <TrainerDetailsModal />
    </div>
  );
}
