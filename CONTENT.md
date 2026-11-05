# Where the site's content lives

Pages only lay content out. To update the site, edit these files. You don't need to touch any layout code.

## Text and numbers: `src/content/`

| File | Feeds | Notes |
|---|---|---|
| `home.js` | Home hero, rotating quotes, the three "paths" links | `HERO.label`, `HERO.title` (lines), `HERO.place` |
| `stats.js` | Home stats strip | Works these out itself from `achievements.js` and the member count. Don't type numbers here. |
| `achievements.js` | Achievements timeline, Home "record" table | Per year: `year`, `summary` and `points` are required. `title`, `caption`, `photos` and `payloadKg` are optional, and anything left out is hidden. The largest `payloadKg` is shown on Home. |
| `aircraft.js` | Aircraft drawing / 3D model legend, Design blueprint | `SPECS` in mm. `null` hides that dimension. |
| `support.js` | Support intro, crowdfunding text, UPI payee | `UPI.pa` = UPI ID, `UPI.pn` = name |
| `sponsors.json` | "Three ways to sponsor" | |
| `teams.js` | Team intro, subteam names/descriptions, which dashboard team names map to which subteam | Members themselves come from the dashboard. |
| `events.js` | Events page, Home "Upcoming" | |
| `contact.jsx` | Contact people, form request types, FAQ | FAQ answers may contain links (JSX). |
| `recruitment.js` | Recruitment roles and selection process | Dates come from the dashboard. |
| `overview.js`, `about.json`, `terms.json` | About, Home overview, Terms | |
| `gallery-tags.js` | Which gallery photos show under **Aircraft** | Every photo not listed shows under **People**. |
| `snapshot.json` | Build-time copy of dashboard data (members, gallery, sponsor logos) | Refreshed from the API. Don't hand-edit. |

Short one-line intros under page titles still live in the page files in `src/pages/`.

## Images: `assets-src/`

1. Drop the file into `assets-src/` (any of jpg/png/webp). The file name without its extension becomes the image's name.
2. Run `npm run images`. It writes the resized copies to `public/img/` and updates `src/content/images.json`.
3. Refer to the image by that name in a content file. To replace an image, keep the same name.

`gpay_qr_code` is encoded losslessly so it stays scannable.

## Applying the verified content document

Go through the table above file by file. Then run `npm test` and `npm run build`, and check each page.
