import { createClient } from '@supabase/supabase-js';

// Define the shape of your target Supabase User
interface SupabaseUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  gender: string;
  date_of_birth: string | null;
  created_at: string;
  status: 'active' | 'expired';
  gym_id: string;
  package_id: string | null;
  membership_expiry: string | null;
  qr_code_data: string;
}

interface PaymentMap {
  [userId: string]: {
    pkgId: string | null;
    expiry: string | null;
  };
}

export const executeMigration = async (
  fileContent: string, 
  targetGymId: string,
  supabaseUrl: string,
  supabaseKey: string
) => {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const today = new Date().toISOString().split('T')[0];

  // Helper: split raw VALUES into top-level row strings like "('a', 'b'), ('c','d')"
  const extractInsertBlocks = (tableName: string): { columns: string[] | null; rows: string[] }[] => {
    const results: { columns: string[] | null; rows: string[] }[] = [];

    // Find all INSERT INTO occurrences for this table and capture column list and the following values section until the semicolon
    const insertRegex = new RegExp(`INSERT INTO\\s+[\\\`"']?${tableName}[\\\`"']?\\s*(\\([^)]*\\))?\\s*VALUES\\s*(.*?);`, 'gis');
    const matches = [...fileContent.matchAll(insertRegex)];

    matches.forEach(match => {
      const colList = match[1] ? match[1].replace(/^\(|\)$/g, '').split(',').map(c => c.trim().replace(/[`"']/g, '').toLowerCase()) : null;
      const valuesBlock = match[2];
      const rows: string[] = [];

      // Extract each top-level parenthesis group while respecting quoted commas
      let depth = 0;
      let buf = '';
      let inSingle = false;
      let inDouble = false;

      for (let i = 0; i < valuesBlock.length; i++) {
        const ch = valuesBlock[i];
        buf += ch;
        if (ch === "'" && !inDouble && valuesBlock[i - 1] !== "\\") inSingle = !inSingle;
        if (ch === '"' && !inSingle && valuesBlock[i - 1] !== "\\") inDouble = !inDouble;
        if (!inSingle && !inDouble) {
          if (ch === '(') depth++;
          if (ch === ')') depth--;
          if (depth === 0 && buf.trim()) {
            rows.push(buf.trim());
            buf = '';
          }
        }
      }

      results.push({ columns: colList, rows });
    });

    return results;
  };

  // Helper to split a row string like "('a','b',NULL)" into values
  const splitRowValues = (row: string): string[] => {
    const trimmed = row.replace(/^\(|\),?$/g, '').trim();
    const values: string[] = [];
    let buf = '';
    let inSingle = false;
    let inDouble = false;

    for (let i = 0; i < trimmed.length; i++) {
      const ch = trimmed[i];
      const prev = trimmed[i - 1];

      if (ch === "'" && prev !== '\\' && !inDouble) {
        inSingle = !inSingle;
        buf += ch; // keep quotes for now
        continue;
      }
      if (ch === '"' && prev !== '\\' && !inSingle) {
        inDouble = !inDouble;
        buf += ch;
        continue;
      }

      if (ch === ',' && !inSingle && !inDouble) {
        values.push(buf.trim());
        buf = '';
        continue;
      }
      buf += ch;
    }
    if (buf.length) values.push(buf.trim());
    return values.map(v => {
      if (/^NULL$/i.test(v)) return null as any;
      // Handle single-quoted MySQL strings which may use backslash-escaped (\') or doubled ('') quotes
      const singleMatch = v.match(/^'(.*)'$/s);
      if (singleMatch) {
        return singleMatch[1].replace(/\\'|''/g, "'");
      }
      // Handle double-quoted strings (unlikely in MySQL dumps but keep for safety)
      const doubleMatch = v.match(/^"(.*)"$/s);
      if (doubleMatch) {
        return doubleMatch[1].replace(/\\\"/g, '"');
      }
      return v;
    });
  };

  // Helper to map row array to object using columns if present
  const rowToObject = (cols: string[] | null, values: any[]): Record<string, any> | null => {
    if (!cols) return null;
    const obj: Record<string, any> = {};
    for (let i = 0; i < cols.length; i++) obj[cols[i]] = values[i] === undefined ? null : values[i];
    return obj;
  };

  // Find all tables present in the SQL so we can handle typical role tables too
  const insertTables = [...fileContent.matchAll(/INSERT INTO\s+[`"']?([A-Za-z_][A-Za-z0-9_]*)[`"']?/gi)].map(m => m[1].toLowerCase());
  const uniqueTables = Array.from(new Set(insertTables));

  // 1. Process Payments first (look for anything like payments)
  const paymentsBlocks = extractInsertBlocks('payments');
  const userMap: PaymentMap = {};

  let skippedPayments = 0;
  paymentsBlocks.forEach(block => {
    block.rows.forEach((r, rowIndex) => {
      const vals = splitRowValues(r);
      const obj = rowToObject(block.columns, vals);

      // If no column list is present, do not attempt to guess positional indices - skip and warn
      if (!obj) {
        console.warn(`Skipping Payments row: no column list present (cannot reliably parse positional indices). Row snippet: ${r.slice(0,200)}`);
        skippedPayments++;
        return;
      }

      // Prefer named columns; only use obj values
      const userId = obj.user_id ?? obj.user ?? obj.customer_id ?? null;
      const expiry = obj.expiry_date ?? obj.expiry ?? obj.end_date ?? obj.expires_at ?? null;
      const pkg = obj.package_id ?? obj.pkg_id ?? obj.package ?? null;
      const status = (obj.status ?? obj.payment_status ?? '')?.toString().toLowerCase();

      if (!userId || !expiry) {
        console.warn(`Skipping Payments row: missing user id or expiry (row ${rowIndex + 1} in block). Row snippet: ${r.slice(0,200)}`);
        skippedPayments++;
        return;
      }

      if (status === 'completed') {
        if (!userMap[userId] || (userMap[userId].expiry || '') < expiry) {
          userMap[userId] = { pkgId: pkg, expiry };
        }
      }
    });
  });

  // 2. Map Users (support Users or users)
  const usersBlocks = extractInsertBlocks('users');
  const usersToInsert: SupabaseUser[] = [];

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
        status: (payment.expiry && payment.expiry >= today) ? 'active' : 'expired',
        gym_id: targetGymId,
        package_id: payment.pkgId,
        membership_expiry: payment.expiry,
        qr_code_data: JSON.stringify({ userId: uId, packageId: payment.pkgId, expiryDate: payment.expiry }),
      });
    });
  });

  // 2b. Insert Users in batches
  const chunkSize = 150;
  for (let i = 0; i < usersToInsert.length; i += chunkSize) {
    const batch = usersToInsert.slice(i, i + chunkSize);
    // Use explicit onConflict to rely on unique constraint - prefer 'id' (ensure id unique or change to 'email' as needed)
    const { error } = await supabase.from('users').upsert(batch, { onConflict: 'id' });
    if (error) throw error;
  }

  // 3. Handle legacy role tables and transform into our staff/roles schema
  const roleCandidates = ['admin', 'admins', 'trainer', 'trainers', 'receptionist', 'receptionists', 'manager', 'managers', 'owner', 'owners'];
  const foundRoleTables = uniqueTables.filter(t => roleCandidates.includes(t));

  // Cache roles lookups and functions
  const roleCache = new Map<string, string>();
  const getOrCreateRole = async (roleName: string) => {
    const key = roleName.toLowerCase();
    if (roleCache.has(key)) return roleCache.get(key)!;
    // try to find
    const { data: existingRole } = await supabase.from('roles').select('id').eq('name', roleName).maybeSingle();
    if (existingRole && existingRole.id) {
      roleCache.set(key, existingRole.id);
      return existingRole.id;
    }
    // insert
    const { data: newRole, error } = await supabase.from('roles').insert({ name: roleName }).select('id').single();
    if (error) throw error;
    roleCache.set(key, newRole.id);
    return newRole.id;
  };

  const staffToInsert: any[] = [];

  for (const table of foundRoleTables) {
    const blocks = extractInsertBlocks(table);
    const roleName = table.replace(/s$/,'');
    const roleId = await getOrCreateRole(roleName);

    blocks.forEach(block => {
      block.rows.forEach(r => {
        const vals = splitRowValues(r);
        const obj = rowToObject(block.columns, vals);

        // Try to find user by explicit user_id, id or email
        const userIdRef = obj?.user_id ?? obj?.id ?? null;
        const emailRef = obj?.email ?? obj?.email_address ?? null;

        // If we have userIdRef and that user exists in usersToInsert, we'll use it; otherwise we try to match by email
        const matchedUser = usersToInsert.find(u => u.id === userIdRef) ?? (emailRef ? usersToInsert.find(u => u.email === emailRef) : undefined);
        let staffId = matchedUser?.id ?? (userIdRef ?? null) ?? crypto.randomUUID();

        const firstName = obj?.first_name ?? obj?.fname ?? (matchedUser?.first_name) ?? '';
        const lastName = obj?.last_name ?? obj?.lname ?? (matchedUser?.last_name) ?? '';
        const phone = obj?.phone ?? (matchedUser?.phone) ?? null;

        staffToInsert.push({
          id: staffId,
          first_name: firstName,
          last_name: lastName,
          email: emailRef ?? (matchedUser?.email ?? null),
          phone,
          date_of_birth: obj?.date_of_birth ?? null,
          gender: obj?.gender ?? null,
          role_id: roleId,
          hire_date: obj?.hire_date ?? new Date().toISOString().split('T')[0],
          salary: obj?.salary ?? 0,
          is_active: true,
          gym_id: targetGymId,
          qr_code: JSON.stringify({ staffId, roleId, gymId: targetGymId }),
          created_at: new Date().toISOString(),
        });
      });
    });
  }

  // If the dump already had a 'staff' table inserts, use them too (mapping role names to role_ids if possible)
  const staffBlocks = extractInsertBlocks('staff');
  for (const block of staffBlocks) {
    for (const r of block.rows) {
      const vals = splitRowValues(r);
      const obj = rowToObject(block.columns, vals);
      const roleName = obj?.role ?? obj?.role_name ?? null;
      const roleId = roleName ? await getOrCreateRole(roleName) : null;
      staffToInsert.push({
        id: obj?.id ?? crypto.randomUUID(),
        first_name: obj?.first_name ?? '',
        last_name: obj?.last_name ?? '',
        email: obj?.email ?? null,
        phone: obj?.phone ?? null,
        date_of_birth: obj?.date_of_birth ?? null,
        gender: obj?.gender ?? null,
        role_id: roleId,
        hire_date: obj?.hire_date ?? new Date().toISOString().split('T')[0],
        salary: obj?.salary ?? 0,
        is_active: obj?.is_active ?? true,
        gym_id: targetGymId,
        qr_code: JSON.stringify({ staffId: obj?.id, roleId, gymId: targetGymId }),
        created_at: obj?.created_at ?? new Date().toISOString(),
      });
    }
  }

  // Insert staff in batches (avoid duplicates by email or id)
  for (let i = 0; i < staffToInsert.length; i += chunkSize) {
    const batch = staffToInsert.slice(i, i + chunkSize);
    // Use onConflict:'email' to avoid creating duplicate staff records when email has a unique constraint in Supabase
    const { error } = await supabase.from('staff').upsert(batch, { onConflict: 'email' });
    if (error) throw error;
  }

  // Double-check the counts in Supabase vs our processed list
  const { count: finalUserCount } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('gym_id', targetGymId);

  console.log(`Migration Complete. File had ${usersToInsert.length} users. Supabase now has ${finalUserCount} for this gym.`);

  // Return summary (includes skippedPayments count from payments parsing)
  return { usersInserted: usersToInsert.length, staffInserted: staffToInsert.length, skippedPayments };

};