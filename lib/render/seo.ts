import { escapeAttr, escapeHtml } from "./html.ts";

/** Yoast-style head tags. Every field is optional; empty ones are skipped. */
export type Seo = {
  title?: string;
  description?: string;
  robots?: string;
  canonical?: string;
  ogLocale?: string;
  ogType?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogUrl?: string;
  ogSiteName?: string;
  articlePublisher?: string;
  articleAuthor?: string;
  publishedTime?: string;
  modifiedTime?: string;
  ogImage?: string;
  ogImageWidth?: string;
  ogImageHeight?: string;
  ogImageType?: string;
  author?: string;
  twitterCard?: string;
  twitterMisc?: { _key?: string; label?: string; data?: string }[];
  /** JSON-LD graph (Yoast schema), printed as is. */
  schema?: string;
};

const prop = (p: string, v?: string) => (v ? `<meta property="${p}" content="${escapeAttr(v)}" />` : "");
const name = (n: string, v?: string) => (v ? `<meta name="${n}" content="${escapeAttr(v)}" />` : "");

/** `origin` replaces the old WordPress host in absolute URLs (preview deployments). */
export function renderSeo(seo: Seo | undefined, origin?: string): string {
  const s = seo || {};
  const abs = (v?: string) => (v && origin ? v.replace(/^https?:\/\/(www\.)?alphahardscapes\.com/i, origin) : v);
  const out = [
    name("robots", s.robots),
    `<title>${escapeHtml(s.title || "")}</title>`,
    name("description", s.description),
    s.canonical ? `<link rel="canonical" href="${escapeAttr(abs(s.canonical))}" />` : "",
    prop("og:locale", s.ogLocale),
    prop("og:type", s.ogType),
    prop("og:title", s.ogTitle),
    prop("og:description", s.ogDescription),
    prop("og:url", abs(s.ogUrl)),
    prop("og:site_name", s.ogSiteName),
    prop("article:publisher", s.articlePublisher),
    prop("article:author", s.articleAuthor),
    prop("article:published_time", s.publishedTime),
    prop("article:modified_time", s.modifiedTime),
    prop("og:image", abs(s.ogImage)),
    prop("og:image:width", s.ogImageWidth),
    prop("og:image:height", s.ogImageHeight),
    prop("og:image:type", s.ogImageType),
    name("author", s.author),
    name("twitter:card", s.twitterCard),
    ...(s.twitterMisc || []).flatMap((m, i) => [name(`twitter:label${i + 1}`, m.label), name(`twitter:data${i + 1}`, m.data)]),
    s.schema ? `<script type="application/ld+json" class="yoast-schema-graph">${s.schema.replace(/<\/script/gi, "<\\/script")}</script>` : "",
  ];
  return out.filter(Boolean).join("\n");
}
