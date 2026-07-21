import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { test, describe, before, after } from 'node:test';
import { fetch as nativeFetch } from 'undici';

const ROOT_DIR = process.cwd();
const require = createRequire(import.meta.url);

describe('VPS Admin Security, Privacy Shielding, and Data Retention', () => {
  const previousEnv = {
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET,
    KKAI_LOCAL_ONLY: process.env.KKAI_LOCAL_ONLY,
    NODE_ENV: process.env.NODE_ENV,
    PASSWORD_SALT: process.env.PASSWORD_SALT,
  };

  let server: any;
  let baseUrl: string;
  let dbQueries: Array<{ sql: string; params: any }> = [];
  let mockQueryResults: Record<string, any> = {};

  before(async () => {
    // 强制清理相关模块缓存以支持干净的测试环境
    const modulesToClean = ['/services/api/', '\\services\\api\\', 'express', 'pg'];
    for (const key of Object.keys(require.cache)) {
      if (modulesToClean.some(m => key.includes(m))) {
        delete require.cache[key];
      }
    }

    // 设置基本测试环境变量
    process.env.JWT_SECRET = 'vps-test-session-secret';
    process.env.PASSWORD_SALT = 'vps-test-password-salt';

    // Mock 数据库模块
    const dbHelper = require('../../services/api/lib/db.js');
    dbHelper.getPool = () => {
      return {
        query: async (sql: string, params: any) => {
          dbQueries.push({ sql, params });
          const sqlLower = sql.toLowerCase();
          for (const [key, val] of Object.entries(mockQueryResults)) {
            if (sqlLower.includes(key.toLowerCase())) {
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

  after(() => {
    if (server) {
      server.close();
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

  // 每个用例执行前清理数据库查询记录
  before(() => {
    dbQueries = [];
    mockQueryResults = {};
  });

  test('1. Mock登录 - 非 test 环境下的无密登录拦截与强密码校验', async () => {
    // 模拟非 test 环境且无 DB 的模式
    process.env.NODE_ENV = 'development';
    process.env.KKAI_LOCAL_ONLY = 'true';
    delete process.env.DATABASE_URL;

    // 1.1 错误密码登录尝试 (v1 路由)
    const loginFailRes = await nativeFetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@example.com',
        password: 'wrongpassword',
      }),
    });
    assert.equal(loginFailRes.status, 401);
    const failBody = await loginFailRes.json() as any;
    assert.equal(failBody.success, false);
    assert.equal(failBody.error.code, 'AUTH_INVALID_CREDENTIALS');

    // 1.2 正确密码登录尝试 (v1 路由)
    const loginSuccessRes = await nativeFetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: '977483863@qq.com',
        password: 'admin123456',
      }),
    });
    const loginSuccessText = await loginSuccessRes.text();
    console.log('[DEBUG SUCCESS RES]', loginSuccessRes.status, loginSuccessText);
    assert.equal(loginSuccessRes.status, 200);
    const successBody = JSON.parse(loginSuccessText) as any;
    assert.equal(successBody.success, true);
    assert.equal(successBody.data.profile.email, '977483863@qq.com');

    // 1.3 兼容登录路由同样应具备强密码拦截校验 (compat 路由)
    const compatFailRes = await nativeFetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: '977483863@qq.com',
        password: 'bad-password',
      }),
    });
    const compatFailText = await compatFailRes.text();
    console.log('[DEBUG COMPAT FAIL RES]', compatFailRes.status, compatFailText);
    assert.equal(compatFailRes.status, 401);
    const compatFailBody = JSON.parse(compatFailText) as any;
    assert.equal(compatFailBody.success, false);
    assert.equal(compatFailBody.error?.code, 'AUTH_INVALID_CREDENTIALS');

    // 恢复 test 环境
    process.env.NODE_ENV = 'test';
  });

  test('2. 管理后台 - 数据库模式下的联合查询与超级管理员隐私物理隐藏', async () => {
    process.env.DATABASE_URL = 'postgres://mock_user:mock_pass@localhost:5432/mock_db';
    delete process.env.KKAI_LOCAL_ONLY;

    // 2.1 模拟管理员鉴权查询
    const { signJWT } = require('../../services/api/lib/jwt.js');
    const adminToken = signJWT({ userId: 'admin-user-id' });

    // Mock 校验 admin level
    mockQueryResults['SELECT COALESCE(admin_level, 0)'] = {
      rows: [{ admin_level: 2 }]
    };

    // Mock 联合查询数据结果
    mockQueryResults['FROM ('] = {
      rows: [
        {
          id: 'user-normal',
          email: 'user-normal@example.com',
          credits: '500',
          admin_level: 0,
          created_at: new Date().toISOString(),
          user_type: 'registered',
          recharge_amount: '150.00'
        },
        {
          id: 'temp-user-1',
          email: null,
          credits: '200',
          admin_level: 0,
          created_at: new Date().toISOString(),
          user_type: 'temporary',
          recharge_amount: '80.00'
        }
      ]
    };

    mockQueryResults['SELECT COUNT(*) AS total'] = {
      rows: [{ total: 2 }]
    };

    // 2.2 请求用户列表
    const listRes = await nativeFetch(`${baseUrl}/api/admin/users`, {
      headers: {
        'authorization': `Bearer ${adminToken}`
      }
    });

    const listText = await listRes.text();
    console.log('[DEBUG ADMIN USERS DB RES]', listRes.status, listText);
    assert.equal(listRes.status, 200);
    const listBody = JSON.parse(listText) as any;

    assert.ok(Array.isArray(listBody.users));
    assert.equal(listBody.users.length, 2);

    // 验证返回值不含有 977483863@qq.com 账号
    const hasSuperAdmin = listBody.users.some((u: any) => u.email === '977483863@qq.com');
    assert.equal(hasSuperAdmin, false, '超级管理员账号不应该出现在返回列表中');

    // 校验返回的用户包含临时用户与充值余额信息
    const tempUser = listBody.users.find((u: any) => u.userType === 'temporary');
    assert.ok(tempUser);
    assert.equal(tempUser.credits, 200);
    assert.equal(tempUser.rechargeAmount, 80);

    // 2.3 检查拼装出来的 SQL
    const selectQuery = dbQueries.find(q => q.sql.includes('FROM ('));
    assert.ok(selectQuery);
    
    // 验证 SQL 中有过滤 977483863@qq.com 的子句
    assert.match(selectQuery.sql, /u\.email != '977483863@qq.com'/);
    // 验证 SQL 中包含近 2 个月的充值限制
    assert.match(selectQuery.sql, /created_at >= NOW\(\) - INTERVAL '2 months'/);
    // 验证 SQL 具有 UNION ALL 联合查询
    assert.match(selectQuery.sql, /UNION ALL/);
  });

  test('3. 管理后台 - Mock/无数据库模式下的超级管理员物理屏蔽与临时账户展示', async () => {
    // 模拟无 DB / Local-only 模式
    process.env.KKAI_LOCAL_ONLY = 'true';
    delete process.env.DATABASE_URL;

    const { signJWT } = require('../../services/api/lib/jwt.js');
    const adminToken = signJWT({ userId: 'admin-user-id' });

    // 请求用户列表
    const listRes = await nativeFetch(`${baseUrl}/api/admin/users`, {
      headers: {
        'authorization': `Bearer ${adminToken}`
      }
    });

    const listText = await listRes.text();
    console.log('[DEBUG ADMIN USERS MOCK RES]', listRes.status, listText);
    assert.equal(listRes.status, 200);
    const listBody = JSON.parse(listText) as any;
    assert.ok(Array.isArray(listBody.users));

    // 验证返回值不含有 977483863@qq.com 账号
    const hasSuperAdmin = listBody.users.some((u: any) => u.email === '977483863@qq.com');
    assert.equal(hasSuperAdmin, false, 'Mock 模式下超级管理员账号也必须在后台被过滤');

    // 验证 Mock 临时用户数据输出
    const tempUser = listBody.users.find((u: any) => u.userType === 'temporary');
    assert.ok(tempUser);
  });

  test('4. 自动清理 - 2个月期限充值与交易流水的物理清理', async () => {
    // 设置 DATABASE_URL 确保能够运行守护进程内部的物理清理
    process.env.DATABASE_URL = 'postgres://mock_user:mock_pass@localhost:5432/mock_db';
    delete process.env.KKAI_LOCAL_ONLY;

    const { reconcilePendingJobs } = require('../../services/api/lib/dispatcher/reconciliation.js');

    // 触发对账
    await reconcilePendingJobs();

    // 校验执行了物理删除超过2个月的历史记录 SQL
    const deleteRechargeQuery = dbQueries.find(q => q.sql.includes('DELETE FROM public.recharge_submissions'));
    const deleteTransactionQuery = dbQueries.find(q => q.sql.includes('DELETE FROM public.credit_transactions'));

    assert.ok(deleteRechargeQuery, '应当触发 recharge_submissions 表的清理');
    assert.ok(deleteTransactionQuery, '应当触发 credit_transactions 表的清理');

    assert.match(deleteRechargeQuery.sql, /created_at < NOW\(\) - INTERVAL '2 months'/);
    assert.match(deleteTransactionQuery.sql, /created_at < NOW\(\) - INTERVAL '2 months'/);
  });
});
