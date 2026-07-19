import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { readSource } from '../support/workspacePaths.js';

const require = createRequire(import.meta.url);

test('migration 016 scopes AI knowledge, skills and canvas snapshots without claiming legacy ownership', () => {
  assert.equal(existsSync('migrations/016_ai_assistant_user_scope.sql'), true);
  const migration = readSource('migrations/016_ai_assistant_user_scope.sql');

  assert.match(migration, /ALTER TABLE public\.knowledge_documents[\s\S]*ADD COLUMN IF NOT EXISTS user_id text/);
  assert.match(migration, /ALTER TABLE public\.agent_skills[\s\S]*ADD COLUMN IF NOT EXISTS user_id text/);
  assert.match(migration, /ALTER TABLE public\.canvas_runtime_snapshots[\s\S]*ADD COLUMN IF NOT EXISTS user_id text/);
  assert.match(migration, /owner_scope[\s\S]*'system'[\s\S]*'user'[\s\S]*'legacy'/);
  assert.match(migration, /DROP CONSTRAINT IF EXISTS agent_skills_name_key/);
  assert.match(migration, /agent_skills_user_name_idx/);
  assert.match(migration, /knowledge_documents_user_updated_idx/);
  assert.match(migration, /canvas_runtime_snapshots_user_canvas_idx/);
  assert.match(migration, /owner_scope = 'user' AND user_id IS NULL/);
  assert.match(migration, /owner_scope IN \('system', 'legacy'\) AND user_id IS NOT NULL/);
  for (const tableName of ['knowledge_documents', 'agent_skills', 'canvas_runtime_snapshots']) {
    assert.match(
      migration,
      new RegExp(`ALTER TABLE public\\.${tableName}[\\s\\S]{0,180}ALTER COLUMN owner_scope SET DEFAULT 'legacy'[\\s\\S]{0,120}ALTER COLUMN owner_scope SET NOT NULL`),
    );
  }
  assert.match(migration, /agent_runs[\s\S]*step_results jsonb/);
  assert.match(migration, /UPDATE public\.agent_runs SET step_results = '\[\]'::jsonb WHERE step_results IS NULL/);
  assert.match(migration, /ALTER COLUMN step_results SET DEFAULT '\[\]'::jsonb,[\s\S]{0,100}ALTER COLUMN step_results SET NOT NULL/);
  assert.match(migration, /^BEGIN;/);
  assert.match(migration, /ALTER TABLE public\.agent_runs[\s\S]*ADD COLUMN IF NOT EXISTS user_id text/);
  assert.match(migration, /UPDATE public\.agent_runs SET user_id = 'legacy' WHERE user_id IS NULL/);
  assert.match(migration, /ALTER TABLE public\.agent_runs[\s\S]*ALTER COLUMN user_id SET NOT NULL/);
  assert.match(migration, /agent_runs_user_updated_idx/);
  assert.match(migration, /SET LOCAL lock_timeout = '10s'/);
  assert.match(migration, /SET LOCAL statement_timeout = '5min'/);
  assert.match(migration, /COMMIT;\s*$/);
  assert.match(migration, /agent_tool_calls[\s\S]*failure_class text[\s\S]*retryable boolean/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.agent_skill_versions/);
  assert.match(migration, /PRIMARY KEY \(user_id, skill_key\)/);
  assert.match(migration, /INSERT INTO public\.agent_skill_versions[\s\S]*SELECT user_id, name, updated_at, false[\s\S]*FROM public\.agent_skills/);
});

test('AI assistant routes derive ownership from authentication and keep only system knowledge shared read-only', () => {
  const source = readSource('server/routes/ai-assistant.js');

  assert.match(source, /INSERT INTO public\.agent_skills \([\s\S]*user_id[\s\S]*owner_scope/);
  assert.match(source, /ON CONFLICT \(user_id, name\)[\s\S]*owner_scope = 'user'/);
  assert.match(source, /DELETE FROM public\.agent_skills[\s\S]*user_id = \$2[\s\S]*owner_scope = 'user'/);
  assert.match(source, /INSERT INTO public\.knowledge_documents \([\s\S]*user_id[\s\S]*owner_scope/);
  assert.match(source, /public\.knowledge_documents\.user_id = EXCLUDED\.user_id/);
  assert.match(source, /owner_scope = 'system'/);
  assert.match(source, /owner_scope = 'user' AND user_id = \$\d/);
  assert.match(source, /mapKnowledgeDocumentRow/);
  assert.match(source, /mapAgentSkillRow/);
  assert.match(source, /updatedAt/);
  assert.match(source, /VALUES \(\$2, \$3, \$10::timestamptz, false\)[\s\S]*public\.agent_skill_versions\.updated_at < EXCLUDED\.updated_at/);
  assert.match(source, /public\.agent_skills\.updated_at <= EXCLUDED\.updated_at/);
  assert.match(source, /stale: true/);
  assert.match(source, /readAuthoritativeSkillState/);
  assert.match(source, /authoritativeUpdatedAt/);
  assert.match(source, /authoritativeDeleted/);
  assert.match(source, /INSERT INTO public\.agent_skill_versions[\s\S]*ON CONFLICT \(user_id, skill_key\)/);
  assert.match(source, /public\.agent_skill_versions\.updated_at <= EXCLUDED\.updated_at/);
  assert.match(source, /deleted = EXCLUDED\.deleted/);
  assert.match(source, /WITH accepted_version AS[\s\S]*DELETE FROM public\.agent_skills/);
  assert.match(source, /SELECT name[\s\S]*WHERE id = \$1[\s\S]*user_id = \$2[\s\S]*owner_scope = 'user'/);
  assert.match(source, /existingById[\s\S]*existingById\.name !== name[\s\S]*Skill id\/name mismatch/);
  assert.match(source, /DELETE FROM public\.agent_skills AS skill[\s\S]*WHERE skill\.name = \$4[\s\S]*skill\.user_id = \$2/);
  assert.doesNotMatch(source, /skill\.id = \$1 OR skill\.name = \$4/);
  assert.doesNotMatch(source, /id = EXCLUDED\.id/);
  assert.match(source, /existingSkill[\s\S]*existingSkill\.name !== name[\s\S]*Skill name is immutable/);
  assert.doesNotMatch(source, /owner_scope IN \('system', 'legacy'\)/);
  assert.doesNotMatch(source, /DELETE FROM public\.agent_skills WHERE id = \$1 OR name = \$1/);
  assert.match(source, /JOIN public\.agent_runs AS agent_run ON agent_run\.id = tool_call\.run_id/);
  assert.match(source, /existingCall\.user_id !== req\.userId \|\| existingCall\.run_id !== runId/);
  assert.match(source, /Agent tool-call ownership conflict/);
  assert.doesNotMatch(source, /details:\s*err\.message/);
});

test('VPS bootstrap and deploy paths apply the scoped AI assistant schema', () => {
  const bootstrap = readSource('scripts/postgres/bootstrap-kk-vps.sql');
  const deploy = readSource('scripts/vps/deploy-kk-vps.sh');
  const provision = readSource('scripts/vps/bootstrap-kk-vps.sh');
  const windowsSetup = readSource('scripts/setup/setup-database.bat');

  assert.match(bootstrap, /CREATE TABLE IF NOT EXISTS public\.agent_runs/);
  assert.match(bootstrap, /CREATE TABLE IF NOT EXISTS public\.knowledge_documents/);
  assert.match(bootstrap, /agent_skills_user_name_idx/);
  assert.match(bootstrap, /CREATE TABLE IF NOT EXISTS public\.agent_skill_versions/);
  assert.match(bootstrap, /INSERT INTO public\.agent_skill_versions[\s\S]*FROM public\.agent_skills/);
  assert.match(deploy, /apply_database_migrations/);
  assert.match(deploy, /Applying mandatory AI assistant user-scope migration/);
  assert.match(deploy, /psql[\s\S]*AI_ASSISTANT_SCOPE_MIGRATION_PATH/);
  assert.match(deploy, /AI owner_scope columns are missing or do not enforce canonical NOT NULL legacy defaults/);
  assert.match(deploy, /'knowledge_documents', 'created_at'[\s\S]*'canvas_runtime_snapshots', 'updated_at'/);
  assert.match(deploy, /AI assistant timestamp columns are missing or are not timestamptz/);
  assert.match(provision, /016_ai_assistant_user_scope\.sql/);
  assert.match(windowsSetup, /016_ai_assistant_user_scope\.sql/);

  const buildIndex = deploy.indexOf('build_static_sites\n');
  const stopIndex = deploy.indexOf('stop_api_services_for_schema_cutover\n');
  const migrationIndex = deploy.indexOf('apply_database_migrations\n');
  const switchIndex = deploy.indexOf('atomic_switch_symlinks\n');
  const unitInstallIndex = deploy.indexOf('install_systemd_units\n');
  assert.ok(buildIndex >= 0 && buildIndex < stopIndex);
  assert.ok(stopIndex < migrationIndex && migrationIndex < switchIndex);
  assert.ok(switchIndex < unitInstallIndex);
  assert.match(deploy, /SCHEMA_CUTOVER_APPLIED/);
  assert.match(deploy, /SCHEMA_MIGRATION_ATTEMPTED=true[\s\S]*psql/);
  assert.match(deploy, /trap on_exit EXIT/);
  assert.doesNotMatch(deploy, /trap[^\n]*ERR/);
  assert.match(deploy, /ACTIVE_API_SERVICES_BEFORE_CUTOVER[\s\S]*systemctl show[\s\S]*ActiveState/);
  assert.match(deploy, /for service in "\$\{ACTIVE_API_SERVICES_BEFORE_CUTOVER\[@\]\}"/);
  assert.match(deploy, /install -m 0644 "\$\{api_unit\}" \/etc\/systemd\/system\/kk-api\.service/);
  assert.match(deploy, /COMMIT_SHA="\$\(git rev-parse --verify HEAD/);
  assert.doesNotMatch(deploy, /git rev-parse --short HEAD/);
  assert.match(deploy, /COMMIT_SHORT_SHA="\$\{COMMIT_SHA:0:7\}"/);
  assert.match(deploy, /RELEASE_NAME="\$\{TIMESTAMP\}-\$\{COMMIT_SHORT_SHA\}"/);
  assert.match(deploy, /KK_STUDIO_COMMIT_SHA='\$\{COMMIT_SHA\}' npm run build/);
  assert.match(deploy, /if ! unit_listing="\$\(systemctl list-unit-files[\s\S]*return 1/);
  assert.match(deploy, /if ! active_state="\$\(systemctl show[\s\S]*ActiveState[\s\S]*return 1/);
  assert.match(deploy, /case "\$\{active_state\}"[\s\S]*active\|activating\|reloading\|refreshing[\s\S]*inactive\|failed\|deactivating/);
  assert.match(deploy, /esac[\s\S]*if ! systemctl stop "\$\{service\}"/);
  assert.doesNotMatch(deploy, /if systemctl is-active/);
  const viteConfig = readSource('apps/web/vite.config.ts');
  assert.match(viteConfig, /const commitSha = process\.env\.KK_STUDIO_COMMIT_SHA[\s\S]*process\.env\.VERCEL_GIT_COMMIT_SHA/);
});

test('temporary user headers require explicit local-only mode and VPS defaults to production', () => {
  const compat = readSource('server/routes/compat/compatHelper.js');
  const adminRoute = readSource('server/routes/compat/admin.js');
  const aiRoute = readSource('server/routes/ai-assistant.js');
  const directTempRoutes = [
    'server/routes/user-api-payload-router.js',
    'server/routes/user/auth.js',
    'server/routes/user/profile.js',
    'server/routes/user/wuyin.js',
  ].map(readSource).join('\n');
  const envExample = readSource('scripts/vps/kk-api.env.example');
  const systemd = readSource('config/deploy/systemd/kk-api.service');

  assert.match(compat, /const allowLocalTempUser = process\.env\.KKAI_LOCAL_ONLY === 'true'/);
  assert.doesNotMatch(compat, /allowLocalTempUser[\s\S]{0,120}NODE_ENV !== 'production'/);
  assert.doesNotMatch(directTempRoutes, /allowLocalTempUser\s*=\s*process\.env\.KKAI_LOCAL_ONLY === 'true'\s*\|\|/);
  assert.doesNotMatch(adminRoute, /allowLocalPassword[\s\S]{0,120}NODE_ENV !== 'production'/);
  assert.match(aiRoute, /const hasLocalTempHeader = process\.env\.KKAI_LOCAL_ONLY === 'true'/);
  assert.doesNotMatch(aiRoute, /resolveRequestUserId/);
  assert.match(envExample, /^NODE_ENV=production$/m);
  assert.match(envExample, /^KKAI_LOCAL_ONLY=false$/m);
  assert.match(systemd, /^Environment=NODE_ENV=production$/m);
});

test('temporary owner resolution is denied by default and enabled only in explicit local-only mode', () => {
  const { resolveRequestUserId } = require('../../server/routes/compat/compatHelper.js');
  const previousLocalOnly = process.env.KKAI_LOCAL_ONLY;
  const previousNodeEnv = process.env.NODE_ENV;
  const request = {
    headers: { 'x-kk-temp-user-id': 'temp-victim-owner' },
    body: {},
  };

  try {
    delete process.env.KKAI_LOCAL_ONLY;
    delete process.env.NODE_ENV;
    assert.equal(resolveRequestUserId(request, { allowTemp: true }), null);

    process.env.NODE_ENV = 'development';
    assert.equal(resolveRequestUserId(request, { allowTemp: true }), null);

    process.env.KKAI_LOCAL_ONLY = 'true';
    assert.equal(resolveRequestUserId(request, { allowTemp: true }), 'temp-victim-owner');
    assert.equal(resolveRequestUserId(request, { allowTemp: false }), null);
  } finally {
    if (previousLocalOnly === undefined) delete process.env.KKAI_LOCAL_ONLY;
    else process.env.KKAI_LOCAL_ONLY = previousLocalOnly;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
});

test('AI assistant auth never falls back from an invalid Bearer credential to cookies or local headers', (t) => {
  const routePath = require.resolve('../../server/routes/ai-assistant.js');
  const jwtPath = require.resolve('../../server/lib/jwt.js');
  const previousNodeEnv = process.env.NODE_ENV;
  const previousJwtSecret = process.env.JWT_SECRET;
  const previousLocalOnly = process.env.KKAI_LOCAL_ONLY;
  process.env.NODE_ENV = 'production';
  process.env.JWT_SECRET = 'ai-assistant-strict-auth-test-secret';
  delete process.env.KKAI_LOCAL_ONLY;
  delete require.cache[routePath];
  delete require.cache[jwtPath];
  const { signJWT } = require(jwtPath);
  const router = require(routePath);
  const verifyAuth = router.stack.find((layer: any) => layer.route?.path === '/ai-assistant/runs')
    ?.route?.stack?.[0]?.handle;
  assert.equal(typeof verifyAuth, 'function');

  t.after(() => {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousJwtSecret;
    if (previousLocalOnly === undefined) delete process.env.KKAI_LOCAL_ONLY;
    else process.env.KKAI_LOCAL_ONLY = previousLocalOnly;
    delete require.cache[routePath];
    delete require.cache[jwtPath];
  });

  const invoke = (headers: Record<string, string>) => {
    let statusCode = 200;
    let responseBody: any;
    let nextCalled = false;
    const request: any = {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: {},
      is: (type: string) => type === 'application/json',
    };
    const response = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(payload: any) {
        responseBody = payload;
        return this;
      },
    };
    verifyAuth(request, response, () => {
      nextCalled = true;
    });
    return { statusCode, responseBody, nextCalled, userId: request.userId };
  };

  const cookieToken = signJWT({ userId: 'cookie-user' });
  const bearerToken = signJWT({ userId: 'bearer-user' });
  const invalidWithCookie = invoke({
    authorization: 'Bearer invalid-token',
    cookie: `kk.api.access_token=${cookieToken}`,
  });
  assert.equal(invalidWithCookie.statusCode, 401);
  assert.equal(invalidWithCookie.nextCalled, false);

  const cookieOnly = invoke({ cookie: `kk.api.access_token=${cookieToken}` });
  assert.equal(cookieOnly.statusCode, 401);
  assert.equal(cookieOnly.nextCalled, false);

  const validBearer = invoke({
    authorization: `Bearer ${bearerToken}`,
    cookie: `kk.api.access_token=${cookieToken}`,
  });
  assert.equal(validBearer.nextCalled, true);
  assert.equal(validBearer.userId, 'bearer-user');

  process.env.KKAI_LOCAL_ONLY = 'true';
  const invalidWithLocalHeader = invoke({
    authorization: 'Bearer invalid-token',
    'x-kk-temp-user-id': 'temp-local-user',
  });
  assert.equal(invalidWithLocalHeader.statusCode, 401);
  assert.equal(invalidWithLocalHeader.nextCalled, false);
});

test('Skill delete rejects an owned id/name mismatch before writing a deletion version', async (t) => {
  const dbPath = require.resolve('../../server/lib/db.js');
  const routePath = require.resolve('../../server/routes/ai-assistant.js');
  const dbModule = require(dbPath) as { getPool: () => unknown };
  const originalGetPool = dbModule.getPool;
  const previousNodeEnv = process.env.NODE_ENV;
  let currentPool: { query: (sql: string, params: unknown[]) => Promise<{ rows: any[] }> };

  dbModule.getPool = () => currentPool;
  process.env.NODE_ENV = 'test';
  delete require.cache[routePath];
  const router = require(routePath);
  t.after(() => {
    dbModule.getPool = originalGetPool;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    delete require.cache[routePath];
  });

  const routeLayer = router.stack.find((layer: any) => (
    layer.route?.path === '/ai-assistant/skills/:id'
    && layer.route?.methods?.delete === true
  ));
  assert.ok(routeLayer);
  const [verifyAuth, deleteHandler] = routeLayer.route.stack.map((layer: any) => layer.handle);

  const invokeDelete = async (id: string, name: string, preflightRows: any[]) => {
    const queries: Array<{ sql: string; params: unknown[] }> = [];
    currentPool = {
      async query(sql: string, params: unknown[]) {
        queries.push({ sql, params });
        if (queries.length === 1) return { rows: preflightRows };
        return { rows: [{ accepted: true, deleted: true }] };
      },
    };
    let statusCode = 200;
    let responseBody: any;
    const request = {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      params: { id },
      body: { name, updatedAt: '2026-07-19T00:00:00.000Z' },
    };
    const response = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(payload: any) {
        responseBody = payload;
        return this;
      },
    };
    await new Promise<void>((resolve, reject) => {
      const next = () => {
        Promise.resolve(deleteHandler(request, response)).then(() => resolve(), reject);
      };
      try {
        verifyAuth(request, response, next);
      } catch (error) {
        reject(error);
      }
    });
    return { statusCode, responseBody, queries };
  };

  const mismatch = await invokeDelete('skill-a', 'skill-b', [{ name: 'skill-a' }]);
  assert.equal(mismatch.statusCode, 409);
  assert.equal(mismatch.responseBody.error, 'Skill id/name mismatch');
  assert.equal(mismatch.queries.length, 1);

  const unknownLocalId = await invokeDelete('local-only-id', 'canonical-skill', []);
  assert.equal(unknownLocalId.statusCode, 200);
  assert.equal(unknownLocalId.responseBody.deleted, true);
  assert.equal(unknownLocalId.queries.length, 2);
  assert.match(unknownLocalId.queries[1]?.sql || '', /WHERE skill\.name = \$4/);

  const matchingIdentity = await invokeDelete('skill-a', 'skill-a', [{ name: 'skill-a' }]);
  assert.equal(matchingIdentity.statusCode, 200);
  assert.equal(matchingIdentity.queries.length, 2);
});

test('Skill POST and DELETE stale responses return an authoritative Skill state or tombstone', async (t) => {
  const dbPath = require.resolve('../../server/lib/db.js');
  const routePath = require.resolve('../../server/routes/ai-assistant.js');
  const dbModule = require(dbPath) as { getPool: () => unknown };
  const originalGetPool = dbModule.getPool;
  const previousNodeEnv = process.env.NODE_ENV;
  let currentPool: { query: (sql: string, params: unknown[]) => Promise<{ rows: any[] }> };

  dbModule.getPool = () => currentPool;
  process.env.NODE_ENV = 'test';
  delete require.cache[routePath];
  const router = require(routePath);
  t.after(() => {
    dbModule.getPool = originalGetPool;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    delete require.cache[routePath];
  });

  const postLayer = router.stack.find((layer: any) => (
    layer.route?.path === '/ai-assistant/skills'
    && layer.route?.methods?.post === true
  ));
  const deleteLayer = router.stack.find((layer: any) => (
    layer.route?.path === '/ai-assistant/skills/:id'
    && layer.route?.methods?.delete === true
  ));
  assert.ok(postLayer && deleteLayer);
  const [verifyPost, postHandler] = postLayer.route.stack.map((layer: any) => layer.handle);
  const [verifyDelete, deleteHandler] = deleteLayer.route.stack.map((layer: any) => layer.handle);
  const invoke = async (verify: any, handler: any, request: any) => {
    request.method ||= request.params ? 'DELETE' : 'POST';
    request.headers ||= { 'content-type': 'application/json' };
    let statusCode = 200;
    let responseBody: any;
    const response = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(payload: any) {
        responseBody = payload;
        return this;
      },
    };
    await new Promise<void>((resolve, reject) => {
      const next = () => Promise.resolve(handler(request, response)).then(() => resolve(), reject);
      try {
        verify(request, response, next);
      } catch (error) {
        reject(error);
      }
    });
    return { statusCode, responseBody };
  };

  let queryIndex = 0;
  currentPool = {
    async query() {
      queryIndex += 1;
      if (queryIndex === 1) return { rows: [] };
      if (queryIndex === 2) return { rows: [] };
      return {
        rows: [{
          authoritative_updated_at: new Date('2026-07-19T08:00:00.000Z'),
          authoritative_deleted: true,
        }],
      };
    },
  };
  const stalePost = await invoke(verifyPost, postHandler, {
    body: {
      id: 'skill-local',
      name: 'server-deleted-skill',
      trigger: 'local',
      tools: ['knowledge.searchProject'],
      steps: ['read'],
      updatedAt: '2026-07-19T07:59:59.000Z',
    },
  });
  assert.equal(stalePost.statusCode, 200);
  assert.equal(stalePost.responseBody.stale, true);
  assert.equal(stalePost.responseBody.authoritativeDeleted, true);
  assert.equal(stalePost.responseBody.authoritativeUpdatedAt, '2026-07-19T08:00:00.000Z');
  assert.equal(stalePost.responseBody.data, undefined);

  queryIndex = 0;
  currentPool = {
    async query() {
      queryIndex += 1;
      if (queryIndex === 1) return { rows: [{ name: 'server-newer-skill' }] };
      if (queryIndex === 2) return { rows: [{ accepted: false, deleted: false }] };
      return {
        rows: [{
          id: 'skill-server-v3',
          user_id: 'test-user',
          owner_scope: 'user',
          name: 'server-newer-skill',
          trigger_text: 'server v3',
          tools: ['knowledge.searchProject'],
          steps: ['read v3'],
          safety: [],
          validation: [],
          knowledge_updates: [],
          created_at: new Date('2026-07-19T07:00:00.000Z'),
          updated_at: new Date('2026-07-19T08:00:00.000Z'),
          authoritative_updated_at: new Date('2026-07-19T08:00:00.000Z'),
          authoritative_deleted: false,
        }],
      };
    },
  };
  const staleDelete = await invoke(verifyDelete, deleteHandler, {
    params: { id: 'skill-server-v3' },
    body: {
      name: 'server-newer-skill',
      updatedAt: '2026-07-19T07:30:00.000Z',
    },
  });
  assert.equal(staleDelete.statusCode, 200);
  assert.equal(staleDelete.responseBody.stale, true);
  assert.equal(staleDelete.responseBody.authoritativeDeleted, false);
  assert.equal(staleDelete.responseBody.authoritativeUpdatedAt, '2026-07-19T08:00:00.000Z');
  assert.equal(staleDelete.responseBody.data.id, 'skill-server-v3');
  assert.equal(staleDelete.responseBody.data.trigger, 'server v3');
});
