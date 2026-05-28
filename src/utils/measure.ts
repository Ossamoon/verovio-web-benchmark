export interface BenchmarkResult {
  method: string;
  initTimeMs: number;
  renderTimeMs: number;
  totalTimeMs: number;
  version: string;
  pageCount: number;
  svgOutput: string;
}

export type BenchmarkRunner = (meiData: string) => Promise<BenchmarkResult>;

export const BENCHMARK_METHODS = [
  'inline-wasm',
  'split-wasm',
  'light-wasm',
  'light-split',
] as const;

export type BenchmarkMethod = (typeof BENCHMARK_METHODS)[number];

export const METHOD_LABELS: Record<BenchmarkMethod, string> = {
  'inline-wasm': 'Inline WASM (all fonts)',
  'split-wasm': 'Split WASM (all fonts)',
  'light-wasm': 'Light WASM (Leipzig only)',
  'light-split': 'Light + Split (Leipzig only)',
};
