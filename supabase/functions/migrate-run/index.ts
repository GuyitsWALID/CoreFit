import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { executeMigration } from "../../../src/utils/migrationService.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Server configuration error: Supabase credentials missing.");
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization,x-client-info,apikey,content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  try {
    const body = await req.json();
    const { sql, gymId, dryRun = false } = body;
    if (!sql || !gymId) {
      return new Response(JSON.stringify({ error: "Missing required fields: sql, gymId" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // Create a streaming response with SSE
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        const send = (obj: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        };

        // Initial hello
        send({ type: 'start', message: 'Migration started', dryRun });

        try {
          // Call executeMigration with callback for progress
          const result = await executeMigration(sql, gymId, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, dryRun, (percent: number) => {
            send({ type: 'progress', percent });
          });

          send({ type: 'done', result });
          controller.close();
        } catch (err: unknown) {
          if (err instanceof Error) {
            send({ type: 'error', message: err.message });
            controller.error(err);
          } else {
            send({ type: 'error', message: 'Unknown error' });
            controller.error(new Error('Unknown error'));
          }
        }
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
      }
    });

  } catch (err: unknown) {
    if (err instanceof Error) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }
    return new Response(JSON.stringify({ error: "Unknown error" }), { status: 500 });
  }
});