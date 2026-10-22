import heroImagesJson from "../generated/hero-images.json" with { type: "json" };
import { escapeAttr } from "../render/html.ts";

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
  const start = Math.max(0, html.indexOf('id="content"'));
  const m = /elementor-element-([0-9a-f]+)[^>]*data-settings="[^"]*background_background&quot;:&quot;classic/.exec(html.slice(start));
  return m ? heroImages[m[1]] : undefined;
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

  const hero = heroImage(out);
  if (hero) {
    const anchor = '<link rel="profile" href="https://gmpg.org/xfn/11">';
    const preload = `<link rel="preload" as="image" href="${escapeAttr(hero)}" fetchpriority="high">`;
    out = out.includes(anchor) ? out.replace(anchor, anchor + preload) : out.replace("</head>", `${preload}</head>`);
  }

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
