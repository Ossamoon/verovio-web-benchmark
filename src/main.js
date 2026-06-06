import createModule from '#verovio-module';
import { VerovioToolkit } from 'verovio/esm';
import meiData from './sample.mei?raw';

async function main() {
  const scoreEl = document.getElementById('score');

  const wasmModule = await createModule();

  const toolkit = new VerovioToolkit(wasmModule);
  toolkit.setOptions({ pageWidth: 2100, pageHeight: 2970, scale: 40 });
  toolkit.loadData(meiData);
  const svg = toolkit.renderToSVG(1);

  scoreEl.innerHTML = svg;

  toolkit.destroy();
}

main();
