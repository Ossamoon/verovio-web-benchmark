import createVerovioModule from 'verovio/wasm';
import { VerovioToolkit } from 'verovio/esm';
import type { BenchmarkResult } from '../utils/measure';

export async function run(meiData: string): Promise<BenchmarkResult> {
  const t0 = performance.now();
  const VerovioModule = await createVerovioModule();
  const initTimeMs = performance.now() - t0;

  const toolkit = new VerovioToolkit(VerovioModule);
  toolkit.setOptions({ pageWidth: 2100, pageHeight: 2970, scale: 40 });

  const t1 = performance.now();
  toolkit.loadData(meiData);
  const svgOutput = toolkit.renderToSVG(1);
  const renderTimeMs = performance.now() - t1;

  const version = toolkit.getVersion();
  const pageCount = toolkit.getPageCount();
  toolkit.destroy();

  return {
    method: 'inline-wasm',
    initTimeMs,
    renderTimeMs,
    totalTimeMs: initTimeMs + renderTimeMs,
    version,
    pageCount,
    svgOutput,
  };
}
