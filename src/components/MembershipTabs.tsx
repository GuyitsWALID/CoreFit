import React from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Clock, AlertTriangle, CheckCircle } from "lucide-react";

interface MembershipTabsProps {
  activeTab: string;
  setActiveTab: (value: string) => void;
  totalMembers: number;
  activeCount: number;
  expiringCount: number;
  expiredCount: number;
}

export function MembershipTabs({
  activeTab,
  setActiveTab,
  totalMembers,
  activeCount,
  expiringCount,
  expiredCount
}: MembershipTabsProps) {
  return (
    <div className="bg-white rounded-lg border mb-4">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full flex">
          <TabsTrigger value="all" className="flex-1 flex items-center justify-center gap-2">
            <Users className="h-4 w-4" /> All Members ({totalMembers})
          </TabsTrigger>
          <TabsTrigger value="active" className="flex-1 flex items-center justify-center gap-2">
            <CheckCircle className="h-4 w-4" /> Active ({activeCount})
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
  );
}
