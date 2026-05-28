import createModule from '#verovio-module';
import { VerovioToolkit } from 'verovio/esm';

async function main() {
  const scoreEl = document.getElementById('score');

  const response = await fetch('/sample.mei');
  const meiData = await response.text();

  const wasmModule = await createModule();

  const toolkit = new VerovioToolkit(wasmModule);
  toolkit.setOptions({ pageWidth: 2100, pageHeight: 2970, scale: 40 });
  toolkit.loadData(meiData);
  const svg = toolkit.renderToSVG(1);

  scoreEl.innerHTML = svg;

  toolkit.destroy();
}

main();
