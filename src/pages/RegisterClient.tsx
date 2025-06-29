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
import { Eye, EyeOff, Fingerprint } from "lucide-react";
import { supabase } from "@/supabaseClient";

const formSchema = z.object({
  firstname: z.string().min(2, { message: "First name is required." }),
  lastname: z.string().min(2, { message: "Last name is required." }),
  dateofbirth: z
    .string()
    .refine(val => !isNaN(Date.parse(val)), {
      message: "Please enter a valid date",
    }),
  phone: z.string().min(10, { message: "Phone number is required." }),
  password: z.string().min(8, { message: "Password must be at least 8 characters" }),
  email: z.string().email({ message: "Valid email is required." }),
  gender: z.string().min(1, { message: "Gender is required." }),
  package_id: z.string().min(1, { message: "Package is required." }),
  trainer_id: z.string().optional(),
  emergency_name: z.string().optional(),
  emergency_phone: z.string().optional(),
  relationship: z.string().optional(),
  fitness_goal: z.string().optional(),
});

export default function RegisterClient() {
  const { toast } = useToast();
  const [packages, setPackages] = useState<Array<{id: string, name: string, duration: string, price: number, requires_trainer: boolean}>>([]);
  const [trainers, setTrainers] = useState<Array<{id: string, name: string}>>([]);
  const [isLoadingPackages, setIsLoadingPackages] = useState(true);
  const [isLoadingTrainers, setIsLoadingTrainers] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<{id: string, name: string, duration: string, price: number, requires_trainer: boolean} | null>(null);
  const [showFingerprintEnrollment, setShowFingerprintEnrollment] = useState(false);
  const [registeredClientName, setRegisteredClientName] = useState("");
  const [fingerprintStatus, setFingerprintStatus] = useState<'idle' | 'enrolling' | 'success' | 'error'>('idle');
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstname: "",
      lastname: "",
      dateofbirth: "",
      phone: "",
      password: "",
      email: "",
      gender: "",
      package_id: "",
      trainer_id: "",
      emergency_name: "",
      emergency_phone: "",
      relationship: "",
      fitness_goal: "",
    },
  });

  // Fetch packages on component mount
  useEffect(() => {
    async function fetchPackages() {
      try {
        console.log('Attempting to fetch packages...');
        const { data, error } = await supabase
          .from('packages')
          .select('id, name, duration_value, duration_unit, price, requires_trainer')
          .order('name');
        
        console.log('Package fetch result:', { data, error });
        
        if (error) {
          console.error('Error fetching packages:', error);
          toast({
            title: "Error loading packages",
            description: "Could not load membership packages",
            variant: "destructive"
          });
        } else {
          console.log('Successfully fetched packages:', data);
          // Transform the data to match expected format
          const transformedPackages = (data || []).map(pkg => ({
            id: pkg.id,
            name: pkg.name,
            duration: `${pkg.duration_value} ${pkg.duration_unit}`,
            price: pkg.price,
            requires_trainer: pkg.requires_trainer
          }));
          setPackages(transformedPackages);
        }
      } catch (error) {
        console.error('Unexpected error fetching packages:', error);
      } finally {
        setIsLoadingPackages(false);
      }
    }

    fetchPackages();
  }, [toast]);

  // Fetch trainers when needed
  const fetchTrainers = async () => {
    if (trainers.length > 0) return; // Already fetched
    
    setIsLoadingTrainers(true);
    try {
      console.log('Attempting to fetch trainers...');
      const { data, error } = await supabase
        .from('team_members')
        .select('id, full_name')
        .order('full_name');
      
      console.log('Trainers fetch result:', { data, error });
      
      if (error) {
        console.error('Error fetching trainers:', error);
        toast({
          title: "Error loading trainers",
          description: "Could not load trainers list",
          variant: "destructive"
        });
      } else {
        console.log('Successfully fetched trainers:', data);
        const transformedTrainers = (data || []).map(trainer => ({
          id: trainer.id,
          name: trainer.full_name
        }));
        setTrainers(transformedTrainers);
      }
    } catch (error) {
      console.error('Unexpected error fetching trainers:', error);
    } finally {
      setIsLoadingTrainers(false);
    }
  };

  // Handle package selection
  const handlePackageChange = (packageId: string) => {
    const selected = packages.find(pkg => pkg.id === packageId);
    setSelectedPackage(selected || null);
    
    // Clear trainer selection when package changes
    form.setValue("trainer_id", "");
    
    // Fetch trainers if package requires trainer
    if (selected?.requires_trainer) {
      fetchTrainers();
    }
  };

  // Generate a random password
  const generatePassword = () => {
    const length = 8;
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    form.setValue("password", password);
    toast({
      title: "Password generated",
      description: "A secure password has been generated for the client.",
    });
  };

  // Toggle password visibility
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      console.log('Attempting to insert user:', {
        first_name: values.firstname,
        last_name: values.lastname,
        date_of_birth: values.dateofbirth,
        gender: values.gender,
        email: values.email,
        phone: values.phone,
        password: values.password,
        emergency_name: values.emergency_name || null,
        emergency_phone: values.emergency_phone || null,
        relationship: values.relationship || null,
        fitness_goal: values.fitness_goal || null,
        package_id: values.package_id,
        status: 'active'
      });

      const { data, error } = await supabase
        .from('users')
        .insert([
          {
            first_name: values.firstname,
            last_name: values.lastname,
            date_of_birth: values.dateofbirth,
            gender: values.gender,
            email: values.email,
            phone: values.phone,
            password: values.password,
            emergency_name: values.emergency_name || null,
            emergency_phone: values.emergency_phone || null,
            relationship: values.relationship || null,
            fitness_goal: values.fitness_goal || null,
            package_id: values.package_id,
            status: 'active'
          }
        ])
        .select();

      if (error) {
        console.error('Supabase error:', error);
        toast({ 
          title: "Registration failed", 
          description: error.message || "Failed to register client", 
          variant: "destructive" 
        });
        return;
      }

      console.log('User inserted successfully:', data);
      
      toast({
        title: "Client registered successfully",
        description: `Client ${values.firstname} ${values.lastname} has been registered successfully.`,
      });
      
      // Show fingerprint enrollment section
      setRegisteredClientName(`${values.firstname} ${values.lastname}`);
      setShowFingerprintEnrollment(true);
      
      form.reset();
    } catch (error) {
      console.error('Unexpected error:', error);
      toast({ 
        title: "Registration failed", 
        description: "An unexpected error occurred", 
        variant: "destructive" 
      });
    }
  }

  const handleFingerprintEnroll = () => {
    setFingerprintStatus('enrolling');
    // Simulate fingerprint enrollment process
    setTimeout(() => {
      setFingerprintStatus('success');
      toast({
        title: "Fingerprint enrolled successfully",
        description: "Client can now use fingerprint for check-in.",
      });
    }, 3000);
  };

  const resetFingerprintSection = () => {
    setShowFingerprintEnrollment(false);
    setFingerprintStatus('idle');
    setRegisteredClientName("");
  };

  return (
    <div className="animate-fade-in">
      <h2 className="text-3xl font-bold tracking-tight mb-6">Register New Client</h2>
      
      <div className={`grid gap-6 ${showFingerprintEnrollment ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Client Information</CardTitle>
            <CardDescription>Enter the details of the new client to register them.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firstname"
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
                    name="lastname"
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
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="dateofbirth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date of Birth</FormLabel>
                        <FormControl>
                          <Input placeholder="YYYY-MM-DD" type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="gender"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Gender</FormLabel>
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
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input placeholder="+1 234 567 8900" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input placeholder="john.doe@example.com" {...field} type="email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                              {showPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={generatePassword}
                            className="whitespace-nowrap"
                          >
                            Generate
                          </Button>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="package_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Membership Package</FormLabel>
                        <Select 
                          onValueChange={(value) => {
                            field.onChange(value);
                            handlePackageChange(value);
                          }} 
                          defaultValue={field.value} 
                          disabled={isLoadingPackages}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={isLoadingPackages ? "Loading packages..." : "Select package"} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {packages.map((pkg) => (
                              <SelectItem key={pkg.id} value={pkg.id}>
                                {pkg.name} ({pkg.duration}) - ${pkg.price}
                                {pkg.requires_trainer && " (Trainer Required)"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Conditional Trainer Selection */}
                {selectedPackage?.requires_trainer && (
                  <FormField
                    control={form.control}
                    name="trainer_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Select Trainer</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLoadingTrainers}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={isLoadingTrainers ? "Loading trainers..." : "Select a trainer"} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {trainers.map((trainer) => (
                              <SelectItem key={trainer.id} value={trainer.id}>
                                {trainer.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                
                <FormField
                  control={form.control}
                  name="fitness_goal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fitness Goal (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Weight loss, muscle gain, etc." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="emergency_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Emergency Contact Name (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Jane Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="emergency_phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Emergency Contact Phone (Optional)</FormLabel>
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
                  name="relationship"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Relationship to Emergency Contact (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Spouse, Parent, Sibling, etc." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="pt-4">
                  <Button type="submit" className="bg-fitness-primary hover:bg-fitness-primary/90 text-white">Register Client</Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Fingerprint Enrollment Section */}
        {showFingerprintEnrollment && (
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-2xl">👆</span>
                Fingerprint Enrollment
              </CardTitle>
              <CardDescription>
                Enroll {registeredClientName}'s fingerprint for secure check-in access.
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
                      Touch the fingerprint sensor to enroll {registeredClientName}'s fingerprint
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
                      <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-green-600 font-medium">
                      Fingerprint enrolled successfully!
                    </p>
                    <p className="text-sm text-gray-500">
                      {registeredClientName} can now use fingerprint for check-in
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button 
                variant="outline" 
                onClick={resetFingerprintSection}
              >
                Register Another Client
              </Button>
              {fingerprintStatus === 'success' && (
                <Button 
                  className="bg-fitness-primary hover:bg-fitness-primary/90 text-white"
                  onClick={resetFingerprintSection}
                >
                  Complete Registration
                </Button>
              )}
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  );
}
         


