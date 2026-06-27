import React, { useState } from 'react';
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Eye, EyeOff, Lock, User } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { Link, useLocation } from "react-router-dom";

const loginSchema = z.object({
  email: z.string().email({ message: "Valid email is required." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
});

export default function AdminLogin() {
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const location = useLocation();
  const superAdminOnly = location.pathname === '/admin/login';

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  async function onSubmit(values: z.infer<typeof loginSchema>) {
    setIsLoading(true);
    try {
      // 1. Authenticate with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });

      if (authError) {
        toast({
          title: "Login failed",
          description: authError.message,
          variant: "destructive",
        });
        return;
      }

      if (!authData.user) {
        toast({
          title: "Login failed",
          description: "No user data returned from authentication.",
          variant: "destructive",
        });
        return;
      }

      // 2. Fetch admin/staff record to get gym_id and role.
      // Keep this tolerant: staff/auth ids can differ, and a broken role join should show
      // a role-specific error instead of pretending the staff account does not exist.
      const normalizedEmail = (authData.user.email || values.email).trim().toLowerCase();
      const staffSelect = `
        id,
        email,
        gym_id,
        first_name,
        last_name,
        is_active,
        roles (
          id,
          name
        ),
        gyms (
          id,
          name,
          status
        )
      `;

      let staffRecord = null;
      let staffLookupError: any = null;
      const isActiveStaff = (staff: any) =>
        staff?.is_active === true || staff?.is_active === 'true' || staff?.is_active === 1;
      const sameEmail = (staff: any) =>
        String(staff?.email || '').trim().toLowerCase() === normalizedEmail;

      const { data: staffByIdRows, error: staffByIdError } = await supabase
        .from('staff')
        .select(staffSelect)
        .eq('id', authData.user.id)
        .limit(1);

      if (staffByIdError) {
        console.error('Admin login staff lookup by auth id failed:', staffByIdError);
        staffLookupError = staffByIdError;
      }

      if (staffByIdRows?.length) {
        console.info('Admin login staff auth-id matches:', staffByIdRows.map((staff: any) => ({
          id: staff.id,
          email: staff.email,
          is_active: staff.is_active,
          role: Array.isArray(staff.roles) ? staff.roles[0]?.name : staff.roles?.name,
          gym_id: staff.gym_id,
          gym_status: Array.isArray(staff.gyms) ? staff.gyms[0]?.status : staff.gyms?.status,
        })));
      }

      staffRecord = staffByIdRows?.find(isActiveStaff) || null;

      if (!staffRecord) {
        const { data: staffByEmailRows, error: staffByEmailError } = await supabase
          .from('staff')
          .select(staffSelect)
          .ilike('email', `%${normalizedEmail}%`)
          .limit(5);

        if (staffByEmailError) {
          console.error('Admin login staff lookup by email failed:', staffByEmailError);
          staffLookupError = staffByEmailError;
        }

        if (staffByEmailRows?.length) {
          console.info('Admin login staff email matches:', staffByEmailRows.map((staff: any) => ({
            id: staff.id,
            email: staff.email,
            is_active: staff.is_active,
            role: Array.isArray(staff.roles) ? staff.roles[0]?.name : staff.roles?.name,
            gym_id: staff.gym_id,
            gym_status: Array.isArray(staff.gyms) ? staff.gyms[0]?.status : staff.gyms?.status,
          })));
        }

        staffRecord = staffByEmailRows?.find((staff: any) =>
          isActiveStaff(staff) && sameEmail(staff)
        ) || staffByEmailRows?.find(isActiveStaff) || null;
      }

      if (!staffRecord) {
        console.error('Admin login denied: no active staff record matched authenticated user.', {
          authUserId: authData.user.id,
          authEmail: authData.user.email,
          submittedEmail: values.email,
          normalizedEmail,
          staffLookupError,
        });

        toast({
          title: "Access denied",
          description: staffLookupError?.message
            ? `Staff lookup failed: ${staffLookupError.message}`
            : "No visible active staff account matched this login. Check the browser console for the exact auth id/email used.",
          variant: "destructive",
        });
        // Sign out the user since they don't have proper access
        await supabase.auth.signOut();
        return;
      }

      // 3. Check if user has admin role or other authorized roles
      // Normalize role: support roles being returned as array or object, trim whitespace and lowercase
      const _rawRole = Array.isArray((staffRecord as any).roles) ? (staffRecord as any).roles[0]?.name : (staffRecord as any).roles?.name;
      const userRole = (_rawRole ?? '').toString().trim().toLowerCase();
      console.log('Detected user role on login:', userRole); // debug
      // Include 'receptionist' so front-desk staff can also access the admin dashboard when appropriate
      const authorizedRoles = superAdminOnly
        ? ['super_admin']
        : ['super_admin', 'admin', 'manager', 'owner', 'receptionist'];
      
      if (!authorizedRoles.includes(userRole)) {
        toast({
          title: "Access denied",
          description: superAdminOnly
            ? "Only an active super-admin account can access the system administration area."
            : `Your role (${userRole}) does not have admin dashboard access.`,
          variant: "destructive",
        });
        await supabase.auth.signOut();
        return;
      }

      // Super admins manage every gym and do not require a gym assignment.
      if (userRole === 'super_admin') {
        toast({
          title: "Login successful",
          description: `Welcome ${staffRecord.first_name}! Redirecting to the system dashboard...`,
        });
        window.location.href = '/admin/gyms';
        return;
      }

      // 4. Check if gym exists and is active
      const gym = staffRecord.gyms as any;
      if (!gym || gym.status !== 'active') {
        toast({
          title: "Gym access unavailable",
          description: "The gym associated with your account is not currently active.",
          variant: "destructive",
        });
        await supabase.auth.signOut();
        return;
      }

      // 5. Success - redirect to gym-specific dashboard
      toast({
        title: "Login successful",
        description: `Welcome ${staffRecord.first_name}! Redirecting to ${gym.name} dashboard...`,
      });

      // Navigate to gym-specific dashboard
      const gymUrl = `/${gym.id}/dashboard`;
      
      // Use window.location.href for a full page navigation to ensure proper gym context loading
      window.location.href = gymUrl;
      
      // Alternative: Use navigate if you prefer React Router navigation
      // navigate(gymUrl);

    } catch (error: any) {
      console.error('Login error:', error);
      toast({
        title: "Login failed",
        description: error.message || "An unexpected error occurred during login",
        variant: "destructive",
      });
      
      // Ensure user is signed out on any unexpected error
      await supabase.auth.signOut();
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-fitness-primary rounded-full flex items-center justify-center mb-4">
            <Lock className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">{superAdminOnly ? 'Super Admin Login' : 'Admin Login'}</h1>
          <p className="text-gray-600 mt-2">
            {superAdminOnly ? 'Secure access to system-wide administration' : "Access your gym's admin dashboard"}
          </p>
        </div>

        <Card className="w-full shadow-lg">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">Sign In</CardTitle>
            <CardDescription className="text-center">
              {superAdminOnly
                ? 'Enter an active super-admin account'
                : "Enter your credentials to access your gym's admin dashboard"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <div className="relative">
                        <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <FormControl>
                          <Input 
                            placeholder="admin@yourgym.com" 
                            type="email"
                            className="pl-10"
                            disabled={isLoading}
                            {...field} 
                          />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <FormControl>
                          <Input 
                            placeholder="Enter your password"
                            type={showPassword ? "text" : "password"}
                            className="pl-10 pr-10"
                            disabled={isLoading}
                            {...field} 
                          />
                        </FormControl>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={togglePasswordVisibility}
                          disabled={isLoading}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4 text-gray-400" />
                          ) : (
                            <Eye className="h-4 w-4 text-gray-400" />
                          )}
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <input
                      id="remember"
                      type="checkbox"
                      className="rounded border-gray-300 text-fitness-primary focus:ring-fitness-primary"
                      disabled={isLoading}
                    />
                    <label htmlFor="remember" className="text-sm text-gray-600">
                      Remember me
                    </label>
                  </div>
                  <Link
                    to="/reset-password"
                    className="text-sm text-fitness-primary hover:text-fitness-primary/80"
                  >
                    Forgot password?
                  </Link>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-fitness-primary hover:bg-fitness-primary/90 text-white"
                  disabled={isLoading}
                >
                  {isLoading ? "Signing In..." : superAdminOnly ? "Sign In to Super Admin" : "Sign In to Gym Dashboard"}
                </Button>
              </form>
            </Form>

            <div className="mt-4 text-center">
              <p className="text-sm text-gray-600">
                Need help?{" "}
                <a
                  href="#"
                  className="text-fitness-primary hover:text-fitness-primary/80"
                >
                  Contact Support
                </a>
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 text-center">
          <p className="text-xs text-gray-500">
            © 2025 CoreFit Gym Management System. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
