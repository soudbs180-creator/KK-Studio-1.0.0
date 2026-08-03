import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    failures.push(`Missing Agent coordination guard file: ${relativePath}`);
    return '';
  }
  return fs.readFileSync(absolutePath, 'utf8');
}

function requireToken(source, relativePath, token) {
  if (!source.includes(token)) failures.push(`${relativePath} is missing required guard: ${token}`);
}

const policy = read('services/api/lib/agent-coordinator/policy.js');
const store = read('services/api/lib/agent-coordinator/store.js');
const route = read('services/api/routes/ai-assistant.js');
const gate = read('apps/web/src/features/ai-assistant-runtime/runtime/agentCoordinationGate.ts');
const migration = read('infrastructure/database/migrations/032_agent_coordination.sql');
const dto = read('packages/shared/src/contracts/dto/agent-coordination.ts');

requireToken(policy, 'services/api/lib/agent-coordinator/policy.js', 'detectCoordinationDeadlock');
requireToken(policy, 'services/api/lib/agent-coordinator/policy.js', 'maxActiveTasks');
requireToken(policy, 'services/api/lib/agent-coordinator/policy.js', 'maxClusterAgents');
requireToken(policy, 'services/api/lib/agent-coordinator/policy.js', 'maxResourceKeys');
requireToken(policy, 'services/api/lib/agent-coordinator/policy.js', 'isAdmissionRoleAllowed');
requireToken(store, 'services/api/lib/agent-coordinator/store.js', 'FOR UPDATE');
requireToken(store, 'services/api/lib/agent-coordinator/store.js', 'idempotency_key');
requireToken(store, 'services/api/lib/agent-coordinator/store.js', 'lease_expired');
requireToken(store, 'services/api/lib/agent-coordinator/store.js', 'getAgentCoordinationMetrics');
requireToken(store, 'services/api/lib/agent-coordinator/store.js', 'persistSnapshot');
requireToken(route, 'services/api/routes/ai-assistant.js', 'coordination/metrics');
requireToken(route, 'services/api/routes/ai-assistant.js', 'coordinator and compensator roles are server-managed');
requireToken(gate, 'apps/web/src/features/ai-assistant-runtime/runtime/agentCoordinationGate.ts', 'startAgentCoordinationHeartbeat');
requireToken(migration, 'infrastructure/database/migrations/032_agent_coordination.sql', 'agent_coordination_waits');
requireToken(migration, 'infrastructure/database/migrations/032_agent_coordination.sql', 'agent_coordination_snapshots');
requireToken(migration, 'infrastructure/database/migrations/032_agent_coordination.sql', 'lease_expired');
requireToken(dto, 'packages/shared/src/contracts/dto/agent-coordination.ts', 'AgentCoordinationMetricsDtoSchema');

if (failures.length > 0) {
  for (const failure of failures) console.error(`[agent-coordination:check] ${failure}`);
  process.exit(1);
}

console.log('[agent-coordination:check] global arbitration, bounded rounds, role admission, deadlock protection, lease fencing, idempotency, and metrics guards are present.');
