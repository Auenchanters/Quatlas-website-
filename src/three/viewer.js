// The page side of the home hero's 3D plane (the scene itself is plane-scene.js): the canvas, the part
// labels, pointer and size and visibility. Where the browser can (OffscreenCanvas), the scene runs in a
// worker, so three.js never touches the page's main thread; otherwise it runs here, one step later.
// Draws only while on screen and while the tab is visible. Returns { set, destroy }.
let flown = false; // the fly-in plays once per visit, not on every return to the home page

export function mountPlane(el, { names, onPick, onToggle, onReady, onFail, zoom = 1 }) {
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = Object.assign(document.createElement('canvas'), { className: 'absolute inset-0 size-full' });
  canvas.setAttribute('aria-hidden', 'true');
  el.append(canvas);
  const labels = Object.fromEntries(Object.entries(names).map(([id, name]) => {
    const s = Object.assign(document.createElement('span'), { textContent: name, className: 'plane-label' });
    el.append(s);
    return [id, s];
  }));

  // Labels: on their parts, slid up or down off any they would cover (a narrow panel bunches the parts
  // up), and kept inside the panel.
  const place = ({ show, active, at }) => {
    const w = el.clientWidth, h = el.clientHeight, placed = [];
    for (const [id, px, py] of at) {
      const s = labels[id];
      if (!s) continue;
      s.style.opacity = show;
      s.dataset.on = id === active ? '1' : '';
      if (!show) continue;
      const lw = s.offsetWidth, lh = s.offsetHeight;
      let x = Math.min(w - lw / 2 - 4, Math.max(lw / 2 + 4, px)), y = py;
      for (let i = 0; i < 6; i++) {
        const p = placed.find((q) => Math.abs(q.x - x) < (q.w + lw) / 2 + 4 && Math.abs(q.y - y) < (q.h + lh) / 2 + 3);
        if (!p) break;
        y = p.y + Math.sign(y - p.y || 1) * ((p.h + lh) / 2 + 3);
      }
      y = Math.min(h - lh / 2 - 4, Math.max(lh / 2 + 4, y));
      placed.push({ x, y, w: lw, h: lh });
      s.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    }
  };
  const receive = (m) => {
    if (m.type === 'ready') onReady?.();
    else if (m.type === 'labels') place(m);
    else if (m.type === 'fail') onFail?.();
    else if (m.type === 'pick') {
      // Clicking the model labels its parts (toggles); clicking beside it while apart puts it back together.
      if (m.click) { if (m.id) onPick(m.id); if (m.id || m.exploded) onToggle?.(m.id, m.exploded); }
      else { if (m.id && m.mouse) onPick(m.id); el.style.cursor = m.id ? 'pointer' : ''; }
    }
  };

  const init = { type: 'init', w: el.clientWidth || 1, h: el.clientHeight || 1, dpr: devicePixelRatio || 1, still, zoom, flown };
  flown = true;
  let send, worker = null, here = null, dead = false;
  const queue = [];
  if ('transferControlToOffscreen' in HTMLCanvasElement.prototype && typeof Worker === 'function') {
    worker = new Worker(new URL('./plane.worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => receive(data);
    worker.onerror = () => onFail?.();
    const off = canvas.transferControlToOffscreen();
    worker.postMessage({ ...init, canvas: off }, [off]);
    send = (m) => worker.postMessage(m);
  } else {
    send = (m) => (here ? here.handle(m) : queue.push(m));
    import('./plane-scene.js').then(({ createScene }) => {
      if (dead) return;
      try { here = createScene(canvas, init, receive); } catch { onFail?.(); return; }
      queue.splice(0).forEach((m) => here.handle(m));
    }, () => onFail?.());
  }

  const ro = new ResizeObserver(() => el.clientWidth && send({ type: 'resize', w: el.clientWidth, h: el.clientHeight }));
  ro.observe(el);
  const ndc = (e) => { const r = el.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1 }; };
  const move = (e) => send({ type: 'pointer', kind: 'move', mouse: e.pointerType === 'mouse', ...ndc(e) });
  const click = (e) => send({ type: 'pointer', kind: 'click', mouse: e.pointerType === 'mouse', ...ndc(e) });
  const leave = () => send({ type: 'pointer', kind: 'leave' });
  el.addEventListener('pointermove', move); el.addEventListener('click', click); el.addEventListener('pointerleave', leave);
  let onScreen = true;
  const vis = () => send({ type: 'visible', on: onScreen && !document.hidden });
  const io = new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; vis(); }, { rootMargin: '100px' });
  io.observe(el);
  document.addEventListener('visibilitychange', vis);

  return {
    set(v) { send({ type: 'set', ...v }); },
    destroy() {
      dead = true;
      send({ type: 'destroy' });
      if (worker) setTimeout(() => worker.terminate(), 100);
      ro.disconnect(); io.disconnect();
      document.removeEventListener('visibilitychange', vis);
      el.removeEventListener('pointermove', move); el.removeEventListener('click', click); el.removeEventListener('pointerleave', leave);
      canvas.remove(); Object.values(labels).forEach((s) => s.remove());
    },
  };
}
