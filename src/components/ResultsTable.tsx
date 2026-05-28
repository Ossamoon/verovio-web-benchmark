import type { BenchmarkResult } from '../utils/measure';

interface Props {
  results: BenchmarkResult[];
}

export function ResultsTable({ results }: Props) {
  const minInit = Math.min(...results.map((r) => r.initTimeMs));
  const minRender = Math.min(...results.map((r) => r.renderTimeMs));
  const minTotal = Math.min(...results.map((r) => r.totalTimeMs));

  return (
    <section style={{ marginBottom: 24 }}>
      <h2>Results</h2>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <thead>
          <tr>
            {['Method', 'Init (ms)', 'Render (ms)', 'Total (ms)', 'Version', 'Pages'].map(
              (header) => (
                <th
                  key={header}
                  style={{
                    borderBottom: '2px solid #333',
                    padding: '8px 12px',
                    textAlign: 'left',
                  }}
                >
                  {header}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody>
          {results.map((r) => (
            <tr key={r.method}>
              <td style={cellStyle}>
                <code>{r.method}</code>
              </td>
              <td
                style={{
                  ...cellStyle,
                  ...(r.initTimeMs === minInit ? highlightStyle : {}),
                }}
              >
                {r.initTimeMs.toFixed(1)}
              </td>
              <td
                style={{
                  ...cellStyle,
                  ...(r.renderTimeMs === minRender ? highlightStyle : {}),
                }}
              >
                {r.renderTimeMs.toFixed(1)}
              </td>
              <td
                style={{
                  ...cellStyle,
                  ...(r.totalTimeMs === minTotal ? highlightStyle : {}),
                }}
              >
                {r.totalTimeMs.toFixed(1)}
              </td>
              <td style={cellStyle}>{r.version}</td>
              <td style={cellStyle}>{r.pageCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

const cellStyle: React.CSSProperties = {
  borderBottom: '1px solid #ddd',
  padding: '8px 12px',
};

const highlightStyle: React.CSSProperties = {
  fontWeight: 'bold',
  color: '#16a34a',
};
