import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { Search, Plus, Building, MapPin, Mail, Phone, Filter, MoreHorizontal, Eye, ArrowLeft, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye as EyeIcon, EyeOff } from 'lucide-react';
import { SuperAdSidebar } from '@/pages/admin/superAdSidebar';

interface Gym {
  id: string;
  name: string;
  owner_name: string;
  owner_phone?: string;
  owner_email?: string;
  street?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  address?: string;
  timezone?: string;
  brand_color?: string;
  amenities?: string[];
  tags?: string[];
  max_capacity?: number;
  latitude?: number;
  longitude?: number;
  description?: string;
  status: 'active' | 'inactive' | 'pending' | 'archived';
  created_at: string;
  updated_at?: string;
  deleted_at?: string;
}

// Update admin creation form schema to include role selection
const adminFormSchema = z.object({
  first_name: z.string().min(2, "First name is required"),
  last_name: z.string().min(2, "Last name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().min(10, "Phone number is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  date_of_birth: z.string().optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  hire_date: z.string().refine(val => !isNaN(Date.parse(val)), "Valid hire date is required"),
  salary: z.string().min(1, "Salary is required"),
  role_id: z.string().min(1, "Role is required"), // Add role selection
});

export default function AdminGyms() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [filteredGyms, setFilteredGyms] = useState<Gym[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');

  // Add admin creation modal state
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [selectedGymForAdmin, setSelectedGymForAdmin] = useState<Gym | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [creatingAdmin, setCreatingAdmin] = useState(false);

  // Add roles state
  const [roles, setRoles] = useState<Array<{id: string, name: string, description?: string}>>([]);

  const adminForm = useForm<z.infer<typeof adminFormSchema>>({
    resolver: zodResolver(adminFormSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      password: "",
      date_of_birth: "",
      gender: undefined,
      hire_date: new Date().toISOString().split('T')[0], // Today's date
      salary: "",
      role_id: "", // Add role_id to defaults
    },
  });

  useEffect(() => {
    fetchGyms();
  }, []);

  useEffect(() => {
    filterAndSortGyms();
  }, [gyms, searchTerm, statusFilter, sortBy]);

  // Add useEffect to fetch roles
  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchGyms = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('gyms')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        toast({
          title: "Error",
          description: error.message || "Failed to fetch gyms",
          variant: "destructive"
        });
      } else {
        setGyms(data || []);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Add function to fetch roles
  const fetchRoles = async () => {
    try {
      const { data, error } = await supabase
        .from('roles')
        .select('id, name, description')
        .order('name');

      if (error) {
        console.error('Error fetching roles:', error);
        toast({
          title: "Error loading roles",
          description: "Could not load available roles",
          variant: "destructive"
        });
      } else {
        setRoles(data || []);
      }
    } catch (error: any) {
      console.error('Unexpected error fetching roles:', error);
      toast({
        title: "Error loading roles", 
        description: error.message || "An unexpected error occurred",
        variant: "destructive"
      });
    }
  };

  const filterAndSortGyms = () => {
    let filtered = gyms.filter(gym => {
      const matchesSearch = 
        searchTerm === '' ||
        gym.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        gym.owner_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (gym.owner_email && gym.owner_email.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStatus = 
        statusFilter === 'all' ||
        gym.status === statusFilter;

      return matchesSearch && matchesStatus;
    });

    // Sort gyms
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'owner':
          return a.owner_name.localeCompare(b.owner_name);
        case 'created':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'status':
          return a.status.localeCompare(b.status);
        default:
          return 0;
      }
    });

    setFilteredGyms(filtered);
  };

  const handleViewGym = (gym: Gym) => {
    // Navigate to the specific gym's dashboard using the gym ID
    const gymUrl = `/${gym.id}/dashboard`;
    window.open(gymUrl, '_blank');
  };

  const handleAddGym = () => {
    navigate('/admin/onboard');
  };

  const handleCreateGymAdmin = (gym: Gym) => {
    setSelectedGymForAdmin(gym);
    setAdminModalOpen(true);
    adminForm.reset({
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      password: "",
      date_of_birth: "",
      gender: undefined,
      hire_date: new Date().toISOString().split('T')[0],
      salary: "",
      role_id: "", // Reset role_id
    });
  };

  const generatePassword = () => {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < 12; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    adminForm.setValue("password", password);
    toast({
      title: "Password generated",
      description: "A secure password has been generated.",
    });
  };

  const onSubmitAdmin = async (values: z.infer<typeof adminFormSchema>) => {
    if (!selectedGymForAdmin) return;
    
    setCreatingAdmin(true);
    try {
      // 1. Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
      });

      if (authError) {
        throw new Error(`Auth creation failed: ${authError.message}`);
      }

      if (!authData.user) {
        throw new Error("No user returned from auth signup");
      }

      // 2. Use the selected role ID instead of hardcoded lookup
      const selectedRole = roles.find(role => role.id === values.role_id);
      if (!selectedRole) {
        throw new Error("Selected role not found");
      }

      // 3. Generate QR code for the staff member
      const qrData = JSON.stringify({
        staffId: authData.user.id,
        firstName: values.first_name,
        lastName: values.last_name,
        roleId: values.role_id,
      });

      // 4. Create staff record with gym association using correct schema
      const staffData = {
        id: authData.user.id,
        first_name: values.first_name,
        last_name: values.last_name,
        full_name: `${values.first_name} ${values.last_name}`,
        email: values.email,
        phone: values.phone || null,
        date_of_birth: values.date_of_birth ? new Date(values.date_of_birth).toISOString().split('T')[0] : null,
        gender: values.gender || null,
        role_id: values.role_id, // Use selected role
        gym_id: selectedGymForAdmin.id,
        hire_date: new Date(values.hire_date).toISOString().split('T')[0],
        salary: parseFloat(values.salary),
        is_active: true,
        qr_code: qrData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error: staffError } = await supabase
        .from('staff')
        .insert([staffData]);

      if (staffError) {
        throw new Error(`Staff creation failed: ${staffError.message}`);
      }

      toast({
        title: "Gym Admin Created",
        description: `${selectedRole.name} for ${selectedGymForAdmin.name} has been created successfully.`,
      });

      setAdminModalOpen(false);
      setSelectedGymForAdmin(null);
      adminForm.reset();

    } catch (error: any) {
      toast({
        title: "Admin Creation Failed",
        description: error.message || "An error occurred while creating the gym admin.",
        variant: "destructive"
      });
    } finally {
      setCreatingAdmin(false);
    }
  };

  const GymCard = ({ gym }: { gym: Gym }) => {
    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback 
                  className="text-white text-lg font-bold"
                  style={{ backgroundColor: gym.brand_color || '#2563eb' }}
                >
                  {gym.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-lg" style={{ color: gym.brand_color || '#2563eb' }}>
                    {gym.name}
                  </h3>
                  <Badge variant={gym.status === 'active' ? "default" : "secondary"}>
                    {gym.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Building className="h-4 w-4" />
                  Owner: {gym.owner_name}
                </div>
                {gym.owner_email && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail className="h-4 w-4" />
                    {gym.owner_email}
                  </div>
                )}
                {gym.owner_phone && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone className="h-4 w-4" />
                    {gym.owner_phone}
                  </div>
                )}
                {gym.address && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <MapPin className="h-4 w-4" />
                    {gym.address}
                  </div>
                )}
              </div>
            </div>
            <div className="text-right space-y-2">
              <div className="text-sm text-gray-500">
                ID: {gym.id.substring(0, 8)}...
              </div>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleViewGym(gym)}
                  className="w-full"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View Workspace
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => handleCreateGymAdmin(gym)}
                  className="w-full"
                  style={{ backgroundColor: gym.brand_color || '#2563eb' }}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Create Gym Admin
                </Button>
              </div>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <div>
                {gym.description && (
                  <p className="text-sm text-gray-600 mb-2">{gym.description}</p>
                )}
                {gym.amenities && gym.amenities.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {gym.amenities.slice(0, 3).map((amenity, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {amenity}
                      </Badge>
                    ))}
                    {gym.amenities.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{gym.amenities.length - 3} more
                      </Badge>
                    )}
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-600">
                  Created: {new Date(gym.created_at).toLocaleDateString()}
                </div>
                {gym.max_capacity && (
                  <div className="text-sm text-gray-600">
                    Capacity: {gym.max_capacity}
                  </div>
                )}
              </div>
            </div>
          </div>
          </CardContent>
        </Card>
      );
    };

  if (isLoading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <SuperAdSidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-64 mb-4"></div>
            <div className="grid grid-cols-1 gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-32 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <SuperAdSidebar />
      
      <div className="flex-1 overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">Gym Management</h2>
              <p className="text-gray-500 mt-1">Manage gym workspaces and configurations</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="px-3 py-1">
                Total: {gyms.length} gyms
              </Badge>
              <Badge variant="outline" className="px-3 py-1">
                Active: {gyms.filter(g => g.status === 'active').length}
              </Badge>
              <Button onClick={handleAddGym}>
                <Plus className="h-4 w-4 mr-2" />
                Add Gym
              </Button>
            </div>
          </div>

          {/* Filters */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
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
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="owner">Owner</SelectItem>
                    <SelectItem value="created">Created Date</SelectItem>
                    <SelectItem value="status">Status</SelectItem>
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
                  <Building className="h-5 w-5 text-blue-600" />
                  <div>
                    <div className="text-2xl font-bold">{gyms.filter(g => g.status === 'active').length}</div>
                    <div className="text-sm text-gray-500">Active Gyms</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Building className="h-5 w-5 text-yellow-600" />
                  <div>
                    <div className="text-2xl font-bold">{gyms.filter(g => g.status === 'pending').length}</div>
                    <div className="text-sm text-gray-500">Pending</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Building className="h-5 w-5 text-gray-600" />
                  <div>
                    <div className="text-2xl font-bold">{gyms.filter(g => g.status === 'inactive').length}</div>
                    <div className="text-sm text-gray-500">Inactive</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Building className="h-5 w-5 text-green-600" />
                  <div>
                    <div className="text-2xl font-bold">{gyms.length}</div>
                    <div className="text-sm text-gray-500">Total Gyms</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Gyms List */}
          <div className="space-y-4">
            {filteredGyms.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <div className="text-gray-500">
                    {gyms.length === 0 
                      ? "No gyms found. Start by adding your first gym!" 
                      : "No gyms found matching your filters"
                    }
                  </div>
                  {gyms.length === 0 && (
                    <Button onClick={handleAddGym} className="mt-4">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Your First Gym
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              filteredGyms.map(gym => (
                <GymCard key={gym.id} gym={gym} />
              ))
            )}
          </div>

          {/* Create Gym Admin Modal */}
          <Dialog open={adminModalOpen} onOpenChange={setAdminModalOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Gym Admin</DialogTitle>
                <DialogDescription>
                  Create an admin user for {selectedGymForAdmin?.name}. This admin will have access to manage this specific gym.
                </DialogDescription>
              </DialogHeader>
              
              <Form {...adminForm}>
                <form onSubmit={adminForm.handleSubmit(onSubmitAdmin)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={adminForm.control}
                      name="first_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="John" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={adminForm.control}
                      name="last_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="Doe" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={adminForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email *</FormLabel>
                        <FormControl>
                          <Input placeholder="admin@gym.com" type="email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={adminForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone *</FormLabel>
                        <FormControl>
                          <Input placeholder="+1234567890" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Add Role Selection */}
                  <FormField
                    control={adminForm.control}
                    name="role_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {roles.map((role) => (
                              <SelectItem key={role.id} value={role.id}>
                                {role.name}
                                {role.description && (
                                  <span className="text-sm text-gray-500 ml-2">
                                    - {role.description}
                                  </span>
                                )}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={adminForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password *</FormLabel>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <FormControl>
                              <Input
                                placeholder="Enter password"
                                type={showPassword ? "text" : "password"}
                                {...field}
                              />
                            </FormControl>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                              onClick={() => setShowPassword(!showPassword)}
                            >
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                            </Button>
                          </div>
                          <Button type="button" onClick={generatePassword} variant="outline">
                            Generate
                          </Button>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={adminForm.control}
                      name="date_of_birth"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date of Birth</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={adminForm.control}
                      name="gender"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Gender</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select gender" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="male">Male</SelectItem>
                              <SelectItem value="female">Female</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={adminForm.control}
                      name="hire_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Hire Date *</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={adminForm.control}
                      name="salary"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Salary *</FormLabel>
                          <FormControl>
                            <Input placeholder="50000" type="number" step="0.01" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </form>
              </Form>

              <DialogFooter>
                <Button variant="outline" onClick={() => setAdminModalOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={adminForm.handleSubmit(onSubmitAdmin)} 
                  disabled={creatingAdmin}
                  style={{ backgroundColor: selectedGymForAdmin?.brand_color || '#2563eb' }}
                >
                  {creatingAdmin ? 'Creating...' : 'Create Admin'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
