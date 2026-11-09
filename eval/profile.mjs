// What makes a page's long tasks long. Loads a route on a phone-sized viewport with the CPU slowed 4×
// (as Lighthouse does), records a trace for `seconds`, and prints every main-thread task over 50 ms with
// what ran inside it: script (by file and function), style recalc, layout, paint.
//   node eval/profile.mjs /team/aerodynamics [seconds=8]     (needs a built dist/)
import puppeteer from 'puppeteer-core';
import { start } from './serve.mjs';
import { CHROME } from './benchmark.mjs';

const route = process.argv[2] ?? '/', seconds = +(process.argv[3] ?? 8), port = 4410;
const server = await start(port);
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 412, height: 823, isMobile: true, hasTouch: true, deviceScaleFactor: 1.75 });
  const cdp = await page.createCDPSession();
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.tracing.start({ categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'v8.execute', 'blink.user_timing'] });
  const t0 = Date.now();
  await page.goto(`http://localhost:${port}${route}`, { waitUntil: 'load' });
  await new Promise((r) => setTimeout(r, Math.max(0, seconds * 1000 - (Date.now() - t0))));
  const trace = JSON.parse(new TextDecoder().decode(await page.tracing.stop()));
  const ev = trace.traceEvents;
  const main = ev.find((e) => e.name === 'thread_name' && e.args?.name === 'CrRendererMain' && ev.some((x) => x.pid === e.pid && x.name === 'navigationStart'))
    ?? ev.find((e) => e.name === 'thread_name' && e.args?.name === 'CrRendererMain');
  const onMain = ev.filter((e) => e.pid === main.pid && e.tid === main.tid && e.ph === 'X');
  const nav = ev.find((e) => e.name === 'navigationStart' && e.pid === main.pid)?.ts ?? onMain[0].ts;
  const tasks = onMain.filter((e) => (e.name === 'RunTask' || e.name === 'ThreadControllerImpl::RunTask') && e.dur > 50_000);
  let tbt = 0;
  for (const t of tasks) {
    tbt += t.dur / 1000 - 50;
    const inside = onMain.filter((e) => e.ts >= t.ts && e.ts + e.dur <= t.ts + t.dur && e !== t);
    const by = {};
    for (const e of inside) {
      let key = null;
      if (e.name === 'FunctionCall' || e.name === 'EvaluateScript' || e.name === 'v8.compile') {
        const d = e.args?.data ?? {};
        key = `script ${(d.url ?? '').split('/').pop() || '(inline)'}${d.functionName ? ' ' + d.functionName : ''}`;
      } else if (/^(UpdateLayoutTree|RecalculateStyles)$/.test(e.name)) key = 'style recalc';
      else if (e.name === 'Layout') key = 'layout';
      else if (/^(Paint|PrePaint|Layerize|UpdateLayer|CompositeLayers|Commit)$/.test(e.name)) key = 'paint/composite';
      else if (e.name === 'ParseHTML') key = 'parse HTML';
      else if (e.name === 'GPUTask' || /WebGL|Canvas/.test(e.name)) key = e.name;
      else if (e.name === 'TimerFire' || e.name === 'FireAnimationFrame' || e.name === 'EventDispatch' || e.name === 'FireIdleCallback') key = e.name;
      if (key) by[key] = (by[key] ?? 0) + e.dur / 1000;
    }
    const top = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k} ${v.toFixed(0)}`).join(' | ');
    console.log(`${((t.ts - nav) / 1000).toFixed(0).padStart(6)} ms  ${(t.dur / 1000).toFixed(0).padStart(5)} ms  ${top}`);
  }
  console.log(`\n${tasks.length} tasks over 50 ms, blocking ≈ ${tbt.toFixed(0)} ms (4× CPU, ${seconds} s, not Lighthouse's simulation)`);
} finally {
  await browser.close();
  server.close();
}
