/**
 * One stylesheet per page instead of 22 to 26. Each page skeleton
 * (lib/generated/shells.json) loads its stylesheets from public/assets/css one
 * by one, all render-blocking; on a phone that held the first paint at 3.5 s
 * (Lighthouse, October 26, 2026; 1.3 s with one file). This joins each
 * skeleton's list, in the same order, into public/assets/css/b-<hash>.css, and
 * lib/site/tune.ts swaps the links for the bundle when the page is served.
 *
 *   node scripts/css-bundles.mjs     # runs before every `npm run build` and `npm run dev`
 *
 * Plain JavaScript (no type stripping) so it runs on any Node the host builds
 * with. The bundles are build output (git-ignored): their names change with
 * their content, so the year-long cache on /assets is safe. The list ->
 * bundle map is written to lib/generated/css-bundles.json.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const CSS_DIR = join(ROOT, "public/assets/css");
const OUT = join(ROOT, "lib/generated/css-bundles.json");
const LINK = /<link rel="stylesheet"(?: id="[^"]*")? href="(\/assets\/css\/[a-z0-9-]+\.css)" media="all">/g;

const shells = JSON.parse(readFileSync(join(ROOT, "lib/generated/shells.json"), "utf8"));
const map = {};
const keep = new Set();

for (const shell of Object.values(shells)) {
  const head = shell.slice(0, shell.indexOf("</head>"));
  const hrefs = [...head.matchAll(LINK)].map((m) => m[1]);
  if (hrefs.length < 2) continue;
  const key = hrefs.join("|");
  if (map[key]) continue;
  // @charset is only valid as the first rule: one at the top, the files' own are dropped.
  const css =
    '@charset "UTF-8";\n' +
    hrefs.map((h) => `/* ${h} */\n${readFileSync(join(ROOT, "public", h), "utf8").replace(/^﻿?\s*@charset\s+["'][^"']*["'];?/i, "")}`).join("\n");
  const name = `b-${createHash("sha256").update(css).digest("hex").slice(0, 12)}.css`;
  writeFileSync(join(CSS_DIR, name), css);
  keep.add(name);
  map[key] = `/assets/css/${name}`;
}

// Bundles from earlier builds whose content changed.
for (const f of readdirSync(CSS_DIR)) if (/^b-[0-9a-f]{12}\.css$/.test(f) && !keep.has(f)) unlinkSync(join(CSS_DIR, f));

writeFileSync(OUT, `${JSON.stringify(map, null, 0)}\n`);
console.log(`${keep.size} stylesheet bundles -> public/assets/css, map -> ${OUT}`);
