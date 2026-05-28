import path from 'node:path';
import { defineConfig } from 'vite';
import compression from 'compression';

const VARIANTS = {
  'inline-wasm': { file: 'verovio-module.mjs', worktree: 'verovio' },
  'split-wasm': { file: 'verovio-module-split.mjs', worktree: 'verovio-split' },
  'light-wasm': { file: 'verovio-module-light.mjs', worktree: 'verovio-light' },
  'light-split': { file: 'verovio-module-light-split.mjs', worktree: 'verovio-optimize' },
};

const variant = process.env.VARIANT ?? 'inline-wasm';
const config = VARIANTS[variant];

if (!config) {
  throw new Error(
    `Unknown VARIANT "${variant}". Use one of: ${Object.keys(VARIANTS).join(', ')}`,
  );
}

const modulePath = path.resolve(
  __dirname, '..', config.worktree, 'emscripten', 'npm', 'dist', config.file,
);

function wasmPreloadPlugin() {
  return {
    name: 'wasm-preload',
    enforce: 'post',
    transformIndexHtml(html, ctx) {
      if (!ctx.bundle) return html;
      const wasmAssets = Object.keys(ctx.bundle).filter((name) =>
        name.endsWith('.wasm'),
      );
      return wasmAssets.map((name) => ({
        tag: 'link',
        attrs: { rel: 'preload', href: `/${name}`, as: 'fetch', crossorigin: '' },
        injectTo: 'head',
      }));
    },
  };
}

// Vite's preview server does not gzip .wasm files by default, making split
// variants appear slower than inline (which benefits from .js compression).
// Production CDNs handle this automatically; this plugin closes the gap locally.
function previewCompressionPlugin() {
  return {
    name: 'preview-compression',
    configurePreviewServer(server) {
      server.middlewares.use(compression());
    },
  };
}

export default defineConfig({
  plugins: [wasmPreloadPlugin(), previewCompressionPlugin()],
  resolve: {
    alias: {
      '#verovio-module': modulePath,
    },
  },
  optimizeDeps: {
    exclude: ['verovio'],
  },
  build: {
    target: 'esnext',
    manifest: true,
    outDir: `dist-${variant}`,
  },
});
