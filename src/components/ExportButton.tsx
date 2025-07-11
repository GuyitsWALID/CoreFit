import React from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

interface ExportButtonProps {
  filteredMembers: MembershipInfo[];
}

export function ExportButton({ filteredMembers }: ExportButtonProps) {
  const { toast } = useToast();

  const exportToCSV = () => {
    const csvHeaders = [
      'Full Name',
      'Email',
      'Phone',
      'Package Name',
      'Created At',
      'Membership Expiry',
      'Status',
      'Days Left'
    ];

    const csvData = filteredMembers.map(member => [
      member.full_name,
      member.email,
      member.phone,
      member.package_name,
      member.created_at ? new Date(member.created_at).toLocaleDateString() : '-',
      member.membership_expiry ? new Date(member.membership_expiry).toLocaleDateString() : '-',
      member.status,
      member.days_left >= 0 ? member.days_left.toString() : `${Math.abs(member.days_left)} overdue`
    ]);

    const csvContent = [csvHeaders, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `membership_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({ 
      title: "Export completed", 
      description: `Successfully exported ${filteredMembers.length} members to CSV` 
    });
  };

  return (
    <Button 
      className="bg-blue-600 hover:bg-blue-700 text-white" 
      onClick={exportToCSV}
    >
      <Download className="h-4 w-4 mr-2" />
      Export ({filteredMembers.length})
    </Button>
  );
}
