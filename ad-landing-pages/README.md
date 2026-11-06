# Alpha Hardscapes ad pages (own Vercel project)

One Vercel project per ad account (Kia, Nov 6), apart from the SEO site. Static page in `public/` (index.html + images), and one Vercel Function, `api/season-lead.ts`, for the form.

- Project: `alpha-ad-pages`, Root Directory `ad-landing-pages`, Framework Other. Production branch: `claude/alpha-ad-pages`.
- Environment variable (set by a person in Vercel, never in the page): `GHL_SEASON_WEBHOOK_URL` (GoHighLevel inbound webhook). Optional: `TTR_OS_URL`, `NEXT_PUBLIC_TTR_SITE_KEY`.
- noindex on every response (vercel.json header) and in the page.
- Domain: add a subdomain later (for example ads.alphahardscapes.com) only on Kia's yes, then point the Google Ads final URL at it.
- Google Ads tag and conversion labels: to be added in `public/index.html` where marked.
