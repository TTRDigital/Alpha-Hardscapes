/**
 * One stylesheet per page instead of 22 to 26. Each page skeleton
 * (lib/generated/shells.json) loads its stylesheets from public/assets/css one
 * by one, all render-blocking; on a phone that held the first paint at 3.5 s
 * (Lighthouse, October 26, 2026; 1.3 s with one file). This joins each
 * skeleton's list, in the same order, into public/assets/css/b-<hash>.css, and
 * lib/site/tune.ts swaps the links for the bundle when the page is served.
 *
 *   node scripts/css-bundles.mjs     # also run by next.config.ts on every build and dev server
 *
 * Plain JavaScript (no type stripping) so it runs on any Node the host builds
 * with. The bundles are build output (git-ignored): their names change with
 * their content, so the year-long cache on /assets is safe. Each bundle gets a
 * marker, b-<hash>.css.ok, written after it and holding its path: pages use a
 * bundle only once its marker is served (lib/site/bundles.ts). The list ->
 * bundle map is written to lib/generated/css-bundles.json.
 *
 * Any error (a missing stylesheet, a file that did not write) exits with an
 * error, and next.config.ts stops the build: it never deploys half-made bundles.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const CSS_DIR = join(ROOT, "public/assets/css");
const OUT = join(ROOT, "lib/generated/css-bundles.json");
const LINK = /<link rel="stylesheet"(?: id="[^"]*")? href="(\/assets\/css\/[a-z0-9-]+\.css)" media="all">/g;

function main() {
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
      hrefs.map((h) => `/* ${h} */\n${readFileSync(join(ROOT, "public", h), "utf8").replace(/^\uFEFF?\s*@charset\s+["'][^"']*["'];?/i, "")}`).join("\n");
    const name = `b-${createHash("sha256").update(css).digest("hex").slice(0, 12)}.css`;
    const path = `/assets/css/${name}`;
    writeFileSync(join(CSS_DIR, name), css);
    if (readFileSync(join(CSS_DIR, name), "utf8") !== css) throw new Error(`${name} did not write correctly`);
    writeFileSync(join(CSS_DIR, `${name}.ok`), path);
    keep.add(name);
    map[key] = path;
  }
  if (Object.keys(shells).length && !keep.size) throw new Error("no stylesheet bundles made: the skeletons' stylesheet links did not match");

  // Bundles from earlier builds whose content changed.
  for (const f of readdirSync(CSS_DIR)) {
    const m = /^(b-[0-9a-f]{12}\.css)(\.ok)?$/.exec(f);
    if (m && !keep.has(m[1])) unlinkSync(join(CSS_DIR, f));
  }

  writeFileSync(OUT, `${JSON.stringify(map, null, 0)}\n`);
  console.log(`${keep.size} stylesheet bundles -> public/assets/css, map -> ${OUT}`);
}

try {
  main();
} catch (err) {
  console.error(`css-bundles: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
}
