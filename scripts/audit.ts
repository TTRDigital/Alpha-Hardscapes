/**
 * Read-only audit: what Sanity holds vs the built-in copy (content/seed.json).
 *
 *   npm run audit                 # summary
 *   npm run audit -- --details    # every differing field, per document
 *
 * Needs no token (the dataset is public) and writes nothing. It is the dry run
 * before any seed: `npm run seed` only adds missing documents, so the
 * "missing in Sanity" list is exactly what it would create. Fields that differ
 * in documents that already exist are never touched by `seed` (only
 * `seed -- --force` or `titles -- --publish` would overwrite them).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dataset, projectId } from "../sanity/env.ts";

const ROOT = new URL("..", import.meta.url).pathname;
const details = process.argv.includes("--details");
type Doc = { _id: string; _type: string; path?: string; [k: string]: unknown };

const seed: Doc[] = JSON.parse(readFileSync(join(ROOT, "content/seed.json"), "utf8"));
const res = await fetch(`https://${projectId}.api.sanity.io/v2025-02-19/data/query/${dataset}?${new URLSearchParams({ query: "*[]", perspective: "raw" })}`);
if (!res.ok) {
  console.error(`Sanity answered ${res.status}`);
  process.exit(1);
}
const sanity: Doc[] = ((await res.json()) as { result: Doc[] }).result;

const IGNORE = new Set(["_rev", "_updatedAt", "_createdAt"]);
const norm = (o: unknown): unknown =>
  Array.isArray(o)
    ? o.map(norm)
    : o && typeof o === "object"
      ? Object.fromEntries(Object.keys(o).filter((k) => !IGNORE.has(k)).sort().map((k) => [k, norm((o as Record<string, unknown>)[k])]))
      : o;
const diff = (a: unknown, b: unknown, p = "", out: string[] = []): string[] => {
  if (JSON.stringify(a) === JSON.stringify(b)) return out;
  if (a && b && typeof a === "object" && typeof b === "object" && Array.isArray(a) === Array.isArray(b)) {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) diff((a as never)[k], (b as never)[k], `${p}/${k}`, out);
  } else out.push(p);
  return out;
};

const S = new Map(sanity.map((d) => [d._id, norm(d) as Doc]));
const B = new Map(seed.map((d) => [d._id, norm(d) as Doc]));
const count = (docs: Doc[]) => docs.reduce<Record<string, number>>((m, d) => ((m[d._type] = (m[d._type] || 0) + 1), m), {});

console.log(`Sanity ${projectId}/${dataset}: ${sanity.length} documents`, count(sanity));
console.log(`Built-in copy: ${seed.length} documents`, count(seed));
const missing = seed.filter((d) => !S.has(d._id));
const extra = sanity.filter((d) => !B.has(d._id));
console.log(`\nIn the built-in copy but missing in Sanity (npm run seed would add): ${missing.length}`);
missing.forEach((d) => console.log(`  + ${d._id} (${d._type}) ${d.path || ""}`));
console.log(`In Sanity but not in the built-in copy (kept, never deleted): ${extra.length}`);
extra.forEach((d) => console.log(`  ~ ${d._id} (${d._type}) ${d.path || ""}`));

const byField: Record<string, number> = {};
const changed: { id: string; path?: string; fields: string[] }[] = [];
for (const [id, b] of B) {
  const s = S.get(id);
  if (!s) continue;
  const fields = diff(s, b);
  if (!fields.length) continue;
  changed.push({ id, path: b.path, fields });
  for (const f of fields) byField[f.replace(/\d+/g, "#")] = (byField[f.replace(/\d+/g, "#")] || 0) + 1;
}
console.log(`\nDocuments that exist in both but differ: ${changed.length} (Sanity wins; seed leaves them alone)`);
console.log("Differing fields:", byField);
if (details) changed.forEach((c) => console.log(`  ${c.id} ${c.path || ""}\n    ${c.fields.join("\n    ")}`));
