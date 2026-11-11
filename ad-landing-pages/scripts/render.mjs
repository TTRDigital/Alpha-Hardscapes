// Renders one landing page (content object) to a full HTML document. No dependencies.
// Content strings are plain text with three tiny marks: "\n" = line break, **bold**, [[highlight]].
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const attr = (s) => esc(s).replace(/"/g, "&quot;");
const t = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\[\[(.+?)\]\]/g, '<span class="hl">$1</span>').replace(/\n/g, "<br>");
const ico = (n) => `<svg><use href="#i-${attr(n)}"/></svg>`;
const SAFE_URL = (u) => (/^(https:\/\/|\/|#|tel:)/.test(u) ? u : "#");

export const TRACKING = { awId: "AW-16968251670", formLabel: "RJK6COyQ89YcEJbyi5s_", phoneLabel: "wQkzCO-Q89YcEJbyi5s_" };
const OS_FORM = "/api/season-lead"; // posts to TTR OS (/api/site/form) and the GHL webhook, see api/season-lead.ts

export function render(c, { css, icons, script }) {
  const ph = c.phone, tel = (cls = "btn", label = "Call Us", icon = true) =>
    `<a class="${cls}" href="tel:${attr(ph.tel)}" data-phone-link>${t(label)}${icon ? " " + ico("phone") : ""}</a>`;
  const h = c.hero;
  const heroHtml = `<section class="hero">
  <div class="hero-bg"><img src="${attr(h.image)}" alt="${attr(h.imageAlt)}"></div>
  <div class="wrap">
    <div class="copy">
      ${h.eyebrow ? `<span class="eyebrow">${t(h.eyebrow)}</span>` : ""}
      <h1>${t(h.headline)}</h1>
      ${h.paragraphs.map((p) => `<p>${t(p)}</p>`).join("\n      ")}
      ${h.heroButtons ? `<div class="hero-btns"><a class="btn" href="tel:${attr(ph.tel)}" data-phone-link>${ico("phone")} <span data-phone-text>${esc(ph.display)}</span></a>${h.galleryLabel ? `<a class="btn ghost" href="#gallery">${t(h.galleryLabel)}</a>` : ""}</div>` : ""}
    </div>
    <div class="quote" id="quote-form">
      <h2>${t(h.formTitle)}</h2>
      <form id="lead-form" action="${OS_FORM}" method="post">
        <input name="fullName" placeholder="Full Name" autocomplete="name" required>
        <input type="email" name="email" placeholder="Email*" autocomplete="email" required>
        <input type="tel" name="phone" placeholder="Phone*" autocomplete="tel" required>
        <input name="projectAddress" placeholder="Project Address" autocomplete="street-address">
        <input type="hidden" name="source" value="${attr(h.source)}">
        <input type="hidden" name="page" value="${attr(c.slug)}">
        <input type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0">
        <button class="btn" type="submit">${t(h.button)}</button>
        <p class="note">${t(h.note)}</p>
        ${h.consent ? `<p class="note consent">${t(h.consent)}</p>` : ""}
      </form>
      <div class="ok" id="form-ok">${esc(h.thanks).split("{phone}").join(`<a href="tel:${attr(ph.tel)}" data-phone-link><b data-phone-text>${esc(ph.display)}</b></a>`)}</div>
    </div>
  </div>
  <div class="torn"><img src="/images/torn-edge-white.png" alt=""></div>
</section>`;

  const R = {
    split: (s) => {
      const img = `<div class="media ${attr(s.imageStyle || "img-a")}"><img src="${attr(s.image)}" alt="${attr(s.imageAlt)}"></div>`;
      const body = `<div>
      <h2>${t(s.heading)}</h2>
      ${(s.paragraphs || []).map((p) => `<p>${t(p)}</p>`).join("\n      ")}
      ${s.listIntro ? `<p style="color:var(--ink);margin-bottom:20px">${t(s.listIntro)}</p>` : ""}
      ${(s.items || []).length ? `<ul class="checks">\n${s.items.map((i) => `        <li>${ico("check")}<span>${t(i)}</span></li>`).join("\n")}\n      </ul>` : ""}
      ${tel("btn", s.cta || "Call Us")}
    </div>`;
      return `<section class="split${s.first ? " first" : ""}">\n  <div class="wrap">\n    ${s.imageSide === "right" ? body + "\n    " + img : img + "\n    " + body}\n  </div>\n</section>`;
    },
    season: (s) => `<section class="season">
  <div class="wrap">
    <div>
      <h2>${t(s.heading)}</h2>
      ${s.paragraphs.map((p) => `<p>${t(p)}</p>`).join("\n      ")}
      <div class="btns">
        <a class="btn" href="#quote-form">${t(s.primaryCta)} ${ico("chev")}</a>
        <a class="btn ghost" href="tel:${attr(ph.tel)}" data-phone-link>${t(s.callCta).split(ph.display).join(`<span data-phone-text>${esc(ph.display)}</span>`)}</a>
      </div>
    </div>
    <div class="steps">
      ${s.steps.map((x, i) => `<div class="step"><b>${i + 1}</b><span>${t(x)}</span></div>`).join("\n      ")}
    </div>
  </div>
</section>`,
    benefits: (s) => `<section class="benefits">
  <div class="wrap">
    <div class="top">
      <h2>${t(s.heading)}</h2>
      <p>${t(s.intro)}</p>
    </div>
    <div class="grid3">
      ${s.items.map((i) => `<div>${ico(i.icon)}<h3>${t(i.title)}</h3><p>${t(i.text)}</p></div>`).join("\n      ")}
    </div>
    <div class="center">
      <p>${t(s.closing)}</p>
      ${tel("btn", s.cta || "Call Us")}
    </div>
  </div>
</section>`,
    projects: (s) => `<section class="projects" id="gallery">
  <div class="wrap">
    <h2>${t(s.heading)}</h2>
    <div class="gallery">
      ${s.images.map((i) => `<button type="button"><img src="${attr(i.image)}" alt="${attr(i.alt)}" loading="lazy"></button>`).join("\n      ")}
    </div>
  </div>
</section>
<div class="lightbox" id="lightbox"><button aria-label="Close">&times;</button><img alt=""></div>`,
    why: (s) => `<section class="why">
  <div class="why-bg"><img src="${attr(s.backgroundImage)}" alt=""></div>
  <div class="wrap">
    <div class="mark"><img src="${attr(s.markImage)}" alt="${attr(s.markAlt)}"></div>
    <div>
      <h2>${t(s.heading)}</h2>
      <p class="intro">${t(s.intro)}</p>
      <div class="slider" id="why-slider">
        ${s.cards.map((i) => `<div class="card">${ico(i.icon)}<h3>${t(i.title)}</h3><p>${t(i.text)}</p></div>`).join("\n        ")}
      </div>
      <div class="arrows">
        <button type="button" data-dir="-1" aria-label="Previous">${ico("left")}</button>
        <button type="button" data-dir="1" aria-label="Next">${ico("right")}</button>
      </div>
    </div>
  </div>
</section>`,
    reviews: (s) => `<section class="reviews">
  <div class="wrap">
    <div class="head">
      <div>
        <h2>${t(s.heading)}</h2>
        ${s.intro ? `<p>${t(s.intro)}</p>` : ""}
      </div>
      ${s.moreUrl ? `<a class="btn" href="${attr(SAFE_URL(s.moreUrl))}" target="_blank" rel="noopener">${t(s.moreLabel)}</a>` : ""}
    </div>
    <div class="revs n${s.items.length}">
      ${s.items.map((i) => `<div class="rev"><div class="who">${i.image ? `<img class="av" src="${attr(i.image)}" alt="" loading="lazy">` : `<div class="av">${esc(i.initial)}</div>`}${i.name ? `<div><h4>${t(i.name)}</h4>${i.stars === false ? "" : `<div class="stars">&#9733;&#9733;&#9733;&#9733;&#9733;</div>`}</div>` : ""}</div><p>"${t(i.text)}"</p></div>`).join("\n      ")}
    </div>
  </div>
</section>`,
    bar: (s) => `<section class="bar"><div class="wrap">${s.items.map((i) => `<span>${t(i)}</span>`).join("")}</div></section>`,
    about: (s) => `<section class="area">
  <div class="wrap">
    <h2>${t(s.heading)}</h2>
    <p style="margin-bottom:0">${t(s.text)}</p>
  </div>
</section>`,
    area: (s) => `<section class="area">
  <div class="wrap">
    <h2>${t(s.heading)}</h2>
    <p>${t(s.text)}</p>
    <div class="pills">
      <div class="pill"><i>${ico("pin")}</i>${t(s.pill)}</div>
      <a class="pill" href="tel:${attr(ph.tel)}" data-phone-link><i>${ico("phone")}</i><span data-phone-text>${esc(ph.display)}</span></a>
    </div>
  </div>
</section>`,
    faq: (s) => `<section class="faq">
  <div class="wrap">
    <h2>${t(s.heading)}</h2>
    ${s.items.map((i) => `<details${i.open ? " open" : ""}><summary>${t(i.q)}</summary><p>${t(i.a)}</p></details>`).join("\n    ")}
  </div>
</section>`,
    final: (s) => `<section class="final">
  <div class="under"><img src="/images/torn-edge-lime.png" alt=""><div></div></div>
  <div class="wrap">
    <div class="cta">
      <div class="pic"><img src="${attr(s.image)}" alt="${attr(s.imageAlt)}"></div>
      <div class="txt">
        <h2>${t(s.heading)}</h2>
        ${s.text ? `<p>${t(s.text)}</p>` : ""}
        <div class="btns">
          <a class="btn" href="#quote-form">${t(s.primaryCta)} ${ico("chev")}</a>
          <a class="btn ghost" href="tel:${attr(ph.tel)}" data-phone-link>${t(s.callCta)}</a>
        </div>
      </div>
    </div>
    <footer>
      <div class="row">
        <img src="${attr(s.footerLogo)}" alt="Alpha Hardscapes logo">
        <nav><a href="#quote-form">${t(s.footerLinks[0])}</a><a href="tel:${attr(ph.tel)}" data-phone-link>${t(s.footerLinks[1])}</a></nav>
      </div>
      ${s.address || s.email ? `<p class="contact">${[s.address ? esc(s.address) : "", s.email ? `<a href="mailto:${attr(s.email)}">${esc(s.email)}</a>` : ""].filter(Boolean).join(" &nbsp;|&nbsp; ")}</p>` : ""}
      <hr>
      <small>${esc(s.copyright)} &nbsp;|&nbsp; <a href="${attr(SAFE_URL(s.privacyUrl))}">${t(s.privacyLabel)}</a></small>
    </footer>
  </div>
</section>`,
  };

  const secs = c.sections.map((s) => {
    const f = R[s.type];
    if (!f) throw new Error(`Unknown section type "${s.type}" on page ${c.slug}`);
    return f(s);
  });
  const head = c.header;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex, nofollow">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(c.title)}</title>
<meta name="description" content="${attr(c.description)}">
<meta property="og:title" content="${attr(c.ogTitle || c.title)}">
<meta property="og:description" content="${attr(c.ogDescription || c.description)}">
<meta property="og:image" content="${attr(c.ogImage || h.image)}">
<link rel="icon" href="/images/logo.png">

<!-- Google Ads tag, account 816-147-4744 -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${TRACKING.awId}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${TRACKING.awId}');</script>
<!-- Call number: /number.js (Pro Wildlife version, Alpha site key); inert until the number pool exists in TTR OS. -->
<script src="/number.js" defer></script>

<style>
${css}
</style>
</head>
<body>

<!-- Icon sprite -->
${icons}

<header>
  <div class="wrap">
    <a href="#top"><img class="logo" src="${attr(head.logo)}" alt="${attr(head.logoAlt)}"></a>
    <div class="head-right">
      <a class="head-phone" href="tel:${attr(ph.tel)}" data-phone-link>${ico("phone")}<span data-phone-text>${esc(ph.display)}</span></a>
      <a class="btn" href="#quote-form"><span class="long">${t(head.ctaLong)}</span><span class="short">${t(head.ctaShort)}</span>${ico("chev")}</a>
    </div>
  </div>
</header>

<main id="top">
${heroHtml}

${secs.join("\n\n")}

</main>

<div class="mbar">
  <a class="btn call" href="tel:${attr(ph.tel)}" data-phone-link>${ico("phone")} ${t(c.mobileBar.call)}</a>
  <a class="btn" href="#quote-form">${t(c.mobileBar.quote)}</a>
</div>

<script>
var TRACK=${JSON.stringify({ form: `${TRACKING.awId}/${TRACKING.formLabel}`, phone: `${TRACKING.awId}/${TRACKING.phoneLabel}`, button: h.button })};
${script}
</script>
</body>
</html>
`;
}
