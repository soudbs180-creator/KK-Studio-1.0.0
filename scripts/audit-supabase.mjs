import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.join(__dirname, '..');

const REQUIRED_TABLES = [
  'profiles',
  'user_credits',
  'credit_transactions',
  'admin_credit_models',
  'temp_users',
];

const REQUIRED_VIEWS = [
  'available_models_for_users',
];

const REQUIRED_RPCS = [
  'get_or_create_user_credits',
  'check_user_credits',
  'consume_credits',
  'refund_credits',
  'deduct_user_credits',
  'admin_recharge_credits',
  'process_payment_recharge',
  'get_active_credit_models',
  'is_admin',
  'verify_admin_password',
];

const REQUIRED_EDGE_FUNCTIONS = [
  'secure-model-proxy',
];

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};

  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .reduce((acc, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return acc;

      const separatorIndex = trimmed.indexOf('=');
      if (separatorIndex <= 0) return acc;

      const key = trimmed.slice(0, separatorIndex).trim();
      let value = trimmed.slice(separatorIndex + 1).trim();
      value = value.replace(/^['"]|['"]$/g, '');
      acc[key] = value;
      return acc;
    }, {});
}

function extractBuiltinSupabaseConfig() {
  const filePath = path.join(repoRoot, 'src', 'lib', 'supabase.ts');
  const source = fs.readFileSync(filePath, 'utf8');
  const urlMatch = source.match(/const BUILTIN_SUPABASE_URL = '([^']+)'/);
  const keyMatch = source.match(/const BUILTIN_SUPABASE_ANON_KEY = '([^']+)'/);

  return {
    url: urlMatch?.[1] || '',
    key: keyMatch?.[1] || '',
  };
}

function readProjectRef() {
  const filePath = path.join(repoRoot, 'supabase', '.temp', 'project-ref');
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8').trim() : '';
}

function projectRefFromUrl(url) {
  const match = String(url || '').match(/^https:\/\/([^.]+)\.supabase\.co/i);
  return match?.[1] || '';
}

function functionsBaseUrl(url) {
  const ref = projectRefFromUrl(url);
  return ref ? `https://${ref}.functions.supabase.co` : '';
}

function restHeaders(apiKey, bearerToken = apiKey) {
  return {
    apikey: apiKey,
    Authorization: `Bearer ${bearerToken}`,
    'Content-Type': 'application/json',
  };
}

async function probeRestObject(supabaseUrl, apiKey, objectName) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${objectName}?select=*&limit=1`, {
    method: 'GET',
    headers: restHeaders(apiKey),
  });

  if (response.status === 404) {
    return { exists: false, status: response.status, detail: 'missing' };
  }

  if (response.ok) {
    return { exists: true, status: response.status, detail: 'ok' };
  }

  const detail = await response.text().catch(() => '');
  if (/permission denied|forbidden|jwt|row-level|rls/i.test(detail)) {
    return { exists: true, status: response.status, detail: 'permission-limited' };
  }

  return { exists: response.status !== 404, status: response.status, detail };
}

async function probeRpc(supabaseUrl, apiKey, rpcName) {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${rpcName}`, {
    method: 'POST',
    headers: restHeaders(apiKey),
    body: JSON.stringify({}),
  });

  if (response.status === 404) {
    return { exists: false, status: response.status, detail: 'missing' };
  }

  if (response.ok) {
    return { exists: true, status: response.status, detail: 'ok' };
  }

  const detail = await response.text().catch(() => '');
  return {
    exists: response.status !== 404,
    status: response.status,
    detail: detail || 'rpc responded with validation/auth error',
  };
}

async function probeEdgeFunction(supabaseUrl, apiKey, functionName) {
  const baseUrl = functionsBaseUrl(supabaseUrl);
  if (!baseUrl) {
    return { exists: false, status: 0, detail: 'invalid functions base url' };
  }

  const response = await fetch(`${baseUrl}/${functionName}`, {
    method: 'POST',
    headers: restHeaders(apiKey),
    body: JSON.stringify({ mode: 'healthcheck' }),
  }).catch((error) => ({
    ok: false,
    status: 0,
    text: async () => error.message,
  }));

  if (response.status === 404) {
    return { exists: false, status: response.status, detail: 'missing' };
  }

  if (response.ok) {
    return { exists: true, status: response.status, detail: 'ok' };
  }

  const detail = await response.text().catch(() => '');
  return {
    exists: response.status !== 404,
    status: response.status,
    detail: detail || 'edge function responded with auth or runtime error',
  };
}

async function checkConnection(supabaseUrl) {
  const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
    method: 'GET',
  });

  return response.ok;
}

function logCheck(label, ok, detail = '') {
  const prefix = ok ? '[OK]' : '[FAIL]';
  console.log(`${prefix} ${label}${detail ? ` - ${detail}` : ''}`);
}

export async function runAudit() {
  const rootEnv = {
    ...parseEnvFile(path.join(repoRoot, '.env')),
    ...parseEnvFile(path.join(repoRoot, '.env.local')),
  };
  const paymentEnv = {
    ...parseEnvFile(path.join(repoRoot, 'payment-server', '.env.example')),
    ...parseEnvFile(path.join(repoRoot, 'payment-server', '.env')),
  };
  const builtin = extractBuiltinSupabaseConfig();
  const projectRef = readProjectRef();

  const supabaseUrl =
    rootEnv.SUPABASE_URL ||
    rootEnv.VITE_SUPABASE_URL ||
    builtin.url;
  const publishableKey =
    rootEnv.SUPABASE_ANON_KEY ||
    rootEnv.VITE_SUPABASE_ANON_KEY ||
    builtin.key;
  const paymentSupabaseUrl = paymentEnv.SUPABASE_URL || '';
  const serviceRoleKey =
    paymentEnv.SUPABASE_SERVICE_ROLE_KEY ||
    paymentEnv.SUPABASE_SECRET_KEY ||
    rootEnv.SUPABASE_SERVICE_ROLE_KEY ||
    '';

  const expectedRef = projectRef || projectRefFromUrl(supabaseUrl);
  const currentRef = projectRefFromUrl(supabaseUrl);
  const builtinRef = projectRefFromUrl(builtin.url);
  const paymentRef = projectRefFromUrl(paymentSupabaseUrl);

  console.log('========================================');
  console.log('Supabase Runtime Audit');
  console.log('========================================');
  console.log(`Project ref: ${expectedRef || '(missing)'}`);
  console.log(`Supabase URL: ${supabaseUrl || '(missing)'}`);
  console.log(`Functions URL: ${functionsBaseUrl(supabaseUrl) || '(missing)'}`);
  console.log('');

  let hasFailures = false;

  const connectionOk = Boolean(supabaseUrl) && (await checkConnection(supabaseUrl).catch(() => false));
  logCheck('Public Supabase endpoint reachable', connectionOk);
  hasFailures ||= !connectionOk;

  const builtinAligned = Boolean(builtin.url) && builtinRef === expectedRef;
  logCheck('Built-in client config matches project ref', builtinAligned, builtin.url || 'missing built-in config');
  hasFailures ||= !builtinAligned;

  const envAligned = Boolean(supabaseUrl) && currentRef === expectedRef;
  logCheck('Root env/client URL matches project ref', envAligned);
  hasFailures ||= !envAligned;

  const paymentAligned = Boolean(paymentSupabaseUrl) && paymentRef === expectedRef;
  logCheck('payment-server SUPABASE_URL matches project ref', paymentAligned, paymentSupabaseUrl || 'missing payment-server URL');
  hasFailures ||= !paymentAligned;

  const hasPublishableKey = Boolean(publishableKey);
  logCheck('Publishable key configured', hasPublishableKey);
  hasFailures ||= !hasPublishableKey;

  const hasServiceRoleKey = Boolean(serviceRoleKey);
  logCheck('Service-role key available for server-side checks', hasServiceRoleKey, hasServiceRoleKey ? 'configured' : 'missing');

  if (supabaseUrl && publishableKey) {
    console.log('');
    console.log('Objects');

    for (const tableName of REQUIRED_TABLES) {
      const result = await probeRestObject(supabaseUrl, publishableKey, tableName);
      logCheck(`table:${tableName}`, result.exists, `${result.status} ${result.detail}`);
      hasFailures ||= !result.exists;
    }

    for (const viewName of REQUIRED_VIEWS) {
      const result = await probeRestObject(supabaseUrl, publishableKey, viewName);
      logCheck(`view:${viewName}`, result.exists, `${result.status} ${result.detail}`);
      hasFailures ||= !result.exists;
    }

    for (const rpcName of REQUIRED_RPCS) {
      const result = await probeRpc(supabaseUrl, publishableKey, rpcName);
      logCheck(`rpc:${rpcName}`, result.exists, `${result.status} ${result.detail}`);
      hasFailures ||= !result.exists;
    }

    for (const functionName of REQUIRED_EDGE_FUNCTIONS) {
      const result = await probeEdgeFunction(supabaseUrl, publishableKey, functionName);
      logCheck(`edge:${functionName}`, result.exists, `${result.status} ${result.detail}`);
      hasFailures ||= !result.exists;
    }
  }

  console.log('');
  console.log('Canonical objects');
  console.log('- profiles: identity + user_apis');
  console.log('- user_credits: balance source of truth');
  console.log('- credit_transactions: canonical ledger');
  console.log('- admin_credit_models: system model routing');
  console.log('- temp_users: temporary identities');
  console.log('- secure-model-proxy: required edge runtime');

  console.log('');
  console.log(hasFailures ? 'Audit finished with failures.' : 'Audit passed.');
  console.log('========================================');

  if (hasFailures) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAudit().catch((error) => {
    console.error('[audit-supabase] Unexpected failure:', error);
    process.exitCode = 1;
  });
}
