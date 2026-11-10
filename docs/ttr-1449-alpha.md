# TTR-1449: Alpha Hardscapes speed findings (10 Nov 2026)

## Is the live site WordPress or this repo?

The live domain already runs **this repo** (Next.js on Vercel, content from Sanity). The pages only
look like WordPress: the repo prints the same Astra + Elementor HTML, CSS and scripts (README).

Evidence from `https://alphahardscapes.com/` on 10 Nov 2026:

- Response headers: `server: Vercel`, `x-vercel-id: iad1::...`, `x-vercel-cache`, `x-matched-path: /masonry`, `x-content-source: cms` (this app sets the last one only when Sanity was read).
- The domain resolves to a Vercel address (216.150.1.1); `www` answers 308 to the apex from Vercel.
- `/wp-json/` and `/wp-login.php` answer 404: there is no WordPress behind it.
- The live HTML of `/masonry/` holds `<style id="hero-phone">` (added by `lib/site/tune.ts`) and `/assets/css/b-f067a8129797.css`, the same bundle name my local production build of this repo made for that page.
- TTR OS probably lists Alpha as WordPress because of the Elementor markup.

## What the repo holds

- 109 documents in `content/seed.json` (built-in copy): 60 pages, 18 posts, 8 archive pages, 14 Elementor templates, 5 authors, 2 categories, site settings, 404 page. Sanity holds the same 109 (README audit, 8 Nov 2026).
- `npm run verify` re-rendered all 90 crawled URLs and compared them with the WordPress HTML tag by tag: identical (README).
- Design is the same by construction. Redirects (711 from WordPress days), sitemaps, forms (`/wp-admin/admin-ajax.php`), tracker and draft preview are built.
- A second deploy path exists, `.github/workflows/deploy-siteground.yml` (static export over FTPS). Live responses show Vercel is the one serving; confirm its `SG_FTP_*` secrets are unset.

So there is no cutover to do. The repo is the new site and it is live.

## Scores (Lighthouse, performance, simulated throttling)

Live site, mobile / desktop: `/` 87/97, `/landscaping/` 83/90, `/masonry/` 87/88, `/walkway-patio-connecticut/` 76/91, `/retaining-walls-connecticut/` 76/93, `/outdoor-kitchens-connecticut/` 89/99, `/fire-features-connecticut/` 96/99, `/service-areas/` 97/99, `/about-us/` 80/90, `/reviews/` 91/96, `/contact/` 93/97.

A local production build of this repo scores the same or lower on mobile (65, 71, 61, 70, 62, 81, 81, 84, 60, 77, 81 in the order above), as expected: the local server has no Brotli or HTTP/2. It is the same code, so "measure the new build" gives the same answer as the live site.

## What holds mobile under 90

Mobile LCP is the first section's background photo (64 to 197 KB on phones; each 10 KB is about 0.1 s of simulated LCP) plus Elementor script time (TBT 350 to 380 ms on three pages) and about 79% unused global CSS.

Nothing look-neutral moved the score: hero as an `<img>`, delayed below-fold images, no font preloads, AVIF at matched quality (0 to 20% smaller). Not done, need Kia: a lighter phone hero, delaying Elementor until first interaction. Not done, needs screenshot diffs: trimming unused CSS.
