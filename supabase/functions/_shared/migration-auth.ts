import { createClient } from "npm:@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization,x-client-info,apikey,content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export const requireMigrationAdmin = async (req: Request) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) throw new Error("Migration service is not configured.");

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) throw new Error("Authentication required.");

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) throw new Error("Your session is invalid or expired.");

  const serviceClient = createClient(supabaseUrl, serviceKey);
  let { data: staff, error: staffError } = await serviceClient
    .from("staff")
    .select("id, is_active, roles!inner(name)")
    .eq("id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!staff && user.email) {
    const emailLookup = await serviceClient
      .from("staff")
      .select("id, is_active, roles!inner(name)")
      .eq("email", user.email)
      .eq("is_active", true)
      .maybeSingle();
    staff = emailLookup.data;
    staffError = emailLookup.error;
  }
  if (staffError || !staff) throw new Error("No active migration administrator account was found.");
  const role = Array.isArray(staff.roles) ? staff.roles[0]?.name : staff.roles?.name;
  if (String(role ?? "").trim().toLowerCase() !== "super_admin") {
    throw new Error("Only an active super-admin account can run cross-gym migrations.");
  }
  return { user, serviceClient };
};
