const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 3000);
const distDir = path.join(__dirname, 'dist');

const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.js', 'application/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8'],
]);

function sendJson(res, statusCode, payload, headers = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(JSON.stringify(payload));
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error('Request body is too large.'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function looksLikeJson(text) {
  const trimmed = String(text || '').trim();
  return trimmed.startsWith('{') || trimmed.startsWith('[');
}

const supplierPathSuffixes = [
  /\/api\/pricing$/i,
  /\/api\/price$/i,
  /\/v1\/pricing$/i,
  /\/pricing\.html$/i,
  /\/pricing$/i,
  /\/price$/i,
  /\/models$/i,
  /\/v1$/i,
];

function stripSupplierPathSuffixes(pathname) {
  let clean = String(pathname || '').replace(/\/+$/, '');
  let stripped = true;

  while (stripped) {
    stripped = false;
    for (const suffix of supplierPathSuffixes) {
      if (!suffix.test(clean)) continue;
      clean = clean.replace(suffix, '').replace(/\/+$/, '');
      stripped = true;
      break;
    }
  }

  return clean || '/';
}

function normalizePricingBaseUrl(baseUrl) {
  try {
    const parsed = new URL(String(baseUrl || '').trim());
    parsed.hash = '';
    parsed.search = '';
    parsed.pathname = stripSupplierPathSuffixes(parsed.pathname);
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return String(baseUrl || '').replace(/\/+$/, '');
  }
}

function buildPricingCandidates(baseUrl) {
  const cleanUrl = normalizePricingBaseUrl(baseUrl);
  if (!cleanUrl) return [];

  const rootUrl = cleanUrl.replace(/\/v1$/i, '');
  let originUrl = cleanUrl;

  try {
    const parsed = new URL(cleanUrl);
    originUrl = `${parsed.protocol}//${parsed.host}`;
  } catch {
    originUrl = rootUrl;
  }

  const baseCandidates = Array.from(new Set([cleanUrl, rootUrl, originUrl].filter(Boolean)));
  const suffixes = ['/pricing', '/pricing.html', '/models', '/api/pricing', '/api/price', '/price'];

  return Array.from(new Set(baseCandidates.flatMap((candidate) => suffixes.map((suffix) => `${candidate}${suffix}`))));
}

async function fetchPricingPayload(baseUrl) {
  const cleanUrl = normalizePricingBaseUrl(baseUrl);

  if (!cleanUrl) {
    return { error: 'Missing baseUrl.' };
  }
  const candidates = buildPricingCandidates(cleanUrl);

  let lastError = 'No pricing endpoint returned JSON.';

  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate, {
        headers: {
          Accept: 'application/json, text/plain;q=0.9, text/html;q=0.8, */*;q=0.7',
          'User-Agent': 'KK-Studio-Portable/1.0',
        },
      });

      const text = await response.text();
      if (!response.ok) {
        lastError = `${candidate} returned ${response.status}.`;
        continue;
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('json') && !looksLikeJson(text)) {
        lastError = `${candidate} did not return JSON data.`;
        continue;
      }

      const parsed = JSON.parse(text);
      const rows = Array.isArray(parsed) ? parsed : Array.isArray(parsed.data) ? parsed.data : [];
      const groupRatio = parsed.group_ratio || parsed.groupRatio || {};

      return {
        success: true,
        data: rows,
        group_ratio: groupRatio,
        source: candidate,
      };
    } catch (error) {
      lastError = `${candidate} failed: ${error.message}`;
    }
  }

  return { error: lastError };
}

async function handlePricingProxy(req, res) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Only POST is supported.' }, corsHeaders);
    return;
  }

  try {
    const rawBody = await readRequestBody(req);
    const payload = rawBody ? JSON.parse(rawBody) : {};
    const result = await fetchPricingPayload(payload.baseUrl);
    sendJson(res, 200, result, corsHeaders);
  } catch (error) {
    sendJson(res, 400, { error: error.message || 'Invalid request.' }, corsHeaders);
  }
}

function resolveFilePath(urlPathname) {
  let relativePath = decodeURIComponent(urlPathname);
  if (relativePath === '/') {
    relativePath = '/index.html';
  }

  const normalizedPath = path
    .normalize(relativePath)
    .replace(/^(\.\.(\/|\\|$))+/, '')
    .replace(/^[/\\]+/, '');

  return path.join(distDir, normalizedPath);
}

function tryStat(filePath) {
  try {
    return fs.statSync(filePath);
  } catch {
    return null;
  }
}

function serveFile(req, res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes.get(ext) || 'application/octet-stream';
  const stat = tryStat(filePath);

  if (!stat || !stat.isFile()) {
    sendJson(res, 404, { error: 'File not found.' });
    return;
  }

  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': stat.size,
    'Cache-Control': 'no-store',
  });

  if (req.method === 'HEAD') {
    res.end();
    return;
  }

  fs.createReadStream(filePath).pipe(res);
}

function handleStaticRequest(req, res, pathname) {
  const requestedFile = resolveFilePath(pathname);
  const requestedStat = tryStat(requestedFile);

  if (requestedStat && requestedStat.isDirectory()) {
    const indexFile = path.join(requestedFile, 'index.html');
    if (tryStat(indexFile)) {
      serveFile(req, res, indexFile);
      return;
    }
  }

  if (requestedStat && requestedStat.isFile()) {
    serveFile(req, res, requestedFile);
    return;
  }

  if (path.extname(pathname)) {
    sendJson(res, 404, { error: 'Asset not found.' });
    return;
  }

  serveFile(req, res, path.join(distDir, 'index.html'));
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url || '/', `http://${req.headers.host || `${host}:${port}`}`);
  const pathname = requestUrl.pathname;

  if (pathname === '/health') {
    sendJson(res, 200, { ok: true, port });
    return;
  }

  if (pathname === '/api/pricing-proxy') {
    await handlePricingProxy(req, res);
    return;
  }

  if (pathname.startsWith('/api/')) {
    sendJson(res, 501, {
      error: 'This portable build only includes /api/pricing-proxy locally. Payment can run on :8080 when configured.',
    });
    return;
  }

  handleStaticRequest(req, res, pathname);
});

server.listen(port, host, () => {
  console.log(`KK Studio portable server running at http://${host}:${port}`);
});
