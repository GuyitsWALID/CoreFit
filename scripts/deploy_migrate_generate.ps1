# Reads local .env and deploys migrate-generate via supabase CLI
$envFile = Get-Content -Path .env -Raw
if ($envFile -match 'SUPABASE_ACCESS_TOKEN=(.+)') { $SUP_TOKEN = $Matches[1].Trim() } else { $SUP_TOKEN = '' }
if ($envFile -match 'SUPABASE_SERVICE_ROLE_KEY=(.+)') { $SUP_ROLE = $Matches[1].Trim() } else { $SUP_ROLE = '' }
if ($envFile -match 'VITE_SUPABASE_URL=(.+)') { $SUP_URL = $Matches[1].Trim() } else { $SUP_URL = '' }
if (-not $SUP_TOKEN -or -not $SUP_ROLE -or -not $SUP_URL) {
    Write-Error 'Missing one of SUPABASE_ACCESS_TOKEN, SUPABASE_SERVICE_ROLE_KEY, or VITE_SUPABASE_URL in .env'
    exit 1
}
$PROJECT_REF = ($SUP_URL -replace 'https?://([^.]*)\..*','$1')
Write-Host "Using project ref: $PROJECT_REF"
$env:SUPABASE_ACCESS_TOKEN = $SUP_TOKEN
Write-Host 'Setting SUPABASE_SERVICE_ROLE_KEY project secret...'
npx supabase secrets set "SUPABASE_SERVICE_ROLE_KEY=$SUP_ROLE" --project-ref $PROJECT_REF --yes
Write-Host 'Deploying migrate-generate function...'
npx supabase functions deploy migrate-generate --project-ref $PROJECT_REF
Write-Host 'Listing functions...'
npx supabase functions list --project-ref $PROJECT_REF
