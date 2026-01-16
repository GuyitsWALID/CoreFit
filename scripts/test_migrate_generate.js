(async () => {
  const url = 'https://nwfgrjpyzhoahezqeloz.functions.supabase.co/migrate-generate';
  const payload = {
    sql: "INSERT INTO users (id, email, full_name) VALUES ('u1', NULL, 'Alice Jones'),('u2', 'bob@example.com', 'Bob Smith');",
    gymId: 'test-gym'
  };

  try {
    // Read anon key from local .env (for testing only)
    const fs = await import('fs');
    const env = fs.readFileSync('.env', 'utf8');
    const anon = (env.match(/^VITE_SUPABASE_ANON_KEY=(.+)$/m) || [])[1];
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'authorization': `Bearer ${anon}` }, body: JSON.stringify(payload) });
    console.log('status', res.status);
    const text = await res.text();
    try { console.log('json:', JSON.parse(text)); } catch (e) { console.log('body:', text); }
  } catch (err) {
    console.error('request failed', err);
  }
})();