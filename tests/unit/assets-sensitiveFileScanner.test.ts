import test from 'node:test';
import assert from 'node:assert/strict';
import { detectSensitiveFile } from '../../apps/web/src/features/assets/sensitiveFileScanner.ts';

test('敏感文件扫描单元测试：拦截 .env 文件', () => {
  const file = { name: '.env' } as any;
  const result = detectSensitiveFile(file);
  assert.equal(result.sensitive, true);
  assert.match(result.reason || '', /命中敏感规则：\.env/);
});

test('敏感文件扫描单元测试：拦截 credentials.json', () => {
  const file = { name: 'credentials.json' } as any;
  const result = detectSensitiveFile(file);
  assert.equal(result.sensitive, true);
  assert.match(result.reason || '', /命中敏感规则：credential/);
});

test('敏感文件扫描单元测试：放行正常的图像文件', () => {
  const file = { name: 'my_cat_pic.png' } as any;
  const result = detectSensitiveFile(file, 'photos/pets/my_cat_pic.png');
  assert.equal(result.sensitive, false);
});
