
import React from 'react';
import { Users, Calendar, BadgeCheck, DollarSign } from 'lucide-react';
import { StatCard } from '@/components/dashboard/StatCard';
import { MembershipExpiryCard } from '@/components/dashboard/MembershipExpiryCard';
import { RecentCheckInsCard } from '@/components/dashboard/RecentCheckInsCard';

// Mock data
const expiringMembers = [
  { id: '1', name: 'John Doe', expiryDays: 2, package: 'Gold Membership' },
  { id: '2', name: 'Sara Smith', expiryDays: 3, package: 'Silver Membership' },
  { id: '3', name: 'Michael Johnson', expiryDays: 4, package: 'Premium Membership' },
];

const recentCheckIns = [
  { id: '1', name: 'Emily Wang', time: '10:35 AM', package: 'Gold Membership' },
  { id: '2', name: 'Alex Carter', time: '09:22 AM', package: 'Premium Membership' },
  { id: '3', name: 'David Kim', time: '08:45 AM', package: 'Silver Membership' },
];

export default function Dashboard() {
  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-3xl font-bold tracking-tight">Dashboard Overview</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Members"
          value="486"
          icon={Users}
          trend={{ value: "12% ↑ this month", positive: true }}
        />
        <StatCard
          title="Today's Check-Ins"
          value="23"
          icon={Calendar}
          trend={{ value: "5 more than yesterday", positive: true }}
        />
        <StatCard
          title="Active Memberships"
          value="245"
          icon={BadgeCheck}
          trend={{ value: "3% ↑ this week", positive: true }}
        />
        <StatCard
          title="Revenue Today"
          value="$1,240"
          icon={DollarSign}
          trend={{ value: "8% ↓ vs. last week", positive: false }}
        />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
        <MembershipExpiryCard members={expiringMembers} />
        <RecentCheckInsCard checkIns={recentCheckIns} />
      </div>
    </div>
  );
}
