import { createClient } from 'npm:@supabase/supabase-js@2';

/** -------------------------
 * small helpers (kept & improved)
 * --------------------------*/
const isBooleanKey = (k: string) =>
  /^(is_|has_|should_|enabled|disabled|archived|deleted|active|visible|approved)|_flag$/i.test(k);

const coerceTinyInt = (v: any) => {
  if (v === '0' || v === 0) return false;
  if (v === '1' || v === 1) return true;
  return v;
};

const sanitizeName = (fullName: string | null) => {
  if (!fullName) return { first: 'Member', last: '' };
  const rawNameParts = String(fullName || '').trim().split(/\s+/);
  const cleanNameParts = rawNameParts.filter(p => !p.includes('@'));
  const firstName = cleanNameParts[0] || 'Member';
  const lastName = cleanNameParts.slice(1).join(' ') || '';
  return { first: firstName, last: lastName };
};

/** -------------------------
 * INSERT parsing helpers
 * --------------------------*/
export const extractInsertBlocks = (fileContent: string, tableName: string) => {
  const results: { columns: string[] | null; rows: string[] }[] = [];
  const generalRe = /INSERT INTO\s+[`"']?([A-Za-z_][A-Za-z0-9_]*)[`"']?\s*(\([^)]*\))?\s*VALUES\s*([\s\S]*?);/gis;
  const matches = [...fileContent.matchAll(generalRe)].filter(m => m[1].toLowerCase() === tableName.toLowerCase());

  matches.forEach(match => {
    const colList = match[2] ? match[2].replace(/^\(|\)$/g, '').split(',').map((c: string) => c.trim().replace(/['"`]/g, '').toLowerCase()) : null;
    const valuesBlock = match[3] || '';
    const rows: string[] = [];
    let depth = 0, buf = '', inSingle = false;

    for (let i = 0; i < valuesBlock.length; i++) {
      const ch = valuesBlock[i];
      if (ch === "'" && valuesBlock[i - 1] !== "\\") inSingle = !inSingle;
      if (!inSingle) {
        if (ch === '(') depth++;
        if (ch === ')') depth--;
      }
      buf += ch;
      if (depth === 0 && (ch === ',' || i === valuesBlock.length - 1) && !inSingle) {
        const cleaned = buf.trim().replace(/^,|,$/g, '').trim();
        if (cleaned.startsWith('(')) rows.push(cleaned);
        buf = '';
      }
    }
    results.push({ columns: colList, rows });
  });
  return results;
};

export const splitRowValues = (row: string): string[] => {
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

export const rowToObject = (cols: string[] | null, values: any[]) => {
  if (!cols) return null;
  const obj: Record<string, any> = {};
  for (let i = 0; i < cols.length; i++) obj[cols[i]] = values[i] === undefined ? null : values[i];
  return obj;
};

/** -------------------------
 * robust column mapper: given a list of candidate names, pick a column
 * --------------------------*/
const findColumn = (cols: string[]|null, candidates: string[]) => {
  if (!cols) return -1;
  const normalized = (s: string) => s.replace(/[^a-z0-9]/gi, '').toLowerCase();
  const normCols = cols.map(c => normalized(c));
  for (const cand of candidates) {
    const n = normalized(cand);
    const idx = normCols.indexOf(n);
    if (idx >= 0) return idx;
  }
  // fuzzy contains match
  for (let i = 0; i < normCols.length; i++) {
    for (const cand of candidates) {
      const n = normalized(cand);
      if (normCols[i].includes(n) || n.includes(normCols[i])) return i;
    }
  }
  return -1;
};

const parsePossibleDate = (v: any) => {
  if (!v) return null;
  try {
    const s = String(v).trim();
    if (/^0{4}-0{2}-0{2}/.test(s)) return null;
    const d = new Date(s);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split('T')[0];
  } catch (_) { return null; }
};

/** -------------------------
 * Build migration plan from SQL dump content
 * --------------------------*/
export const buildMigrationPlan = (fileContent: string, targetGymId: string) => {
  const today = new Date().toISOString().split('T')[0];
  const paymentCandidates = ['payments','payment','subscriptions','memberships','Payments','Payment'];
  let paymentsBlocks: any[] = [];
  for (const c of paymentCandidates) {
    const b = extractInsertBlocks(fileContent, c);
    if (b.length) { paymentsBlocks = b; break; }
  }

  const userMap = new Map<string, { pkgId: string | null; expiry: string | null; gender?: string }>();
  const paymentsByEmail = new Map<string, { pkgId: string | null; expiry: string | null; gender?: string }>();
  const paymentsByPhone = new Map<string, { pkgId: string | null; expiry: string | null; gender?: string }>();

  const warnings: string[] = [];
  let skippedPayments = 0;

  const isSuccessfulStatus = (s: string|undefined|null) => {
    if (!s) return false;
    const st = String(s).toLowerCase();
    return ['completed','complete','paid','success','active'].some(x => st.includes(x));
  };

  paymentsBlocks.forEach(block => {
    const cols = block.columns;
    block.rows.forEach(r => {
      const vals = splitRowValues(r);
      const obj = rowToObject(cols, vals);

      const idxUserId = findColumn(cols, ['user_id','user','customer_id','member_id','userid','client_id']);
      const idxEmail  = findColumn(cols, ['email','payer_email','customer_email']);
      const idxPhone  = findColumn(cols, ['phone','mobile','msisdn']);
      const idxExpiry = findColumn(cols, ['expiry_date','expiry','end_date','expires_at','valid_until','date_to','expirydate','validto']);
      const idxPackage= findColumn(cols, ['package_id','pkg_id','package','plan_id','productid','product_id','package_name','plan_name']);
      const idxGender = findColumn(cols, ['gender','sex']);
      const idxStatus = findColumn(cols, ['status','payment_status','paymentstatus','state']);

      const rawUserId = idxUserId >= 0 ? (obj ? obj[cols[idxUserId]] : vals[idxUserId]) : null;
      const rawEmail = idxEmail >= 0 ? (obj ? obj[cols[idxEmail]] : vals[idxEmail]) : null;
      const rawPhone = idxPhone >= 0 ? (obj ? obj[cols[idxPhone]] : vals[idxPhone]) : null;
      const rawExpiry = idxExpiry >= 0 ? (obj ? obj[cols[idxExpiry]] : vals[idxExpiry]) : null;
      const rawPackage= idxPackage >= 0 ? (obj ? obj[cols[idxPackage]] : vals[idxPackage]) : null;
      const rawGender = idxGender >= 0 ? (obj ? obj[cols[idxGender]] : vals[idxGender]) : null;
      const rawStatus = idxStatus >= 0 ? (obj ? obj[cols[idxStatus]] : vals[idxStatus]) : null;

      // qr field detection
      let qrRaw = null;
      const qCandidates = ['qrcodedata','qr_code_data','qrcode','qrdata','qr_payload'];
      for (const q of qCandidates) {
        const qi = findColumn(cols, [q]);
        if (qi >= 0) { qrRaw = obj ? obj[cols[qi]] : vals[qi]; break; }
      }

      const normUserId = rawUserId ? String(rawUserId).trim() : null;
      const normEmail = rawEmail ? String(rawEmail).trim().toLowerCase() : (vals.find(v => typeof v === 'string' && /@/.test(v)) || null);
      const normPhone = rawPhone ? String(rawPhone).trim() : null;

      if (!normUserId && !normEmail && !normPhone) {
        skippedPayments++;
        warnings.push(`Payment row missing identifiers (user/email/phone). Raw: ${JSON.stringify(obj ?? vals).slice(0,200)}`);
        return;
      }

      // **IMPORTANT FIX**: allow reassignment of parsedExpiry -> use let
      let parsedExpiry = parsePossibleDate(rawExpiry) || null;
      let entryPkg = rawPackage ? String(rawPackage).trim() : null;
      let entryGender = rawGender ? String(rawGender).trim().toLowerCase() : null;
      const status = String(rawStatus ?? '').toLowerCase();

      if (qrRaw && typeof qrRaw === 'string') {
        try {
          const cleaned = qrRaw.replace(/''/g, `"`).replace(/\\"/g, '"');
          const parsed = JSON.parse(cleaned);
          if (!entryPkg && (parsed.package || parsed.productId || parsed.plan)) entryPkg = parsed.package || parsed.productId || parsed.plan;
          if (!parsedExpiry && (parsed.expiryDate || parsed.expiry)) parsedExpiry = parsePossibleDate(parsed.expiryDate || parsed.expiry) || parsedExpiry;
          if (!entryGender && parsed.gender) entryGender = String(parsed.gender).toLowerCase();
        } catch (_) {
          // ignore
        }
      }

      if (entryGender) {
        if (/^m$/i.test(entryGender) || /^men$/i.test(entryGender)) entryGender = 'male';
        if (/^f$/i.test(entryGender) || /^women$/i.test(entryGender)) entryGender = 'female';
      }

      const entry = { pkgId: entryPkg, expiry: parsedExpiry, gender: entryGender };

      if (normUserId && isSuccessfulStatus(status)) {
        const existing = userMap.get(normUserId);
        if (!existing) userMap.set(normUserId, entry);
        else {
          if (entry.expiry && (!existing.expiry || existing.expiry < entry.expiry)) {
            userMap.set(normUserId, { ...existing, ...entry });
          } else {
            userMap.set(normUserId, { ...existing, ...entry });
          }
        }
      }

      if (normEmail) {
        const existingE = paymentsByEmail.get(normEmail);
        if (!existingE || ((existingE.expiry||'') < (entry.expiry||''))) paymentsByEmail.set(normEmail, entry);
      }
      if (normPhone) {
        const existingP = paymentsByPhone.get(normPhone);
        if (!existingP || ((existingP.expiry||'') < (entry.expiry||''))) paymentsByPhone.set(normPhone, entry);
      }
    });
  });

  // Process users
  const usersBlocks = extractInsertBlocks(fileContent, 'Users').concat(extractInsertBlocks(fileContent, 'users'));
  const usersToInsert: any[] = [];
  const skippedRows: any[] = [];

  usersBlocks.forEach(block => {
    const cols = block.columns;
    block.rows.forEach(r => {
      const vals = splitRowValues(r);
      const obj = rowToObject(cols, vals);

      const idxId = findColumn(cols, ['id','user_id','uuid']);
      const idxEmail = findColumn(cols, ['email','user_email']);
      const idxPhone = findColumn(cols, ['phone','mobile']);
      const idxName = findColumn(cols, ['full_name','fullname','name']);
      const idxFirst = findColumn(cols, ['first_name','firstname','given_name']);
      const idxLast  = findColumn(cols, ['last_name','lastname','surname']);
      const idxDob = findColumn(cols, ['date_of_birth','dob','birthday','birth_date']);

      const rawId = idxId >= 0 ? (obj ? obj[cols[idxId]] : vals[idxId]) : null;
      const rawEmail = idxEmail >= 0 ? (obj ? obj[cols[idxEmail]] : vals[idxEmail]) : null;
      const rawPhone = idxPhone >= 0 ? (obj ? obj[cols[idxPhone]] : vals[idxPhone]) : null;
      const rawName = idxName >= 0 ? (obj ? obj[cols[idxName]] : vals[idxName]) : null;
      const rawFirst = idxFirst >= 0 ? (obj ? obj[cols[idxFirst]] : vals[idxFirst]) : null;
      const rawLast  = idxLast >= 0 ? (obj ? obj[cols[idxLast]] : vals[idxLast]) : null;
      const rawDob = idxDob >= 0 ? (obj ? obj[cols[idxDob]] : vals[idxDob]) : null;

      if ((!rawId || String(rawId).trim() === '' || rawId === 'NULL') && (!rawEmail || String(rawEmail).trim() === '')) {
        skippedRows.push({ reason: 'no id & no email', raw: obj ?? vals });
        return;
      }

      const uId = rawId ? String(rawId).trim() : null;
      const email = rawEmail ? String(rawEmail).trim().toLowerCase() : null;
      const phone = rawPhone ? String(rawPhone).trim() : null;

      let payment = null as any;
      if (uId) payment = userMap.get(uId);
      if (!payment && email) payment = paymentsByEmail.get(email);
      if (!payment && phone) payment = paymentsByPhone.get(phone);

      const name = rawName ?? `${rawFirst ?? ''} ${rawLast ?? ''}`.trim();
      const { first, last } = sanitizeName(name || null);

      const dob = parsePossibleDate(rawDob) ?? null;
      const packageIdFromPayment = payment?.pkgId ?? null;
      const expiryFromPayment = payment?.expiry ?? null;

      const rawUser: any = {
        id: uId || undefined,
        first_name: first,
        last_name: last,
        email: email ?? null,
        phone: phone ?? '',
        gender: payment?.gender ?? (obj?.gender ?? null),
        date_of_birth: dob,
        created_at: obj?.created_at ?? obj?.createdat ?? vals.find(v => /\d{4}-\d{2}-\d{2}/.test(String(v))) ?? new Date().toISOString(),
        status: expiryFromPayment && expiryFromPayment >= today ? 'active' : 'expired',
        gym_id: targetGymId,
        package_id: packageIdFromPayment && packageIdFromPayment !== 'NULL' ? packageIdFromPayment : null,
        membership_expiry: expiryFromPayment,
        qr_code_data: JSON.stringify({ userId: uId ?? null, packageId: packageIdFromPayment ?? null, expiryDate: expiryFromPayment ?? null }),
      };

      Object.keys(rawUser).forEach(k => { if (isBooleanKey(k)) rawUser[k] = coerceTinyInt(rawUser[k]); });

      usersToInsert.push(rawUser);
    });
  });

  // Diagnostics: counts before enrichment
  const beforeMissing = { package: 0, expiry: 0, gender: 0 };
  usersToInsert.forEach(u => { if (!u.package_id) beforeMissing.package++; if (!u.membership_expiry) beforeMissing.expiry++; if (!u.gender) beforeMissing.gender++; });

  // enrichment and sample collection
  const enrichedSamples: any[] = [];
  usersToInsert.forEach(u => {
    const before = { package_id: u.package_id, membership_expiry: u.membership_expiry, gender: u.gender };
    if ((!u.package_id || u.package_id === null) || (!u.membership_expiry) || (!u.gender)) {
      const byId = u.id ? userMap.get(u.id) : null;
      const byEmail = u.email ? paymentsByEmail.get(String(u.email).trim().toLowerCase()) : null;
      const byPhone = u.phone ? paymentsByPhone.get(String(u.phone).trim()) : null;
      const candidate = byId || byEmail || byPhone;
      if (candidate) {
        if ((!u.package_id || u.package_id === null) && candidate.pkgId) u.package_id = candidate.pkgId;
        if ((!u.membership_expiry || u.membership_expiry === null) && candidate.expiry) u.membership_expiry = candidate.expiry;
        if ((!u.gender || u.gender === null) && candidate.gender) u.gender = candidate.gender;
      }
    }
    const after = { package_id: u.package_id, membership_expiry: u.membership_expiry, gender: u.gender };
    if (before.package_id !== after.package_id || before.membership_expiry !== after.membership_expiry || before.gender !== after.gender) {
      enrichedSamples.push({ id: u.id, email: u.email, before, after, source: u.id && userMap.has(u.id) ? 'userMap' : (u.email && paymentsByEmail.has(u.email) ? 'paymentsByEmail' : 'paymentsByPhone') });
    }
  });

  // Diagnostics after enrichment
  const afterMissing = { package: 0, expiry: 0, gender: 0 };
  usersToInsert.forEach(u => { if (!u.package_id) afterMissing.package++; if (!u.membership_expiry) afterMissing.expiry++; if (!u.gender) afterMissing.gender++; });

  // Staff parsing
  const staffToInsert: any[] = [];
  const staffTables = ['admins','trainers','staff','Admins','Trainers','Staff'];
  staffTables.forEach(t => {
    const blocks = extractInsertBlocks(fileContent, t);
    blocks.forEach(block => {
      const cols = block.columns;
      block.rows.forEach(r => {
        const vals = splitRowValues(r);
        const obj = rowToObject(cols, vals);

        const idxId = findColumn(cols, ['id','staff_id','uuid']);
        const idxEmail = findColumn(cols, ['email','staff_email']);
        const idxFirst = findColumn(cols, ['first_name','firstname','given_name']);
        const idxLast = findColumn(cols, ['last_name','lastname','surname']);

        const sId = idxId >= 0 ? (obj ? obj[cols[idxId]] : vals[idxId]) : null;
        const sEmail = idxEmail >= 0 ? (obj ? obj[cols[idxEmail]] : vals[idxEmail]) : null;

        if (!sId && !sEmail) return;
        const first = idxFirst >= 0 ? (obj ? obj[cols[idxFirst]] : vals[idxFirst]) : null;
        const last  = idxLast >= 0 ? (obj ? obj[cols[idxLast]] : vals[idxLast]) : null;

        staffToInsert.push({
          id: sId ?? undefined,
          first_name: first ?? 'Staff',
          last_name: last ?? '',
          email: sEmail ?? null,
          phone: obj?.phone ?? null,
          role_name: t.replace(/s$/i,'').toLowerCase(),
          gym_id: targetGymId,
          qr_code: JSON.stringify({ staffId: sId ?? null, roleName: t.replace(/s$/i,'').toLowerCase(), gymId: targetGymId }),
          hire_date: new Date().toISOString().split('T')[0],
        });
      });
    });
  });

  // dedupe users by email
  const emailSet = new Set<string>();
  const dedupedUsers: any[] = [];
  usersToInsert.forEach(u => {
    if (u.email && emailSet.has(u.email)) return;
    if (u.email) emailSet.add(u.email);
    dedupedUsers.push(u);
  });

  const uniqueTables = Array.from(new Set(
    [...fileContent.matchAll(/INSERT INTO\s+[`"']?([A-Za-z_][A-Za-z0-9_]*)/gi)].map(m => m[1])
  ));

  return {
    usersToInsert: dedupedUsers,
    staffToInsert,
    skippedPayments,
    skippedRows,
    warnings,
    detectedTables: uniqueTables,
    diagnostics: {
      userMapSize: userMap.size,
      paymentsByEmail: paymentsByEmail.size,
      paymentsByPhone: paymentsByPhone.size,
      beforeMissing,
      afterMissing,
      enrichedSamples: enrichedSamples.slice(0, 20)
    }
  };
};

/** -------------------------
 * SQL generation helpers
 * --------------------------*/

// detect uuid-like strings
const isUuidLike = (s: any) => {
  if (!s || typeof s !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
};

/**
 * genUpsertSql: supports raw SQL expressions via { __raw: "..." } values
 */
const genUpsertSql = (table: string, rows: any[], conflictCols: string[]) => {
  if (!rows || rows.length === 0) return '';
  const validRows = rows.filter(r => (r.id && String(r.id).trim() !== '') || (r.email && String(r.email).trim() !== '') || Object.keys(r).length > 0);
  if (validRows.length === 0) return '';
  const cols = Array.from(new Set(validRows.flatMap(r => Object.keys(r))));
  const valueToSql = (val: any) => {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'object' && val.__raw) return val.__raw;
    if (typeof val === 'boolean') return val ? 'true' : 'false';
    if (typeof val === 'number') return String(val);
    return `'${String(val).replace(/'/g, "''")}'`;
  };
  const lines = validRows.map(r => `(${cols.map(c => valueToSql(r[c])).join(', ')})`);
  const insertHeader = `INSERT INTO ${table} (${cols.join(', ')}) VALUES\n${lines.join(',\n')}`;
  const updates = cols.filter(c => !conflictCols.includes(c)).map(c => `${c} = EXCLUDED.${c}`).join(', ');
  const conflict = `ON CONFLICT (${conflictCols.join(', ')}) DO UPDATE SET ${updates};`;
  return `${insertHeader}\n${conflict}`;
};

/** -------------------------
 * generateMigrationSql: creates packages + users + staff SQL
 * --------------------------*/
export const generateMigrationSql = (fileContent: string, targetGymId: string) => {
  const plan = buildMigrationPlan(fileContent, targetGymId);

  // --- Extract legacy Packages table rows (if present) ---
  const legacyPackageBlocks = extractInsertBlocks(fileContent, 'Packages').concat(extractInsertBlocks(fileContent, 'packages'));
  const legacyPkgById = new Map<string, any>();

  legacyPackageBlocks.forEach(block => {
    const cols = block.columns;
    block.rows.forEach(row => {
      const vals = splitRowValues(row);
      const obj = rowToObject(cols, vals);

      // dynamic column detection for legacy package table
      const idxId = findColumn(cols, ['id','package_id','pkg_id']);
      const idxName = findColumn(cols, ['name','title','package_name']);
      const idxPrice = findColumn(cols, ['price','amount','cost']);
      const idxDuration = findColumn(cols, ['duration','duration_value','length','days']);
      const idxPasses = findColumn(cols, ['numberOfPasses','number_of_passes','passes','number_of_passes']);
      const idxAccess = findColumn(cols, ['accessLevel','access_level']);
      const idxRequiresTrainer = findColumn(cols, ['requiresTrainer','requires_trainer','requires_trainer_flag']);
      const idxDescription = findColumn(cols, ['description','desc','benefits']);
      const idxCreatedAt = findColumn(cols, ['createdAt','created_at','created']);
      const idxIsActive = findColumn(cols, ['isActive','active','archived','is_active']);

      const legacyId = idxId >= 0 ? (obj ? obj[cols[idxId]] : vals[idxId]) : (obj?.id ?? null);
      if (!legacyId) return;

      const legacyIdStr = String(legacyId);

      const name = idxName >= 0 ? (obj ? obj[cols[idxName]] : vals[idxName]) : (obj?.name ?? legacyIdStr);
      const priceRaw = idxPrice >= 0 ? (obj ? obj[cols[idxPrice]] : vals[idxPrice]) : (obj?.price ?? null);
      const durationRaw = idxDuration >= 0 ? (obj ? obj[cols[idxDuration]] : vals[idxDuration]) : (obj?.duration ?? null);
      const passesRaw = idxPasses >= 0 ? (obj ? obj[cols[idxPasses]] : vals[idxPasses]) : (obj?.numberOfPasses ?? null);
      const accessRaw = idxAccess >= 0 ? (obj ? obj[cols[idxAccess]] : vals[idxAccess]) : (obj?.accessLevel ?? null);
      const reqTrainerRaw = idxRequiresTrainer >= 0 ? (obj ? obj[cols[idxRequiresTrainer]] : vals[idxRequiresTrainer]) : (obj?.requiresTrainer ?? null);
      const descRaw = idxDescription >= 0 ? (obj ? obj[cols[idxDescription]] : vals[idxDescription]) : (obj?.description ?? null);
      const createdAtRaw = idxCreatedAt >= 0 ? (obj ? obj[cols[idxCreatedAt]] : vals[idxCreatedAt]) : (obj?.createdAt ?? null);
      const activeRaw = idxIsActive >= 0 ? (obj ? obj[cols[idxIsActive]] : vals[idxIsActive]) : (obj?.isActive ?? null);

      const price = priceRaw !== null && priceRaw !== undefined ? Number(priceRaw) : null;
      const duration_value = durationRaw !== null && durationRaw !== undefined ? Number(durationRaw) : null;
      const number_of_passes = passesRaw !== null && passesRaw !== undefined ? Number(passesRaw) : 0;
      const requires_trainer = (reqTrainerRaw === 1 || reqTrainerRaw === '1' || reqTrainerRaw === true);
      const description = descRaw ?? '';
      const created_at = createdAtRaw ? String(createdAtRaw) : new Date().toISOString();
      // archived flag: if legacy 'isActive' exists, archived = !isActive
      const archived = (activeRaw === 0 || activeRaw === '0' || activeRaw === false) ? true : false;

      legacyPkgById.set(legacyIdStr, {
        legacyId: legacyIdStr,
        name: String(name ?? legacyIdStr).slice(0, 200),
        price: price !== null && !isNaN(price) ? price : 0,
        duration_value: duration_value && !isNaN(duration_value) ? Math.max(1, Math.floor(duration_value)) : 30,
        duration_unit: 'days', // legacy dump used numeric durations: treat as days
        number_of_passes: Number.isFinite(number_of_passes) ? number_of_passes : 0,
        requires_trainer: !!requires_trainer,
        description: String(description ?? '').slice(0, 2000),
        created_at,
        archived,
        gym_id: targetGymId,
        access_level: accessRaw ?? 'off_peak_hours'
      });
    });
  });

  // --- Collect distinct package identifiers referenced by users ---
  const uniquePkgs = Array.from(new Set(plan.usersToInsert.map((u: any) => u.package_id).filter(Boolean)));

  // --- Build packagesRows using legacy details when available ---
  const packagesRows = uniquePkgs.map((pkgId: string) => {
    const pk = pkgId ? String(pkgId) : '';
    const legacy = legacyPkgById.get(pk);
    if (legacy) {
      // if legacyId looks like UUID, include id in insert so new packages.id matches legacy one
      const row: any = {
        name: legacy.name,
        price: legacy.price,
        duration_value: legacy.duration_value,
        duration_unit: legacy.duration_unit,
        access_level: legacy.access_level,
        number_of_passes: legacy.number_of_passes,
        requires_trainer: legacy.requires_trainer,
        description: legacy.description,
        created_at: legacy.created_at,
        archived: legacy.archived,
        gym_id: legacy.gym_id
      };
      // preserve id when legacyId is uuid-like
      if (isUuidLike(pk)) row.id = pk;
      return row;
    }

    // if no legacy metadata, fall back (use the package identifier as name)
    const name = String(pk).slice(0,200);
    return {
      name,
      price: 0,
      duration_value: 30,
      duration_unit: 'days',
      access_level: 'off_peak_hours',
      number_of_passes: 0,
      requires_trainer: false,
      description: `Migrated package (${name})`,
      created_at: new Date().toISOString(),
      archived: false,
      gym_id: targetGymId
    };
  });

  const packagesSql = genUpsertSql('packages', packagesRows, ['name']);

  // --- Prepare users so package_id references real packages ---
  const usersPrepared = plan.usersToInsert.map((u: any) => {
    const clone: any = { ...u };
    if (clone.package_id && typeof clone.package_id === 'string') {
      const pkgKey = String(clone.package_id);
      // If legacy package metadata exists and it included an explicit id (uuid), use that uuid as literal
      if (legacyPkgById.has(pkgKey) && isUuidLike(pkgKey)) {
        // keep UUID string as-is (it will be quoted as literal)
        clone.package_id = pkgKey;
      } else if (legacyPkgById.has(pkgKey)) {
        // legacy exists but id wasn't uuid-like -> reference by name subquery
        const pkgNameEsc = String(legacyPkgById.get(pkgKey).name).replace(/'/g, "''");
        clone.package_id = { __raw: `(SELECT id FROM packages WHERE name = '${pkgNameEsc}' LIMIT 1)` };
      } else if (!isUuidLike(pkgKey)) {
        // not UUID and no legacy package found: create or reference by name (name = pkgKey)
        const pkgNameEsc = pkgKey.replace(/'/g, "''");
        clone.package_id = { __raw: `(SELECT id FROM packages WHERE name = '${pkgNameEsc}' LIMIT 1)` };
      } else {
        // looks like UUID but not found in legacy map — leave as literal UUID (assume correct)
        clone.package_id = pkgKey;
      }
    } else {
      clone.package_id = null;
    }
    return clone;
  });

  const usersSql = genUpsertSql('users', usersPrepared, ['email']);
  const staffSql = genUpsertSql('staff', plan.staffToInsert, ['email']);

  // Combine in order: packages first, then users & staff
  const migrationSqlParts = [
    `-- Migration generated by migrate-generate`,
    `BEGIN;`,
    packagesSql || '-- (no packages to create)',
    usersSql || '-- (no users to create)',
    staffSql || '-- (no staff to create)',
    `COMMIT;`
  ].filter(Boolean);

  const migrationSql = migrationSqlParts.join('\n\n');

  return {
    migrationSql,
    preview: {
      usersInserted: plan.usersToInsert.length,
      staffInserted: plan.staffToInsert.length,
      packagesCreated: packagesRows.length,
      skippedPayments: plan.skippedPayments,
      skippedRows: plan.skippedRows,
      warnings: plan.warnings,
      detectedTables: plan.detectedTables
    }
  };
};


/** Export a small preview helper (used by your preview function) */
export const generatePreview = (fileContent: string, targetGymId: string) => {
  const plan = buildMigrationPlan(fileContent, targetGymId);
  return {
    usersInserted: plan.usersToInsert.length,
    staffInserted: plan.staffToInsert.length,
    skippedPayments: plan.skippedPayments,
    skippedRows: plan.skippedRows,
    warnings: plan.warnings,
    detectedTables: plan.detectedTables,
    diagnostics: plan.diagnostics ?? null
  };
};

/** -------------------------
 * executeMigration: runs the plan against Supabase (creates packages & roles)
 * --------------------------*/
export const executeMigration = async (
  fileContent: string,
  targetGymId: string,
  supabaseClient: any,
  isDryRun: boolean = true,
  onProgress?: (percent: number) => void
) => {
  const supabase = supabaseClient;
  const plan = buildMigrationPlan(fileContent, targetGymId);

  if (isDryRun) return { preview: generateMigrationSql(fileContent, targetGymId).preview };

  // Resolve packages in DB
  const legacyPackages = new Map<string, string>();
  const uniquePkgs = Array.from(new Set(plan.usersToInsert.map(u => u.package_id).filter(Boolean)));

  if (uniquePkgs.length) {
    const { data: foundPackages } = await supabase.from('packages').select('id, name').in('name', uniquePkgs);
    (foundPackages || []).forEach((p: any) => legacyPackages.set(p.name, p.id));
  }

  // create missing packages with sensible defaults and track diagnostics
  let packagesCreated = 0;
  for (const lp of uniquePkgs) {
    if (!legacyPackages.has(lp)) {
      const name = String(lp).slice(0,200);
      const createPayload = {
        name,
        price: 0,
        duration_value: 30,
        duration_unit: 'days',
        access_level: 'off_peak_hours',
        number_of_passes: 0,
        requires_trainer: false,
        description: `Migrated package (${name})`,
        gym_id: targetGymId
      };
      const { data: newPkg, error } = await supabase.from('packages').insert(createPayload).select('id').single();
      if (error) {
        console.warn('failed to create package', name, error);
      } else {
        legacyPackages.set(lp, newPkg.id);
        packagesCreated++;
      }
    }
  }

  // Map package ids onto usersToInsert
  plan.usersToInsert.forEach(u => {
    if (u.package_id && legacyPackages.has(u.package_id)) u.package_id = legacyPackages.get(u.package_id);
  });

  // Resolve roles
  const { data: existingRoles } = await supabase.from('roles').select('id, name');
  const roleMap: Record<string, string> = {};
  (existingRoles || []).forEach((r: any) => { roleMap[r.name.toLowerCase()] = r.id; });
  const missingRoles = Array.from(new Set(plan.staffToInsert.map(s => s.role_name).filter(Boolean).map((n: string) => n.toLowerCase()).filter((n: string) => !roleMap[n])));
  for (const rname of missingRoles) {
    const { data: newRole, error } = await supabase.from('roles').insert({ name: rname }).select('id').single();
    if (error) throw error;
    roleMap[rname] = newRole.id;
  }
  const staffToInsert = plan.staffToInsert.map(s => ({ ...s, role_id: s.role_name ? roleMap[s.role_name.toLowerCase()] ?? null : null }));

  // Upsert users & staff (chunked) with diagnostics
  const chunkSize = 200;
  let userUpsertBatches = 0;
  let userUpsertErrors: any[] = [];
  let usersAttempted = 0;
  for (let i = 0; i < plan.usersToInsert.length; i += chunkSize) {
    const batch = plan.usersToInsert.slice(i, i + chunkSize).map(u => {
      if (!u.created_at) u.created_at = new Date().toISOString();
      if (!u.id) delete u.id;
      return u;
    });
    usersAttempted += batch.length;
    userUpsertBatches++;
    const { data, error } = await supabase.from('users').upsert(batch, { onConflict: 'email' });
    if (error) {
      userUpsertErrors.push({ batch: userUpsertBatches, error: String(error) });
      // continue to next batch instead of throwing so we gather all errors
      console.error('users upsert error', error);
    }
    if (onProgress) onProgress(Math.round(((i + batch.length) / (plan.usersToInsert.length + staffToInsert.length)) * 100));
  }

  let staffUpsertBatches = 0;
  let staffUpsertErrors: any[] = [];
  let staffAttempted = 0;
  for (let i = 0; i < staffToInsert.length; i += chunkSize) {
    const batch = staffToInsert.slice(i, i + chunkSize).map(s => {
      if (!s.id) delete s.id;
      return s;
    });
    staffAttempted += batch.length;
    staffUpsertBatches++;
    const { data, error } = await supabase.from('staff').upsert(batch, { onConflict: 'email' });
    if (error) {
      staffUpsertErrors.push({ batch: staffUpsertBatches, error: String(error) });
      console.error('staff upsert error', error);
    }
  }

  if (onProgress) onProgress(100);
  // Final verification: count rows written for this gym
  let verifiedUserCount: number | null = null;
  let verifiedStaffCount: number | null = null;
  try {
    const usersCountResp = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('gym_id', targetGymId);
    verifiedUserCount = (usersCountResp as any).count ?? null;
  } catch (e) {
    console.warn('failed to fetch users count', e);
  }
  try {
    const staffCountResp = await supabase.from('staff').select('*', { count: 'exact', head: true }).eq('gym_id', targetGymId);
    verifiedStaffCount = (staffCountResp as any).count ?? null;
  } catch (e) {
    console.warn('failed to fetch staff count', e);
  }

  const runDiagnostics = {
    packagesCreated: typeof packagesCreated !== 'undefined' ? packagesCreated : 0,
    packageMapSize: legacyPackages.size,
    usersAttempted,
    userUpsertBatches,
    userUpsertErrors,
    staffAttempted,
    staffUpsertBatches,
    staffUpsertErrors,
    verifiedUserCount,
    verifiedStaffCount
  };

  return { usersInserted: plan.usersToInsert.length, staffInserted: staffToInsert.length, skippedPayments: plan.skippedPayments, preview: generateMigrationSql(fileContent, targetGymId).preview, runDiagnostics };
};
