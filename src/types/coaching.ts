// src/types/coaching.ts

export interface Trainer {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone?: string;
  // Add any other properties from your staff table that you might need here
}

export interface CoachingSessionData {
  user_id: string;
  trainer_id: string; // Matches the one_to_one_coaching table schema
  hourly_rate: number;
  days_per_week: number;
  hours_per_session: number;
  start_date: string;
  end_date?: string; // Optional as per your schema
  status?: 'active' | 'paused' | 'completed' | 'cancelled'; // Optional with default in DB
  weekly_price: number;
  monthly_price: number;
}

// If you have a separate MembershipInfo, ensure it's also consistent
// For example:
// export interface MembershipInfo {
//   user_id: string;
//   full_name: string;
//   email: string;
//   package_name: string;
//   // ... other membership details
// }