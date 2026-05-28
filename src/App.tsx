import { useCallback, useEffect, useState } from 'react';
import type { BenchmarkMethod, BenchmarkResult } from './utils/measure';
import { BENCHMARK_METHODS } from './utils/measure';
import { BenchmarkControls } from './components/BenchmarkControls';
import { ResultsTable } from './components/ResultsTable';
import { SvgPreview } from './components/SvgPreview';

type BenchmarkModule = { run: (meiData: string) => Promise<BenchmarkResult> };

const BENCHMARK_IMPORTS: Record<
  BenchmarkMethod,
  () => Promise<BenchmarkModule>
> = {
  'inline-wasm': () => import('./benchmarks/inline-wasm'),
  'split-wasm': () => import('./benchmarks/split-wasm'),
  'light-wasm': () => import('./benchmarks/light-wasm'),
  'light-split': () => import('./benchmarks/light-split'),
};

export function App() {
  const [meiData, setMeiData] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] =
    useState<BenchmarkMethod>('inline-wasm');
  const [results, setResults] = useState<BenchmarkResult[]>([]);
  const [svgOutput, setSvgOutput] = useState<string>('');
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    fetch('/sample.mei')
      .then((res) => res.text())
      .then(setMeiData)
      .catch((err) => setStatus(`Failed to load MEI file: ${err}`));
  }, []);

  const runSingle = useCallback(
    async (method: BenchmarkMethod) => {
      if (!meiData) return;
      setStatus(`Running ${method}...`);
      const mod = await BENCHMARK_IMPORTS[method]();
      const result = await mod.run(meiData);
      setResults((prev) => [...prev.filter((r) => r.method !== method), result]);
      setSvgOutput(result.svgOutput);
      setStatus('');
      return result;
    },
    [meiData]
  );

  const handleRunSelected = useCallback(async () => {
    setRunning(true);
    await runSingle(selectedMethod);
    setRunning(false);
  }, [selectedMethod, runSingle]);

  const handleRunAll = useCallback(async () => {
    setRunning(true);
    setResults([]);
    for (const method of BENCHMARK_METHODS) {
      await runSingle(method);
    }
    setRunning(false);
  }, [runSingle]);

  const handleClearResults = useCallback(() => {
    setResults([]);
    setSvgOutput('');
  }, []);

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ borderBottom: '2px solid #333', paddingBottom: 8 }}>
        Verovio Web Benchmark
      </h1>

      {!meiData ? (
        <p>Loading MEI file...</p>
      ) : (
        <>
          <BenchmarkControls
            selectedMethod={selectedMethod}
            onSelectMethod={setSelectedMethod}
            onRunSelected={handleRunSelected}
            onRunAll={handleRunAll}
            onClearResults={handleClearResults}
            running={running}
          />

          {status && (
            <p style={{ color: '#666', fontStyle: 'italic' }}>{status}</p>
          )}

          {results.length > 0 && <ResultsTable results={results} />}

          {svgOutput && <SvgPreview svg={svgOutput} />}
        </>
      )}
    </div>
  );
}
