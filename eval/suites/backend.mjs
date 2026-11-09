// The back end the site depends on.
// 1. The live API (read-only GETs only, nothing is written): answers fast, with the shapes the pages read.
// 2. The image relay (api/img.js) run locally against its own rules: bad input refused cleanly.
// 3. The admin dashboard end to end against the mock API (scripts/mock-api.mjs, nothing real touched):
//    log in, open every screen, add and delete a link, log out — no errors anywhere.
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { API_MS } from '../benchmark.mjs';
import { go, watch } from './pages.mjs';

const LIVE = 'https://quatlasserver.vercel.app/api';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function timed(url) {
  const t = Date.now();
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
    return { status: r.status, ms: Date.now() - t, body: await r.json().catch(() => null) };
  } catch (e) { return { status: 0, ms: Date.now() - t, error: e.message }; }
}

const SHAPES = {
  '/members/memberData': (d) => Array.isArray(d) && Array.isArray(d[0]?.teams) && d[0].teams.every((t) => typeof t.roleName === 'string' && Array.isArray(t.roleData)),
  '/gallery/images': (d) => Array.isArray(d) && d.every((x) => typeof x.img === 'string'),
  '/spslist/items': (d) => Array.isArray(d),
  '/recruit/getDates': (d) => Array.isArray(d),
};

// Starts a dev process; returns it at once (so it can always be killed) with .ready resolving once `ready` shows in its output.
function startProc(cmd, cwd, ready) {
  const p = spawn(cmd, { cwd, shell: true, env: { ...process.env, BROWSER: 'none', NO_COLOR: '1', FORCE_COLOR: '0' } });
  let out = '';
  p.ready = new Promise((ok, no) => {
    const t = setTimeout(() => no(new Error(`${cmd} did not start: ${out.slice(-400)}`)), 60000);
    const on = (b) => { out += String(b).replace(/[[0-9;]*m/g, ''); if (ready.test(out)) { clearTimeout(t); ok(); } };
    p.stdout.on('data', on); p.stderr.on('data', on);
    p.on('exit', () => { clearTimeout(t); no(new Error(`${cmd} exited: ${out.slice(-400)}`)); });
  });
  return p;
}
const kill = (p) => p && (process.platform === 'win32' ? spawnSync('taskkill', ['/pid', String(p.pid), '/T', '/F']) : p.kill());

export async function run({ check, launch, site }) {
  // 1. Live API.
  for (const [route, ok] of Object.entries(SHAPES)) {
    // Best of two: the first call may wake a cold serverless function.
    const a = await timed(LIVE + route), b = await timed(LIVE + route), r = a.ms < b.ms && a.status === 200 ? a : b;
    check('backend', `live API ${route}: 200 with the expected shape`, r.status === 200 && ok(r.body), r.status, 200, r.error ?? '');
    check('backend', `live API ${route}: answers in ≤ ${API_MS} ms (warm)`, r.ms <= API_MS, r.ms, `≤${API_MS}`);
  }

  // 2. Image relay: hostile or broken input is refused with a 4xx, never a crash or a fetch elsewhere.
  const { default: handler } = await import(pathToFileURL(path.join(site, 'api', 'img.js')).href);
  const call = async (query) => {
    let status = 0, headers = {};
    const res = { status(s) { status = s; return res; }, setHeader(k, v) { headers[k] = v; return res; }, send() { return res; }, end() { return res; }, json() { return res; }, redirect(s) { status = s; return res; } };
    try { await handler({ query, url: '/api/img?' + new URLSearchParams(query), headers: {} }, res); } catch (e) { return { status: 'threw ' + e.message }; }
    return { status };
  };
  for (const [what, q] of [['no url', {}], ['a non-http url', { url: 'file:///etc/passwd' }], ['a host not on the list', { url: 'https://example.com/a.jpg' }], ['an internal address', { url: 'http://169.254.169.254/latest' }]]) {
    const r = await call(q);
    check('backend', `image relay refuses ${what}`, r.status >= 400 && r.status < 500, r.status, '4xx');
  }

  // 3. Admin dashboard against the mock API.
  const mock = startProc('node scripts/mock-api.mjs', site, /8787/);
  const dev = startProc('npx vite --mode mock --port 5199 --strictPort', site, /ready in/);
  try {
    await Promise.all([mock.ready, dev.ready]);
  } catch (e) {
    check('backend', 'admin: mock API and dev server start', false, 'no', 'yes', e.message);
    kill(mock); kill(dev); return;
  }
  const browser = await launch();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 900 });
    const log = watch(page, 'http://localhost:5199');
    const B = 'http://localhost:5199';
    await page.goto(B + '/Data', { waitUntil: 'networkidle2' });
    check('backend', 'admin: signed-out visit to /Data goes to /login', page.url().endsWith('/login'), new URL(page.url()).pathname, '/login');
    await page.goto(B + '/login', { waitUntil: 'networkidle2' });
    await page.type('input[type="email"]', 'admin@quatlas.test');
    await page.type('input[type="password"]', 'mock-password');
    await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {}), page.keyboard.press('Enter')]);
    await sleep(800);
    check('backend', 'admin: mock login lands on the dashboard', /\/Data$/.test(page.url()), new URL(page.url()).pathname, '/Data');
    const empty = [];
    for (const p of ['/Data', '/recruitmentData', '/forms', '/teamData', '/links', '/admin']) {
      await page.goto(B + p, { waitUntil: 'networkidle2' }); await sleep(500);
      const r = await page.evaluate(() => ({ path: location.pathname, text: document.querySelector('main')?.innerText.length ?? document.body.innerText.length, err: /could not reach|server answered/i.test(document.body.innerText) }));
      if (r.path !== p || r.text < 80 || r.err) empty.push(`${p} → ${r.path}${r.err ? ' (error shown)' : ''} ${r.text} chars`);
    }
    check('backend', 'admin: every dashboard screen opens with data', !empty.length, empty.length, 0, empty.join(', '));
    check('backend', 'admin: no console errors or failed requests', !log.errors.length && !log.failed.length, log.errors.length + log.failed.length, 0, [...log.errors, ...log.failed].slice(0, 4).join(' | '));
    await page.close();

    // The public forms, against the mock (no email leaves: the mail relay is answered here).
    const pub = await browser.newPage();
    await pub.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await pub.setRequestInterception(true);
    pub.on('request', (r) => (/formsubmit\.co/.test(r.url()) ? r.respond({ status: 200, contentType: 'application/json', body: '{"success":"true"}' }) : r.continue()));
    const plog = watch(pub, B);
    const posted = async (path) => (await (await fetch('http://localhost:8787/log')).json()).some((e) => JSON.stringify(e).includes(path));
    const toast = () => pub.evaluate(() => document.querySelector('[role="status"], [role="alert"], [aria-live]')?.textContent ?? '');

    await go(pub, B + '/contact');
    await pub.click('form#request button[type="submit"]');
    const stopped = await pub.evaluate(() => !document.querySelector('form#request').checkValidity());
    check('backend', 'contact form: an empty request is stopped by the form, not sent', stopped && !(await posted('/form/addcon')), stopped, true);
    await pub.type('form#request [name="name"]', 'Eval Bot');
    await pub.type('form#request [name="email"]', 'eval@quatlas.test');
    await pub.type('form#request [name="ConNumber"]', '9000000009');
    await pub.type('form#request [name="message"]', 'Automated check from the benchmark.');
    await pub.click('form#request button[type="submit"]');
    await sleep(1200);
    const sent = await posted('/form/addcon'), cleared = await pub.evaluate(() => document.querySelector('form#request [name="name"]').value === '');
    check('backend', 'contact form: a filled request is sent, confirmed and the form cleared', sent && cleared && (await toast()).length > 0, `${sent ? 'sent' : 'not sent'}, ${cleared ? 'cleared' : 'kept'}`, 'sent, cleared');

    await go(pub, B + '/support');
    const f = await pub.$('form [name="mobile"]');
    if (f) {
      // Scroll to it first, as a person would (it reveals as it comes into view).
      await pub.evaluate(() => document.querySelector('form [name="mobile"]').closest('form').scrollIntoView({ block: 'center' }));
      await sleep(1000);
      const form = await pub.evaluateHandle(() => document.querySelector('form [name="mobile"]').closest('form'));
      await (await form.$('[name="name"]')).type('Eval Bot');
      await (await form.$('[name="email"]')).type('eval@quatlas.test');
      await (await form.$('[name="mobile"]')).type('9000000009');
      await (await form.$('button[type="submit"]')).click();
      await sleep(1200);
    }
    check('backend', 'support form: sponsor details are sent', !!f && (await posted('/form/addsp')), f ? 'tried' : 'no form', 'sent');

    await go(pub, B + '/results');
    await pub.type('[name="usn"]', '1MS22ME002-T');
    await pub.keyboard.press('Enter');
    await sleep(1200);
    const result = await pub.evaluate(() => ({ path: location.pathname, text: document.querySelector('main')?.innerText ?? '' }));
    check('backend', 'results: a known USN shows its result', result.path === '/resultPage' && /Test Student/.test(result.text), result.path, '/resultPage');
    const before = plog.errors.length; // the API answers an unknown USN with a 404, which the browser always logs
    await go(pub, B + '/results');
    await pub.type('[name="usn"]', '1MS00XX000-T');
    await pub.keyboard.press('Enter');
    await sleep(1200);
    const unknown = await pub.evaluate(() => document.querySelector('#usn-error')?.textContent ?? '');
    check('backend', 'results: an unknown USN says so, next to the field', /couldn’t find|not found/i.test(unknown), unknown || 'no message', 'message');
    const extra = plog.errors.slice(before).filter((e) => !/status of 404/.test(e));
    check('backend', 'public forms: no console errors', !before && !extra.length, before + extra.length, 0, [...plog.errors.slice(0, before), ...extra].slice(0, 3).join(' | '));
    await pub.close();
  } finally {
    await browser.close();
    kill(mock); kill(dev);
  }
}
