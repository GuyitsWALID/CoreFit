import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bell } from "lucide-react";
import ActionsDropdown  from "./ActionsDropdown";
import { supabase } from "@/supabaseClient";
import { MembershipInfo } from "@/types/memberships";

interface MemberCardProps {
  member: MembershipInfo;
  statusColorMap: Record<string, string>;
  openDropdown: string | null;
  setOpenDropdown: (value: string | null) => void;
  canFreeze: Record<string, boolean>;
  processingAction: string | null;
  onNotify: (member: MembershipInfo) => void;
  onFreeze: (member: MembershipInfo) => void;
  onRenew: (member: MembershipInfo) => void;
  onUpgrade: (member: MembershipInfo) => void;
  onCoaching: (member: MembershipInfo) => void; // ONLY CHANGE: Added this prop
}
const statusColorMap: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  paused: "bg-yellow-100 text-yellow-800",
  inactive: "bg-gray-100 text-gray-800",
  expired: "bg-red-100 text-red-800",
  // add more if needed
};


export  function MemberCard({
  member,
  statusColorMap,
  openDropdown,
  setOpenDropdown,
  canFreeze,
  processingAction,
  onNotify,
  onFreeze,
  onRenew,
  onUpgrade,
  onCoaching // ONLY CHANGE: Added this prop
}: MemberCardProps) {

  const openFreezeModal = () => {
    onFreeze(member);
  };


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
            <span className={`inline-block px-4 py-2 rounded-full text-sm font-semibold ${statusColorMap[member.status] || "bg-gray-100 text-gray-600"}`}>
              {member.status.charAt(0).toUpperCase() + member.status.slice(1)}
            </span>
          </div>
          
          <div className="flex gap-3 items-center">
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 px-4 py-2"
              onClick={() => onNotify(member)}
            >
              <Bell className="h-4 w-4" /> Notify
            </Button>
            <ActionsDropdown 
              member={member}
              openDropdown={openDropdown}
              setOpenDropdown={setOpenDropdown}
              canFreeze={canFreeze}
              processingAction={processingAction}
              onFreeze={onFreeze}  
              onRenew={onRenew}
              onUpgrade={onUpgrade}
              onCoaching={onCoaching} // ONLY CHANGE: Added this prop
            />
          </div>
        </div>
      </div>
    </div>
  );
}



