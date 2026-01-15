import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization,x-client-info,apikey,content-type",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  return new Response(JSON.stringify({ ok: true, message: 'migrate-ping OK' }), {
    status: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
});