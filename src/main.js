import createModule from '#verovio-module';
import { VerovioToolkit } from 'verovio/esm';

async function main() {
  const scoreEl = document.getElementById('score');

  // Fetch MEI data
  performance.mark('verovio:fetch-start');
  const response = await fetch('/sample.mei');
  const meiData = await response.text();
  performance.mark('verovio:fetch-end');
  performance.measure('verovio:fetch', 'verovio:fetch-start', 'verovio:fetch-end');

  // Initialize WASM module
  performance.mark('verovio:init-start');
  const wasmModule = await createModule();
  performance.mark('verovio:init-end');
  performance.measure('verovio:init', 'verovio:init-start', 'verovio:init-end');

  // Render MEI to SVG
  performance.mark('verovio:render-start');
  const toolkit = new VerovioToolkit(wasmModule);
  toolkit.setOptions({ pageWidth: 2100, pageHeight: 2970, scale: 40 });
  toolkit.loadData(meiData);
  const svg = toolkit.renderToSVG(1);
  performance.mark('verovio:render-end');
  performance.measure('verovio:render', 'verovio:render-start', 'verovio:render-end');

  // Paint SVG to DOM (triggers LCP)
  scoreEl.innerHTML = svg;
  performance.mark('verovio:paint');
  performance.measure('verovio:total', 'verovio:fetch-start', 'verovio:paint');

  toolkit.destroy();
}

main();
