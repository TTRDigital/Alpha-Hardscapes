/**
 * Stylesheet and script of the blog design (lib/render/blog.ts), printed only on
 * blog pages. The styles use the site's own tokens: Montserrat, the Alpha green
 * #AECD38 with dark text on it, Poppins on buttons like the header's "Book Your
 * Quote", 4 to 18 px radii. Everything reads without JavaScript: the script only
 * adds the scroll reveal, the reading progress bar and the current jump link, and
 * every reveal has a CSS fallback that shows the content after 2.5 s anyway.
 */

export const BLOG_CSS = `
.ah-blog{--ah-green:#AECD38;--ah-green-dark:#5B7312;--ah-green-soft:#F3F8DF;--ah-ink:#161A14;--ah-text:#2B3028;--ah-muted:#626A5C;--ah-line:#E4E8DC;--ah-tint:#F7F9F3;--ah-dark:#1E2A1C;--ah-shadow:0 14px 34px rgba(26,36,16,.12);--ah-font:"Montserrat",sans-serif;--ah-font-btn:"Poppins","Montserrat",sans-serif;font-family:var(--ah-font);color:var(--ah-text);background:#fff;overflow-x:clip}
.ah-blog *,.ah-blog *::before,.ah-blog *::after{box-sizing:border-box}
.ah-blog img{max-width:100%}
.ah-blog .ah-article{padding:0;margin:0;background:transparent;border:0;box-shadow:none}
.ah-wrap{max-width:1200px;margin:0 auto;padding-left:16px;padding-right:16px}
@media(min-width:768px){.ah-wrap{padding-left:24px;padding-right:24px}}
html.ah-blog-page{scroll-behavior:smooth}
.ah-blog h1,.ah-blog h2,.ah-blog h3{font-family:var(--ah-font)}
.ah-eyebrow{font:700 12px/1.2 var(--ah-font);letter-spacing:.12em;text-transform:uppercase;color:var(--ah-green-dark);margin:0 0 10px}
.ah-eyebrow--light{color:var(--ah-green)}
.ah-blog .ah-h2{font:800 clamp(22px,2.4vw,30px)/1.25 var(--ah-font);color:var(--ah-ink);margin:0 0 .5em;letter-spacing:-.01em}
.ah-blog .ah-title{font:800 clamp(30px,5.2vw,46px)/1.14 var(--ah-font);letter-spacing:-.015em;color:var(--ah-ink);margin:10px 0 20px}
.ah-pills{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 12px}
.ah-blog .ah-pill{display:inline-block;background:var(--ah-green);color:#111;font:700 12px/1 var(--ah-font);letter-spacing:.08em;text-transform:uppercase;padding:8px 12px;border-radius:999px;text-decoration:none;transition:background .2s,transform .2s}
.ah-blog .ah-pill:hover{background:#C2DC5E;color:#111;transform:translateY(-1px)}
.ah-blog .ah-pill--small{padding:6px 10px;font-size:11px}
.ah-blog .ah-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:var(--ah-green);color:#111;border:1px solid var(--ah-green);border-radius:6px;padding:13px 22px;font:500 14px/1.3 var(--ah-font-btn);text-transform:uppercase;letter-spacing:.02em;text-decoration:none;cursor:pointer;transition:transform .2s,box-shadow .2s,background .2s,color .2s}
.ah-blog .ah-btn:hover,.ah-blog .ah-btn:focus-visible{background:#fff;color:#111;transform:translateY(-2px);box-shadow:0 10px 22px rgba(0,0,0,.14)}
.ah-blog .ah-btn--outline{background:#fff;border-color:var(--ah-ink);color:var(--ah-ink)}
.ah-blog .ah-btn--outline:hover{background:var(--ah-ink);color:#fff}
.ah-blog .ah-btn--block{display:flex;width:100%}
.ah-blog .ah-phone{display:inline-flex;align-items:center;gap:8px;font:600 16px/1.2 var(--ah-font);color:var(--ah-ink);text-decoration:none;transition:color .2s}
.ah-blog .ah-phone:hover{color:var(--ah-green-dark)}
.ah-blog .ah-phone--light,.ah-blog .ah-phone--light:hover{color:#fff}
.ah-blog .ah-phone--light:hover{color:var(--ah-green)}
.ah-crumbs{display:flex;flex-wrap:wrap;gap:8px;font-size:13px;color:var(--ah-muted);margin:0 0 14px}
.ah-blog .ah-crumbs a{color:inherit;text-decoration:none}
.ah-blog .ah-crumbs a:hover{color:var(--ah-ink);text-decoration:underline}

/* hero */
.ah-hero{padding:0 0 8px}
.ah-hero__grid{display:flex;flex-direction:column-reverse;gap:22px}
.ah-hero__media{margin:0 -16px}
.ah-hero__img{display:block;width:100%;height:auto;aspect-ratio:3/2;object-fit:cover}
.ah-hero--wide .ah-hero__img{aspect-ratio:auto}
.ah-hero__text{animation:ah-rise .4s cubic-bezier(.2,.7,.2,1) both}
.ah-hero--plain{background:linear-gradient(160deg,var(--ah-green-soft),#fff 70%);border-bottom:1px solid var(--ah-line);padding:28px 0 32px;margin-bottom:8px}
@media(min-width:768px){.ah-hero__media{margin:0}.ah-hero__img{border-radius:20px;box-shadow:var(--ah-shadow)}.ah-hero{padding-top:28px}}
@media(min-width:1024px){.ah-hero{padding:44px 0 16px}.ah-hero--photo .ah-hero__grid{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(0,1fr);gap:56px;align-items:center}.ah-hero--photo .ah-hero__img{aspect-ratio:16/11}.ah-hero--wide .ah-hero__text{max-width:860px;margin:0 auto;text-align:center}.ah-hero--wide .ah-crumbs,.ah-hero--wide .ah-pills{justify-content:center}.ah-hero--wide .ah-byline{margin:0 auto}.ah-hero--plain .ah-hero__text{max-width:860px}}
@keyframes ah-rise{from{opacity:.3;transform:translateY(10px)}to{opacity:1;transform:none}}

/* byline */
.ah-byline{display:inline-flex;max-width:100%;align-items:center;gap:14px;padding:12px 18px 12px 12px;border:1px solid var(--ah-line);border-radius:16px;background:#fff;box-shadow:0 6px 18px rgba(20,30,10,.05)}
.ah-byline__avatar{flex:none;text-decoration:none}
.ah-avatar,.ah-author-card__photo{width:56px;height:56px;border-radius:50%;overflow:hidden;flex:none;display:inline-grid;place-items:center;background:var(--ah-green-soft);box-shadow:0 0 0 3px #fff,0 0 0 5px var(--ah-green)}
.ah-avatar__img,.ah-author-card__photo__img{width:100%;height:100%;object-fit:cover;display:block}
.ah-avatar--mono,.ah-author-card__photo--mono{font:800 18px/1 var(--ah-font);color:var(--ah-ink)}
.ah-byline__who{min-width:0}
.ah-byline__name{margin:0;font-size:15px;line-height:1.45;color:var(--ah-text)}
.ah-byline__name em{font-style:normal}
.ah-blog .ah-byline__name a{color:var(--ah-ink);font-weight:700;text-decoration:none;border-bottom:2px solid var(--ah-green)}
.ah-blog .ah-byline__name a:hover{border-bottom-color:var(--ah-green-dark)}
.ah-byline__role{color:var(--ah-muted)}
.ah-byline__meta{margin:5px 0 0;display:flex;flex-wrap:wrap;gap:4px 14px;font-size:13.5px;color:var(--ah-muted)}
.ah-byline__time,.ah-card__time{display:inline-flex;align-items:center;gap:5px}

/* layout */
.ah-layout{display:grid;grid-template-columns:minmax(0,1fr);gap:40px;padding-top:30px}
.ah-side{display:none}
@media(min-width:1024px){.ah-layout{grid-template-columns:minmax(0,720px) 300px;justify-content:center;column-gap:72px;padding-top:40px}.ah-side{display:block}}
.ah-side__sticky{position:sticky;top:24px;display:grid;gap:18px;max-height:calc(100vh - 40px);overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;padding:2px 6px 2px 2px}
.ah-side__title{font:800 12px/1 var(--ah-font);letter-spacing:.12em;text-transform:uppercase;color:var(--ah-muted);margin:0 0 12px}
.ah-toc__list{list-style:none;margin:0;padding:0;counter-reset:ah-t}
.ah-toc__list li{counter-increment:ah-t;margin:0;padding:0}
.ah-blog .ah-toc__list a{display:flex;gap:10px;padding:7px 0 7px 12px;margin-left:-2px;border-left:2px solid transparent;color:var(--ah-text);text-decoration:none;font-size:14.5px;line-height:1.4;transition:color .2s,border-color .2s}
.ah-toc__list a::before{content:counter(ah-t,decimal-leading-zero);color:var(--ah-green-dark);font-weight:700;font-size:12px;padding-top:2px;flex:none}
.ah-blog .ah-toc__list a:hover,.ah-blog .ah-toc__list a.is-current{color:var(--ah-ink);border-left-color:var(--ah-green)}
.ah-toc--side .ah-toc__list{border-left:2px solid var(--ah-line)}
.ah-toc--mobile{border:1px solid var(--ah-line);border-radius:14px;padding:0 18px;background:#fff;margin:0 0 30px}
.ah-toc--mobile summary{cursor:pointer;list-style:none;padding:16px 0;font:700 15px/1.3 var(--ah-font);color:var(--ah-ink);display:flex;align-items:center;gap:10px}
.ah-toc--mobile summary::-webkit-details-marker{display:none}
.ah-toc--mobile summary::after{content:"";margin-left:auto;width:9px;height:9px;border-right:2px solid var(--ah-ink);border-bottom:2px solid var(--ah-ink);transform:rotate(45deg);transition:transform .25s;flex:none}
.ah-toc--mobile[open] summary::after{transform:rotate(-135deg)}
.ah-toc__count{font-weight:500;color:var(--ah-muted);font-size:13px}
.ah-toc--mobile .ah-toc__list{padding:0 0 14px;border-left:2px solid var(--ah-line);margin-left:2px}
@media(min-width:1024px){.ah-toc--mobile{display:none}}
.ah-facts,.ah-side-cta{border:1px solid var(--ah-line);border-radius:16px;padding:18px 20px;background:var(--ah-tint)}
.ah-facts dl{margin:0;display:grid;gap:10px}
.ah-facts dt{font-size:11.5px;color:var(--ah-muted);text-transform:uppercase;letter-spacing:.08em;margin:0 0 2px}
.ah-facts dd{margin:0;font-weight:600;color:var(--ah-ink);font-size:14.5px}
.ah-blog .ah-facts a{color:var(--ah-ink);text-decoration:underline;text-decoration-color:var(--ah-green);text-decoration-thickness:2px;text-underline-offset:3px}
.ah-side-cta p{margin:0 0 12px;font-size:14.5px;line-height:1.5;color:var(--ah-text)}

/* in short */
.ah-short{background:var(--ah-green-soft);border-left:5px solid var(--ah-green);border-radius:14px;padding:20px 22px;margin:0 0 26px}
.ah-short__label{font:700 12px/1.2 var(--ah-font);letter-spacing:.12em;text-transform:uppercase;color:var(--ah-green-dark);margin:0 0 8px}
.ah-blog .ah-short__text{font-size:1.2rem;line-height:1.6;font-weight:500;color:var(--ah-ink);margin:0}

/* body text */
.ah-blog .ah-body{font-size:1.0625rem;line-height:1.75;color:var(--ah-text)}
@media(min-width:1024px){.ah-blog .ah-body{font-size:1.1rem}}
.ah-blog .ah-body p{margin:0 0 1.4em}
.ah-blog .ah-body h2{font:800 clamp(23px,2.4vw,30px)/1.25 var(--ah-font);color:var(--ah-ink);margin:2.3em 0 .75em;padding-top:16px;position:relative;scroll-margin-top:28px;letter-spacing:-.01em}
.ah-blog .ah-body h2::before{content:"";position:absolute;top:0;left:0;width:44px;height:4px;border-radius:2px;background:var(--ah-green)}
.ah-blog .ah-body h3{font:700 1.25rem/1.3 var(--ah-font);color:var(--ah-ink);margin:1.9em 0 .6em}
.ah-blog .ah-body a{color:var(--ah-ink);font-weight:600;text-decoration:underline;text-decoration-color:var(--ah-green);text-decoration-thickness:2px;text-underline-offset:3px;transition:background-color .2s,text-decoration-color .2s}
.ah-blog .ah-body a:hover{background:var(--ah-green-soft);text-decoration-color:var(--ah-green-dark)}
.ah-blog .ah-body ul,.ah-blog .ah-body ol{padding-left:1.4em;margin:0 0 1.5em}
.ah-blog .ah-body li{margin:.45em 0}
.ah-blog .ah-body ul li::marker{color:var(--ah-green-dark)}
.ah-blog .ah-body blockquote{margin:1.6em 0;padding:4px 0 4px 20px;border-left:4px solid var(--ah-green);color:var(--ah-ink);font-style:italic}
.ah-blog .ah-body table{width:100%;border-collapse:collapse;font-size:.95em;margin:0 0 1.6em;display:block;overflow-x:auto}
.ah-blog .ah-body th,.ah-blog .ah-body td{border:1px solid var(--ah-line);padding:10px 12px;text-align:left}
.ah-blog .ah-body img{height:auto;border-radius:12px}

/* figures */
.ah-figure{margin:2.2em 0}
.ah-figure__img{display:block;width:100%;height:auto;border-radius:16px;object-fit:cover;aspect-ratio:3/2}
.ah-figure figcaption{margin-top:10px;font-size:14px;line-height:1.5;color:var(--ah-muted);padding-left:12px;border-left:3px solid var(--ah-green)}

/* steps timeline */
.ah-blog .ah-steps{list-style:none;padding:0;margin:1.4em 0 2em;counter-reset:ah-s}
.ah-blog .ah-steps__item{position:relative;padding:0 0 24px 58px;margin:0;counter-increment:ah-s}
.ah-steps__item::before{content:counter(ah-s);position:absolute;left:0;top:-3px;width:40px;height:40px;border-radius:50%;background:var(--ah-green);color:#111;font:800 16px/1 var(--ah-font);display:grid;place-items:center;box-shadow:0 0 0 4px var(--ah-green-soft)}
.ah-steps__item::after{content:"";position:absolute;left:19px;top:42px;bottom:0;width:2px;background:var(--ah-line)}
.ah-steps__item:last-child{padding-bottom:4px}
.ah-steps__item:last-child::after{display:none}
.ah-steps__text{padding-top:6px}

/* icon cards */
.ah-blog .ah-cards{list-style:none;padding:0;margin:1.4em 0 2em;display:grid;gap:14px;grid-template-columns:1fr}
@media(min-width:640px){.ah-blog .ah-cards{grid-template-columns:1fr 1fr}}
.ah-blog .ah-cards__item{margin:0;display:flex;gap:14px;align-items:flex-start;background:var(--ah-tint);border:1px solid var(--ah-line);border-radius:14px;padding:16px 18px;transition:transform .2s,box-shadow .2s}
.ah-blog .ah-cards__item:hover{transform:translateY(-3px);box-shadow:0 10px 24px rgba(20,30,10,.08)}
.ah-cards__icon{flex:none;width:34px;height:34px;border-radius:50%;background:var(--ah-green);color:#111;display:grid;place-items:center}
.ah-cards__text{font-size:.96em;line-height:1.6}
.ah-cards__text strong{display:block;color:var(--ah-ink);margin-bottom:2px}

/* call to action band */
.ah-cta{display:flex;flex-wrap:wrap;gap:20px 32px;align-items:center;justify-content:space-between;margin:2.6em 0;padding:28px 26px;border-radius:18px;color:#fff;background:var(--ah-dark) radial-gradient(circle at 88% 15%,rgba(174,205,56,.32),transparent 46%)}
.ah-cta__text{flex:1 1 320px}
.ah-cta__line{margin:0;font:600 1.15rem/1.45 var(--ah-font);color:#fff}
.ah-cta__actions{display:flex;flex-wrap:wrap;gap:12px 20px;align-items:center}
.ah-blog .ah-body .ah-cta a.ah-phone{color:#fff;font-weight:600;text-decoration:none;background:none}
.ah-blog .ah-body .ah-cta a.ah-phone:hover{color:var(--ah-green)}
.ah-blog .ah-body .ah-cta a.ah-btn{color:#111;font-weight:500;text-decoration:none}
.ah-blog .ah-body .ah-cta a.ah-btn:hover{background:#fff}
.ah-blog .ah-body .wp-block-button__link,.ah-blog .ah-body .wp-block-button a{display:inline-flex;align-items:center;gap:8px;background:var(--ah-green);color:#111;border:1px solid var(--ah-green);border-radius:6px;padding:13px 22px;font:500 14px/1.3 var(--ah-font-btn);text-transform:uppercase;letter-spacing:.02em;text-decoration:none;transition:transform .2s,box-shadow .2s,background .2s}
.ah-blog .ah-body .wp-block-button__link:hover,.ah-blog .ah-body .wp-block-button a:hover{background:#fff;color:#111;transform:translateY(-2px);box-shadow:0 10px 22px rgba(0,0,0,.14)}

/* faq */
.ah-faq{display:grid;gap:12px;margin:1.2em 0 2em}
.ah-faq__item{background:#fff;border:1px solid var(--ah-line);border-radius:16px;padding:20px 22px;box-shadow:0 2px 6px rgba(20,30,10,.04)}
.ah-blog .ah-faq__q{font:700 1.15rem/1.35 var(--ah-font);margin:0 0 8px;padding-left:14px;border-left:3px solid var(--ah-green);color:var(--ah-ink)}
.ah-blog .ah-faq__a p{margin:0 0 .6em}
.ah-blog .ah-faq__a p:last-child{margin-bottom:0}

/* after the article */
.ah-after{padding-top:40px}
.ah-related__card{display:grid;grid-template-columns:1fr;overflow:hidden;border:1px solid var(--ah-line);border-radius:18px;background:var(--ah-tint)}
.ah-related__media{display:block;background:var(--ah-green-soft)}
.ah-related__media img{display:block;width:100%;height:100%;object-fit:cover;min-height:220px}
.ah-related__text{padding:26px}
.ah-related__text p{margin:0 0 18px;line-height:1.6}
@media(min-width:720px){.ah-related__card{grid-template-columns:5fr 6fr}}
.ah-minis{margin-top:22px}
.ah-minis__grid{display:grid;gap:12px;grid-template-columns:1fr}
@media(min-width:640px){.ah-minis__grid{grid-template-columns:repeat(3,1fr)}}
.ah-blog .ah-mini{display:flex;gap:12px;align-items:center;padding:14px 16px;border:1px solid var(--ah-line);border-radius:12px;background:#fff;color:var(--ah-ink);font-weight:600;font-size:15px;line-height:1.35;text-decoration:none;transition:transform .2s,box-shadow .2s}
.ah-blog .ah-mini:hover{transform:translateY(-3px);box-shadow:0 10px 24px rgba(20,30,10,.08)}
.ah-mini__icon{flex:none;width:34px;height:34px;border-radius:50%;background:var(--ah-green-soft);display:grid;place-items:center;color:var(--ah-green-dark)}
.ah-author-card{display:flex;flex-wrap:wrap;gap:24px;align-items:flex-start;margin:28px 0 0;padding:28px;border:1px solid var(--ah-line);border-radius:18px;background:#fff}
.ah-author-card__photo{width:120px;height:120px}
.ah-author-card__photo--mono{font-size:34px}
.ah-author-card__text{flex:1 1 320px}
.ah-author-card__text p{margin:0 0 14px;line-height:1.65}
.ah-author-card__role{font-weight:600;color:var(--ah-green-dark)}

/* cards and grids */
.ah-grid{display:grid;gap:22px;grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr))}
.ah-card{display:flex;flex-direction:column;background:#fff;border:1px solid var(--ah-line);border-radius:18px;overflow:hidden;transition:transform .25s ease,box-shadow .25s ease}
.ah-card:hover{transform:translateY(-5px);box-shadow:var(--ah-shadow)}
.ah-card__media{display:block;aspect-ratio:16/9;background:var(--ah-green-soft);overflow:hidden}
.ah-card__img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .5s ease}
.ah-card:hover .ah-card__img{transform:scale(1.04)}
.ah-card__blank{display:grid;place-items:center;height:100%;background:linear-gradient(160deg,var(--ah-green-soft),#fff)}
.ah-card__blank img{width:56px;height:auto;opacity:.9}
.ah-card__body{padding:18px 20px 20px;display:grid;gap:10px;align-content:start;justify-items:start}
.ah-blog .ah-card__title{font:700 1.15rem/1.3 var(--ah-font);margin:0;color:var(--ah-ink)}
.ah-blog .ah-card__title a{color:var(--ah-ink);text-decoration:none}
.ah-card:hover .ah-card__title a{text-decoration:underline;text-decoration-color:var(--ah-green);text-decoration-thickness:2px;text-underline-offset:3px}
.ah-card__excerpt{margin:0;color:var(--ah-text);font-size:15px;line-height:1.6}
.ah-card__meta{margin:2px 0 0;display:flex;flex-wrap:wrap;gap:4px 12px;font-size:13px;color:var(--ah-muted)}
@media(min-width:1024px){.ah-grid--index .ah-card--big{grid-column:span 2}.ah-card--big .ah-card__media{aspect-ratio:2/1}.ah-blog .ah-card--big .ah-card__title{font-size:clamp(1.3rem,2.2vw,1.7rem)}}
.ah-more{background:var(--ah-tint);border-top:1px solid var(--ah-line);padding:52px 0 60px;margin-top:56px}
.ah-more__head{display:flex;flex-wrap:wrap;gap:12px 24px;align-items:baseline;justify-content:space-between;margin-bottom:24px}
.ah-blog .ah-more__all{display:inline-flex;gap:6px;align-items:center;font-weight:700;color:var(--ah-ink);text-decoration:none;border-bottom:2px solid var(--ah-green)}

/* blog index */
.ah-index-hero{background:linear-gradient(160deg,var(--ah-green-soft) 0%,#fff 70%);padding:36px 0 30px;border-bottom:1px solid var(--ah-line)}
.ah-index-hero .ah-title{margin:6px 0 14px}
.ah-lead{font-size:1.1rem;line-height:1.6;max-width:720px;margin:0;color:var(--ah-text)}
.ah-strip{display:flex;flex-wrap:wrap;align-items:center;gap:12px 14px;padding:14px 16px;border:1px solid var(--ah-line);border-radius:18px;background:#fff;margin-top:22px;animation:ah-rise .55s cubic-bezier(.2,.7,.2,1) both}
.ah-strip__who{flex:1 1 200px}
@media(min-width:640px){.ah-strip{display:inline-flex;border-radius:999px;padding:10px 18px 10px 10px}.ah-strip__who{flex:0 1 auto}.ah-blog .ah-strip__link{border-left:1px solid var(--ah-line);padding-left:14px}}
.ah-strip__name{margin:0;font-weight:700;color:var(--ah-ink);line-height:1.3}
.ah-strip__role{margin:0;font-size:13px;color:var(--ah-muted);line-height:1.3}
.ah-blog .ah-strip__link{display:inline-flex;gap:6px;align-items:center;font-weight:700;font-size:14px;color:var(--ah-ink);text-decoration:none}
.ah-index-body{padding-top:26px;padding-bottom:48px}
.ah-chips{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 26px}
.ah-blog .ah-chips a{display:inline-block;padding:9px 16px;border-radius:999px;border:1px solid var(--ah-line);background:#fff;color:var(--ah-ink);text-decoration:none;font-weight:600;font-size:14px;transition:background .2s,border-color .2s,transform .2s}
.ah-blog .ah-chips a:hover{border-color:var(--ah-green);transform:translateY(-1px)}
.ah-blog .ah-chips a[aria-current]{background:var(--ah-green);border-color:var(--ah-green)}
.ah-empty{margin:40px 0;text-align:center;color:var(--ah-muted)}
.ah-blog .ast-pagination{margin:36px 0 8px}
.ah-blog .ast-pagination .nav-links{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
.ah-blog .ast-pagination .page-numbers{display:inline-flex;align-items:center;justify-content:center;min-width:42px;height:42px;padding:0 14px;border:1px solid var(--ah-line);border-radius:999px;color:var(--ah-ink);text-decoration:none;font-weight:600;font-size:14px;background:#fff}
.ah-blog .ast-pagination .page-numbers.current{background:var(--ah-green);border-color:var(--ah-green)}
.ah-blog .ast-pagination a.page-numbers:hover{border-color:var(--ah-green)}
.ah-ask{color:#fff;background:var(--ah-dark) radial-gradient(circle at 90% 10%,rgba(174,205,56,.32),transparent 46%);padding:52px 0}
.ah-ask__inner{display:flex;flex-wrap:wrap;gap:24px 40px;align-items:center;justify-content:space-between}
.ah-ask__inner>div:first-child{flex:1 1 420px}
.ah-blog .ah-ask__title{font:800 clamp(22px,2.6vw,32px)/1.25 var(--ah-font);color:#fff;margin:0 0 12px;letter-spacing:-.01em}
.ah-ask__text{margin:0;line-height:1.6;color:#E6EBDF;max-width:640px}

/* motion: reveal on scroll, reading progress. Visible without JavaScript or with reduced motion. */
.ah-progress{position:fixed;top:0;left:0;right:0;height:3px;z-index:9999;display:none;pointer-events:none}
.ah-js .ah-progress{display:block}
.ah-progress__bar{height:100%;width:100%;background:var(--ah-green);transform:scaleX(0);transform-origin:0 50%}
.ah-js .ah-reveal{opacity:0;transform:translateY(18px);transition:opacity .6s ease,transform .6s ease;animation:ah-show 0s 2.5s forwards}
.ah-js .ah-reveal.is-in{opacity:1;transform:none}
@keyframes ah-show{to{opacity:1;transform:none}}
@media(prefers-reduced-motion:reduce){html.ah-blog-page{scroll-behavior:auto}.ah-js .ah-reveal{opacity:1;transform:none;transition:none;animation:none}.ah-hero__text,.ah-strip{animation:none}.ah-blog .ah-card,.ah-blog .ah-btn,.ah-blog .ah-mini,.ah-blog .ah-cards__item,.ah-card__img{transition:none}.ah-card:hover,.ah-blog .ah-btn:hover{transform:none}.ah-card:hover .ah-card__img{transform:none}}
@media print{.ah-hero__text,.ah-strip{animation:none}.ah-progress,.ah-side-cta,.ah-cta,.ah-ask{display:none}}
`;

/** In the head, before the first paint, so revealed blocks never flash. */
export const BLOG_HEAD_JS = `if('IntersectionObserver' in window)document.documentElement.classList.add('ah-js');`;

export const BLOG_JS = `(function(){var d=document;if(!('IntersectionObserver' in window))return;
var els=d.querySelectorAll('.ah-reveal');var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('is-in');io.unobserve(e.target)}})},{rootMargin:'0px 0px -6% 0px',threshold:.06});
els.forEach(function(e){io.observe(e)});
var bar=d.querySelector('.ah-progress__bar'),art=d.querySelector('.ah-article');
if(bar&&art){var tick=false;var upd=function(){tick=false;var r=art.getBoundingClientRect();var total=r.height-innerHeight;var p=total>0?Math.min(1,Math.max(0,-r.top/total)):1;bar.style.transform='scaleX('+p+')'};addEventListener('scroll',function(){if(!tick){tick=true;requestAnimationFrame(upd)}},{passive:true});upd()}
var links=d.querySelectorAll('.ah-toc--side a[href^="#"]');if(links.length){var map={};links.forEach(function(a){map[a.getAttribute('href').slice(1)]=a});
var hs=d.querySelectorAll('.ah-body h2[id]');var io2=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){links.forEach(function(a){a.classList.remove('is-current')});var a=map[e.target.id];if(a)a.classList.add('is-current')}})},{rootMargin:'-15% 0px -70% 0px'});hs.forEach(function(h){io2.observe(h)})}
})();`;

/** Adds the blog stylesheet, the hero preload and the two scripts to a rendered page. */
export function injectBlogAssets(html: string, headLinks = ""): string {
  let out = html.replace(/<html\b([^>]*)>/i, (m, attrs: string) => (/\bclass="/.test(attrs) ? m.replace(/class="([^"]*)"/, 'class="$1 ah-blog-page"') : `<html${attrs} class="ah-blog-page">`));
  out = out.replace("</head>", `${headLinks}<style id="ah-blog-css">${BLOG_CSS}</style><script>${BLOG_HEAD_JS}</script></head>`);
  out = out.replace("</body>", `<script id="ah-blog-js">${BLOG_JS}</script></body>`);
  return out;
}
