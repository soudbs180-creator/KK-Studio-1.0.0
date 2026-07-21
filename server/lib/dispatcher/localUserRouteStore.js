const fs = require('fs/promises');
const path = require('path');
const cryptoUtil = require('../../utils/crypto');
const { getPool } = require('../db');
const { READONLY_SECRET_PLACEHOLDER } = require('../userApiSecret');

const LOCAL_STORAGE_PATH = path.resolve(__dirname, '../../../.kk-local/local-user-apis.json');

// 🚀 路由解析结果的内存缓存：避免每次请求都做全量 DB 查询 + 解密 + 索引构建
const ROUTE_CACHE_TTL_MS = 10000; // 10秒
const routeResultCache = new Map(); // key: `${userId}:${routeId}` → { route, expiresAt }

function getCachedRoute(userId, routeId) {
  const key = `${userId}:${normalizeRouteValue(routeId)}`;
  const cached = routeResultCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.route;
  }
  if (cached) {
    routeResultCache.delete(key);
  }
  return undefined; // 缓存未命中
}

function setCachedRoute(userId, routeId, route) {
  // 限制缓存大小，避免内存泄漏
  if (routeResultCache.size > 2000) {
    const oldestKey = routeResultCache.keys().next().value;
    routeResultCache.delete(oldestKey);
  }
  const key = `${userId}:${normalizeRouteValue(routeId)}`;
  routeResultCache.set(key, {
    route,
    expiresAt: Date.now() + ROUTE_CACHE_TTL_MS,
  });
}

function invalidateRouteCache(userId) {
  const prefix = `${userId}:`;
  for (const key of routeResultCache.keys()) {
    if (key.startsWith(prefix)) {
      routeResultCache.delete(key);
    }
  }
}

let cache = {
  signature: '',
  payload: { version: 2, profiles: {} },
  indexes: new Map(),
  readPromise: null,
};

function isObjectRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeProfileState(value) {
  const source = isObjectRecord(value) ? value : {};
  return {
    version: Number.parseInt(source.version, 10) || 2,
    slots: Array.isArray(source.slots) ? source.slots : [],
    providers: Array.isArray(source.providers) ? source.providers : [],
    entries: Array.isArray(source.entries) ? source.entries : [],
  };
}

function safeString(value) {
  return String(value || '').trim();
}

function normalizeRouteValue(value) {
  return safeString(value).toLowerCase();
}

function normalizeProviderLinkValue(value) {
  return safeString(value).replace(/\/+$/, '').toLowerCase();
}

function resolveRouteIdCandidate(value) {
  const decoded = (() => {
    try {
      return decodeURIComponent(safeString(value));
    } catch {
      return safeString(value);
    }
  })();
  const normalized = decoded.toLowerCase();
  if (normalized.startsWith('slot_key_')) return normalized.slice(5);
  if (normalized.startsWith('slot_')) return normalized.slice(5);
  if (normalized.startsWith('provider_')) return normalized.slice('provider_'.length);
  return normalized;
}

function buildRouteLookupCandidates(routeId) {
  return Array.from(new Set([
    normalizeRouteValue(routeId),
    resolveRouteIdCandidate(routeId),
  ].filter(Boolean)));
}

// 简体中文注释：动态根据记录的内容推导其对应的规范化 ID 候选别名，保证前端使用规范化 ID 请求路由分发时能正确找到本地路由项
function getRecordCanonicalIdCandidate(record) {
  if (!record) return null;
  const id = safeString(record.id).toLowerCase();
  const name = safeString(record.name).toLowerCase();
  const provider = safeString(record.provider).toLowerCase();
  const baseUrl = safeString(record.baseUrl).toLowerCase();

  const source = [id, name, provider, baseUrl].join(' ');

  let channel = 'custom';
  let prefix = '2000';

  const isWuyin = source.includes('wuyin') ||
                  source.includes('wuyinkeji') ||
                  source.includes('api.wuyinkeji.com') ||
                  source.includes('速创') ||
                  source.includes('五音');

  if (isWuyin) {
    channel = 'wuyinkeji-google-omni';
    prefix = '1015';
  } else if (source.includes('google') || source.includes('gemini')) {
    channel = 'google';
    prefix = '1017';
  } else if (source.includes('openai')) {
    channel = 'openai';
    prefix = '1018';
  } else if (source.includes('anthropic') || source.includes('claude')) {
    channel = 'anthropic';
    prefix = '1019';
  } else if (source.includes('deepseek')) {
    channel = 'deepseek';
    prefix = '1007';
  } else if (source.includes('siliconflow')) {
    channel = 'siliconflow';
    prefix = '1009';
  }

  return `${channel}-${prefix}-1`;
}

function recordAliases(record) {
  const canonical = getRecordCanonicalIdCandidate(record);
  return [
    safeString(record?.id),
    ...(Array.isArray(record?.legacyIds) ? record.legacyIds : []),
    safeString(record?.name),
    canonical,
  ].map(normalizeRouteValue).filter(Boolean);
}

function addRoute(index, route, options = {}) {
  for (const alias of recordAliases(route)) {
    const aliases = [alias, `provider_${alias}`, `slot_${alias}`, `slot_key_${alias}`];
    for (const item of aliases) {
      if (options.preserveExisting && index.routeByAlias.has(item)) continue;
      index.routeByAlias.set(item, route);
    }
  }
}

function buildRouteFromProvider(provider) {
  return {
    id: safeString(provider?.id),
    legacyIds: Array.isArray(provider?.legacyIds) ? provider.legacyIds : [],
    name: safeString(provider?.name),
    baseUrl: safeString(provider?.baseUrl),
    apiKey: safeString(provider?.apiKey),
    models: Array.isArray(provider?.models) ? provider.models : [],
    format: safeString(provider?.format || 'auto') || 'auto',
    endpointType: safeString(provider?.endpointType || provider?.adapterId),
    requestProfileId: safeString(provider?.requestProfileId || provider?.profileId),
    timeout: provider?.timeout,
    maxRetries: provider?.maxRetries,
  };
}

function buildRouteFromSlot(slot, linkedProvider) {
  return {
    id: safeString(slot?.id),
    legacyIds: Array.isArray(slot?.legacyIds) ? slot.legacyIds : [],
    name: safeString(linkedProvider?.name || slot?.name),
    baseUrl: safeString(linkedProvider?.baseUrl || slot?.baseUrl),
    apiKey: safeString(linkedProvider?.apiKey || slot?.key),
    models: Array.isArray(linkedProvider?.models)
      ? linkedProvider.models
      : Array.isArray(slot?.supportedModels)
        ? slot.supportedModels
        : [],
    format: safeString(linkedProvider?.format || slot?.format || 'auto') || 'auto',
    endpointType: safeString(linkedProvider?.endpointType || slot?.endpointType || linkedProvider?.adapterId),
    requestProfileId: safeString(linkedProvider?.requestProfileId || slot?.requestProfileId || linkedProvider?.profileId),
    timeout: linkedProvider?.timeout || slot?.timeout,
    maxRetries: linkedProvider?.maxRetries || slot?.maxRetries,
  };
}

function buildProfileRouteIndex(profileState) {
  const index = { routeByAlias: new Map() };
  const providers = Array.isArray(profileState.providers) ? profileState.providers : [];
  const slots = Array.isArray(profileState.slots) ? profileState.slots : [];
  const providersByBase = new Map();
  const providerByBaseAndKey = new Map();
  const providerByBaseAndName = new Map();

  for (const provider of providers) {
    const route = buildRouteFromProvider(provider);
    const base = normalizeProviderLinkValue(route.baseUrl);
    const key = safeString(route.apiKey);
    const name = normalizeRouteValue(route.name);

    addRoute(index, route);

    if (base) {
      const list = providersByBase.get(base) || [];
      list.push(route);
      providersByBase.set(base, list);
      if (key) providerByBaseAndKey.set(`${base}\n${key}`, route);
      if (name) providerByBaseAndName.set(`${base}\n${name}`, route);
    }
  }

  for (const slot of slots) {
    const base = normalizeProviderLinkValue(slot?.baseUrl);
    const key = safeString(slot?.key);
    const name = normalizeRouteValue(slot?.name);
    const sameBase = base ? providersByBase.get(base) || [] : [];
    const linkedProvider = (base && key ? providerByBaseAndKey.get(`${base}\n${key}`) : null)
      || (base && name ? providerByBaseAndName.get(`${base}\n${name}`) : null)
      || (sameBase.length === 1 ? sameBase[0] : null);

    addRoute(index, buildRouteFromSlot(slot, linkedProvider), { preserveExisting: true });
  }

  return index;
}

function isDbEnabled() {
  return process.env.DATABASE_URL && process.env.KKAI_LOCAL_ONLY !== 'true';
}

function isReadonlySecret(value) {
  const normalized = String(value || '').trim();
  return !normalized
    || normalized === READONLY_SECRET_PLACEHOLDER
    || normalized.startsWith('__kk_redacted__:')
    || normalized.includes('...')
    || normalized.includes('••');
}

async function readLocalStorage(userId = null) {
  if (isDbEnabled() && userId) {
    try {
      const pool = getPool();
      const { rows } = await pool.query(
        'SELECT encrypted_secret FROM public.user_provider_credentials WHERE user_id = $1',
        [userId]
      );

      const profileState = {
        version: 2,
        slots: [],
        providers: [],
        entries: [],
      };

      for (const row of rows) {
        try {
          const decrypted = cryptoUtil.decrypt(row.encrypted_secret);
          const item = JSON.parse(decrypted);
          const group = item._group || 'entries';
          delete item._group;
          if (profileState[group]) {
            profileState[group].push(item);
          }
        } catch (err) {
          console.error('[localUserRouteStore] 数据库解密记录失败:', err);
        }
      }

      if (!cache.payload) {
        cache.payload = { version: 2, profiles: {} };
      }
      if (!cache.payload.profiles) {
        cache.payload.profiles = {};
      }
      cache.payload.profiles[userId] = profileState;
      return cache.payload;
    } catch (dbErr) {
      console.error('[localUserRouteStore] 数据库读取失败，降级本地文件:', dbErr);
    }
  }

  // 降级使用本地物理 JSON 文件
  async function doRead() {
    let signature = 'missing';
    try {
      const stat = await fs.stat(LOCAL_STORAGE_PATH);
      signature = `${stat.mtimeMs}:${stat.size}`;
    } catch {
      cache = {
        signature,
        payload: { version: 2, profiles: {} },
        indexes: new Map(),
        readPromise: null,
      };
      return cache.payload;
    }

    if (cache.signature === signature) return cache.payload;

    let parsed = { version: 2, profiles: {} };
    try {
      const raw = await fs.readFile(LOCAL_STORAGE_PATH, 'utf8');
      const candidate = JSON.parse(raw);
      parsed = isObjectRecord(candidate) ? candidate : { version: 2, profiles: {} };
    } catch {
      parsed = { version: 2, profiles: {} };
    }

    // 本地 JSON 读出时的自动解密还原
    if (parsed.profiles) {
      for (const [uid, uState] of Object.entries(parsed.profiles)) {
        const normalizeGroup = (group) => {
          if (!uState || !Array.isArray(uState[group])) return;
          uState[group] = uState[group].map(item => {
            if (item && item.key && item.key.startsWith('enc:')) {
              try {
                item.key = cryptoUtil.decrypt(item.key.slice(4));
              } catch (decErr) {
                console.warn('[localUserRouteStore] 解密本地 key 失败:', decErr);
              }
            }
            return item;
          });
        };
        normalizeGroup('slots');
        normalizeGroup('providers');
        normalizeGroup('entries');
      }
    }

    cache = {
      signature,
      payload: parsed,
      indexes: new Map(),
      readPromise: null,
    };
    return parsed;
  }

  if (!cache.readPromise) {
    cache.readPromise = doRead().finally(() => {
      cache.readPromise = null;
    });
  }
  return cache.readPromise;
}

async function resolveLocalUserRoute(userId, routeId) {
  // 🚀 优先命中短 TTL 缓存，避免每次请求都做全量 DB 查询 + 解密 + 索引构建
  const cachedRoute = getCachedRoute(userId, routeId);
  if (cachedRoute !== undefined) {
    return cachedRoute;
  }

  const data = await readLocalStorage(userId);
  if (!isObjectRecord(data.profiles)) data.profiles = {};

  const cacheKey = `${cache.signature}:${userId}`;
  let index = cache.indexes.get(cacheKey);
  if (!index) {
    const rawProfile = isObjectRecord(data.profiles[userId]) ? data.profiles[userId] : data;
    index = buildProfileRouteIndex(normalizeProfileState(rawProfile));
    cache.indexes.set(cacheKey, index);
  }

  for (const candidate of buildRouteLookupCandidates(routeId)) {
    const route = index.routeByAlias.get(candidate);
    if (route) {
      // 🚀 缓存成功命中的路由结果
      setCachedRoute(userId, routeId, route);
      return route;
    }
  }

  // 🚀 缓存 null 结果，避免重复查询不存在的路由
  setCachedRoute(userId, routeId, null);
  return null;
}

function resolveRouteFromProfileState(profileState, routeId) {
  const index = buildProfileRouteIndex(normalizeProfileState(profileState));
  for (const candidate of buildRouteLookupCandidates(routeId)) {
    const route = index.routeByAlias.get(candidate);
    if (route) return route;
  }
  return null;
}

function hasLegacyProfilePayload(data) {
  return Array.isArray(data.slots) || Array.isArray(data.providers) || Array.isArray(data.entries);
}

function createEmptyProfileState(version = 2) {
  return {
    version,
    slots: [],
    providers: [],
    entries: [],
  };
}

function readProfileState(data, userId) {
  if (!isObjectRecord(data.profiles)) {
    data.profiles = {};
  }
  const profiles = data.profiles;
  if (isObjectRecord(profiles[userId])) {
    return normalizeProfileState(profiles[userId]);
  }
  const shouldMigrateLegacyPayload = Object.keys(profiles).length === 0 && hasLegacyProfilePayload(data);
  const nextProfile = shouldMigrateLegacyPayload
    ? normalizeProfileState(data)
    : createEmptyProfileState(Number.parseInt(data.version, 10) || 2);
  profiles[userId] = nextProfile;
  delete data.slots;
  delete data.providers;
  delete data.entries;
  return nextProfile;
}

function writeProfileState(data, userId, profileState) {
  if (!isObjectRecord(data.profiles)) {
    data.profiles = {};
  }
  data.version = 2;
  data.profiles[userId] = normalizeProfileState(profileState);
  delete data.slots;
  delete data.providers;
  delete data.entries;
}

async function writeLocalStorage(data) {
  if (isDbEnabled()) {
    const pool = getPool();
    for (const [userId, profileState] of Object.entries(data.profiles || {})) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        
        // 简体中文：在覆盖写入之前，我们需要防范将 placeholder 覆盖数据库里的真实凭据。
        // 我们先从数据库读出已有的真实凭据
        const { rows } = await client.query(
          'SELECT encrypted_secret FROM public.user_provider_credentials WHERE user_id = $1',
          [userId]
        );
        const existingKeys = new Map();
        for (const row of rows) {
          try {
            const dec = cryptoUtil.decrypt(row.encrypted_secret);
            const parsed = JSON.parse(dec);
            if (parsed.id && parsed.key && !isReadonlySecret(parsed.key)) {
              existingKeys.set(parsed.id, parsed.key);
            }
          } catch {}
        }

        await client.query('DELETE FROM public.user_provider_credentials WHERE user_id = $1', [userId]);

        // 🚀 批量构建 INSERT 语句，替代逐条 INSERT，减少数据库往返次数
        const batchRows = [];
        const values = [];
        let paramIndex = 1;
        const groups = ['slots', 'providers', 'entries'];
        for (const group of groups) {
          const items = profileState[group] || [];
          for (const item of items) {
            const provider = String(item.provider || item.name || 'custom').trim();
            const authType = item.auth_type || 'api_key';

            // 掩码合并还原逻辑：如果是占位符，使用数据库里已有的真实 key
            let realKey = item.key;
            if (isReadonlySecret(realKey) && item.id && existingKeys.has(item.id)) {
              realKey = existingKeys.get(item.id);
            }

            const itemToSave = { ...item, key: realKey, _group: group };
            const encryptedSecret = cryptoUtil.encrypt(JSON.stringify(itemToSave));

            batchRows.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3})`);
            values.push(userId, provider, authType, encryptedSecret);
            paramIndex += 4;
          }
        }

        if (batchRows.length > 0) {
          await client.query(
            `INSERT INTO public.user_provider_credentials (user_id, provider, auth_type, encrypted_secret) VALUES ${batchRows.join(', ')}`,
            values
          );
        }
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        console.error('[localUserRouteStore] 写入数据库凭据失败:', e);
      } finally {
        client.release();
      }
    }
    // 同时也使缓存签名失效，保证下次 resolve 会重新建立 index
    cache.signature = `db-${Date.now()}`;
    cache.indexes.clear();

    // 🚀 写入后使所有相关用户的路由结果缓存失效
    for (const userId of Object.keys(data.profiles || {})) {
      invalidateRouteCache(userId);
    }
    return;
  }

  // 本地物理 JSON 写入模式
  const clone = JSON.parse(JSON.stringify(data));
  if (clone.profiles) {
    for (const [uid, uState] of Object.entries(clone.profiles)) {
      const encryptGroup = (group) => {
        if (!uState || !Array.isArray(uState[group])) return;
        uState[group] = uState[group].map(item => {
          if (item && item.key && !item.key.startsWith('enc:') && !isReadonlySecret(item.key)) {
            item.key = `enc:${cryptoUtil.encrypt(item.key)}`;
          }
          return item;
        });
      };
      encryptGroup('slots');
      encryptGroup('providers');
      encryptGroup('entries');
    }
  }

  const dir = path.dirname(LOCAL_STORAGE_PATH);
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (err) {}
  const raw = JSON.stringify(clone, null, 2);
  await fs.writeFile(LOCAL_STORAGE_PATH, raw, 'utf8');

  const stat = await fs.stat(LOCAL_STORAGE_PATH);
  const signature = `${stat.mtimeMs}:${stat.size}`;
  cache = {
    signature,
    payload: data,
    indexes: new Map(),
    readPromise: null,
  };

  // 🚀 文件写入后使路由缓存失效（遍历所有 userId）
  if (data && data.profiles) {
    for (const uid of Object.keys(data.profiles)) {
      invalidateRouteCache(uid);
    }
  }
}

module.exports = {
  resolveLocalUserRoute,
  resolveRouteFromProfileState,
  readLocalStorage,
  writeLocalStorage,
  normalizeProfileState,
  buildProfileRouteIndex,
  readProfileState,
  writeProfileState,
  invalidateRouteCache,
};
