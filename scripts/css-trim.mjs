/**
 * Trims a stylesheet bundle to the rules its pages can use (TTR-2999, phone speed). Every page loads
 * one bundle of about 600 KB, mostly Elementor rules written for other pages; the browser must fetch
 * and parse all of it before the first paint.
 *
 * A rule is kept when every class and id in one of its selectors appears in the words the site can put
 * on those pages: their skeletons, their CMS documents, the header, footer and popup templates, the
 * site's renderer code and every script in /public (scripts add classes while a page runs: menus,
 * sliders, the sticky header). Pseudo-classes and pseudo-elements (:hover, :focus, ::before) and
 * attribute selectors are not checked, so a rule's states and decorations stay with it. Element-only
 * selectors, @font-face, @keyframes and custom properties are always kept.
 *
 * Plain JavaScript, like scripts/css-bundles.mjs, which calls it.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const postcss = require("postcss");

const WORD = /[A-Za-z_][\w-]*/g;
const PSEUDO = /::?[a-zA-Z-]+(?:\((?:[^()]|\([^()]*\))*\))?/g;

function files(dir, test, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) files(p, test, out);
    else if (test.test(p)) out.push(p);
  }
  return out;
}

/** Words every page can show whatever its content: scripts, renderer code, templates and settings. */
export function sharedWords(root, seed) {
  const words = new Set();
  const add = (text) => {
    for (const w of text.match(WORD) || []) words.add(w);
  };
  for (const f of files(join(root, "public"), /\.js$/)) add(readFileSync(f, "utf8"));
  for (const dir of ["lib/render", "lib/site"]) for (const f of files(join(root, dir), /\.ts$/)) add(readFileSync(f, "utf8"));
  for (const doc of seed) if (doc._type === "elementorTemplate" || doc._type === "siteSettings") add(JSON.stringify(doc));
  return words;
}

export function wordsOf(texts, base) {
  const words = new Set(base);
  for (const t of texts) for (const w of t.match(WORD) || []) words.add(w);
  return words;
}

export function keepSelector(selector, words) {
  const bare = selector.replace(/\[[^\]]*\]/g, "").replace(PSEUDO, "");
  for (const m of bare.matchAll(/([.#])(-?[_a-zA-Z][\w-]*)/g)) if (!words.has(m[2])) return false;
  return true;
}

export function trimCss(css, words) {
  const root = postcss.parse(css);
  root.walkRules((rule) => {
    if (rule.parent?.type === "atrule" && /keyframes$/i.test(rule.parent.name)) return;
    const kept = rule.selectors.filter((s) => keepSelector(s, words));
    if (!kept.length) rule.remove();
    else if (kept.length !== rule.selectors.length) rule.selectors = kept;
  });
  root.walkAtRules((at) => {
    if (/^(media|supports|container|layer)$/i.test(at.name) && at.nodes && !at.nodes.length) at.remove();
  });
  return root.toString();
}
