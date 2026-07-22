-- Durable image generation worker leases. Migration 018 capability data remains untouched.
BEGIN;

CREATE TABLE IF NOT EXISTS public.generation_image_worker_leases (
  lease_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL UNIQUE REFERENCES public.generation_job_items(item_id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.generation_jobs(job_id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'leased', 'polling', 'completed', 'failed', 'cancelled', 'timed_out')),
  worker_id text,
  lease_token uuid,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  failure_count integer NOT NULL DEFAULT 0 CHECK (failure_count >= 0),
  lease_expires_at timestamptz,
  heartbeat_at timestamptz,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  cancel_requested_at timestamptz,
  last_error_code text,
  last_error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS generation_image_worker_claim_idx
  ON public.generation_image_worker_leases(status, next_attempt_at, lease_expires_at);
CREATE INDEX IF NOT EXISTS generation_image_worker_job_idx
  ON public.generation_image_worker_leases(job_id, status);

COMMIT;
