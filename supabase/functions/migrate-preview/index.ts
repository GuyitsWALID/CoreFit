import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { generatePreview } from "../../../src/utils/migrationService.ts";

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization,x-client-info,apikey,content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }

  try {
    if (req.method !== "POST") throw new Error("Method not allowed");

    const { sql, gymId } = await req.json();
    if (!sql || !gymId) throw new Error("Missing required fields: sql, gymId");

    // Generate the preview using the shared service
    // This will now correctly detect 'Users' and 'Payments' because of our PascalCase fix
    const preview = generatePreview(sql, gymId);

    return new Response(JSON.stringify({ success: true, preview }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });

  } catch (err: any) {
    console.error('migrate-preview error:', err.message);
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, 
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
    });
  }
});