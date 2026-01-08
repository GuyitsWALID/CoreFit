import React, { useState, useEffect, useRef, useMemo } from 'react';
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
import { Eye, EyeOff, Plus, Edit, Grid3X3, List } from 'lucide-react';
import { supabase } from "@/lib/supabaseClient";

import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import MemberFormModal from "@/components/Modals/MemberFormModal";
// Add QR code renderer
import QRCode from 'react-qr-code';
// Add phone input component
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
// Add QrCode icon
import { QrCode } from 'lucide-react';
import { callSendWelcomeSmsFunction } from "@/utils/sendWelcomeViaEdge";
import { useGym } from "@/contexts/GymContext";
import { DynamicHeader } from "@/components/layout/DynamicHeader";
import { Sidebar } from "@/components/layout/Sidebar";

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
  qr_code?: string; // add qr code field from schema
}

// Optional minimal QR info state
type QRInfo = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  qr_code: string;
};

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

export default function TeamManagement() {
  const { toast } = useToast();
  const { gym, loading: gymLoading } = useGym();

  // --- state fixes ---
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | string>('all');
  const [displayMode, setDisplayMode] = useState<'card' | 'list'>('list');
  const [searchTerm, setSearchTerm] = useState("");
  const [editMember, setEditMember] = useState<TeamMember | null>(null);

  // NEW: control "Add" vs "Edit" modal
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const [confirmActiveDialog, setConfirmActiveDialog] = useState(false);
  const [pendingActiveMember, setPendingActiveMember] = useState<TeamMember | null>(null);

  const [qrInfo, setQrInfo] = useState<QRInfo | null>(null);
  const qrContainerRef = useRef<HTMLDivElement>(null);

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

  // Helper: create a JSON QR payload for a staff record to match scanner format
  const buildStaffQr = (m: TeamMember) =>
    JSON.stringify({
      staffId: m.id,
      firstName: m.first_name,
      lastName: m.last_name,
      roleId: m.role_id || null,
      gymId: gym?.id || null,
    });

  // Ensure missing QR codes are generated for a list of members
  const ensureQrCodes = async (members: TeamMember[]) => {
    const missing = members.filter(m => !m.qr_code);
    if (missing.length === 0) return;
    try {
      await Promise.all(
        missing.map(m =>
          supabase.from('staff').update({ qr_code: buildStaffQr(m) }).eq('id', m.id).eq('gym_id', gym?.id)
        )
      );
      await fetchTeamMembers();
    } catch (e: any) {
      toast({ title: 'QR assign failed', description: e?.message || 'Could not assign QR codes', variant: 'destructive' });
    }
  };

  // --- data fetching ---
  const fetchTeamMembers = async () => {
    if (!gym || gym.id === 'default') return;
    
    setIsLoading(true);
    
    let query = supabase
      .from('staff')
      .select(`
        *,
        roles(id, name)
      `);

    // Filter by gym if gym context is available and not default
    if (gym && gym.id !== 'default') {
      query = query.eq('gym_id', gym.id);
    }

    const { data, error } = await query;
    
    if (error) {
      toast({ 
        title: 'Load failed', 
        description: `Could not load team members: ${error.message}`, 
        variant: 'destructive' 
      });
    } else {
      const list = (data || []) as TeamMember[];
      setTeamMembers(list);
      // Backfill QR codes if missing
      await ensureQrCodes(list);
    }
    setIsLoading(false);
  };

  const fetchRoles = async () => {
    const { data, error } = await supabase.from('roles').select('*');
    if (!error && data) setRoles(data);
  };

  useEffect(() => {
    if (gym && gym.id !== 'default') {
      fetchTeamMembers();
      fetchRoles();
    }
  }, [gym]);

  // Realtime: when a new staff row is inserted, assign qr_code if missing and show QR modal
  useEffect(() => {
    if (!gym || gym.id === 'default') return;

    const channel = supabase
      .channel('staff-insert-qr')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'staff',
        filter: `gym_id=eq.${gym.id}` // Only listen for this gym's staff
      }, async (payload) => {
        const row = payload.new as TeamMember;
        try {
          const value = row.qr_code || buildStaffQr(row);
          if (!row.qr_code) {
            await supabase.from('staff').update({ qr_code: value }).eq('id', row.id).eq('gym_id', gym?.id);
          }
          await fetchTeamMembers();
          setQrInfo({
            id: row.id,
            first_name: row.first_name,
            last_name: row.last_name,
            email: row.email,
            qr_code: value,
          });
          toast({ 
            title: 'QR code generated', 
            description: `QR for ${row.first_name} ${row.last_name} is ready for ${gym.name}` 
          });
        } catch (e: any) {
          toast({ title: 'QR generation failed', description: e?.message || 'Could not set QR', variant: 'destructive' });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gym]);

  // --- actions ---
  const handleToggleActive = (member: TeamMember) => {
    setPendingActiveMember(member);
    setConfirmActiveDialog(true);
  };

  const confirmToggleActive = async () => {
    if (!pendingActiveMember) return;
    const newActive = !pendingActiveMember.is_active;
    const { error } = await supabase
      .from('staff')
      .update({ is_active: newActive })
      .eq('id', pendingActiveMember.id)
      .eq('gym_id', gym?.id); // Ensure staff belongs to this gym

    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    } else {
      toast({ 
        title: "Status updated", 
        description: `${pendingActiveMember.first_name} ${pendingActiveMember.last_name} is now ${newActive ? 'active' : 'inactive'} at ${gym?.name || 'the gym'}.` 
      });
      await fetchTeamMembers();
    }
    setConfirmActiveDialog(false);
    setPendingActiveMember(null);
  };

  const handleEdit = (member: TeamMember) => {
    setEditMember(member);
    setEditDialogOpen(true);
  };

  // Open QR modal for a specific member, generating qr_code if missing
  const openQrForMember = async (member: TeamMember) => {
    try {
      let value = member.qr_code || buildStaffQr(member);
      if (!member.qr_code) {
        const { error } = await supabase.from('staff').update({ qr_code: value }).eq('id', member.id).eq('gym_id', gym?.id);
        if (error) throw error;
        // refresh local list so member now has qr_code
        await fetchTeamMembers();
      }
      setQrInfo({
        id: member.id,
        first_name: member.first_name,
        last_name: member.last_name,
        email: member.email,
        qr_code: value,
      });
    } catch (e: any) {
      toast({ title: 'QR not available', description: e?.message || 'Failed to load QR', variant: 'destructive' });
    }
  };

  // --- send welcome SMS via Edge Function ---
  async function sendWelcomeSmsAndNotify(member: TeamMember, password: string) {
    const payload = {
      type: "send_welcome_sms",
      data: {
        recipient_phone: member.phone,
        recipient_name: `${member.first_name} ${member.last_name}`,
        username: member.email,
        password: password,
        gym_name: gym?.name || "Your Gym",
        gym_address: gym?.address || "Gym Address",
        gym_phone: gym?.owner_phone || "+1-XXX-XXX-XXXX",
        recipient_id: member.id,
      },
    };

    toast({
      title: "Sending welcome SMS",
      description: `Attempting to send SMS to ${member.phone}...`,
    });

    // Use the same function as RegisterClient
    const fnUrl = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL
      ? `${import.meta.env.VITE_SUPABASE_FUNCTIONS_URL}/send-sms`
      : "/functions/v1/send-sms";

    const result = await callSendWelcomeSmsFunction(fnUrl, payload);

    if (result.ok) {
      toast({
        title: "Welcome SMS sent",
        description: `Welcome SMS was sent successfully to ${member.phone} for ${gym?.name || 'the gym'}`,
      });
    } else {
      console.error("send-sms function error:", result);
      toast({
        title: "SMS failed",
        description: `Welcome SMS could not be sent.`,
        variant: "destructive",
      });
    }
  }

  // --- filtering & rendering ---
  const filteredMembers = teamMembers.filter(member => {
    const matchesSearch = searchTerm === '' ||
      `${member.first_name} ${member.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email.toLowerCase().includes(searchTerm.toLowerCase());
    if (activeTab === 'all') return matchesSearch;
    return matchesSearch && member.roles?.name.toLowerCase() === activeTab;
  });

  const renderMemberCard = (member: TeamMember) => (
    <Card key={member.id} className="hover:shadow-md transition-shadow" style={{ borderColor: `${dynamicStyles.primaryColor}20` }}>
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback style={{ backgroundColor: `${dynamicStyles.primaryColor}20`, color: dynamicStyles.primaryColor }}>
              {member.first_name[0]}{member.last_name[0]}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="font-semibold" style={{ color: dynamicStyles.primaryColor }}>
              {member.first_name} {member.last_name}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge 
                style={{ backgroundColor: `${dynamicStyles.accentColor}20`, color: dynamicStyles.accentColor }}
              >
                {member.roles?.name}
              </Badge>
              <Switch
                checked={member.is_active}
                onCheckedChange={() => handleToggleActive(member)}
                style={{ accentColor: dynamicStyles.primaryColor }}
              />
            </div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1 text-sm">
          <div>Email: {member.email}</div>
          <div>Phone: {member.phone}</div>
          <div>Salary: ETB {member.salary}</div>
          <div>Hire Date: {new Date(member.hire_date).toLocaleDateString()}</div>
        </div>
      </CardContent>
      <CardFooter>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => handleEdit(member)}
            style={{ borderColor: dynamicStyles.primaryColor, color: dynamicStyles.primaryColor }}
          >
            <Edit className="mr-1 h-4 w-4" /> Edit
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => openQrForMember(member)}
            style={{ borderColor: dynamicStyles.accentColor, color: dynamicStyles.accentColor }}
          >
            <QrCode className="mr-1 h-4 w-4" /> QR
          </Button>
        </div>
      </CardFooter>
    </Card>
  );

  const renderMemberRow = (member: TeamMember) => (
    <TableRow key={member.id}>
      <TableCell>
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback style={{ backgroundColor: `${dynamicStyles.primaryColor}20`, color: dynamicStyles.primaryColor }}>
              {member.first_name[0]}{member.last_name[0]}
            </AvatarFallback>
          </Avatar>
          <span style={{ color: dynamicStyles.primaryColor }}>{member.first_name} {member.last_name}</span>
        </div>
      </TableCell>
      <TableCell>
        <Badge style={{ backgroundColor: `${dynamicStyles.accentColor}20`, color: dynamicStyles.accentColor }}>
          {member.roles?.name}
        </Badge>
      </TableCell>
      <TableCell>{member.email}</TableCell>
      <TableCell>{member.phone}</TableCell>
      <TableCell>ETB {member.salary}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Switch
            checked={member.is_active}
            onCheckedChange={() => handleToggleActive(member)}
            style={{ accentColor: dynamicStyles.primaryColor }}
          />
          <span>{member.is_active ? "Active" : "Inactive"}</span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => handleEdit(member)}
            style={{ borderColor: dynamicStyles.primaryColor, color: dynamicStyles.primaryColor }}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => openQrForMember(member)} 
            aria-label="Show QR"
            style={{ borderColor: dynamicStyles.accentColor, color: dynamicStyles.accentColor }}
          >
            <QrCode className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );

  // Helpers: download QR as SVG/PNG
  const downloadSVG = () => {
    const svg = qrContainerRef.current?.querySelector('svg');
    if (!svg || !qrInfo) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svg);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${qrInfo.first_name}-${qrInfo.last_name}-qr.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPNG = () => {
    const svg = qrContainerRef.current?.querySelector('svg');
    if (!svg || !qrInfo) return;
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svg);
    const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    const size = 768; // export resolution
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      // white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const pngUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = pngUrl;
        a.download = `${qrInfo.first_name}-${qrInfo.last_name}-qr.png`;
        a.click();
        URL.revokeObjectURL(pngUrl);
        URL.revokeObjectURL(url);
      });
    };
    img.src = url;
  };

  // Loading state with dynamic layout
  if (gymLoading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-64 mb-4"></div>
            <div className="grid grid-cols-1 gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-32 bg-gray-200 rounded"></div>
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
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
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

  if (isLoading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <DynamicHeader />
          <main className="flex-1 flex items-center justify-center">
            <div className="animate-pulse text-center text-gray-500">
              Loading team members for {gym?.name || 'gym'}...
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <DynamicHeader />
        
        <main className="flex-1 overflow-x-hidden overflow-y-auto">
          <div className="space-y-6 p-6">
            {/* Header with dynamic styling */}
            <div className="flex justify-between items-center">
              <div>
                <h2 
                  className="text-3xl font-bold tracking-tight"
                  style={{ color: dynamicStyles.primaryColor }}
                >
                  Team Management
                </h2>
                <p className="text-gray-500 mt-1">
                  Manage staff members for {gym?.name || 'your gym'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Search team members..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
                <Button 
                  onClick={() => setDialogOpen(true)}
                  style={{ backgroundColor: dynamicStyles.primaryColor }}
                  className="text-white"
                >
                  <Plus className="mr-1 h-4 w-4" /> Add Member
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setDisplayMode(displayMode === 'card' ? 'list' : 'card')}
                >
                  {displayMode === 'card' ? <List className="h-4 w-4" /> : <Grid3X3 className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* Stats Cards with dynamic colors */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card style={{ backgroundColor: `${dynamicStyles.primaryColor}08` }}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-8 h-8 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: dynamicStyles.primaryColor }}
                    >
                      <span className="text-white text-sm">👥</span>
                    </div>
                    <div>
                      <div className="text-2xl font-bold" style={{ color: dynamicStyles.primaryColor }}>
                        {teamMembers.length}
                      </div>
                      <div className="text-sm text-gray-500">Total Team</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card style={{ backgroundColor: `${dynamicStyles.accentColor}08` }}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-8 h-8 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: dynamicStyles.accentColor }}
                    >
                      <span className="text-white text-sm">✓</span>
                    </div>
                    <div>
                      <div className="text-2xl font-bold" style={{ color: dynamicStyles.accentColor }}>
                        {teamMembers.filter(m => m.is_active).length}
                      </div>
                      <div className="text-sm text-gray-500">Active</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card style={{ backgroundColor: `${dynamicStyles.secondaryColor}08` }}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-8 h-8 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: dynamicStyles.secondaryColor }}
                    >
                      <span className="text-white text-sm">📋</span>
                    </div>
                    <div>
                      <div className="text-2xl font-bold" style={{ color: dynamicStyles.secondaryColor }}>
                        {roles.length}
                      </div>
                      <div className="text-sm text-gray-500">Roles</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card style={{ backgroundColor: `#10b98108` }}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-green-600">
                      <span className="text-white text-sm">🎯</span>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-green-600">
                        {filteredMembers.length}
                      </div>
                      <div className="text-sm text-gray-500">Filtered</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tabs with dynamic styling */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
              <TabsList>
                <TabsTrigger 
                  value="all"
                  style={activeTab === 'all' ? { backgroundColor: dynamicStyles.primaryColor, color: 'white' } : {}}
                >
                  All ({teamMembers.length})
                </TabsTrigger>
                {roles.map(r => (
                  <TabsTrigger 
                    key={r.id} 
                    value={r.name.toLowerCase()}
                    style={activeTab === r.name.toLowerCase() ? { backgroundColor: dynamicStyles.primaryColor, color: 'white' } : {}}
                  >
                    {r.name} ({teamMembers.filter(m => m.roles?.name.toLowerCase() === r.name.toLowerCase()).length})
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {filteredMembers.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                {teamMembers.length === 0 
                  ? `No team members found for ${gym.name}. Add your first team member to get started!`
                  : "No members found matching your search criteria."
                }
              </div>
            ) : displayMode === 'card' ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredMembers.map(renderMemberCard)}
              </div>
            ) : (
              <Card style={{ borderColor: `${dynamicStyles.primaryColor}20` }}>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Salary</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMembers.map(renderMemberRow)}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* confirm active toggle */}
            <Dialog open={confirmActiveDialog} onOpenChange={setConfirmActiveDialog}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Confirm Status Change</DialogTitle>
                </DialogHeader>
                <DialogDescription>
                  Are you sure you want to set{' '}
                  <strong>
                    {pendingActiveMember?.first_name} {pendingActiveMember?.last_name}
                  </strong>{' '}
                  to <strong>{pendingActiveMember?.is_active ? 'inactive' : 'active'}</strong> at {gym.name}?
                </DialogDescription>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setConfirmActiveDialog(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={confirmToggleActive}
                    style={{ backgroundColor: dynamicStyles.primaryColor }}
                    className="text-white"
                  >
                    Confirm
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Add/Edit modal */}
            <MemberFormModal
              isOpen={dialogOpen || editDialogOpen}
              onClose={() => {
                setDialogOpen(false);
                setEditDialogOpen(false);
                setEditMember(null);
              }}
              memberToEdit={editMember}
              roles={roles}
              onSave={async () => {
                await fetchTeamMembers();
                // QR dialog is handled by realtime insert listener
              }}
              gym={gym} // Pass gym context to modal
            />

            {/* New: QR code modal after creating a member */}
            <Dialog open={!!qrInfo} onOpenChange={(o) => !o && setQrInfo(null)}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle style={{ color: dynamicStyles.primaryColor }}>
                    Staff QR Code for {gym.name}
                  </DialogTitle>
                  <DialogDescription>
                    QR code generated for {qrInfo?.first_name} {qrInfo?.last_name}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div 
                    className="rounded-md border p-4 bg-white" 
                    ref={qrContainerRef}
                    style={{ borderColor: `${dynamicStyles.primaryColor}20` }}
                  >
                    <div className="flex flex-col items-center gap-3">
                      <QRCode
                        value={qrInfo?.qr_code || ''}
                        size={240}
                        bgColor="#FFFFFF"
                        fgColor={dynamicStyles.primaryColor}
                        level="M"
                      />
                      <div className="text-xs text-gray-600 break-all">
                        {qrInfo?.qr_code}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm">
                    <div><span className="text-gray-500">Name:</span> {qrInfo?.first_name} {qrInfo?.last_name}</div>
                    <div><span className="text-gray-500">Email:</span> {qrInfo?.email}</div>
                    <div><span className="text-gray-500">Staff ID:</span> {qrInfo?.id}</div>
                    <div><span className="text-gray-500">Gym:</span> {gym.name}</div>
                  </div>
                </div>
                <DialogFooter className="flex items-center justify-between gap-2">
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      onClick={downloadSVG}
                      style={{ borderColor: dynamicStyles.accentColor, color: dynamicStyles.accentColor }}
                    >
                      Download SVG
                    </Button>
                    <Button 
                      onClick={downloadPNG}
                      style={{ backgroundColor: dynamicStyles.accentColor }}
                      className="text-white"
                    >
                      Download PNG
                    </Button>
                  </div>
                  <Button 
                    variant="secondary" 
                    onClick={() => setQrInfo(null)}
                  >
                    Close
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </main>
      </div>
    </div>
  );
}
