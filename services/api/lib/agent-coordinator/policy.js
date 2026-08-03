const DEFAULT_POLICY = Object.freeze({
  version: 'coordination-v1',
  leaseSeconds: 60,
  maxRounds: Object.freeze({ low: 4, medium: 6, high: 8, critical: 12 }),
  maxActiveTasks: 8,
  maxClusterAgents: 16,
  maxResourceKeys: 50,
  admissionRoles: Object.freeze(['executor']),
  priorityWeight: Object.freeze({ background: 1, normal: 2, urgent: 3, critical: 4 }),
  riskWeight: Object.freeze({ low: 1, medium: 2, high: 3, critical: 4 }),
});

const PREEMPTABLE_STATES = new Set(['admitted', 'queued']);
const ACTIVE_STATES = new Set(['admitted', 'queued', 'running', 'blocked', 'awaiting_approval', 'compensating']);
const TERMINAL_STATES = new Set(['completed', 'failed', 'cancelled', 'fenced']);
const STATE_TRANSITIONS = new Map([
  ['admitted', new Set(['queued', 'running', 'blocked', 'awaiting_approval', 'cancelled'])],
  ['queued', new Set(['admitted', 'running', 'blocked', 'cancelled'])],
  ['running', new Set(['awaiting_approval', 'compensating', 'completed', 'failed', 'cancelled'])],
  ['blocked', new Set(['queued', 'cancelled', 'fenced'])],
  ['awaiting_approval', new Set(['running', 'cancelled', 'fenced'])],
  ['compensating', new Set(['completed', 'failed', 'cancelled'])],
  ['completed', new Set()],
  ['failed', new Set()],
  ['cancelled', new Set()],
  ['fenced', new Set(['compensating', 'failed'])],
]);

function positiveInteger(value, fallback, maximum) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= maximum ? parsed : fallback;
}

/** Builds a versioned, environment-overridable policy instead of scattering priority branches. */
function resolveCoordinationPolicy(env = process.env) {
  const maxRounds = Object.fromEntries(
    Object.entries(DEFAULT_POLICY.maxRounds).map(([riskClass, fallback]) => [
      riskClass,
      positiveInteger(env[`KK_AGENT_MAX_ROUNDS_${riskClass.toUpperCase()}`], fallback, 32),
    ]),
  );
  return {
    ...DEFAULT_POLICY,
    version: String(env.KK_AGENT_COORDINATION_POLICY_VERSION || DEFAULT_POLICY.version).slice(0, 100),
    leaseSeconds: positiveInteger(env.KK_AGENT_COORDINATION_LEASE_SECONDS, DEFAULT_POLICY.leaseSeconds, 3600),
    maxActiveTasks: positiveInteger(env.KK_AGENT_MAX_ACTIVE_TASKS, DEFAULT_POLICY.maxActiveTasks, 1000),
    maxClusterAgents: positiveInteger(env.KK_AGENT_MAX_CLUSTER_AGENTS, DEFAULT_POLICY.maxClusterAgents, 1000),
    maxResourceKeys: positiveInteger(env.KK_AGENT_MAX_RESOURCE_KEYS, DEFAULT_POLICY.maxResourceKeys, 50),
    maxRounds,
  };
}

function effectivePriority(task, policy) {
  const priority = policy.priorityWeight[task.priority] || policy.priorityWeight.normal;
  const risk = policy.riskWeight[task.riskClass] || policy.riskWeight.medium;
  const deadlineBonus = task.deadlineAt && Date.parse(task.deadlineAt) - Date.now() <= 5 * 60 * 1000 ? 5 : 0;
  return priority * 100 + risk * 10 + deadlineBonus;
}

/** Allows preemption only for a higher-ranked task before the incumbent starts mutation. */
function canPreempt(incoming, incumbent, policy) {
  return PREEMPTABLE_STATES.has(incumbent.state)
    && effectivePriority(incoming, policy) > effectivePriority(incumbent, policy);
}

function canTransition(currentState, nextState) {
  if (currentState === nextState) return true;
  return STATE_TRANSITIONS.get(currentState)?.has(nextState) === true;
}

function isTerminalState(state) {
  return TERMINAL_STATES.has(state);
}

function isActiveState(state) {
  return ACTIVE_STATES.has(state);
}

function isAdmissionRoleAllowed(role, policy) {
  return policy.admissionRoles.includes(role);
}

/** Keeps role capabilities separate from the state transition graph. */
function canRoleTransition(role, currentState, nextState) {
  if (role === 'executor' || role === 'coordinator') return true;
  if (role === 'compensator') {
    return (currentState === 'fenced' && nextState === 'compensating')
      || (currentState === 'compensating' && isTerminalState(nextState));
  }
  return false;
}

/** Detects wait-for cycles so imported or future partial-claim states fail closed. */
function detectCoordinationDeadlock(edges) {
  const graph = new Map();
  for (const edge of edges || []) {
    if (!graph.has(edge.taskId)) graph.set(edge.taskId, new Set());
    graph.get(edge.taskId).add(edge.blockedOnTaskId);
  }
  const visiting = new Set();
  const visited = new Set();
  const visit = (taskId) => {
    if (visiting.has(taskId)) return true;
    if (visited.has(taskId)) return false;
    visiting.add(taskId);
    for (const next of graph.get(taskId) || []) {
      if (visit(next)) return true;
    }
    visiting.delete(taskId);
    visited.add(taskId);
    return false;
  };
  return [...graph.keys()].some(visit);
}

module.exports = {
  canPreempt,
  canRoleTransition,
  canTransition,
  detectCoordinationDeadlock,
  effectivePriority,
  isActiveState,
  isAdmissionRoleAllowed,
  isTerminalState,
  resolveCoordinationPolicy,
};
