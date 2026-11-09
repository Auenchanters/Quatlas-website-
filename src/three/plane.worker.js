import { createScene } from './plane-scene.js';

// The 3D plane in a worker: three.js, the model and every frame run here, on the OffscreenCanvas the page
// handed over, so the page's main thread stays free while the hero loads and turns.
let scene = null;
onmessage = ({ data: m }) => {
  if (m.type !== 'init') return scene?.handle(m);
  try { scene = createScene(m.canvas, m, (msg) => postMessage(msg)); } catch { postMessage({ type: 'fail' }); }
};
