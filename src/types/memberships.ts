

export type MembershipStatus = 'active' | 'paused' | 'inactive' | 'expired';

export interface MembershipInfo {
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  package_id: string;
  package_name: string;
  created_at: string;
  membership_expiry: string;
  status: MembershipStatus;
  days_left: number;
}
