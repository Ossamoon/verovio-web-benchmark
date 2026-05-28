# Verovio Web Benchmark

A benchmark tool for comparing WASM loading strategies in [Verovio](https://github.com/rism-digital/verovio). It builds a minimal music score viewer and measures Web Vitals with Lighthouse across four variants:

| Variant | Description |
|---|---|
| **inline-wasm** | WASM binary inlined as Base64 in JS (default) |
| **split-wasm** | WASM loaded as a separate `.wasm` file (streaming compilation) |
| **light-wasm** | Inlined WASM with Leipzig font only |
| **light-split** | Separate `.wasm` + Leipzig font only (smallest) |

## Lighthouse Results (Mobile, Fast 4G throttling)

| Variant | FCP | LCP | TBT | Speed Index |
|---|---|---|---|---|
| inline-wasm | 12.7 s | 12.7 s | 0 ms | 12.7 s |
| split-wasm | 1.3 s | 11.3 s | 0 ms | 1.3 s |
| light-wasm | 9.8 s | 9.8 s | 0 ms | 9.8 s |
| **light-split** | **1.3 s** | **8.7 s** | **0 ms** | **1.3 s** |

- **split** reduces FCP by 90% (12.7s → 1.3s) — small JS enables immediate page paint
- **light** reduces LCP by 23% (12.7s → 9.8s) — less data to transfer
- **split + light** achieves the best LCP (8.7s, -31%) with the fastest FCP (1.3s)

## Usage

```bash
# Point the symlink to your Verovio build
ln -s verovio ../verovio-current
npm install

# Build with a specific variant
VARIANT=light-split npm run build

# Preview and measure with Lighthouse
npm run preview
```

See [docs/verification.md](docs/verification.md) for detailed setup and verification procedures.
