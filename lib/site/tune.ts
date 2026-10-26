import heroImagesJson from "../generated/hero-images.json" with { type: "json" };
import webpJson from "../generated/webp.json" with { type: "json" };
import { escapeAttr } from "../render/html.ts";
import { redirectRows } from "../../redirects.ts";

/**
 * Speed and accessibility tune-up applied to every rendered page at request
 * time (app/[[...path]]/route.ts). The page skeletons (lib/generated/shells.json)
 * and the CMS content stay exactly as WordPress printed them: every step here
 * is a plain text replacement that does nothing when a page lacks the pattern.
 *
 * Measured on October 22, 2026 (Lighthouse, phone profile): Tag Manager and
 * reCAPTCHA blocked the main thread for about 2.6 s, five font preloads pointed
 * at files no stylesheet uses, and the hero background was discovered late.
 */

const heroImages = heroImagesJson as Record<string, string>;
const webp = webpJson as { images: Record<string, string>; phone: Record<string, string> };

/** Runs `load` on the first touch, scroll, key press or mouse move, or after `ms` milliseconds. */
function onFirstInteraction(body: string, ms = 10000) {
  return (
    `var done=false;function load(){if(done)return;done=true;${body}}` +
    `['pointerdown','keydown','scroll','touchstart','mousemove','wheel'].forEach(function(e){addEventListener(e,load,{once:true,passive:true})});` +
    `setTimeout(load,${ms});`
  );
}

/* Tag Manager: the container (and what it loads: GA4, Google Ads, Hotjar, the call tracking pool)
 * starts after the visitor's first interaction, or after 10 seconds. dataLayer pushes made before that
 * are queued and go out when the container loads. The noscript iframe is unchanged. */
const GTM_SNIPPET = /<script data-cfasync="false" data-pagespeed-no-defer="">\s*\(function\(w,d,s,l,i\)\{w\[l\]=w\[l\]\|\|\[\];w\[l\]\.push\(\{'gtm\.start':[\s\S]*?'\/\/www\.googletagmanager\.com\/gtm\.js\?id='\+i\+dl;f\.parentNode\.insertBefore\(j,f\);\s*\}\)\(window,document,'script','dataLayer','(GTM-[A-Z0-9]+)'\);\s*<\/script>/;

function gtmLoader(id: string) {
  const start = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${id}');`;
  // Tags in the container may use jQuery, which now loads deferred: wait for it on a slow connection.
  const body = `if(!window.jQuery&&document.readyState==='loading'){done=false;document.addEventListener('DOMContentLoaded',load);return}${start}`;
  return `<script data-cfasync="false" data-pagespeed-no-defer="">(function(){${onFirstInteraction(body)}})();</script>`;
}

/* reCAPTCHA: Google's script (347 KB, one widget per form, 12 forms a page counting the quote popups)
 * loads on the first interaction. Elementor's form script polls for it every 350 ms and renders the
 * checkbox as soon as it is there. */
const RECAPTCHA = /<script id="elementor-recaptcha-api-js" src="(https:\/\/www\.google\.com\/recaptcha\/api\.js\?[^"]*)"><\/script>/;

function recaptchaLoader(src: string) {
  const body = `var s=document.createElement('script');s.id='elementor-recaptcha-api-js';s.async=true;s.src='${src.replace(/&amp;/g, "&")}';document.head.appendChild(s);`;
  return `<script id="elementor-recaptcha-api-js-loader">(function(){${onFirstInteraction(body)}})();</script>`;
}

/* Fonts: the preloads named files no stylesheet uses (two Google-hosted files and three OMGF copies,
 * about 140 KB a page, downloaded at high priority and never used). They become preloads of the two
 * files every page really uses: Roboto and Montserrat, regular, latin. */
const WASTED_PRELOAD = /<link rel="preload" as="font" href="https:\/\/fonts\.gstatic\.com\/[^"]+" crossorigin="">|<link id="omgf-preload-\d" rel="preload" href="\/wp-content\/uploads\/omgf\/elementor-gf-local-[^"]+" as="font" type="font\/woff2" crossorigin="">/g;
const FONT_PRELOADS = [
  "/wp-content/uploads/elementor/google-fonts/fonts/roboto-kfo7cnqeu92fr1me7ksn66agldtyluama3yuba.woff2",
  "/wp-content/uploads/elementor/google-fonts/fonts/montserrat-jtusjig1_i6t8kchkm459wlhyw.woff2",
]
  .map((href) => `<link rel="preload" as="font" type="font/woff2" href="${href}" crossorigin="">`)
  .join("");

/* jQuery was the one render-blocking script (in the head). Nothing inline uses it before the deferred
 * bundle, which runs after it in document order. */
const JQUERY = '<script id="jquery-core-js" src="/wp-includes/js/jquery/jquery.min.js"></script>';

/* Hosted videos set to autoplay (the reel on the home page, 3.5 MB) download when they scroll into
 * view instead of with the page. */
const AUTOPLAY_VIDEO = /<video class="elementor-video"([^>]*) autoplay=""([^>]*)>/g;
const VIDEO_SCRIPT =
  `<script>(function(){var v=document.querySelectorAll('video[data-autoplay]');if(!v.length)return;` +
  `function play(e){e.preload='auto';var p=e.play();if(p&&p.catch)p.catch(function(){})}` +
  `if(!('IntersectionObserver' in window)){v.forEach(play);return}` +
  `var o=new IntersectionObserver(function(es){es.forEach(function(x){if(x.isIntersecting){o.unobserve(x.target);play(x.target)}})},{rootMargin:'100px'});` +
  `v.forEach(function(e){o.observe(e)})})();</script>`;

/** The background image of the first section with a classic background: the largest paint on most pages. */
export function heroImage(html: string): string | undefined {
  return heroSection(html)?.src;
}

function heroSection(html: string): { id: string; src: string } | undefined {
  const start = Math.max(0, html.indexOf('id="content"'));
  const m = /elementor-element-([0-9a-f]+)[^>]*data-settings="[^"]*background_background&quot;:&quot;classic/.exec(html.slice(start));
  return m && heroImages[m[1]] ? { id: m[1], src: heroImages[m[1]] } : undefined;
}

/* Photos: the WebP copies made by scripts/webp.ts (same size, 70 to 90% lighter) replace the PNG and
 * JPEG originals in the page, in src, srcset, lightbox links and Elementor's JSON settings (escaped
 * slashes). The <head> keeps the originals for social cards and structured data. */
const UPLOAD = /(\\?\/)wp-content\1uploads\1[^"'\s()<>&?]+?\.(?:png|jpe?g|webp)(?=["'\s()<>&?,])/gi;

function webpImages(body: string) {
  return body.replace(UPLOAD, (m, slash: string) => {
    const plain = slash === "/" ? m : m.replace(/\\\//g, "/");
    const copy = webp.images[plain];
    if (!copy) return m;
    return slash === "/" ? copy : copy.replace(/\//g, "\\/");
  });
}

/* Alt text where the CMS left it empty, for images that repeat on many pages: two decorative
 * graphics (also hidden from screen readers) and the photo beside the closing call to action.
 * Author avatars get the author's name. Any alt text set in the CMS is kept. */
const DEFAULT_ALT: [RegExp, string, boolean][] = [
  [/\/filled-bg(?:-portrait)?\.png/, "Green decorative shape", true],
  [/\/dot-grahpic\.png/, "Decorative dot pattern", true],
  [/\/uploads\/20\d\d\/\d\d\/alpha(?:-\d+x\d+)?\.png/, "Smiling man in an Alpha Hardscapes T-shirt and cap with his arms crossed", false],
];

function defaultAlt(html: string) {
  const author = /<h1 class="page-title ast-archive-title">(?:Author name: )?([^<]+)<\/h1>/.exec(html)?.[1]?.trim();
  return html.replace(/<img\s[^>]*>/g, (img) => {
    if (!/\salt=""/.test(img)) return img;
    const src = /\ssrc="([^"]*)"/.exec(img)?.[1] || "";
    if (author && /^https:\/\/secure\.gravatar\.com\/avatar\//.test(src)) return img.replace(/\salt=""/, ` alt="${escapeAttr(author)}"`);
    const hit = DEFAULT_ALT.find(([re]) => re.test(src));
    if (!hit) return img;
    return img.replace(/\salt=""/, ` alt="${hit[1]}"${hit[2] ? ' aria-hidden="true"' : ""}`);
  });
}

/* Internal links that point at an old address go straight to the page it redirects to (redirects.ts),
 * so visitors and crawlers skip the extra hop and every live page is linked under its own address. */
const MOVED = new Map(redirectRows.filter((r) => !r.query).map((r) => [r.source, r.destination]));
const SITE_HREF = /(<a\s[^>]*?href=")(?:https?:\/\/(?:www\.)?alphahardscapes\.com)?(\/[^"#?]*)([^"]*")/g;

function finalLinks(body: string) {
  return body.replace(SITE_HREF, (m, start: string, path: string, rest: string) => {
    let target = MOVED.get(path);
    for (let i = 0; target && MOVED.has(target) && i < 5; i++) target = MOVED.get(target);
    return target ? `${start}${target}${rest}` : m;
  });
}

/* Tables in blog posts are wider than a phone screen: they scroll inside their own box instead of
 * pushing the whole page sideways. */
function scrollTables(body: string) {
  return body.replace(/<table[\s>][\s\S]*?<\/table>/g, (t) => `<div class="table-scroll" style="overflow-x:auto">${t}</div>`);
}

/* Phones: the first section's background comes from a 1080 px copy instead of the 1920 to 2880 px one.
 * The repeated class outweighs the page stylesheet's selector (four classes), and this style comes later. */
function phoneHero(id: string, small: string) {
  const sel = `.elementor-element-${id}.elementor-element-${id}.elementor-element-${id}:not(.elementor-motion-effects-element-type-background)`;
  return `<style id="hero-phone">@media (max-width:767px){${sel}{background-image:url("${small}")}}</style>`;
}

/** Adds loading="lazy" and decoding="async" to images in a slice of the page that is never in the first screen. */
function lazyImages(html: string, from: number, to: number) {
  if (from < 0 || to <= from) return html;
  const part = html.slice(from, to).replace(/<img\s[^>]*>/g, (img) => {
    let out = img;
    if (!/\sloading=/.test(out)) out = out.replace(/^<img\s/, '<img loading="lazy" ');
    if (!/\sdecoding=/.test(out)) out = out.replace(/^<img\s/, '<img decoding="async" ');
    return out;
  });
  return html.slice(0, from) + part + html.slice(to);
}

export function tuneHtml(html: string): string {
  let out = html;

  out = out.replace(GTM_SNIPPET, (_m, id: string) => gtmLoader(id));
  out = out.replace(RECAPTCHA, (_m, src: string) => recaptchaLoader(src));

  let fontsDone = false;
  out = out.replace(WASTED_PRELOAD, () => {
    if (fontsDone) return "";
    fontsDone = true;
    return FONT_PRELOADS;
  });

  out = out.replace(JQUERY, '<script defer="" id="jquery-core-js" src="/wp-includes/js/jquery/jquery.min.js"></script>');

  const hero = heroSection(out);
  if (hero) {
    const big = webp.images[hero.src] || hero.src;
    const small = webp.phone[big];
    const anchor = '<link rel="profile" href="https://gmpg.org/xfn/11">';
    const preload = small
      ? `<link rel="preload" as="image" href="${escapeAttr(small)}" media="(max-width: 767px)" fetchpriority="high">` +
        `<link rel="preload" as="image" href="${escapeAttr(big)}" media="(min-width: 768px)" fetchpriority="high">`
      : `<link rel="preload" as="image" href="${escapeAttr(big)}" fetchpriority="high">`;
    out = out.includes(anchor) ? out.replace(anchor, anchor + preload) : out.replace("</head>", `${preload}</head>`);
    if (small) out = out.replace("</head>", `${phoneHero(hero.id, small)}</head>`);
  }

  const bodyAt = out.indexOf("</head>");
  if (bodyAt > 0) out = out.slice(0, bodyAt) + scrollTables(finalLinks(webpImages(defaultAlt(out.slice(bodyAt)))));

  if (AUTOPLAY_VIDEO.test(out)) {
    out = out.replace(AUTOPLAY_VIDEO, '<video class="elementor-video"$1 data-autoplay="" preload="metadata"$2>').replace("</body>", `${VIDEO_SCRIPT}</body>`);
  }

  // Accessibility: a video is not a presentation role; a plain div cannot carry aria-label.
  out = out.replace(/(<video class="elementor-background-video-hosted") role="presentation"/g, "$1");
  out = out.replace(/(<div class="elementor-testimonial__icon[^"]*") aria-label="[^"]*"/g, "$1");

  // Footer and popups are never in the first screen.
  const footer = out.indexOf("<footer");
  out = lazyImages(out, footer, footer < 0 ? -1 : out.indexOf("</footer>", footer));
  out = lazyImages(out, out.indexOf('id="ast-scroll-top"'), out.length);

  return out;
}
