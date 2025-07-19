import React, { useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Snowflake, RefreshCw, ArrowUpRight, Users } from "lucide-react";
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

interface ActionsDropdownProps {
  member: MembershipInfo;
  openDropdown: string | null;
  setOpenDropdown: (value: string | null) => void;
  canFreeze: Record<string, boolean>;
  processingAction: string | null;
  onFreeze: (member: MembershipInfo) => void;
  onRenew: (member: MembershipInfo) => void;
  onUpgrade: (member: MembershipInfo) => void;
  onCoaching: (member: MembershipInfo) => void; // Added coaching handler
}

export function ActionsDropdown({
  member,
  openDropdown,
  setOpenDropdown,
  canFreeze,
  processingAction,
  onFreeze,
  onRenew,
  onUpgrade,
  onCoaching // Added coaching prop
}: ActionsDropdownProps) {
  const { toast } = useToast();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isOpen = openDropdown === member.user_id;

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpenDropdown(isOpen ? null : member.user_id);
  };

  const handleAction = (action: () => void) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    action();
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, setOpenDropdown]);

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="outline"
        size="sm"
        className="px-3 py-1 h-8"
        onClick={handleToggle}
        type="button"
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>
      
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-20 py-1">
          <button 
        type="button"
        className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-gray-50 ${
          // Only allow freeze if package duration >= 3 months (not days left)
          new Date(member.membership_expiry).getTime() - new Date(member.created_at).getTime() >= 90 * 24 * 60 * 60 * 1000
            ? 'text-gray-700'
            : 'opacity-50 cursor-not-allowed text-gray-400'
        }`}
        onClick={handleAction(() => onFreeze(member))}
        disabled={
          processingAction === `freeze-${member.user_id}` ||
          (new Date(member.membership_expiry).getTime() - new Date(member.created_at).getTime() < 90 * 24 * 60 * 60 * 1000)
        }
          >
        <Snowflake className="h-4 w-4" /> 
        {processingAction === `freeze-${member.user_id}`
          ? member.status === "paused"
            ? "Unfreezing..."
            : "Freezing..."
          : member.status === "paused"
            ? "Unfreeze Membership"
            : "Freeze Membership"}
          </button>
          
          <button 
            type="button"
            className="w-full text-left px-3 py-2 text-sm text-gray-700 flex items-center gap-2 hover:bg-gray-50"
            onClick={handleAction(() => onRenew(member))}
            disabled={processingAction === `renew-${member.user_id}`}
          >
            <RefreshCw className="h-4 w-4" /> 
            {processingAction === `renew-${member.user_id}` ? "Renewing..." : "Renew Membership"}
          </button>
          
          <button 
            type="button"
            className="w-full text-left px-3 py-2 text-sm text-gray-700 flex items-center gap-2 hover:bg-gray-50"
            onClick={handleAction(() => onUpgrade(member))}
            disabled={processingAction === `upgrade-${member.user_id}`}
          >
            <ArrowUpRight className="h-4 w-4" /> Upgrade Package
          </button>

          {/* NEW: One-to-One Coaching Option */}
          <button 
            type="button"
            className="w-full text-left px-3 py-2 text-sm text-blue-600 flex items-center gap-2 hover:bg-blue-50"
            onClick={handleAction(() => onCoaching(member))}
            disabled={processingAction === `coaching-${member.user_id}`}
          >
            <Users className="h-4 w-4" /> 
            {processingAction === `coaching-${member.user_id}` ? "Setting up..." : "Setup 1-on-1 Coaching"}
          </button>
          
          <div className="border-t border-gray-100 my-1"></div>
          
        
        <button
          type="button"
          className="w-full text-left px-3 py-2 text-sm text-red-600 flex items-center gap-2 hover:bg-red-50"
          onClick={handleAction(async () => {
            const confirmed = window.confirm(
              `Are you sure you want to deactivate ${member.full_name}'s membership?`
            );

            if (!confirmed) {
              toast({
                title: "Action Cancelled",
                description: `Deactivation of ${member.full_name}'s membership was cancelled.`,
                variant: "default",
              });
              return;
            }

            // 👇 Call Supabase RPC
            const { error } = await supabase.rpc("set_user_status", {
              p_user_id: member.user_id,
              p_new_status: "inactive",
            });

            if (error) {
              toast({
                title: "Error",
                description: `Failed to deactivate ${member.full_name}.`,
                variant: "destructive",
              });
              console.error("Deactivate error:", error);
              return;
            }

            toast({
              title: "Membership Deactivated",
              description: `${member.full_name}'s membership has been deactivated.`,
              variant: "default",
            });
          })}
        >
          Deactivate
        </button>

        </div>
      )}
    </div>
  );
}

