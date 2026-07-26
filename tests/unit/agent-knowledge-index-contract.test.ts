// 简体中文：AI 助手知识库索引与一致性脚本契约单元测试 (Agent Knowledge Index & Skills Test)

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT_DIR = process.cwd();
const PROJECT_INDEX_PATH = path.join(ROOT_DIR, 'docs', 'ai-assistant', 'generated', 'project-index.json');

// 用 process.execPath 而非字面量 'node'：不依赖 node 是否在 PATH 上，
// 并保证子进程与测试运行在同一 Node 版本。
function runGovernanceScript(relativePath: string, options: Parameters<typeof execFileSync>[2] = {}) {
  return execFileSync(process.execPath, [relativePath], options);
}

test('知识库索引：通过 build-knowledge-index.mjs 脚本构建 project-index.json 并做格式与内容契约校验', () => {
  // 1. 物理运行索引构建脚本
  try {
    runGovernanceScript('scripts/governance/ai-assistant/build-knowledge-index.mjs', { stdio: 'pipe' });
  } catch (err: any) {
    assert.fail(`脚本 build-knowledge-index.mjs 执行失败: ${err.message}`);
  }

  // 2. 验证索引 JSON 文件是否存在
  assert.equal(fs.existsSync(PROJECT_INDEX_PATH), true, '应生成 project-index.json 索引文件');

  // 3. 读取 JSON 文件并解析
  const rawData = fs.readFileSync(PROJECT_INDEX_PATH, 'utf-8');
  let docs: any[] = [];
  try {
    docs = JSON.parse(rawData);
  } catch (err) {
    assert.fail('生成的文件无法通过 JSON 解析');
  }

  // 4. 校验基本契约约束
  assert.ok(Array.isArray(docs), '生成的索引应为文档对象数组');
  assert.ok(docs.length > 0, '生成的索引应该包含至少一个 markdown 文档');

  for (const doc of docs) {
    assert.ok(doc.id, '文档应包含 id');
    assert.equal(typeof doc.id, 'string');

    assert.ok(doc.source, '文档应包含 source');
    assert.equal(doc.source, 'doc');

    assert.ok(doc.path, '文档应包含 path');
    assert.ok(doc.path.endsWith('.md'), '路径后缀应为 .md');

    assert.ok(doc.title, '文档应包含 title');
    assert.equal(typeof doc.title, 'string');

    assert.ok(doc.summary, '文档应包含 summary');
    assert.equal(typeof doc.summary, 'string');

    assert.ok(doc.contentHash, '文档应包含 contentHash');
    assert.equal(typeof doc.contentHash, 'string');

    assert.ok(doc.updatedAt, '文档应包含 updatedAt');
    assert.equal(typeof doc.updatedAt, 'string');
  }
});

test('一致性校验：物理运行 check-skills-consistency.mjs 脚本且必须通过校验', () => {
  try {
    const stdout = runGovernanceScript('scripts/governance/ai-assistant/check-skills-consistency.mjs', { encoding: 'utf-8' }) as unknown as string;
    assert.match(stdout, /校验成功/);
    assert.match(stdout, /运行时注册的工具: \[[^\]]*browser\.getStatus/);
    assert.match(stdout, /运行时注册的工具: \[[^\]]*browser\.extractProduct/);
    assert.match(stdout, /运行时注册的工具: \[[^\]]*browser\.generateExternal/);
    assert.match(stdout, /运行时注册的工具: \[[^\]]*browser\.publishDraft/);
    assert.match(stdout, /运行时注册的工具: \[[^\]]*browser\.writeBackDom/);
    assert.match(stdout, /敏感风险操作工具: \[[^\]]*browser\.extractProduct/);
    assert.match(stdout, /敏感风险操作工具: \[[^\]]*browser\.generateExternal/);
    assert.match(stdout, /敏感风险操作工具: \[[^\]]*browser\.publishDraft/);
    assert.match(stdout, /敏感风险操作工具: \[[^\]]*browser\.writeBackDom/);
  } catch (err: any) {
    assert.fail(`一致性脚本 check-skills-consistency.mjs 校验异常: ${err.stdout || err.message}`);
  }
});
