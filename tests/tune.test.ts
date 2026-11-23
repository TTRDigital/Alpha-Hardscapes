/**
 * tuneHtml (lib/site/tune.ts): the render-time fixes from the Nov 20 sweep (TTR-2513).
 *   npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { tuneHtml } from "../lib/site/tune.ts";

const page = (body: string, head = "") => `<!doctype html><html><head>${head}</head><body><div id="content">${body}</div></body></html>`;

test("a bare relative footer link is made absolute, wording unchanged", () => {
  const out = tuneHtml(page('<a href="terms-and-conditions/" style="color: #AECD38;">Terms &amp; Conditions </a>'));
  assert.match(out, /<a href="\/terms-and-conditions\/" style="color: #AECD38;">Terms &amp; Conditions <\/a>/);
});

test("other links are left alone", () => {
  for (const href of ["/about-us/", "#top", "tel:4752276896", "mailto:a@b.c", "https://example.com/x/"]) {
    assert.ok(tuneHtml(page(`<a href="${href}">x</a>`)).includes(`<a href="${href}">x</a>`), href);
  }
});

test("decorative PNGs become the SVG copies, size and alt kept", () => {
  const out = tuneHtml(page('<img decoding="async" width="136" height="118" src="/wp-content/uploads/2025/02/filled-bg.png" alt="">'));
  assert.match(out, /src="\/assets\/img\/filled-bg\.svg"/);
  assert.match(out, /width="136" height="118"/);
  assert.match(out, /alt="Green decorative shape" aria-hidden="true"/);
  const dots = tuneHtml(page('<img width="220" height="242" src="/wp-content/uploads/2024/11/dot-grahpic.png" alt="">'));
  assert.match(dots, /src="\/assets\/img\/dot-graphic\.svg"/);
});

test("gallery tiles get an aria-label, an existing one is kept", () => {
  const out = tuneHtml(page('<a class="e-gallery-item elementor-gallery-item" href="/a.jpg"><div></div></a><a class="e-gallery-item x" href="/b.jpg" aria-label="Mine"></a>'));
  assert.match(out, /href="\/a\.jpg" aria-label="Open project photo 1 in the lightbox">/);
  assert.match(out, /aria-label="Mine"/);
  assert.doesNotMatch(out, /aria-label="Mine" aria-label/);
});

test("a phone-number icon box title leaves the heading outline, a real heading does not", () => {
  const out = tuneHtml(page('<h3 class="elementor-icon-box-title"> <a href="tel:4752276896"> (475) 227-6896 </a></h3><h3 class="elementor-icon-box-title"> <a href="/x/">Patios</a></h3>'));
  assert.match(out, /<h3 class="elementor-icon-box-title" role="none"> <a href="tel:4752276896"> \(475\) 227-6896 <\/a><\/h3>/);
  assert.match(out, /<h3 class="elementor-icon-box-title"> <a href="\/x\/">Patios<\/a><\/h3>/);
});

test("combined theme scripts carry a version", () => {
  const out = tuneHtml(page('<script defer="" src="/assets/js/82995ea43b532240f7983d2c4c237464.js"></script>'));
  assert.match(out, /src="\/assets\/js\/82995ea43b532240f7983d2c4c237464\.js\?v=\d+"/);
});

test("Poppins is preloaded with the other fonts", () => {
  const head = '<link rel="preload" as="font" href="https://fonts.gstatic.com/s/x.woff2" crossorigin="">';
  const out = tuneHtml(page("", head));
  assert.match(out, /rel="preload" as="font" type="font\/woff2" href="[^"]*poppins-[^"]*\.woff2"/);
});

test("images in the first two sections lose loading=lazy, later ones keep it", () => {
  const sec = (id: string, img: string) => `<div class="elementor-element elementor-element-${id} e-flex e-con-boxed e-con e-parent">${img}</div>`;
  const img = (n: number) => `<img loading="lazy" width="10" height="10" src="/p${n}.jpg" alt="">`;
  const out = tuneHtml(page(sec("a1", img(1)) + sec("b2", img(2)) + sec("c3", img(3))));
  assert.doesNotMatch(out, /loading="lazy"[^>]*src="\/p1\.jpg"/);
  assert.doesNotMatch(out, /loading="lazy"[^>]*src="\/p2\.jpg"/);
  assert.match(out, /loading="lazy"[^>]*src="\/p3\.jpg"/);
});

test("images from the third section down are lazy, the first two and lazysizes images are left alone", () => {
  const sec = (id: string, img: string) => `<div class="elementor-element elementor-element-${id} e-flex e-con-boxed e-con e-parent">${img}</div>`;
  const out = tuneHtml(
    page(
      sec("a1", '<img width="10" height="10" src="/p1.jpg" alt="">') +
        sec("b2", '<img width="10" height="10" src="/p2.jpg" alt="">') +
        sec("c3", '<img width="10" height="10" src="/p3.jpg" alt=""><img data-src="/p4.jpg" src="data:," alt="">'),
    ),
  );
  assert.doesNotMatch(out, /loading="lazy"[^>]*src="\/p1\.jpg"/);
  assert.doesNotMatch(out, /loading="lazy"[^>]*src="\/p2\.jpg"/);
  assert.match(out, /<img decoding="async" loading="lazy" width="10" height="10" src="\/p3\.jpg"/);
  assert.match(out, /<img data-src="\/p4\.jpg" src="data:," alt="">/);
});

test("a listed hero's background becomes a high-priority <img> with the same files and crop", () => {
  const hero =
    '<div class="elementor-element elementor-element-52d7a675 e-con-full banner-wrapper e-flex e-con e-parent" data-id="52d7a675" data-settings="{&quot;background_background&quot;:&quot;classic&quot;}"><h1>Masonry</h1></div>';
  const out = tuneHtml(page(hero));
  assert.match(out, /data-settings="[^"]*"><picture class="ah-hero-img" style="position:absolute;inset:0;[^"]*"><source media="\(max-width: 767px\)" srcset="[^"]+Masonry-banner-scaled[^"]+"><img src="[^"]+Masonry-banner-scaled[^"]+" alt="Masonry" fetchpriority="high"[^>]*object-fit:cover;object-position:center center"><\/picture><h1>/);
  assert.match(out, /<style id="hero-img">[^<]*elementor-element-52d7a675[^<]*\{background-image:none;isolation:isolate\}<\/style><\/head>/);
  assert.doesNotMatch(out, /id="hero-phone"/);
});

test("an unlisted hero keeps its CSS background", () => {
  const hero = '<div class="elementor-element elementor-element-6760925 e-con e-parent" data-settings="{&quot;background_background&quot;:&quot;classic&quot;}"></div>';
  const out = tuneHtml(page(hero));
  assert.doesNotMatch(out, /ah-hero-img/);
  assert.match(out, /rel="preload" as="image"/);
});

test("WordPress hooks and i18n helpers are deferred, in the same order", () => {
  const out = tuneHtml(page('<script id="wp-hooks-js" src="/wp-includes/js/dist/hooks.min.js"></script><script id="wp-i18n-js" src="/wp-includes/js/dist/i18n.min.js"></script>'));
  assert.match(out, /<script defer="" id="wp-hooks-js" src="\/wp-includes\/js\/dist\/hooks\.min\.js"><\/script><script defer="" id="wp-i18n-js" src="\/wp-includes\/js\/dist\/i18n\.min\.js"><\/script>/);
});
