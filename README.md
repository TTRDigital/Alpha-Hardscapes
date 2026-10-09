# Alpha Hardscapes website

An exact copy of the WordPress site alphahardscapes.com (Astra + Elementor), rebuilt on Next.js 16 with all content in Sanity (embedded Studio at `/cms`). Built by TTR Digital Marketing.

- **Identical output:** every page prints the same HTML, CSS and scripts as the WordPress site, so it looks and behaves the same (menus, popups, sliders, FAQ accordions, gallery lightbox, forms). URLs are unchanged, and old redirects are kept in `redirects.ts`.
- **Editable:** all text, links, images, menus, reviews, FAQs, blog posts and SEO fields are in Sanity. The layout of each block stays fixed (it is stored with the block), so edits never break the design.
- **Proven:** `npm run verify` re-renders all 90 crawled URLs and compares them with the WordPress HTML, tag by tag. Current result: 90 identical, 0 different (from the CMS and from the built-in copy).

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
```

`scripts/extract.ts` converted the crawled WordPress pages (HTML plus the WordPress REST API) into `content/seed.json` and `lib/generated/shells.json`. It is a one-off migration tool; the crawl itself is not in the repo.
