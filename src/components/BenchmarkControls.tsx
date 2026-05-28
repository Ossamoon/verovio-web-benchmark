import type { BenchmarkMethod } from '../utils/measure';
import { BENCHMARK_METHODS, METHOD_LABELS } from '../utils/measure';

interface Props {
  selectedMethod: BenchmarkMethod;
  onSelectMethod: (method: BenchmarkMethod) => void;
  onRunSelected: () => void;
  onRunAll: () => void;
  onClearResults: () => void;
  running: boolean;
}

export function BenchmarkControls({
  selectedMethod,
  onSelectMethod,
  onRunSelected,
  onRunAll,
  onClearResults,
  running,
}: Props) {
  return (
    <section style={{ marginBottom: 24 }}>
      <h2>Import Method</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {BENCHMARK_METHODS.map((method) => (
          <label key={method} style={{ cursor: 'pointer' }}>
            <input
              type="radio"
              name="benchmark-method"
              value={method}
              checked={selectedMethod === method}
              onChange={() => onSelectMethod(method)}
              disabled={running}
            />{' '}
            <code>{method}</code> — {METHOD_LABELS[method]}
          </label>
        ))}
      </div>

      <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
        <button onClick={onRunSelected} disabled={running}>
          {running ? 'Running...' : 'Run Selected'}
        </button>
        <button onClick={onRunAll} disabled={running}>
          {running ? 'Running...' : 'Run All'}
        </button>
        <button onClick={onClearResults} disabled={running}>
          Clear Results
        </button>
      </div>
    </section>
  );
}
