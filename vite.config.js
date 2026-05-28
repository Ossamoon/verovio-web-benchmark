import { defineConfig } from 'vite';
import compression from 'compression';

const VARIANT_MAP = {
  'inline-wasm': 'verovio/wasm',
  'split-wasm': 'verovio/wasm-split',
  'light-wasm': 'verovio/wasm-light',
  'light-split': 'verovio/wasm-light-split',
};

const variant = process.env.VARIANT ?? 'inline-wasm';
const modulePath = VARIANT_MAP[variant];

if (!modulePath) {
  throw new Error(
    `Unknown VARIANT "${variant}". Use one of: ${Object.keys(VARIANT_MAP).join(', ')}`,
  );
}

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
  },
});
