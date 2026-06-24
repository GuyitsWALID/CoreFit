export type MigrationIssue = {
  table: string;
  row?: number;
  reason: string;
  value?: unknown;
};

export type LegacyMigrationPlan = {
  detectedTables: string[];
  packages: Record<string, any>[];
  users: Record<string, any>[];
  staff: Record<string, any>[];
  payments: Record<string, any>[];
  membershipFreezes: Record<string, any>[];
  clientCheckins: Record<string, any>[];
  trainerAssignments: Record<string, any>[];
  warnings: string[];
  issues: MigrationIssue[];
  sourceCounts: Record<string, number>;
};

export type MigrationRunResult = {
  dryRun: boolean;
  counts: Record<string, { planned: number; written: number; skipped: number }>;
  warnings: string[];
  issues: MigrationIssue[];
  issueCount: number;
  idMappings: { users: number; packages: number; staff: number };
};

type InsertBlock = {
  table: string;
  columns: string[];
  rows: unknown[][];
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const normalizeIdentifier = (value: string) =>
  value.replace(/^[`"']|[`"']$/g, '').replace(/[^a-z0-9]/gi, '').toLowerCase();

const normalizeEmail = (value: unknown) => {
  const email = String(value ?? '').trim().toLowerCase();
  return email && email.includes('@') ? email : null;
};

const normalizePhone = (value: unknown) => String(value ?? '').trim();

const normalizeGender = (value: unknown) => {
  const gender = String(value ?? '').trim().toLowerCase();
  if (['m', 'man', 'men', 'male'].includes(gender)) return 'male';
  if (['f', 'woman', 'women', 'female'].includes(gender)) return 'female';
  if (gender === 'other') return 'other';
  return null;
};

const toBoolean = (value: unknown, fallback = false) => {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'active', 'enabled'].includes(String(value).trim().toLowerCase());
};

const toNumber = (value: unknown, fallback = 0) => {
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
};

const cleanDate = (value: unknown, includeTime = false) => {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw || /^0{4}-0{2}-0{2}/.test(raw)) return null;
  const year = Number(raw.slice(0, 4));
  if (Number.isFinite(year) && (year < 1900 || year > 2200)) return null;
  const parsed = new Date(raw.includes('T') ? raw : raw.replace(' ', 'T') + (raw.length === 10 ? 'T00:00:00Z' : 'Z'));
  if (Number.isNaN(parsed.getTime())) return null;
  return includeTime ? parsed.toISOString() : parsed.toISOString().slice(0, 10);
};

const splitName = (value: unknown) => {
  const parts = String(value ?? '').trim().split(/\s+/).filter(Boolean);
  return {
    first_name: parts[0] || 'Member',
    last_name: parts.slice(1).join(' ') || '',
  };
};

const parseJsonText = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed || !/^[\[{]/.test(trimmed)) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    try {
      return JSON.parse(trimmed.replace(/\\"/g, '"'));
    } catch {
      return value;
    }
  }
};

const readSqlValue = (token: string): unknown => {
  const value = token.trim();
  if (/^null$/i.test(value)) return null;
  if (/^(true|false)$/i.test(value)) return value.toLowerCase() === 'true';
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
    const quote = value[0];
    let text = value.slice(1, -1);
    if (quote === "'") {
      text = text
        .replace(/''/g, "'")
        .replace(/\\'/g, "'")
        .replace(/\\\\/g, '\\')
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t');
    } else {
      text = text.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    }
    return text;
  }
  return value;
};

const splitSqlList = (content: string) => {
  const values: string[] = [];
  let buffer = '';
  let quote: "'" | '"' | null = null;
  let escaped = false;
  let depth = 0;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (escaped) {
      buffer += char;
      escaped = false;
      continue;
    }
    if (quote && char === '\\') {
      buffer += char;
      escaped = true;
      continue;
    }
    if (char === "'" || char === '"') {
      if (quote === char && content[i + 1] === char) {
        buffer += char + char;
        i++;
        continue;
      }
      if (!quote) quote = char;
      else if (quote === char) quote = null;
      buffer += char;
      continue;
    }
    if (!quote) {
      if (char === '(') depth++;
      if (char === ')') depth--;
      if (char === ',' && depth === 0) {
        values.push(buffer.trim());
        buffer = '';
        continue;
      }
    }
    buffer += char;
  }
  if (buffer.trim()) values.push(buffer.trim());
  return values;
};

export const parseSqlInsertBlocks = (sql: string): InsertBlock[] => {
  const blocks: InsertBlock[] = [];
  const prefix = /INSERT\s+INTO\s+(?:[`"']?[\w]+[`"']?\.)?[`"']?([A-Za-z_][A-Za-z0-9_]*)[`"']?\s*\(([^)]*)\)\s*VALUES\s*/gi;
  let match: RegExpExecArray | null;

  while ((match = prefix.exec(sql)) !== null) {
    const start = prefix.lastIndex;
    let quote: "'" | '"' | null = null;
    let escaped = false;
    let end = sql.length;
    for (let i = start; i < sql.length; i++) {
      const char = sql[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (quote && char === '\\') {
        escaped = true;
        continue;
      }
      if (char === "'" || char === '"') {
        if (quote === char && sql[i + 1] === char) {
          i++;
          continue;
        }
        if (!quote) quote = char;
        else if (quote === char) quote = null;
        continue;
      }
      if (char === ';' && !quote) {
        end = i;
        break;
      }
    }

    const columns = splitSqlList(match[2]).map(column => column.trim().replace(/[`"']/g, ''));
    const valuesSection = sql.slice(start, end);
    const rowTokens: string[] = [];
    let rowStart = -1;
    let depth = 0;
    quote = null;
    escaped = false;
    for (let i = 0; i < valuesSection.length; i++) {
      const char = valuesSection[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (quote && char === '\\') {
        escaped = true;
        continue;
      }
      if (char === "'" || char === '"') {
        if (quote === char && valuesSection[i + 1] === char) {
          i++;
          continue;
        }
        if (!quote) quote = char;
        else if (quote === char) quote = null;
        continue;
      }
      if (!quote && char === '(') {
        if (depth === 0) rowStart = i + 1;
        depth++;
      } else if (!quote && char === ')') {
        depth--;
        if (depth === 0 && rowStart >= 0) {
          rowTokens.push(valuesSection.slice(rowStart, i));
          rowStart = -1;
        }
      }
    }

    blocks.push({
      table: match[1],
      columns,
      rows: rowTokens.map(row => splitSqlList(row).map(readSqlValue)),
    });
    prefix.lastIndex = end + 1;
  }
  return blocks;
};

const rowsByTable = (contents: string[]) => {
  const result = new Map<string, Record<string, unknown>[]>();
  for (const content of contents) {
    for (const block of parseSqlInsertBlocks(content)) {
      const table = normalizeIdentifier(block.table);
      const target = result.get(table) ?? [];
      for (const values of block.rows) {
        const row: Record<string, unknown> = {};
        block.columns.forEach((column, index) => {
          row[normalizeIdentifier(column)] = values[index] ?? null;
        });
        target.push(row);
      }
      result.set(table, target);
    }
  }
  return result;
};

const get = (row: Record<string, unknown>, ...names: string[]) => {
  for (const name of names) {
    const value = row[normalizeIdentifier(name)];
    if (value !== undefined) return value;
  }
  return null;
};

const dedupe = (rows: Record<string, any>[], keys: string[]) => {
  const seen = new Set<string>();
  return rows.filter(row => {
    const key = keys.map(field => String(row[field] ?? '')).join('|');
    if (!key.replace(/\|/g, '')) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const buildLegacyMigrationPlan = (contents: string[], gymId: string): LegacyMigrationPlan => {
  const source = rowsByTable(contents);
  const issues: MigrationIssue[] = [];
  const warnings: string[] = [];
  const sourceCounts = Object.fromEntries([...source.entries()].map(([table, rows]) => [table, rows.length]));

  const legacyPayments = source.get('payments') ?? source.get('payment') ?? [];
  const latestPaymentByUser = new Map<string, Record<string, unknown>>();
  for (const payment of legacyPayments) {
    const userId = String(get(payment, 'userId', 'user_id') ?? '');
    if (!userId) continue;
    const current = latestPaymentByUser.get(userId);
    const currentDate = cleanDate(get(current ?? {}, 'expiryDate', 'expiry_date'), true) ?? '';
    const nextDate = cleanDate(get(payment, 'expiryDate', 'expiry_date'), true) ?? '';
    const status = String(get(payment, 'paymentstatus', 'payment_status', 'status') ?? '').toLowerCase();
    if (!['completed', 'paid', 'success', 'active'].some(value => status.includes(value))) continue;
    if (!current || nextDate >= currentDate) latestPaymentByUser.set(userId, payment);
  }

  const packages = (source.get('packages') ?? []).map((row, index) => {
    const legacyId = String(get(row, 'id', 'packageId') ?? '');
    const name = String(get(row, 'name', 'title', 'planTitle') ?? '').trim();
    if (!legacyId || !UUID_RE.test(legacyId) || !name) {
      issues.push({ table: 'Packages', row: index + 1, reason: 'Package requires a UUID id and name', value: legacyId || name });
      return null;
    }
    const access = String(get(row, 'accessLevel', 'access_level') ?? 'full').toLowerCase();
    const accessLevel = access.includes('off') ? 'off_peak_hours' : access.includes('peak') ? 'peak_hours' : 'all_hours';
    return {
      id: legacyId,
      name: name.slice(0, 255),
      price: Math.max(0, toNumber(get(row, 'price', 'amount'))),
      duration_value: Math.max(1, Math.trunc(toNumber(get(row, 'duration', 'duration_value'), 30))),
      duration_unit: 'days',
      access_level: accessLevel,
      number_of_passes: Math.max(0, Math.trunc(toNumber(get(row, 'numberOfPasses', 'number_of_passes')))),
      requires_trainer: toBoolean(get(row, 'requiresTrainer', 'requires_trainer')),
      description: String(get(row, 'description') ?? ''),
      created_at: cleanDate(get(row, 'createdAt', 'created_at'), true) ?? new Date().toISOString(),
      archived: !toBoolean(get(row, 'isActive', 'is_active'), true),
      gym_id: gymId,
    };
  }).filter(Boolean) as Record<string, any>[];

  const packageIds = new Set(packages.map(row => row.id));
  for (const payment of legacyPayments) {
    const productId = String(get(payment, 'productId', 'package_id', 'planId') ?? '');
    const planTitle = String(get(payment, 'planTitle', 'package_name', 'plan_name') ?? '').trim();
    if (productId && UUID_RE.test(productId) && !packageIds.has(productId) && planTitle) {
      packages.push({
        id: productId,
        name: planTitle.slice(0, 255),
        price: Math.max(0, toNumber(get(payment, 'amount'))),
        duration_value: 30,
        duration_unit: 'days',
        access_level: 'all_hours',
        number_of_passes: Math.max(0, Math.trunc(toNumber(get(payment, 'totalPasses', 'number_of_passes')))),
        requires_trainer: false,
        description: 'Recovered from legacy payment history',
        created_at: cleanDate(get(payment, 'createdAt', 'paymentDate'), true) ?? new Date().toISOString(),
        archived: false,
        gym_id: gymId,
      });
      packageIds.add(productId);
    }
  }

  const legacyUsers = source.get('users') ?? source.get('members') ?? source.get('clients') ?? [];
  const users = legacyUsers.map((row, index) => {
    const legacyId = String(get(row, 'id', 'userId') ?? '');
    const email = normalizeEmail(get(row, 'email'));
    if (!legacyId || !UUID_RE.test(legacyId) || !email) {
      issues.push({ table: 'Users', row: index + 1, reason: 'Member requires a UUID id and valid email', value: { id: legacyId, email } });
      return null;
    }
    const name = splitName(get(row, 'fullName', 'full_name', 'name'));
    const latest = latestPaymentByUser.get(legacyId);
    const packageId = String(get(latest ?? {}, 'productId', 'package_id') ?? '');
    const expiry = cleanDate(get(latest ?? {}, 'expiryDate', 'expiry_date'), true);
    const active = toBoolean(get(row, 'isActive', 'is_active'), true);
    const goals = parseJsonText(get(row, 'fitnessGoals', 'fitness_goal'));
    return {
      id: legacyId,
      ...name,
      email,
      phone: normalizePhone(get(row, 'phone', 'mobile')),
      gender: normalizeGender(get(latest ?? {}, 'gender', 'sex')),
      date_of_birth: cleanDate(get(row, 'dateOfBirth', 'date_of_birth', 'dob')),
      emergency_name: String(get(row, 'emergencyContactName', 'emergency_name') ?? ''),
      emergency_phone: normalizePhone(get(row, 'emergencyContactPhone', 'emergency_phone')),
      relationship: String(get(row, 'emergencyContactRelationship', 'relationship') ?? ''),
      fitness_goal: Array.isArray(goals) ? goals.join(', ') : String(goals ?? ''),
      package_id: packageId && UUID_RE.test(packageId) ? packageId : null,
      membership_expiry: expiry,
      status: !active ? 'inactive' : expiry && new Date(expiry) < new Date() ? 'expired' : 'active',
      qr_code_data: String(get(latest ?? {}, 'qrCodeData', 'qr_code_data') ?? JSON.stringify({ userId: legacyId, gymId })),
      created_at: cleanDate(get(row, 'createdAt', 'created_at'), true) ?? new Date().toISOString(),
      gym_id: gymId,
    };
  }).filter(Boolean) as Record<string, any>[];

  const userIds = new Set(users.map(row => row.id));
  const payments = legacyPayments.map((row, index) => {
    const id = String(get(row, 'id') ?? '');
    const userId = String(get(row, 'userId', 'user_id') ?? '');
    if (!id || !UUID_RE.test(id) || !userId || !UUID_RE.test(userId)) {
      issues.push({ table: 'Payments', row: index + 1, reason: 'Payment requires UUID id and userId', value: { id, userId } });
      return null;
    }
    if (!userIds.has(userId)) {
      issues.push({ table: 'Payments', row: index + 1, reason: 'Payment references a member absent from the uploaded Users export', value: userId });
      return null;
    }
    const packageId = String(get(row, 'productId', 'package_id') ?? '');
    const remarks = {
      legacy_plan_title: get(row, 'planTitle', 'plan_name'),
      legacy_currency: get(row, 'currency'),
      legacy_gender: get(row, 'gender'),
      legacy_expiry_date: cleanDate(get(row, 'expiryDate'), true),
      legacy_total_passes: toNumber(get(row, 'totalPasses')),
    };
    return {
      id,
      user_id: userId,
      package_id: packageId && packageIds.has(packageId) ? packageId : null,
      gym_id: gymId,
      amount: Math.max(0, toNumber(get(row, 'amount', 'price'))),
      payment_method: String(get(row, 'paymentMethod', 'payment_method') ?? 'legacy'),
      payment_status: String(get(row, 'paymentstatus', 'payment_status', 'status') ?? 'completed').toLowerCase(),
      transaction_id: String(get(row, 'txRef', 'transaction_id') ?? '') || null,
      remarks: JSON.stringify(remarks),
      created_at: cleanDate(get(row, 'paymentDate', 'createdAt'), true) ?? new Date().toISOString(),
      updated_at: cleanDate(get(row, 'updatedAt', 'paymentDate'), true) ?? new Date().toISOString(),
      migrated_from_legacy: true,
    };
  }).filter(Boolean) as Record<string, any>[];

  const membershipFreezes = legacyPayments.map((row, index) => {
    if (!toBoolean(get(row, 'isFrozen', 'is_frozen'))) return null;
    const userId = String(get(row, 'userId', 'user_id') ?? '');
    const startDate = cleanDate(get(row, 'freezeStartDate', 'freeze_start_date'));
    const endDate = cleanDate(get(row, 'freezeEndDate', 'freeze_end_date'));
    if (!userIds.has(userId) || !startDate || !endDate) {
      issues.push({ table: 'Payments', row: index + 1, reason: 'Frozen membership has incomplete dates or unknown member', value: userId });
      return null;
    }
    const totalDays = Math.max(1, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000));
    return {
      id: String(get(row, 'id')),
      user_id: userId,
      start_date: startDate,
      end_date: endDate,
      total_days: totalDays,
      applied: true,
      created_at: cleanDate(get(row, 'updatedAt', 'createdAt'), true) ?? new Date().toISOString(),
      gym_id: gymId,
    };
  }).filter(Boolean) as Record<string, any>[];

  const legacyAdmins = source.get('admins') ?? source.get('staff') ?? [];
  const legacyTrainers = source.get('trainers') ?? [];
  const staffSource = [
    ...legacyAdmins.map(row => ({ row, sourceTable: 'Admins', roleName: String(get(row, 'role') ?? 'admin').toLowerCase() })),
    ...legacyTrainers.map(row => ({ row, sourceTable: 'Trainers', roleName: 'trainer' })),
  ];
  const staff = staffSource.map(({ row, sourceTable, roleName }, index) => {
    const id = String(get(row, 'id') ?? '');
    const email = normalizeEmail(get(row, 'email'));
    if (!id || !UUID_RE.test(id) || !email) {
      issues.push({ table: sourceTable, row: index + 1, reason: 'Staff requires UUID id and valid email', value: { id, email } });
      return null;
    }
    const name = splitName(get(row, 'name', 'fullName', 'full_name'));
    return {
      id,
      first_name: String(get(row, 'firstName', 'first_name') ?? name.first_name),
      last_name: String(get(row, 'lastName', 'last_name') ?? name.last_name),
      email,
      phone: normalizePhone(get(row, 'phone')),
      is_active: toBoolean(get(row, 'isActive', 'is_active'), true),
      hire_date: cleanDate(get(row, 'createdAt', 'hire_date')) ?? new Date().toISOString().slice(0, 10),
      salary: 0,
      created_at: cleanDate(get(row, 'createdAt'), true) ?? new Date().toISOString(),
      updated_at: cleanDate(get(row, 'updatedAt'), true) ?? new Date().toISOString(),
      gym_id: gymId,
      role_name: roleName,
    };
  }).filter(Boolean) as Record<string, any>[];

  const staffIds = new Set(staff.map(row => row.id));
  const trainerAssignments = legacyUsers.map((row, index) => {
    const userId = String(get(row, 'id', 'userId') ?? '');
    const trainerId = String(get(row, 'trainerId', 'trainer_id') ?? '');
    if (!trainerId) return null;
    if (!userIds.has(userId) || !staffIds.has(trainerId)) {
      issues.push({ table: 'Users', row: index + 1, reason: 'Trainer assignment references an unknown member or trainer', value: { userId, trainerId } });
      return null;
    }
    return {
      id: userId,
      user_id: userId,
      trainer_id: trainerId,
      assigned_at: cleanDate(get(row, 'updatedAt', 'createdAt'), true) ?? new Date().toISOString(),
      ended_at: null,
      gym_id: gymId,
    };
  }).filter(Boolean) as Record<string, any>[];

  const packageNameById = new Map(packages.map(row => [row.id, row.name]));
  const memberPackageById = new Map(users.map(row => [row.id, row.package_id ? packageNameById.get(row.package_id) : null]));
  const legacyCheckins = source.get('checkins') ?? source.get('clientcheckins') ?? [];
  const clientCheckins = legacyCheckins.map((row, index) => {
    const id = String(get(row, 'id') ?? '');
    const userId = String(get(row, 'userId', 'user_id') ?? '');
    const checkinTime = cleanDate(get(row, 'checkInTime', 'checkin_time', 'createdAt'), true);
    if (!id || !UUID_RE.test(id) || !userIds.has(userId) || !checkinTime) {
      issues.push({ table: 'CheckIns', row: index + 1, reason: 'Check-in requires UUID id, known member, and valid timestamp', value: { id, userId } });
      return null;
    }
    return {
      id,
      user_id: userId,
      checkin_time: checkinTime,
      checkin_date: checkinTime.slice(0, 10),
      'QR-CODE USED': String(get(row, 'verificationMethod') ?? '').toLowerCase().includes('qr'),
      package_type_at_checkin: memberPackageById.get(userId) ?? null,
      gym_id: gymId,
    };
  }).filter(Boolean) as Record<string, any>[];

  if (!legacyUsers.length) warnings.push('No Users table was found. Payments and check-ins without uploaded members are quarantined.');
  if (!source.get('packages')?.length) warnings.push('No Packages table was found. Packages recoverable from payments were created with safe defaults.');

  return {
    detectedTables: [...source.keys()],
    packages: dedupe(packages, ['id']),
    users: dedupe(users, ['id']),
    staff: dedupe(staff, ['id']),
    payments: dedupe(payments, ['id']),
    membershipFreezes: dedupe(membershipFreezes, ['user_id', 'start_date', 'end_date']),
    clientCheckins: dedupe(clientCheckins, ['id']),
    trainerAssignments: dedupe(trainerAssignments, ['user_id', 'trainer_id']),
    warnings,
    issues,
    sourceCounts,
  };
};

const TARGET_COLUMNS: Record<string, string[]> = {
  packages: ['id', 'name', 'price', 'duration_value', 'duration_unit', 'access_level', 'number_of_passes', 'requires_trainer', 'description', 'created_at', 'archived', 'gym_id'],
  users: ['id', 'first_name', 'last_name', 'email', 'phone', 'gender', 'date_of_birth', 'emergency_name', 'emergency_phone', 'relationship', 'fitness_goal', 'package_id', 'membership_expiry', 'status', 'qr_code_data', 'created_at', 'gym_id'],
  staff: ['id', 'first_name', 'last_name', 'email', 'phone', 'is_active', 'hire_date', 'salary', 'created_at', 'updated_at', 'gym_id', 'role_id'],
  payments: ['id', 'user_id', 'package_id', 'gym_id', 'amount', 'payment_method', 'payment_status', 'transaction_id', 'remarks', 'created_at', 'updated_at', 'migrated_from_legacy'],
  membership_freezes: ['id', 'user_id', 'start_date', 'end_date', 'created_at', 'total_days', 'applied', 'gym_id'],
  client_checkins: ['id', 'user_id', 'checkin_time', 'checkin_date', 'QR-CODE USED', 'package_type_at_checkin', 'gym_id'],
  trainer_assignments: ['id', 'user_id', 'trainer_id', 'assigned_at', 'ended_at', 'gym_id'],
};

const chunks = <T>(rows: T[], size = 250) => {
  const result: T[][] = [];
  for (let index = 0; index < rows.length; index += size) result.push(rows.slice(index, index + size));
  return result;
};

const resolveMappedId = (mapping: Map<string, string>, id: string) => {
  let current = id;
  const visited = new Set<string>();
  while (mapping.has(current) && !visited.has(current)) {
    visited.add(current);
    current = mapping.get(current)!;
  }
  return current;
};

const preflightSchema = async (supabase: any) => {
  const errors: string[] = [];
  for (const [table, columns] of Object.entries(TARGET_COLUMNS)) {
    const selection = columns
      .map(column => /^[A-Za-z_][A-Za-z0-9_]*$/.test(column) ? column : `"${column.replace(/"/g, '""')}"`)
      .join(',');
    const { error } = await supabase.from(table).select(selection).limit(1);
    if (error) errors.push(`${table}: ${error.message}`);
  }
  if (errors.length) throw new Error(`Target schema is not migration-ready:\n${errors.join('\n')}`);
};

const findExistingBy = async (supabase: any, table: string, field: string, values: string[]) => {
  const found: Record<string, string> = {};
  for (const batch of chunks([...new Set(values.filter(Boolean))], 150)) {
    const { data, error } = await supabase.from(table).select(`id,${field}`).in(field, batch);
    if (error) throw new Error(`Could not inspect ${table}.${field}: ${error.message}`);
    for (const row of data ?? []) found[String(row[field]).toLowerCase()] = row.id;
  }
  return found;
};

const writeRows = async (
  supabase: any,
  table: string,
  rows: Record<string, any>[],
  issues: MigrationIssue[],
  onProgress?: (message: string, percent: number) => void,
  progressStart = 0,
  progressEnd = 100,
) => {
  let written = 0;
  let skipped = 0;
  const batches = chunks(rows);
  for (let index = 0; index < batches.length; index++) {
    const batch = batches[index];
    const { error } = await supabase.from(table).upsert(batch, { onConflict: 'id' });
    if (!error) {
      written += batch.length;
    } else {
      for (const row of batch) {
        const { error: rowError } = await supabase.from(table).upsert(row, { onConflict: 'id' });
        if (rowError) {
          skipped++;
          issues.push({ table, reason: rowError.message, value: row.id ?? row.email ?? null });
        } else {
          written++;
        }
      }
    }
    const ratio = batches.length ? (index + 1) / batches.length : 1;
    onProgress?.(`Migrating ${table}`, Math.round(progressStart + (progressEnd - progressStart) * ratio));
  }
  return { written, skipped };
};

export const executeLegacyMigrationPlan = async (
  plan: LegacyMigrationPlan,
  supabase: any,
  dryRun = true,
  onProgress?: (message: string, percent: number) => void,
): Promise<MigrationRunResult> => {
  onProgress?.('Validating target database schema', 2);
  await preflightSchema(supabase);

  const issues = [...plan.issues];
  const counts: MigrationRunResult['counts'] = {};
  const planned: Record<string, Record<string, any>[]> = {
    packages: plan.packages,
    users: plan.users,
    staff: plan.staff,
    payments: plan.payments,
    membership_freezes: plan.membershipFreezes,
    client_checkins: plan.clientCheckins,
    trainer_assignments: plan.trainerAssignments ?? [],
  };
  for (const [table, rows] of Object.entries(planned)) counts[table] = { planned: rows.length, written: 0, skipped: 0 };
  if (dryRun) return { dryRun: true, counts, warnings: plan.warnings, issues: issues.slice(0, 500), issueCount: issues.length, idMappings: { users: 0, packages: 0, staff: 0 } };

  const packageByName = await findExistingBy(supabase, 'packages', 'name', plan.packages.map(row => row.name));
  const packageMap = new Map<string, string>();
  const sourcePackageByName = new Map<string, string>();
  const packages = plan.packages.flatMap(row => {
    const normalizedName = String(row.name).toLowerCase();
    const sourceId = sourcePackageByName.get(normalizedName);
    if (sourceId && sourceId !== row.id) {
      packageMap.set(row.id, sourceId);
      issues.push({ table: 'packages', reason: 'Duplicate package name merged into one package', value: row.name });
      return [];
    }
    sourcePackageByName.set(normalizedName, row.id);
    const existingId = packageByName[normalizedName];
    if (existingId && existingId !== row.id) {
      packageMap.set(row.id, existingId);
      return [];
    }
    return [row];
  });

  const userByEmail = await findExistingBy(supabase, 'users', 'email', plan.users.map(row => row.email));
  const userMap = new Map<string, string>();
  const sourceUserByEmail = new Map<string, string>();
  const users = plan.users.flatMap(row => {
    const normalizedEmail = String(row.email).toLowerCase();
    const sourceId = sourceUserByEmail.get(normalizedEmail);
    if (sourceId && sourceId !== row.id) {
      userMap.set(row.id, sourceId);
      issues.push({ table: 'users', reason: 'Duplicate member email merged into one member', value: row.email });
      return [];
    }
    sourceUserByEmail.set(normalizedEmail, row.id);
    const existingId = userByEmail[normalizedEmail];
    if (existingId && existingId !== row.id) userMap.set(row.id, existingId);
    return [{
      ...row,
      id: existingId ?? row.id,
      package_id: row.package_id ? resolveMappedId(packageMap, row.package_id) : null,
    }];
  });

  const staffByEmail = await findExistingBy(supabase, 'staff', 'email', plan.staff.map(row => row.email));
  const staffMap = new Map<string, string>();
  const sourceStaffByEmail = new Map<string, string>();
  const roles = [...new Set(plan.staff.map(row => row.role_name).filter(Boolean))];
  const roleByName = await findExistingBy(supabase, 'roles', 'name', roles);
  for (const roleName of roles) {
    if (!roleByName[roleName]) {
      const { data, error } = await supabase.from('roles').insert({ name: roleName }).select('id').single();
      if (error) throw new Error(`Could not create role ${roleName}: ${error.message}`);
      roleByName[roleName] = data.id;
    }
  }
  const staff = plan.staff.flatMap(row => {
    const normalizedEmail = String(row.email).toLowerCase();
    const sourceId = sourceStaffByEmail.get(normalizedEmail);
    if (sourceId && sourceId !== row.id) {
      staffMap.set(row.id, sourceId);
      issues.push({ table: 'staff', reason: 'Duplicate staff email merged into one staff account', value: row.email });
      return [];
    }
    sourceStaffByEmail.set(normalizedEmail, row.id);
    const existingId = staffByEmail[normalizedEmail];
    if (existingId && existingId !== row.id) staffMap.set(row.id, existingId);
    const { role_name, ...record } = row;
    return [{ ...record, id: existingId ?? row.id, role_id: roleByName[role_name] ?? null }];
  });

  const payments = plan.payments.map(row => ({
    ...row,
    user_id: resolveMappedId(userMap, row.user_id),
    package_id: row.package_id ? resolveMappedId(packageMap, row.package_id) : null,
  }));
  const freezes = plan.membershipFreezes.map(row => ({ ...row, user_id: resolveMappedId(userMap, row.user_id) }));
  const checkins = plan.clientCheckins.map(row => ({ ...row, user_id: resolveMappedId(userMap, row.user_id) }));
  const assignments = (plan.trainerAssignments ?? []).map(row => ({
    ...row,
    user_id: resolveMappedId(userMap, row.user_id),
    trainer_id: resolveMappedId(staffMap, row.trainer_id),
  }));

  const stages: Array<[string, Record<string, any>[], number, number]> = [
    ['packages', packages, 5, 15],
    ['users', users, 15, 35],
    ['staff', staff, 35, 45],
    ['payments', payments, 45, 65],
    ['membership_freezes', freezes, 65, 75],
    ['trainer_assignments', assignments, 75, 82],
    ['client_checkins', checkins, 82, 100],
  ];
  for (const [table, rows, start, end] of stages) {
    const result = await writeRows(supabase, table, rows, issues, onProgress, start, end);
    counts[table].written = result.written;
    counts[table].skipped = result.skipped;
  }

  return {
    dryRun: false,
    counts,
    warnings: plan.warnings,
    issues: issues.slice(0, 500),
    issueCount: issues.length,
    idMappings: { users: userMap.size, packages: packageMap.size, staff: staffMap.size },
  };
};
