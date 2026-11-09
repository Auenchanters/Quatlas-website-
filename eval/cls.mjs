// What shifts: every layout shift while a page loads on a throttled phone (4× CPU, slow 4G), with the elements
// that moved and their before/after rects. Optional CSS to inject, to test a fix.
//   MSYS_NO_PATHCONV=1 node eval/cls.mjs /gallery ["main section{content-visibility:visible}"]
import puppeteer from 'puppeteer-core';
import { start } from './serve.mjs';
import { CHROME } from './benchmark.mjs';
const route = process.argv[2] ?? '/', server = await start(4414);
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 412, height: 823, isMobile: true, hasTouch: true, deviceScaleFactor: 1.75 });
page.on('console', (m) => m.type() === 'error' && console.log('console error:', m.text().slice(0, 300)));
const cdp = await page.createCDPSession(); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 });
await page.evaluateOnNewDocument(`window.__s=[];new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput)window.__s.push({t:Math.round(e.startTime),v:+e.value.toFixed(4),src:e.sources.map(s=>{const n=s.node;return (n?.nodeName||'?')+'.'+String(n?.className?.baseVal??n?.className??'').slice(0,40)+' '+(n?.textContent||'').trim().slice(0,30)+' '+JSON.stringify([s.previousRect.y,s.currentRect.y,s.previousRect.height,s.currentRect.height])})})}).observe({type:'layout-shift',buffered:true});`);
await page.goto('http://localhost:4414' + route, { waitUntil: 'load' });
await new Promise((r) => setTimeout(r, 9000));
for (const s of await page.evaluate(() => window.__s)) console.log(s.t, s.v, s.src.join(' || ').slice(0, 400));
await browser.close(); server.close();
