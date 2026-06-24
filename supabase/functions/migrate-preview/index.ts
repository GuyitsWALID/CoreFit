import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { generatePreview } from "../../../src/utils/migrationService.ts";
import { corsHeaders, requireMigrationAdmin } from "../_shared/migration-auth.ts";

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        ...corsHeaders,
      },
    });
  }

  try {
    if (req.method !== "POST") throw new Error("Method not allowed");

    await requireMigrationAdmin(req);
    const { sql, files, gymId } = await req.json();
    const fileContents = Array.isArray(files) ? files.map((file: any) => String(file.content ?? "")).filter(Boolean) : [];
    const contents = fileContents.length ? fileContents : [String(sql ?? "")];
    if (!contents.some(Boolean) || !gymId) throw new Error("Missing required fields: files/sql, gymId");

    // Generate the preview using the shared service
    // This will now correctly detect 'Users' and 'Payments' because of our PascalCase fix
    const preview = generatePreview(contents, gymId);

    return new Response(JSON.stringify({ success: true, preview }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (err: any) {
    console.error('migrate-preview error:', err.message);
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, 
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
});
