import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { executeMigration } from "../../../src/utils/migrationService.ts";
import { executeLegacyMigrationPlan } from "../../../src/utils/legacyMigration.ts";
import { corsHeaders, requireMigrationAdmin } from "../_shared/migration-auth.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        ...corsHeaders,
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    const body = await req.json();
    const { user, serviceClient } = await requireMigrationAdmin(req);
    if (body.action === "status") {
      if (!body.jobId) throw new Error("jobId is required.");
      const { data, error } = await serviceClient
        .from("migration_jobs")
        .select("*")
        .eq("id", body.jobId)
        .single();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, job: data }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { sql, files, plan, gymId, dryRun = false, finalConfirm = '' } = body;
    const fileContents = Array.isArray(files) ? files.map((file: any) => String(file.content ?? "")).filter(Boolean) : [];
    const contents = fileContents.length ? fileContents : [String(sql ?? "")];
    if ((!plan && !contents.some(Boolean)) || !gymId) {
      return new Response(JSON.stringify({ error: "Missing required fields: plan or files/sql, gymId" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Safety: require explicit confirmation for non-dry runs
    if (!dryRun) {
      if (!finalConfirm || String(finalConfirm) !== 'MIGRATE') {
        return new Response(JSON.stringify({ error: "Final confirmation required for full migration. Include { finalConfirm: 'MIGRATE' } in the request body." }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    if (!dryRun) {
      const fileNames = Array.isArray(files) ? files.map((file: any) => String(file.name ?? "legacy-export.sql")) : ["legacy-export.sql"];
      const { data: job, error: jobError } = await serviceClient
        .from("migration_jobs")
        .insert({
          gym_id: gymId,
          requested_by: user.id,
          file_names: fileNames,
          status: "queued",
          progress: 0,
          current_step: "Waiting to start",
        })
        .select("id")
        .single();
      if (jobError) throw jobError;

      const runInBackground = async () => {
        try {
          await serviceClient.from("migration_jobs").update({
            status: "running",
            progress: 1,
            current_step: "Parsing and validating legacy exports",
            started_at: new Date().toISOString(),
          }).eq("id", job.id);

          const progress = async (percent: number, message?: string) => {
            await serviceClient.from("migration_jobs").update({
              progress: percent,
              current_step: message ?? "Migrating data",
            }).eq("id", job.id);
          };
          const result = plan
            ? await executeLegacyMigrationPlan(plan, serviceClient, false, (message: string, percent: number) => {
                void progress(percent, message);
              })
            : await executeMigration(contents, gymId, serviceClient, false, progress);
          const skipped = Object.values(result.counts ?? {}).reduce((sum: number, count: any) => sum + Number(count.skipped ?? 0), 0);
          await serviceClient.from("migration_jobs").update({
            status: skipped || result.issues?.length ? "completed_with_issues" : "completed",
            progress: 100,
            current_step: "Migration finished",
            result,
            completed_at: new Date().toISOString(),
          }).eq("id", job.id);
        } catch (error) {
          await serviceClient.from("migration_jobs").update({
            status: "failed",
            current_step: "Migration failed",
            error_message: error instanceof Error ? error.message : "Unknown migration error",
            completed_at: new Date().toISOString(),
          }).eq("id", job.id);
        }
      };

      // Supabase Edge Runtime keeps this promise alive after the HTTP response.
      EdgeRuntime.waitUntil(runInBackground());
      return new Response(JSON.stringify({ success: true, jobId: job.id, status: "queued" }), {
        status: 202,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Dry runs still stream immediate validation feedback.
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        const send = (obj: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        };

        // Initial hello
        send({ type: 'start', message: 'Migration started', dryRun });

        try {
          const preview = plan
            ? await executeLegacyMigrationPlan(plan, serviceClient, true)
            : await executeMigration(contents, gymId, serviceClient, true);
          send({ type: 'preview', preview });

          send({ type: 'done', result: { preview } });
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
        ...corsHeaders,
      }
    });

  } catch (err: unknown) {
    if (err instanceof Error) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    return new Response(JSON.stringify({ error: "Unknown error" }), { status: 500 });
  }
});
