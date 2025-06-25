
import React, { useState } from 'react';
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
import { Search, QrCode, Filter, Download } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

// Mock data 
// will be replaced by actual data from data base from table users and pacakages
const mockCheckIns = [
  { 
    id: '1', 
    name: 'John Doe', 
    time: '08:30 AM', 
    date: '2025-04-29', 
    package: 'Gold Membership',
    qrId: 'QR00123'
  },
  { 
    id: '2', 
    name: 'Sarah Williams', 
    time: '09:15 AM', 
    date: '2025-04-29', 
    package: 'Premium Membership',
    qrId: 'QR00124'
  },
  { 
    id: '3', 
    name: 'Michael Johnson', 
    time: '10:20 AM', 
    date: '2025-04-29', 
    package: 'Silver Membership',
    qrId: 'QR00125'
  },
  { 
    id: '4', 
    name: 'Emily Chen', 
    time: '11:05 AM', 
    date: '2025-04-29', 
    package: 'Basic Membership',
    qrId: 'QR00126'
  },
  { 
    id: '5', 
    name: 'David Kim', 
    time: '12:30 PM', 
    date: '2025-04-29', 
    package: 'Gold Membership',
    qrId: 'QR00127'
  },
  { 
    id: '6', 
    name: 'Jessica Taylor', 
    time: '01:15 PM', 
    date: '2025-04-29', 
    package: 'Premium Membership',
    qrId: 'QR00128'
  },
  { 
    id: '7', 
    name: 'Robert Garcia', 
    time: '02:40 PM', 
    date: '2025-04-29', 
    package: 'Silver Membership',
    qrId: 'QR00129'
  },
  { 
    id: '8', 
    name: 'Lisa Wong', 
    time: '03:20 PM', 
    date: '2025-04-28', 
    package: 'Basic Membership',
    qrId: 'QR00130'
  },
  { 
    id: '9', 
    name: 'James Smith', 
    time: '04:10 PM', 
    date: '2025-04-28', 
    package: 'Gold Membership',
    qrId: 'QR00131'
  },
  { 
    id: '10', 
    name: 'Maria Rodriguez', 
    time: '05:00 PM', 
    date: '2025-04-28', 
    package: 'Premium Membership',
    qrId: 'QR00132'
  },
];

export default function CheckIns() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('today');
  const [checkIns, setCheckIns] = useState(mockCheckIns);
  const [qrScanActive, setQrScanActive] = useState(false);
  
  const todayDate = '2025-04-29'; // In a real app, use new Date().toISOString().split('T')[0]
  const yesterdayDate = '2025-04-28';
  
  // Filter check-ins based on search term and date filter
  const filteredCheckIns = checkIns
    .filter(checkIn => {
      // Date filter
      if (dateFilter === 'today') return checkIn.date === todayDate;
      if (dateFilter === 'yesterday') return checkIn.date === yesterdayDate;
      return true; // 'all' filter
    })
    .filter(checkIn => {
      // Search filter (if search term exists)
      if (!searchTerm) return true;
      return (
        checkIn.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        checkIn.qrId.toLowerCase().includes(searchTerm.toLowerCase())
      );
    });
  
  const handleQrScan = () => {
    setQrScanActive(true);
    
    // Simulate a QR scan after 2 seconds
    setTimeout(() => {
      setQrScanActive(false);
      
      toast({
        title: "Check-in successful",
        description: "John Doe has been checked in successfully.",
      });
    }, 2000);
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-bold tracking-tight">Check-Ins</h2>
      </div>
      
      <Tabs defaultValue="history" className="mb-6">
        <TabsList>
          <TabsTrigger value="history">Check-In History</TabsTrigger>
          <TabsTrigger value="scan">Scan QR Code</TabsTrigger>
        </TabsList>
        
        <TabsContent value="history" className="space-y-4">
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                type="search"
                placeholder="Search by name or QR ID..."
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
                <CardTitle className="text-xl">Check-In Records</CardTitle>
                <CardDescription>
                  {filteredCheckIns.length} records found
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>QR ID</TableHead>
                      <TableHead>Package</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCheckIns.length > 0 ? (
                      filteredCheckIns.map((checkIn) => (
                        <TableRow key={checkIn.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="bg-fitness-primary text-white text-xs">
                                  {checkIn.name.split(' ').map(n => n[0]).join('')}
                                </AvatarFallback>
                              </Avatar>
                              {checkIn.name}
                            </div>
                          </TableCell>
                          <TableCell>{checkIn.time}</TableCell>
                          <TableCell>{checkIn.date}</TableCell>
                          <TableCell>{checkIn.qrId}</TableCell>
                          <TableCell>{checkIn.package}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No check-in records found
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
              <CardTitle>Scan Member QR Code</CardTitle>
              <CardDescription>
                Scan the member's QR code to record their check-in.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center space-y-4">
              <div className="border border-dashed border-gray-300 w-full max-w-md rounded-lg p-8 flex flex-col items-center">
                {qrScanActive ? (
                  <div className="relative w-64 h-64 bg-gray-100 flex items-center justify-center">
                    <div className="absolute inset-0 border-2 border-fitness-primary animate-pulse rounded-md"></div>
                    <p className="text-sm text-gray-500">Scanning...</p>
                  </div>
                ) : (
                  <div className="w-64 h-64 bg-gray-50 flex items-center justify-center rounded-md">
                    <QrCode size={48} className="text-gray-300" />
                  </div>
                )}
                <Button 
                  onClick={handleQrScan} 
                  disabled={qrScanActive}
                  className="mt-4 bg-fitness-primary hover:bg-fitness-primary/90 text-white"
                >
                  {qrScanActive ? 'Scanning...' : 'Start QR Scanner'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
