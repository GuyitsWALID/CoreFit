$ErrorActionPreference = 'Stop'

$envFile = Get-Content -Path .env -Raw
if ($envFile -match '(?m)^\s*SUPABASE_ACCESS_TOKEN\s*=\s*(.+)$') { $token = $Matches[1].Trim() } else { $token = '' }
if ($envFile -match '(?m)^\s*VITE_SUPABASE_URL\s*=\s*(.+)$') { $supabaseUrl = $Matches[1].Trim() } else { $supabaseUrl = '' }
if ($envFile -match '(?m)^\s*HOTKEY_CODE\s*=\s*(.+)$') { $hotkeyCode = $Matches[1].Trim() } else { $hotkeyCode = '' }

if (-not $token -or -not $supabaseUrl -or -not $hotkeyCode) {
  throw 'Missing SUPABASE_ACCESS_TOKEN, VITE_SUPABASE_URL, or HOTKEY_CODE in .env'
}

$projectRef = ($supabaseUrl -replace 'https?://([^.]*)\..*', '$1')
$env:SUPABASE_ACCESS_TOKEN = $token

npx supabase secrets set "HOTKEY_CODE=$hotkeyCode" --project-ref $projectRef
if ($LASTEXITCODE -ne 0) { throw 'Could not configure HOTKEY_CODE.' }

npx supabase functions deploy verify-admin-hotkey --project-ref $projectRef --no-verify-jwt
if ($LASTEXITCODE -ne 0) { throw 'Could not deploy verify-admin-hotkey.' }
