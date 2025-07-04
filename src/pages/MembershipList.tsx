import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, Download, Users, Clock, AlertTriangle, ChevronDown, Bell, MoreHorizontal, RefreshCw, Snowflake, ArrowUpRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/supabaseClient";

interface MembershipInfo {
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  package_id: string;
  package_name: string;
  created_at: string;
  membership_expiry: string;
  status: string;
  days_left: number;
}

const statusColors: Record<string, string> = {
  active: "text-green-600 bg-green-50",
  expired: "text-red-600 bg-red-50",
  paused: "text-yellow-600 bg-yellow-50",
};

export default function MembershipList() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [packageFilter, setPackageFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("all");
  const [members, setMembers] = useState<MembershipInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notifyDialog, setNotifyDialog] = useState(false);
  const [notifyMember, setNotifyMember] = useState<MembershipInfo | null>(null);

  useEffect(() => {
    fetchMembershipData();
  }, []);

  const fetchMembershipData = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("users_with_membership_info")
      .select("*")
      .order("days_left", { ascending: true });
    if (!error) setMembers(data || []);
    setIsLoading(false);
  };

  const packageTypes = Array.from(new Set(members.map((m) => m.package_name))).sort();

  const filteredMembers = members.filter((member) => {
    const matchesSearch =
      searchTerm === "" ||
      member.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.phone.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || member.status.toLowerCase() === statusFilter;
    const matchesPackage = packageFilter === "all" || member.package_name === packageFilter;
    let matchesTab = true;
    if (activeTab === "expiring") matchesTab = member.days_left <= 30 && member.days_left >= 0;
    if (activeTab === "expired") matchesTab = member.days_left < 0;
    return matchesSearch && matchesStatus && matchesPackage && matchesTab;
  });

  const expiringCount = members.filter((m) => m.days_left <= 30 && m.days_left >= 0).length;
  const expiredCount = members.filter((m) => m.days_left < 0).length;

  // --- Notification Dialog State ---
  const [notifTitle, setNotifTitle] = useState("");
  const [notifMessage, setNotifMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleNotify = (member: MembershipInfo) => {
    setNotifyMember(member);
    setNotifyDialog(true);
    setNotifTitle("");
    setNotifMessage("");
  };

  const handleSendNotification = async () => {
    if (!notifTitle.trim() || !notifMessage.trim()) {
      toast({ title: "Fill all fields", description: "Title and message are required.", variant: "destructive" });
      return;
    }
    setIsSending(true);
    // Simulate notification send
    setTimeout(() => {
      setIsSending(false);
      setNotifyDialog(false);
      toast({ title: "Notification sent", description: "Your notification has been sent." });
    }, 1200);
  };

  // --- Actions Dropdown ---
  function ActionsDropdown({ member }: { member: MembershipInfo }) {
    const [open, setOpen] = useState(false);
    return (
      <div className="relative">
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-1"
          onClick={() => setOpen((v) => !v)}
        >
          Actions <ChevronDown className="h-4 w-4" />
        </Button>
        {open && (
          <div className="absolute z-20 right-0 mt-2 w-48 bg-white border rounded shadow-lg py-2">
            <button className="flex items-center w-full px-4 py-2 text-sm hover:bg-gray-50" onClick={() => setOpen(false)}>
              <Snowflake className="h-4 w-4 mr-2" /> Freeze Membership
            </button>
            <button className="flex items-center w-full px-4 py-2 text-sm hover:bg-gray-50" onClick={() => setOpen(false)}>
              <RefreshCw className="h-4 w-4 mr-2" /> Renew Membership
            </button>
            <button className="flex items-center w-full px-4 py-2 text-sm hover:bg-gray-50" onClick={() => setOpen(false)}>
              <ArrowUpRight className="h-4 w-4 mr-2" /> Upgrade Package
            </button>
            <button className="flex items-center w-full px-4 py-2 text-sm hover:bg-gray-50" onClick={() => setOpen(false)}>
              View Details
            </button>
            <button className="flex items-center w-full px-4 py-2 text-sm hover:bg-gray-50" onClick={() => setOpen(false)}>
              Edit Member
            </button>
            <button className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50" onClick={() => setOpen(false)}>
              Deactivate
            </button>
          </div>
        )}
      </div>
    );
  }

  // --- Member Card (List) ---
  function MemberCard({ member }: { member: MembershipInfo }) {
    return (
      <div className="flex flex-col md:flex-row md:items-center justify-between border rounded-lg px-6 py-4 mb-4 bg-white shadow-sm hover:shadow-md transition relative">
        <div className="flex items-center gap-4 flex-1">
          <Avatar className="h-14 w-14">
            <AvatarFallback className="bg-blue-100 text-blue-400 text-lg font-bold">
              {member.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="font-semibold text-lg">{member.full_name}</div>
            <div className="text-gray-500 text-sm">{member.email}</div>
            <div className="text-gray-400 text-xs">{member.phone}</div>
          </div>
        </div>
        <div className="flex flex-col md:flex-row md:items-center gap-4 mt-4 md:mt-0 flex-[2]">
          <div className="flex flex-col items-start md:items-center md:flex-row gap-2 md:gap-6">
            <div>
              <div className="text-xs text-gray-400">Package</div>
              <Badge variant="outline" className="font-semibold">{member.package_name}</Badge>
            </div>
            <div>
              <div className="text-xs text-gray-400">Period</div>
              <div className="text-sm">
                Start: {member.created_at && !isNaN(Date.parse(member.created_at)) ? new Date(member.created_at).toLocaleDateString() : "-"}
              </div>
              <div className="text-sm">
                Expires: {member.membership_expiry && !isNaN(Date.parse(member.membership_expiry)) ? new Date(member.membership_expiry).toLocaleDateString() : "-"}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-400">Days Left</div>
              <div className={`font-semibold text-base ${member.days_left > 5 ? "text-green-600" : "text-red-600"}`}>
                {member.days_left >= 0 ? `${member.days_left} days` : `${Math.abs(member.days_left)} overdue`}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-400">Status</div>
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${statusColors[member.status] || "bg-gray-100 text-gray-600"}`}>
                {member.status.charAt(0).toUpperCase() + member.status.slice(1)}
              </span>
            </div>
          </div>
          <div className="flex gap-2 items-center mt-2 md:mt-0">
            <ActionsDropdown member={member} />
            <Button
              className="bg-fitness-primary text-white flex items-center gap-2"
              onClick={() => handleNotify(member)}
            >
              <Bell className="h-4 w-4" /> Notify
            </Button>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="animate-fade-in py-24 text-center text-gray-500">Loading membership data...</div>
    );
  }

  return (
    <div className="animate-fade-in bg-white min-h-screen px-0 md:px-8 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Membership Management</h2>
            <p className="text-gray-500 mt-1">Manage member subscriptions, renewals, and freezes</p>
          </div>
          <Button className="bg-fitness-primary hover:bg-fitness-primary/90 text-white" onClick={() => {}}>
            <Download className="h-4 w-4 mr-2" />
            Export ({filteredMembers.length})
          </Button>
        </div>
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl border p-6 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              All Members <Users className="h-4 w-4" />
            </div>
            <div className="text-3xl font-bold">{members.length}</div>
            <div className="text-xs text-gray-400">Total active memberships</div>
          </div>
          <div className="bg-white rounded-xl border p-6 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-yellow-600 text-sm">
              Expiring Soon <Clock className="h-4 w-4" />
            </div>
            <div className="text-3xl font-bold">{expiringCount}</div>
            <div className="text-xs text-gray-400">Within 30 days</div>
          </div>
          <div className="bg-white rounded-xl border p-6 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-red-600 text-sm">
              Expired <AlertTriangle className="h-4 w-4" />
            </div>
            <div className="text-3xl font-bold">{expiredCount}</div>
            <div className="text-xs text-gray-400">Require attention</div>
          </div>
        </div>
        {/* Filters */}
        <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
          <Input
            type="search"
            placeholder="Search by name, email, or phone..."
            className="w-full md:w-96"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
            </SelectContent>
          </Select>
          <Select value={packageFilter} onValueChange={setPackageFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Packages" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Packages</SelectItem>
              {packageTypes.map((pkg) => (
                <SelectItem key={pkg} value={pkg}>{pkg}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {/* Tabs */}
        <div className="bg-white rounded-lg border mb-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full flex">
              <TabsTrigger value="all" className="flex-1 flex items-center justify-center gap-2">
                <Users className="h-4 w-4" /> All Members ({members.length})
              </TabsTrigger>
              <TabsTrigger value="expiring" className="flex-1 flex items-center justify-center gap-2">
                <Clock className="h-4 w-4" /> Expiring Soon ({expiringCount})
              </TabsTrigger>
              <TabsTrigger value="expired" className="flex-1 flex items-center justify-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Expired ({expiredCount})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        {/* Member List */}
        <div>
          {filteredMembers.length === 0 ? (
            <div className="text-center text-gray-400 py-16">No members found matching your filters</div>
          ) : (
            filteredMembers.map((member) => (
              <MemberCard key={member.user_id} member={member} />
            ))
          )}
        </div>
      </div>
      {/* Notification Dialog */}
      <Dialog open={notifyDialog} onOpenChange={setNotifyDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Send Notification</DialogTitle>
            <DialogDescription>
              {notifyMember ? `To: ${notifyMember.full_name}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Enter notification title"
              value={notifTitle}
              onChange={(e) => setNotifTitle(e.target.value)}
            />
            <textarea
              className="w-full border rounded px-3 py-2 text-sm"
              rows={4}
              placeholder="Enter notification message"
              value={notifMessage}
              onChange={(e) => setNotifMessage(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotifyDialog(false)}>
              Cancel
            </Button>
            <Button
              className="bg-fitness-primary hover:bg-fitness-primary/90 text-white"
              onClick={handleSendNotification}
              disabled={isSending}
            >
              <Bell className="mr-2 h-4 w-4" />
              {isSending ? "Sending..." : "Send Notification"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
