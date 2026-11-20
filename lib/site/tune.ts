import heroImagesJson from "../generated/hero-images.json" with { type: "json" };
import cssBundlesJson from "../generated/css-bundles.json" with { type: "json" };
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
const webp = webpJson as { images: Record<string, string>; phone: Record<string, string>; mid: Record<string, string> };
const cssBundles = cssBundlesJson as Record<string, string>;

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
 * about 140 KB a page, downloaded at high priority and never used). They become preloads of the three
 * files every page really uses: Roboto, Montserrat and Poppins, regular, latin. Poppins (8 KB) was found
 * only through the stylesheet, arrived after the first paint and its swap moved the hero (layout shift
 * 0.06 to 0.11 on phones, Nov 20 sweep). */
const WASTED_PRELOAD = /<link rel="preload" as="font" href="https:\/\/fonts\.gstatic\.com\/[^"]+" crossorigin="">|<link id="omgf-preload-\d" rel="preload" href="\/wp-content\/uploads\/omgf\/elementor-gf-local-[^"]+" as="font" type="font\/woff2" crossorigin="">/g;
const FONT_PRELOADS = [
  "/wp-content/uploads/elementor/google-fonts/fonts/roboto-kfo7cnqeu92fr1me7ksn66agldtyluama3yuba.woff2",
  "/wp-content/uploads/elementor/google-fonts/fonts/montserrat-jtusjig1_i6t8kchkm459wlhyw.woff2",
  "/wp-content/uploads/elementor/google-fonts/fonts/poppins-pxibyp8kv8jhgfvrlgt9z1xlfq.woff2",
]
  .map((href) => `<link rel="preload" as="font" type="font/woff2" href="${href}" crossorigin="">`)
  .join("");

/* jQuery was the one render-blocking script (in the head). Nothing inline uses it before the deferred
 * bundle, which runs after it in document order. */
const JQUERY = '<script id="jquery-core-js" src="/wp-includes/js/jquery/jquery.min.js"></script>';

/** Bump when a file in public/assets/js changes, so browsers holding the year-long cached copy fetch it again. */
const SCRIPTS_VERSION = "1120";

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

/* Phones at 2x to 3x picked the 1440 to 2560 px original of large photos from the srcset (300 KB to 1 MB
 * each). Photos with a 1080 px copy (scripts/webp.ts, `mid`) get it as one more srcset candidate; an image
 * without a srcset gets one made of the copy and the original, with sizes saying it is at most its own
 * width. Desktops still choose the original, so nothing changes on screen. */
function midSrcset(body: string) {
  return body.replace(/<img\s[^>]*>/g, (img) => {
    const src = /\ssrc="([^"]+)"/.exec(img)?.[1];
    const srcset = /\ssrcset="([^"]*)"/.exec(img)?.[1];
    if (srcset) {
      const cands = srcset.split(/,\s*/).map((c) => c.trim().split(/\s+/)).filter((c) => c[0] && /^\d+w$/.test(c[1] || ""));
      if (!cands.length || cands.some((c) => +c[1].slice(0, -1) === 1080)) return img;
      const widest = cands.reduce((a, b) => (+b[1].slice(0, -1) > +a[1].slice(0, -1) ? b : a));
      const copy = webp.mid[widest[0]];
      if (!copy || +widest[1].slice(0, -1) <= 1200) return img;
      return img.replace(/\ssrcset="[^"]*"/, ` srcset="${srcset}, ${copy} 1080w"`);
    }
    const width = Number(/\swidth="(\d+)"/.exec(img)?.[1] || 0);
    const copy = src && webp.mid[src];
    if (!copy || width <= 1200) return img;
    return img.replace(/\ssrc="[^"]+"/, (m) => `${m} srcset="${copy} 1080w, ${src} ${width}w" sizes="(max-width: ${width}px) 100vw, ${width}px"`);
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

/* The footer's "Terms & Conditions" link was saved as a relative address ("terms-and-conditions/"), so on
 * every page but the home page it pointed at <page>/terms-and-conditions/ and went through a 301. A link
 * whose whole address is one bare slug ending in a slash is made absolute from the site root. The link
 * wording is unchanged. (Nov 20 sweep, TTR-2513.) */
const RELATIVE_SLUG_HREF = /(<a\s[^>]*?href=")([a-z0-9][a-z0-9-]*\/)(")/g;

function rootRelativeLinks(body: string) {
  return body.replace(RELATIVE_SLUG_HREF, "$1/$2$3");
}

/* Decorative graphics: the green rounded shapes and the dot pattern are small PNGs (136x118, 103x118,
 * 220x242) that the page stretches to other proportions (102x65, 92x111 on phones) and that look soft on
 * high-density screens. They are drawn again as SVG with the same size, colour (#aecd38), corner radius and
 * dot grid, and preserveAspectRatio="none", so they stretch exactly as before and stay sharp. Only <img> tags
 * change; the CMS keeps the PNGs. */
const DECOR_SVG: [RegExp, string][] = [
  [/(?:https:\/\/alphahardscapes\.com)?\/wp-content\/uploads\/20\d\d\/\d\d\/filled-bg-portrait\.png/, "/assets/img/filled-bg-portrait.svg"],
  [/(?:https:\/\/alphahardscapes\.com)?\/wp-content\/uploads\/20\d\d\/\d\d\/filled-bg\.png/, "/assets/img/filled-bg.svg"],
  [/(?:https:\/\/alphahardscapes\.com)?\/wp-content\/uploads\/20\d\d\/\d\d\/dot-grahpic\.png/, "/assets/img/dot-graphic.svg"],
];

function decorSvg(body: string) {
  return body.replace(/<img\s[^>]*>/g, (img) => {
    const src = /\ssrc="([^"]*)"/.exec(img)?.[1] || "";
    const hit = DECOR_SVG.find(([re]) => re.test(src));
    if (!hit || src.replace(hit[0], "") !== "") return img;
    return img.replace(/\ssrc="[^"]*"/, ` src="${hit[1]}"`).replace(/\s(?:srcset|sizes)="[^"]*"/g, "");
  });
}

/* Gallery tiles open the lightbox but contain only a background image, so screen readers announced an
 * unnamed link. Each gets an aria-label (not shown on screen). */
function galleryLabels(body: string) {
  let n = 0;
  return body.replace(/<a class="e-gallery-item[^"]*"[^>]*>/g, (a) => {
    n++;
    return /\saria-label=/.test(a) ? a : a.replace(/>$/, ` aria-label="Open project photo ${n} in the lightbox">`);
  });
}

/* The phone number in the header and hero is an Elementor icon box whose title is an <h3>, so the page
 * outline jumped from the H1 to an H3 ahead of the first H2. It is a phone link, not a section heading:
 * role="none" takes it out of the outline while the tag, and so its look, stays the same. */
function phoneTitles(body: string) {
  return body.replace(/<h3 class="elementor-icon-box-title">(\s*<a href="tel:[^"]*">[^<]*<\/a>\s*)<\/h3>/g, '<h3 class="elementor-icon-box-title" role="none">$1</h3>');
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

/* Background videos (the home page reel): the section shows the video's own first frame until the video
 * plays over it, instead of an empty dark box. Made with
 *   ffmpeg -i <video>.mp4 -frames:v 1 frame.png   (then WebP, quality 70)
 * Cover and centre, like Elementor sizes the video, so the switch is invisible. */
const VIDEO_POSTERS: Record<string, string> = {
  "/wp-content/uploads/2026/08/55AD24CF-90C1-4D9E-8E77-03BB607646C7.mp4": "/wp-content/uploads/2026/08/55AD24CF-90C1-4D9E-8E77-03BB607646C7-poster.webp",
};
const VIDEO_SECTION = /elementor-element-([0-9a-f]+)[^>]*data-settings="[^"]*background_video_link&quot;:&quot;https?:\\\/\\\/(?:www\.)?alphahardscapes\.com([^&]+)&quot;/;

function videoPoster(html: string) {
  const m = VIDEO_SECTION.exec(html.slice(Math.max(0, html.indexOf('id="content"'))));
  const poster = m && VIDEO_POSTERS[m[2].replace(/\\\//g, "/")];
  if (!m || !poster) return html;
  const sel = `.elementor-element-${m[1]}.elementor-element-${m[1]}.elementor-element-${m[1]}`;
  const head = `<link rel="preload" as="image" href="${poster}" fetchpriority="high"><style id="video-poster">${sel}{background-image:url("${poster}");background-position:center center;background-size:cover;background-repeat:no-repeat}</style>`;
  // Elementor gives the video its src when its script starts; that one call waits for the page's load
  // event, so the 1.3 MB video no longer competes with the first screen. Sizing and playback stay Elementor's.
  const defer =
    `<script>(function(){var v=document.querySelector('.elementor-element-${m[1]} .elementor-background-video-hosted');if(!v)return;var set=v.setAttribute;` +
    `v.setAttribute=function(n,x){if(n==='src'&&document.readyState!=='complete'){addEventListener('load',function(){set.call(v,n,x)},{once:true});return}return set.call(v,n,x)}})();</script>`;
  const out = html.replace("</head>", `${head}</head>`);
  const tag = out.indexOf('<video class="elementor-background-video-hosted"', out.indexOf(`elementor-element-${m[1]}`, out.indexOf('id="content"')));
  const end = tag < 0 ? -1 : out.indexOf("</video>", tag);
  return end < 0 ? out : out.slice(0, end + 8) + defer + out.slice(end + 8);
}

/* Stylesheets: the skeleton's 22 to 26 render-blocking files become the one bundle made from the same
 * files in the same order (scripts/css-bundles.mjs), in the place of the first. Nothing between them is a
 * style, so the cascade is unchanged. The route only asks for the bundle once it has seen it served
 * (lib/site/bundles.ts); otherwise, or for a list with no bundle, the original links stay. */
const STYLESHEET = /<link rel="stylesheet"(?: id="[^"]*")? href="(\/assets\/css\/[a-z0-9-]+\.css)" media="all">/g;

/** The bundle for this page's stylesheets, if the build made one. */
export function stylesheetBundle(html: string): string | undefined {
  const head = html.slice(0, Math.max(0, html.indexOf("</head>")));
  return cssBundles[[...head.matchAll(STYLESHEET)].map((m) => m[1]).join("|")];
}

function bundleStylesheets(head: string, bundle: string) {
  let first = true;
  return head.replace(STYLESHEET, () => {
    if (!first) return "";
    first = false;
    return `<link rel="stylesheet" href="${bundle}" media="all">`;
  });
}

/* Images in the first two top-level sections (the hero and the one under it) load normally. On phones
 * the second section starts inside the first screen, and Chrome laid its lazy images out 24 px tall
 * until it decided to load them, then pushed everything below down by their real height (layout shift
 * 0.05 to 0.11, Nov 20 sweep). They were fetched within the first 200 ms anyway. */
function eagerFirstSections(html: string) {
  const start = html.indexOf('id="content"');
  if (start < 0) return html;
  const parents = [...html.slice(start).matchAll(/<div class="elementor-element elementor-element-[0-9a-f]+ [^"]*\be-parent\b/g)];
  const end = parents.length > 2 ? start + parents[2].index : -1;
  if (end < 0) return html;
  const part = html.slice(start, end).replace(/<img\s[^>]*>/g, (img) => img.replace(/\sloading="lazy"/, ""));
  return html.slice(0, start) + part + html.slice(end);
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

/** `cssBundle`: the page's stylesheet bundle, only when it is known to be served (see stylesheetBundle). */
export function tuneHtml(html: string, opts: { cssBundle?: string } = {}): string {
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
  // The combined theme scripts changed in place (TTR-2513: the copy of the call-tracking snippet no longer
  // starts on its own); /assets is cached for a year, so the address carries a version.
  out = out.replace(/(<script defer="" src="\/assets\/js\/[0-9a-f]{32}\.js)(")/g, `$1?v=${SCRIPTS_VERSION}$2`);

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

  out = videoPoster(out);

  const bodyAt = out.indexOf("</head>");
  const bundle = opts.cssBundle && opts.cssBundle === stylesheetBundle(out) ? opts.cssBundle : undefined;
  if (bodyAt > 0) {
    const body = phoneTitles(galleryLabels(decorSvg(rootRelativeLinks(scrollTables(finalLinks(midSrcset(webpImages(defaultAlt(out.slice(bodyAt))))))))));
    out = (bundle ? bundleStylesheets(out.slice(0, bodyAt), bundle) : out.slice(0, bodyAt)) + body;
  }

  if (AUTOPLAY_VIDEO.test(out)) {
    out = out.replace(AUTOPLAY_VIDEO, '<video class="elementor-video"$1 data-autoplay="" preload="metadata"$2>').replace("</body>", `${VIDEO_SCRIPT}</body>`);
  }

  // Accessibility: a video is not a presentation role; a plain div cannot carry aria-label.
  out = out.replace(/(<video class="elementor-background-video-hosted") role="presentation"/g, "$1");
  out = out.replace(/(<div class="elementor-testimonial__icon[^"]*") aria-label="[^"]*"/g, "$1");

  out = eagerFirstSections(out);

  // Footer and popups are never in the first screen.
  const footer = out.indexOf("<footer");
  out = lazyImages(out, footer, footer < 0 ? -1 : out.indexOf("</footer>", footer));
  out = lazyImages(out, out.indexOf('id="ast-scroll-top"'), out.length);

  return out;
}
