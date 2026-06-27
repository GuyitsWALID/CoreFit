

export type MembershipStatus = 'active' | 'paused' | 'inactive' | 'expired';

export interface MembershipInfo {
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  package_id: string | null;
  package_name: string | null;
  created_at: string;
  membership_expiry: string | null;
  status: MembershipStatus;
  days_left: number;
  duration_unit: 'days' | 'weeks' | 'months' | 'years';
  duration_value: number;
  is_coupon?: boolean;
  number_of_passes?: number | null;
  coupon_used_passes?: number;
  coupon_remaining_passes?: number;
}
