// RegisterClient.tsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
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
import { Eye, EyeOff, Menu } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import QRCodeSVG from 'react-qr-code';
import { useGym } from "@/contexts/GymContext";
import { DynamicHeader } from "@/components/layout/DynamicHeader";
import { Sidebar } from "@/components/layout/Sidebar";

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
  const { gym, loading: gymLoading } = useGym();
  const [packages, setPackages] = useState<Array<{id: string, name: string, requires_trainer: boolean}>>([]);
  const [trainers, setTrainers] = useState<Array<{id: string, full_name: string}>>([]);
  const [selectedPackage, setSelectedPackage] = useState<{id: string, name: string, requires_trainer: boolean} | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [registeredUserId, setRegisteredUserId] = useState<string | null>(null);
  const [registeredClientName, setRegisteredClientName] = useState<string>("");
  const [registeredClientDetails, setRegisteredClientDetails] = useState<{ phone?: string; gender?: string; emergency_name?: string; emergency_phone?: string } | null>(null);
  const [qrCodeValue, setQrCodeValue] = useState<string | null>(null);
  const [registeredClientEmail, setRegisteredClientEmail] = useState<string | null>(null);
  const qrRef = useRef<HTMLDivElement | null>(null);

  // Dynamic styling based on gym configuration
  const dynamicStyles = useMemo(() => {
    if (!gym) return {
      primaryColor: '#2563eb',
      secondaryColor: '#1e40af',
      accentColor: '#f59e0b',
    };
    
    const primaryColor = gym.brand_color || '#2563eb';
    return {
      primaryColor: primaryColor,
      secondaryColor: primaryColor,
      accentColor: primaryColor,
    };
  }, [gym]);

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
    if (gym && gym.id !== 'default') {
      fetchPackages();
      fetchTrainers();
    }
  }, [gym]);

  async function fetchPackages() {
    if (!gym || gym.id === 'default') return;
    
    try {
      const { data, error } = await supabase
        .from('packages')
        .select('id, name, requires_trainer')
        .eq('gym_id', gym.id)
        .eq('archived', false)
        .order('name');
      
      if (error) {
        console.error("fetchPackages error:", error);
        toast({
          title: "Error loading packages",
          description: "Could not load packages for this gym",
          variant: "destructive"
        });
      } else {
        setPackages(data || []);
      }
    } catch (err) {
      console.error("fetchPackages unexpected error:", err);
    }
  }

  async function fetchTrainers() {
    if (!gym || gym.id === 'default') return;
    
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
        .eq('gym_id', gym.id)
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

    // Fallback: call deployed functions URL directly
    try {
      const deployedBase = "https://ztzfvotpltombchdnmha.supabase.co/functions/v1/send-sms";
      const res = await fetch(deployedBase, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
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
        gym_name: gym?.name || "Your Gym",
        gym_address: gym?.address || "Gym Address",
        gym_phone: gym?.owner_phone || "+1-XXX-XXX-XXXX",
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
    if (!gym || gym.id === 'default') {
      toast({
        title: "Gym not available",
        description: "Please ensure you're accessing this page from a specific gym context.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      console.log("Registering email:", values.email);
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
        gymId: gym.id,
      });

      // 2. Call the RPC to insert profile data with gym_id
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
        p_gym_id: gym.id, // Add gym_id parameter
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
        description: `Client has been registered successfully to ${gym.name}. Generating QR code...`,
      });
      setRegisteredUserId(userId);
      setRegisteredClientName(`${values.first_name} ${values.last_name}`);
      setRegisteredClientEmail(values.email);
      setRegisteredClientDetails({
        phone: values.phone,
        gender: values.gender,
        emergency_name: values.emergency_name || undefined,
        emergency_phone: values.emergency_phone || undefined,
      });
      setQrCodeValue(qrData);
      form.reset();
      setSelectedPackage(null);

      // 4. Welcome SMS is a coming-soon feature — do not invoke the Edge Function during registration
      console.info('Welcome SMS disabled: notifications are a coming soon feature. Skipping SMS invocation.');
      toast({
        title: 'Notifications disabled',
        description: 'Welcome SMS is currently disabled. This feature will be available soon.',
      });

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
    setRegisteredClientDetails(null);
    setRegisteredClientEmail(null);
    setQrCodeValue(null);
  };

  const handleQrCodeDownload = () => {
    if (!qrCodeValue || !registeredClientName) return;

    const canvasWidth = 1400;
    const canvasHeight = 700;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Decorative top stripe using gym color (if available)
    const stripeHeight = 90;
    ctx.fillStyle = gym?.brand_color ?? '#2563eb';
    ctx.fillRect(0, 0, canvasWidth, stripeHeight);

    // Gym name on top stripe
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px Inter, Arial, sans-serif';
    ctx.fillText(gym?.name ?? 'Gym', 40, 58);

    // Retrieve SVG from displayed QR
    const svgEl = qrRef.current?.querySelector('svg');
    if (!svgEl) {
      toast({ title: 'QR not available', description: 'QR code not found on the page.', variant: 'destructive' });
      return;
    }

    // Serialize SVG and sanitize for crisp rasterization (avoid turning background black)
    let svgData = new XMLSerializer().serializeToString(svgEl);

    // Strip embedded styles that might interfere
    svgData = svgData.replace(/<style[^>]*>[\s\S]*?<\/style>/g, '');

    // Render the SVG at a large explicit pixel size to preserve crispness when rasterizing
    const desiredQrPx = 760; // large, will be downscaled for final canvas
    // remove any existing explicit width/height attributes so we can set precise pixel size
    svgData = svgData.replace(/\s(width|height)="[^"]*"/g, '');
    svgData = svgData.replace(/<svg([^>]*)>/, `<svg$1 width="${desiredQrPx}" height="${desiredQrPx}" preserveAspectRatio="xMidYMid meet" shape-rendering="crispEdges" image-rendering="pixelated">`);

    // Convert strokes to fills and ensure modules are black
    svgData = svgData.replace(/\sstroke="[^"]*"/g, '');
    svgData = svgData.replace(/fill="(?!#ffffff)[^"]*"/g, 'fill="#000000"');

    // Remove any existing full-size background rects then insert a guaranteed white background rect
    svgData = svgData.replace(/<rect[^>]*width="100%"[^>]*>/g, '');
    svgData = svgData.replace(/<svg([^>]*)>/, `<svg$1><rect width="100%" height="100%" fill="#ffffff"/>`);

    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const qrSize = 380;
      const padding = 60;
      const qrX = canvasWidth - qrSize - padding;
      const qrY = (canvasHeight - qrSize) / 2;

      // Disable smoothing for pixel-perfect QR rendering and set high quality when downscaling
      ctx.imageSmoothingEnabled = false;
      try { ctx.imageSmoothingQuality = 'high'; } catch (e) { /* not supported in some browsers */ }

      // Draw white rounded box for QR area with subtle border & shadow
      const boxX = qrX - 10;
      const boxY = qrY - 10;
      const boxW = qrSize + 20;
      const boxH = qrSize + 20;
      const radius = 18;

      // subtle shadow
      ctx.save();
      ctx.fillStyle = 'rgba(16,24,40,0.04)';
      ctx.beginPath();
      ctx.moveTo(boxX + radius, boxY);
      ctx.arcTo(boxX + boxW, boxY, boxX + boxW, boxY + boxH, radius);
      ctx.arcTo(boxX + boxW, boxY + boxH, boxX, boxY + boxH, radius);
      ctx.arcTo(boxX, boxY + boxH, boxX, boxY, radius);
      ctx.arcTo(boxX, boxY, boxX + boxW, boxY, radius);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // white rounded rect
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(boxX + radius, boxY);
      ctx.arcTo(boxX + boxW, boxY, boxX + boxW, boxY + boxH, radius);
      ctx.arcTo(boxX + boxW, boxY + boxH, boxX, boxY + boxH, radius);
      ctx.arcTo(boxX, boxY + boxH, boxX, boxY, radius);
      ctx.arcTo(boxX, boxY, boxX + boxW, boxY, radius);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#e6e6e6';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      // Draw QR image (black on white)
      ctx.drawImage(img, qrX, qrY, qrSize, qrSize);

      // Left-side content
      const leftX = padding;
      let textY = stripeHeight + 70;

      // Main name
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 48px Inter, Arial, sans-serif';
      wrapText(ctx, registeredClientName, leftX, textY, qrX - leftX - padding, 56);

      // Email
      textY += 90;
      ctx.font = '26px Inter, Arial, sans-serif';
      ctx.fillStyle = '#111111';
      wrapText(ctx, registeredClientEmail ?? '', leftX, textY, qrX - leftX - padding, 34);

      // Phone
      textY += 48;
      ctx.font = '20px Inter, Arial, sans-serif';
      ctx.fillStyle = '#111111';
      ctx.fillText(`Phone: ${registeredClientDetails?.phone ?? '-'}`, leftX, textY);

      // Gender
      textY += 36;
      ctx.fillText(`Gender: ${registeredClientDetails?.gender ?? '-'}`, leftX, textY);

      // Emergency contact
      textY += 36;
      ctx.fillText(`Emergency: ${registeredClientDetails?.emergency_name ?? '-'} (${registeredClientDetails?.emergency_phone ?? '-'})`, leftX, textY);

      // Decorative subtitle
      textY += 60;
      ctx.font = '18px Inter, Arial, sans-serif';
      ctx.fillStyle = '#6b7280';
      ctx.fillText(`Registered to: ${gym?.name ?? ''}`, leftX, textY + 12);

      // Export as PNG
      canvas.toBlob((blob) => {
        if (!blob) return;
        const sanitizedGym = (gym?.name ?? 'gym').replace(/[^a-z0-9]+/gi, '_').toLowerCase();
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `${registeredClientName}-${sanitizedGym}-ID.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
      }, 'image/png');

      URL.revokeObjectURL(url);
    };

    img.onerror = (e) => {
      console.error('Error loading SVG into image for download', e);
      toast({ title: 'Download failed', description: 'Could not prepare the image for download.', variant: 'destructive' });
    };

    img.src = url;
  };

  // Helper: wrap text within max width
  function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
    const words = text.split(' ');
    let line = '';

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        ctx.fillText(line, x, y);
        line = words[n] + ' ';
        y += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, y);
  }

  // Loading state
  if (gymLoading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
        <div className="flex-1 flex items-center justify-center relative">
          <div className="md:hidden p-2 absolute top-4 left-4 z-50">
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
              <Menu size={20} />
            </Button>
          </div>

          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-64 mb-4"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2].map(i => (
                <div key={i} className="h-96 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!gym || gym.id === 'default') {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="md:hidden p-2">
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
              <Menu size={20} />
            </Button>
          </div>
          <DynamicHeader />
          <main className="flex-1 flex items-center justify-center">
            <Card className="max-w-md">
              <CardContent className="p-6 text-center">
                <h2 className="text-xl font-semibold mb-2">Gym Context Required</h2>
                <p className="text-gray-600 mb-4">
                  This page requires a specific gym context. Please access it from a gym-specific URL.
                </p>
                <Button onClick={() => window.location.href = '/admin/dashboard'}>
                  Go to Admin Dashboard
                </Button>
              </CardContent>
            </Card>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile menu button */}
        <div className="md:hidden p-2">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </Button>
        </div>
        <DynamicHeader />
        
        <main className="flex-1 overflow-x-hidden overflow-y-auto">
          <div className="animate-fade-in px-2 sm:px-4 py-6">
            <h2 
              className="text-3xl font-bold tracking-tight mb-6 text-center sm:text-left"
              style={{ color: dynamicStyles.primaryColor }}
            >
              Register New Client for {gym.name}
            </h2>
            <div className="max-w-5xl mx-auto flex flex-col gap-8 md:flex-row md:gap-8">
              <div className="flex flex-1 min-w-0">
                <Card className="w-full" style={{ borderColor: `${dynamicStyles.primaryColor}20` }}>
                  <CardHeader>
                    <CardTitle style={{ color: dynamicStyles.primaryColor }}>Client Information</CardTitle>
                    <CardDescription>Enter the details of the new client to register them to {gym.name}.</CardDescription>
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
                                  <Button 
                                    type="button" 
                                    onClick={generatePassword} 
                                    variant="outline"
                                    style={{ borderColor: dynamicStyles.primaryColor, color: dynamicStyles.primaryColor }}
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
                                <Select onValueChange={handlePackageChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select a package" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {packages.length === 0 ? (
                                      <SelectItem value="no-packages" disabled>No packages available</SelectItem>
                                    ) : (
                                      packages.map((pkg) => (
                                        <SelectItem key={pkg.id} value={pkg.id}>{pkg.name}</SelectItem>
                                      ))
                                    )}
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
                                    {trainers.length === 0 ? (
                                      <SelectItem value="no-trainers" disabled>No trainers available</SelectItem>
                                    ) : (
                                      trainers.map((trainer) => (
                                        <SelectItem key={trainer.id} value={trainer.id}>{trainer.full_name}</SelectItem>
                                      ))
                                    )}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}
                        <Card className="mt-6" style={{ borderColor: `${dynamicStyles.primaryColor}20` }}>
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
                        <Button 
                          type="submit" 
                          className="w-full text-white" 
                          disabled={isLoading || packages.length === 0}
                          style={{ backgroundColor: dynamicStyles.primaryColor }}
                        >
                          {isLoading ? "Registering..." : `Register Client to ${gym.name}`}
                        </Button>
                        {packages.length === 0 && (
                          <p className="text-sm text-red-600 text-center">
                            No packages available for this gym. Please create packages first.
                          </p>
                        )}
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              </div>
              {qrCodeValue && (
                <div className="flex flex-1 min-w-0 mt-8 md:mt-0">
                  <Card className="w-full" style={{ border: `2px solid ${dynamicStyles.primaryColor}`, borderRadius: 8 }}>
                    <CardHeader>
                      <CardTitle style={{ color: dynamicStyles.primaryColor }}>
                        QR Code for {registeredClientName}
                      </CardTitle>
                      <CardDescription>Scan this QR code for check-in at {gym.name}.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col md:flex-row items-start md:items-center gap-6 p-6">
                      <div className="flex-1 text-left break-words">
                        <p className="text-2xl font-bold text-black">Name: <span className="font-medium">{registeredClientName}</span></p>
                        <p className="mt-3 text-base text-slate-800"><strong>Phone:</strong> <span className="font-medium">{registeredClientDetails?.phone ?? '—'}</span></p>
                        <p className="mt-2 text-base text-slate-800"><strong>Email:</strong> <span className="font-medium">{registeredClientEmail ?? '—'}</span></p>
                        <p className="mt-2 text-base text-slate-800"><strong>Gender:</strong> <span className="font-medium">{registeredClientDetails?.gender ?? '—'}</span></p>
                        <p className="mt-2 text-base text-slate-800"><strong>Emergency name:</strong> <span className="font-medium">{registeredClientDetails?.emergency_name ?? '—'}</span></p>
                        <p className="mt-2 text-base text-slate-800"><strong>Emergency Contact:</strong> <span className="font-medium">{registeredClientDetails?.emergency_phone ?? '—'}</span></p>
                      </div>

                      <div className="w-full sm:max-w-[260px] md:w-56 flex-shrink-0 mx-auto">
                        <div 
                          ref={qrRef}
                          className="p-4 rounded-lg max-w-full"
                          style={{ backgroundColor: '#ffffff', border: `2px solid ${dynamicStyles.primaryColor}22`, boxShadow: '0 4px 12px rgba(16,24,40,0.04)', borderRadius: 12 }}
                        >
                          <QRCodeSVG 
                            value={qrCodeValue} 
                            size={240} 
                            level="H" 
                            className="w-full h-auto block"
                            fgColor="#000000"
                            bgColor="#ffffff"
                          />
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="flex flex-col sm:flex-row justify-end sm:justify-end gap-3 w-full">
                      <div className="flex flex-col sm:flex-row gap-3 sm:ml-auto w-full sm:w-auto">
                        <Button 
                          onClick={handleQrCodeDone}
                          style={{ backgroundColor: dynamicStyles.primaryColor }}
                          className="text-white w-full sm:w-auto"
                        >
                          Done
                        </Button>
                        <Button
                          onClick={handleQrCodeDownload}
                          style={{ backgroundColor: dynamicStyles.primaryColor }}
                          className="text-white w-full sm:w-auto"
                        >
                          Download
                        </Button>
                      </div>
                    </CardFooter>
                  </Card>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
