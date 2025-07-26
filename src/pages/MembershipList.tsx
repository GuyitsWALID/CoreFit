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
  ExportButton,
} from "@/components";
import { OneToOneCoachingModal } from "@/components/OneToOneCoachingModal";
import FreezeModal, { FreezeMode } from "@/components/FreezeActionModal";
import { MembershipInfo } from "@/types/memberships";
import FreezeActionModal from "@/components/FreezeActionModal";
import { CoachingSessionData, Trainer } from "@/types/coaching"; // Ensure this matches your types
import { fetchTrainers } from "@/lib/supabase_trainer_query";


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
  
  // New coaching modal states
  const [coachingDialog, setCoachingDialog] = useState(false);
  const [coachingMember, setCoachingMember] = useState<MembershipInfo | null>(null);
  const [trainers, setTrainers] = useState<Trainer[]>([]);

  // Modal for freezing memberships
  const [freezeDialog, setFreezeDialog] = useState(false);
  const [freezeModalOpen, setFreezeModalOpen] = useState(false);
  const [freezeMode, setFreezeMode]         = useState<FreezeMode>('freeze');
  const [freezeMember, setFreezeMember]     = useState<MembershipInfo | null>(null);
  

  // Handlers to open modal in each mode
  const openFreeze = (member: MembershipInfo) => {
    setFreezeMode('freeze');
    setFreezeMember(member);
    setFreezeModalOpen(true);
  };
  const openExtend = (member: MembershipInfo) => {
    setFreezeMode('extend');
    setFreezeMember(member);
    setFreezeModalOpen(true);
  };

  // unified confirm for both
  const handleFreezeConfirm = async (days: number) => {
    if (!freezeMember) return;
    const key = `${freezeMode}-${freezeMember.user_id}`;
    setProcessingAction(key);

    try {
      let rpcResult;
      if (freezeMode === 'freeze') {
        rpcResult = await supabase.rpc('freeze_membership', {
          p_user_id: freezeMember.user_id,
          p_days: days,
        });
        if (rpcResult.error) throw rpcResult.error;
        toast({
          title: 'Membership frozen',
          description: `${freezeMember.full_name} frozen for ${days} days.`,
        });
      } else {
        rpcResult = await supabase.rpc('extend_freeze_membership', {
          p_user_id: freezeMember.user_id,
          p_extra_days: days,
        });
        if (rpcResult.error) throw rpcResult.error;
        toast({
          title: 'Freeze extended',
          description: `${freezeMember.full_name} extended by ${days} days.`,
        });
      }
      await fetchMembershipData();
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Unknown error', variant: 'destructive' });
    } finally {
      setProcessingAction(null);
    }
  };

  
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
      // Try to use the new user_combined_costs view first, fallback to users_with_membership_info
      const { data, error } = await supabase
        .from("user_combined_costs")
        .select("*")
        .order("days_left", { ascending: true });
      
      if (error) {
        // Fallback to the original view if the new one doesn't exist yet
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("users_with_membership_info")
          .select("*")
          .order("days_left", { ascending: true });
        
        if (fallbackError) {
          toast({
            title: "Error loading data",
            description: fallbackError.message,
            variant: "destructive"
          });
        } else {
          setMembers(fallbackData || []);
        }
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

   const loadTrainers = async () => {
    console.log('loadTrainers: Starting trainer fetch.');
    try {
      const trainersData = await fetchTrainers();
      console.log('loadTrainers: Trainers data received:', trainersData);
      setTrainers(trainersData);
    } catch (error) {
      console.error('loadTrainers: Error fetching trainers:', error);
      // Set empty array if fetch fails
      setTrainers([]);
      toast({
        title: "Error loading trainers",
        description: "Could not load trainer data. Please try refreshing the page.",
        variant: "destructive"
      });
    }
  };
  useEffect(() => {
    
  const loadAllData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        fetchMembershipData(),
        loadTrainers()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  loadAllData();
}, []);
  

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

  /* Check freeze eligibility
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
  }, [filteredMembers]);*/

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

  

// 2) Unfreeze immediately (apply all pending freeze days and set status = active)
const handleUnfreeze = async (member: MembershipInfo) => {
  setProcessingAction(`unfreeze-${member.user_id}`);
  try {
    const { error } = await supabase.rpc('unfreeze_membership', {
      p_user_id: member.user_id,
    });
    if (error) {
      throw error;
    }
    toast({
      title: 'Membership Unfrozen',
      description: `${member.full_name} is now active again.`,
    });
    await fetchMembershipData();
  } catch (error: any) {
    toast({
      title: 'Unfreeze Failed',
      description: error.message || 'Unknown error',
      variant: 'destructive',
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

  // New coaching handlers
  const handleCoaching = (member: MembershipInfo) => {
    setCoachingMember(member);
    setCoachingDialog(true);
    setOpenDropdown(null);
  };

  // Updated handleCoachingSubmit to match the new CoachingSessionData interface
  const handleCoachingSubmit = (coachingData: CoachingSessionData) => {
    console.log('handleCoachingSubmit: Submitting coaching data:', coachingData);
    setProcessingAction(`coaching-${coachingData.user_id}`);
    
    const insertCoaching = async () => {
      try {
        const { error } = await supabase
          .from('one_to_one_coaching')
          .insert([{
            user_id: coachingData.user_id,
            trainer_id: coachingData.trainer_id,
            hourly_rate: coachingData.hourly_rate,
            days_per_week: coachingData.days_per_week,
            hours_per_session: coachingData.hours_per_session,
            start_date: coachingData.start_date,
            end_date: coachingData.end_date,
            status: coachingData.status || 'active'
          }]);

        if (error) {
          console.error('handleCoachingSubmit: Supabase insert error:', error);
          toast({
            title: "Coaching setup failed",
            description: error.message,
            variant: "destructive"
          });
        } else {
          console.log('handleCoachingSubmit: Coaching setup successful.');
          toast({
            title: "Coaching setup successful",
            description: `One-to-one coaching has been set up for ${coachingMember?.full_name}.`
          });
          setCoachingDialog(false);
          setCoachingMember(null);
          fetchMembershipData(); // Refresh to show updated data
        }
      } catch (error: any) {
        console.error('handleCoachingSubmit: Unexpected error during insert:', error);
        toast({
          title: "Coaching setup failed",
          description: `Unexpected error: ${error?.message || 'Unknown error'}`,
          variant: "destructive"
        });
      } finally {
        console.log('handleCoachingSubmit: Setting processingAction to null.');
        setProcessingAction(null);
      }
    };

    insertCoaching();
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
            <p className="text-gray-500 mt-1">Manage member subscriptions, renewals, freezes, and coaching</p>
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
                statusColorMap={statusColors}
                openDropdown={openDropdown}
                setOpenDropdown={setOpenDropdown}
                canFreeze={canFreeze}
                processingAction={processingAction}
                onNotify={handleNotify}
                onFreeze={openFreeze}
                onExtendFreeze={openExtend}
                onUnfreeze={handleUnfreeze}
                onRenew={handleRenew}
                onUpgrade={handleUpgrade}
                onCoaching={handleCoaching} // This should now work with updated MemberCardProps
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
      <FreezeActionModal
        isOpen={freezeModalOpen}
        mode={freezeMode}
        userId={freezeMember?.user_id || ''}
        userName={freezeMember?.full_name || ''}
        defaultDays={freezeMode === 'extend' ? /* optionally compute remaining freeze days */ 1 : 1}
        onClose={() => setFreezeModalOpen(false)}
        onConfirm={handleFreezeConfirm}
        isProcessing={!!processingAction?.startsWith(freezeMode)}
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

      {/* New Coaching Modal */}
      <OneToOneCoachingModal
        isOpen={coachingDialog}
        onClose={() => {
          setCoachingDialog(false);
          setCoachingMember(null);
        }}
        member={coachingMember}
        trainers={trainers}
        onSubmit={handleCoachingSubmit}
        isProcessing={processingAction === `coaching-${coachingMember?.user_id}`}
      />
    </div>
  );
}

