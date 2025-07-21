import React, { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  MoreHorizontal,
  Snowflake,
  RefreshCw,
  ArrowUpRight,
  Users,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/supabaseClient";
import DeactivateModal from "./DeactivateModal";
import type { MembershipInfo } from "@/types/memberships";

interface ActionsDropdownProps {
  member: MembershipInfo;
  openDropdown: string | null;
  setOpenDropdown: (value: string | null) => void;
  canFreeze: Record<string, boolean>;
  processingAction: string | null;
  onFreeze: (member: MembershipInfo) => void;
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

  return (
    <div className="relative" ref={dropdownRef}>
      <Button variant="outline" size="sm" className="px-3 py-1 h-8" onClick={handleToggle}>
        <MoreHorizontal className="h-4 w-4" />
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-20 py-1">
          {/* Freeze/Unfreeze */}
          <button
            type="button"
            className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-gray-50 ${
              !canFreeze[member.user_id]
                ? 'opacity-50 cursor-not-allowed text-gray-400'
                : 'text-gray-700'
            }`}
            onClick={handleAction(() => onFreeze(member))}
            disabled={
              processingAction === `freeze-${member.user_id}` || !canFreeze[member.user_id]
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