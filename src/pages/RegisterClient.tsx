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
  emergency_name: z.string().optional(),
  emergency_phone: z.string().optional(),
  relationship: z.string().optional(),
  fitness_goal: z.string().optional(),
});

export default function RegisterClient() {
  const { toast } = useToast();
  const [packages, setPackages] = useState<Array<{id: string, name: string, duration: string}>>([]);
  const [isLoadingPackages, setIsLoadingPackages] = useState(true);
  
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
        const { data, error } = await supabase
          .from('packages')
          .select('id, name, duration')
          .order('name');
        
        if (error) {
          console.error('Error fetching packages:', error);
          toast({
            title: "Error loading packages",
            description: "Could not load membership packages",
            variant: "destructive"
          });
        } else {
          setPackages(data || []);
        }
      } catch (error) {
        console.error('Unexpected error fetching packages:', error);
      } finally {
        setIsLoadingPackages(false);
      }
    }

    fetchPackages();
  }, [toast]);

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

  return (
    <div className="animate-fade-in">
      <h2 className="text-3xl font-bold tracking-tight mb-6">Register New Client</h2>
      
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
                      <FormControl>
                        <Input placeholder="Enter password" type="password" {...field} />
                      </FormControl>
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
                      <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLoadingPackages}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={isLoadingPackages ? "Loading packages..." : "Select package"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {packages.map((pkg) => (
                            <SelectItem key={pkg.id} value={pkg.id}>
                              {pkg.name} ({pkg.duration})
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
                <Button type="submit" className="bg-fitness-primary hover:bg-fitness-primary/90 text-white">Register Client</Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
