// CPU profile of a page load at 4× CPU, by function (self time, ms). Unminified build in dist/ for real names.
//   MSYS_NO_PATHCONV=1 node eval/cpu.mjs /team [url regex to block, e.g. "googletagmanager"]
import puppeteer from 'puppeteer-core';
import { start } from './serve.mjs';
import { CHROME } from './benchmark.mjs';
const route = process.argv[2] ?? '/', server = await start(4421);
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--enable-gpu', '--use-angle=d3d11'] });
const page = await browser.newPage();
await page.setViewport({ width: 412, height: 823, isMobile: true, hasTouch: true, deviceScaleFactor: 1.75 });
const cdp = await page.createCDPSession();
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
if (process.argv[3]) { const re = new RegExp(process.argv[3]); await page.setRequestInterception(true); page.on('request', (r) => (re.test(r.url()) ? r.abort() : r.continue())); }
await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
await cdp.send('Profiler.start');
await page.goto('http://localhost:4421' + route, { waitUntil: 'load' });
await new Promise((r) => setTimeout(r, 5000));
const { profile } = await cdp.send('Profiler.stop');
const self = {}, byId = new Map(profile.nodes.map((n) => [n.id, n]));
const dt = profile.timeDeltas; let i = 0;
for (const s of profile.samples) { const n = byId.get(s); const f = n.callFrame; const k = `${f.functionName || '(anon)'} ${f.url.split('/').pop()}:${f.lineNumber}`; self[k] = (self[k] ?? 0) + (dt[i++] ?? 0) / 1000; }
console.log('TOTAL busy', Object.entries(self).filter(([k]) => !k.startsWith('(idle)')).reduce((a, [, v]) => a + v, 0).toFixed(0), 'program', (self['(program) :-1'] ?? 0).toFixed(0));
for (const [k, v] of Object.entries(self).sort((a, b) => b[1] - a[1]).slice(0, 30)) console.log(v.toFixed(0).padStart(6), k);
await browser.close(); server.close();
