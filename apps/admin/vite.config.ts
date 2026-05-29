import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");
const webRoot = path.resolve(__dirname, "../web");

export default defineConfig({
  root: webRoot,
  envDir: repoRoot,
  server: {
    port: 4174,
    strictPort: true,
    host: "0.0.0.0",
    open: false,
  },
  preview: {
    port: 4174,
    strictPort: true,
    host: "0.0.0.0",
  },
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      "@": path.resolve(webRoot, "src"),
      "@nano-banana/api-client": path.resolve(repoRoot, "packages/api-client/src/index.ts"),
    },
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "react-dom/client"],
  },
  build: {
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      input: {
        index: path.resolve(webRoot, "index.html"),
      },
    },
  },
});
