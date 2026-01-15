import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

// Lightweight preview parser (no external imports) - counts tables and checks for missing emails when columns present

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

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const body = await req.json();
    const { sql, gymId } = body;
    if (!sql || !gymId) {
      return new Response(JSON.stringify({ error: "Missing required fields: sql, gymId" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // Simple helpers
    const extractInsertBlocks = (tableName: string) => {
      const re = new RegExp(`INSERT INTO\\s+['\"`+tableName+`'\"\\s]*(\\([^)]*\\))?\\s*VALUES\\s*(.*?);`, 'gis');
      const matches = [...sql.matchAll(re)];
      const results: { columns: string[] | null; rows: string[] }[] = [];

matches.forEach((m: RegExpMatchArray) => {
      const cols = m[1]
        ? m[1].replace(/^\(|\)$/g, '').split(',').map((s: string) => s.trim().replace(/[`"']/g, '').toLowerCase())
        : null;
      const valuesBlock = m[2] || '';
      // naive split on '),(' but handle simple cases
      const rowMatches = [...valuesBlock.matchAll(/\((.*?)\)(?:,|$)/gs)].map((r: RegExpMatchArray) => r[1]);
        results.push({ columns: cols, rows: rowMatches });
      });

      return results;
    };

    // Detect tables
    const tableMatches = [...sql.matchAll(/INSERT INTO\s+[`\"']?([A-Za-z_][A-Za-z0-9_]*)/gi)].map(m => m[1].toLowerCase());
    const detectedTables = Array.from(new Set(tableMatches));

    // Count users & payments
    const usersBlocks = extractInsertBlocks('users');
    const paymentsBlocks = extractInsertBlocks('payments');

    const usersCount = usersBlocks.reduce((sum, b) => sum + b.rows.length, 0);
    const paymentsCount = paymentsBlocks.reduce((sum, b) => sum + b.rows.length, 0);

    // Data health: if users blocks have columns and 'email' column, count missing
    let missingEmails = 0;
    usersBlocks.forEach(b => {
      if (b.columns && b.columns.includes('email')) {
        const idx = b.columns.indexOf('email');
        b.rows.forEach(r => {
          const parts = r.split(/,(?=(?:[^']*'[^']*')*[^']*$)/).map(s => s.trim().replace(/^'|'$/g, ''));
          const val = parts[idx];
          if (!val || val.toLowerCase() === 'null') missingEmails++;
        });
      }
    });

    const warnings: string[] = [];
    if (missingEmails > 0) warnings.push(`${missingEmails} users are missing email addresses`);

    const preview = {
      usersInserted: usersCount,
      staffInserted: detectedTables.includes('staff') ? 0 : 0,
      skippedPayments: 0,
      skippedRows: [],
      warnings,
      detectedTables,
    };

    return new Response(JSON.stringify({ success: true, preview }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });

  } catch (err: unknown) {
    console.error('migrate-preview error', err);
    return new Response(JSON.stringify({ error: (err instanceof Error) ? err.message : 'Unknown' }), { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  }
});