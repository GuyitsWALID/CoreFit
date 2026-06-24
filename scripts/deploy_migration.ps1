$ErrorActionPreference = 'Stop'

$envFile = Get-Content -Path .env -Raw
if ($envFile -match 'SUPABASE_ACCESS_TOKEN=(.+)') { $token = $Matches[1].Trim() } else { $token = '' }
if ($envFile -match 'SUPABASE_SERVICE_ROLE_KEY=(.+)') { $serviceRole = $Matches[1].Trim() } else { $serviceRole = '' }
if ($envFile -match 'VITE_SUPABASE_URL=(.+)') { $supabaseUrl = $Matches[1].Trim() } else { $supabaseUrl = '' }

if (-not $token -or -not $serviceRole -or -not $supabaseUrl) {
  throw 'Missing SUPABASE_ACCESS_TOKEN, SUPABASE_SERVICE_ROLE_KEY, or VITE_SUPABASE_URL in .env'
}

$projectRef = ($supabaseUrl -replace 'https?://([^.]*)\..*', '$1')
$env:SUPABASE_ACCESS_TOKEN = $token

Write-Host "Linking Supabase project $projectRef..."
npx supabase link --project-ref $projectRef

Write-Host 'Repairing legacy migration history (the existing gyms table predates local migration tracking)...'
npx supabase migration repair 001 --status applied
if ($LASTEXITCODE -ne 0) { throw 'Could not repair migration 001 history.' }

Write-Host 'Applying remaining idempotent database migrations...'
npx supabase db push --yes
if ($LASTEXITCODE -ne 0) { throw 'Could not apply database migrations.' }

Write-Host 'Deploying automatic migration functions...'
npx supabase functions deploy migrate-ping migrate-preview migrate-generate migrate-run --project-ref $projectRef
if ($LASTEXITCODE -ne 0) { throw 'Could not deploy migration Edge Functions.' }

Write-Host 'Automatic migration deployment complete.'
