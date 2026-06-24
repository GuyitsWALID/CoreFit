import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const email = process.argv[2]?.trim().toLowerCase();
if (!email) throw new Error('Usage: node scripts/repair_super_admin_metadata.mjs email@example.com');

const envText = fs.readFileSync('.env', 'utf8');
const readEnv = name => envText.match(new RegExp(`^\\s*${name}\\s*=\\s*(.+)$`, 'm'))?.[1]?.trim() ?? '';
const supabase = createClient(readEnv('VITE_SUPABASE_URL'), readEnv('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { autoRefreshToken: false, persistSession: false },
});

let authUser;
for (let page = 1; !authUser; page++) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  authUser = data.users.find(user => user.email?.toLowerCase() === email);
  if (authUser || data.users.length < 1000) break;
}
if (!authUser) throw new Error(`Auth user not found: ${email}`);

const { error } = await supabase.auth.admin.updateUserById(authUser.id, {
  app_metadata: {
    ...authUser.app_metadata,
    role: 'super_admin',
    account_type: 'super_admin',
  },
});
if (error) throw error;

console.log(JSON.stringify({ success: true, email, user_id: authUser.id, role: 'super_admin' }));
