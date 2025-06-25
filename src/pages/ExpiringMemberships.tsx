
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, Filter, Bell } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Mock data
const mockExpiringMembers = [
  {
    id: '1',
    name: 'John Doe',
    package: 'Gold Membership',
    expiryDate: '2025-05-04',
    daysLeft: 5,
    phoneNumber: '+1 234-567-8901',
    status: 'active'
  },
  {
    id: '2',
    name: 'Emma Johnson',
    package: 'Premium Membership',
    expiryDate: '2025-05-03',
    daysLeft: 4,
    phoneNumber: '+1 234-567-8902',
    status: 'active'
  },
  {
    id: '3',
    name: 'Michael Smith',
    package: 'Silver Membership',
    expiryDate: '2025-05-02',
    daysLeft: 3,
    phoneNumber: '+1 234-567-8903',
    status: 'active'
  },
  {
    id: '4',
    name: 'Sara Williams',
    package: 'Basic Membership',
    expiryDate: '2025-05-01',
    daysLeft: 2,
    phoneNumber: '+1 234-567-8904',
    status: 'active'
  },
  {
    id: '5',
    name: 'David Chen',
    package: 'Gold Membership',
    expiryDate: '2025-04-30',
    daysLeft: 1,
    phoneNumber: '+1 234-567-8905',
    status: 'active'
  }
];

export default function ExpiringMemberships() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [members, setMembers] = useState(mockExpiringMembers);
  
  const filteredMembers = members.filter(member => {
    if (!searchTerm) return true;
    return (
      member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.phoneNumber.includes(searchTerm)
    );
  });
  
  const handleNotify = (memberId: string) => {
    const member = members.find(m => m.id === memberId);
    if (member) {
      toast({
        title: "Notification sent",
        description: `${member.name} has been notified about their expiring membership.`,
      });
    }
  };
  
  const handleNotifyAll = () => {
    toast({
      title: "All notifications sent",
      description: `${members.length} members have been notified about their expiring memberships.`,
    });
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-bold tracking-tight">Expiring Memberships</h2>
        <Button 
          className="bg-fitness-primary hover:bg-fitness-primary/90 text-white"
          onClick={handleNotifyAll}
        >
          <Bell className="mr-2 h-4 w-4" /> Notify All
        </Button>
      </div>
      
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
          <Input
            type="search"
            placeholder="Search by name or phone number..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      
      <Card>
        <CardHeader className="p-4">
          <CardTitle className="text-xl">Members With Expiring Memberships</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Phone Number</TableHead>
                  <TableHead>Membership</TableHead>
                  <TableHead>Expiry Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMembers.length > 0 ? (
                  filteredMembers.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-fitness-primary text-white text-xs">
                              {member.name.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          {member.name}
                        </div>
                      </TableCell>
                      <TableCell>{member.phoneNumber}</TableCell>
                      <TableCell>{member.package}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{member.expiryDate}</span>
                          <Badge 
                            variant={member.daysLeft <= 2 ? "destructive" : "outline"}
                            className="w-fit mt-1"
                          >
                            {member.daysLeft} days left
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize">
                          {member.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleNotify(member.id)}
                        >
                          <Bell className="mr-1 h-4 w-4" /> Notify
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No expiring memberships found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
