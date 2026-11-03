import { prerenderToNodeStream } from 'react-dom/static';
import { StaticRouter } from 'react-router';
import App from './App';

// prerender (unlike renderToString) waits for lazy routes, so each page's HTML is complete.
export async function render(url) {
  const { prelude } = await prerenderToNodeStream(<StaticRouter location={url}><App /></StaticRouter>);
  let html = '';
  for await (const chunk of prelude) html += chunk;
  return html;
}
