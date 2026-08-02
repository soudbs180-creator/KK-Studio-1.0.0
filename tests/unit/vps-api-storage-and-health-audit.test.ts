import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { test, describe, before, after } from 'node:test';
import { fetch as nativeFetch } from 'undici';

const ROOT_DIR = process.cwd();
const require = createRequire(import.meta.url);
const LOCAL_STORAGE_PATH = path.resolve(ROOT_DIR, '.tmp', `local-user-apis-test-${process.pid}.json`);

describe('VPS Backend Credentials Encryption and Enhanced /healthz Diagnostics', () => {
  const previousEnv = {
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET,
    KKAI_LOCAL_ONLY: process.env.KKAI_LOCAL_ONLY,
    KKAI_LOCAL_USER_API_STORE_PATH: process.env.KKAI_LOCAL_USER_API_STORE_PATH,
    NODE_ENV: process.env.NODE_ENV,
    PASSWORD_SALT: process.env.PASSWORD_SALT,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    USER_API_ENCRYPTION_SECRET: process.env.USER_API_ENCRYPTION_SECRET,
  };

  let server: any;
  let baseUrl: string;
  let dbQueries: Array<{ sql: string; params: any }> = [];
  let mockQueryResults: Record<string, any> = {};
  let originalFileContent: string | null = null;

  before(async () => {
    // 1. 备份原有的本地 JSON 存储文件内容以防污染
    try {
      originalFileContent = await fs.readFile(LOCAL_STORAGE_PATH, 'utf8');
    } catch {
      originalFileContent = null;
    }

    // 2. 强制清理模块缓存
    const modulesToClean = ['/services/api/', '\\services\\api\\', 'express', 'pg'];
    for (const key of Object.keys(require.cache)) {
      if (modulesToClean.some(m => key.includes(m))) {
        delete require.cache[key];
      }
    }

    // 设置测试环境变量
    process.env.JWT_SECRET = 'vps-health-test-secret';
    process.env.PASSWORD_SALT = 'vps-health-test-salt';
    process.env.USER_API_ENCRYPTION_SECRET = 'my-super-encryption-secret-key-32-chars';
    process.env.KKAI_LOCAL_USER_API_STORE_PATH = LOCAL_STORAGE_PATH;

    // Mock 数据库模块 getPool
    const dbHelper = require('../../services/api/lib/db.js');
    dbHelper.getPool = () => {
      return {
        connect: async () => {
          return {
            query: async (sql: string, params: any) => {
              dbQueries.push({ sql, params });
              const sqlLower = sql.toLowerCase();
              const sortedEntries = Object.entries(mockQueryResults).sort((a, b) => b[0].length - a[0].length);
              for (const [key, val] of sortedEntries) {
                if (sqlLower.includes(key.toLowerCase())) {
                  if (val instanceof Error) {
                    throw val;
                  }
                  return val;
                }
              }
              return { rows: [] };
            },
            release: () => {},
          };
        },
        query: async (sql: string, params: any) => {
          dbQueries.push({ sql, params });
          const sqlLower = sql.toLowerCase();
          const sortedEntries = Object.entries(mockQueryResults).sort((a, b) => b[0].length - a[0].length);
          for (const [key, val] of sortedEntries) {
            if (sqlLower.includes(key.toLowerCase())) {
              if (val instanceof Error) {
                throw val;
              }
              return val;
            }
          }
          return { rows: [] };
        }
      };
    };

    // 启动 Express 服务器
    const { createApp } = require('../../services/api/index.js');
    server = createApp().listen(0);
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    if (server) {
      server.close();
    }
    // 恢复原本地物理 JSON 存储文件
    if (originalFileContent !== null) {
      await fs.writeFile(LOCAL_STORAGE_PATH, originalFileContent, 'utf8');
    } else {
      try {
        await fs.unlink(LOCAL_STORAGE_PATH);
      } catch {}
    }
    // 还原环境变量
    for (const [key, value] of Object.entries(previousEnv)) {
      if (typeof value === 'undefined') {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  before(() => {
    dbQueries = [];
    mockQueryResults = {};
  });

  test('1. 本地物理 JSON 模式 - 双向 AES-256-GCM 密文落盘与解密还原自愈', async () => {
    // 模拟纯本地/无数据库模式
    process.env.KKAI_LOCAL_ONLY = 'true';
    delete process.env.DATABASE_URL;

    const store = require('../../services/api/lib/dispatcher/localUserRouteStore.js');

    const testPayload = {
      version: 2,
      profiles: {
        'user-test-local': {
          version: 2,
          slots: [],
          providers: [],
          entries: [
            {
              id: 'test-local-entry-1',
              name: 'My Custom Local OpenAI',
              provider: 'openai',
              key: 'sk-my-super-secret-key-123456',
              baseUrl: 'https://api.openai.com/v1',
            }
          ]
        }
      }
    };

    // 1.1 执行物理落盘
    await store.writeLocalStorage(testPayload);

    // 1.2 读取物理文件验证明文已被混淆加密
    const fileRaw = await fs.readFile(LOCAL_STORAGE_PATH, 'utf8');
    const parsed = JSON.parse(fileRaw);
    const savedEntry = parsed.profiles['user-test-local'].entries[0];

    assert.ok(savedEntry.key.startsWith('enc:'), '落盘的密钥必须以 enc: 前缀开头进行物理加密');
    assert.notEqual(savedEntry.key, 'sk-my-super-secret-key-123456', '物理落盘文件绝不能包含任何明文 API 密钥');

    // 1.3 调用 readLocalStorage 校验自愈解密还原
    const readPayload = await store.readLocalStorage('user-test-local');
    const restoredEntry = readPayload.profiles['user-test-local'].entries[0];

    assert.equal(restoredEntry.key, 'sk-my-super-secret-key-123456', '读取出来的内存态密钥必须自愈解密还原为原始明文');
  });

  test('2. 数据库模式 - API 密钥强加密存库与多用户分组解析事务回路', async () => {
    // 开启数据库模式
    process.env.DATABASE_URL = 'postgres://mock:mock@localhost:5432/mock_db';
    delete process.env.KKAI_LOCAL_ONLY;

    const store = require('../../services/api/lib/dispatcher/localUserRouteStore.js');

    // 2.1 模拟 writeLocalStorage 并触发数据库事务插入
    const testPayload = {
      version: 2,
      profiles: {
        'user-db-1': {
          version: 2,
          slots: [],
          providers: [],
          entries: [
            {
              id: 'db-entry-1',
              name: 'Postgres OpenAI',
              provider: 'openai',
              key: 'sk-db-secret-key-9999',
              baseUrl: 'https://api.openai.com/v1',
            }
          ]
        }
      }
    };

    // 模拟已有凭据（比如没有修改 key 时的占位还原测试）
    mockQueryResults['SELECT encrypted_secret'] = {
      rows: []
    };

    await store.writeLocalStorage(testPayload);

    // 2.2 验证写入事务 SQL 拼接
    const beginQuery = dbQueries.find(q => q.sql === 'BEGIN');
    const deleteQuery = dbQueries.find(q => q.sql.includes('DELETE FROM'));
    const insertQuery = dbQueries.find(q => q.sql.includes('INSERT INTO'));
    const commitQuery = dbQueries.find(q => q.sql === 'COMMIT');

    assert.ok(beginQuery, '应当启动数据库写入事务');
    assert.ok(deleteQuery, '应当删除旧的用户密钥记录');
    assert.ok(insertQuery, '应当触发新凭证的 INSERT 动作');
    assert.ok(commitQuery, '写入事务应当成功 COMMIT 提交');

    // 验证插入的 SQL 参数
    assert.equal(insertQuery.params[0], 'user-db-1');
    assert.equal(insertQuery.params[1], 'openai');
    assert.equal(insertQuery.params[2], 'api_key');
    assert.ok(insertQuery.params[3].split(':').length === 3, '插入的凭据密文包应当为标准的 aes-256-gcm 密文分发信封');

    // 2.3 模拟 readLocalStorage(userId) 从数据库拉取并解密还原
    // Mock 数据库返回数据
    const { encrypt } = require('../../services/api/utils/crypto.js');
    const encryptedPayload = encrypt(JSON.stringify({
      id: 'db-entry-loaded',
      name: 'Postgres OpenAI Loaded',
      provider: 'openai',
      key: 'sk-db-secret-key-loaded-1111',
      _group: 'entries'
    }));

    mockQueryResults['SELECT encrypted_secret FROM public.user_provider_credentials WHERE user_id = $1'] = {
      rows: [
        { encrypted_secret: encryptedPayload }
      ]
    };

    // 触发读取
    const data = await store.readLocalStorage('user-db-1');
    const profile = data.profiles['user-db-1'];

    assert.ok(profile, '应当还原出用户的 profileState 结构');
    assert.equal(profile.entries.length, 1);
    assert.equal(profile.entries[0].id, 'db-entry-loaded');
    assert.equal(profile.entries[0].key, 'sk-db-secret-key-loaded-1111', '数据库存库应成功解密还原为明文');
  });

  test('3. 增强健康检查 - 异步多维探针物理指标诊断', async () => {
    // 3.1 模拟数据库不可连且无 Stripe 时的 degraded/unhealthy 探查
    process.env.DATABASE_URL = 'postgres://mock:mock@localhost:5432/mock_db';
    delete process.env.KKAI_LOCAL_ONLY;
    delete process.env.STRIPE_SECRET_KEY;

    // 模拟数据库探活连接失败
    mockQueryResults['SELECT 1'] = new Error('Database is offline');

    const healthRes = await nativeFetch(`${baseUrl}/healthz`);

    assert.equal(healthRes.status, 500, '测试环境以外如果数据库不可连，应当返回 500 unhealthy 响应');
    const healthBody = await healthRes.json() as any;

    assert.equal(healthBody.ok, false);
    assert.equal(healthBody.status, 'unhealthy');
    assert.ok(healthBody.system, '返回结果应包含物理 system 指标采样对象');
    assert.ok(healthBody.system.nodeVersion, 'system 中应输出 Node 版本号');
    assert.ok(healthBody.system.memory.usagePercent > 0, 'system 中应采集物理内存使用率');

    // 3.2 模拟完全健康状态 (localOnly)
    process.env.KKAI_LOCAL_ONLY = 'true';
    delete process.env.DATABASE_URL;

    const healthyRes = await nativeFetch(`${baseUrl}/healthz`);
    assert.equal(healthyRes.status, 200);
    const healthyBody = await healthyRes.json() as any;
    assert.equal(healthyBody.ok, true);
    assert.equal(healthyBody.status, 'healthy');
  });

  test('hosted profile reads load legacy credentials for the authenticated owner', async () => {
    process.env.DATABASE_URL = 'postgres://mock:mock@localhost:5432/mock_db';
    delete process.env.KKAI_LOCAL_ONLY;

    const ownerId = 'owner-db-read';
    const { encrypt } = require('../../services/api/utils/crypto.js');
    const { signJWT } = require('../../services/api/lib/jwt.js');
    mockQueryResults['SELECT encrypted_secret FROM public.user_provider_credentials WHERE user_id = $1'] = {
      rows: [{
        encrypted_secret: encrypt(JSON.stringify({
          id: 'owner-entry',
          name: 'Owner credential',
          provider: 'openai',
          key: 'sk-owner-only',
          _group: 'entries',
        })),
      }],
    };
    dbQueries = [];

    const response = await nativeFetch(`${baseUrl}/api/v1/profile/user-apis`, {
      headers: { Authorization: `Bearer ${signJWT({ userId: ownerId })}` },
    });
    const body = await response.json() as {
      success: boolean;
      data: { entries: Array<{ id: string }> };
    };

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.deepEqual(body.data.entries.map((entry) => entry.id), ['owner-entry']);
    const credentialReads = dbQueries.filter(({ sql }) => (
      sql.includes('SELECT encrypted_secret FROM public.user_provider_credentials')
    ));
    assert.deepEqual(credentialReads.map(({ params }) => params), [[ownerId]]);
  });

  test('hosted profile writes replace credentials for only the authenticated owner', async () => {
    process.env.DATABASE_URL = 'postgres://mock:mock@localhost:5432/mock_db';
    delete process.env.KKAI_LOCAL_ONLY;

    const store = require('../../services/api/lib/dispatcher/localUserRouteStore.js');
    const { encrypt } = require('../../services/api/utils/crypto.js');
    const { signJWT } = require('../../services/api/lib/jwt.js');
    mockQueryResults['SELECT encrypted_secret FROM public.user_provider_credentials WHERE user_id = $1'] = {
      rows: [{
        encrypted_secret: encrypt(JSON.stringify({
          id: 'stale-entry',
          name: 'Other owner credential',
          provider: 'openai',
          key: 'sk-other-owner',
          _group: 'entries',
        })),
      }],
    };
    await store.readLocalStorage('owner-stale-cache');

    const ownerId = 'owner-db-write';
    mockQueryResults['SELECT encrypted_secret FROM public.user_provider_credentials WHERE user_id = $1'] = {
      rows: [],
    };
    dbQueries = [];

    const response = await nativeFetch(`${baseUrl}/api/v1/profile/key-manager-state`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${signJWT({ userId: ownerId })}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ version: 2, slots: [], providers: [], entries: [] }),
    });

    assert.equal(response.status, 200);
    const replacedOwners = dbQueries
      .filter(({ sql }) => sql.includes('DELETE FROM public.user_provider_credentials'))
      .map(({ params }) => params[0]);
    assert.deepEqual(replacedOwners, [ownerId]);
  });
});
