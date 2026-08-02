BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '5min';

CREATE TABLE IF NOT EXISTS public.agent_coordination_tasks (
  task_id text PRIMARY KEY,
  user_id text NOT NULL,
  cluster_id text NOT NULL DEFAULT 'default',
  run_id text,
  session_id text,
  agent_id text NOT NULL,
  role text NOT NULL CHECK (role IN ('coordinator', 'planner', 'executor', 'verifier', 'compensator', 'observer')),
  risk_class text NOT NULL CHECK (risk_class IN ('low', 'medium', 'high', 'critical')),
  priority text NOT NULL CHECK (priority IN ('background', 'normal', 'urgent', 'critical')),
  state text NOT NULL CHECK (state IN (
    'admitted', 'queued', 'running', 'blocked', 'awaiting_approval',
    'compensating', 'completed', 'failed', 'cancelled', 'fenced'
  )),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  epoch integer NOT NULL DEFAULT 1 CHECK (epoch > 0),
  round integer NOT NULL DEFAULT 0 CHECK (round >= 0),
  max_rounds integer NOT NULL CHECK (max_rounds BETWEEN 1 AND 32),
  policy_version text NOT NULL,
  idempotency_key text NOT NULL,
  resource_keys jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(resource_keys) = 'array'),
  compensation_required boolean NOT NULL DEFAULT false,
  deadlock_detected boolean NOT NULL DEFAULT false,
  conflict_count integer NOT NULL DEFAULT 0 CHECK (conflict_count >= 0),
  stale_command_count integer NOT NULL DEFAULT 0 CHECK (stale_command_count >= 0),
  lease_loss_count integer NOT NULL DEFAULT 0 CHECK (lease_loss_count >= 0),
  compensation_count integer NOT NULL DEFAULT 0 CHECK (compensation_count >= 0),
  deadline_at timestamptz,
  event_sequence integer NOT NULL DEFAULT 0 CHECK (event_sequence >= 0),
  last_heartbeat_at timestamptz NOT NULL DEFAULT now(),
  last_event_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.agent_coordination_snapshots (
  task_id text PRIMARY KEY REFERENCES public.agent_coordination_tasks(task_id) ON DELETE CASCADE,
  user_id text NOT NULL,
  event_sequence integer NOT NULL CHECK (event_sequence >= 0),
  version integer NOT NULL CHECK (version > 0),
  epoch integer NOT NULL CHECK (epoch > 0),
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agent_coordination_claims (
  task_id text NOT NULL REFERENCES public.agent_coordination_tasks(task_id) ON DELETE CASCADE,
  user_id text NOT NULL,
  resource_key text NOT NULL,
  agent_id text NOT NULL,
  role text NOT NULL CHECK (role IN ('coordinator', 'planner', 'executor', 'verifier', 'compensator', 'observer')),
  lease_expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, resource_key),
  UNIQUE (user_id, resource_key)
);

CREATE TABLE IF NOT EXISTS public.agent_coordination_waits (
  task_id text NOT NULL REFERENCES public.agent_coordination_tasks(task_id) ON DELETE CASCADE,
  blocked_on_task_id text NOT NULL REFERENCES public.agent_coordination_tasks(task_id) ON DELETE CASCADE,
  resource_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, blocked_on_task_id, resource_key),
  CHECK (task_id <> blocked_on_task_id)
);

CREATE TABLE IF NOT EXISTS public.agent_coordination_events (
  task_id text NOT NULL REFERENCES public.agent_coordination_tasks(task_id) ON DELETE CASCADE,
  sequence integer NOT NULL CHECK (sequence > 0),
  event_type text NOT NULL CHECK (event_type IN (
    'admitted', 'queued', 'transitioned', 'heartbeat', 'fenced',
    'compensating', 'released', 'deadlock_detected', 'lease_expired'
  )),
  state text NOT NULL CHECK (state IN (
    'admitted', 'queued', 'running', 'blocked', 'awaiting_approval',
    'compensating', 'completed', 'failed', 'cancelled', 'fenced'
  )),
  epoch integer NOT NULL CHECK (epoch > 0),
  version integer NOT NULL CHECK (version > 0),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, sequence)
);

CREATE TABLE IF NOT EXISTS public.agent_coordination_commands (
  task_id text NOT NULL REFERENCES public.agent_coordination_tasks(task_id) ON DELETE CASCADE,
  command_key text NOT NULL,
  command_type text NOT NULL CHECK (command_type IN ('transition', 'heartbeat')),
  response jsonb NOT NULL CHECK (jsonb_typeof(response) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, command_key)
);

ALTER TABLE public.agent_coordination_tasks
  ADD COLUMN IF NOT EXISTS cluster_id text NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS conflict_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stale_command_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lease_loss_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS compensation_count integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS agent_coordination_tasks_user_updated_idx
  ON public.agent_coordination_tasks(user_id, updated_at DESC, task_id DESC);
CREATE INDEX IF NOT EXISTS agent_coordination_tasks_cluster_active_idx
  ON public.agent_coordination_tasks(user_id, cluster_id, agent_id, state)
  WHERE state IN ('admitted', 'queued', 'running', 'blocked', 'awaiting_approval', 'compensating');
CREATE INDEX IF NOT EXISTS agent_coordination_snapshots_user_updated_idx
  ON public.agent_coordination_snapshots(user_id, updated_at DESC, task_id DESC);
CREATE INDEX IF NOT EXISTS agent_coordination_claims_lease_idx
  ON public.agent_coordination_claims(user_id, lease_expires_at);
CREATE INDEX IF NOT EXISTS agent_coordination_waits_blocked_idx
  ON public.agent_coordination_waits(blocked_on_task_id, created_at);
CREATE INDEX IF NOT EXISTS agent_coordination_events_task_sequence_idx
  ON public.agent_coordination_events(task_id, sequence DESC);
CREATE INDEX IF NOT EXISTS agent_coordination_commands_created_idx
  ON public.agent_coordination_commands(created_at DESC);

ALTER TABLE public.agent_coordination_events
  DROP CONSTRAINT IF EXISTS agent_coordination_events_event_type_check;
ALTER TABLE public.agent_coordination_events
  ADD CONSTRAINT agent_coordination_events_event_type_check CHECK (event_type IN (
    'admitted', 'queued', 'transitioned', 'heartbeat', 'fenced',
    'compensating', 'released', 'deadlock_detected', 'lease_expired'
  ));

COMMIT;
