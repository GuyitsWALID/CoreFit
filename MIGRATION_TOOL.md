# Automatic legacy migration

The Super Admin migration page is available at `/admin/import`.

## Supported legacy SQL tables

- `Users`
- `Packages`
- `Payments`
- `CheckIns`
- `Admins`

Upload one complete phpMyAdmin SQL dump or select several separate table exports together. The tool parses and validates them, reconciles duplicate IDs/emails/package names, and runs a background migration in dependency order.

Malformed dates, missing users, invalid UUIDs, and orphaned relationships are quarantined instead of terminating the whole migration. Re-running the same export is safe because stable legacy IDs are upserted.

## Deployment

Before first use, rotate any exposed credentials and update `.env`, then run:

```powershell
npm run deploy:migration
```

This applies `supabase/migrations/003_create_migration_jobs.sql`, configures the server-only service-role secret, and deploys the migration Edge Functions.

Only an authenticated active staff account with the `super_admin` role can preview or run migrations. Super admins are redirected to `/admin/gyms` after signing in.
