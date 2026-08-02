import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  RuntimeInvocationResult,
  RuntimeProcessInvoker,
} from '../src/runtime/RuntimeProcessSupervisor';
import { RuntimeProcessSupervisor } from '../src/runtime/RuntimeProcessSupervisor';
import { OpencliService } from '../src/services/opencliService';

class RecordingRuntime implements RuntimeProcessInvoker {
  readonly calls: string[][] = [];

  public async invoke(argumentsList: readonly string[]): Promise<RuntimeInvocationResult> {
    this.calls.push([...argumentsList]);
    return { stdout: JSON.stringify({ url: 'https://www.google.com/', title: 'Google' }) };
  }
}

test('OpenCLI adapter uses a fixed session and registered host without simulated assets', async () => {
  const runtime = new RecordingRuntime();
  const service = new OpencliService(runtime);
  const result = await service.executeCommand({
    kind: 'inspect_page',
    target: 'https://www.google.com/search?q=kk',
    logId: 'audit-test',
  });

  assert.equal(runtime.calls.length, 2);
  assert.deepEqual(runtime.calls[0].slice(0, 4), [
    'browser',
    'kk-studio',
    'open',
    'https://www.google.com/search?q=kk',
  ]);
  assert.equal(result.data.title, 'Google');
  assert.doesNotMatch(JSON.stringify(result), /unsplash|\$199\.00|simulat/i);
});

test('OpenCLI adapter rejects unregistered and private targets', async () => {
  const service = new OpencliService(new RecordingRuntime());
  await assert.rejects(
    service.executeCommand({
      kind: 'inspect_page',
      target: 'http://127.0.0.1/admin',
      logId: 'audit-test',
    }),
    /not registered/,
  );
});

test('OpenCLI reports disabled when no pinned executable is configured', async () => {
  const health = await new OpencliService(null).getHealth();
  assert.equal(health.status, 'disabled');
  assert.equal(health.reachable, false);
});

test('runtime process supervisor requires an absolute pinned executable', () => {
  assert.throws(() => new RuntimeProcessSupervisor({
    executablePath: 'opencli',
    executableSha256: 'a'.repeat(64),
  }), /must be absolute/);
});
