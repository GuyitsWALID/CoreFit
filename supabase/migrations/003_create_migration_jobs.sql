CREATE TABLE IF NOT EXISTS public.migration_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  requested_by uuid,
  file_names text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'completed', 'completed_with_issues', 'failed')),
  progress integer NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  current_step text,
  preview jsonb,
  result jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS migration_jobs_gym_created_idx
  ON public.migration_jobs (gym_id, created_at DESC);

ALTER TABLE public.migration_jobs ENABLE ROW LEVEL SECURITY;

-- Migration jobs contain uploaded legacy-data diagnostics and are intentionally
-- service-role only. Admins access them through the authenticated Edge Function.
