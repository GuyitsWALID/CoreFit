import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpRight, X } from "lucide-react";

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

interface Package {
  id: string;
  name: string;
  price: number;
}

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: MembershipInfo | null;
  availablePackages: Package[];
  selectedPackage: string;
  setSelectedPackage: (value: string) => void;
  onSubmit: () => void;
  isProcessing: boolean;
}

export function UpgradeModal({ 
  isOpen, 
  onClose, 
  member,
  availablePackages,
  selectedPackage,
  setSelectedPackage,
  onSubmit,
  isProcessing
}: UpgradeModalProps) {
  if (!isOpen || !member) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleModalClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={handleOverlayClick}>
      <div className="fixed inset-0 bg-black bg-opacity-50" />
      <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={handleModalClick}>
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold">Upgrade Package</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-6 w-6 p-0"
            type="button"
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
                .filter(pkg => 
                pkg.id !== member.package_id &&
                pkg.price > Number(member.package_id && availablePackages.find(p => p.id === member.package_id)?.price || 0)
                )
                .map(pkg => (
                <SelectItem key={pkg.id} value={pkg.id}>
                  {pkg.name} - ETB {pkg.price?.toLocaleString() || 0}
                </SelectItem>
                ))}
              </SelectContent>
            </Select>
            </div>
          
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={onClose} type="button">
              Cancel
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={onSubmit}
              disabled={!selectedPackage || isProcessing}
              type="button"
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
