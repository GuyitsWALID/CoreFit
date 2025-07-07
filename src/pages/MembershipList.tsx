import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, Download, Users, Clock, AlertTriangle, Bell, MoreHorizontal, RefreshCw, Snowflake, ArrowUpRight, X } from "lucide-react";
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
  const [upgradeDialog, setUpgradeDialog] = useState(false);
  const [upgradeMember, setUpgradeMember] = useState<MembershipInfo | null>(null);
  const [selectedPackage, setSelectedPackage] = useState("");
  const [availablePackages, setAvailablePackages] = useState<Array<{id: string, name: string, price: number}>>([]);
  const [canFreeze, setCanFreeze] = useState<Record<string, boolean>>({});
  const [processingAction, setProcessingAction] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | 'none'>('none');

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
    if (activeTab === "expiring") matchesTab = member.days_left <= 10 && member.days_left >= 0;
    if (activeTab === "expired") matchesTab = member.days_left < 0;
    return matchesSearch && matchesStatus && matchesPackage && matchesTab;
  }).sort((a, b) => {
    if (sortOrder === 'asc') {
      return a.full_name.localeCompare(b.full_name);
    } else if (sortOrder === 'desc') {
      return b.full_name.localeCompare(a.full_name);
    }
    return 0; // no sorting for 'none'
  });

  const handleSort = () => {
    if (sortOrder === 'none') {
      setSortOrder('asc');
    } else if (sortOrder === 'asc') {
      setSortOrder('desc');
    } else {
      setSortOrder('none');
    }
  };

  const expiringCount = members.filter((m) => m.days_left <= 10 && m.days_left >= 0).length;
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

  // Check freeze eligibility
  useEffect(() => {
    const checkFreezeEligibility = async () => {
      const results: Record<string, boolean> = {};
      for (const member of filteredMembers) {
        if (member.status === 'active') {
          const { data } = await supabase.rpc('can_freeze_membership', { user_id: member.user_id });
          results[member.user_id] = !!data;
        } else {
          results[member.user_id] = false;
        }
      }
      setCanFreeze(results);
    };

    if (filteredMembers.length > 0) {
      checkFreezeEligibility();
    }
  }, [filteredMembers]);

  // Fetch available packages for upgrade
  const fetchPackages = async () => {
    const { data, error } = await supabase
      .from('packages')
      .select('id, name, price')
      .order('price', { ascending: true });
    
    if (!error) {
      setAvailablePackages(data || []);
    }
  };

  // Handle renewal
  const handleRenew = async (member: MembershipInfo) => {
    setProcessingAction(`renew-${member.user_id}`);
    try {
      const { error } = await supabase.rpc('renew_function', { 
        user_id: member.user_id,
        package_id: member.package_id
      });
      
      if (error) {
        toast({
          title: "Renewal failed",
          description: error.message,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Membership renewed",
          description: `${member.full_name}'s membership has been renewed successfully.`
        });
        fetchMembershipData();
      }
    } catch (error: any) {
      toast({
        title: "Renewal failed",
        description: `Unexpected error: ${error?.message || 'Unknown error'}`,
        variant: "destructive"
      });
    } finally {
      setProcessingAction(null);
    }
  };

  // Handle freeze
  const handleFreeze = async (member: MembershipInfo) => {
    setProcessingAction(`freeze-${member.user_id}`);
    try {
      const { error } = await supabase.rpc('freeze_membership', { 
        user_id: member.user_id 
      });
      
      if (error) {
        toast({
          title: "Freeze failed",
          description: error.message,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Membership frozen",
          description: `${member.full_name}'s membership has been frozen successfully.`
        });
        fetchMembershipData();
      }
    } catch (error: any) {
      toast({
        title: "Freeze failed",
        description: `Unexpected error: ${error?.message || 'Unknown error'}`,
        variant: "destructive"
      });
    } finally {
      setProcessingAction(null);
    }
  };

  // Handle upgrade
  const handleUpgrade = (member: MembershipInfo) => {
    setUpgradeMember(member);
    setSelectedPackage("");
    setUpgradeDialog(true);
    fetchPackages();
  };

  const handleUpgradeSubmit = async () => {
    if (!upgradeMember || !selectedPackage) {
      toast({
        title: "Select a package",
        description: "Please select a package to upgrade to.",
        variant: "destructive"
      });
      return;
    }

    setProcessingAction(`upgrade-${upgradeMember.user_id}`);
    try {
      const { error } = await supabase.rpc('upgrade_membership', {
        user_id: upgradeMember.user_id,
        new_package_id: selectedPackage
      });

      if (error) {
        toast({
          title: "Upgrade failed",
          description: error.message,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Package upgraded",
          description: `${upgradeMember.full_name}'s package has been upgraded successfully.`
        });
        setUpgradeDialog(false);
        setSelectedPackage("");
        setUpgradeMember(null);
        fetchMembershipData();
      }
    } catch (error: any) {
      toast({
        title: "Upgrade failed",
        description: `Unexpected error: ${error?.message || 'Unknown error'}`,
        variant: "destructive"
      });
    } finally {
      setProcessingAction(null);
    }
  };

  // --- Actions Dropdown ---
  function ActionsDropdown({ member }: { member: MembershipInfo }) {
    const isOpen = openDropdown === member.user_id;

    return (
      <div className="relative">
        <Button
          variant="outline"
          size="sm"
          className="px-3 py-1 h-8"
          onClick={() => setOpenDropdown(isOpen ? null : member.user_id)}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
        
        {isOpen && (
          <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-20 py-1">
            <button 
              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-gray-50 ${
                !canFreeze[member.user_id] 
                  ? 'opacity-50 cursor-not-allowed text-gray-400' 
                  : 'text-gray-700'
              }`}
              onClick={() => {
                setOpenDropdown(null);
                handleFreeze(member);
              }}
              disabled={processingAction === `freeze-${member.user_id}` || !canFreeze[member.user_id]}
            >
              <Snowflake className="h-4 w-4" /> 
              {processingAction === `freeze-${member.user_id}` ? "Freezing..." : "Freeze Membership"}
            </button>
            
            <button 
              className="w-full text-left px-3 py-2 text-sm text-gray-700 flex items-center gap-2 hover:bg-gray-50"
              onClick={() => {
                setOpenDropdown(null);
                handleRenew(member);
              }}
              disabled={processingAction === `renew-${member.user_id}`}
            >
              <RefreshCw className="h-4 w-4" /> 
              {processingAction === `renew-${member.user_id}` ? "Renewing..." : "Renew Membership"}
            </button>
            
            <button 
              className="w-full text-left px-3 py-2 text-sm text-gray-700 flex items-center gap-2 hover:bg-gray-50"
              onClick={() => {
                setOpenDropdown(null);
                handleUpgrade(member);
              }}
              disabled={processingAction === `upgrade-${member.user_id}`}
            >
              <ArrowUpRight className="h-4 w-4" /> Upgrade Package
            </button>
            
            <div className="border-t border-gray-100 my-1"></div>
            
            <button 
              className="w-full text-left px-3 py-2 text-sm text-red-600 flex items-center gap-2 hover:bg-red-50"
              onClick={() => setOpenDropdown(null)}
            >
              Deactivate
            </button>
          </div>
        )}
      </div>
    );
  }

  // --- Simple Modal Component ---
  function SimpleModal({ 
    isOpen, 
    onClose, 
    title, 
    children 
  }: { 
    isOpen: boolean; 
    onClose: () => void; 
    title: string; 
    children: React.ReactNode;
  }) {
    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="fixed inset-0 bg-black bg-opacity-50" />
        <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-6 border-b">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Bell className="h-5 w-5" />
              {title}
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="p-6">
            {children}
          </div>
        </div>
      </div>
    );
  }

  // --- Upgrade Modal Component ---
  function UpgradeModal({ 
    isOpen, 
    onClose, 
    member,
    availablePackages,
    selectedPackage,
    setSelectedPackage,
    onSubmit,
    isProcessing
  }: { 
    isOpen: boolean; 
    onClose: () => void; 
    member: MembershipInfo | null;
    availablePackages: Array<{id: string, name: string, price: number}>;
    selectedPackage: string;
    setSelectedPackage: (value: string) => void;
    onSubmit: () => void;
    isProcessing: boolean;
  }) {
    if (!isOpen || !member) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="fixed inset-0 bg-black bg-opacity-50" />
        <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-6 border-b">
            <h2 className="text-lg font-semibold">Upgrade Package</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="p-6 space-y-4">
            <p className="text-sm text-gray-600">
              Upgrade package for: {member.full_name}
            </p>
            
            <div>
              <label className="text-sm font-medium text-gray-700">Current Package</label>
              <Input
                value={member.package_name}
                disabled
                className="mt-1 bg-gray-50"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-700">New Package</label>
              <Select value={selectedPackage} onValueChange={setSelectedPackage}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select new package" />
                </SelectTrigger>
                <SelectContent>
                  {availablePackages
                    .filter(pkg => pkg.id !== member.package_id)
                    .map(pkg => (
                      <SelectItem key={pkg.id} value={pkg.id}>
                        {pkg.name} - ETB {pkg.price?.toLocaleString() || 0}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                className="bg-fitness-primary hover:bg-fitness-primary/90 text-white"
                onClick={onSubmit}
                disabled={!selectedPackage || isProcessing}
              >
                <ArrowUpRight className="mr-2 h-4 w-4" />
                {isProcessing ? "Upgrading..." : "Confirm Upgrade"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- Member Card (List) ---
  function MemberCard({ member }: { member: MembershipInfo }) {
    return (
      <div className="border rounded-lg px-8 py-6 mb-4 bg-white shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-blue-100 text-blue-600 text-xl font-bold">
                {member.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="font-semibold text-xl mb-1">{member.full_name}</div>
              <div className="text-gray-500 text-sm mb-1">{member.email}</div>
              <div className="text-gray-400 text-xs">{member.phone}</div>
            </div>
          </div>
          
          <div className="flex items-center gap-8">
            <div className="text-center">
              <div className="text-xs text-gray-400 mb-2 uppercase tracking-wide">Package</div>
              <Badge variant="outline" className="font-semibold text-sm px-3 py-1">
                {member.package_name}
              </Badge>
            </div>
            
            <div className="text-center">
              <div className="text-xs text-gray-400 mb-2 uppercase tracking-wide">Period</div>
              <div className="text-sm space-y-1">
                <div>Start: <span className="font-medium">{member.created_at && !isNaN(Date.parse(member.created_at)) ? new Date(member.created_at).toLocaleDateString() : "-"}</span></div>
                <div>Expires: <span className="font-medium">{member.membership_expiry && !isNaN(Date.parse(member.membership_expiry)) ? new Date(member.membership_expiry).toLocaleDateString() : "-"}</span></div>
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-xs text-gray-400 mb-2 uppercase tracking-wide">Days Left</div>
              <div className={`font-bold text-lg ${member.days_left > 5 ? "text-green-600" : "text-red-600"}`}>
                {member.days_left >= 0 ? `${member.days_left} days` : `${Math.abs(member.days_left)} overdue`}
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-xs text-gray-400 mb-2 uppercase tracking-wide">Status</div>
              <span className={`inline-block px-4 py-2 rounded-full text-sm font-semibold ${statusColors[member.status] || "bg-gray-100 text-gray-600"}`}>
                {member.status.charAt(0).toUpperCase() + member.status.slice(1)}
              </span>
            </div>
            
            <div className="flex gap-3 items-center">
              <Button
                className="bg-fitness-primary hover:bg-fitness-primary/90 text-white flex items-center gap-2 px-4 py-2"
                onClick={() => handleNotify(member)}
              >
                <Bell className="h-4 w-4" /> Notify
              </Button>
              <ActionsDropdown member={member} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Click outside handler for dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (openDropdown) {
        setOpenDropdown(null);
      }
    };
    
    if (openDropdown) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openDropdown]);

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
          <Button 
            className="bg-fitness-primary hover:bg-fitness-primary/90 text-white" 
            onClick={() => {
              // Simple export logic
              console.log("Exporting", filteredMembers.length, "members");
              toast({ title: "Export started", description: `Exporting ${filteredMembers.length} members` });
            }}
          >
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
            <div className="text-xs text-gray-400">Within 10 days</div>
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
          <Button 
            variant="outline" 
            onClick={handleSort}
            className="flex items-center gap-2"
          >
            {sortOrder === 'none' && 'Sort A-Z'}
            {sortOrder === 'asc' && 'Sort Z-A'}
            {sortOrder === 'desc' && 'Clear Sort'}
            {sortOrder === 'asc' && <span className="text-xs">↑</span>}
            {sortOrder === 'desc' && <span className="text-xs">↓</span>}
          </Button>
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
      
      {/* Notification Modal */}
      <SimpleModal
        isOpen={notifyDialog}
        onClose={() => setNotifyDialog(false)}
        title="Send Notification"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Send a notification to {notifyMember?.full_name}
          </p>
          
          <div>
            <label className="text-sm font-medium text-gray-700">Recipient</label>
            <Select disabled defaultValue="selected">
              <SelectTrigger className="mt-1">
                <SelectValue placeholder={notifyMember?.full_name || "Select recipient"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="selected">{notifyMember?.full_name}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <label className="text-sm font-medium text-gray-700">Use Template (Optional)</label>
            <Select>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Choose a template or write custom message" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="membership_expiry">Membership Expiry Reminder</SelectItem>
                <SelectItem value="payment_due">Payment Due Notice</SelectItem>
                <SelectItem value="custom">Custom Message</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Notification Title</label>
            <Input
              className="mt-1"
              placeholder="Enter notification title"
              value={notifTitle}
              onChange={(e) => setNotifTitle(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Message</label>
            <textarea
              className="w-full border rounded px-3 py-2 text-sm mt-1"
              rows={4}
              placeholder="Enter notification message"
              value={notifMessage}
              onChange={(e) => setNotifMessage(e.target.value)}
            />
          </div>
          
          <div className="flex justify-end gap-3 pt-4">
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
          </div>
        </div>
      </SimpleModal>
      
      {/* Upgrade Package Modal */}
      <UpgradeModal
        isOpen={upgradeDialog}
        onClose={() => {
          setUpgradeDialog(false);
          setSelectedPackage("");
          setUpgradeMember(null);
        }}
        member={upgradeMember}
        availablePackages={availablePackages}
        selectedPackage={selectedPackage}
        setSelectedPackage={setSelectedPackage}
        onSubmit={handleUpgradeSubmit}
        isProcessing={processingAction === `upgrade-${upgradeMember?.user_id}`}
      />
    </div>
  );
}
