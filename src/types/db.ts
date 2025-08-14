// src/types/db.ts
export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

/**
 * Minimal User row used in the frontend.
 * phone is optional (some users may not have it).
 */
export interface User {
  id: string;
  first_name: string;
  last_name: string;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  package_id?: string | null;
  membership_type?: string | null; // mapped from package.name for convenience
  membership_expiry?: string | null;
  status?: string | null; // e.g. active, paused, expired, cancelled, inactive
  created_at?: string | null;
  // any other fields you need can be added later
}

/**
 * Staff row for frontend usage.
 */
export interface Staff {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  role_id?: string | null;
  role_name?: string | null; // populated by joining roles table
  is_active?: boolean | null;
  created_at?: string | null;
}
