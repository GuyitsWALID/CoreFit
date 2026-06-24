import fs from 'node:fs';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const [fullName, email] = process.argv.slice(2);
if (!fullName || !email) {
  throw new Error('Usage: node scripts/create_super_admin.mjs "Full Name" email@example.com');
}

const envText = fs.readFileSync('.env', 'utf8');
const readEnv = (name) => {
  const match = envText.match(new RegExp(`^\\s*${name}\\s*=\\s*(.+)$`, 'm'));
  return match?.[1]?.trim() ?? '';
};

const supabaseUrl = readEnv('VITE_SUPABASE_URL');
const serviceRoleKey = readEnv('SUPABASE_SERVICE_ROLE_KEY');
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in .env');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
const password = Array.from(crypto.randomBytes(20), byte => alphabet[byte % alphabet.length]).join('');
const parts = fullName.trim().split(/\s+/);
const firstName = parts.shift() || 'Company';
const lastName = parts.join(' ') || 'Admin';

let userId;
const { data: created, error: createError } = await supabase.auth.admin.createUser({
  email: email.trim().toLowerCase(),
  password,
  email_confirm: true,
  user_metadata: { full_name: fullName, account_type: 'super_admin' },
  app_metadata: { role: 'super_admin', account_type: 'super_admin' },
});

if (createError) {
  if (!/already|registered|exists/i.test(createError.message)) throw createError;
  let page = 1;
  while (!userId) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    userId = data.users.find(user => user.email?.toLowerCase() === email.trim().toLowerCase())?.id;
    if (userId || data.users.length < 1000) break;
    page++;
  }
  if (!userId) throw new Error('The Auth account exists but could not be located.');
  const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, account_type: 'super_admin' },
    app_metadata: { role: 'super_admin', account_type: 'super_admin' },
  });
  if (updateError) throw updateError;
} else {
  userId = created.user.id;
}

let { data: role, error: roleLookupError } = await supabase
  .from('roles')
  .select('id')
  .eq('name', 'super_admin')
  .maybeSingle();
if (roleLookupError) throw roleLookupError;

if (!role) {
  const { data, error } = await supabase
    .from('roles')
    .insert({ name: 'super_admin', description: 'Company-wide system administrator' })
    .select('id')
    .single();
  if (error) throw error;
  role = data;
}

const normalizedEmail = email.trim().toLowerCase();
const { data: existingStaff, error: staffLookupError } = await supabase
  .from('staff')
  .select('id')
  .eq('email', normalizedEmail)
  .maybeSingle();
if (staffLookupError) throw staffLookupError;

const staffPayload = {
  first_name: firstName,
  last_name: lastName,
  full_name: fullName,
  email: normalizedEmail,
  role_id: role.id,
  is_active: true,
  hire_date: new Date().toISOString().slice(0, 10),
  salary: 0,
  gym_id: null,
  updated_at: new Date().toISOString(),
};

if (existingStaff) {
  const { error } = await supabase.from('staff').update(staffPayload).eq('id', existingStaff.id);
  if (error) throw error;
} else {
  const { error } = await supabase.from('staff').insert({
    id: userId,
    ...staffPayload,
    phone: null,
    created_at: new Date().toISOString(),
  });
  if (error) throw error;
}

const { data: verified, error: verifyError } = await supabase
  .from('staff')
  .select('id,email,is_active,roles!inner(name)')
  .eq('email', normalizedEmail)
  .eq('is_active', true)
  .single();
if (verifyError) throw verifyError;

const verifiedRole = Array.isArray(verified.roles) ? verified.roles[0]?.name : verified.roles?.name;
if (verifiedRole !== 'super_admin') throw new Error('Role verification failed.');

console.log(JSON.stringify({
  success: true,
  name: fullName,
  email: normalizedEmail,
  password,
  auth_user_id: userId,
  role: verifiedRole,
}, null, 2));
