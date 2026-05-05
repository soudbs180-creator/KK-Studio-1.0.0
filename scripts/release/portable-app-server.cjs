const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 3000);
const distDir = path.join(__dirname, 'dist');
const NUTRIENT_BUILD_URL = 'https://api.nutrient.io/build';
const DEFAULT_OCR_LANGUAGE = 'chi_sim';
const MULTIPART_BODY_LIMIT_BYTES = 25 * 1024 * 1024;

function isLocalOrPrivateKkApiBaseUrl(value) {
  try {
    const parsed = new URL(String(value || '').trim());
    const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    return hostname === 'localhost'
      || hostname === '::1'
      || hostname === '0.0.0.0'
      || hostname.startsWith('127.')
      || hostname.startsWith('10.')
      || hostname.startsWith('192.168.')
      || /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);
  } catch {
    return true;
  }
}

function readBuiltKkApiBaseUrl(targetDir) {
  const entries = fs.readdirSync(targetDir, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      const nestedValue = readBuiltKkApiBaseUrl(entryPath);
      if (nestedValue) {
        return nestedValue;
      }
      continue;
    }

    if (!/\.(?:html|js|mjs|json)$/i.test(entry.name)) {
      continue;
    }

    const source = fs.readFileSync(entryPath, 'utf8');
    const match = /VITE_KK_API_BASE_URL["']?\s*:\s*["']([^"']+)["']/.exec(source);
    if (match && match[1]) {
      return match[1];
    }
  }

  return '';
}

function assertPortableRemoteKkApiBaseUrl(targetDir) {
  const kkApiBaseUrl = readBuiltKkApiBaseUrl(targetDir);
  if (!kkApiBaseUrl || isLocalOrPrivateKkApiBaseUrl(kkApiBaseUrl)) {
    throw new Error(
      'Portable build does not include the core KK API. Set VITE_KK_API_BASE_URL to a remote VPS API before startup.',
    );
  }

  return kkApiBaseUrl;
}

const portableKkApiBaseUrl = assertPortableRemoteKkApiBaseUrl(distDir);

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

function readIncomingBody(req, maxBytes = MULTIPART_BODY_LIMIT_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalLength = 0;

    req.on('data', (chunk) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalLength += buffer.length;

      if (totalLength > maxBytes) {
        reject(new Error('Request body is too large.'));
        req.destroy();
        return;
      }

      chunks.push(buffer);
    });

    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function createProxyRequestHeaders(headers) {
  const proxyHeaders = new Headers();

  Object.entries(headers).forEach(([key, value]) => {
    if (!value) return;
    if (key.toLowerCase() === 'host' || key.toLowerCase() === 'connection') return;

    if (Array.isArray(value)) {
      proxyHeaders.set(key, value.join(', '));
      return;
    }

    proxyHeaders.set(key, value);
  });

  return proxyHeaders;
}

async function writeFetchResponse(res, response) {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(Buffer.from(await response.arrayBuffer()));
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

const CRLF_BYTES = new Uint8Array([0x0d, 0x0a]);
const HEADER_TERMINATOR_BYTES = new Uint8Array([0x0d, 0x0a, 0x0d, 0x0a]);
const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

function concatUint8Arrays(...chunks) {
  const totalLength = chunks.reduce((length, chunk) => length + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

function indexOfSequence(body, sequence, startOffset) {
  const lastStart = body.length - sequence.length;

  for (let index = startOffset; index <= lastStart; index += 1) {
    let matches = true;

    for (let offset = 0; offset < sequence.length; offset += 1) {
      if (body[index + offset] !== sequence[offset]) {
        matches = false;
        break;
      }
    }

    if (matches) {
      return index;
    }
  }

  return -1;
}

function bytesEqual(left, leftStart, leftEnd, right) {
  if (leftEnd - leftStart !== right.length) {
    return false;
  }

  for (let index = 0; index < right.length; index += 1) {
    if (left[leftStart + index] !== right[index]) {
      return false;
    }
  }

  return true;
}

function isClosingBoundaryLine(body, boundaryStart, boundaryEnd, openingBoundaryLine) {
  return (
    boundaryEnd - boundaryStart === openingBoundaryLine.length + 2
    && bytesEqual(body, boundaryStart, boundaryStart + openingBoundaryLine.length, openingBoundaryLine)
    && body[boundaryEnd - 2] === 0x2d
    && body[boundaryEnd - 1] === 0x2d
  );
}

function findNextBoundaryMarker(body, openingBoundaryLine, startOffset) {
  for (let index = startOffset; index <= body.length - (openingBoundaryLine.length + 2); index += 1) {
    if (body[index] !== 0x0d || body[index + 1] !== 0x0a) {
      continue;
    }

    if (bytesEqual(body, index + 2, index + 2 + openingBoundaryLine.length, openingBoundaryLine)) {
      return index;
    }
  }

  return -1;
}

function unquoteHeaderValue(value) {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }

  return value;
}

function decodeExtendedFilename(value) {
  const rawValue = unquoteHeaderValue(value);
  const match = /^([^']*)'[^']*'(.*)$/.exec(rawValue);
  const encodedValue = match ? match[2] : rawValue;

  try {
    return decodeURIComponent(encodedValue);
  } catch {
    return encodedValue;
  }
}

function escapeQuotedHeaderValue(value) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function normalizeContentDispositionLine(line) {
  const separatorIndex = line.indexOf(':');

  if (separatorIndex === -1) {
    return line;
  }

  const headerName = line.slice(0, separatorIndex);
  if (headerName.toLowerCase() !== 'content-disposition') {
    return line;
  }

  const rawValue = line.slice(separatorIndex + 1).trim();
  const segments = rawValue.split(';').map((segment) => segment.trim()).filter(Boolean);
  if (segments.length === 0 || segments[0].toLowerCase() !== 'form-data') {
    return line;
  }

  let nameValue;
  let filenameValue;
  let filenameStarValue;
  const passthroughSegments = [];

  for (const segment of segments.slice(1)) {
    const equalsIndex = segment.indexOf('=');
    if (equalsIndex === -1) {
      passthroughSegments.push(segment);
      continue;
    }

    const key = segment.slice(0, equalsIndex).trim().toLowerCase();
    const value = segment.slice(equalsIndex + 1).trim();
    if (key === 'name') {
      nameValue = unquoteHeaderValue(value);
      continue;
    }
    if (key === 'filename') {
      filenameValue = unquoteHeaderValue(value);
      continue;
    }
    if (key === 'filename*') {
      filenameStarValue = value;
      continue;
    }

    passthroughSegments.push(segment);
  }

  if (!filenameStarValue || !nameValue) {
    return line;
  }

  const effectiveFilename = filenameValue || decodeExtendedFilename(filenameStarValue);
  if (!effectiveFilename) {
    return line;
  }

  return `${headerName}: ${[
    'form-data',
    `name="${escapeQuotedHeaderValue(nameValue)}"`,
    `filename="${escapeQuotedHeaderValue(effectiveFilename)}"`,
    ...passthroughSegments,
  ].join('; ')}`;
}

function normalizeHeaderBlock(headerBytes) {
  const headerText = textDecoder.decode(headerBytes);
  const headerLines = headerText.split('\r\n');
  let changed = false;
  const normalizedLines = headerLines.map((line) => {
    const normalizedLine = normalizeContentDispositionLine(line);
    if (normalizedLine !== line) {
      changed = true;
    }
    return normalizedLine;
  });

  if (!changed) {
    return headerBytes;
  }

  return textEncoder.encode(normalizedLines.join('\r\n'));
}

function normalizeDevMultipartFormDataBody(body) {
  const firstLineEnd = indexOfSequence(body, CRLF_BYTES, 0);
  if (firstLineEnd === -1) {
    return body;
  }

  const openingBoundaryLine = body.subarray(0, firstLineEnd);
  if (openingBoundaryLine.length < 4 || openingBoundaryLine[0] !== 0x2d || openingBoundaryLine[1] !== 0x2d) {
    return body;
  }

  const normalizedChunks = [];
  let changed = false;
  let boundaryStart = 0;

  while (boundaryStart < body.length) {
    const lineEnd = indexOfSequence(body, CRLF_BYTES, boundaryStart);
    const boundaryEnd = lineEnd === -1 ? body.length : lineEnd;

    if (isClosingBoundaryLine(body, boundaryStart, boundaryEnd, openingBoundaryLine)) {
      normalizedChunks.push(body.subarray(boundaryStart));
      return changed ? concatUint8Arrays(...normalizedChunks) : body;
    }

    if (lineEnd === -1) {
      return body;
    }

    const headerStart = lineEnd + CRLF_BYTES.length;
    const headerEnd = indexOfSequence(body, HEADER_TERMINATOR_BYTES, headerStart);
    if (headerEnd === -1) {
      return body;
    }

    const headerBytes = body.subarray(headerStart, headerEnd);
    const normalizedHeaderBytes = normalizeHeaderBlock(headerBytes);
    if (normalizedHeaderBytes !== headerBytes) {
      changed = true;
    }

    normalizedChunks.push(body.subarray(boundaryStart, headerStart));
    normalizedChunks.push(normalizedHeaderBytes);
    normalizedChunks.push(HEADER_TERMINATOR_BYTES);

    const contentStart = headerEnd + HEADER_TERMINATOR_BYTES.length;
    const nextBoundaryMarker = findNextBoundaryMarker(body, openingBoundaryLine, contentStart);
    if (nextBoundaryMarker === -1) {
      return body;
    }

    normalizedChunks.push(body.subarray(contentStart, nextBoundaryMarker + CRLF_BYTES.length));
    boundaryStart = nextBoundaryMarker + CRLF_BYTES.length;
  }

  return changed ? concatUint8Arrays(...normalizedChunks) : body;
}

function normalizeMultipartProxyBody(headers, body) {
  const contentType = headers.get('content-type') || '';
  if (!/multipart\/form-data/i.test(contentType)) {
    return body;
  }

  return Buffer.from(normalizeDevMultipartFormDataBody(body));
}

const nutrientCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function nutrientJsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...nutrientCorsHeaders,
    },
  });
}

function trimFileName(value) {
  return String(value || '')
    .trim()
    .split(/[\\/]/)
    .pop()
    ?.replace(/[^\w.\-() ]+/g, '_') || '';
}

function replaceFileExtension(fileName, extension) {
  const normalizedName = trimFileName(fileName) || 'document';
  const cleanExtension = extension.startsWith('.') ? extension : `.${extension}`;
  const withoutExtension = normalizedName.replace(/\.[^.]+$/, '') || 'document';
  return `${withoutExtension}${cleanExtension}`;
}

function getNutrientOutputContentType(operation) {
  return operation === 'extract-text' ? 'text/plain; charset=utf-8' : 'application/pdf';
}

function getNutrientOutputFileName(operation, inputFileName) {
  return operation === 'extract-text'
    ? replaceFileExtension(inputFileName, '.txt')
    : replaceFileExtension(inputFileName, '.pdf');
}

function buildNutrientInstructions(operation, fileName, ocrLanguage) {
  const parts = [{ file: fileName }];

  switch (operation) {
    case 'convert-to-pdf':
      return { parts };
    case 'extract-text':
      return {
        parts,
        output: { type: 'text' },
      };
    case 'ocr-to-pdf':
      return {
        parts,
        actions: [{ type: 'ocr', language: ocrLanguage || DEFAULT_OCR_LANGUAGE }],
      };
    default:
      return { parts };
  }
}

async function extractNutrientErrorMessage(response) {
  const rawText = (await response.text()).trim();
  if (!rawText) {
    return 'Nutrient request failed';
  }

  try {
    const parsed = JSON.parse(rawText);
    return String(parsed.error || parsed.message || parsed.detail || parsed.title || rawText);
  } catch {
    return rawText;
  }
}

async function nutrientDocumentHandler(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: nutrientCorsHeaders });
  }

  if (request.method !== 'POST') {
    return nutrientJsonResponse({ error: 'Only POST requests are supported.' }, 405);
  }

  const apiKey = process.env.NUTRIENT_API_KEY || process.env.NUTRIENT_DWS_API_KEY;
  if (!apiKey) {
    return nutrientJsonResponse({ error: 'Missing NUTRIENT_API_KEY or NUTRIENT_DWS_API_KEY.' }, 500);
  }

  try {
    const formData = await request.formData();
    const operationValue = String(formData.get('operation') || '').trim();
    const upload = formData.get('file');
    const requestedLanguage = String(formData.get('ocrLanguage') || '').trim();

    if (!['convert-to-pdf', 'extract-text', 'ocr-to-pdf'].includes(operationValue)) {
      return nutrientJsonResponse(
        { error: 'Unsupported operation. Use convert-to-pdf, extract-text, or ocr-to-pdf.' },
        400,
      );
    }

    if (!(upload instanceof File)) {
      return nutrientJsonResponse({ error: 'Missing uploaded file.' }, 400);
    }

    const inputFileName = trimFileName(upload.name) || 'document.bin';
    const upstreamFormData = new FormData();
    upstreamFormData.append(inputFileName, upload, inputFileName);
    upstreamFormData.append(
      'instructions',
      JSON.stringify(buildNutrientInstructions(operationValue, inputFileName, requestedLanguage || DEFAULT_OCR_LANGUAGE)),
    );

    const upstreamResponse = await fetch(NUTRIENT_BUILD_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: upstreamFormData,
    });

    if (!upstreamResponse.ok) {
      return nutrientJsonResponse(
        { error: await extractNutrientErrorMessage(upstreamResponse) },
        upstreamResponse.status || 502,
      );
    }

    const outputContentType = upstreamResponse.headers.get('content-type') || getNutrientOutputContentType(operationValue);
    const outputFileName = getNutrientOutputFileName(operationValue, inputFileName);

    return new Response(await upstreamResponse.arrayBuffer(), {
      status: 200,
      headers: {
        'Content-Type': outputContentType,
        'Content-Disposition': `attachment; filename="${outputFileName}"`,
        ...nutrientCorsHeaders,
      },
    });
  } catch (error) {
    return nutrientJsonResponse({ error: error.message || 'Document processing failed.' }, 500);
  }
}

async function handleNutrientDocumentProxy(req, res) {
  if (req.method !== 'POST' && req.method !== 'OPTIONS') {
    sendJson(res, 405, { error: 'Only POST requests are supported.' }, nutrientCorsHeaders);
    return;
  }

  const body = req.method === 'POST' ? await readIncomingBody(req) : undefined;
  const proxyHeaders = createProxyRequestHeaders(req.headers);
  const normalizedBody = body ? normalizeMultipartProxyBody(proxyHeaders, body) : body;

  const response = await nutrientDocumentHandler(new Request(`http://localhost${req.url || '/api/nutrient-document'}`, {
    method: req.method,
    headers: proxyHeaders,
    body: normalizedBody,
  }));

  await writeFetchResponse(res, response);
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

  if (pathname === '/api/nutrient-document') {
    await handleNutrientDocumentProxy(req, res);
    return;
  }

  if (pathname.startsWith('/api/')) {
    sendJson(res, 501, {
      error: 'This portable build only includes /api/pricing-proxy and /api/nutrient-document locally. Payment can run on :8080 when configured.',
    });
    return;
  }

  handleStaticRequest(req, res, pathname);
});

server.listen(port, host, () => {
  console.log(`KK Studio portable server running at http://${host}:${port}`);
});
