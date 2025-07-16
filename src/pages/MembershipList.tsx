import React, { useState, useEffect } from "react";
import { Users, Clock, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/supabaseClient";

// Import all the extracted components
import {
  StatsCard,
  SearchFilters,
  MembershipTabs,
  MemberCard,
  NotificationModal,
  UpgradeModal,
  ExportButton
} from "@/components";

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
  
  // State management
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [packageFilter, setPackageFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("all");
  const [members, setMembers] = useState<MembershipInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | 'none'>('none');
  
  // Modal states
  const [notifyDialog, setNotifyDialog] = useState(false);
  const [notifyMember, setNotifyMember] = useState<MembershipInfo | null>(null);
  const [notifTitle, setNotifTitle] = useState("");
  const [notifMessage, setNotifMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  
  const [upgradeDialog, setUpgradeDialog] = useState(false);
  const [upgradeMember, setUpgradeMember] = useState<MembershipInfo | null>(null);
  const [selectedPackage, setSelectedPackage] = useState("");
  const [availablePackages, setAvailablePackages] = useState<Array<{id: string, name: string, price: number}>>([]);
  
  // Action states
  const [canFreeze, setCanFreeze] = useState<Record<string, boolean>>({});
  const [processingAction, setProcessingAction] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // Data fetching
  useEffect(() => {
    fetchMembershipData();
  }, []);

  const fetchMembershipData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("users_with_membership_info")
        .select("*")
        .order("days_left", { ascending: true });
      
      if (error) {
        toast({
          title: "Error loading data",
          description: error.message,
          variant: "destructive"
        });
      } else {
        setMembers(data || []);
      }
    } catch (error: any) {
      toast({
        title: "Error loading data",
        description: `Unexpected error: ${error?.message || 'Unknown error'}`,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Computed values
  const packageTypes = Array.from(new Set(members.map((m) => m.package_name))).sort();
  const expiringCount = members.filter((m) => m.days_left <= 10 && m.days_left >= 0).length;
  const expiredCount = members.filter((m) => m.days_left < 0).length;

  // Filtering and sorting logic
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
    return 0;
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

  // Check freeze eligibility
  useEffect(() => {
    const checkFreezeEligibility = async () => {
      const results: Record<string, boolean> = {};
      for (const member of filteredMembers) {
        if (member.status === 'active') {
          try {
            const { data } = await supabase.rpc('can_freeze_membership', { user_id: member.user_id });
            results[member.user_id] = !!data;
          } catch {
            results[member.user_id] = false;
          }
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
    try {
      const { data, error } = await supabase
        .from('packages')
        .select('id, name, price')
        .order('price', { ascending: true });
      
      if (!error) {
        setAvailablePackages(data || []);
      }
    } catch (error) {
      console.error('Error fetching packages:', error);
    }
  };

  // Action handlers
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
      setNotifyMember(null);
      setNotifTitle("");
      setNotifMessage("");
      toast({ title: "Notification sent", description: "Your notification has been sent successfully." });
    }, 1200);
  };

 const handleRenew = async (member: MembershipInfo) => {
  setProcessingAction(`renew-${member.user_id}`);
  setOpenDropdown(null);

  try {
    // Match the function's parameter name: p_user_id
    const { error } = await supabase.rpc('renew_membership', {
      p_user_id: member.user_id
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
  } catch (err: any) {
    toast({
      title: "Renewal failed",
      description: `Unexpected error: ${err.message || 'Unknown error'}`,
      variant: "destructive"
    });
  } finally {
    setProcessingAction(null);
  }
};


  const handleFreeze = async (member: MembershipInfo) => {
    setProcessingAction(`freeze-${member.user_id}`);
    setOpenDropdown(null);
    
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

  const handleUpgrade = (member: MembershipInfo) => {
    setUpgradeMember(member);
    setSelectedPackage("");
    setUpgradeDialog(true);
    setOpenDropdown(null);
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

  // Loading state
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
          <ExportButton filteredMembers={filteredMembers} />
        </div>
        
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <StatsCard
            title="All Members"
            value={members.length}
            description="Total active memberships"
            icon={<Users className="h-4 w-4" />}
          />
          <StatsCard
            title="Expiring Soon"
            value={expiringCount}
            description="Within 10 days"
            icon={<Clock className="h-4 w-4" />}
            iconColor="text-yellow-600"
          />
          <StatsCard
            title="Expired"
            value={expiredCount}
            description="Require attention"
            icon={<AlertTriangle className="h-4 w-4" />}
            iconColor="text-red-600"
          />
        </div>
        
        {/* Search and Filters */}
        <SearchFilters
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          packageFilter={packageFilter}
          setPackageFilter={setPackageFilter}
          packageTypes={packageTypes}
          sortOrder={sortOrder}
          onSort={handleSort}
        />
        
        {/* Tabs */}
        <MembershipTabs
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          totalMembers={members.length}
          expiringCount={expiringCount}
          expiredCount={expiredCount}
        />
        
        {/* Member List */}
        <div>
          {filteredMembers.length === 0 ? (
            <div className="text-center text-gray-400 py-16">No members found matching your filters</div>
          ) : (
            filteredMembers.map((member) => (
              <MemberCard
                key={member.user_id}
                member={member}
                statusColors={statusColors}
                openDropdown={openDropdown}
                setOpenDropdown={setOpenDropdown}
                canFreeze={canFreeze}
                processingAction={processingAction}
                onNotify={handleNotify}
                onFreeze={handleFreeze}
                onRenew={handleRenew}
                onUpgrade={handleUpgrade}
              />
            ))
          )}
        </div>
      </div>
      
      {/* Modals */}
      <NotificationModal
        isOpen={notifyDialog}
        onClose={() => {
          setNotifyDialog(false);
          setNotifyMember(null);
          setNotifTitle("");
          setNotifMessage("");
        }}
        member={notifyMember}
        title={notifTitle}
        setTitle={setNotifTitle}
        message={notifMessage}
        setMessage={setNotifMessage}
        onSend={handleSendNotification}
        isSending={isSending}
      />
      
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
