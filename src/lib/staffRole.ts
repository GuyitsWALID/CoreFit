import { supabase } from "@/lib/supabaseClient";

export type StaffRole = "admin" | "manager" | "receptionist";

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

    let { data: staffData, error } = await query.single();

    if (error || !staffData) {
      let emailQuery = supabase
        .from("staff")
        .select("id, email, roles!inner ( name )")
        .eq("email", user.email);

      if (gymId) emailQuery = emailQuery.eq("gym_id", gymId);

      const { data: emailData, error: emailError } = await emailQuery.single();
      if (!emailError && emailData) staffData = emailData;
    }

    const rawRole = Array.isArray((staffData as any)?.roles)
      ? (staffData as any).roles[0]?.name
      : (staffData as any)?.roles?.name;

    return normalizeStaffRole(rawRole);
  } catch {
    return "admin";
  }
}
