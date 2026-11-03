// Writes dist/<route>/index.html with real markup for every public page.
// dist/app.html stays an empty shell: the SPA fallback for admin and unknown routes.
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const ROUTES = ['/', '/about', '/achievements', '/sponsors', '/crowdfunding', '/contact', '/alumini', '/gallery', '/recruitment', '/privacy', '/terms', '/results', '/login'];

const template = await readFile('dist/index.html', 'utf8');
const { render } = await import(pathToFileURL(path.resolve('dist-ssr/entry-server.js')).href);

await writeFile('dist/app.html', template);
for (const route of ROUTES) {
  const html = template.replace('<div id="root"><!--app-html--></div>', `<div id="root" data-route="${route}">${await render(route)}</div>`);
  const file = path.join('dist', route, 'index.html');
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, html);
}
await rm('dist-ssr', { recursive: true, force: true });
console.log(`prerendered ${ROUTES.length} routes`);
