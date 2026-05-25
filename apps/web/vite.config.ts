import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 本地 Inline 兼容性与 Stub 插件实现
const addRenderIds = (): Plugin => ({ name: 'add-render-ids' });
const aliases = (): Plugin => ({ name: 'aliases' });
const consoleToParent = (): Plugin => ({ name: 'console-to-parent' });
const layoutWrapperPlugin = (): Plugin => ({ name: 'layout-wrapper' });
const loadFontsFromTailwindSource = (): Plugin => ({ name: 'load-fonts' });
const restart = (options?: any): Plugin => ({ name: 'restart' });
const restartEnvFileChange = (): Plugin => ({ name: 'restart-env' });
const nextPublicProcessEnv = (): Plugin => ({
  name: 'next-public-process-env',
  config: () => ({
    define: {
      'process.env': JSON.stringify(process.env)
    }
  })
});

export default defineConfig({
  // 必须允许 VITE_ 前缀的环境变量，否则以 VITE_ 开头的 Turnstile 密钥等变量将无法在浏览器端被正确读取
  envPrefix: ['NEXT_PUBLIC_', 'VITE_'],
  optimizeDeps: {
    // Explicitly include fast-glob, since it gets dynamically imported and we
    // don't want that to cause a re-bundle.
    include: ['fast-glob', 'lucide-react'],
    exclude: [
      '@hono/auth-js/react',
      '@hono/auth-js',
      '@auth/core',
      '@hono/auth-js',
      'hono/context-storage',
      '@auth/core/errors',
      'fsevents',
      'lightningcss',
    ],
  },
  logLevel: 'info',
  plugins: [
    nextPublicProcessEnv(),
    restartEnvFileChange(),
    restart({
      restart: [
        'src/**/page.jsx',
        'src/**/page.tsx',
        'src/**/layout.jsx',
        'src/**/layout.tsx',
        'src/**/route.js',
        'src/**/route.ts',
      ],
    }),
    consoleToParent(),
    loadFontsFromTailwindSource(),
    addRenderIds(),
    tsconfigPaths(),
    aliases(),
    layoutWrapperPlugin(),
  ],
  resolve: {
    alias: {
      lodash: 'lodash-es',
      'npm:stripe': 'stripe',
      stripe: path.resolve(__dirname, './src/__create/stripe'),
      '@auth/create/react': '@hono/auth-js/react',
      '@auth/create': path.resolve(__dirname, './src/__create/@auth/create'),
      '@': path.resolve(__dirname, 'src'),
    },
    dedupe: ['react', 'react-dom'],
  },
  clearScreen: false,
  server: {
    allowedHosts: true,
    host: '0.0.0.0',
    port: 4000,
    fs: {
      allow: ['..', '../../shared'],
    },
    hmr: {
      overlay: false,
    },
    warmup: {
      clientFiles: ['./src/app/**/*', './src/app/root.tsx', './src/app/routes.ts'],
    },
  },
});
