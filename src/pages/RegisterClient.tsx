// RegisterClient.tsx
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
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import QRCodeSVG from 'react-qr-code';

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
  trainer_id: z.string().optional(),
  emergency_name: z.string().optional(),
  emergency_phone: z.string().optional(),
  relationship: z.string().optional(),
  fitness_goal: z.string().optional(),
  membership_expiry: z.string().optional(),
  qr_code_data: z.string().optional(),
});

export default function RegisterClient() {
  const { toast } = useToast();
  const [packages, setPackages] = useState<Array<{id: string, name: string, requires_trainer: boolean}>>([]);
  const [trainers, setTrainers] = useState<Array<{id: string, full_name: string}>>([]);
  const [selectedPackage, setSelectedPackage] = useState<{id: string, name: string, requires_trainer: boolean} | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [registeredUserId, setRegisteredUserId] = useState<string | null>(null);
  const [registeredClientName, setRegisteredClientName] = useState<string>("");
  const [qrCodeValue, setQrCodeValue] = useState<string | null>(null);

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
      trainer_id: "",
      emergency_name: "",
      emergency_phone: "",
      relationship: "",
      fitness_goal: "",
      membership_expiry: "",
      qr_code_data: "",
    },
  });

  useEffect(() => {
    async function fetchPackages() {
      const { data, error } = await supabase
        .from('packages')
        .select('id, name, requires_trainer')
        .eq('archived', false)
        .order('name');
      if (error) {
        console.error("fetchPackages error:", error);
      } else {
        setPackages(data || []);
      }
    }

    async function fetchTrainers() {
      try {
        const { data: trainerRole, error: roleErr } = await supabase
          .from('roles')
          .select('id')
          .eq('name', 'trainer')
          .maybeSingle();

        if (roleErr) {
          console.error("fetchTrainers - role lookup error:", roleErr);
          return;
        }
        if (!trainerRole) return;

        const { data, error } = await supabase
          .from('staff')
          .select('id, first_name, last_name')
          .eq('role_id', trainerRole.id)
          .eq('is_active', true)
          .order('first_name');

        if (error) {
          console.error("fetchTrainers error:", error);
        } else {
          const formattedTrainers = data?.map(trainer => ({
            id: trainer.id,
            full_name: `${trainer.first_name} ${trainer.last_name}`
          })) || [];
          setTrainers(formattedTrainers);
        }
      } catch (err) {
        console.error("fetchTrainers unexpected error:", err);
      }
    }

    fetchPackages();
    fetchTrainers();
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

  // Handle package selection change
  const handlePackageChange = (packageId: string) => {
    const selectedPkg = packages.find(pkg => pkg.id === packageId);
    setSelectedPackage(selectedPkg || null);
    form.setValue("package_id", packageId);
    form.setValue("trainer_id", "");
  };

  // Use Supabase Functions invoke (preferred) otherwise fallback to fetch to deployed function
  async function invokeSendSmsFunction(payload: Record<string, any>) {
    try {
      // Try supabase.functions.invoke first (this uses the configured supabase client and auth)
      if (supabase?.functions?.invoke) {
        const { data, error } = await supabase.functions.invoke('send-sms', {
          body: payload,
        });

        if (error) {
          console.warn("supabase.functions.invoke returned error:", error);
          // fall through to fallback if desired — but return the error so caller can handle
          return { ok: false, error, data };
        }

        return { ok: true, data };
      }
    } catch (err) {
      console.warn("supabase.functions.invoke threw:", err);
    }

    // Fallback: call deployed functions URL directly (ensure this URL is correct)
    try {
      const deployedBase = "https://ztzfvotpltombchdnmha.supabase.co/functions/v1/send-sms";
      const anon = import.meta
      const res = await fetch(deployedBase, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // If your function requires Authorization header, add it here:
          // "Authorization": `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY || ''}`,
        },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, status: res.status, body };
      return { ok: true, data: body };
    } catch (err) {
      console.error("invokeSendSmsFunction fallback fetch error:", err);
      return { ok: false, error: String(err) };
    }
  }

  // send welcome SMS through Edge Function and show clear toasts
  async function sendWelcomeSmsAndNotify(values: z.infer<typeof formSchema>, userId: string) {
    const payload = {
      type: "send_welcome_sms",
      data: {
        recipient_phone: values.phone,
        recipient_name: `${values.first_name} ${values.last_name}`,
        username: values.email,
        password: values.password,
        gym_name: "ATL Fitness Hub",
        gym_address: "Your gym address here",
        gym_phone: "+251-XXX-XXX-XXXX",
        recipient_id: userId,
      },
    };

    // Show immediate toast that send is being attempted
    toast({
      title: "Sending welcome SMS",
      description: `Attempting to send SMS to ${values.phone}...`,
    });

    // Call the function
    const result = await invokeSendSmsFunction(payload);

    // Network / invocation failures
    if (!result?.ok) {
      console.error("send-sms invocation failed:", result);
      toast({
        title: "SMS not sent",
        description: `Could not invoke SMS function. ${result?.error?.message || result?.error || result?.body || ''}`,
        variant: "destructive",
      });
      return { success: false, result };
    }

    // Success response from function (data shaped by your function)
    const body = result.data || {};

    // If your function returns { success: true, data: ... }
    if (body.success === true) {
      toast({
        title: "Welcome SMS sent",
        description: `Welcome SMS successfully sent to ${values.phone}.`,
      });
      return { success: true, body };
    }

    // Function ran but provider error or business error
    console.warn("send-sms function responded without success flag:", body);
    const providerError = body.error || (body.data && body.data.error) || JSON.stringify(body);
    toast({
      title: "SMS failed",
      description: `SMS could not be sent: ${providerError}`,
      variant: "destructive",
    });
    return { success: false, body };
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      console.log("Registering email:", values.email); // Add this line for debugging
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

      // Generate QR code data
      const qrData = JSON.stringify({
        userId: userId,
        firstName: values.first_name,
        lastName: values.last_name,
        packageId: values.package_id,
      });

      // 2. Call the RPC to insert profile data
      const { error: rpcError } = await supabase.rpc('register_user_profile', {
        p_user_id: userId,
        p_first_name: values.first_name,
        p_last_name: values.last_name,
        p_gender: values.gender,
        p_email: values.email,
        p_phone: values.phone,
        p_emergency_name: values.emergency_name || null,
        p_emergency_phone: values.emergency_phone || null,
        p_relationship: values.relationship || null,
        p_fitness_goal: values.fitness_goal || null,
        p_package_id: values.package_id,
        p_membership_expiry: values.membership_expiry ? new Date(values.membership_expiry).toISOString() : null,
        p_trainer_id: values.trainer_id || null,
        p_status: 'active',
        p_date_of_birth: values.date_of_birth ? new Date(values.date_of_birth).toISOString().split('T')[0] : null,
        p_qr_code_data: qrData,
      });

      if (rpcError) {
        console.error("register_user_profile rpcError:", rpcError);
        toast({
          title: "Profile registration failed",
          description: rpcError.message,
          variant: "destructive"
        });
        setIsLoading(false);
        return;
      }

      // 3. Registration succeeded in auth + profile
      toast({
        title: "Registration successful",
        description: "Client has been registered successfully. Generating QR code...",
      });
      setRegisteredUserId(userId);
      setRegisteredClientName(`${values.first_name} ${values.last_name}`);
      setQrCodeValue(qrData);
      form.reset();
      setSelectedPackage(null);

      // 4. Send welcome SMS via Edge Function and show clear feedback
      // We await this so admin gets immediate feedback in the UI.
      await sendWelcomeSmsAndNotify(values, userId);

    } catch (error: any) {
      console.error("Unexpected registration error", error);
      toast({
        title: "Registration failed",
        description: error?.message || "An unexpected error occurred.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }

  const handleQrCodeDone = () => {
    setRegisteredUserId(null);
    setRegisteredClientName("");
    setQrCodeValue(null);
  };

  return (
    <div className="animate-fade-in px-2 sm:px-4">
      <h2 className="text-3xl font-bold tracking-tight mb-6 text-center sm:text-left">Register New Client</h2>
      <div className="max-w-5xl mx-auto flex flex-col gap-8 md:flex-row md:gap-8">
        <div className="flex flex-1 min-w-0">
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Client Information</CardTitle>
              <CardDescription>Enter the details of the new client to register them.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Number</FormLabel>
                          <FormControl>
                            <div className="w-full">
                              <PhoneInput
                                country={'et'}
                                value={field.value}
                                onChange={field.onChange}
                                inputProps={{
                                  name: 'phone',
                                  required: true,
                                  autoFocus: false,
                                }}
                                inputClass="w-full"
                                containerClass="w-full"
                                dropdownClass="z-50"
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field, fieldState }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="john.doe@example.com"
                              {...field}
                              type="email"
                              className={fieldState.invalid ? "border-red-500" : ""}
                            />
                          </FormControl>
                          <FormMessage>
                            {fieldState.error?.message ? fieldState.error.message : ""}
                          </FormMessage>
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                                />
                              </FormControl>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                onClick={togglePasswordVisibility}
                              >
                                {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                              </Button>
                            </div>
                            <Button type="button" onClick={generatePassword} variant="outline">Generate</Button>
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
                          <Select onValueChange={handlePackageChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a package" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {packages.map((pkg) => (
                                <SelectItem key={pkg.id} value={pkg.id}>{pkg.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  {selectedPackage?.requires_trainer && (
                    <FormField
                      control={form.control}
                      name="trainer_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Assign Trainer</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger><SelectValue placeholder="Select a trainer (optional)" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {trainers.map((trainer) => (
                                <SelectItem key={trainer.id} value={trainer.id}>{trainer.full_name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  <Card className="mt-6">
                    <CardHeader>
                      <CardTitle>Emergency Contact (Optional)</CardTitle>
                      <CardDescription>Provide details for an emergency contact.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <FormField control={form.control} name="emergency_name" render={({ field }) => (
                        <FormItem><FormLabel>Name</FormLabel><FormControl><Input placeholder="Emergency Contact Name" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="emergency_phone" render={({ field }) => (
                        <FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input placeholder="Emergency Contact Phone" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="relationship" render={({ field }) => (
                        <FormItem><FormLabel>Relationship</FormLabel><FormControl><Input placeholder="e.g., Parent, Spouse" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                    </CardContent>
                  </Card>
                  <FormField control={form.control} name="fitness_goal" render={({ field }) => (
                    <FormItem><FormLabel>Fitness Goal (Optional)</FormLabel><FormControl><Input placeholder="e.g., Weight loss, Muscle gain" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Registering..." : "Register Client"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
        {qrCodeValue && (
          <div className="flex flex-1 min-w-0 mt-8 md:mt-0">
            <Card className="w-full">
              <CardHeader>
                <CardTitle>QR Code for {registeredClientName}</CardTitle>
                <CardDescription>Scan this QR code for check-in.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center p-6">
                <QRCodeSVG value={qrCodeValue} size={192} level="H" className="w-full max-w-xs h-auto" />
                <p className="text-sm text-muted-foreground mt-4 text-center break-all">User ID: {registeredUserId}</p>
              </CardContent>
              <CardFooter className="flex justify-end">
                <Button onClick={handleQrCodeDone}>Done</Button>
              </CardFooter>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
  