/**
 * Export mode: writes the site's Sanity documents and an image manifest to files, for TTR OS to load into
 * Sanity project 7ysj6im9. No token, no network, nothing is written to Sanity.
 *
 *   npm run export        # writes content/export/documents.json and content/export/image-manifest.json
 *
 * Documents come from content/seed.json (the built-in copy, including the staging edits). Each has _id and _type;
 * ids have no dots (a dotted id would be a draft or private document in Sanity). Photos are not Sanity assets:
 * they are file paths in the repository (public/...) kept as "wpImage" fields, so the manifest lists every path with
 * its size and whether the file exists. Loading the JSON therefore needs no image upload.
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const docs: { _id: string; _type: string }[] = JSON.parse(readFileSync(join(ROOT, "content/seed.json"), "utf8"));

const problems: string[] = [];
const ids = new Set<string>();
for (const d of docs) {
  if (!d._id || !d._type) problems.push(`document without _id or _type: ${JSON.stringify(d).slice(0, 80)}`);
  if (/\./.test(d._id)) problems.push(`dot in id: ${d._id}`);
  if (ids.has(d._id)) problems.push(`duplicate id: ${d._id}`);
  ids.add(d._id);
}
const refs = new Set<string>();
const paths = new Map<string, number>();
const IMG = /\/(?:wp-content|wp-includes|assets|og)\/[^\s"'()<>,\\]+\.(?:png|jpe?g|webp|gif|svg|avif|ico|mp4|webm)/gi;
const walk = (v: unknown) => {
  if (typeof v === "string") {
    for (const m of v.match(IMG) || []) paths.set(m, (paths.get(m) || 0) + 1);
  } else if (Array.isArray(v)) v.forEach(walk);
  else if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o._ref === "string") refs.add(o._ref);
    Object.values(o).forEach(walk);
  }
};
docs.forEach(walk);
const dangling = [...refs].filter((r) => !ids.has(r));

const counts: Record<string, number> = {};
for (const d of docs) counts[d._type] = (counts[d._type] || 0) + 1;

const manifest = [...paths.keys()].sort().map((p) => {
  const file = join(ROOT, "public", p.replace(/^\//, ""));
  const ok = existsSync(file);
  return { path: p, file: `public${p}`, exists: ok, bytes: ok ? statSync(file).size : null, usedIn: paths.get(p) };
});

mkdirSync(join(ROOT, "content/export"), { recursive: true });
writeFileSync(join(ROOT, "content/export/documents.json"), JSON.stringify(docs, null, 1));
writeFileSync(join(ROOT, "content/export/image-manifest.json"), JSON.stringify({ count: manifest.length, missing: manifest.filter((m) => !m.exists).map((m) => m.path), files: manifest }, null, 1));

console.log(`${docs.length} documents`, counts);
console.log(`${manifest.length} file paths in the manifest, ${manifest.filter((m) => !m.exists).length} not found in public/`);
if (dangling.length) console.log(`references to documents that do not exist (already so in Sanity): ${dangling.join(", ")}`);
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
