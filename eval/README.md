# Quatlas benchmark

The site is ready when `npm run eval` exits 0: every check passes, in one run, against a fresh production build.
The bar lives in [`benchmark.mjs`](benchmark.mjs); every number there is a hard gate.

```bash
cd eval && npm install        # once: puppeteer-core, lighthouse, axe-core (kept out of the site's own dependencies)
cd .. && npm run eval         # build, then every suite (~35 min)
npm run eval -- --only pages,games --no-build   # some suites, reuse dist/
npm run eval -- --quick       # fewer viewports/themes, mobile-only Lighthouse except home (~12 min)
```

Uses the installed Chrome (`CHROME=` to point elsewhere). Results: `eval/reports/latest.md` (failures with
the reason), `eval/reports/<time>.json` (every check), `eval/reports/shots/` (screenshots of every page and
of the 3D plane at every size), `eval/reports/lighthouse/` (full Lighthouse reports).

## What is checked

| Suite | Checks |
|---|---|
| **static** | build has no warnings · unit tests pass · every public page prerendered with real content, its own `<title>`, description, one `h1`, canonical link and share card · no chunk over 160 kB brotli · robots.txt hides no public page · sitemap lists every indexable page |
| **model** | the Quatlas 012 and the Dogfight jet, as geometry: every mesh touches the rest of the model (no floating pieces), no empty/NaN geometry, every part labelled, prop clear of the nose |
| **pages** | every route × 5 viewports (360 → 1920) × both themes in real Chrome: no console errors, page errors or failed requests · no sideways scroll · no broken, oversized (>2.2× displayed) or heavy images · nothing left invisible after the scroll reveals · no text cut off · touch targets ≥ 24 px · layout shift ≤ 0.02 · axe-core WCAG 2.2 AA + best practice with zero violations · every internal link and `#anchor` resolves · menu navigation < 400 ms and back at the top · focus ring on every Tab stop · theme cord works · phone menu opens, navigates, closes on Esc · reduced motion shows everything |
| **visual** | the home page's 3D plane, read back from the WebGL canvas at 5 sizes: wholly inside its panel through the fly-in and turn, spans ≥ 60% of the limiting dimension, centred, clear of the panel's buttons · pulled apart: all 6 labels in view, none on another · ≥ 55 fps median, ≥ 40 at p5 · home first-visit bytes: render-blocking JS, all JS, idle prefetch, CSS, fonts, total |
| **games** | Payload Run and Dogfight played by script: they draw, start (key, click, tap), pause on Esc, resume, end with a score card, start again, leave, hold 55 fps, survive ten visits in a row without exhausting WebGL, and log no errors |
| **backend** | live API (read-only GETs): 200, expected shape, ≤ 1.5 s warm · image relay refuses bad/hostile URLs with 4xx · admin dashboard against the mock API: signed-out redirect, login, every screen opens with data, no errors |
| **lighthouse** | every route, mobile (slow 4G, 4× CPU): performance ≥ 95, accessibility/best practices/SEO = 100, LCP ≤ 2.0 s, FCP ≤ 1.5 s, TBT ≤ 100 ms, CLS ≤ 0.02, Speed Index ≤ 2.5 s · desktop: performance ≥ 99, the rest 100. A page under the performance bar or over a Web Vitals budget is re-run twice and judged on the medians. |

## Finding the cause of a slow page

```bash
MSYS_NO_PATHCONV=1 node eval/profile.mjs /team 8        # every main-thread task over 50 ms (4× CPU), with what ran inside it
MSYS_NO_PATHCONV=1 node eval/cpu.mjs /team              # CPU profile by function (unminified build: names)
MSYS_NO_PATHCONV=1 node eval/cls.mjs /gallery           # every layout shift on a throttled phone, and what moved
MSYS_NO_PATHCONV=1 node eval/ab.mjs /about '{"base":"","x":"p{text-wrap:wrap!important}"}'   # layout cost of CSS variants
npm run eval -- --only lighthouse --no-build --routes /,/team   # Lighthouse on a few pages while working on them
```

`MSYS_NO_PATHCONV=1` stops Git Bash on Windows turning `/team` into a file path. For function names in a
profile, build unminified first (`npx vite build --minify false`, then the SSR build and `node scripts/prerender.mjs`)
and run `npm run build` again afterwards.

## The improvement loop

1. `npm run eval` (or `--only <suite>` while working on one area).
2. Read `reports/latest.md`. Fix the root cause of the most severe failure in the site, not in the check.
3. Re-run that suite; when it is clean, re-run everything (a fix in one place can break another).
4. Repeat until a full run exits 0. Then run it once more: the bar is met only when two full runs in a row pass.

Changing a gate: raising one is always fine. Lowering one needs a reason written next to it in `benchmark.mjs`.
A check that is wrong (flags something that is fine) is fixed in the check, with a comment saying why.
