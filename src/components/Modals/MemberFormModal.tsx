import React, { useState, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
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
import { supabase } from "@/supabaseClient";

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
  roles?: {
    id: string;
    name: string;
  };
}

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

interface MemberFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  memberToEdit: TeamMember | null;
  roles: Role[];
  onSave: () => void;
}

export default function MemberFormModal({
  isOpen,
  onClose,
  memberToEdit,
  roles,
  onSave,
}: MemberFormModalProps) {
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);

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

  useEffect(() => {
    if (memberToEdit) {
      form.reset({
        first_name: memberToEdit.first_name,
        last_name: memberToEdit.last_name,
        email: memberToEdit.email,
        phone: memberToEdit.phone,
        password: "", // Don't show password
        date_of_birth: memberToEdit.date_of_birth || "",
        gender: memberToEdit.gender as any,
        role: memberToEdit.role_id || "",
        hire_date: memberToEdit.hire_date ? new Date(memberToEdit.hire_date).toISOString().split("T")[0] : "",
        salary: memberToEdit.salary?.toString() || "",
      });
    } else {
      form.reset();
    }
  }, [memberToEdit, form]);

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

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      if (memberToEdit) {
        // Edit existing member
        const { error } = await supabase
          .from("staff")
          .update({
            first_name: values.first_name,
            last_name: values.last_name,
            email: values.email,
            phone: values.phone,
            date_of_birth: values.date_of_birth || null,
            gender: values.gender || null,
            role_id: values.role,
            hire_date: values.hire_date ? new Date(values.hire_date).toISOString().split("T")[0] : null,
            salary: parseFloat(values.salary),
          })
          .eq("id", memberToEdit.id);

        if (error) {
          toast({
            title: "Update failed",
            description: error.message,
            variant: "destructive"
          });
          return;
        }
        toast({
          title: "Staff updated",
          description: "Staff member details updated."
        });
      } else {
        // Add new member
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

        let userId = signUpData?.user?.id;
        if (!userId) {
          toast({
            title: "Registration failed",
            description: "No user ID returned from signUp.",
            variant: "destructive"
          });
          return;
        }

        const { error: rpcError } = await supabase.rpc("register_staff_profile", {
          p_id: userId,
          p_first_name: values.first_name,
          p_last_name: values.last_name,
          p_gender: values.gender || null,
          p_email: values.email,
          p_phone: values.phone,
          p_role_id: values.role,
          p_hire_date: values.hire_date ? new Date(values.hire_date).toISOString().split("T")[0] : null,
          p_salary: parseFloat(values.salary),
          p_date_of_birth: values.date_of_birth ? new Date(values.date_of_birth).toISOString().split("T")[0] : null,
        });

        if (rpcError) {
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
          description: `${values.first_name} ${values.last_name} has been added to the team.`,
        });
      }
      onSave();
      onClose();
    } catch (error: any) {
      toast({
        title: "Operation failed",
        description: `An unexpected error occurred: ${error?.message || "Unknown error"}`,
        variant: "destructive"
      });
    }
  }
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <DialogHeader>
          <DialogTitle>{memberToEdit ? "Edit Team Member" : "Add New Team Member"}</DialogTitle>
          <DialogDescription>
            {memberToEdit
              ? "Update the details of the team member."
              : "Fill in the details to add a new team member."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
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
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="john.doe@example.com" {...field} />
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
                    <Controller
                      control={form.control}
                      name="phone"
                      render={({ field: ctrl }) => (
                        <PhoneInput
                          country="et" // change to your default country
                          value={(ctrl.value as string) || ''}
                          onChange={(val) => ctrl.onChange(val.startsWith('+') ? val : `+${val}`)}
                          inputProps={{ name: 'phone', required: true }}
                          inputClass="w-full !h-10 !text-sm"
                          buttonClass="!h-10"
                          containerClass="w-full"
                        />
                      )}
                    />
                  </FormControl>
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
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="********" {...field}
                        disabled={!!memberToEdit} // Disable password field when editing
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={togglePasswordVisibility}
                        disabled={!!memberToEdit} // Disable toggle when editing
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {!memberToEdit && (
              <Button type="button" variant="outline" onClick={generatePassword} className="w-full">
                Generate Secure Password
              </Button>
            )}
            <FormField
              control={form.control}
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
              control={form.control}
              name="gender"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Gender</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a gender" />
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
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {roles.map(role => (
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
                    <Input type="number" placeholder="5000" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">
                {memberToEdit ? "Save Changes" : "Add Member"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}



