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
import FingerprintScannerCard from "@/components/FingerprintScannerCard";

// --- Zod schema for validation ---
const formSchema = z.object({
  first_name: z.string().min(2, { message: "First name is required." }),
  last_name: z.string().min(2, { message: "Last name is required." }),
  date_of_birth: z
    .string()
    .refine(val => !isNaN(Date.parse(val)), {
      message: "Please enter a valid date",
    }),
  phone: z.string().min(10, { message: "Phone number is required." }),
  password: z.string().min(8, { message: "Password must be at least 8 characters" }),
  email: z.string().email({ message: "Valid email is required." }),
  gender: z.string().min(1, { message: "Gender is required." }),
  package_id: z.string().min(1, { message: "Package is required." }),
  emergency_name: z.string().optional(),
  emergency_phone: z.string().optional(),
  relationship: z.string().optional(),
  fitness_goal: z.string().optional(),
  membership_expiry: z.string().optional(),
  fingerprint_data: z.any().nullable(),
  fingerprint_enrolled: z.boolean().optional(), // <-- Add this line
});

export default function RegisterClient() {
  const { toast } = useToast();
  const [packages, setPackages] = useState<Array<{id: string, name: string}>>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [fingerprintStatus, setFingerprintStatus] = useState<'idle' | 'scanning' | 'success' | 'error'>('idle');
  const [fingerprintData, setFingerprintData] = useState<Uint8Array | null>(null);
  const [showFingerprint, setShowFingerprint] = useState(false);
  const [registeredUserId, setRegisteredUserId] = useState<string | null>(null);
  const [registeredClientName, setRegisteredClientName] = useState<string>("");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      date_of_birth: "",
      phone: "",
      password: "",
      email: "",
      gender: "",
      package_id: "",
      emergency_name: "",
      emergency_phone: "",
      relationship: "",
      fitness_goal: "",
      membership_expiry: "",
      fingerprint_data: null,
      fingerprint_enrolled: false, // <-- Add this line
    },
  });

  useEffect(() => {
    async function fetchPackages() {
      const { data, error } = await supabase
        .from('packages')
        .select('id, name')
        .order('name');
      if (!error) setPackages(data || []);
    }
    fetchPackages();
  }, []);

  const togglePasswordVisibility = () => setShowPassword((v) => !v);

  const generatePassword = () => {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < 12; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    form.setValue("password", password);
    toast({
      title: "Password generated",
      description: "A secure password has been generated.",
    });
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
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
        setIsLoading(false);
        return;
      }

      const userId = signUpData?.user?.id;
      if (!userId) {
        toast({
          title: "Registration failed",
          description: "Could not get user ID after sign up.",
          variant: "destructive"
        });
        setIsLoading(false);
        return;
      }

      // 2. Call the RPC to insert profile data (fingerprint_data is null for now)
      const { error: rpcError } = await supabase.rpc('register_user_profile', {
        p_user_id: userId,
        p_first_name: values.first_name,
        p_last_name: values.last_name,
        p_gender: values.gender,
        p_email: values.email,
        p_phone: values.phone,
        p_fingerprint_data: null,
        p_emergency_name: values.emergency_name || null,
        p_emergency_phone: values.emergency_phone || null,
        p_relationship: values.relationship || null,
        p_fitness_goal: values.fitness_goal || null,
        p_package_id: values.package_id,
        p_membership_expiry: values.membership_expiry ? new Date(values.membership_expiry).toISOString() : null,
        p_status: 'active',
        p_date_of_birth: values.date_of_birth ? new Date(values.date_of_birth).toISOString().split('T')[0] : null,
      });

      if (rpcError) {
        toast({
          title: "Profile registration failed",
          description: rpcError.message,
          variant: "destructive"
        });
        setIsLoading(false);
        return;
      }

      toast({
        title: "Registration successful",
        description: "Client has been registered successfully. Please enroll fingerprint.",
      });
      setRegisteredUserId(userId);
      setRegisteredClientName(`${values.first_name} ${values.last_name}`);
      setShowFingerprint(true);
      setFingerprintStatus('idle');
      setFingerprintData(null);
      form.reset();
    } catch (error) {
      toast({
        title: "Registration failed",
        description: "An unexpected error occurred.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }

  // Fingerprint enrollment logic (after registration)
  const handleFingerprintEnroll = async () => {
    setFingerprintStatus('scanning');
    setTimeout(async () => {
      const fakeFingerprintData = new Uint8Array([1, 2, 3, 4, 5, Math.floor(Math.random() * 255)]);
      setFingerprintData(fakeFingerprintData);

      if (!registeredUserId) {
        setFingerprintStatus('error');
        return;
      }
      // Update fingerprint_data and fingerprint_enrolled
      const { error } = await supabase
        .from('users')
        .update({
          fingerprint_data: fakeFingerprintData,
          updated_at: new Date().toISOString(),
          fingerprint_enrolled: true // <-- Set to true on enrollment
        })
        .eq('id', registeredUserId);

      if (error) {
        setFingerprintStatus('error');
        toast({
          title: "Fingerprint enrollment failed",
          description: error.message,
          variant: "destructive"
        });
      } else {
        setFingerprintStatus('success');
        form.setValue("fingerprint_enrolled", true); // <-- Update form state
        toast({
          title: "Fingerprint enrolled",
          description: "Fingerprint has been recorded successfully.",
        });
      }
    }, 2000);
  };

  const handleFingerprintRetry = () => {
    setFingerprintStatus('idle');
    setFingerprintData(null);
  };

  const handleFingerprintDone = () => {
    setShowFingerprint(false);
    setRegisteredUserId(null);
    setRegisteredClientName("");
    setFingerprintStatus('idle');
    setFingerprintData(null);
  };

  return (
    <div className="animate-fade-in">
      <h2 className="text-3xl font-bold tracking-tight mb-6">Register New Client</h2>
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-8">
        <div className="flex flex-1 ">
          <Card>
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="date_of_birth"
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
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select package" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {packages.map((pkg) => (
                                <SelectItem key={pkg.id} value={pkg.id}>
                                  {pkg.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
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
                    <Button type="submit" className="bg-fitness-primary hover:bg-fitness-primary/90 text-white" disabled={isLoading}>
                      {isLoading ? "Registering..." : "Register Client"}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
        {showFingerprint && registeredUserId && (
          <div className="flex-1 flex items-start">
            <FingerprintScannerCard
              status={fingerprintStatus}
              onStart={handleFingerprintEnroll}
              onDone={handleFingerprintDone}
              onRetry={handleFingerprintRetry}
              registeredClientName={registeredClientName}
            />
          </div>
        )}
      </div>
    </div>
  );
}
