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

const PLACEHOLDER_SECRET_PATTERNS = [
  'your-',
  'example',
  'replace',
  'changeme',
  '<',
  'todo',
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

function isPlaceholderSecret(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return false;
  return PLACEHOLDER_SECRET_PATTERNS.some((pattern) => normalized.includes(pattern));
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

async function loadSchemaCatalog(supabaseUrl, apiKey) {
  if (!supabaseUrl || !apiKey) {
    return {
      ok: false,
      detail: 'missing service-role key',
      spec: null,
    };
  }

  if (isPlaceholderSecret(apiKey)) {
    return {
      ok: false,
      detail: 'placeholder service-role key detected',
      spec: null,
    };
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/`, {
    method: 'GET',
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/openapi+json',
    },
  }).catch((error) => ({
    ok: false,
    status: 0,
    json: async () => null,
    text: async () => error.message,
  }));

  if (response.ok) {
    return {
      ok: true,
      detail: 'openapi schema loaded',
      spec: await response.json(),
    };
  }

  const detail = await response.text().catch(() => '');
  return {
    ok: false,
    detail: `${response.status} ${detail || 'failed to load schema metadata'}`.trim(),
    spec: null,
  };
}

function probeCatalogPath(spec, pathName) {
  const exists = Boolean(spec?.paths && Object.prototype.hasOwnProperty.call(spec.paths, pathName));
  return {
    exists,
    status: exists ? 200 : 404,
    detail: exists ? 'openapi schema' : 'missing from openapi schema',
  };
}

function probeRpcFromCatalog(spec, rpcName) {
  return probeCatalogPath(spec, `/rpc/${rpcName}`);
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
  const response = await fetch(`${supabaseUrl}/rest/v1/`, {
    method: 'GET',
  }).catch((error) => ({
    status: 0,
    text: async () => error.message,
  }));

  const detail = await response.text().catch(() => '');
  return {
    ok: response.status > 0,
    status: response.status,
    detail: detail ? detail.slice(0, 120) : 'reachable',
  };
}

function logCheck(label, ok, detail = '') {
  const prefix = ok ? '[OK]' : '[FAIL]';
  console.log(`${prefix} ${label}${detail ? ` - ${detail}` : ''}`);
}

function logNote(label, detail = '') {
  console.log(`[INFO] ${label}${detail ? ` - ${detail}` : ''}`);
}

export async function runAudit() {
  const rootEnv = {
    ...parseEnvFile(path.join(repoRoot, '.env')),
    ...parseEnvFile(path.join(repoRoot, '.env.local')),
  };
  const paymentEnvExample = parseEnvFile(path.join(repoRoot, 'payment-server', '.env.example'));
  const paymentEnv = parseEnvFile(path.join(repoRoot, 'payment-server', '.env'));
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
  const paymentSupabaseUrl = paymentEnv.SUPABASE_URL || paymentEnvExample.SUPABASE_URL || '';
  const paymentServiceRoleKey =
    paymentEnv.SUPABASE_SERVICE_ROLE_KEY ||
    paymentEnv.SUPABASE_SECRET_KEY ||
    '';
  const paymentServiceRoleKeyFromExample =
    paymentEnvExample.SUPABASE_SERVICE_ROLE_KEY ||
    paymentEnvExample.SUPABASE_SECRET_KEY ||
    '';
  const auditServiceRoleKey =
    paymentServiceRoleKey ||
    rootEnv.SUPABASE_SERVICE_ROLE_KEY ||
    rootEnv.SUPABASE_SECRET_KEY ||
    '';

  const expectedRef = projectRef || projectRefFromUrl(supabaseUrl);
  const currentRef = projectRefFromUrl(supabaseUrl);
  const builtinRef = projectRefFromUrl(builtin.url);
  const paymentRef = projectRefFromUrl(paymentSupabaseUrl);
  const schemaCatalog = supabaseUrl
    ? await loadSchemaCatalog(supabaseUrl, auditServiceRoleKey)
    : { ok: false, detail: 'missing supabase url', spec: null };

  const paymentServiceRoleConfigured =
    Boolean(paymentServiceRoleKey) && !isPlaceholderSecret(paymentServiceRoleKey);
  const paymentServiceRoleDetail = paymentServiceRoleConfigured
    ? 'configured in payment-server/.env'
    : paymentServiceRoleKeyFromExample
      ? 'missing in payment-server/.env (only placeholder remains in payment-server/.env.example)'
      : 'missing in payment-server/.env';
  const paymentServiceRoleMatchesProject =
    schemaCatalog.ok && paymentServiceRoleConfigured && paymentRef === expectedRef;

  console.log('========================================');
  console.log('Supabase Runtime Audit');
  console.log('========================================');
  console.log(`Project ref: ${expectedRef || '(missing)'}`);
  console.log(`Supabase URL: ${supabaseUrl || '(missing)'}`);
  console.log(`Functions URL: ${functionsBaseUrl(supabaseUrl) || '(missing)'}`);
  console.log('');

  let hasFailures = false;

  const connection = Boolean(supabaseUrl)
    ? await checkConnection(supabaseUrl)
    : { ok: false, status: 0, detail: 'missing supabase url' };
  logCheck('Public Supabase endpoint reachable', connection.ok, `${connection.status} ${connection.detail}`.trim());
  hasFailures ||= !connection.ok;

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

  logCheck('payment-server service-role key configured', paymentServiceRoleConfigured, paymentServiceRoleDetail);
  hasFailures ||= !paymentServiceRoleConfigured;

  logCheck('Server-side schema introspection available', schemaCatalog.ok, schemaCatalog.detail);
  hasFailures ||= !schemaCatalog.ok;

  logCheck(
    'payment-server service-role key matches current project',
    paymentServiceRoleMatchesProject,
    paymentServiceRoleMatchesProject
      ? 'schema metadata loaded for current project'
      : 'cannot verify without a valid payment-server service-role key',
  );
  hasFailures ||= !paymentServiceRoleMatchesProject;

  if (supabaseUrl && publishableKey) {
    console.log('');
    console.log('Objects');

    const probeTableOrView = async (name) => {
      if (schemaCatalog.ok) {
        return probeCatalogPath(schemaCatalog.spec, `/${name}`);
      }
      return probeRestObject(supabaseUrl, publishableKey, name);
    };

    for (const tableName of REQUIRED_TABLES) {
      const result = await probeTableOrView(tableName);
      logCheck(`table:${tableName}`, result.exists, `${result.status} ${result.detail}`);
      hasFailures ||= !result.exists;
    }

    for (const viewName of REQUIRED_VIEWS) {
      const result = await probeTableOrView(viewName);
      logCheck(`view:${viewName}`, result.exists, `${result.status} ${result.detail}`);
      hasFailures ||= !result.exists;
    }

    if (schemaCatalog.ok) {
      for (const rpcName of REQUIRED_RPCS) {
        const result = probeRpcFromCatalog(schemaCatalog.spec, rpcName);
        logCheck(`rpc:${rpcName}`, result.exists, `${result.status} ${result.detail}`);
        hasFailures ||= !result.exists;
      }
    } else {
      logCheck('rpc-catalog', false, 'requires valid service-role key for non-destructive RPC audit');
      hasFailures = true;
      for (const rpcName of REQUIRED_RPCS) {
        logNote(`rpc:${rpcName}`, 'not checked');
      }
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
