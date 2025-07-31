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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Eye, EyeOff, Plus, Edit, Grid3X3, List } from 'lucide-react';
import { supabase } from "@/supabaseClient";

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

  // --- state fixes ---
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | string>('all');
  const [displayMode, setDisplayMode] = useState<'card' | 'list'>('list');
  const [searchTerm, setSearchTerm] = useState("");
  const [editMember, setEditMember] = useState<TeamMember | null>(null);

  // NEW: control “Add” vs “Edit” modal
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const [confirmActiveDialog, setConfirmActiveDialog] = useState(false);
  const [pendingActiveMember, setPendingActiveMember] = useState<TeamMember | null>(null);

  // --- data fetching ---
  const fetchTeamMembers = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('staff')
      .select(`
        *,
        roles(id, name)
      `);
    if (error) {
      toast({ title: 'Load failed', description: error.message, variant: 'destructive' });
    } else {
      setTeamMembers(data || []);
    }
    setIsLoading(false);
  };

  const fetchRoles = async () => {
    const { data, error } = await supabase.from('roles').select('*');
    if (!error && data) setRoles(data);
  };

  useEffect(() => {
    fetchTeamMembers();
    fetchRoles();
  }, []);

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
      .eq('id', pendingActiveMember.id);

    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Status updated", description: `Now ${newActive ? 'active' : 'inactive'}.` });
      await fetchTeamMembers();
    }
    setConfirmActiveDialog(false);
    setPendingActiveMember(null);
  };

  const handleEdit = (member: TeamMember) => {
    setEditMember(member);
    setEditDialogOpen(true);
  };

  // --- filtering & rendering ---
  const filteredMembers = teamMembers.filter(member => {
    const matchesSearch = searchTerm === '' ||
      `${member.first_name} ${member.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email.toLowerCase().includes(searchTerm.toLowerCase());
    if (activeTab === 'all') return matchesSearch;
    return matchesSearch && member.roles?.name.toLowerCase() === activeTab;
  });

  const renderMemberCard = (member: TeamMember) => (
    <Card key={member.id} className="hover:shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback>
              {member.first_name[0]}{member.last_name[0]}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="font-semibold">{member.first_name} {member.last_name}</div>
            <Badge className="mr-2">{member.roles?.name}</Badge>
            <Switch
              checked={member.is_active}
              onCheckedChange={() => handleToggleActive(member)}
            />
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
        <Button variant="outline" size="sm" onClick={() => handleEdit(member)}>
          <Edit className="mr-1 h-4 w-4" /> Edit
        </Button>
      </CardFooter>
    </Card>
  );

  const renderMemberRow = (member: TeamMember) => (
    <TableRow key={member.id}>
      <TableCell>
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback>
              {member.first_name[0]}{member.last_name[0]}
            </AvatarFallback>
          </Avatar>
          {member.first_name} {member.last_name}
        </div>
      </TableCell>
      <TableCell>{member.roles?.name}</TableCell>
      <TableCell>{member.email}</TableCell>
      <TableCell>{member.phone}</TableCell>
      <TableCell>ETB {member.salary}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Switch
            checked={member.is_active}
            onCheckedChange={() => handleToggleActive(member)}
          />
          <span>{member.is_active ? "Active" : "Inactive"}</span>
        </div>
      </TableCell>
      <TableCell>
        <Button variant="outline" size="sm" onClick={() => handleEdit(member)}>
          <Edit className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );

  // --- loading state ---
  if (isLoading) {
    return <div className="py-8 text-center">Loading team members…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Team Management</h2>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          <Button onClick={() => setDialogOpen(true)}>
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          {roles.map(r => (
            <TabsTrigger key={r.id} value={r.name.toLowerCase()}>
              {r.name}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {filteredMembers.length === 0 ? (
        <div className="text-center text-gray-500">No members found.</div>
      ) : displayMode === 'card' ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredMembers.map(renderMemberCard)}
        </div>
      ) : (
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
            to <strong>{pendingActiveMember?.is_active ? 'inactive' : 'active'}</strong>?
          </DialogDescription>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmActiveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={confirmToggleActive}>Confirm</Button>
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
        onSave={fetchTeamMembers}
      />
    </div>
  );
}
