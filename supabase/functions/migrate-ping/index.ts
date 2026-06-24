import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders } from "../_shared/migration-auth.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        ...corsHeaders,
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  return new Response(JSON.stringify({ ok: true, message: 'migrate-ping OK' }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
});
