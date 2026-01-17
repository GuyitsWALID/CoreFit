import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { executeMigration } from "../../../src/utils/migrationService.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
// Accept either SUPABASE_SERVICE_ROLE_KEY or a project secret named SERVICE_ROLE_KEY
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY");
// Optional anon key for preview reads when service key is not present
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("VITE_SUPABASE_ANON_KEY");
if (!SUPABASE_URL) {
  throw new Error("Server configuration error: SUPABASE_URL is missing.");
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
    const { sql, gymId, dryRun = false, finalConfirm = '' } = body;
    if (!sql || !gymId) {
      return new Response(JSON.stringify({ error: "Missing required fields: sql, gymId" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // Safety: require explicit confirmation for non-dry runs
    if (!dryRun) {
      if (!finalConfirm || String(finalConfirm) !== 'MIGRATE') {
        return new Response(JSON.stringify({ error: "Final confirmation required for full migration. Include { finalConfirm: 'MIGRATE' } in the request body." }), {
          status: 400,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
      }

      // Ensure service role key is present before allowing writes
      if (!SUPABASE_SERVICE_ROLE_KEY) {
        return new Response(JSON.stringify({ error: "Full migration not enabled: SUPABASE_SERVICE_ROLE_KEY is not configured in this environment." }), {
          status: 500,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
      }
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
          // Run a quick preview first so the UI gets immediate feedback
          const keyForPreview = SUPABASE_SERVICE_ROLE_KEY ?? SUPABASE_ANON_KEY;
          const previewClient = createClient(SUPABASE_URL!, keyForPreview ?? '');
          const preview = await executeMigration(sql, gymId, previewClient, true);
          send({ type: 'preview', preview });

          if (dryRun) {
            // If caller requested dry run only, finish here with preview
            send({ type: 'done', result: { preview } });
            controller.close();
            return;
          }

          // Now run the actual migration and stream progress
          const svcClient = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
          const result = await executeMigration(sql, gymId, svcClient, false, (percent: number) => {
            send({ type: 'progress', percent });
          });

          // Send final summary and close
          send({ type: 'done', result });
          controller.close();
        } catch (err: unknown) {
          console.error('migrate-run error', err);
          if (err instanceof Error) {
            send({ type: 'error', message: err.message, stack: err.stack });
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