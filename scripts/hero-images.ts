/**
 * Background images of Elementor sections, read from the per-page stylesheets
 * (public/assets/css/post-*.css) into lib/generated/hero-images.json, so the
 * page route can preload the first section's background: the largest paint on
 * most pages, which the browser otherwise finds only after every stylesheet
 * has loaded (6 s late on phones, Lighthouse, October 22, 2026).
 *
 *   npm run hero-images
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const dir = join(ROOT, "public/assets/css");
const out = join(ROOT, "lib/generated/hero-images.json");

const map: Record<string, string> = {};
for (const file of readdirSync(dir).filter((f) => /^post-\d+\.css$/.test(f)).sort()) {
  // Only rules that apply on every screen: the media-query blocks are dropped.
  const css = readFileSync(join(dir, file), "utf8").replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*\s*\}/g, "");
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const id = /\.elementor-element-([0-9a-f]+)/.exec(m[1])?.[1];
    const url = /background-image:url\(["']?([^"')]+)["']?\)/.exec(m[2])?.[1];
    if (id && url && !(id in map)) map[id] = url;
  }
}
writeFileSync(out, `${JSON.stringify(map, null, 0)}\n`);
console.log(`${Object.keys(map).length} sections with a background image -> ${out}`);
