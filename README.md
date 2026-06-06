# Verovio Web Benchmark

A benchmark tool for comparing WASM loading strategies in [Verovio](https://github.com/rism-digital/verovio). It builds a minimal music score viewer and measures Web Vitals with Lighthouse across four variants:

| Variant         | Description                                                    |
| --------------- | -------------------------------------------------------------- |
| **inline-wasm** | WASM binary inlined as Base64 in JS (default)                  |
| **split-wasm**  | WASM loaded as a separate `.wasm` file (streaming compilation) |
| **light-wasm**  | Inlined WASM with Leipzig font only                            |
| **light-split** | Separate `.wasm` + Leipzig font only (smallest)                |

## Results

### Module Sizes

| Module                                                |             Raw |            gzip |
| ----------------------------------------------------- | --------------: | --------------: |
| verovio-module.mjs (inline, all fonts)                |         6.68 MB |         2.18 MB |
| verovio-module-light.mjs (inline, Leipzig only)       |         4.96 MB |         1.63 MB |
| verovio-module-split.mjs + .wasm (all fonts)          | 69 KB + 6.24 MB | 19 KB + 2.11 MB |
| verovio-module-light-split.mjs + .wasm (Leipzig only) | 69 KB + 4.54 MB | 19 KB + 1.56 MB |

### Lighthouse (Mobile, Fast 4G throttling)

| Variant         | FCP       | LCP       | TBT      | Speed Index |
| --------------- | --------- | --------- | -------- | ----------- |
| inline-wasm     | 12.7 s    | 12.7 s    | 0 ms     | 12.7 s      |
| split-wasm      | 1.3 s     | 11.3 s    | 0 ms     | 1.3 s       |
| light-wasm      | 9.8 s     | 9.8 s     | 0 ms     | 9.8 s       |
| **light-split** | **1.3 s** | **8.6 s** | **0 ms** | **1.3 s**   |

- **split** reduces FCP by 90% (12.7s → 1.3s) — small JS enables immediate page paint
- **light** reduces LCP by 23% (12.7s → 9.8s) — less data to transfer
- **split + light** achieves the best LCP (8.6s, -32%) with the fastest FCP (1.3s)
- **CLS** = 0 for every variant (the score is rendered once, with no layout shift)

> The sample MEI is inlined into the JS bundle (Vite `?raw`) rather than fetched at runtime. Its ~10 KB still travels inside the JS — so it isn't off the critical path — but it's now an equal constant across all variants, with no separate request to contend with the `.wasm` download or to block module init.

### Web Vitals Mapping

| Optimization           | Affected Web Vital | Why                                                                             |
| ---------------------- | ------------------ | ------------------------------------------------------------------------------- |
| split (separate .wasm) | FCP, TBT           | Small JS enables early paint. Streaming compilation avoids main thread blocking |
| light (Leipzig only)   | LCP, TBT           | Reduced transfer size speeds download. Less WASM to compile                     |
| split + light          | FCP, LCP, TBT      | Combined effect of the above                                                    |

## Prerequisites

| Tool    | Version   | Check Command                      |
| ------- | --------- | ---------------------------------- |
| Node.js | >= 18.0.0 | `node -v`                          |
| npm     | >= 9.0.0  | `npm -v`                           |
| Chrome  | latest    | Required for Lighthouse / DevTools |

### Directory Layout

```
parent/
├── verovio/                      # Main worktree (develop, baseline)
├── verovio-split/                # feature/split-wasm-module
├── verovio-light/                # feature/light-wasm-build
├── verovio-optimize/             # feature/web-optimize (all 4 variants)
└── verovio-web-benchmark/        # This repository
```

## Setup

### Verovio Worktrees (one-time)

```bash
cd ../verovio
git worktree add ../verovio-split feature/split-wasm-module
git worktree add ../verovio-light feature/light-wasm-build
git worktree add ../verovio-optimize feature/web-optimize
```

### WASM Build (once per worktree)

```bash
cd ../verovio/emscripten
./buildNpmPackage
```

```bash
cd ../verovio-split/emscripten
./buildNpmPackage
```

```bash
cd ../verovio-light/emscripten
./buildNpmPackage
```

```bash
cd ../verovio-optimize/emscripten
./buildNpmPackage
```

### Install Dependencies

```bash
npm install
```

## Usage

### Build

Use the `VARIANT` environment variable to select the WASM loading strategy. Each variant outputs to its own directory (`dist-{variant}`), so all four can be built simultaneously:

```bash
VARIANT=inline-wasm npm run build
VARIANT=split-wasm  npm run build
VARIANT=light-wasm  npm run build
VARIANT=light-split npm run build
```

Defaults to `inline-wasm` if omitted. See the [variant table](#verovio-web-benchmark) for descriptions.

### Preview

```bash
VARIANT=inline-wasm npm run preview
```

```bash
VARIANT=split-wasm npm run preview
```

```bash
VARIANT=light-wasm npm run preview
```

```bash
VARIANT=light-split npm run preview
```

Vite's preview server defaults to port 4173 and auto-increments when the port is already in use, so multiple variants can run simultaneously (4173–4176).

### Lighthouse Measurement

1. Open the preview page in Chrome
2. DevTools > **Lighthouse** tab
3. Categories: **Performance** only
4. Device: **Mobile** or **Desktop**
5. Run "Analyze page load"
