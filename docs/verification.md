# Verovio Web Benchmark Verification Guide

> **Japanese version**: [verification-ja.md](./verification-ja.md)

This document provides comprehensive verification procedures for the benchmark site, including functional testing, performance measurement, and Vite dependency resolution validation.

---

## 1. Prerequisites

### Required Tools

| Tool | Version | Check Command |
|---|---|---|
| Node.js | >= 18.0.0 | `node -v` |
| npm | >= 9.0.0 | `npm -v` |
| brotli (optional) | any | `brotli --version` |
| Chrome | latest | Required for DevTools measurements |

### Directory Layout

This project uses **git worktrees** to keep each Verovio branch in a separate directory, preserving build artifacts across measurements. A **symlink** (`verovio-current`) allows switching between worktrees without editing `package.json`.

```
parent/
├── verovio/                      # Main worktree (develop, pre-built)
├── verovio-split/                # Worktree: feature/split-wasm-module
├── verovio-light/                # Worktree: feature/light-wasm-build
├── verovio-optimize/             # Worktree: feature/web-optimize
├── verovio-current -> verovio    # Symlink (switch target)
└── verovio-web-benchmark/        # This repository
    └── package.json              # "verovio": "file:../verovio-current/emscripten/npm"
```

> **Note for new contributors**: If you don't need worktrees, you can simply point the symlink to a single verovio clone: `ln -s verovio verovio-current`

---

## 2. Verovio Worktree Setup and WASM Build

Each Verovio branch is checked out in its own directory via git worktree. Build artifacts are independent per worktree, so once built, no cleanup or rebuild is needed when switching between branches.

### 2.1 Target Branches and Worktrees

| Worktree Directory | Verovio Branch | Available Variants | What to Verify |
|---|---|---|---|
| `verovio/` | `develop` (baseline) | inline-wasm | Record current bundle size and load times |
| `verovio-split/` | `feature/split-wasm-module` | inline-wasm, split-wasm | Compare inline vs split sizes and load times |
| `verovio-light/` | `feature/light-wasm-build` | inline-wasm, light-wasm | Compare full-font vs Leipzig-only sizes |
| `verovio-optimize/` | `feature/web-optimize` | All 4 variants | Measure the fully optimized wasm-light-split build |

### 2.2 Initial Worktree Setup

This is a one-time setup. Skip this section if worktrees are already created.

```bash
# From the main verovio repository
cd ../verovio
git worktree add ../verovio-split feature/split-wasm-module
git worktree add ../verovio-light feature/light-wasm-build
git worktree add ../verovio-optimize feature/web-optimize

# Create the symlink (points to develop initially)
ln -s verovio ../verovio-current

# Verify
git worktree list
```

### 2.3 WASM Build (Per Worktree)

Each worktree needs one WASM build. Once built, the artifacts persist.

```bash
# Example: build the split-wasm worktree
cd ../verovio-split/emscripten
./buildNpmPackage

# Verify build artifacts
ls -la npm/dist/
```

Files present after a successful build (varies by branch):

| File | Branch | Description |
|---|---|---|
| `verovio-module.mjs` | All branches | Inline WASM (all fonts) |
| `verovio-module-split.mjs` + `*.wasm` | split-wasm branches | Separate WASM (all fonts) |
| `verovio-module-light.mjs` | light branches | Inline WASM (Leipzig only) |
| `verovio-module-light-split.mjs` + `*.wasm` | web-optimize | Separate WASM (Leipzig only) |
| `verovio.mjs` | All branches | ESM toolkit |

### 2.4 Switching Between Worktrees

Switch the symlink target and reinstall:

```bash
# Switch to the split-wasm worktree
ln -sfn verovio-split ../verovio-current
cd verovio-web-benchmark
npm install

# Switch to the light worktree
ln -sfn verovio-light ../verovio-current
npm install

# Switch back to develop
ln -sfn verovio ../verovio-current
npm install
```

### 2.5 Pre-bundling Size Check on the Verovio Side

Raw module sizes can be checked directly on the verovio side before Vite bundling. This is useful for quickly assessing the optimization impact of the WASM build itself right after building.

```bash
cd ../verovio-current/emscripten
for f in npm/dist/verovio-module*.mjs npm/dist/*.wasm; do
  [ -f "$f" ] || continue
  raw=$(wc -c < "$f")
  gz=$(gzip -c "$f" | wc -c)
  printf "%-50s %10s %10s\n" "$f" "$raw" "$gz"
done
```

**Difference from the benchmark-side measurement (Section 5)**:

| Location | Target | Meaning |
|---|---|---|
| Verovio side (`npm/dist/`) | Raw modules output by Emscripten/Rollup | Directly measures WASM build optimization impact |
| Benchmark side (`dist/assets/`) | Chunks bundled by Vite | Size that end-users actually download |

- Verovio side: Sizes include shared code (VerovioToolkit, etc.) within each module
- Benchmark side: Vite separates shared chunks; React and main.ts code are in separate chunks

### 2.6 Complete Measurement Workflow (Summary)

```bash
# Switch to target worktree (build must be done once beforehand)
ln -sfn verovio-split ../verovio-current

# Reinstall, build, and measure
cd verovio-web-benchmark
npm install
npm run build
npm run measure-sizes

# Save results
cp results/sizes.json results/sizes-split.json
```

---

## 3. Benchmark Environment Setup and Development Server Verification

### 3.1 Initial Setup

Assumes the WASM build from Section 2 is complete.

```bash
cd verovio-web-benchmark
npm install
npm run dev
```

Open the displayed URL (typically `http://localhost:5173`) in a browser.

### 3.2 Individual Method Execution

Select each of the 4 methods and click the "Run Selected" button:

1. **inline-wasm** — `verovio/wasm` (inline WASM, all fonts)
2. **split-wasm** — `verovio/wasm-split` (separate .wasm, all fonts)
3. **light-wasm** — `verovio/wasm-light` (inline WASM, Leipzig only)
4. **light-split** — `verovio/wasm-light-split` (separate .wasm, Leipzig only)

Checklist for each method:

- [ ] A row is added to the results table
- [ ] `initTimeMs` and `renderTimeMs` display positive numbers
- [ ] `version` shows the Verovio version string (e.g., `6.3.0-alpha`)
- [ ] `pageCount` is 1 or greater
- [ ] Music notation SVG is rendered in the output area
- [ ] No errors in the browser console (F12 > Console)

> **Note**: Running a variant not supported by the current Verovio branch will result in an error. Refer to the table in Section 2.1 and only run supported variants.

### 3.3 "Run All" Verification

1. Click "Clear Results" to reset
2. Click "Run All"
3. Verify:
   - [ ] All 4 methods execute sequentially (status updates between runs)
   - [ ] The results table shows 4 rows
   - [ ] The fastest values are highlighted in green bold

---

## 4. Production Build Verification

### 4.1 Running the Build

```bash
npm run build
```

Verify the build completes without errors.

### 4.2 Chunk Structure Verification

```bash
ls -la dist/assets/
```

Checklist:
- [ ] Multiple `.js` files exist (main chunk + per-benchmark chunks + shared chunks)
- [ ] `.wasm` files exist for split variants
- [ ] File sizes are reasonable (inline variant chunks should be larger than split variant chunks)

### 4.3 Preview Server Verification

```bash
npm run preview
```

Open the displayed URL and perform the same checks as Section 3. In particular:
- [ ] split-wasm works correctly (`.wasm` file fetch succeeds)
- [ ] light-split works correctly
- [ ] `.wasm` file responses return HTTP 200 in the browser Network tab

---

## 5. File Size Measurement

### 5.1 Running the Measurement

```bash
npm run measure-sizes
```

### 5.2 Example Output

```
=== File Sizes ===

File                                          Raw         Gzip       Brotli
---------------------------------------------------------------------------------
inline-wasm-xxxxx.js                       8.5 MB     3.2 MB      2.8 MB
split-wasm-xxxxx.js                       45.2 KB    15.1 KB     12.8 KB
verovio-xxxxx.wasm                         8.4 MB     3.1 MB      2.7 MB
light-wasm-xxxxx.js                        4.2 MB     1.6 MB      1.4 MB
light-split-xxxxx.js                      22.1 KB     7.5 KB      6.3 KB
verovio-light-xxxxx.wasm                   4.1 MB     1.5 MB      1.3 MB
...

=== Estimated Download Times (gzip-based) ===

File                                    Slow 3G (400 Kbps)   Fast 3G (1.6 Mbps)      4G (10 Mbps)
...
```

### 5.3 Reading the Results

| Item | Description |
|---|---|
| Raw | Uncompressed file size |
| Gzip | Size after gzip compression (typical server delivery) |
| Brotli | Size after Brotli compression (modern CDN delivery) |
| Download Time | Estimated time based on gzip size at various bandwidths |

### 5.4 Saving and Comparing Results

Measurement results are automatically saved to `results/sizes.json`. For cross-branch comparison:

```bash
# Save the develop branch results
cp results/sizes.json results/sizes-develop.json

# Switch to a feature branch and re-measure (see Section 2.5)
# ...

# Compare differences
diff results/sizes-develop.json results/sizes.json
```

---

## 6. Vite Dependency Resolution Full-Stack Verification

### 6.1 optimizeDeps Behavior Check

Verify that verovio is not included in Vite's dependency pre-bundling cache.

```bash
# After starting the dev server
ls node_modules/.vite/deps/
```

Checklist:
- [ ] No verovio-related files exist in the pre-bundle cache
- [ ] Other dependencies like `react` are pre-bundled

This confirms the following `vite.config.ts` setting is working:
```ts
optimizeDeps: {
  exclude: ['verovio'],
}
```

If verovio is pre-bundled, WASM module loading may fail or chunk isolation may not work correctly.

### 6.2 Build Chunk Analysis

Verify that the generated chunks correctly isolate each benchmark variant.

#### 6.2.1 Verification by File Size

```bash
ls -lhS dist/assets/*.js
```

Expected results:
- **inline-wasm chunk**: Largest (WASM binary is inlined)
- **light-wasm chunk**: Smaller than inline-wasm (Leipzig font only)
- **split-wasm / light-split chunks**: Very small (WASM loader only)
- **Shared chunk**: Small chunk containing VerovioToolkit

#### 6.2.2 Vite Manifest Analysis

```bash
cat dist/.vite/manifest.json | python3 -m json.tool
```

Verify that each manifest entry maps as follows:

| Entry | Corresponding Chunk | Included Assets |
|---|---|---|
| `src/benchmarks/inline-wasm.ts` | `assets/inline-wasm-*.js` | None |
| `src/benchmarks/split-wasm.ts` | `assets/split-wasm-*.js` | `.wasm` file |
| `src/benchmarks/light-wasm.ts` | `assets/light-wasm-*.js` | None |
| `src/benchmarks/light-split.ts` | `assets/light-split-*.js` | `.wasm` file |

### 6.3 Runtime Module Resolution Verification

Verify in the browser Network tab that different JS chunks are loaded when each benchmark is executed.

#### Steps

1. Open the `npm run preview` page in Chrome
2. Open DevTools > Network tab
3. Set filter to `JS`
4. Click "Clear Results"
5. Select **inline-wasm** and run
   - [ ] `inline-wasm-*.js` chunk is loaded
   - [ ] This chunk is large (WASM inlined)
6. Reload the page (cache clear: Cmd+Shift+R)
7. Select **split-wasm** and run
   - [ ] `split-wasm-*.js` chunk is loaded (small)
   - [ ] A separate `.wasm` file request is made
8. Repeat for **light-wasm** and **light-split**

### 6.4 Split WASM File Serving Verification

```bash
# While the preview server is running, check from another terminal
curl -I http://localhost:4173/assets/[wasm-filename].wasm
```

Checklist:
- [ ] HTTP status is `200 OK`
- [ ] `Content-Type` is `application/wasm`
- [ ] `Content-Length` is a reasonable size

---

## 7. DevTools Throttling Manual Measurement

### 7.1 Network Throttling Setup

1. Open Chrome DevTools (F12 or Cmd+Option+I)
2. Select the **Network** tab
3. From the **Throttling** dropdown, select:
   - `Fast 3G`: Download 1.6 Mbps / Upload 750 Kbps / Latency 150ms
   - `Slow 3G`: Download 400 Kbps / Upload 400 Kbps / Latency 400ms

### 7.2 Measurement Procedure

For each benchmark method, repeat the following **3 times**:

1. Set the throttling profile
2. Hard refresh: `Cmd + Shift + R` (disable cache and reload)
3. Wait for page load to complete
4. Select the target benchmark method and run
5. Check and record the Network tab waterfall:
   - JS chunk fetch time
   - `.wasm` file fetch time (split variants only)
   - WASM compile start-to-finish time
6. Record `initTimeMs` and `renderTimeMs` from the results table

Use the **median** value from the 3 measurements.

### 7.3 Reading the Waterfall

Key points to observe in each Network tab request:

| Phase | Description | How to Identify |
|---|---|---|
| Stalled / Queueing | Request queueing | Gray section in waterfall |
| TTFB | Time to first byte | Green section in waterfall |
| Content Download | Data transfer | Blue section in waterfall |

**Inline vs Split comparison points**:
- **inline-wasm**: WASM is Base64-encoded within the JS chunk, resulting in a large JS download. WASM decoding and compilation occur after the download completes
- **split-wasm**: The JS loader is small and downloads quickly. The `.wasm` file is then fetched and **streaming compilation** (`WebAssembly.instantiateStreaming`) is possible, allowing download and compilation to proceed in parallel

### 7.4 Initialization Profiling with the Performance Tab

For more detailed analysis:

1. Open DevTools > **Performance** tab
2. Click the record button (red circle)
3. Execute the benchmark method
4. Stop recording after execution completes
5. Check the timeline for:
   - `wasm-compile`: WASM compilation time
   - `wasm-instantiate`: WASM instantiation time
   - Main thread blocking time

---

## 8. Troubleshooting

### Cannot resolve verovio package

**Symptom**: `Could not resolve dependency` error during `npm install`

**Cause**: The symlink target's `emscripten/npm/dist/` has not been built

**Fix**:
```bash
# Check which worktree the symlink points to
ls -la ../verovio-current

# Build WASM in that worktree
cd ../verovio-current/emscripten
./buildNpmPackage
cd ../../verovio-web-benchmark
rm -rf node_modules
npm install
```

### Symlink not found

**Symptom**: `npm install` fails with `ENOENT ../verovio-current/emscripten/npm`

**Cause**: The `verovio-current` symlink does not exist

**Fix**:
```bash
# Create the symlink (pointing to the desired worktree)
ln -s verovio ../verovio-current
```

### Split WASM .wasm file returns 404

**Symptom**: `.wasm` file returns 404 in the Network tab when running split-wasm

**Cause**: `.wasm` file was not copied to `dist/assets/` during build

**Fix**:
1. Check if `.wasm` files exist in `dist/assets/`
2. If not, check the `assetsInclude` setting in `vite.config.ts`
3. Manual workaround: `cp node_modules/verovio/dist/*.wasm dist/assets/`

### WASM initialization timeout

**Symptom**: Benchmark execution does not complete, browser freezes

**Cause**: WASM module is too large and compilation takes too long

**Fix**:
1. Disable throttling and retry
2. Check WASM compilation time in DevTools > Performance tab
3. Try a light variant first (approximately half the size)

### Out of memory error (during "Run All")

**Symptom**: `Out of memory` error or tab crash

**Cause**: Multiple WASM instances occupying memory simultaneously

**Fix**:
1. Close and reopen the browser tab
2. Run each method individually
3. Verify `toolkit.destroy()` is being called correctly (`src/benchmarks/*.ts`)

### Vite pre-bundling error

**Symptom**: `Pre-bundling failed` or verovio-related WASM error on dev server startup

**Cause**: `verovio` is not set in `optimizeDeps.exclude`

**Fix**:
1. Check `vite.config.ts`:
   ```ts
   optimizeDeps: {
     exclude: ['verovio'],
   }
   ```
2. Clear Vite cache:
   ```bash
   rm -rf node_modules/.vite
   npm run dev
   ```

### Worktree management

**List all worktrees**:
```bash
cd ../verovio
git worktree list
```

**Remove a worktree** (when no longer needed):
```bash
git worktree remove ../verovio-split
```

**Rebuild a worktree's WASM** (after pulling new changes):
```bash
cd ../verovio-split/emscripten
rm -rf npm/dist build CMakeFiles CMakeCache.txt
./buildNpmPackage
```
