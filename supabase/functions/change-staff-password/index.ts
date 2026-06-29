import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization,x-client-info,apikey,content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

const getRoleName = (staff: any) => {
  const roles = staff?.roles;
  return String(Array.isArray(roles) ? roles[0]?.name : roles?.name ?? "").trim().toLowerCase();
};

const passwordStrength = (password: string) => {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return score;
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceKey) {
      throw new Error("Password reset service is not configured.");
    }

    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Authentication required." }, 401);
    }

    const { gymId, targetStaffId, newPassword } = await req.json();
    if (!gymId || !targetStaffId || typeof newPassword !== "string") {
      return jsonResponse({ error: "gymId, targetStaffId, and newPassword are required." }, 400);
    }
    if (passwordStrength(newPassword) < 4) {
      return jsonResponse({ error: "Password is not strong enough." }, 400);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const serviceClient = createClient(supabaseUrl, serviceKey);

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return jsonResponse({ error: "Your session is invalid or expired." }, 401);

    let { data: callerStaff, error: callerError } = await serviceClient
      .from("staff")
      .select("id, email, gym_id, is_active, roles!inner(name)")
      .eq("id", user.id)
      .eq("gym_id", gymId)
      .eq("is_active", true)
      .maybeSingle();

    if ((!callerStaff || callerError) && user.email) {
      const emailLookup = await serviceClient
        .from("staff")
        .select("id, email, gym_id, is_active, roles!inner(name)")
        .eq("email", user.email)
        .eq("gym_id", gymId)
        .eq("is_active", true)
        .maybeSingle();
      callerStaff = emailLookup.data;
      callerError = emailLookup.error;
    }

    if (callerError || !callerStaff) {
      return jsonResponse({ error: "No active staff account was found for this gym." }, 403);
    }

    if (getRoleName(callerStaff) !== "admin") {
      return jsonResponse({ error: "Only gym admins can change staff passwords." }, 403);
    }

    const { data: targetStaff, error: targetError } = await serviceClient
      .from("staff")
      .select("id, email, gym_id, is_active, roles!inner(name)")
      .eq("id", targetStaffId)
      .eq("gym_id", gymId)
      .eq("is_active", true)
      .maybeSingle();

    if (targetError || !targetStaff) {
      return jsonResponse({ error: "Target staff member was not found in this gym." }, 404);
    }

    const targetRole = getRoleName(targetStaff);
    if (!["manager", "receptionist"].includes(targetRole)) {
      return jsonResponse({ error: "Only manager and receptionist passwords can be changed here." }, 403);
    }

    const { error: updateError } = await serviceClient.auth.admin.updateUserById(targetStaff.id, {
      password: newPassword,
    });

    if (updateError) throw updateError;

    return jsonResponse({ success: true });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Password update failed." }, 500);
  }
});
