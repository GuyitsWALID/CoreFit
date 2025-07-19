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
import FreezeModal from "@/components/FreezeModal";

// Type definitions for the one-to-one coaching feature
// Updated to match the OneToOneCoachingModal interface exactly
interface CoachingSessionData {
  user_id: string;
  trainer_staff_id: string; // Changed from trainer_id to match SQL schema
  hourly_rate: number; // Added hourly_rate field
  days_per_week: number;
  hours_per_session: number;
  start_date: string; // ISO date string
  status?: 'active' | 'paused' | 'completed' | 'cancelled';
}

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

interface Trainer {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  hourly_rate: number;
  specialization: string;
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
  
  // New coaching modal states
  const [coachingDialog, setCoachingDialog] = useState(false);
  const [coachingMember, setCoachingMember] = useState<MembershipInfo | null>(null);
  const [trainers, setTrainers] = useState<Trainer[]>([]);

  // Modal for freezing memberships
  const [freezeDialog, setFreezeDialog] = useState(false);
const [freezeMember, setFreezeMember] = useState<MembershipInfo | null>(null);

const openFreezeModal = (member: MembershipInfo) => {
  setFreezeMember(member);
  setFreezeDialog(true);
};

const onFreezeSuccess = () => {
  fetchMembershipData();
};
  
  // Action states
  const [canFreeze, setCanFreeze] = useState<Record<string, boolean>>({});
  const [processingAction, setProcessingAction] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // Data fetching
  useEffect(() => {
    fetchMembershipData();
    fetchTrainers();
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

  // Fetch trainers for coaching modal - adapted to use staff table
  const fetchTrainers = async () => {
    try {
      // Query staff table for trainers
      const { data, error } = await supabase
        .from('staff')
        .select(`
          id,
          full_name,
          email,
          phone,
          salary,
          roles!inner(name)
        `)
        .eq('roles.name', 'Trainer')
        .eq('is_active', true)
        .order('full_name', { ascending: true });
      
      if (!error && data) {
        // Transform staff data to trainer format
        const transformedTrainers: Trainer[] = data.map(staff => ({
          id: staff.id,
          full_name: staff.full_name,
          email: staff.email,
          phone: staff.phone,
          hourly_rate: staff.salary || 50, // Use salary as hourly rate, default to 50 if null
          specialization: 'Personal Training' // Default specialization, can be enhanced later
        }));
        setTrainers(transformedTrainers);
      } else {
        console.error('Error fetching trainers:', error);
        // For demo purposes, use mock data if query fails
        setTrainers([
          {
            id: '1',
            full_name: 'John Smith',
            email: 'john@gym.com',
            hourly_rate: 50,
            specialization: 'Strength Training'
          },
          {
            id: '2',
            full_name: 'Sarah Johnson',
            email: 'sarah@gym.com',
            hourly_rate: 45,
            specialization: 'Yoga & Flexibility'
          },
          {
            id: '3',
            full_name: 'Mike Wilson',
            email: 'mike@gym.com',
            hourly_rate: 60,
            specialization: 'Cardio & Weight Loss'
          },
          {
            id: '4',
            full_name: 'Lisa Brown',
            email: 'lisa@gym.com',
            hourly_rate: 55,
            specialization: 'Functional Training'
          }
        ]);
      }
    } catch (error) {
      console.error('Error fetching trainers:', error);
     
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

  // New coaching handlers
  const handleCoaching = (member: MembershipInfo) => {
    setCoachingMember(member);
    setCoachingDialog(true);
    setOpenDropdown(null);
  };

  // Updated handleCoachingSubmit to match the new CoachingSessionData interface
  const handleCoachingSubmit = (coachingData: CoachingSessionData) => {
    setProcessingAction(`coaching-${coachingData.user_id}`);
    
    const insertCoaching = async () => {
      try {
        const { error } = await supabase
          .from('one_to_one_coaching')
          .insert([{
            user_id: coachingData.user_id,
            trainer_staff_id: coachingData.trainer_staff_id, // Updated to match SQL schema
            hourly_rate: coachingData.hourly_rate, // Include hourly_rate
            days_per_week: coachingData.days_per_week,
            hours_per_session: coachingData.hours_per_session,
            start_date: coachingData.start_date,
            status: 'active'
          }]);

        if (error) {
          toast({
            title: "Coaching setup failed",
            description: error.message,
            variant: "destructive"
          });
        } else {
          toast({
            title: "Coaching setup successful",
            description: `One-to-one coaching has been set up for ${coachingMember?.full_name}.`
          });
          setCoachingDialog(false);
          setCoachingMember(null);
          fetchMembershipData(); // Refresh to show updated data
        }
      } catch (error: any) {
        toast({
          title: "Coaching setup failed",
          description: `Unexpected error: ${error?.message || 'Unknown error'}`,
          variant: "destructive"
        });
      } finally {
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
                onFreeze={openFreezeModal}
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
      <FreezeModal
        isOpen={freezeDialog}
        onClose={() => {
          setFreezeDialog(false);
          setFreezeMember(null);
        }}
        userId={freezeMember?.user_id ?? ''}
        userName={freezeMember?.full_name ?? ''}
        onSuccess={onFreezeSuccess}
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

