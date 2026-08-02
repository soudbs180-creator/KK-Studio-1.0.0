import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  RuntimeHealthSnapshotDtoSchema,
  RuntimeServiceHealthDtoSchema,
} from '../../packages/shared/src/index.ts';

test('runtime health snapshot reports each service independently', () => {
  const checkedAt = new Date().toISOString();
  const snapshot = RuntimeHealthSnapshotDtoSchema.parse({
    schemaVersion: 1,
    checkedAt,
    services: [
      {
        serviceId: 'api-gateway',
        label: 'API Gateway',
        status: 'ready',
        reachable: true,
        latencyMs: 24,
        version: '1.6.1',
        checkedAt,
        recoveryActions: [],
      },
      {
        serviceId: 'opencli',
        label: 'OpenCLI Bridge',
        status: 'offline',
        reachable: false,
        checkedAt,
        recoveryActions: [{ id: 'retry-opencli', label: 'Retry', action: 'retry' }],
      },
    ],
  });

  assert.equal(snapshot.services.length, 2);
  assert.equal(snapshot.services[1].status, 'offline');
});

test('runtime service contract rejects fake success without reachability', () => {
  assert.throws(() => RuntimeServiceHealthDtoSchema.parse({
    serviceId: 'local-runner',
    label: 'Local Runner',
    status: 'ready',
    reachable: false,
    checkedAt: new Date().toISOString(),
    recoveryActions: [],
  }));
});

test('diagnostics UI consumes the normalized snapshot instead of sharing API Gateway status', () => {
  const serviceSource = fs.readFileSync(
    'apps/web/src/services/runtime/runtimeHealthSnapshot.ts',
    'utf8',
  );
  const viewSource = fs.readFileSync(
    'apps/web/src/components/settings/views/DevDiagnosticsView.tsx',
    'utf8',
  );

  assert.match(serviceSource, /api-gateway/);
  assert.match(serviceSource, /local-runner/);
  assert.match(serviceSource, /cliproxyapi/);
  assert.match(serviceSource, /opencli/);
  assert.match(serviceSource, /browser-bridge/);
  assert.match(viewSource, /getRuntimeHealthSnapshot/);
  assert.doesNotMatch(viewSource, /runnerStatus\?\.reachable[\s\S]{0,180}OpenCLI Bridge API/);
});
