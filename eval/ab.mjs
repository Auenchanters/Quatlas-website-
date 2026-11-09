// Which CSS costs layout: median main-thread Layout and style time (first 2.5 s, 4× CPU, 3 runs each) for CSS
// variants injected into the page head before it parses. "NOCSS" drops the stylesheet.
//   MSYS_NO_PATHCONV=1 node eval/ab.mjs /about '{"base":"","noWrap":"p{text-wrap:wrap!important}"}'
import puppeteer from 'puppeteer-core';
import { start } from './serve.mjs';
import { CHROME } from './benchmark.mjs';
const route = process.argv[2] ?? '/team/avionics', server = await start(4425);
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--enable-gpu', '--use-angle=d3d11'] });
const variants = JSON.parse(process.argv[3]);
for (const [name, css] of Object.entries(variants)) {
  const res = [];
  for (let k = 0; k < 3; k++) {
    const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
    await page.setViewport({ width: 412, height: 823, isMobile: true, hasTouch: true, deviceScaleFactor: 1.75 });
    if (css) { await page.setRequestInterception(true); page.on('request', async (r) => { if (r.resourceType() !== 'document') return r.continue(); let body = await (await fetch(r.url())).text(); body = css === 'NOCSS' ? body.replace(/<link rel="stylesheet"[^>]*>/, '') : body.replace('</head>', '<style>' + css + '</style></head>'); r.respond({ status: 200, contentType: 'text/html', body }); }); }
    const cdp = await page.createCDPSession(); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.tracing.start({ categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline'] });
    await page.goto('http://localhost:4425' + route, { waitUntil: 'load' });
    await new Promise((r) => setTimeout(r, 2500));
    const ev = JSON.parse(new TextDecoder().decode(await page.tracing.stop())).traceEvents;
    const sum = (n) => ev.filter((e) => e.name === n && e.dur).reduce((a, e) => a + e.dur, 0) / 1000;
    res.push([sum('Layout'), sum('UpdateLayoutTree'), sum('ParseAuthorStyleSheet')]);
    await ctx.close();
  }
  const med = (i) => res.map((r) => r[i]).sort((a, b) => a - b)[1].toFixed(0);
  console.log(name.padEnd(12), 'layout', med(0), 'style', med(1), 'cssparse', med(2));
}
await browser.close(); server.close();
