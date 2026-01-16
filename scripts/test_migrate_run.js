(async () => {
  const url = 'https://nwfgrjpyzhoahezqeloz.functions.supabase.co/migrate-run';
  const fs = await import('fs');
  const env = fs.readFileSync('.env','utf8');
  const anon = (env.match(/^VITE_SUPABASE_ANON_KEY=(.+)$/m) || [])[1];
  const payload = {
    sql: "INSERT INTO users (id, email, full_name) VALUES ('tt1', 'test1@example.com', 'Test One');",
    gymId: 'test-gym',
    dryRun: true
  };

  try {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'authorization': `Bearer ${anon}` }, body: JSON.stringify(payload) });
    console.log('status', res.status);
    const text = await res.text();
    console.log('body:', text.slice(0,1000));
  } catch (err) {
    console.error('request failed', err);
  }
})();