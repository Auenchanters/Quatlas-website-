// Writes dist/<route>/index.html with real markup for every public page.
// dist/app.html stays an empty shell: the SPA fallback for admin and unknown routes.
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

// Fonts are not preloaded: measured, preloading them delayed the largest paint (they compete with the page's
// own image and text for a slow connection), and the fallback faces in styles.css make their late swap harmless.
const template = await readFile('dist/index.html', 'utf8');
const { render, SUBTEAMS } = await import(pathToFileURL(path.resolve('dist-ssr/entry-server.js')).href);

const { META, SITE } = await import(pathToFileURL(path.resolve('src/content/meta.js')).href);const ROUTES = ['/', '/about', '/team', ...SUBTEAMS.map((s) => `/team/${s.slug}`), '/achievements', '/events', '/gallery', '/support', '/contact', '/alumini', '/recruitment', '/terms', '/results', '/login', '/hangar'];
// Each page's own code (its lazy route chunk and what that imports), preloaded with the entry: without this it is
// only asked for once the entry has downloaded and run, a second round trip before the page can hydrate.
const manifest = JSON.parse(await readFile('dist/.vite/manifest.json', 'utf8'));
const PAGE = { '/about': 'About', '/team': 'Team', '/achievements': 'Achievements', '/events': 'Events', '/gallery': 'Gallery', '/support': 'Support',
  '/contact': 'Contact', '/alumini': 'Alumni', '/recruitment': 'Recruitment', '/terms': 'Legal', '/results': 'Results', '/login': 'Auth', '/hangar': 'Hangar' };
const chunksOf = (key, seen = new Set()) => {
  const e = manifest[key];
  if (!e || e.isEntry || seen.has(key)) return seen;
  seen.add(key);
  for (const k of e.imports ?? []) chunksOf(k, seen);
  return seen;
};
const pageChunks = (route) => {
  const page = route.startsWith('/team/') ? 'Subteam' : PAGE[route];
  return page ? [...chunksOf(`src/pages/${page}.jsx`)].map((k) => `/${manifest[k].file}`) : [];
};
// A prerendered page paints from its HTML and stylesheet alone, so its code (the entry, the shell's modulepreloads,
// the page's chunks) and the web fonts are asked for after that first paint. Measured on a throttled phone: requested
// up front they shared the slow connection with the stylesheet and pushed first paint from ~1.0 s to ~2.4 s.
// The page hydrates a moment later; links work before that, and a hidden tab loads at once.
const ENTRY = /\s*<script type="module" crossorigin src="([^"]+)"><\/script>/;
const SHELL_PRELOADS = /\s*<link rel="modulepreload" crossorigin href="([^"]+)">/g;
const entry = template.match(ENTRY)[1];
const shellPreloads = [...template.matchAll(SHELL_PRELOADS)].map((m) => m[1]);
const fontsCss = manifest['src/fonts.css'] ? [`/${manifest['src/fonts.css'].file}`] : [];
if (!fontsCss.length) throw new Error('fonts.css missing from the manifest');
const loader = (route) => {
  const js = [...new Set([...shellPreloads, ...pageChunks(route)])];
  return `<script>(function(e,j,c){var d;function go(){if(d)return;d=1;function add(t,a){var n=document.createElement(t);for(var k in a)n[k]=a[k];document.head.appendChild(n)}`
    + `c.forEach(function(h){add("link",{rel:"stylesheet",href:h})});j.forEach(function(h){add("link",{rel:"modulepreload",href:h,crossOrigin:""})});add("script",{type:"module",src:e,crossOrigin:""})}`
    // No paint timing (an older Safari): two frames in, the first has been drawn. The 3 s timer is the backstop.
    + `var P=window.PerformanceObserver;if(document.visibilityState=="hidden")go();else if(P&&(P.supportedEntryTypes||[]).indexOf("paint")>=0)new P(go).observe({type:"paint",buffered:true});`
    + `else requestAnimationFrame(function(){requestAnimationFrame(go)});setTimeout(go,3000)})`
    + `(${JSON.stringify(entry)},${JSON.stringify(js)},${JSON.stringify(fontsCss)})</script>`;
};
const prerenderShell = template.replace(ENTRY, '').replace(SHELL_PRELOADS, '');
// React puts a page's <title>, <meta> and <link> first in its output; they belong in <head>, in place of the shell's defaults.
const HOISTED = /^(?:<title>[^<]*<\/title>|<meta [^>]*\/>|<link [^>]*\/>)+/;

// The stylesheet stays a separate file: inlining it was measured slower (the page outgrows the first
// round trips on a slow connection, while the cached stylesheet downloads alongside it).
await writeFile('dist/app.html', template);
for (const route of ROUTES) {
  const body = await render(route);
  const head = body.match(HOISTED)?.[0] ?? '';
  const shell = head ? prerenderShell.replace(/\s*<title>[^<]*<\/title>/, '').replace(/\s*<meta name="description"[^>]*>/, '') : prerenderShell;
  const html = shell.replace('</head>', `${head}</head>`)
    .replace('<div id="root"><!--app-html--></div>', `<div id="root" data-route="${route}">${body.slice(head.length)}</div>${loader(route)}`);
  const file = path.join('dist', route, 'index.html');
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, html);
}
// Search engines: every indexable page in the sitemap.
const listed = ROUTES.filter((r) => !META[r]?.noindex);
await writeFile('dist/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${listed.map((r) => `  <url><loc>${SITE}${r === '/' ? '' : r}</loc></url>`).join('\n')}
</urlset>
`);
await rm('dist-ssr', { recursive: true, force: true });
await rm('dist/.vite', { recursive: true, force: true }); // the manifest was only for this script
console.log(`prerendered ${ROUTES.length} routes`);
