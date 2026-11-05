# Quatlas site

Rebuild of quatlas.web.app. Same routes, same API (`quatlasserver.vercel.app`), new front end.

```bash
npm install
npm run dev          # http://localhost:5173, against the live API
npm run build        # dist/: static files, public pages prerendered
npm run preview      # serve dist/ at http://localhost:4173
npm test             # unit tests (node --test): stats, gallery split, motion gate, games, image relay
```

## Testing the dashboard without touching real data

```bash
npm run mock         # fake API on :8787 (public lists copied from the live API at start-up)
npm run dev:mock     # the site pointed at it (.env.mock)
```

Mock login and OTP are in `scripts/mock-api.mjs`. No email is sent; `http://localhost:8787/log` lists every request the site made.

## Where things are

| | |
|---|---|
| `src/pages/` | public pages and the auth flows |
| `src/admin/` | dashboard; `AdminLayout` redirects to `/login` without a token |
| `src/components/Aircraft.jsx` | the isometric figure on the home page |
| `CONTENT.md` | where every piece of copy, every number and every image lives |
| `src/content/` | page copy and the achievements record (edit text here) |
| `src/content/events.js` | upcoming events: add a line, set `date: 'YYYY-MM-DD'` once announced |
| `src/content/teams.js` | the five subteams, their copy, and which dashboard team names map to each |
| `src/pages/Hangar.jsx`, `src/games/` | the hidden hangar behind the footer's “secret” link (`/hangar`): Payload Run (2D canvas) and Dogfight (3D, three.js); game rules are in `sim.js` / `logic.js` with tests |
| `api/img.js` | Vercel function: serves dashboard photo links as WebP so new photos show before the next build |
| `src/lib/api.js` | every API call goes through `api()`; `VITE_API` overrides the base URL |
| `assets-src/` → `npm run images` | source photos → `public/img/*.webp` at 480/960/1600 px |

## Images added from the dashboard

`npm run build` first runs `npm run photos`, which copies every gallery, sponsor and team photo the API links to into `public/img/r/` (WebP at 400/800/1600 px), so they load from this site instead of OneDrive (3–5 s each). Already-copied photos are skipped; dead links are listed in `src/content/remote-images.json` and show as initials. A photo added after the last build still appears through `/api/img` (which can also open OneDrive share links) until the next build copies it. The same build writes `src/content/snapshot.json`, the team, sponsor and gallery lists the pages prerender before refreshing from the API.

A member appears on a subteam page when their dashboard **Team name** matches that subteam (see `teams.js`; `CAED` counts as Design and `Conceptual` as Aerodynamics). The dashboard previews every photo link and says why one would show blank.

## Contact requests

The contact form saves to the dashboard (Forms) and also emails `aeromodellingquatlas@gmail.com` through FormSubmit. FormSubmit's first email to that inbox is an activation link; someone must click it once. `VITE_INBOX=''` turns the email off.
