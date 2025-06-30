import React, { useState, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Archive, Search, Fingerprint, Eye, EyeOff, Grid3X3, List, Check, X } from 'lucide-react';
import { supabase } from "@/supabaseClient";

const formSchema = z.object({
  first_name: z.string().min(2, { message: "First name is required." }),
  last_name: z.string().min(2, { message: "Last name is required." }),
  email: z.string().email({ message: "Valid email is required." }),
  phone: z.string().min(10, { message: "Phone number is required." }),
  password: z.string().min(8, { message: "Password must be at least 8 characters" }),
  date_of_birth: z.string().optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  role: z.string().min(1, { message: "Role is required." }),
  hire_date: z.string().refine(val => !isNaN(Date.parse(val)), {
    message: "Please enter a valid hire date",
  }),
  salary: z.string().min(1, { message: "Salary is required." }),
});

interface TeamMember {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  date_of_birth?: string;
  gender?: string;
  role_id?: string;
  hire_date: string;
  salary: number;
  fingerprint_enrolled: boolean;
  fingerprint_enrolled_at?: string;
  is_active: boolean;
  created_at: string;
  roles?: {
    id: string;
    name: string;
  };
}

interface Role {
  id: string;
  name: string;
  description?: string;
}

export default function TeamManagement() {
  const { toast } = useToast();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [displayMode, setDisplayMode] = useState<'card' | 'list'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showFingerprintEnrollment, setShowFingerprintEnrollment] = useState(false);
  const [registeredMemberName, setRegisteredMemberName] = useState("");
  const [registeredMemberId, setRegisteredMemberId] = useState("");
  const [fingerprintStatus, setFingerprintStatus] = useState<'idle' | 'enrolling' | 'success' | 'error'>('idle');

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      password: "",
      date_of_birth: "",
      gender: undefined,
      role: "",
      hire_date: "",
      salary: "",
    },
  });

  // Fetch team members and roles
  useEffect(() => {
    fetchTeamMembers();
    fetchRoles();
  }, []);

  const fetchTeamMembers = async () => {
    try {
      console.log('Fetching team members...');
      const { data, error } = await supabase
        .from('staff')
        .select(`
          *,
          roles (
            id,
            name
          )
        `)
        .eq('is_active', true)
        .not('role_id', 'is', null)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching team members:', error);
        toast({
          title: "Error loading team members",
          description: `Could not load team members: ${error.message}`,
          variant: "destructive"
        });
      } else {
        console.log('Team members fetched successfully:', data);
        // Filter out people who have staff roles (admin, trainer, receptionist)
        const staffMembers = data?.filter(person => 
          person.roles && ['admin', 'trainer', 'receptionist'].includes(person.roles.name.toLowerCase())
        ) || [];
        setTeamMembers(staffMembers);
      }
    } catch (error: any) {
      console.error('Unexpected error:', error);
      toast({
        title: "Error loading team members",
        description: `Unexpected error: ${error?.message || 'Unknown error'}`,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const { data, error } = await supabase
        .from('roles')
        .select('*')
        .order('name');

      if (error) {
        console.error('Error fetching roles:', error);
      } else {
        // Filter to only show staff roles
        const staffRoles = data?.filter(role => 
          ['admin', 'trainer', 'receptionist'].includes(role.name.toLowerCase())
        ) || [];
        setRoles(staffRoles);
      }
    } catch (error) {
      console.error('Unexpected error fetching roles:', error);
    }
  };

  // Generate password
  const generatePassword = () => {
    const length = 12;
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    form.setValue("password", password);
    toast({
      title: "Password generated",
      description: "A secure password has been generated.",
    });
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const resetForm = () => {
    form.reset();
    setIsEditing(false);
    setShowPassword(false);
  };

  // Handle form submission
  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      console.log('Starting team member registration with values:', values);

      // Check if email already exists
      const { data: existingUser, error: checkError } = await supabase
        .from('staff')
        .select('id, email')
        .eq('email', values.email)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking email:', checkError);
        toast({
          title: "Registration failed",
          description: `Error checking email: ${checkError.message}`,
          variant: "destructive"
        });
        return;
      }

      if (existingUser) {
        toast({
          title: "Registration failed",
          description: "A person with this email address already exists.",
          variant: "destructive"
        });
        return;
      }

      // Create staff record with role
      const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .insert([
          {
            first_name: values.first_name,
            last_name: values.last_name,
            email: values.email,
            phone: values.phone,
            date_of_birth: values.date_of_birth || null,
            gender: values.gender || null,
            password: values.password, // In production, hash this password
            role_id: values.role,
            hire_date: values.hire_date,
            salary: parseFloat(values.salary),
            is_active: true
          }
        ])
        .select()
        .single();

      if (staffError) {
        console.error('Staff creation error:', staffError);
        toast({
          title: "Registration failed",
          description: `Error: ${staffError.message}`,
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Team member registered successfully",
        description: `${values.first_name} ${values.last_name} has been added to the team.`,
      });

      // Show fingerprint enrollment
      setRegisteredMemberName(`${values.first_name} ${values.last_name}`);
      setRegisteredMemberId(staffData.id);
      setShowFingerprintEnrollment(true);
      
      form.reset();
      setDialogOpen(false);
      fetchTeamMembers();
    } catch (error: any) {
      console.error('Unexpected error during registration:', error);
      toast({
        title: "Registration failed",
        description: `An unexpected error occurred: ${error?.message || 'Unknown error'}`,
        variant: "destructive"
      });
    }
  }

  // Fingerprint enrollment
  const handleFingerprintEnroll = async () => {
    setFingerprintStatus('enrolling');
    
    // Simulate fingerprint enrollment
    setTimeout(async () => {
      try {
        // In a real implementation, you would capture actual fingerprint data
        const mockFingerprintData = {
          template: "mock_fingerprint_template_data",
          quality: 95,
          enrolled_at: new Date().toISOString()
        };

        // Update staff with fingerprint data
        const { error: updateError } = await supabase
          .from('staff')
          .update({
            fingerprint_data: mockFingerprintData,
            fingerprint_enrolled: true,
            fingerprint_enrolled_at: new Date().toISOString()
          })
          .eq('id', registeredMemberId);

        if (updateError) {
          console.error('Error saving fingerprint:', updateError);
          setFingerprintStatus('error');
          toast({
            title: "Fingerprint enrollment failed",
            description: "Could not save fingerprint data",
            variant: "destructive"
          });
        } else {
          setFingerprintStatus('success');
          toast({
            title: "Fingerprint enrolled successfully",
            description: "Team member can now use fingerprint for access.",
          });
          // Refresh team members to show updated fingerprint status
          fetchTeamMembers();
        }
      } catch (error) {
        console.error('Error during fingerprint enrollment:', error);
        setFingerprintStatus('error');
      }
    }, 3000);
  };

  const resetFingerprintSection = () => {
    setShowFingerprintEnrollment(false);
    setFingerprintStatus('idle');
    setRegisteredMemberName("");
    setRegisteredMemberId("");
  };

  // Filter team members
  const filteredMembers = teamMembers.filter(member => {
    const matchesSearch = searchTerm === '' || 
      `${member.first_name} ${member.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email.toLowerCase().includes(searchTerm.toLowerCase());

    if (activeTab === 'all') return matchesSearch;
    
    const memberRole = member.roles?.name.toLowerCase() || '';
    return matchesSearch && memberRole === activeTab;
  });

  // Render member card
  const renderMemberCard = (member: TeamMember) => (
    <Card key={member.id} className="transition-all hover:shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-fitness-primary text-white">
              {member.first_name[0]}{member.last_name[0]}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <p className="font-semibold">{member.first_name} {member.last_name}</p>
            <div className="flex gap-1 mt-1">
              {member.roles && (
                <Badge variant="secondary" className="text-xs">
                  {member.roles.name}
                </Badge>
              )}
            </div>
          </div>
          {member.fingerprint_enrolled && (
            <div className="flex items-center text-green-600">
              <Fingerprint className="h-4 w-4 mr-1" />
              <Check className="h-3 w-3" />
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          <p><span className="font-medium">Email:</span> {member.email}</p>
          <p><span className="font-medium">Phone:</span> {member.phone}</p>
          <p><span className="font-medium">Salary:</span> ${member.salary?.toLocaleString() || '0'}</p>
          <p><span className="font-medium">Hire Date:</span> {new Date(member.hire_date).toLocaleDateString()}</p>
          {member.date_of_birth && (
            <p><span className="font-medium">Date of Birth:</span> {new Date(member.date_of_birth).toLocaleDateString()}</p>
          )}
          <p>
            <span className="font-medium">Fingerprint:</span> 
            <Badge variant={member.fingerprint_enrolled ? "default" : "secondary"} className="ml-2">
              {member.fingerprint_enrolled ? 'Enrolled' : 'Not Enrolled'}
            </Badge>
          </p>
          <p><span className="font-medium">Joined:</span> {new Date(member.created_at).toLocaleDateString()}</p>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" size="sm">
          <Edit className="mr-1 h-4 w-4" /> Edit
        </Button>
        <Button variant="secondary" size="sm">
          <Archive className="mr-1 h-4 w-4" /> Archive
        </Button>
      </CardFooter>
    </Card>
  );

  // Render member list row
  const renderMemberRow = (member: TeamMember) => (
    <TableRow key={member.id}>
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-fitness-primary text-white text-xs">
              {member.first_name[0]}{member.last_name[0]}
            </AvatarFallback>
          </Avatar>
          {member.first_name} {member.last_name}
        </div>
      </TableCell>
      <TableCell>
        {member.roles && (
          <Badge variant="secondary" className="text-xs">
            {member.roles.name}
          </Badge>
        )}
      </TableCell>
      <TableCell>{member.email}</TableCell>
      <TableCell>{member.phone}</TableCell>
      <TableCell>${member.salary?.toLocaleString() || '0'}</TableCell>
      <TableCell>{new Date(member.hire_date).toLocaleDateString()}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          {member.fingerprint_enrolled ? (
            <>
              <Fingerprint className="h-4 w-4 text-green-600" />
              <Badge variant="default" className="text-xs">Enrolled</Badge>
            </>
          ) : (
            <Badge variant="secondary" className="text-xs">Not Enrolled</Badge>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Edit className="h-4 w-4" />
          </Button>
          <Button variant="secondary" size="sm">
            <Archive className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );

  if (isLoading) {
    return (
      <div className="animate-fade-in">
        <h2 className="text-3xl font-bold tracking-tight mb-6">Team Management</h2>
        <div className="text-center py-8">Loading team members...</div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className={`grid gap-6 ${showFingerprintEnrollment ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-bold tracking-tight">Team Management</h2>
            
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-fitness-primary hover:bg-fitness-primary/90 text-white" onClick={resetForm}>
                  <Plus className="mr-2 h-4 w-4" /> Add Team Member
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[525px] max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add New Team Member</DialogTitle>
                  <DialogDescription>
                    Enter the details of the new team member.
                  </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="first_name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>First Name</FormLabel>
                            <FormControl>
                              <Input placeholder="John" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="last_name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Last Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Doe" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input placeholder="john@fitnesshub.com" type="email" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone</FormLabel>
                            <FormControl>
                              <Input placeholder="+1 234 567 8900" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <FormControl>
                                <Input 
                                  placeholder="Enter password" 
                                  type={showPassword ? "text" : "password"} 
                                  {...field} 
                                  className="pr-10"
                                />
                              </FormControl>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                onClick={togglePasswordVisibility}
                              >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </Button>
                            </div>
                            <Button type="button" variant="outline" size="sm" onClick={generatePassword}>
                              Generate
                            </Button>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="role"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Role</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select role" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {roles.map((role) => (
                                  <SelectItem key={role.id} value={role.id}>
                                    {role.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="gender"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Gender (Optional)</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                        control={form.control}
                        name="hire_date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Hire Date</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="salary"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Salary</FormLabel>
                            <FormControl>
                              <Input placeholder="50000" type="number" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="date_of_birth"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date of Birth (Optional)</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <DialogFooter>
                      <Button variant="outline" type="button" onClick={() => setDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" className="bg-fitness-primary hover:bg-fitness-primary/90 text-white">
                        Add Team Member
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                type="search"
                placeholder="Search team members..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="flex items-center gap-2 ml-auto">
              <Button
                variant={displayMode === 'card' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDisplayMode('card')}
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant={displayMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDisplayMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="all">All ({filteredMembers.length})</TabsTrigger>
              <TabsTrigger value="admin">Admins</TabsTrigger>
              <TabsTrigger value="trainer">Trainers</TabsTrigger>
              <TabsTrigger value="receptionist">Receptionists</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-6">
              {displayMode === 'card' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {filteredMembers.length === 0 ? (
                    <div className="col-span-full text-center py-8 text-gray-500">
                      No team members found. Add your first team member to get started.
                    </div>
                  ) : (
                    filteredMembers.map(renderMemberCard)
                  )}
                </div>
              ) : (
                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Salary</TableHead>
                        <TableHead>Hire Date</TableHead>
                        <TableHead>Fingerprint</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMembers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                            No team members found. Add your first team member to get started.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredMembers.map(renderMemberRow)
                      )}
                    </TableBody>
                  </Table>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="admin" className="mt-6">
              {displayMode === 'card' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {filteredMembers.map(renderMemberCard)}
                </div>
              ) : (
                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Salary</TableHead>
                        <TableHead>Hire Date</TableHead>
                        <TableHead>Fingerprint</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMembers.map(renderMemberRow)}
                    </TableBody>
                  </Table>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="trainer" className="mt-6">
              {displayMode === 'card' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {filteredMembers.map(renderMemberCard)}
                </div>
              ) : (
                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Salary</TableHead>
                        <TableHead>Hire Date</TableHead>
                        <TableHead>Fingerprint</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMembers.map(renderMemberRow)}
                    </TableBody>
                  </Table>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="receptionist" className="mt-6">
              {displayMode === 'card' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {filteredMembers.map(renderMemberCard)}
                </div>
              ) : (
                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Salary</TableHead>
                        <TableHead>Hire Date</TableHead>
                        <TableHead>Fingerprint</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMembers.map(renderMemberRow)}
                    </TableBody>
                  </Table>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Fingerprint Enrollment Section */}
        {showFingerprintEnrollment && (
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Fingerprint className="h-6 w-6" />
                Fingerprint Enrollment
              </CardTitle>
              <CardDescription>
                Enroll {registeredMemberName}'s fingerprint for secure access.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center">
                <div className="mx-auto w-32 h-32 bg-gradient-to-b from-teal-400 to-teal-600 rounded-full flex items-center justify-center mb-4">
                  <Fingerprint className="w-16 h-16 text-white" />
                </div>
                
                {fingerprintStatus === 'idle' && (
                  <div className="space-y-4">
                    <p className="text-gray-600">
                      Touch the fingerprint sensor to enroll {registeredMemberName}'s fingerprint
                    </p>
                    <Button 
                      onClick={handleFingerprintEnroll}
                      className="bg-teal-600 hover:bg-teal-700 text-white"
                    >
                      Start Fingerprint Enrollment
                    </Button>
                  </div>
                )}

                {fingerprintStatus === 'enrolling' && (
                  <div className="space-y-4">
                    <div className="animate-pulse">
                      <div className="w-4 h-4 bg-teal-600 rounded-full mx-auto mb-2"></div>
                      <p className="text-teal-600 font-medium">
                        Enrolling fingerprint...
                      </p>
                      <p className="text-sm text-gray-500">
                        Please keep finger on sensor
                      </p>
                    </div>
                    <div className="flex justify-center">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-teal-600 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-teal-600 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                        <div className="w-2 h-2 bg-teal-600 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                      </div>
                    </div>
                  </div>
                )}

                {fingerprintStatus === 'success' && (
                  <div className="space-y-4">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                      <Check className="w-8 h-8 text-green-600" />
                    </div>
                    <p className="text-green-600 font-medium">
                      Fingerprint enrolled successfully!
                    </p>
                    <p className="text-sm text-gray-500">
                      {registeredMemberName} can now use fingerprint for access
                    </p>
                  </div>
                )}

                {fingerprintStatus === 'error' && (
                  <div className="space-y-4">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                      <X className="w-8 h-8 text-red-600" />
                    </div>
                    <p className="text-red-600 font-medium">
                      Fingerprint enrollment failed!
                    </p>
                    <p className="text-sm text-gray-500">
                      Please try again or contact support
                    </p>
                    <Button 
                      onClick={() => setFingerprintStatus('idle')}
                      variant="outline"
                    >
                      Try Again
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button 
                variant="outline" 
                onClick={resetFingerprintSection}
              >
                Add Another Member
              </Button>
              {fingerprintStatus === 'success' && (
                <Button 
                  className="bg-fitness-primary hover:bg-fitness-primary/90 text-white"
                  onClick={resetFingerprintSection}
                >
                  Complete Setup
                </Button>
              )}
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  );
}
