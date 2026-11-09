import { createRunner } from './backdrop-scenes.js';

// A subteam page's animated background in a worker: every frame is drawn here, on the OffscreenCanvas the
// page handed over, so the page's main thread stays free.
let runner = null;
onmessage = ({ data: m }) => {
  if (m.type !== 'init') return runner?.handle(m);
  runner = createRunner(m.canvas, m, (msg) => postMessage(msg));
};
