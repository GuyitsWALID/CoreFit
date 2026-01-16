import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

// Lightweight generator: parses legacy SQL and emits a Postgres migration SQL script (no DB writes)

serve(async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization,x-client-info,apikey,content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Max-Age": "86400",
    }});
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    }

    const body = await req.json();
    const { sql, gymId } = body;
    if (!sql || !gymId) {
      return new Response(JSON.stringify({ error: 'Missing required fields: sql, gymId' }), { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    }

    // Inline parsing helpers (similar to migrationService but standalone)
    const extractInsertBlocks = (tableName: string) => {
      const re = new RegExp('INSERT INTO\\s+[`"\']?' + tableName + '[`"\']?\\s*(\\([^)]*\\))?\\s*VALUES\\s*(.*?);', 'gis');
      const matches = [...sql.matchAll(re)];
      const results: { columns: string[] | null; rows: string[] }[] = [];
      matches.forEach((m: RegExpMatchArray) => {
        const cols = m[1] ? m[1].replace(/^\(|\)$/g, '').split(',').map(s => s.trim().replace(/[`"']/g, '').toLowerCase()) : null;
        const valuesBlock = m[2] || '';
        const rowMatches = [...valuesBlock.matchAll(/\((.*?)\)(?:,|$)/gs)].map((r: RegExpMatchArray) => r[1]);
        results.push({ columns: cols, rows: rowMatches });
      });
      return results;
    };

    const splitRowValues = (row: string) => {
      const trimmed = row.replace(/^\(|\),?$/g, '').trim();
      const values: string[] = [];
      let buf = '';
      let inSingle = false;
      let inDouble = false;

      for (let i = 0; i < trimmed.length; i++) {
        const ch = trimmed[i];
        const prev = trimmed[i - 1];

        if (ch === "'" && prev !== '\\' && !inDouble) { inSingle = !inSingle; buf += ch; continue; }
        if (ch === '"' && prev !== '\\' && !inSingle) { inDouble = !inDouble; buf += ch; continue; }
        if (ch === ',' && !inSingle && !inDouble) { values.push(buf.trim()); buf = ''; continue; }
        buf += ch;
      }
      if (buf.length) values.push(buf.trim());
      return values.map(v => {
        if (/^NULL$/i.test(v)) return null as any;
        const singleMatch = v.match(/^'(.*)'$/s);
        if (singleMatch) return singleMatch[1].replace(/\\'/g, "'").replace(/''/g, "'");
        const doubleMatch = v.match(/^"(.*)"$/s);
        if (doubleMatch) return doubleMatch[1].replace(/\\"/g, '"');
        return v;
      });
    };

    const rowToObject = (cols: string[] | null, values: any[]) => {
      if (!cols) return null;
      const obj: Record<string, any> = {};
      for (let i = 0; i < cols.length; i++) obj[cols[i]] = values[i] === undefined ? null : values[i];
      return obj;
    };

    // Build payments map
    const paymentsBlocks = extractInsertBlocks('payments');
    const userMap: Record<string, { pkgId: string | null; expiry: string | null }> = {};
    paymentsBlocks.forEach(block => {
      block.rows.forEach(r => {
        const vals = splitRowValues(r);
        const obj = rowToObject(block.columns, vals);
        if (!obj) return; // skip
        const userId = obj.user_id ?? obj.user ?? obj.customer_id ?? null;
        const expiry = obj.expiry_date ?? obj.expiry ?? obj.end_date ?? null;
        const pkg = obj.package_id ?? obj.pkg_id ?? obj.package ?? null;
        const status = (obj.status ?? obj.payment_status ?? '')?.toString().toLowerCase();
        if (!userId || !expiry) return;
        if (status === 'completed') {
          if (!userMap[userId] || (userMap[userId].expiry || '') < expiry) userMap[userId] = { pkgId: pkg, expiry };
        }
      });
    });

    // Build users array
    const usersBlocks = extractInsertBlocks('users');
    const usersToInsert: any[] = [];
    usersBlocks.forEach(block => {
      block.rows.forEach(r => {
        const vals = splitRowValues(r);
        const obj = rowToObject(block.columns, vals);
        const uId = obj?.id ?? vals[0];
        const fullName = obj?.full_name ?? obj?.name ?? `${obj?.first_name ?? vals[1] ?? ''} ${obj?.last_name ?? vals[2] ?? ''}`;
        const nameParts = String(fullName || '').trim().split(/\s+/);
        const email = obj?.email ?? vals[2] ?? null;
        const phone = obj?.phone ?? vals[4] ?? '';
        const gender = obj?.gender ?? vals[8] ?? null;
        const dob = obj?.date_of_birth ?? obj?.dob ?? vals[5] ?? null;
        const createdAt = obj?.created_at ?? vals[15] ?? new Date().toISOString();
        const payment = userMap[uId] || { pkgId: null, expiry: null };
        usersToInsert.push({
          id: uId,
          first_name: nameParts[0] || 'Member',
          last_name: nameParts.slice(1).join(' ') || '',
          email,
          phone: phone || '',
          gender: gender || null,
          date_of_birth: dob && !/0000-00-00/.test(dob) ? dob : null,
          created_at: createdAt,
          status: (payment.expiry && payment.expiry >= new Date().toISOString().split('T')[0]) ? 'active' : 'expired',
          gym_id: gymId,
          package_id: payment.pkgId,
          membership_expiry: payment.expiry,
          qr_code_data: JSON.stringify({ userId: uId, packageId: payment.pkgId, expiryDate: payment.expiry }),
        });
      });
    });

    // Build staff array from role tables and staff table
    const insertTables = [...sql.matchAll(/INSERT INTO\\s+[`\"']?([A-Za-z_][A-Za-z0-9_]*)/gi)].map(m => m[1].toLowerCase());
    const roleCandidates = ['admin', 'admins', 'trainer', 'trainers', 'receptionist', 'receptionists', 'manager', 'managers', 'owner', 'owners'];
    const foundRoleTables = Array.from(new Set(insertTables)).filter(t => roleCandidates.includes(t));

    const staffToInsert: any[] = [];

    for (const table of foundRoleTables) {
      const roleName = table.replace(/s$/,'');
      const roleIdPlaceholder = `ROLE_${roleName.toUpperCase()}`; // placeholder, user can replace with actual role ids
      const blocks = extractInsertBlocks(table);
      blocks.forEach(block => {
        block.rows.forEach(r => {
          const vals = splitRowValues(r);
          const obj = rowToObject(block.columns, vals);
          const userIdRef = obj?.user_id ?? obj?.id ?? null;
          const emailRef = obj?.email ?? obj?.email_address ?? null;
          const matchedUser = usersToInsert.find(u => u.id === userIdRef) ?? (emailRef ? usersToInsert.find(u => u.email === emailRef) : undefined);
          let staffId = matchedUser?.id ?? (userIdRef ?? null) ?? `staff_${Math.random().toString(36).slice(2,9)}`;
          staffToInsert.push({
            id: staffId,
            first_name: obj?.first_name ?? obj?.fname ?? (matchedUser?.first_name) ?? '',
            last_name: obj?.last_name ?? obj?.lname ?? (matchedUser?.last_name) ?? '',
            email: emailRef ?? (matchedUser?.email ?? null),
            phone: obj?.phone ?? (matchedUser?.phone ?? null),
            date_of_birth: obj?.date_of_birth ?? null,
            gender: obj?.gender ?? null,
            role_id: roleIdPlaceholder,
            hire_date: obj?.hire_date ?? new Date().toISOString().split('T')[0],
            salary: obj?.salary ?? 0,
            is_active: true,
            gym_id: gymId,
            qr_code: JSON.stringify({ staffId, roleId: roleIdPlaceholder, gymId }),
            created_at: new Date().toISOString(),
          });
        });
      });
    }

    // If staff table present, include
    const staffBlocks = extractInsertBlocks('staff');
    staffBlocks.forEach(block => {
      block.rows.forEach(r => {
        const vals = splitRowValues(r);
        const obj = rowToObject(block.columns, vals);
        staffToInsert.push({
          id: obj?.id ?? `staff_${Math.random().toString(36).slice(2,9)}`,
          first_name: obj?.first_name ?? '',
          last_name: obj?.last_name ?? '',
          email: obj?.email ?? null,
          phone: obj?.phone ?? null,
          date_of_birth: obj?.date_of_birth ?? null,
          gender: obj?.gender ?? null,
          role_id: obj?.role ?? obj?.role_name ?? null,
          hire_date: obj?.hire_date ?? new Date().toISOString().split('T')[0],
          salary: obj?.salary ?? 0,
          is_active: obj?.is_active ?? true,
          gym_id: gymId,
          qr_code: JSON.stringify({ staffId: obj?.id, roleId: obj?.role ?? obj?.role_name ?? null, gymId }),
          created_at: obj?.created_at ?? new Date().toISOString(),
        });
      });
    });

    // SQL escaping helper
    const sqlEscape = (v: any) => {
      if (v === null || v === undefined) return 'NULL';
      if (typeof v === 'number') return String(v);
      return `'${String(v).replace(/'/g, "''")}'`;
    };

    // Generate INSERT ... ON CONFLICT ... SQL for users and staff
    const genUpsertSql = (table: string, rows: any[], conflictCols: string[]) => {
      if (!rows || rows.length === 0) return '';
      const cols = Object.keys(rows[0]);
      const lines = rows.map(r => `(${cols.map(c => sqlEscape(r[c])).join(', ')})`);
      const insertHeader = `INSERT INTO ${table} (${cols.join(', ')}) VALUES\n${lines.join(',\n')}`;
      const updates = cols.filter(c => !conflictCols.includes(c)).map(c => `${c} = EXCLUDED.${c}`).join(', ');
      const conflict = `ON CONFLICT (${conflictCols.join(', ')}) DO UPDATE SET ${updates};`;
      return `${insertHeader}\n${conflict}`;
    };

    const usersSql = genUpsertSql('users', usersToInsert, ['id']);
    // For staff prefer conflict on email when present, else id
    const staffConflict = staffToInsert.some(s => s.email) ? ['email'] : ['id'];
    const staffSql = genUpsertSql('staff', staffToInsert, staffConflict);

    const migrationSql = [`-- Migration generated by migrate-generate`, `BEGIN;`, usersSql, staffSql, `COMMIT;`].filter(Boolean).join('\n\n');

    const preview = { usersInserted: usersToInsert.length, staffInserted: staffToInsert.length, skippedPayments: 0, skippedRows: [], warnings: [], detectedTables: Array.from(new Set(insertTables || [])) };

    return new Response(JSON.stringify({ success: true, preview, migrationSql }), { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });

    // Fallback (should never be reached) to ensure handler always returns a Response
    // (helps TypeScript narrow the return type)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _unreachable: void = null as any;
    return new Response(JSON.stringify({ error: 'Unhandled error' }), { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });

  } catch (err: unknown) {
    console.error('migrate-generate error', err);
    return new Response(JSON.stringify({ error: (err instanceof Error) ? err.message : 'Unknown' }), { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  }
});