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
  supabaseKey: string,
  isDryRun: boolean = true,
  onProgress?: (percent: number) => void
) => {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const today = new Date().toISOString().split('T')[0];

  // Helper: split raw VALUES into top-level row strings
  const extractInsertBlocks = (tableName: string): { columns: string[] | null; rows: string[] }[] => {
    const results: { columns: string[] | null; rows: string[] }[] = [];
    const insertRegex = new RegExp(`INSERT INTO\\s+[\\\`"']?${tableName}[\\\`"']?\\s*(\\([^)]*\\))?\\s*VALUES\\s*(.*?);`, 'gis');
    const matches = [...fileContent.matchAll(insertRegex)];

    matches.forEach(match => {
      const colList = match[1] ? match[1].replace(/^\(|\)$/g, '').split(',').map(c => c.trim().replace(/[`"']/g, '').toLowerCase()) : null;
      const valuesBlock = match[2];
      const rows: string[] = [];

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

  // Helper: split a row string into values
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
        buf += ch; 
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
      const singleMatch = v.match(/^'(.*)'$/s);
      if (singleMatch) return singleMatch[1].replace(/\\'|''/g, "'");
      const doubleMatch = v.match(/^"(.*)"$/s);
      if (doubleMatch) return doubleMatch[1].replace(/\\\"/g, '"');
      return v;
    });
  };

  const rowToObject = (cols: string[] | null, values: any[]): Record<string, any> | null => {
    if (!cols) return null;
    const obj: Record<string, any> = {};
    for (let i = 0; i < cols.length; i++) obj[cols[i]] = values[i] === undefined ? null : values[i];
    return obj;
  };

  // --- IMPROVED LOGIC START: FIND THE PAYMENTS TABLE ---
  
  // Try multiple common names for the table that contains expiry dates
  const paymentTableCandidates = ['payments', 'payment', 'subscriptions', 'subscription', 'memberships', 'user_packages', 'gym_payments'];
  let paymentsBlocks: { columns: string[] | null; rows: string[] }[] = [];
  let detectedPaymentTable = '';

  for (const candidate of paymentTableCandidates) {
    const blocks = extractInsertBlocks(candidate);
    if (blocks.length > 0) {
      paymentsBlocks = blocks;
      detectedPaymentTable = candidate;
      console.log(`Found expiration data in table: '${candidate}'`);
      break;
    }
  }

  const userMap: PaymentMap = {};
  let skippedPayments = 0;

  paymentsBlocks.forEach(block => {
    block.rows.forEach((r, rowIndex) => {
      const vals = splitRowValues(r);
      const obj = rowToObject(block.columns, vals);

      // Robust Column Mapping: Look for any column that might mean "Expiry" or "User"
      // If obj is null (no headers), we fall back to indices but warn
      const userId = obj 
        ? (obj.user_id ?? obj.user ?? obj.customer_id ?? obj.member_id) 
        : vals[1]; 
        
      const expiry = obj 
        ? (obj.expiry_date ?? obj.expiry ?? obj.end_date ?? obj.expires_at ?? obj.valid_until ?? obj.date_to) 
        : vals[13]; // Fallback index from your legacy schema

      const pkg = obj 
        ? (obj.package_id ?? obj.pkg_id ?? obj.package ?? obj.plan_id) 
        : vals[21]; // Fallback index

      // Relaxed Status Check: If no status column, assume completed if expiry exists. 
      const statusVal = obj ? (obj.status ?? obj.payment_status) : vals[7];
      const status = statusVal ? statusVal.toString().toLowerCase() : 'completed';

      if (!userId || !expiry) {
        // Only warn if we really can't find data
        if (!obj && !vals[1] && !vals[13]) {
             skippedPayments++;
             return;
        }
      }

      // Logic: If status is 'completed' (or active) and we have a date
      if (['completed', 'active', 'paid', 'success'].includes(status) && expiry) {
        // Compare dates string vs string works for ISO format
        if (!userMap[userId] || (userMap[userId].expiry || '') < expiry) {
          userMap[userId] = { pkgId: pkg, expiry };
        }
      }
    });
  });
  // --- IMPROVED LOGIC END ---

  // 2. Map Users
  const usersBlocks = extractInsertBlocks('users');
  const usersToInsert: SupabaseUser[] = [];

  usersBlocks.forEach(block => {
    block.rows.forEach(r => {
      const vals = splitRowValues(r);
      const obj = rowToObject(block.columns, vals);

      const uId = obj?.id ?? vals[0];
      const fullName = obj?.full_name ?? obj?.name ?? `${obj?.first_name ?? vals[1] ?? ''} ${obj?.last_name ?? vals[2] ?? ''}`;
      
      // --- FIX: NAME SPLITTING (Remove Emails from Last Name) ---
      const rawNameParts = String(fullName || '').trim().split(/\s+/);
      const cleanNameParts = rawNameParts.filter(part => !part.includes('@')); // Filter out emails
      
      const firstName = cleanNameParts[0] || 'Member';
      const lastName = cleanNameParts.slice(1).join(' ') || '';
      // ----------------------------------------------------------

      const email = obj?.email ?? vals[2] ?? null;
      const phone = obj?.phone ?? vals[4] ?? '';
      const gender = obj?.gender ?? vals[8] ?? null;
      const dob = obj?.date_of_birth ?? obj?.dob ?? vals[5] ?? null;
      const createdAt = obj?.created_at ?? vals[15] ?? new Date().toISOString();
      
      const payment = userMap[uId] || { pkgId: null, expiry: null };

      usersToInsert.push({
        id: uId,
        first_name: firstName,
        last_name: lastName,
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
    
    if (!isDryRun) {
      const { error } = await supabase.from('users').upsert(batch, { onConflict: 'id' });
      if (error) throw error;
    } else {
      console.log(`DRY RUN: Prepared batch of ${batch.length} users`, batch[0]);
    }

    if (onProgress) {
      const percent = usersToInsert.length > 0 ? Math.round(((i + batch.length) / usersToInsert.length) * 100) : 50;
      onProgress(percent);
    }
  }

  // 3. Handle legacy role tables
  const insertTables = [...fileContent.matchAll(/INSERT INTO\s+[`"']?([A-Za-z_][A-Za-z0-9_]*)[`"']?/gi)].map(m => m[1].toLowerCase());
  const uniqueTables = Array.from(new Set(insertTables));
  const roleCandidates = ['admin', 'admins', 'trainer', 'trainers', 'receptionist', 'receptionists', 'manager', 'managers', 'owner', 'owners'];
  const foundRoleTables = uniqueTables.filter(t => roleCandidates.includes(t));

  const roleCache = new Map<string, string>();
  const getOrCreateRole = async (roleName: string) => {
    const key = roleName.toLowerCase();
    if (roleCache.has(key)) return roleCache.get(key)!;
    const { data: existingRole } = await supabase.from('roles').select('id').eq('name', roleName).maybeSingle();
    if (existingRole && existingRole.id) {
      roleCache.set(key, existingRole.id);
      return existingRole.id;
    }
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
        const userIdRef = obj?.user_id ?? obj?.id ?? null;
        const emailRef = obj?.email ?? obj?.email_address ?? null;
        const matchedUser = usersToInsert.find(u => u.id === userIdRef) ?? (emailRef ? usersToInsert.find(u => u.email === emailRef) : undefined);
        let staffId = matchedUser?.id ?? (userIdRef ?? null) ?? crypto.randomUUID();

        staffToInsert.push({
          id: staffId,
          first_name: obj?.first_name ?? matchedUser?.first_name ?? '',
          last_name: obj?.last_name ?? matchedUser?.last_name ?? '',
          email: emailRef ?? matchedUser?.email ?? null,
          phone: obj?.phone ?? matchedUser?.phone ?? null,
          role_id: roleId,
          gym_id: targetGymId,
          qr_code: JSON.stringify({ staffId, roleId, gymId: targetGymId }),
          hire_date: new Date().toISOString().split('T')[0],
        });
      });
    });
  }

  // 3b. Insert Staff in batches
  for (let i = 0; i < staffToInsert.length; i += chunkSize) {
    const batch = staffToInsert.slice(i, i + chunkSize);
    if (!isDryRun) {
      const { error } = await supabase.from('staff').upsert(batch, { onConflict: 'email' });
      if (error) throw error;
    } else {
      console.log(`DRY RUN: Prepared batch of ${batch.length} staff`);
    }
    if (onProgress && i + batch.length >= staffToInsert.length) onProgress(100);
  }

  // Final check
  let finalUserCount = 0;
  if (!isDryRun) {
      const { count } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('gym_id', targetGymId);
      finalUserCount = count || 0;
  }

  return { usersInserted: usersToInsert.length, staffInserted: staffToInsert.length, skippedPayments };
};