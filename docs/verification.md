# Verovio Web Benchmark Verification Guide

> **Japanese version**: [verification-ja.md](./verification-ja.md)

---

## 1. Prerequisites

| Tool    | Version   | Check Command |
| ------- | --------- | ------------- |
| Node.js | >= 18.0.0 | `node -v`     |
| npm     | >= 9.0.0  | `npm -v`      |
| Chrome  | latest    | Required for Lighthouse / DevTools |

### Directory Layout

```
parent/
├── verovio/                      # Main worktree (develop)
├── verovio-split/                # feature/split-wasm-module
├── verovio-light/                # feature/light-wasm-build
├── verovio-optimize/             # feature/web-optimize (all 4 variants)
├── verovio-current -> verovio    # Symlink (switch target)
└── verovio-web-benchmark/        # This repository
```

---

## 2. Verovio Worktree Setup

### 2.1 Initial Setup (one-time)

```bash
cd ../verovio
git worktree add ../verovio-split feature/split-wasm-module
git worktree add ../verovio-light feature/light-wasm-build
git worktree add ../verovio-optimize feature/web-optimize
ln -s verovio ../verovio-current
```

### 2.2 WASM Build (once per worktree)

```bash
cd ../verovio-optimize/emscripten
./buildNpmPackage
```

### 2.3 Switching Worktrees

```bash
ln -sfn verovio-optimize ../verovio-current
cd verovio-web-benchmark
npm install
```

### 2.4 Module Size Check

```bash
cd ../verovio-current/emscripten
setopt null_glob 2>/dev/null
for f in npm/dist/verovio-module*.mjs npm/dist/*.wasm; do
  [ -f "$f" ] || continue
  raw=$(wc -c < "$f")
  gz=$(gzip -c "$f" | wc -c)
  printf "%-50s %10s %10s\n" "$f" "$raw" "$gz"
done
```

---

## 3. Build and Measure

### 3.1 Variant-specific Build

Use the `VARIANT` environment variable to select the WASM loading strategy:

```bash
VARIANT=inline-wasm npm run build   # Inline WASM (all fonts)
VARIANT=split-wasm  npm run build   # Separate .wasm (all fonts)
VARIANT=light-wasm  npm run build   # Inline WASM (Leipzig only)
VARIANT=light-split npm run build   # Separate .wasm (Leipzig only)
```

Defaults to `inline-wasm` if omitted.

### 3.2 Verification

```bash
npm run preview
```

Open `http://localhost:4173/` in a browser and confirm the music score is displayed.

### 3.3 Lighthouse Measurement

1. Open the preview page in Chrome
2. DevTools > **Lighthouse** tab
3. Categories: **Performance** only
4. Device: **Mobile** or **Desktop**
5. Run "Analyze page load"

Repeat build → preview → Lighthouse for each variant to compare.

### 3.4 Detailed Analysis with Performance Tab

Recording a page load in DevTools > **Performance** tab shows the following custom marks:

| Mark | Meaning |
| --- | --- |
| `verovio:fetch` | MEI file fetch |
| `verovio:init` | WASM module initialization (includes network fetch for split variants) |
| `verovio:render` | MEI parse + SVG generation |
| `verovio:total` | From fetch start to DOM paint |

---

## 4. Web Vitals Mapping

| Optimization | Affected Web Vital | Why |
| --- | --- | --- |
| split (separate .wasm) | FCP, TBT | Small JS enables early paint. Streaming compilation avoids main thread blocking |
| light (Leipzig only) | LCP, TBT | Reduced transfer size speeds download. Less WASM to compile |
| split + light | FCP, LCP, TBT | Combined effect of the above |

---

## 5. Troubleshooting

### zsh glob error when checking module sizes

**Symptom**: The `npm/dist/*.wasm` glob aborts the command when no .wasm files exist

**Fix**: Add `setopt null_glob 2>/dev/null` before the loop (already applied in Section 2.4)

### light build fails with "Failed to load font and glyph bounding boxes"

**Symptom**: `loadData` fails in light-wasm / light-split, no score is rendered

**Cause**: Verovio's `InitFonts()` loads Bravura first to build the glyph name table, but the light build excludes Bravura's font data. Additionally, `Resources::Ok()` requires `m_loadedFonts.size() > 1` (at least 2 fonts)

**Fix**: Modify the verovio C++ code (`resources.cpp` and `resources.h`). See the commits on the verovio-optimize branch for details

### light-split LCP is worse than inline in Lighthouse

**Symptom**: Despite smaller transfer size, light-split shows higher LCP than inline-wasm

**Cause**: Vite's preview server does not gzip-compress `.wasm` files by default. Since `.js` files are compressed, inline-wasm (gzip 2.3MB) has a smaller transfer size than light-split's raw .wasm (4.76MB)

**Fix**: Add `compression` middleware to `vite.config.ts` (already configured in this repo). In production, CDN/reverse proxy handles compression, so this issue does not occur
