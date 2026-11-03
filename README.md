# Quatlas site

Rebuild of quatlas.web.app. Same routes, same API (`quatlasserver.vercel.app`), new front end.

```bash
npm install
npm run dev          # http://localhost:5173, against the live API
npm run build        # dist/: static files, public pages prerendered
npm run preview      # serve dist/ at http://localhost:4173
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
| `src/content/` | page copy and the achievements record (edit text here) |
| `src/lib/api.js` | every API call goes through `api()`; `VITE_API` overrides the base URL |
| `assets-src/` → `npm run images` | source photos → `public/img/*.webp` at 480/960/1600 px |
| `firebase.json` | Firebase Hosting config for `dist/` |

## Images added from the dashboard

`npm run build` first runs `npm run photos`, which copies every gallery, sponsor and team photo the API links to into `public/img/r/` (WebP at 400/800/1600 px), so they load from this site instead of OneDrive (3–5 s each). Already-copied photos are skipped; dead links are listed in `src/content/remote-images.json` and show as initials. A photo added after the last build still appears, loaded from its original link, until the next build copies it.
