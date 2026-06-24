import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { generateMigrationSql } from "../../../src/utils/migrationService.ts";
import { corsHeaders, requireMigrationAdmin } from "../_shared/migration-auth.ts";

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: {
      ...corsHeaders,
    }});
  }

  try {
    if (req.method !== 'POST') throw new Error('Method not allowed');

    await requireMigrationAdmin(req);
    const { sql, files, gymId } = await req.json();
    const fileContents = Array.isArray(files) ? files.map((file: any) => String(file.content ?? "")).filter(Boolean) : [];
    const contents = fileContents.length ? fileContents : [String(sql ?? "")];
    if (!contents.some(Boolean) || !gymId) throw new Error('Missing required fields: files/sql, gymId');

    // Generates the SQL string using ON CONFLICT logic from the service
    const { migrationSql, preview } = generateMigrationSql(contents, gymId);

    return new Response(JSON.stringify({ 
      success: true, 
      preview, 
      migrationSql 
    }), { 
      status: 200, 
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (err: any) {
    console.error('migrate-generate error:', err.message);
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, 
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
});
