import React, { useState, useEffect, useMemo } from 'react';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Eye, EyeOff } from 'lucide-react';
import { supabase } from "@/lib/supabaseClient";
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import { callSendWelcomeSmsFunction } from "@/utils/sendWelcomeViaEdge";
import { GymConfig } from "@/lib/gymApi";

interface Role {
  id: string;
  name: string;
  description?: string;
}

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
  is_active: boolean;
  created_at: string;
  gym_id?: string;
  roles?: {
    id: string;
    name: string;
  };
  qr_code?: string;
}

export interface MemberFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  memberToEdit?: TeamMember | null;
  roles: Role[];
  onSave: () => Promise<void>;
  gym?: GymConfig | null; // Add gym prop
}

const formSchema = z.object({
  first_name: z.string().min(2),
  last_name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(10),
  password: z.string().min(8),
  date_of_birth: z.string().optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  role: z.string().min(1),
  hire_date: z.string().refine(val => !isNaN(Date.parse(val))),
  salary: z.string().min(1),
});

export default function MemberFormModal({
  isOpen,
  onClose,
  memberToEdit,
  roles,
  onSave,
  gym
}: MemberFormModalProps) {
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

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
      email: "",
      phone: "",
      password: "",
      date_of_birth: "",
      gender: undefined,
      role: "",
      hire_date: new Date().toISOString().split('T')[0],
      salary: "",
    },
  });

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

  // Send welcome SMS function
  const sendWelcomeSmsAndNotify = async (member: any, password: string) => {
    if (!gym) return;

    const payload = {
      type: "send_welcome_sms",
      data: {
        recipient_phone: member.phone,
        recipient_name: `${member.first_name} ${member.last_name}`,
        username: member.email,
        password: password,
        gym_name: gym.name || "Your Gym",
        gym_address: gym.address || "Gym Address",
        gym_phone: gym.owner_phone || "+1-XXX-XXX-XXXX",
        recipient_id: member.id,
      },
    };

    toast({
      title: "Sending welcome SMS",
      description: `Attempting to send SMS to ${member.phone}...`,
    });

    const fnUrl = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL
      ? `${import.meta.env.VITE_SUPABASE_FUNCTIONS_URL}/send-sms`
      : "/functions/v1/send-sms";

    const result = await callSendWelcomeSmsFunction(fnUrl, payload);

    if (result.ok) {
      toast({
        title: "Welcome SMS sent",
        description: `Welcome SMS was sent successfully to ${member.phone} for ${gym.name}`,
      });
    } else {
      console.error("send-sms function error:", result);
      toast({
        title: "SMS failed",
        description: `Welcome SMS could not be sent.`,
        variant: "destructive",
      });
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!gym || gym.id === 'default') {
      toast({
        title: "Gym context required",
        description: "Please ensure you're accessing this page from a specific gym context.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      if (memberToEdit) {
        // Update existing member
        const updateData = {
          first_name: values.first_name,
          last_name: values.last_name,
          full_name: `${values.first_name} ${values.last_name}`,
          email: values.email,
          phone: values.phone,
          date_of_birth: values.date_of_birth ? new Date(values.date_of_birth).toISOString().split('T')[0] : null,
          gender: values.gender || null,
          role_id: values.role,
          hire_date: values.hire_date,
          salary: parseFloat(values.salary),
        };

        const { error } = await supabase
          .from('staff')
          .update(updateData)
          .eq('id', memberToEdit.id)
          .eq('gym_id', gym?.id); // Ensure staff belongs to this gym

        if (error) {
          toast({
            title: "Update failed",
            description: error.message,
            variant: "destructive"
          });
          return;
        }

        toast({
          title: "Team member updated",
          description: `${values.first_name} ${values.last_name} has been updated successfully.`,
        });
      } else {
        // Create new member
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: values.email,
          password: values.password,
        });

        if (authError) {
          toast({
            title: "Authentication failed",
            description: authError.message,
            variant: "destructive"
          });
          return;
        }

        if (!authData.user) {
          toast({
            title: "Creation failed",
            description: "Could not create user account.",
            variant: "destructive"
          });
          return;
        }

        const staffData = {
          id: authData.user.id,
          first_name: values.first_name,
          last_name: values.last_name,
          full_name: `${values.first_name} ${values.last_name}`,
          email: values.email,
          phone: values.phone || null,
          date_of_birth: values.date_of_birth ? new Date(values.date_of_birth).toISOString().split('T')[0] : null,
          gender: values.gender || null,
          role_id: values.role,
          gym_id: gym.id, // Add gym_id to associate staff with current gym
          hire_date: new Date(values.hire_date).toISOString().split('T')[0],
          salary: parseFloat(values.salary),
          is_active: true,
        };

        const { error: staffError } = await supabase
          .from('staff')
          .insert([staffData]);

        if (staffError) {
          toast({
            title: "Creation failed",
            description: staffError.message,
            variant: "destructive"
          });
          return;
        }

        toast({
          title: "Team member created",
          description: `${values.first_name} ${values.last_name} has been added to ${gym.name} successfully.`,
        });

        // Send welcome SMS
        await sendWelcomeSmsAndNotify({
          id: authData.user.id,
          first_name: values.first_name,
          last_name: values.last_name,
          email: values.email,
          phone: values.phone,
        }, values.password);
      }

      await onSave();
      onClose();
      form.reset();
    } catch (error: any) {
      toast({
        title: "Operation failed",
        description: error.message || "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Reset form when member changes
  useEffect(() => {
    if (memberToEdit) {
      form.reset({
        first_name: memberToEdit.first_name || "",
        last_name: memberToEdit.last_name || "",
        email: memberToEdit.email || "",
        phone: memberToEdit.phone || "",
        password: "", // Don't populate password for edit
        date_of_birth: memberToEdit.date_of_birth || "",
        gender: (memberToEdit.gender as any) || undefined,
        role: memberToEdit.role_id || "",
        hire_date: memberToEdit.hire_date || new Date().toISOString().split('T')[0],
        salary: memberToEdit.salary?.toString() || "",
      });
    } else {
      form.reset({
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        password: "",
        date_of_birth: "",
        gender: undefined,
        role: "",
        hire_date: new Date().toISOString().split('T')[0],
        salary: "",
      });
    }
  }, [memberToEdit, form]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle style={{ color: dynamicStyles.primaryColor }}>
            {memberToEdit ? "Edit Team Member" : `Add Team Member to ${gym?.name || 'Gym'}`}
          </DialogTitle>
          <DialogDescription>
            {memberToEdit 
              ? "Update the team member's information." 
              : `Add a new team member to ${gym?.name || 'your gym'}.`
            }
          </DialogDescription>
      </DialogHeader>
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
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="john.doe@example.com" 
                        type="email" 
                        disabled={!!memberToEdit} // Disable email editing
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                    {memberToEdit && (
                      <p className="text-xs text-gray-500">Email cannot be changed</p>
                    )}
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <PhoneInput
                        country={'us'}
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
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {!memberToEdit && (
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
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
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
                name="salary"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Salary (ETB)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="50000" 
                        type="number" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            </div>

            <FormField
              control={form.control}
              name="gender"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Gender (Optional)</FormLabel>
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

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isLoading}
                style={{ backgroundColor: dynamicStyles.primaryColor }}
                className="text-white"
              >
                {isLoading 
                  ? (memberToEdit ? "Updating..." : "Creating...") 
                  : (memberToEdit ? "Update Member" : "Create Member")
                }
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}



