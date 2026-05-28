import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { join, basename } from 'node:path';

const DIST_DIR = 'dist/assets';
const RESULTS_DIR = 'results';
const MANIFEST_PATH = 'dist/.vite/manifest.json';

const BANDWIDTHS = {
  'Slow 3G (400 Kbps)': 400_000,
  'Fast 3G (1.6 Mbps)': 1_600_000,
  '4G (10 Mbps)': 10_000_000,
};

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatTime(seconds) {
  if (seconds < 1) return `${(seconds * 1000).toFixed(0)} ms`;
  return `${seconds.toFixed(2)} s`;
}

function measureFile(filePath) {
  const content = readFileSync(filePath);
  const raw = content.length;
  const gzip = gzipSync(content).length;
  const brotli = brotliCompressSync(content).length;
  return { raw, gzip, brotli };
}

// Read Vite manifest for chunk mapping
function readManifest() {
  if (!existsSync(MANIFEST_PATH)) return null;
  return JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));
}

function main() {
  if (!existsSync(DIST_DIR)) {
    console.error(`Error: ${DIST_DIR} not found. Run npm run build first.`);
    process.exit(1);
  }

  const files = readdirSync(DIST_DIR)
    .filter((f) => f.endsWith('.js') || f.endsWith('.wasm') || f.endsWith('.css'))
    .sort();

  if (files.length === 0) {
    console.error(`Error: No files found in ${DIST_DIR}.`);
    process.exit(1);
  }

  // Measure all files
  const measurements = files.map((file) => {
    const filePath = join(DIST_DIR, file);
    const sizes = measureFile(filePath);
    return { file, ...sizes };
  });

  // Print size table
  console.log('\n=== File Sizes ===\n');
  console.log(
    padRight('File', 45),
    padLeft('Raw', 12),
    padLeft('Gzip', 12),
    padLeft('Brotli', 12)
  );
  console.log('-'.repeat(81));

  for (const m of measurements) {
    console.log(
      padRight(m.file, 45),
      padLeft(formatBytes(m.raw), 12),
      padLeft(formatBytes(m.gzip), 12),
      padLeft(formatBytes(m.brotli), 12)
    );
  }

  // Print download time estimates
  console.log('\n=== Estimated Download Times (gzip-based) ===\n');
  console.log(
    padRight('File', 45),
    ...Object.keys(BANDWIDTHS).map((bw) => padLeft(bw, 22))
  );
  console.log('-'.repeat(45 + 22 * Object.keys(BANDWIDTHS).length));

  for (const m of measurements) {
    const times = Object.values(BANDWIDTHS).map((bps) =>
      formatTime((m.gzip * 8) / bps)
    );
    console.log(
      padRight(m.file, 45),
      ...times.map((t) => padLeft(t, 22))
    );
  }

  // Print manifest mapping if available
  const manifest = readManifest();
  if (manifest) {
    console.log('\n=== Vite Manifest (Entry -> Chunk) ===\n');
    for (const [entry, info] of Object.entries(manifest)) {
      const chunks = [info.file, ...(info.css || []), ...(info.assets || [])];
      console.log(`  ${entry}`);
      for (const chunk of chunks) {
        console.log(`    → ${chunk}`);
      }
    }
  }

  // Save JSON results
  if (!existsSync(RESULTS_DIR)) {
    mkdirSync(RESULTS_DIR, { recursive: true });
  }

  const jsonResult = {
    timestamp: new Date().toISOString(),
    files: measurements,
    manifest: manifest || null,
  };

  const jsonPath = join(RESULTS_DIR, 'sizes.json');
  writeFileSync(jsonPath, JSON.stringify(jsonResult, null, 2));
  console.log(`\nResults saved to ${jsonPath}.`);
}

function padRight(str, len) {
  return str.padEnd(len);
}

function padLeft(str, len) {
  return str.padStart(len);
}

main();
