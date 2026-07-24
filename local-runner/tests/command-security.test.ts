import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { OpencliCommandSchema } from '../src/contracts/opencli';
import { LocalAuditLogService } from '../src/services/localAuditLogService';

test('OpenCLI command envelope is strict and bounded', () => {
  const validCommand = OpencliCommandSchema.parse({
    kind: 'inspect_page',
    target: 'https://example.com/products/1',
    payload: { includeImages: true },
  });

  assert.equal(validCommand.kind, 'inspect_page');
  assert.equal(OpencliCommandSchema.safeParse({ ...validCommand, extra: true }).success, false);
  assert.equal(OpencliCommandSchema.safeParse({ ...validCommand, kind: 'shell' }).success, false);
  assert.equal(OpencliCommandSchema.safeParse({ ...validCommand, target: '' }).success, false);
  assert.equal(
    OpencliCommandSchema.safeParse({ ...validCommand, target: 'x'.repeat(2049) }).success,
    false,
  );
});

test('local audit log removes secrets, prompts, and URL query values', (context) => {
  const stateDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'kk-local-audit-'));
  context.after(() => fs.rmSync(stateDirectory, { recursive: true, force: true }));

  const logPath = path.join(stateDirectory, 'audit.log');
  const auditLog = new LocalAuditLogService({ logPath });
  auditLog.log(
    'audit-1',
    'generate_external',
    'medium',
    'https://example.com/private?access_token=query-secret#fragment',
    'failed',
    {
      authorization: 'Bearer header-secret',
      nested: {
        apiKey: 'sk-private-value',
        prompt: 'private customer prompt',
        safeCode: 'PROVIDER_TIMEOUT',
      },
      error: 'Request failed with Bearer embedded-secret',
    },
  );

  const rawRecord = fs.readFileSync(logPath, 'utf8').trim();
  const record = JSON.parse(rawRecord) as {
    targetUrl: string;
    details: Record<string, unknown>;
  };

  assert.equal(record.targetUrl, 'https://example.com/private');
  assert.equal(record.details.authorization, '[REDACTED]');
  assert.doesNotMatch(rawRecord, /query-secret|header-secret|private-value|customer prompt|embedded-secret/);
  assert.match(rawRecord, /PROVIDER_TIMEOUT/);
});
