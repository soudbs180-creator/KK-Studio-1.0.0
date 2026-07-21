// Provider Connection 验证只做最小只读探测；不跟随重定向，也不把 secret 放进 URL。

const dns = require('dns');
const net = require('net');

const GOOGLE_HOST = 'generativelanguage.googleapis.com';

function createVerificationError(code, message, statusCode = 400) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function isValidIpv4Octet(part) {
  return Number.isInteger(part) && part >= 0 && part <= 255;
}

function isPrivateIpv4(address) {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || !parts.every(isValidIpv4Octet)) return true;
  const [first, second] = parts;
  return first === 0
    || first === 10
    || first === 127
    || (first === 100 && second >= 64 && second <= 127)
    || (first === 169 && second === 254)
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && [0, 168].includes(second))
    || (first === 198 && [18, 19, 51].includes(second))
    || (first === 203 && second === 0)
    || first >= 224;
}

function isPrivateIpv6(address) {
  const normalized = address.toLowerCase();
  if (normalized === '::' || normalized === '::1') return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  if (/^fe[89ab]/.test(normalized)) return true;
  const mappedIpv4 = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  return mappedIpv4 ? isPrivateIpv4(mappedIpv4) : false;
}

function isPrivateAddress(address) {
  const family = net.isIP(address);
  if (family === 4) return isPrivateIpv4(address);
  if (family === 6) return isPrivateIpv6(address);
  return true;
}

async function assertPublicEndpoint(endpoint, protocolProfile, lookup) {
  let parsed;
  try {
    parsed = new URL(endpoint);
  } catch {
    throw createVerificationError('ENDPOINT_INVALID', 'Provider endpoint must be a valid HTTPS URL.');
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || (parsed.port && parsed.port !== '443')) {
    throw createVerificationError('ENDPOINT_INVALID', 'Provider endpoint must use HTTPS without embedded credentials or a custom port.');
  }
  if (protocolProfile === 'google-official' && parsed.hostname !== GOOGLE_HOST) {
    throw createVerificationError('ENDPOINT_HOST_MISMATCH', 'Google official connections must use the canonical Google API host.');
  }
  const addresses = await lookup(parsed.hostname, { all: true, verbatim: true });
  if (!Array.isArray(addresses) || addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw createVerificationError('ENDPOINT_PRIVATE_ADDRESS', 'Provider endpoint resolved to a private or reserved address.');
  }
  return parsed;
}

function buildProbeRequest(endpoint, protocolProfile, secret) {
  const baseUrl = endpoint.toString().endsWith('/') ? endpoint.toString() : `${endpoint.toString()}/`;
  if (protocolProfile === 'google-official') {
    return {
      url: new URL('v1beta/models?pageSize=1', baseUrl).toString(),
      headers: { 'x-goog-api-key': secret },
    };
  }
  return {
    url: new URL('models', baseUrl).toString(),
    headers: { authorization: `Bearer ${secret}` },
  };
}

function bindingsForProfile(protocolProfile) {
  if (protocolProfile !== 'google-official') return [];
  return [{
    modelId: 'gemini-2.5-flash-image',
    capabilityId: 'image.generate',
    channel: 'byok',
    requestProfile: 'google-generate-content-v1beta',
  }];
}

function classifyProbeResponse(response) {
  if (response.status >= 300 && response.status < 400) {
    throw createVerificationError('PROVIDER_REDIRECT_REJECTED', 'Provider verification redirects are not allowed.');
  }
  if (response.status === 401 || response.status === 403) {
    throw createVerificationError('PROVIDER_CREDENTIAL_REJECTED', 'Provider rejected the supplied credential.', 403);
  }
  if (response.status >= 500) {
    throw createVerificationError('PROVIDER_UNAVAILABLE', 'Provider verification endpoint is unavailable.', 503);
  }
  return response.status === 429 ? 'restricted' : 'available';
}

/** 验证端点和凭据；依赖可注入以便安全测试不访问真实 Provider。 */
async function verifyConnectionEndpoint(input, dependencies = {}) {
  const lookup = dependencies.lookup || dns.promises.lookup;
  const fetchImpl = dependencies.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    throw createVerificationError('PROVIDER_FETCH_UNAVAILABLE', 'Provider verification transport is unavailable.', 500);
  }
  const endpoint = await assertPublicEndpoint(input.endpoint, input.protocolProfile, lookup);
  const probe = buildProbeRequest(endpoint, input.protocolProfile, input.secret);
  const response = await fetchImpl(probe.url, {
    method: 'GET',
    headers: probe.headers,
    redirect: 'manual',
    signal: AbortSignal.timeout(dependencies.timeoutMs || 5000),
  });
  return {
    status: classifyProbeResponse(response),
    verifiedAt: new Date().toISOString(),
    message: 'Provider connection verified.',
    bindings: bindingsForProfile(input.protocolProfile),
  };
}

module.exports = {
  verifyConnectionEndpoint,
  isPrivateAddress,
};
