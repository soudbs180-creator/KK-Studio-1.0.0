const { getPool } = require('../db');
const {
  canPreempt,
  canRoleTransition,
  canTransition,
  detectCoordinationDeadlock,
  isActiveState,
  isAdmissionRoleAllowed,
  isTerminalState,
  resolveCoordinationPolicy,
} = require('./policy');

function toIso(value) {
  if (!value) return undefined;
  return value instanceof Date ? value.toISOString() : String(value);
}

function resolveClusterId(env = process.env) {
  const configured = String(env.KK_AGENT_COORDINATION_CLUSTER_ID || '').trim();
  return (configured || 'default').slice(0, 100);
}

function mapClaim(row) {
  return {
    resourceKey: row.resource_key,
    agentId: row.agent_id,
    role: row.role,
    leaseExpiresAt: toIso(row.lease_expires_at),
  };
}

function mapTask(row, claims) {
  return {
    taskId: row.task_id,
    ownerId: row.user_id,
    clusterId: row.cluster_id || 'default',
    runId: row.run_id || undefined,
    sessionId: row.session_id || undefined,
    agentId: row.agent_id,
    role: row.role,
    riskClass: row.risk_class,
    priority: row.priority,
    state: row.state,
    version: Number(row.version),
    epoch: Number(row.epoch),
    round: Number(row.round),
    maxRounds: Number(row.max_rounds),
    policyVersion: row.policy_version,
    resourceClaims: claims.map(mapClaim),
    compensationRequired: row.compensation_required === true,
    deadlockDetected: row.deadlock_detected === true,
    conflictCount: Number(row.conflict_count || 0),
    staleCommandCount: Number(row.stale_command_count || 0),
    leaseLossCount: Number(row.lease_loss_count || 0),
    compensationCount: Number(row.compensation_count || 0),
    deadlineAt: toIso(row.deadline_at),
    lastEventAt: toIso(row.last_event_at),
    updatedAt: toIso(row.updated_at),
  };
}

async function readClaims(client, ownerId, taskId) {
  const result = await client.query(
    `SELECT resource_key, agent_id, role, lease_expires_at
       FROM public.agent_coordination_claims
      WHERE user_id = $1 AND task_id = $2
      ORDER BY resource_key ASC`,
    [ownerId, taskId],
  );
  return result.rows;
}

async function readTask(client, ownerId, taskId, lock = false) {
  const suffix = lock ? ' FOR UPDATE' : '';
  const result = await client.query(
    `SELECT * FROM public.agent_coordination_tasks
      WHERE user_id = $1 AND task_id = $2${suffix}`,
    [ownerId, taskId],
  );
  return result.rows[0] || null;
}

async function readSnapshot(client, ownerId, taskId) {
  const task = await readTask(client, ownerId, taskId);
  if (!task) return null;
  return mapTask(task, await readClaims(client, ownerId, taskId));
}

async function persistSnapshot(client, ownerId, taskId) {
  const task = await readTask(client, ownerId, taskId);
  if (!task) return;
  const snapshot = mapTask(task, await readClaims(client, ownerId, taskId));
  await client.query(
    `INSERT INTO public.agent_coordination_snapshots AS current_snapshot
      (task_id, user_id, event_sequence, version, epoch, snapshot)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)
     ON CONFLICT (task_id) DO UPDATE
       SET user_id = EXCLUDED.user_id,
           event_sequence = EXCLUDED.event_sequence,
           version = EXCLUDED.version,
           epoch = EXCLUDED.epoch,
           snapshot = EXCLUDED.snapshot,
           updated_at = now()
      WHERE current_snapshot.version <= EXCLUDED.version`,
    [taskId, ownerId, Number(task.event_sequence), Number(task.version), Number(task.epoch), JSON.stringify(snapshot)],
  );
}

async function appendEvent(client, task, eventType, reason) {
  const sequence = Number(task.event_sequence) + 1;
  await client.query(
    `INSERT INTO public.agent_coordination_events
      (task_id, sequence, event_type, state, epoch, version, reason)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [task.task_id, sequence, eventType, task.state, task.epoch, task.version, reason || null],
  );
  await client.query(
    `UPDATE public.agent_coordination_tasks
        SET event_sequence = $2, last_event_at = now(), updated_at = now()
      WHERE task_id = $1`,
    [task.task_id, sequence],
  );
  task.event_sequence = sequence;
  await persistSnapshot(client, task.user_id, task.task_id);
}

function normalizeResourceKeys(resourceKeys) {
  return [...new Set((resourceKeys || []).map((key) => String(key).trim()).filter(Boolean))].sort();
}

async function countAdmissionUsage(client, ownerId, clusterId) {
  const result = await client.query(
    `SELECT
       count(*) FILTER (WHERE state IN ('admitted', 'queued', 'running', 'blocked', 'awaiting_approval', 'compensating'))::integer AS active_tasks,
       count(DISTINCT agent_id) FILTER (WHERE state IN ('admitted', 'queued', 'running', 'blocked', 'awaiting_approval', 'compensating'))::integer AS active_agents
     FROM public.agent_coordination_tasks
    WHERE user_id = $1 AND cluster_id = $2`,
    [ownerId, clusterId],
  );
  return {
    activeTasks: Number(result.rows[0]?.active_tasks || 0),
    activeAgents: Number(result.rows[0]?.active_agents || 0),
  };
}

async function markExpiredTasks(client, ownerId, clusterId, policy) {
  const result = await client.query(
    `SELECT DISTINCT task.*
       FROM public.agent_coordination_tasks AS task
       JOIN public.agent_coordination_claims AS claim ON claim.task_id = task.task_id
      WHERE task.user_id = $1
        AND task.cluster_id = $2
        AND task.state IN ('admitted', 'running', 'awaiting_approval', 'compensating')
        AND claim.lease_expires_at <= now()
      FOR UPDATE OF task`,
    [ownerId, clusterId],
  );
  for (const task of result.rows) {
    await fenceExpiredTask(client, task, policy);
  }
}

async function findConflicts(client, ownerId, resourceKeys) {
  if (resourceKeys.length === 0) return [];
  const result = await client.query(
    `SELECT c.resource_key, c.task_id, c.agent_id, c.role, c.lease_expires_at,
            t.user_id,
            t.state, t.priority, t.risk_class, t.deadline_at,
            t.version, t.epoch, t.event_sequence, t.compensation_count,
            t.lease_loss_count, t.deadlock_detected
       FROM public.agent_coordination_claims AS c
       JOIN public.agent_coordination_tasks AS t ON t.task_id = c.task_id
      WHERE c.user_id = $1
        AND c.resource_key = ANY($2::text[])
        AND c.lease_expires_at > now()
        AND t.state NOT IN ('completed', 'failed', 'cancelled', 'fenced')
      FOR UPDATE OF c, t`,
    [ownerId, resourceKeys],
  );
  return result.rows;
}

async function insertTask(client, ownerId, input, policy, state, resourceKeys) {
  const maxRounds = Math.min(input.maxRounds, policy.maxRounds[input.riskClass]);
  const clusterId = resolveClusterId();
  const result = await client.query(
    `INSERT INTO public.agent_coordination_tasks
      (task_id, user_id, cluster_id, run_id, session_id, agent_id, role, risk_class, priority,
       state, max_rounds, policy_version, idempotency_key, resource_keys, deadline_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15)
     RETURNING *`,
    [
      input.taskId, ownerId, clusterId, input.runId || null, input.sessionId || null,
      input.agentId, input.role, input.riskClass, input.priority, state,
      maxRounds, policy.version, input.idempotencyKey, JSON.stringify(resourceKeys),
      input.deadlineAt || null,
    ],
  );
  return result.rows[0];
}

async function claimResources(client, ownerId, task, input, resourceKeys, leaseSeconds) {
  if (resourceKeys.length === 0) return;
  const agentId = input.agentId || input.agent_id || task.agent_id;
  const role = input.role || task.role;
  await client.query(
    `INSERT INTO public.agent_coordination_claims
      (task_id, user_id, resource_key, agent_id, role, lease_expires_at)
     SELECT $1, $2, resource_key, $3, $4, now() + ($5 * interval '1 second')
       FROM unnest($6::text[]) AS resource_key`,
    [task.task_id, ownerId, agentId, role, leaseSeconds, resourceKeys],
  );
}

async function fenceIncumbent(client, incumbent) {
  await client.query(
    `UPDATE public.agent_coordination_tasks
        SET state = 'fenced', version = version + 1, epoch = epoch + 1,
            compensation_required = true, compensation_count = compensation_count + 1,
            updated_at = now()
      WHERE task_id = $1`,
    [incumbent.task_id],
  );
  incumbent.state = 'fenced';
  incumbent.version = Number(incumbent.version) + 1;
  incumbent.epoch = Number(incumbent.epoch) + 1;
  incumbent.compensation_required = true;
  incumbent.compensation_count = Number(incumbent.compensation_count || 0) + 1;
  await releaseTaskClaims(client, incumbent.task_id, incumbent.user_id);
  await appendEvent(client, incumbent, 'fenced', 'preempted_by_higher_priority_task');
}

async function writeWaits(client, taskId, conflicts) {
  for (const conflict of conflicts) {
    await client.query(
      `INSERT INTO public.agent_coordination_waits
        (task_id, blocked_on_task_id, resource_key)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [taskId, conflict.task_id, conflict.resource_key],
    );
  }
}

async function hasDeadlock(client, ownerId) {
  const result = await client.query(
    `SELECT wait.task_id, wait.blocked_on_task_id
       FROM public.agent_coordination_waits AS wait
       JOIN public.agent_coordination_tasks AS task ON task.task_id = wait.task_id
      WHERE task.user_id = $1`,
    [ownerId],
  );
  return detectCoordinationDeadlock(result.rows.map((row) => ({
    taskId: row.task_id,
    blockedOnTaskId: row.blocked_on_task_id,
  })));
}

async function requeueReadyTasks(client, ownerId) {
  const result = await client.query(
    `SELECT task.*
       FROM public.agent_coordination_tasks AS task
      WHERE task.user_id = $1
        AND task.state = 'blocked'
        AND NOT EXISTS (
          SELECT 1
            FROM public.agent_coordination_waits AS wait
            JOIN public.agent_coordination_tasks AS blocker
              ON blocker.task_id = wait.blocked_on_task_id
           WHERE wait.task_id = task.task_id
             AND blocker.state NOT IN ('completed', 'failed', 'cancelled', 'fenced')
        )
      FOR UPDATE OF task`,
    [ownerId],
  );
  for (const task of result.rows) {
    await client.query(
      `UPDATE public.agent_coordination_tasks
          SET state = 'queued', version = version + 1, epoch = epoch + 1, updated_at = now()
        WHERE task_id = $1`,
      [task.task_id],
    );
    task.state = 'queued';
    task.version = Number(task.version) + 1;
    task.epoch = Number(task.epoch) + 1;
    await appendEvent(client, task, 'queued', 'resource_conflicts_released');
  }
}

async function releaseTaskClaims(client, taskId, ownerId) {
  await client.query('DELETE FROM public.agent_coordination_claims WHERE task_id = $1', [taskId]);
  await client.query(
    'DELETE FROM public.agent_coordination_waits WHERE task_id = $1 OR blocked_on_task_id = $1',
    [taskId],
  );
  if (ownerId) await requeueReadyTasks(client, ownerId);
}

async function fenceExpiredTask(client, task, policy) {
  await client.query(
    `UPDATE public.agent_coordination_tasks
        SET state = 'fenced', version = version + 1, epoch = epoch + 1,
            compensation_required = true, lease_loss_count = lease_loss_count + 1,
            compensation_count = compensation_count + 1, updated_at = now()
      WHERE task_id = $1`,
    [task.task_id],
  );
  task.state = 'fenced';
  task.version = Number(task.version) + 1;
  task.epoch = Number(task.epoch) + 1;
  task.compensation_required = true;
  task.lease_loss_count = Number(task.lease_loss_count || 0) + 1;
  task.compensation_count = Number(task.compensation_count || 0) + 1;
  await releaseTaskClaims(client, task.task_id, task.user_id);
  await appendEvent(client, task, 'lease_expired', `lease_expired_after_${policy.leaseSeconds}s`);
}

async function begin(pool) {
  const client = await pool.connect();
  await client.query('BEGIN');
  return client;
}

async function rollback(client) {
  try {
    await client.query('ROLLBACK');
  } catch {
    // Preserve the original database error.
  }
}

/** Atomically admits a task and claims every resource or records a blocked task. */
async function admitAgentTask(ownerId, input, { pool = getPool() } = {}) {
  const policy = resolveCoordinationPolicy();
  const resourceKeys = normalizeResourceKeys(input.resourceKeys);
  const clusterId = resolveClusterId();
  if (!isAdmissionRoleAllowed(input.role, policy)) {
    return { accepted: false, reason: 'role_not_allowed' };
  }
  if (resourceKeys.length > policy.maxResourceKeys) {
    return { accepted: false, reason: 'resource_limit_reached' };
  }
  const client = await begin(pool);
  try {
    const existingResult = await client.query(
      `SELECT * FROM public.agent_coordination_tasks
        WHERE user_id = $1 AND idempotency_key = $2
        FOR UPDATE`,
      [ownerId, input.idempotencyKey],
    );
    if (existingResult.rows[0]) {
      const snapshot = await readSnapshot(client, ownerId, existingResult.rows[0].task_id);
      await client.query('COMMIT');
      return { accepted: !['blocked', 'fenced'].includes(snapshot.state), data: snapshot };
    }

    await markExpiredTasks(client, ownerId, clusterId, policy);
    const conflicts = await findConflicts(client, ownerId, resourceKeys);
    const canPreemptAll = conflicts.length > 0
      && conflicts.every((conflict) => canPreempt(input, conflict, policy));
    const usage = await countAdmissionUsage(client, ownerId, clusterId);
    const isNewAgent = usage.activeAgents > 0
      && !(await client.query(
        `SELECT 1 FROM public.agent_coordination_tasks
          WHERE user_id = $1 AND cluster_id = $2 AND agent_id = $3
          AND state IN ('admitted', 'queued', 'running', 'blocked', 'awaiting_approval', 'compensating')
          LIMIT 1`,
        [ownerId, clusterId, input.agentId],
      )).rows[0];
    const activeTaskLimitReached = usage.activeTasks >= policy.maxActiveTasks && !canPreemptAll;
    const clusterAgentLimitReached = isNewAgent
      && usage.activeAgents >= policy.maxClusterAgents
      && !canPreemptAll;
    if (activeTaskLimitReached || clusterAgentLimitReached) {
      await client.query('COMMIT');
      return {
        accepted: false,
        reason: activeTaskLimitReached ? 'active_task_limit' : 'cluster_agent_limit',
      };
    }
    if (conflicts.length > 0 && !canPreemptAll) {
      const task = await insertTask(client, ownerId, input, policy, 'blocked', resourceKeys);
      await writeWaits(client, task.task_id, conflicts);
      const deadlock = await hasDeadlock(client, ownerId);
      task.conflict_count = conflicts.length;
      task.deadlock_detected = deadlock;
      task.compensation_required = deadlock;
      task.compensation_count = deadlock ? 1 : 0;
      task.version = deadlock ? Number(task.version) + 1 : Number(task.version);
      await client.query(
        `UPDATE public.agent_coordination_tasks
            SET conflict_count = conflict_count + $2,
                deadlock_detected = $3,
                compensation_required = compensation_required OR $3,
                compensation_count = compensation_count + CASE WHEN $3 THEN 1 ELSE 0 END,
                version = version + CASE WHEN $3 THEN 1 ELSE 0 END
          WHERE task_id = $1`,
        [task.task_id, conflicts.length, deadlock],
      );
      await appendEvent(client, task, deadlock ? 'deadlock_detected' : 'transitioned', deadlock ? 'wait_for_cycle_detected' : 'resource_conflict');
      const snapshot = await readSnapshot(client, ownerId, task.task_id);
      await client.query('COMMIT');
      return { accepted: false, reason: deadlock ? 'deadlock_detected' : 'resource_conflict', data: snapshot };
    }

    const incumbents = [...new Map(conflicts.map((conflict) => [conflict.task_id, conflict])).values()];
    for (const incumbent of incumbents) await fenceIncumbent(client, incumbent);
    const task = await insertTask(client, ownerId, input, policy, 'admitted', resourceKeys);
    await claimResources(client, ownerId, task, input, resourceKeys, policy.leaseSeconds);
    await appendEvent(client, task, 'admitted', canPreemptAll ? 'preempted_lower_priority_tasks' : undefined);
    const snapshot = await readSnapshot(client, ownerId, task.task_id);
    await client.query('COMMIT');
    return { accepted: true, data: snapshot };
  } catch (error) {
    await rollback(client);
    throw error;
  } finally {
    client.release();
  }
}

/** Reads an owner-scoped coordination snapshot without granting execution authority. */
async function getAgentCoordinationTask(ownerId, taskId, { pool = getPool() } = {}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const snapshot = await readSnapshot(client, ownerId, taskId);
    await client.query('COMMIT');
    return snapshot;
  } catch (error) {
    await rollback(client);
    throw error;
  } finally {
    client.release();
  }
}

async function readCommand(client, ownerId, taskId, commandKey) {
  const result = await client.query(
    `SELECT command.response
       FROM public.agent_coordination_commands AS command
       JOIN public.agent_coordination_tasks AS task ON task.task_id = command.task_id
      WHERE task.user_id = $1 AND command.task_id = $2 AND command.command_key = $3
      FOR UPDATE`,
    [ownerId, taskId, commandKey],
  );
  return result.rows[0]?.response || null;
}

async function writeCommand(client, taskId, commandKey, commandType, response) {
  await client.query(
    `INSERT INTO public.agent_coordination_commands
      (task_id, command_key, command_type, response)
     VALUES ($1, $2, $3, $4::jsonb)`,
    [taskId, commandKey, commandType, JSON.stringify(response)],
  );
}

function invalidMutation(task, input) {
  if (!task) return 'task_not_found';
  if (task.agent_id !== input.agentId || task.role !== input.role) return 'agent_role_mismatch';
  if (Number(task.version) !== input.expectedVersion) return 'stale_version';
  if (Number(task.epoch) !== input.expectedEpoch) return 'stale_epoch';
  return null;
}

function isStaleMutation(reason) {
  return reason === 'stale_version' || reason === 'stale_epoch';
}

function taskResourceKeys(task) {
  if (Array.isArray(task.resource_keys)) return normalizeResourceKeys(task.resource_keys);
  try {
    return normalizeResourceKeys(JSON.parse(String(task.resource_keys || '[]')));
  } catch {
    return [];
  }
}

async function taskLeaseExpired(client, task, policy) {
  if (!['admitted', 'running', 'awaiting_approval', 'compensating'].includes(task.state)) return false;
  const result = await client.query(
    `SELECT count(*)::integer AS claim_count,
            bool_or(lease_expires_at <= now()) AS expired_claim
       FROM public.agent_coordination_claims
      WHERE task_id = $1`,
    [task.task_id],
  );
  const claimCount = Number(result.rows[0]?.claim_count || 0);
  if (claimCount > 0) return result.rows[0]?.expired_claim === true;
  const heartbeatAt = Date.parse(String(task.last_heartbeat_at || ''));
  return Number.isFinite(heartbeatAt) && heartbeatAt + policy.leaseSeconds * 1000 <= Date.now();
}

async function acquireQueuedTaskClaims(client, ownerId, task, policy) {
  const resourceKeys = taskResourceKeys(task);
  if (resourceKeys.length === 0) return null;
  const conflicts = await findConflicts(client, ownerId, resourceKeys);
  if (conflicts.length > 0) {
    await writeWaits(client, task.task_id, conflicts);
    await client.query(
      `UPDATE public.agent_coordination_tasks
          SET conflict_count = conflict_count + $2, updated_at = now()
        WHERE task_id = $1`,
      [task.task_id, conflicts.length],
    );
    return 'resource_conflict';
  }
  await claimResources(client, ownerId, task, task, resourceKeys, policy.leaseSeconds);
  return null;
}

/** Applies a compare-and-swap state transition and releases claims at terminal states. */
async function transitionAgentTask(ownerId, taskId, input, { pool = getPool() } = {}) {
  const client = await begin(pool);
  try {
    const duplicate = await readCommand(client, ownerId, taskId, input.idempotencyKey);
    if (duplicate) {
      await client.query('COMMIT');
      return JSON.parse(duplicate);
    }
    const task = await readTask(client, ownerId, taskId, true);
    const mutationError = invalidMutation(task, input);
    if (mutationError) {
      if (task && isStaleMutation(mutationError)) {
        await client.query(
          `UPDATE public.agent_coordination_tasks
              SET stale_command_count = stale_command_count + 1, updated_at = now()
            WHERE task_id = $1`,
          [taskId],
        );
        await persistSnapshot(client, ownerId, taskId);
        await client.query('COMMIT');
        return { outcome: 'rejected', reason: mutationError };
      }
      await rollback(client);
      return { outcome: 'rejected', reason: mutationError };
    }
    if (!canRoleTransition(input.role, task.state, input.nextState)) {
      await rollback(client);
      return { outcome: 'rejected', reason: 'role_not_allowed' };
    }
    if (!canTransition(task.state, input.nextState)) {
      await rollback(client);
      return { outcome: 'rejected', reason: 'invalid_state_transition' };
    }
    const policy = resolveCoordinationPolicy();
    if (await taskLeaseExpired(client, task, policy)) {
      await fenceExpiredTask(client, task, policy);
      const snapshot = await readSnapshot(client, ownerId, taskId);
      const response = { outcome: 'rejected', reason: 'lease_expired', data: snapshot };
      await writeCommand(client, taskId, input.idempotencyKey, 'transition', response);
      await client.query('COMMIT');
      return response;
    }
    if (input.nextState === 'running' && task.state === 'queued') {
      const claimError = await acquireQueuedTaskClaims(client, ownerId, task, policy);
      if (claimError) {
        await client.query('COMMIT');
        return { outcome: 'rejected', reason: claimError };
      }
    }
    const nextRound = input.nextState === 'running' ? Number(task.round) + 1 : Number(task.round);
    if (nextRound > Number(task.max_rounds)) {
      await rollback(client);
      return { outcome: 'rejected', reason: 'round_limit_reached' };
    }
    await client.query(
      `UPDATE public.agent_coordination_tasks
          SET state = $2, round = $3, version = version + 1, epoch = epoch + 1,
              updated_at = now(), last_heartbeat_at = now()
        WHERE task_id = $1`,
      [taskId, input.nextState, nextRound],
    );
    task.state = input.nextState;
    task.round = nextRound;
    task.version = Number(task.version) + 1;
    task.epoch = Number(task.epoch) + 1;
    if (isTerminalState(input.nextState)) await releaseTaskClaims(client, taskId, ownerId);
    const eventType = isTerminalState(input.nextState) ? 'released' : input.nextState === 'compensating' ? 'compensating' : 'transitioned';
    await appendEvent(client, task, eventType, input.reason);
    const snapshot = await readSnapshot(client, ownerId, taskId);
    const response = { outcome: 'accepted', data: snapshot };
    await writeCommand(client, taskId, input.idempotencyKey, 'transition', response);
    await client.query('COMMIT');
    return response;
  } catch (error) {
    await rollback(client);
    throw error;
  } finally {
    client.release();
  }
}

/** Renews claims with the same owner/epoch checks used by state transitions. */
async function heartbeatAgentTask(ownerId, taskId, input, { pool = getPool() } = {}) {
  const client = await begin(pool);
  const policy = resolveCoordinationPolicy();
  try {
    const duplicate = await readCommand(client, ownerId, taskId, input.idempotencyKey);
    if (duplicate) {
      await client.query('COMMIT');
      return JSON.parse(duplicate);
    }
    const task = await readTask(client, ownerId, taskId, true);
    const mutationError = invalidMutation(task, input);
    if (mutationError) {
      if (task && isStaleMutation(mutationError)) {
        await client.query(
          `UPDATE public.agent_coordination_tasks
              SET stale_command_count = stale_command_count + 1, updated_at = now()
            WHERE task_id = $1`,
          [taskId],
        );
        await persistSnapshot(client, ownerId, taskId);
        await client.query('COMMIT');
        return { outcome: 'rejected', reason: mutationError };
      }
      await rollback(client);
      return { outcome: 'rejected', reason: mutationError };
    }
    if (!canRoleTransition(input.role, task.state, task.state)) {
      await rollback(client);
      return { outcome: 'rejected', reason: 'role_not_allowed' };
    }
    if (isTerminalState(task.state)) {
      await rollback(client);
      return { outcome: 'rejected', reason: 'task_is_terminal' };
    }
    if (await taskLeaseExpired(client, task, policy)) {
      await fenceExpiredTask(client, task, policy);
      const snapshot = await readSnapshot(client, ownerId, taskId);
      const response = { outcome: 'rejected', reason: 'lease_expired', data: snapshot };
      await writeCommand(client, taskId, input.idempotencyKey, 'heartbeat', response);
      await client.query('COMMIT');
      return response;
    }
    await client.query(
      `UPDATE public.agent_coordination_claims
          SET lease_expires_at = now() + ($2 * interval '1 second')
        WHERE task_id = $1`,
      [taskId, policy.leaseSeconds],
    );
    await client.query(
      `UPDATE public.agent_coordination_tasks
          SET version = version + 1, last_heartbeat_at = now(), updated_at = now()
        WHERE task_id = $1`,
      [taskId],
    );
    task.version = Number(task.version) + 1;
    await appendEvent(client, task, 'heartbeat');
    const snapshot = await readSnapshot(client, ownerId, taskId);
    const response = { outcome: 'accepted', data: snapshot };
    await writeCommand(client, taskId, input.idempotencyKey, 'heartbeat', response);
    await client.query('COMMIT');
    return response;
  } catch (error) {
    await rollback(client);
    throw error;
  } finally {
    client.release();
  }
}

/** Returns aggregate-only coordination health data; task payloads never leave the store. */
async function getAgentCoordinationMetrics(ownerId, { sinceHours = 24, pool = getPool() } = {}) {
  const hours = Number.isFinite(Number(sinceHours))
    ? Math.min(Math.max(Math.floor(Number(sinceHours)), 1), 168)
    : 24;
  const result = await pool.query(
    `SELECT
       now() - ($2 * interval '1 hour') AS window_start_at,
       now() AS window_end_at,
       count(*)::integer AS total_tasks,
       count(*) FILTER (WHERE state IN ('admitted', 'queued', 'running', 'blocked', 'awaiting_approval', 'compensating'))::integer AS active_tasks,
       count(*) FILTER (WHERE state IN ('completed', 'failed', 'cancelled', 'fenced'))::integer AS terminal_tasks,
       count(*) FILTER (WHERE state = 'completed')::integer AS completed_tasks,
       count(*) FILTER (WHERE conflict_count > 0)::integer AS conflict_tasks,
       count(*) FILTER (WHERE deadlock_detected = true)::integer AS deadlock_count,
       coalesce(sum(stale_command_count), 0)::integer AS stale_command_count,
       coalesce(sum(lease_loss_count), 0)::integer AS lease_loss_count,
       coalesce(sum(compensation_count), 0)::integer AS compensation_count,
       coalesce(avg(round), 0)::double precision AS average_rounds
     FROM public.agent_coordination_tasks
    WHERE user_id = $1
      AND updated_at >= now() - ($2 * interval '1 hour')`,
    [ownerId, hours],
  );
  const row = result.rows[0] || {};
  const totalTasks = Number(row.total_tasks || 0);
  const terminalTasks = Number(row.terminal_tasks || 0);
  const conflictTasks = Number(row.conflict_tasks || 0);
  return {
    windowStartAt: toIso(row.window_start_at),
    windowEndAt: toIso(row.window_end_at),
    totalTasks,
    activeTasks: Number(row.active_tasks || 0),
    terminalTasks,
    completedTasks: Number(row.completed_tasks || 0),
    completionRate: terminalTasks > 0 ? Number(row.completed_tasks || 0) / terminalTasks : 0,
    conflictTasks,
    conflictRate: totalTasks > 0 ? conflictTasks / totalTasks : 0,
    deadlockCount: Number(row.deadlock_count || 0),
    staleCommandCount: Number(row.stale_command_count || 0),
    leaseLossCount: Number(row.lease_loss_count || 0),
    compensationCount: Number(row.compensation_count || 0),
    averageRounds: Number(row.average_rounds || 0),
  };
}

async function listAgentCoordinationEvents(ownerId, taskId, afterSequence = 0, { pool = getPool() } = {}) {
  const result = await pool.query(
    `SELECT event.task_id, event.sequence, event.event_type, event.state,
            event.epoch, event.version, event.reason, event.created_at
       FROM public.agent_coordination_events AS event
       JOIN public.agent_coordination_tasks AS task ON task.task_id = event.task_id
      WHERE task.user_id = $1 AND event.task_id = $2 AND event.sequence > $3
      ORDER BY event.sequence ASC
      LIMIT 100`,
    [ownerId, taskId, afterSequence],
  );
  return result.rows.map((row) => ({
    taskId: row.task_id,
    sequence: Number(row.sequence),
    eventType: row.event_type,
    state: row.state,
    epoch: Number(row.epoch),
    version: Number(row.version),
    reason: row.reason || undefined,
    createdAt: toIso(row.created_at),
  }));
}

module.exports = {
  admitAgentTask,
  getAgentCoordinationTask,
  getAgentCoordinationMetrics,
  heartbeatAgentTask,
  listAgentCoordinationEvents,
  transitionAgentTask,
};
