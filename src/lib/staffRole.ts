import { supabase } from "@/lib/supabaseClient";

export type StaffRole = "admin" | "manager" | "receptionist";

export const isCurrentUserSuperAdmin = async (): Promise<boolean> => {
  const { data: { user } } = await supabase.auth.getUser();
  const role = String(user?.app_metadata?.role ?? user?.app_metadata?.account_type ?? "").trim().toLowerCase();
  return role === "super_admin";
};

type StaffRoleLookup = {
  roles?: { name?: string | null } | { name?: string | null }[] | null;
};

const normalizeStaffRole = (value: unknown): StaffRole => {
  const roleName = String(value ?? "").trim().toLowerCase();
  if (roleName === "manager") return "manager";
  if (roleName === "receptionist") return "receptionist";
  return "admin";
};

export async function getCurrentStaffRole(gymId?: string | null): Promise<StaffRole> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return "admin";

    let query = supabase
      .from("staff")
      .select("id, email, roles!inner ( name )")
      .eq("id", user.id);

    if (gymId) query = query.eq("gym_id", gymId);

    const { data, error } = await query.single();
    let staffData = data as StaffRoleLookup | null;

    if (error || !staffData) {
      let emailQuery = supabase
        .from("staff")
        .select("id, email, roles!inner ( name )")
        .eq("email", user.email);

      if (gymId) emailQuery = emailQuery.eq("gym_id", gymId);

      const { data: emailData, error: emailError } = await emailQuery.single();
      if (!emailError && emailData) staffData = emailData as StaffRoleLookup;
    }

    const rawRole = Array.isArray(staffData?.roles)
      ? staffData.roles[0]?.name
      : staffData?.roles?.name;

    return normalizeStaffRole(rawRole);
  } catch {
    return "admin";
  }
}
