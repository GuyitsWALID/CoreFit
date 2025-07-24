import React, { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  MoreHorizontal,
  Snowflake,
  RefreshCw,
  ArrowUpRight,
  Users,
  SquarePlus,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/supabaseClient";
import DeactivateModal from "./DeactivateModal";
import type { MembershipInfo } from "@/types/memberships";
import { on } from "process";

interface ActionsDropdownProps {
  member: MembershipInfo;
  openDropdown: string | null;
  setOpenDropdown: (value: string | null) => void;
  canFreeze: Record<string, boolean>;
  processingAction: string | null;
  onFreeze: (member: MembershipInfo) => void;
  onExtend: (member: MembershipInfo) => void;
  onUnfreeze: (member: MembershipInfo) => void;
  onRenew: (member: MembershipInfo) => void;
  onUpgrade: (member: MembershipInfo) => void;
  onCoaching: (member: MembershipInfo) => void;
}

export default function ActionsDropdown({
  member,
  openDropdown,
  setOpenDropdown,
  canFreeze,
  processingAction,
  onFreeze,
  onExtend,
  onUnfreeze,
  onRenew,
  onUpgrade,
  onCoaching,
}: ActionsDropdownProps) {
  const { toast } = useToast();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isOpen = openDropdown === member.user_id;
  const [deactOpen, setDeactOpen] = useState(false);

  // Toggle dropdown
  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpenDropdown(isOpen ? null : member.user_id);
  };

  // Prevent propagation
  const handleAction = (action: () => void) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    action();
  };

  /**
   * Handles any status change. Reason is required only for deactivation.
   */
  const handleStatusChange = async (newStatus: "active" | "inactive", reason?: string) => {
    if (newStatus === "inactive" && !reason?.trim()) {
      toast({
        title: "Reason required",
        description: "Please enter a reason for deactivation.",
        variant: "destructive",
      });
      return;
    }
    // Close modal if open
    setDeactOpen(false);
    // Call RPC
    const { error } = await supabase.rpc("set_user_status", {
      p_user_id: member.user_id,
      p_new_status: newStatus,
    });
    if (error) {
      toast({
        title: "Error",
        description: `Failed to ${newStatus === "inactive" ? "deactivate" : "activate"} ${member.full_name}.`,
        variant: "destructive",
      });
    } else {
      toast({
        title: newStatus === "inactive" ? "Membership Deactivated" : "Membership Activated",
        description:
          newStatus === "inactive"
            ? `${member.full_name} has been deactivated. Reason: ${reason}`
            : `${member.full_name} is now active.`,
        variant: newStatus === "inactive" ? "destructive" : "default",
      });
      if (onRefresh) onRefresh();
    }
  };

  // Close on outside click
  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", onClickOutside);
      return () => document.removeEventListener("mousedown", onClickOutside);
    }
  }, [isOpen, setOpenDropdown]);

  //coverts months weeks into days 
  const getTotalDays = (unit: string, value: number): number => {
    switch (unit) {
      case 'days':
        return value;
      case 'weeks':
        return value * 7;
      case 'months':
        return value * 30; // approx
      case 'years':
        return value * 365;
      default:
        return 0;
    }
  };

  // Check if member can be frozen
  const isFreezeEligible = getTotalDays(member.duration_unit, member.duration_value) >= 90;

  // Reasonable implementation: reload the page or refetch data
  function onRefresh() {
    window.location.reload();
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <Button variant="outline" size="sm" className="px-3 py-1 h-8" onClick={handleToggle}>
        <MoreHorizontal className="h-4 w-4" />
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-20 py-1">
          {/* Freeze/Unfreeze/ExtendFreeze */}
          {member.status === "active" && (
            <button
              type="button"
              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-gray-50 ${
                isFreezeEligible ? "text-gray-700" : "opacity-50 cursor-not-allowed text-gray-400"
              }`}
              onClick={handleAction(() => onFreeze(member))}
              disabled={processingAction === `freeze-${member.user_id}` || !isFreezeEligible}
            >
              <Snowflake className="h-4 w-4" />
              {processingAction === `freeze-${member.user_id}` ? "Freezing..." : "Freeze Membership"}
            </button>
          )}

          {member.status === "paused" && (
            <>
              {/* Unfreeze button with confirmation */}
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-gray-50 text-gray-700"
                onClick={handleAction(() => {
                  if (window.confirm("Are you sure you want to unfreeze this membership manually?")) {
                    onUnfreeze(member);
                  }
                })}
                disabled={processingAction === `freeze-${member.user_id}`}
              >
                <Snowflake className="h-4 w-4" />
                {processingAction === `freeze-${member.user_id}` ? "Unfreezing..." : "Unfreeze Membership"}
              </button>
              {/* Extend freeze button (opens modal) */}
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-gray-50 text-gray-700"
                onClick={handleAction(() => onExtend(member))}
                disabled={processingAction === `extendfreeze-${member.user_id}`}
              >
                <SquarePlus className="h-4 w-4" />
                {processingAction === `extendfreeze-${member.user_id}` ? "Extending..." : "Extend Freeze"}
              </button>
            </>
          )}

          {/* Renew */}
          <button
            type="button"
            className="w-full text-left px-3 py-2 text-sm text-gray-700 flex items-center gap-2 hover:bg-gray-50"
            onClick={handleAction(() => onRenew(member))}
            disabled={processingAction === `renew-${member.user_id}`}
          >
            <RefreshCw className="h-4 w-4" /> Renew Membership
          </button>

          {/* Upgrade */}
          <button
            type="button"
            className="w-full text-left px-3 py-2 text-sm text-gray-700 flex items-center gap-2 hover:bg-gray-50"
            onClick={handleAction(() => onUpgrade(member))}
            disabled={processingAction === `upgrade-${member.user_id}`}
          >
            <ArrowUpRight className="h-4 w-4" /> Upgrade Package
          </button>

          {/* Coaching */}
          <button
            type="button"
            className="w-full text-left px-3 py-2 text-sm text-gray-700 flex items-center gap-2 hover:bg-blue-50"
            onClick={handleAction(() => onCoaching(member))}
            disabled={processingAction === `coaching-${member.user_id}`}
          >
            <Users className="h-4 w-4" /> 1-on-1 Coaching
          </button>

          <div className="border-t border-gray-100 my-1" />

          {/* Deactivate / Activate */}
          <button
            type="button"
            className="w-full text-left px-3 py-2 text-sm text-red-600 flex items-center gap-2 hover:bg-red-50"
            onClick={handleAction(() => {
              if (member.status === 'active') setDeactOpen(true);
              else handleStatusChange('active');
            })}
          >
            {member.status === 'active' ? 'Deactivate' : 'Activate'}
          </button>
        </div>
      )}

      <DeactivateModal
        isOpen={deactOpen}
        onClose={() => setDeactOpen(false)}
        memberName={member.full_name}
        onConfirm={(reason) => handleStatusChange('inactive', reason)} currentStatus={"active"}      />
    </div>
  );
}

function onRefresh() {
  throw new Error("Function not implemented.");
}
