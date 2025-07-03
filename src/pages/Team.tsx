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
import FingerprintScannerCard from "@/components/FingerprintScannerCard";
import { Switch } from "@/components/ui/switch";
import { Dialog as ConfirmDialog, DialogContent as ConfirmDialogContent, DialogHeader as ConfirmDialogHeader, DialogTitle as ConfirmDialogTitle, DialogFooter as ConfirmDialogFooter } from "@/components/ui/dialog";

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
  fingerprint_enrolled: z.boolean().optional(), // Add this field
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
  const [fingerprintStatus, setFingerprintStatus] = useState<'idle' | 'scanning' | 'success' | 'error'>('idle');
  const [fingerprintData, setFingerprintData] = useState<Uint8Array | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editMember, setEditMember] = useState<TeamMember | null>(null);
  const [confirmActiveDialog, setConfirmActiveDialog] = useState(false);
  const [pendingActiveMember, setPendingActiveMember] = useState<TeamMember | null>(null);

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
      fingerprint_enrolled: false, // Add this default value
    },
  });

  // Fetch team members and roles
  useEffect(() => {
    fetchTeamMembers();
    fetchRoles();
  }, []);

  const fetchTeamMembers = async () => {
    try {
      // Remove .eq('is_active', true) to fetch all staff, active and inactive
      const { data, error } = await supabase
        .from('staff')
        .select(`
          *,
          roles (
            id,
            name
          )
        `)
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
      // 1. Register with Supabase Auth
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
      });

      if (signUpError) {
        toast({
          title: "Registration failed",
          description: signUpError.message,
          variant: "destructive"
        });
        return;
      }

      // Wait for user to exist in auth.users (max 2 seconds)
      let userId = signUpData?.user?.id;
      if (!userId) {
        toast({
          title: "Registration failed",
          description: "No user ID returned from signUp.",
          variant: "destructive"
        });
        return;
      }

      // Instead of polling auth.users, just proceed (Supabase Auth inserts are eventually consistent)
      // If your RPC fails due to missing user, catch and show a clear error

      // 2. Call the new RPC to insert staff profile (fingerprint fields null for now)
      const { error: rpcError } = await supabase.rpc('register_staff_profile', {
        p_id: userId,
        p_first_name: values.first_name,
        p_last_name: values.last_name,
        p_gender: values.gender || null,
        p_email: values.email,
        p_phone: values.phone,
        p_fingerprint_data: null,
        p_fingerprint_enrolled: false,
        p_fingerprint_enrolled_at: null,
        p_role_id: values.role,
        p_hire_date: values.hire_date ? new Date(values.hire_date).toISOString().split('T')[0] : null,
        p_salary: parseFloat(values.salary),
        p_date_of_birth: values.date_of_birth ? new Date(values.date_of_birth).toISOString().split('T')[0] : null,
      });

      if (rpcError) {
        // Check for foreign key violation (user not yet in auth.users)
        if (
          rpcError.message &&
          rpcError.message.toLowerCase().includes("foreign key constraint")
        ) {
          toast({
            title: "Registration failed",
            description: "User was not yet available in the database. Please wait a few seconds and try again.",
            variant: "destructive"
          });
        } else {
          toast({
            title: "Profile registration failed",
            description: rpcError.message,
            variant: "destructive"
          });
        }
        return;
      }

      toast({
        title: "Team member registered successfully",
        description: `${values.first_name} ${values.last_name} has been added to the team. Please enroll fingerprint.`,
      });

      setRegisteredMemberName(`${values.first_name} ${values.last_name}`);
      setRegisteredMemberId(userId);
      setShowFingerprintEnrollment(true);
      setFingerprintStatus('idle');
      setFingerprintData(null);

      form.reset();
      setDialogOpen(false);
      fetchTeamMembers();
    } catch (error: any) {
      toast({
        title: "Registration failed",
        description: `An unexpected error occurred: ${error?.message || 'Unknown error'}`,
        variant: "destructive"
      });
    }
  }

  // Fingerprint enrollment logic (after registration)
  const handleFingerprintEnroll = async () => {
    setFingerprintStatus('scanning');
    setTimeout(async () => {
      const fakeFingerprintData = new Uint8Array([1, 2, 3, 4, 5, Math.floor(Math.random() * 255)]);
      setFingerprintData(fakeFingerprintData);

      if (!registeredMemberId) {
        setFingerprintStatus('error');
        return;
      }
      // Update fingerprint_data and fingerprint_enrolled
      const { error } = await supabase
        .from('staff')
        .update({
          fingerprint_data: fakeFingerprintData,
          fingerprint_enrolled_at: new Date().toISOString(),
          fingerprint_enrolled: true
        })
        .eq('id', registeredMemberId);

      if (error) {
        setFingerprintStatus('error');
        toast({
          title: "Fingerprint enrollment failed",
          description: error.message,
          variant: "destructive"
        });
      } else {
        setFingerprintStatus('success');
        form.setValue("fingerprint_enrolled", true);
        toast({
          title: "Fingerprint enrolled",
          description: "Fingerprint has been recorded successfully.",
        });
        fetchTeamMembers(); // Refresh the team members list
      }
    }, 2000);
  };

  const handleFingerprintRetry = () => {
    setFingerprintStatus('idle');
    setFingerprintData(null);
  };

  const handleFingerprintDone = () => {
    setShowFingerprintEnrollment(false);
    setRegisteredMemberId("");
    setRegisteredMemberName("");
    setFingerprintStatus('idle');
    setFingerprintData(null);
  };

  // Edit button handler
  const handleEdit = (member: TeamMember) => {
    setEditMember(member);
    setEditDialogOpen(true);
    // Populate form fields for editing
    form.reset({
      first_name: member.first_name,
      last_name: member.last_name,
      email: member.email,
      phone: member.phone,
      password: "", // Don't show password
      date_of_birth: member.date_of_birth || "",
      gender: member.gender as any,
      role: member.role_id || "",
      hire_date: member.hire_date ? new Date(member.hire_date).toISOString().split('T')[0] : "",
      salary: member.salary?.toString() || "",
      fingerprint_enrolled: member.fingerprint_enrolled,
    });
  };

  // Save edited member
  const handleEditSave = async () => {
    if (!editMember) return;
    const values = form.getValues();
    const { error } = await supabase
      .from('staff')
      .update({
        first_name: values.first_name,
        last_name: values.last_name,
        email: values.email,
        phone: values.phone,
        date_of_birth: values.date_of_birth || null,
        gender: values.gender || null,
        role_id: values.role,
        hire_date: values.hire_date ? new Date(values.hire_date).toISOString().split('T')[0] : null,
        salary: parseFloat(values.salary),
      })
      .eq('id', editMember.id);

    if (error) {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Staff updated",
        description: "Staff member details updated."
      });
      fetchTeamMembers();
      setEditDialogOpen(false);
      setEditMember(null);
    }
  };

  // Toggle is_active handler
  const handleToggleActive = (member: TeamMember) => {
    setPendingActiveMember(member);
    setConfirmActiveDialog(true);
  };

  // Confirm toggle is_active
  const confirmToggleActive = async () => {
    if (!pendingActiveMember) return;
    const newActive = !pendingActiveMember.is_active;
    const { error } = await supabase
      .from('staff')
      .update({ is_active: newActive })
      .eq('id', pendingActiveMember.id);

    if (error) {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Status updated",
        description: `Staff member is now ${newActive ? "active" : "inactive"}.`
      });
      fetchTeamMembers();
    }
    setConfirmActiveDialog(false);
    setPendingActiveMember(null);
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
              <Switch
                checked={member.is_active}
                onCheckedChange={() => handleToggleActive(member)}
                className="ml-2"
              />
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
          <p><span className="font-medium">Salary:</span> ETB {member.salary?.toLocaleString() || '0'}</p>
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
        <Button variant="outline" size="sm" onClick={() => handleEdit(member)}>
          <Edit className="mr-1 h-4 w-4" /> Edit
        </Button>
        {/* Archive button removed */}
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
      <TableCell>ETB {member.salary?.toLocaleString() || '0'}</TableCell>
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
        <div className="flex items-center gap-2">
          <Switch
            checked={member.is_active}
            onCheckedChange={() => handleToggleActive(member)}
          />
          <span className="text-xs">{member.is_active ? "Active" : "Inactive"}</span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleEdit(member)}>
            <Edit className="h-4 w-4" />
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
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-8">
        {/* Team List Section (left side, takes 2/3 width on desktop) */}
        <div className="flex-1 min-w-0">
          <div className="space-y-6 w-full">
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
                          <TableHead>Active</TableHead>
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
        </div>

        {/* Fingerprint Enrollment Section (right side, fixed width, not central) */}
        {showFingerprintEnrollment && (
          <div className="w-full md:w-[420px] flex-shrink-0">
            <FingerprintScannerCard
              status={fingerprintStatus}
              onStart={handleFingerprintEnroll}
              onDone={handleFingerprintDone}
              onRetry={handleFingerprintRetry}
              registeredClientName={registeredMemberName}
            />
          </div>
        )}
      </div>
      {/* Confirm Active Toggle Dialog */}
      <ConfirmDialog open={confirmActiveDialog} onOpenChange={setConfirmActiveDialog}>
        <ConfirmDialogContent>
          <ConfirmDialogHeader>
            <ConfirmDialogTitle>
              {pendingActiveMember?.is_active
                ? "Deactivate Staff Member"
                : "Activate Staff Member"}
            </ConfirmDialogTitle>
          </ConfirmDialogHeader>
          <div>
            Are you sure you want to {pendingActiveMember?.is_active ? "deactivate" : "activate"}{" "}
            <span className="font-semibold">{pendingActiveMember?.first_name} {pendingActiveMember?.last_name}</span>?
          </div>
          <ConfirmDialogFooter>
            <Button variant="outline" onClick={() => setConfirmActiveDialog(false)}>
              Cancel
            </Button>
            <Button
              className={pendingActiveMember?.is_active ? "bg-red-600 text-white" : "bg-green-600 text-white"}
              onClick={confirmToggleActive}
            >
              {pendingActiveMember?.is_active ? "Deactivate" : "Activate"}
            </Button>
          </ConfirmDialogFooter>
        </ConfirmDialogContent>
      </ConfirmDialog>
      {/* Edit Staff Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[525px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Team Member</DialogTitle>
            <DialogDescription>
              Update the details of the staff member.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleEditSave)} className="space-y-4">
              {/* ...reuse the same fields as add form, except password... */}
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
                <Button variant="outline" type="button" onClick={() => setEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-fitness-primary hover:bg-fitness-primary/90 text-white">
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
