// Runs fn once the page has loaded, `ms` after that, when the browser is idle. Returns a cancel function.
// For what can wait: anything fetched earlier competes with the page's own first paint on a slow connection.
export function afterLoad(fn, ms = 0) {
  let t = 0, id = 0, off = false;
  const idle = () => { id = (window.requestIdleCallback ?? setTimeout)(() => !off && fn(), { timeout: 2000 }); };
  const go = () => { t = setTimeout(idle, ms); };
  if (document.readyState === 'complete') go(); else addEventListener('load', go, { once: true });
  return () => { off = true; clearTimeout(t); (window.cancelIdleCallback ?? clearTimeout)(id); removeEventListener('load', go); };
}
