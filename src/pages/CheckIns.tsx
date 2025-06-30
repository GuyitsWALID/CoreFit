import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, Fingerprint, Filter, Download, Users, UserCheck } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/supabaseClient';

interface ClientCheckIn {
  id: string;
  checkin_time: string;
  checkin_date: string;
  checkout_time?: string;
  user_id: string;
  users: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    package_id?: string;
    packages?: {
      name: string;
    };
  };
}

interface StaffCheckIn {
  id: string;
  checkin_time: string;
  checkin_date: string;
  checkout_time?: string;
  staff_id: string;
  staff: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    role_id?: string;
    roles?: {
      name: string;
    };
  };
}

export default function CheckIns() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('today');
  const [roleFilter, setRoleFilter] = useState('all');
  const [clientCheckIns, setClientCheckIns] = useState<ClientCheckIn[]>([]);
  const [staffCheckIns, setStaffCheckIns] = useState<StaffCheckIn[]>([]);
  const [fingerprintScanActive, setFingerprintScanActive] = useState(false);
  const [fingerprintStatus, setFingerprintStatus] = useState<'idle' | 'scanning' | 'success' | 'error' | 'not_found'>('idle');
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('clients');
  
  const todayDate = new Date().toISOString().split('T')[0];
  const yesterdayDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  useEffect(() => {
    fetchCheckIns();
  }, []);

  const fetchCheckIns = async () => {
    setIsLoading(true);
    try {
      // Fetch client check-ins
      const { data: clientData, error: clientError } = await supabase
        .from('client_checkins')
        .select(`
          *,
          users!inner (
            id,
            first_name,
            last_name,
            email,
            package_id,
            packages (
              name
            )
          )
        `)
        .order('checkin_time', { ascending: false });

      if (clientError) {
        console.error('Error fetching client check-ins:', clientError);
        toast({
          title: "Error loading client check-ins",
          description: `Could not load client check-ins: ${clientError.message}`,
          variant: "destructive"
        });
      } else {
        setClientCheckIns(clientData || []);
      }

      // Fetch staff check-ins
      const { data: staffData, error: staffError } = await supabase
        .from('staff_checkins')
        .select(`
          *,
          staff!inner (
            id,
            first_name,
            last_name,
            email,
            role_id,
            roles (
              name
            )
          )
        `)
        .order('checkin_time', { ascending: false });

      if (staffError) {
        console.error('Error fetching staff check-ins:', staffError);
        toast({
          title: "Error loading staff check-ins",
          description: `Could not load staff check-ins: ${staffError.message}`,
          variant: "destructive"
        });
      } else {
        setStaffCheckIns(staffData || []);
      }
    } catch (error: any) {
      console.error('Unexpected error:', error);
      toast({
        title: "Error loading check-ins",
        description: `Unexpected error: ${error?.message || 'Unknown error'}`,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Filter client check-ins
  const filteredClientCheckIns = clientCheckIns
    .filter(checkIn => {
      // Date filter
      if (dateFilter === 'today') return checkIn.checkin_date === todayDate;
      if (dateFilter === 'yesterday') return checkIn.checkin_date === yesterdayDate;
      return true; // 'all' filter
    })
    .filter(checkIn => {
      // Search filter
      if (!searchTerm) return true;
      const fullName = `${checkIn.users.first_name} ${checkIn.users.last_name}`;
      return (
        fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        checkIn.users.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    });

  // Filter staff check-ins
  const filteredStaffCheckIns = staffCheckIns
    .filter(checkIn => {
      // Date filter
      if (dateFilter === 'today') return checkIn.checkin_date === todayDate;
      if (dateFilter === 'yesterday') return checkIn.checkin_date === yesterdayDate;
      return true; // 'all' filter
    })
    .filter(checkIn => {
      // Role filter
      if (roleFilter !== 'all') {
        const role = checkIn.staff.roles?.name.toLowerCase();
        return role === roleFilter;
      }
      return true;
    })
    .filter(checkIn => {
      // Search filter
      if (!searchTerm) return true;
      const fullName = `${checkIn.staff.first_name} ${checkIn.staff.last_name}`;
      return (
        fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        checkIn.staff.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    });
  
  const handleFingerprintScan = async () => {
    setFingerprintScanActive(true);
    setFingerprintStatus('scanning');
    
    // Simulate fingerprint scanning process
    setTimeout(async () => {
      try {
        // In a real implementation, you would:
        // 1. Capture fingerprint data from sensor
        // 2. Compare with stored fingerprint templates in database
        // 3. Find matching person and create check-in record
        
        // Simulate fingerprint matching process
        const mockFingerprintData = "captured_fingerprint_template";
        
        // Simulate database lookup for matching fingerprint
        const { data: matchingPerson, error: lookupError } = await supabase
          .from('staff')
          .select(`
            id,
            first_name,
            last_name,
            fingerprint_data,
            roles (name)
          `)
          .eq('fingerprint_enrolled', true)
          .limit(1); // In reality, you'd match against the captured template
        
        if (lookupError) {
          console.error('Error looking up fingerprint:', lookupError);
          setFingerprintStatus('error');
          return;
        }

        if (matchingPerson && matchingPerson.length > 0) {
          const person = matchingPerson[0];
          
          // Create check-in record (example for staff - you'd determine if it's staff or client)
          const { error: checkinError } = await supabase
            .from('staff_checkins')
            .insert([
              {
                staff_id: person.id,
                checkin_time: new Date().toISOString(),
                checkin_date: new Date().toISOString().split('T')[0]
              }
            ]);

          if (checkinError) {
            console.error('Error creating check-in:', checkinError);
            setFingerprintStatus('error');
            toast({
              title: "Check-in failed",
              description: "Could not record check-in. Please try again.",
              variant: "destructive"
            });
          } else {
            setFingerprintStatus('success');
            toast({
              title: "Check-in successful",
              description: `${person.first_name} ${person.last_name} has been checked in successfully.`,
            });
            
            // Refresh check-ins after successful scan
            fetchCheckIns();
          }
        } else {
          setFingerprintStatus('not_found');
          toast({
            title: "Fingerprint not recognized",
            description: "No matching fingerprint found. Please ensure you're enrolled in the system.",
            variant: "destructive"
          });
        }
      } catch (error) {
        console.error('Error during fingerprint scan:', error);
        setFingerprintStatus('error');
        toast({
          title: "Scan failed",
          description: "An error occurred during fingerprint scanning.",
          variant: "destructive"
        });
      } finally {
        setFingerprintScanActive(false);
      }
    }, 3000);
  };

  const resetFingerprintScan = () => {
    setFingerprintStatus('idle');
    setFingerprintScanActive(false);
  };

  const formatTime = (timeString: string) => {
    return new Date(timeString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US');
  };

  if (isLoading) {
    return (
      <div className="animate-fade-in">
        <h2 className="text-3xl font-bold tracking-tight mb-6">Check-Ins</h2>
        <div className="text-center py-8">Loading check-ins...</div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-bold tracking-tight">Check-Ins</h2>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList>
          <TabsTrigger value="clients" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Client Check-Ins
          </TabsTrigger>
          <TabsTrigger value="staff" className="flex items-center gap-2">
            <UserCheck className="h-4 w-4" />
            Staff Check-Ins
          </TabsTrigger>
          <TabsTrigger value="scan">
            <Fingerprint className="h-4 w-4 mr-2" />
            Fingerprint Scan
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="clients" className="space-y-4">
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                type="search"
                placeholder="Search by name or email..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Filter by date" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="all">All Dates</SelectItem>
              </SelectContent>
            </Select>
            
            <Button variant="outline" className="ml-auto">
              <Download className="mr-2 h-4 w-4" /> Export
            </Button>
          </div>
          
          <Card>
            <CardHeader className="p-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">Client Check-In Records</CardTitle>
                <CardDescription>
                  {filteredClientCheckIns.length} records found
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Check-In Time</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Package</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClientCheckIns.length > 0 ? (
                      filteredClientCheckIns.map((checkIn) => (
                        <TableRow key={checkIn.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="bg-fitness-primary text-white text-xs">
                                  {checkIn.users.first_name[0]}{checkIn.users.last_name[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p>{checkIn.users.first_name} {checkIn.users.last_name}</p>
                                <p className="text-sm text-gray-500">{checkIn.users.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{formatTime(checkIn.checkin_time)}</TableCell>
                          <TableCell>{formatDate(checkIn.checkin_date)}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {checkIn.users.packages?.name || 'No Package'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={checkIn.checkout_time ? "outline" : "default"}>
                              {checkIn.checkout_time ? 'Checked Out' : 'Active'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No client check-in records found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="staff" className="space-y-4">
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                type="search"
                placeholder="Search by name or email..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="trainer">Trainer</SelectItem>
                <SelectItem value="receptionist">Receptionist</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Filter by date" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="all">All Dates</SelectItem>
              </SelectContent>
            </Select>
            
            <Button variant="outline" className="ml-auto">
              <Download className="mr-2 h-4 w-4" /> Export
            </Button>
          </div>
          
          <Card>
            <CardHeader className="p-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">Staff Check-In Records</CardTitle>
                <CardDescription>
                  {filteredStaffCheckIns.length} records found
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff Member</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Check-In Time</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStaffCheckIns.length > 0 ? (
                      filteredStaffCheckIns.map((checkIn) => (
                        <TableRow key={checkIn.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="bg-fitness-primary text-white text-xs">
                                  {checkIn.staff.first_name[0]}{checkIn.staff.last_name[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p>{checkIn.staff.first_name} {checkIn.staff.last_name}</p>
                                <p className="text-sm text-gray-500">{checkIn.staff.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {checkIn.staff.roles?.name || 'No Role'}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatTime(checkIn.checkin_time)}</TableCell>
                          <TableCell>{formatDate(checkIn.checkin_date)}</TableCell>
                          <TableCell>
                            <Badge variant={checkIn.checkout_time ? "outline" : "default"}>
                              {checkIn.checkout_time ? 'Checked Out' : 'Active'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No staff check-in records found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="scan">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Fingerprint className="h-5 w-5" />
                Fingerprint Check-In
              </CardTitle>
              <CardDescription>
                Use fingerprint scanner to record check-in for enrolled members and staff.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center space-y-4">
              <div className="border border-dashed border-gray-300 w-full max-w-md rounded-lg p-8 flex flex-col items-center">
                {fingerprintScanActive ? (
                  <div className="relative w-64 h-64 bg-gradient-to-b from-teal-50 to-teal-100 flex items-center justify-center rounded-lg">
                    <div className="absolute inset-0 border-2 border-teal-400 animate-pulse rounded-lg"></div>
                    <div className="flex flex-col items-center">
                      <Fingerprint size={64} className="text-teal-600 animate-pulse" />
                      <p className="text-sm text-teal-700 mt-2 font-medium">Scanning fingerprint...</p>
                      <p className="text-xs text-teal-600">Please keep finger on sensor</p>
                    </div>
                  </div>
                ) : (
                  <div className="w-64 h-64 bg-gray-50 flex items-center justify-center rounded-lg border-2 border-gray-200">
                    {fingerprintStatus === 'success' ? (
                      <div className="flex flex-col items-center text-green-600">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-3">
                          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <p className="text-sm font-medium">Check-in successful!</p>
                      </div>
                    ) : fingerprintStatus === 'error' ? (
                      <div className="flex flex-col items-center text-red-600">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-3">
                          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="6 18L18 6M6 6l12 12" />
                          </svg>
                        </div>
                        <p className="text-sm font-medium">Scan failed</p>
                      </div>
                    ) : fingerprintStatus === 'not_found' ? (
                      <div className="flex flex-col items-center text-orange-600">
                        <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-3">
                          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                          </svg>
                        </div>
                        <p className="text-sm font-medium">Fingerprint not found</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center text-gray-400">
                        <Fingerprint size={64} />
                        <p className="text-sm mt-2">Touch sensor to scan</p>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="flex gap-2 mt-4">
                  <Button 
                    onClick={handleFingerprintScan} 
                    disabled={fingerprintScanActive}
                    className="bg-teal-600 hover:bg-teal-700 text-white"
                  >
                    {fingerprintScanActive ? 'Scanning...' : 'Start Fingerprint Scan'}
                  </Button>
                  
                  {(fingerprintStatus === 'success' || fingerprintStatus === 'error' || fingerprintStatus === 'not_found') && (
                    <Button 
                      onClick={resetFingerprintScan}
                      variant="outline"
                    >
                      Scan Another
                    </Button>
                  )}
                </div>
              </div>
              
              <div className="text-center max-w-md">
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Instructions:</strong>
                </p>
                <ul className="text-xs text-gray-500 space-y-1">
                  <li>• Ensure your finger is clean and dry</li>
                  <li>• Place finger firmly on the scanner</li>
                  <li>• Hold still until scan completes</li>
                  <li>• Contact admin if your fingerprint isn't enrolled</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
