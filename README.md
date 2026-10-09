# Alpha Hardscapes website

An exact copy of the WordPress site alphahardscapes.com (Astra + Elementor), rebuilt on Next.js 16 with all content in Sanity (embedded Studio at `/cms`). Built by TTR Digital Marketing.

- **Identical output:** every page prints the same HTML, CSS and scripts as the WordPress site, so it looks and behaves the same (menus, popups, sliders, FAQ accordions, gallery lightbox, forms). URLs are unchanged, and old redirects are kept in `redirects.ts`.
- **Editable:** all text, links, images, menus, reviews, FAQs, blog posts and SEO fields are in Sanity. The layout of each block stays fixed (it is stored with the block), so edits never break the design.
- **Proven:** `npm run verify` re-renders all 90 crawled URLs and compares them with the WordPress HTML, tag by tag: the migrated content is identical (90/90). The review fixes below are then applied on top by `npm run fixes`.

## Review fixes (scripts/fixes.ts)

Applied to the migrated content and published to Sanity:

- Removed two homepage sections that were hidden on every device (duplicate "Transformative Landscaping & Masonry Solutions" headings).
- Quote heading copied from the paver repair page ("Get Your Free Paver Repair & Maintenance Quote") replaced on 15 pages with a page-specific one.
- /retaining-walls-connecticut/ H1 now matches its title (Fairfield & New Haven County).
- Alt text on all content photos (from the file name or the page topic), "Alpha Hardscapes" on logos, post title on blog hero images. Decorative graphics keep `alt=""` on purpose.
- Blog index H1 and meta descriptions for the blog, categories, posts and other indexable pages that had none.
- Outdoor kitchen cost post: "Walkway & Patio Connecticut" now links to /walkway-patio-connecticut/.
- Header and footer menus use the final URLs (/landscaping/, /service-areas/).
- Footer copyright year follows the calendar (`{year}` in any text field prints the current year).
- Structured data: Yoast's graph is kept (WebPage, BreadcrumbList, WebSite, Article on posts) and its Organization is replaced with a HomeAndConstructionBusiness (phone, logo, address, hours, areas served, Facebook/Instagram, services), editable in **Site settings > Business schema**. The site search action was removed (there is no search page).
- Favicon set at the site root (favicon.ico, 32/192/512 px icons, apple-touch-icon, web manifest), rendered from the vector logo.
- Social images: a 1200x630 photo per page in `public/og/` (the homepage used a 136x118 background graphic).

## Redirects

- `content/redirects.json` (loaded by `next.config.ts`, all 301): every redirect the live WordPress site answered when probed with ~1,350 old and alternative URLs (old slugs, renamed parents, the redirect plugin's rules, WordPress' own "did you mean" redirects), plus `/?p=ID` and `/?page_id=ID` shortlinks. 711 rules, all tested.
- Any other unknown URL whose last part matches a page or post is 301'd there at request time (`lib/site/guess.ts`), like WordPress did.
- The redirect plugin's own list could not be exported without a WordPress login. If you have one, export it (Tools > Redirection, or the "Redirect Redirection" plugin screen) and add any rule missing from `content/redirects.json`.

## Forms

All 15 Elementor forms (homepage, landing page, opt-in, and the 12 quote popups) post to `/wp-admin/admin-ajax.php`, which is now this site's route, not WordPress. Each one was submitted end to end in a browser: lead delivered to the webhook with readable field names (Phone, Project Address, Service...), visitor redirected to the form's thank-you page. The GoHighLevel forms on the $1000-off/20%-off landing pages are GoHighLevel iframes and do not depend on WordPress.

## How it works

| Part | Where |
|---|---|
| Every public URL | `app/[[...path]]/route.ts`: loads the document for the path and renders it with `lib/site/render.ts` |
| Page skeletons (head, stylesheets, scripts) | `lib/generated/shells.json` |
| Block templates and renderer | `lib/render/template.ts` (slots like `[[@text:title]]` are filled from the CMS fields) |
| Blog grid, post header, previous/next | `lib/render/astra.ts` |
| Forms | Elementor's script posts to `/wp-admin/admin-ajax.php` as before: `app/wp-admin/admin-ajax.php/route.ts` sends the lead to GoHighLevel and/or email and redirects to the form's thank-you page |
| Sitemaps, feed, robots | `/sitemap_index.xml` (same Yoast URLs), `/feed/`, `/robots.txt` |
| Images, fonts, theme scripts | `public/wp-content/...` at the original URLs; split stylesheets in `public/assets/css`, scripts in `public/assets/js` |
| Built-in copy | `content/seed.json`: used when the CMS is empty or unreachable, and the source for `npm run seed` |

## Setup

1. **Sanity project:** `7ysj6im9`, dataset `production`. The project ID is pinned in `sanity/env.ts` on purpose (a `NEXT_PUBLIC_SANITY_PROJECT_ID` meant for another site cannot redirect this one).
2. **Content (done):** all 109 documents are loaded. To reload: put an Editor token in `.env.local` as `SANITY_WRITE_TOKEN`, then `npm run seed` (adds missing documents) or `npm run seed -- --force` (overwrites the CMS with the built-in copy).
3. **CORS (done):** `http://localhost:3000`, `https://alphahardscapes.com` and `https://www.alphahardscapes.com` are allowed with credentials. Add the Vercel preview URL too (sanity.io/manage > API > CORS origins).
4. **Run locally:** `npm install`, `npm run dev`, open http://localhost:3000 and http://localhost:3000/cms.
5. **Vercel:** import the repo, add the variables from `.env.example` (not `SANITY_WRITE_TOKEN`), deploy, then point alphahardscapes.com at it. reCAPTCHA in the forms only works on alphahardscapes.com (the site key is tied to that domain).
6. **Publish webhook:** in Sanity, API > Webhooks: URL `https://alphahardscapes.com/api/revalidate`, triggers create/update/delete, secret = `SANITY_REVALIDATE_SECRET`. Changes then go live within seconds (otherwise within 5 minutes).
7. **Form leads:** set `GHL_WEBHOOK_URL` and/or `RESEND_API_KEY` + `LEAD_EMAIL_TO`. Without either, submissions are only logged. The thank-you page of each form is set in **Site settings > Forms**.

## Editing in /cms

- **Pages** and **Blog posts**: open a page, then its sections. Each block shows its text, link and image fields. To add a block like an existing one, duplicate it (the copy keeps the design).
- **Images:** use *Replace image* on any image field. The new image is shown at the same size and crop as the old one.
- **Header, footer & popups:** the menus, phone number button, footer links and the quote popups.
- **Site settings:** forms (thank-you pages), popups, posts per blog page.
- **SEO** tab on every page and post: title, description, canonical, social image, schema.
- The *Developer* sections hold the layout templates and are read-only.

## Development

```bash
npm run dev        # local site
npm run lint       # ESLint
npm run typecheck  # TypeScript
npm run build      # production build
npm run verify -- <crawl-dir> [--server=http://localhost:3000]  # compare with the WordPress HTML
npm run fixes      # apply the review fixes to content/seed.json (after extract)
npm run seed -- --force  # publish content/seed.json to Sanity
```

`scripts/extract.ts` converted the crawled WordPress pages (HTML plus the WordPress REST API) into `content/seed.json` and `lib/generated/shells.json`. It is a one-off migration tool; the crawl itself is not in the repo.
