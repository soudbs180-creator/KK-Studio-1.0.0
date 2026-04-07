import fs from 'fs';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import path from 'path';
import { defineConfig, loadEnv, Plugin } from 'vite';
import { APP_NAME, APP_RELEASE_DATE, APP_RELEASE_NOTES } from './src/config/appInfo';

const VERSION_MANIFEST_FILENAME = 'app-version.json';
const TURNSTILE_DIAGNOSTIC_ENTRY = path.resolve(__dirname, 'turnstile-diagnostic.html');

const WORKSPACE_DATA_DIRS = new Set([
    'picture',
    'video',
    'refs',
    'settings',
    'tags',
    'originals',
    'thumbnails',
    'cache',
    'images',
]);

const PRIVATE_IPV4_PATTERNS = [
    /^0\./,
    /^10\./,
    /^127\./,
    /^169\.254\./,
    /^172\.(1[6-9]|2\d|3[0-1])\./,
    /^192\.168\./,
];

const FORBIDDEN_HOSTNAME_SUFFIXES = [
    '.internal',
    '.local',
    '.localdomain',
    '.localhost',
    '.home',
    '.lan',
];

function normalizeHostForChecks(hostname: string): string {
    return String(hostname || '')
        .trim()
        .toLowerCase()
        .replace(/^\[|\]$/g, '')
        .split('%')[0];
}

function isPrivateIpAddress(hostname: string): boolean {
    const normalized = normalizeHostForChecks(hostname);
    const ipVersion = isIP(normalized);

    if (ipVersion === 4) {
        return PRIVATE_IPV4_PATTERNS.some((pattern) => pattern.test(normalized));
    }

    if (ipVersion === 6) {
        return normalized === '::'
            || normalized === '::1'
            || /^f[cd][0-9a-f]{0,2}:/i.test(normalized)
            || /^fe[89ab][0-9a-f]?:/i.test(normalized)
            || /^::ffff:(?:0:)?(?:10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/i.test(normalized);
    }

    return false;
}

function isForbiddenHostname(hostname: string): boolean {
    const lower = normalizeHostForChecks(hostname);
    if (!lower) return true;
    if (lower === 'localhost') return true;
    if (lower.includes('localhost')) return true;
    if (FORBIDDEN_HOSTNAME_SUFFIXES.some((suffix) => lower.endsWith(suffix))) return true;
    if (lower.endsWith('.nip.io') || lower.endsWith('.sslip.io')) return true;
    if (isPrivateIpAddress(lower)) return true;
    return false;
}

async function normalizeSupplierBaseUrl(rawBaseUrl: string): Promise<string> {
    const parsed = new URL(String(rawBaseUrl || '').trim());

    if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('Only http/https supplier URLs are allowed');
    }

    if (parsed.username || parsed.password) {
        throw new Error('Supplier URL must not contain embedded credentials');
    }

    if (isForbiddenHostname(parsed.hostname)) {
        throw new Error('Private, local, or loopback supplier URLs are not allowed');
    }

    const normalizedHost = normalizeHostForChecks(parsed.hostname);
    if (normalizedHost && !isIP(normalizedHost)) {
        const records = await lookup(normalizedHost, { all: true, verbatim: true });
        if (!records.length) {
            throw new Error('Supplier hostname did not resolve');
        }

        // Block domains that resolve into loopback or private network ranges in local dev too.
        if (records.some((record) => isPrivateIpAddress(record.address))) {
            throw new Error('Supplier hostname resolved to a private or loopback address');
        }
    }

    parsed.hash = '';
    parsed.search = '';
    parsed.pathname = parsed.pathname
        .replace(/\/(pricing(?:\.html)?|models)(\/.*)?$/i, '')
        .replace(/\/v1\/?$/i, '')
        .replace(/\/+$/, '') || '/';

    return parsed.toString().replace(/\/$/, '');
}

const ALWAYS_IGNORE_SEGMENTS = new Set([
    '.agents',
    '.git',
    '.kk-local',
    '.tmp-playwright',
    '.vite',
    '.vscode',
    'dist',
    'node_modules',
]);

const ALWAYS_IGNORE_FILENAMES = [
    /^tmp-.*\.(out|err|log)$/i,
];

const ROOT_WATCH_FILES = new Set([
    '.env',
    '.env.development',
    '.env.local',
    '.env.production',
    'index.html',
    'package-lock.json',
    'package.json',
    'postcss.config.cjs',
    'postcss.config.js',
    'tailwind.config.js',
    'tailwind.config.ts',
    'tsconfig.json',
    'tsconfig.node.json',
    'vite.config.js',
    'vite.config.ts',
]);

function shouldIgnoreWatchPath(targetPath: string): boolean {
    const normalized = targetPath.replace(/\\/g, '/');
    const segments = normalized.split('/').filter(Boolean);
    const filename = segments[segments.length - 1]?.toLowerCase() || '';

    if (ALWAYS_IGNORE_FILENAMES.some((pattern) => pattern.test(filename))) {
        return true;
    }

    if (
        segments.some((segment) =>
            ALWAYS_IGNORE_SEGMENTS.has(segment)
            || segment.startsWith('recovery_')
            || segment.startsWith('backup_')
        )
    ) {
        return true;
    }

    if (
        normalized.includes('/src/') ||
        normalized.includes('/public/') ||
        normalized.includes('/api/') ||
        normalized.includes('/server/') ||
        normalized.includes('/tests/')
    ) {
        return false;
    }

    if (ROOT_WATCH_FILES.has(filename)) {
        return false;
    }

    if (normalized.endsWith('/project.json')) {
        return true;
    }

    return normalized.includes('/docs/')
        || segments.some((segment) => WORKSPACE_DATA_DIRS.has(segment));
}

function resolveManualChunk(id: string): string | undefined {
    const normalizedId = id.replace(/\\/g, '/');

    if (
        normalizedId.includes('/src/components/settings/') ||
        normalizedId.includes('/src/components/modals/StorageSelectionModal.tsx') ||
        normalizedId.includes('/src/components/modals/MigrateModal.tsx') ||
        normalizedId.includes('/src/components/modals/RechargeModal.tsx') ||
        normalizedId.includes('/src/components/modals/UserProfileModal.tsx') ||
        normalizedId.includes('/src/components/modals/TagInputModal.tsx') ||
        normalizedId.includes('/src/pages/CostEstimation.tsx')
    ) {
        return 'app-panels';
    }

    if (
        normalizedId.includes('/src/components/layout/SearchPalette.tsx') ||
        normalizedId.includes('/src/components/common/TutorialOverlay.tsx') ||
        normalizedId.includes('/src/components/image/GlobalLightbox.tsx')
    ) {
        return 'app-panels';
    }

    if (normalizedId.includes('/node_modules/')) {
        if (normalizedId.includes('/@supabase/')) {
            return 'supabase-vendor';
        }

        if (normalizedId.includes('/lucide-react/')) {
            return 'lucide-vendor';
        }

        if (normalizedId.includes('/three/')) {
            return 'three-vendor';
        }

        return 'vendor';
    }

    return undefined;
}

function buildVersionManifestPlugin(): Plugin {
    let projectRoot = process.cwd();

    return {
        name: 'kk-build-version-manifest',
        apply: 'build',
        configResolved(config) {
            projectRoot = config.root;
        },
        generateBundle() {
            const packageJsonPath = path.resolve(projectRoot, 'package.json');
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
                name?: string;
                version?: string;
            };

            const commitSha = process.env.VERCEL_GIT_COMMIT_SHA
                || process.env.COMMIT_REF
                || process.env.GITHUB_SHA
                || process.env.CF_PAGES_COMMIT_SHA
                || null;

            const manifest = {
                appName: APP_NAME,
                version: packageJson.version || '0.0.0',
                buildTime: new Date().toISOString(),
                releaseDate: APP_RELEASE_DATE,
                releaseNotes: [...APP_RELEASE_NOTES],
                channel: process.env.KK_STUDIO_RELEASE_CHANNEL || 'stable',
                deploymentTarget: process.env.VERCEL_ENV
                    || process.env.CONTEXT
                    || process.env.NETLIFY_CONTEXT
                    || process.env.NODE_ENV
                    || 'production',
                commitSha,
            };

            this.emitFile({
                type: 'asset',
                fileName: VERSION_MANIFEST_FILENAME,
                source: JSON.stringify(manifest, null, 2),
            });
        },
    };
}

function getRequestPath(rawUrl: string | undefined): string {
    try {
        return new URL(rawUrl || '/', 'http://localhost').pathname;
    } catch {
        return rawUrl || '/';
    }
}

function createProxyRequestHeaders(headers: Record<string, string | string[] | undefined>): Headers {
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

async function readIncomingBody(req: AsyncIterable<Buffer | string>): Promise<Buffer> {
    const chunks: Buffer[] = [];

    for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
}

async function writeFetchResponse(
    res: {
        statusCode: number;
        setHeader: (name: string, value: string) => void;
        end: (chunk?: Uint8Array | string) => void;
    },
    response: Response,
) {
    res.statusCode = response.status;
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.end(Buffer.from(await response.arrayBuffer()));
}

function shouldProxyToLocalApi(requestPath: string): boolean {
    return requestPath === '/healthz'
        || requestPath === '/api/manifest'
        || requestPath.startsWith('/api/v1/');
}

function buildLocalApiProxyUrl(rawUrl: string | undefined, targetOrigin: string): string {
    const requestUrl = new URL(rawUrl || '/', 'http://localhost');
    return new URL(`${requestUrl.pathname}${requestUrl.search}`, targetOrigin).toString();
}

let localApiServerPromise: Promise<void> | null = null;

async function canReachLocalApi(targetOrigin: string): Promise<boolean> {
    try {
        const response = await fetch(new URL('/healthz', targetOrigin), { method: 'GET' });
        return response.ok;
    } catch {
        return false;
    }
}

function isAddressInUseError(error: unknown): boolean {
    const message = error instanceof Error
        ? `${error.name}: ${error.message}`
        : String(error || '');

    return message.includes('EADDRINUSE') || message.includes('address already in use');
}

async function ensureLocalApiServer(targetOrigin: string): Promise<void> {
    if (await canReachLocalApi(targetOrigin)) {
        return;
    }

    if (!localApiServerPromise) {
        localApiServerPromise = (async () => {
            const { startLocalApiServer } = await import('./scripts/lib/local-api-bootstrap.mjs');

            try {
                await startLocalApiServer();
            } catch (error) {
                // `npm run dev:start` manages the API separately. If that server already owns
                // port 3001, treat the address-in-use failure as a signal to re-check health
                // instead of crashing the Vite process.
                if (!isAddressInUseError(error)) {
                    throw error;
                }
            }

            for (let attempt = 0; attempt < 40; attempt += 1) {
                if (await canReachLocalApi(targetOrigin)) {
                    return;
                }

                await new Promise((resolve) => setTimeout(resolve, 250));
            }

            throw new Error(`Timed out waiting for local API at ${targetOrigin}`);
        })().finally(() => {
            localApiServerPromise = null;
        });
    }

    await localApiServerPromise;
}

function kkApiProxyPlugin(targetOrigin = 'http://127.0.0.1:3001'): Plugin {
    return {
        name: 'kk-api-proxy',
        configureServer(server) {
            server.middlewares.use(async (req, res, next) => {
                const requestPath = getRequestPath(req.url);
                if (!shouldProxyToLocalApi(requestPath)) {
                    return next();
                }

                try {
                    await ensureLocalApiServer(targetOrigin);

                    const body = req.method && !['GET', 'HEAD'].includes(req.method.toUpperCase())
                        ? await readIncomingBody(req)
                        : undefined;

                    const response = await fetch(buildLocalApiProxyUrl(req.url, targetOrigin), {
                        method: req.method || 'GET',
                        headers: createProxyRequestHeaders(req.headers),
                        body,
                    });

                    await writeFetchResponse(res, response);
                } catch (error: any) {
                    res.statusCode = 502;
                    res.setHeader('Content-Type', 'application/json; charset=utf-8');
                    res.end(JSON.stringify({
                        success: false,
                        error: {
                            code: 'LOCAL_API_PROXY_ERROR',
                            message: error?.message || 'Failed to reach local API service.',
                        },
                    }));
                }
            });
        },
    };
}

/**
 * 开发环境价格扫描代理插件
 * 从服务端去爬取供应商的 /pricing 页面数据（实际请求 /api/pricing）
 * 绕过浏览器 CORS 限制，生产环境由 Netlify Function 处理
 */
function pricingProxyPlugin(): Plugin {
    return {
        name: 'pricing-proxy',
        configureServer(server) {
            server.middlewares.use(async (req, res, next) => {
                if (req.url !== '/api/pricing-proxy' || req.method !== 'POST') {
                    return next();
                }

                // 读取请求体
                let body = '';
                for await (const chunk of req) body += chunk;

                try {
                    const { default: pricingProxyHandler } = await import('./api/pricing-proxy.ts');
                    const response = await pricingProxyHandler(new Request('http://localhost/api/pricing-proxy', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body,
                    }));

                    res.statusCode = response.status;
                    response.headers.forEach((value, key) => res.setHeader(key, value));
                    res.end(await response.text());
                    return;
                } catch (e: any) {
                    console.warn('[pricing-proxy] Falling back to legacy dev proxy:', e?.message);
                }

                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');

                try {
                    const { baseUrl } = JSON.parse(body);
                    const cleanUrl = await normalizeSupplierBaseUrl(baseUrl);

                    if (!cleanUrl) {
                        res.statusCode = 400;
                        res.end(JSON.stringify({ error: '缺少 baseUrl 参数' }));
                        return;
                    }

                    // 从服务端爬取供应商的价格页面数据源
                    const pricingUrl = `${cleanUrl}/api/pricing`;
                    console.log(`[pricing-proxy] 爬取价格页面: ${pricingUrl}`);

                    const response = await fetch(pricingUrl, {
                        method: 'GET',
                        headers: { 'Accept': 'application/json' },
                    });

                    if (!response.ok) {
                        res.end(JSON.stringify({ error: `供应商返回 ${response.status}` }));
                        return;
                    }

                    const text = await response.text();

                    // 如果返回 HTML（SPA 页面），说明路径不对
                    if (text.trimStart().startsWith('<!') || text.trimStart().startsWith('<html')) {
                        res.end(JSON.stringify({ error: '供应商返回了 HTML 页面而非 JSON' }));
                        return;
                    }

                    const data = JSON.parse(text);
                    console.log(`[pricing-proxy] 成功获取 ${(data.data || []).length} 个模型价格`);
                    res.end(JSON.stringify({
                        success: true,
                        data: data.data || [],
                        group_ratio: data.group_ratio || {},
                    }));
                } catch (e: any) {
                    console.error('[pricing-proxy] 错误:', e?.message);
                    res.end(JSON.stringify({ error: e?.message || '代理请求失败' }));
                }
            });

            // 处理 OPTIONS 预检请求
            server.middlewares.use((req, res, next) => {
                if (req.url === '/api/pricing-proxy' && req.method === 'OPTIONS') {
                    res.setHeader('Access-Control-Allow-Origin', '*');
                    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
                    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
                    res.statusCode = 200;
                    res.end();
                    return;
                }
                next();
            });
        },
    };
}

function nutrientDocumentProxyPlugin(): Plugin {
    return {
        name: 'nutrient-document-proxy',
        configureServer(server) {
            server.middlewares.use(async (req, res, next) => {
                const requestPath = getRequestPath(req.url);
                if (requestPath !== '/api/nutrient-document') {
                    return next();
                }

                if (req.method !== 'POST' && req.method !== 'OPTIONS') {
                    return next();
                }

                const body = req.method === 'POST' ? await readIncomingBody(req) : undefined;
                const { default: nutrientDocumentHandler } = await import('./api/nutrient-document.ts');

                const response = await nutrientDocumentHandler(new Request(`http://localhost${req.url || '/api/nutrient-document'}`, {
                    method: req.method,
                    headers: createProxyRequestHeaders(req.headers),
                    body,
                }));

                await writeFetchResponse(res, response);
            });
        },
    };
}

function authPasswordProxyPlugin(): Plugin {
    return {
        name: 'auth-password-proxy',
        configureServer(server) {
            server.middlewares.use(async (req, res, next) => {
                const requestPath = getRequestPath(req.url);
                if (requestPath !== '/api/auth-password-login') {
                    return next();
                }

                if (req.method !== 'POST' && req.method !== 'OPTIONS') {
                    return next();
                }

                const body = req.method === 'POST' ? await readIncomingBody(req) : undefined;
                const requestOrigin = req.headers.host
                    ? `http://${req.headers.host}`
                    : 'http://localhost:3000';
                const { default: authPasswordHandler } = await import('./api/auth-password-login.ts');

                const response = await authPasswordHandler(new Request(`${requestOrigin}${req.url || '/api/auth-password-login'}`, {
                    method: req.method,
                    headers: createProxyRequestHeaders(req.headers),
                    body,
                }));

                await writeFetchResponse(res, response);
            });
        },
    };
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    Object.entries(env).forEach(([key, value]) => {
        if (!(key in process.env)) {
            process.env[key] = value;
        }
    });
    return {
        server: {
            port: 3000,
            strictPort: true, // Fail if port 3000 is in use (don't auto-switch)
            host: '0.0.0.0',
            open: false, // Keep the browser stable and avoid repeated auto-open on dev server restarts
            headers: {
                'Cache-Control': 'no-store',
            },
            proxy: {
                '/api/v1': {
                    target: 'http://127.0.0.1:3001',
                    changeOrigin: true,
                },
                '/api/manifest': {
                    target: 'http://127.0.0.1:3001',
                    changeOrigin: true,
                },
                '/healthz': {
                    target: 'http://127.0.0.1:3001',
                    changeOrigin: true,
                },
            },
            watch: {
                // 🚀 [Critical Fix] 忽略应用自身生成的本地数据文档，防止 Vite HMR 触发强制刷新
                ignored: shouldIgnoreWatchPath
            }
        },
        plugins: [kkApiProxyPlugin(), pricingProxyPlugin(), nutrientDocumentProxyPlugin(), authPasswordProxyPlugin(), buildVersionManifestPlugin()],
        resolve: {
            dedupe: ['react', 'react-dom'],
            alias: {
                '@': path.resolve(__dirname, 'src'),
            }
        },
        optimizeDeps: {
            include: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom/client']
        },

        build: {
            // 确保构建时清理旧文件
            emptyOutDir: true,
            chunkSizeWarningLimit: 700,
            rollupOptions: {
                input: {
                    index: path.resolve(__dirname, 'index.html'),
                    ...(fs.existsSync(TURNSTILE_DIAGNOSTIC_ENTRY)
                        ? { 'turnstile-diagnostic': TURNSTILE_DIAGNOSTIC_ENTRY }
                        : {}),
                },
                output: {
                    manualChunks: resolveManualChunk,
                },
            },
        }
    };
});
