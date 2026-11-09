// Lighthouse on every public route: mobile (slow 4G, 4× CPU) and desktop. A page that misses the
// performance bar or a Web Vitals budget is re-run twice and judged on the medians (the score's, and each
// metric's), so one noisy run can't fail (or pass) it.
import lighthouse from 'lighthouse';
import desktop from 'lighthouse/core/config/desktop-config.js';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { ROUTES, LIGHTHOUSE } from '../benchmark.mjs';
import { META } from '../../src/content/meta.js';

const CATS = ['performance', 'accessibility', 'best-practices', 'seo'];
const quick = process.argv.includes('--quick');
// --routes /,/about: only those (while working on them); the benchmark itself always runs every route.
const only = process.argv.includes('--routes') ? process.argv[process.argv.indexOf('--routes') + 1].split(',') : null;

async function audit(browser, url, config) {
  const page = await browser.newPage();
  try {
    const r = await lighthouse(url, { output: 'json', logLevel: 'error', onlyCategories: CATS, disableStorageReset: false }, config, page);
    return r.lhr;
  } finally { await page.close().catch(() => {}); }
}

const median = (runs) => runs.sort((a, b) => a.categories.performance.score - b.categories.performance.score)[Math.floor(runs.length / 2)];

export async function run({ check, base, launch, here }) {
  const out = path.join(here, 'reports', 'lighthouse');
  await mkdir(out, { recursive: true });
  const browser = await launch();
  const rows = [];
  try {
    for (const [form, config] of [['mobile', undefined], ['desktop', desktop]]) {
      const bar = LIGHTHOUSE[form];
      for (const route of only ?? (quick && form === 'desktop' ? ['/'] : ROUTES)) {
        let runs = [await audit(browser, base + route, config)];
        const over = (r) => form === 'mobile' && Object.entries(LIGHTHOUSE.metrics).some(([id, max]) => r.audits[id].numericValue > max);
        if (runs[0].categories.performance.score * 100 < bar.performance || over(runs[0])) runs.push(await audit(browser, base + route, config), await audit(browser, base + route, config));
        const metric = (id) => runs.map((r) => r.audits[id].numericValue).sort((a, b) => a - b)[Math.floor(runs.length / 2)];
        const lhr = median(runs);
        const s = Object.fromEntries(CATS.map((c) => [c, Math.round((lhr.categories[c]?.score ?? 0) * 100)]));
        rows.push({ form, route, ...s });
        for (const c of CATS) {
          // Name the audits that cost points, so the fix is obvious from the report.
          const lost = lhr.categories[c].auditRefs.filter((a) => a.weight > 0 || c !== 'performance').map((a) => lhr.audits[a.id]).filter((a) => a.score !== null && a.score < 1 && a.scoreDisplayMode !== 'informative' && a.scoreDisplayMode !== 'notApplicable' && a.scoreDisplayMode !== 'manual');
          // A page kept out of search on purpose (noindex: sign-in, the secret hangar) must fail "is crawlable"
          // and nothing else: that one audit is the intent, every other SEO audit still has to pass.
          if (c === 'seo' && META[route]?.noindex) {
            const other = lost.filter((a) => a.id !== 'is-crawlable');
            check('lighthouse', `${form} ${route}: seo (noindex on purpose) all else passes`, !other.length && lost.some((a) => a.id === 'is-crawlable'), other.map((a) => a.id).join(', ') || 'ok', 'only is-crawlable');
            continue;
          }
          check('lighthouse', `${form} ${route}: ${c} ≥ ${bar[c]}`, s[c] >= bar[c], s[c], bar[c], lost.map((a) => `${a.id}${a.displayValue ? ' (' + a.displayValue + ')' : ''}`).join(', '));
        }
        if (form === 'mobile') {
          const miss = Object.entries(LIGHTHOUSE.metrics).filter(([id, max]) => metric(id) > max).map(([id, max]) => `${id} ${Math.round(metric(id) * (id.includes('shift') ? 1000 : 1)) / (id.includes('shift') ? 1000 : 1)} > ${max}`);
          check('lighthouse', `mobile ${route}: Web Vitals within budget`, !miss.length, miss.length, 0, miss.join(', '));
        }
        await writeFile(path.join(out, `${form}${route.replace(/\//g, '_') || '_home'}.json`), JSON.stringify(lhr));
        console.log(`  ${form.padEnd(7)} ${route.padEnd(24)} ${CATS.map((c) => s[c]).join(' / ')}`);
      }
    }
  } finally {
    await browser.close();
  }
}
