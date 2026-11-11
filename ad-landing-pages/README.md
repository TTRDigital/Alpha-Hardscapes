# Alpha Hardscapes ad pages (own Vercel project)

One Vercel project per ad account, apart from the SEO site. Project `alpha-ad-pages`, Root Directory `ad-landing-pages`, Framework Other.

- `content/*.json` = page content (outdoor, go). Same shape as the Sanity `landingPage` document (project 7ysj6im9). `npm run build` reads Sanity first (read only, public dataset) and falls back to these files, then writes `dist/<slug>/index.html`.
- `templates/` shared CSS, icons and page script. `scripts/render.mjs` turns content into HTML.
- Hosts (vercel.json): `outdoor.` and `paver.` serve `/outdoor`, `go.` serves `/go`; any other host (previews) serves outdoor. `/go` and `/outdoor` also work on previews.
- Form: `api/season-lead.ts` sends each lead to TTR OS (`/api/site/form`) and the GHL webhook (`GHL_SEASON_WEBHOOK_URL`, set in Vercel by a person).
- Calls: `number.js` is Pro Wildlife's dynamic number script with Alpha's site key. Inert (default (472) 203-3284) until the number pool exists in TTR OS.
- Sanity: `sanity/landingPage.ts` is the schema (register in the Studio). `node scripts/seed-sanity.mjs` is a dry run; `--write` with `SANITY_WRITE_TOKEN` creates missing documents only, never overwrites.
- `held-claims.json`: claims taken off the outdoor page until Kia approves each one.
- noindex on every response and in the pages.
