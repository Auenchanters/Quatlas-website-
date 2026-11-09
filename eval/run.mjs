// The Quatlas benchmark. Builds the site (unless --no-build), serves dist/ like Vercel, runs every suite,
// writes eval/reports/<time>.json and latest.md, and exits 1 unless every gate in benchmark.mjs passes.
//   node eval/run.mjs                      everything
//   node eval/run.mjs --only pages,games   some suites
//   node eval/run.mjs --no-build           reuse dist/
import { execSync } from 'node:child_process';
import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { start } from './serve.mjs';
import { SUITES, CHROME, PORT } from './benchmark.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.resolve(HERE, '..');
const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : Object.keys(SUITES);

const results = [];
const check = (suite, name, pass, value, target, detail = '') => {
  results.push({ suite, name, pass: !!pass, value, target, detail: String(detail).slice(0, 600) });
  if (!pass) console.log(`  FAIL [${suite}] ${name}: ${value} (want ${target}) ${detail ? '— ' + String(detail).slice(0, 200) : ''}`);
};

const t0 = Date.now();
if (!args.includes('--no-build') && only.some((s) => SUITES[s].needsBuild)) {
  console.log('building…');
  let log;
  try { log = execSync('npm run build 2>&1', { cwd: SITE, encoding: 'utf8', maxBuffer: 64e6 }); } catch (e) { console.log(e.stdout?.slice(-3000)); console.log('BUILD FAILED'); process.exit(2); }
  await writeFile(path.join(HERE, 'reports', 'build.log'), log).catch(() => {});
  const warnings = log.split('\n').filter((l) => /warn|\(!\)|error/i.test(l) && !/deprecated/i.test(l));
  check('static', 'build: no warnings or errors', warnings.length === 0, warnings.length, 0, warnings.join(' | '));
}
await mkdir(path.join(HERE, 'reports'), { recursive: true });

const server = await start(PORT);
const base = `http://localhost:${PORT}`;
const launch = (extra = {}) => puppeteer.launch({
  executablePath: CHROME, headless: true, protocolTimeout: 240000,
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-unsafe-swiftshader', '--no-first-run', '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required', ...(extra.args ?? [])],
  ...extra,
});

try {
  for (const name of only) {
    const s = SUITES[name];
    console.log(`\n▶ ${name}`);
    const t = Date.now();
    try {
      const mod = await import(`./suites/${s.file ?? name}.mjs`);
      await mod.run({ check, base, launch, site: SITE, here: HERE, args });
    } catch (e) {
      check(name, 'suite ran to completion', false, 'crashed', 'ran', e.stack);
    }
    console.log(`  ${((Date.now() - t) / 1000).toFixed(0)} s`);
  }
} finally {
  server.close();
}

// Scores: each suite is the share of its checks that pass; the benchmark is met only at 100 everywhere.
const suites = [...new Set(results.map((r) => r.suite))];
const score = Object.fromEntries(suites.map((s) => { const r = results.filter((x) => x.suite === s); return [s, Math.round((100 * r.filter((x) => x.pass).length) / r.length)]; }));
const failed = results.filter((r) => !r.pass);
const ready = failed.length === 0;
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
await writeFile(path.join(HERE, 'reports', `${stamp}.json`), JSON.stringify({ stamp, ready, score, results }, null, 1));
const md = [
  `# Benchmark ${ready ? 'MET' : 'NOT MET'} — ${new Date().toLocaleString('en-IN')}`,
  `${results.length} checks, ${failed.length} failing, ${((Date.now() - t0) / 60000).toFixed(1)} min`, '',
  '| Suite | Score |', '|---|---|', ...suites.map((s) => `| ${s} | ${score[s]} |`), '',
  failed.length ? '## Failing' : '', ...failed.map((r) => `- **[${r.suite}] ${r.name}**: ${r.value} (want ${r.target}) ${r.detail}`),
].join('\n');
await writeFile(path.join(HERE, 'reports', 'latest.md'), md);
// One line per run, so the loop's progress can be read back: time, suites run, checks, failing, per-suite score.
await appendFile(path.join(HERE, 'reports', 'history.csv'), `${new Date().toISOString()},${only.join('+')},${results.length},${failed.length},${suites.map((s) => `${s}=${score[s]}`).join(' ')}\n`);
console.log('\n' + md);
process.exit(ready ? 0 : 1);
