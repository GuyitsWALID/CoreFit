import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { generateMigrationSql } from "../../../src/utils/migrationService.ts";

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization,x-client-info,apikey,content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    }});
  }

  try {
    if (req.method !== 'POST') throw new Error('Method not allowed');

    const { sql, gymId } = await req.json();
    if (!sql || !gymId) throw new Error('Missing required fields: sql, gymId');

    // Generates the SQL string using ON CONFLICT logic from the service
    const { migrationSql, preview } = generateMigrationSql(sql, gymId);

    return new Response(JSON.stringify({ 
      success: true, 
      preview, 
      migrationSql 
    }), { 
      status: 200, 
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
    });

  } catch (err: any) {
    console.error('migrate-generate error:', err.message);
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, 
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
    });
  }
});