/**
 * TTR-1341 staging edits to the built-in copy (content/seed.json), from Kia's answers of Nov 8-9, 2026:
 *   - no "licensed" or "certified" claims about Alpha (the badges say "Fully insured"),
 *   - no ICPI "Certified Craftsmanship" blocks (Alpha is not ICPI certified),
 *   - business address 1813 Peck Ln, Cheshire, CT 06410 in the contact block and the business schema.
 * General advice in blog posts ("hire a licensed plumber") is not a claim about Alpha and is left alone.
 *
 *   npm run staging-edits            # dry run: lists every change, writes nothing
 *   npm run staging-edits -- --apply # writes content/seed.json
 *
 * Idempotent. Sanity is NOT changed by this script; the live site reads Sanity, so the same edits must be
 * published there (after Kia's go) with a write token.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const FILE = join(new URL("..", import.meta.url).pathname, "content/seed.json");
const apply = process.argv.includes("--apply");
type Node = { [k: string]: unknown };
const docs: Node[] = JSON.parse(readFileSync(FILE, "utf8"));
const log: string[] = [];

/** [find, replace, only these documents (empty = every document)] */
const TEXT: [string, string, string[]][] = [
  ["Fully Licensed &amp; Insured", "Fully Insured", []],
  ["Licensed & Insured", "Fully Insured", []],
  ["Licensed &amp; Insured", "Fully Insured", []],
  ["Certified &amp; Insured:", "Fully Insured:", []],
  ["Fully insured and certified, we prioritize", "Fully insured, we prioritize", []],
  ["our licensed team of masonry and landscaping professionals", "our team of masonry and landscaping professionals", []],
  ["Alpha Hardscapes is fully licensed and insured, giving", "Alpha Hardscapes is fully insured, giving", []],
  ["Backed by a licensed, insured team", "Backed by an insured team", []],
  ["Alpha Hardscapes has a local portfolio and licensed crews", "Alpha Hardscapes has a local portfolio and crews", []],
  // The two FAQ pages (question, answer and the FAQ structured data). Not the buyer's checklist in the pavers guide post.
  ["Are you licensed and insured?", "Are you insured?", ["page-1870", "page-66"]],
  ["Yes, Alpha Hardscapes is fully licensed and insured in Connecticut,", "Yes, Alpha Hardscapes is fully insured,", ["page-1870", "page-66"]],
  ["<strong>Southern Connecticut</strong><br>USA", "<strong>1813 Peck Ln, Cheshire, CT 06410</strong>", []],
];

function walk(v: unknown, id: string, path: string): unknown {
  if (typeof v === "string") {
    let out = v;
    for (const [from, to, only] of TEXT) {
      if (only.length && !only.includes(id)) continue;
      if (out.includes(from)) {
        out = out.split(from).join(to);
        log.push(`${id} ${path.slice(-70)}: "${from}" -> "${to}"`);
      }
    }
    return out;
  }
  if (Array.isArray(v)) {
    const kept = v.filter((c) => {
      const box = c && typeof c === "object" && ((c as Node).children as Node[] | undefined)?.length === 1 ? ((c as Node).children as Node[])[0] : null;
      const hit = box && /Certified Craftsmanship/.test(String(box.titleHtml || box.title || ""));
      if (hit) log.push(`${id} ${path.slice(-70)}: REMOVED block "Certified Craftsmanship" (ICPI)`);
      return !hit;
    });
    return kept.map((c, i) => walk(c, id, `${path}/${i}`));
  }
  if (v && typeof v === "object") {
    const o = v as Node;
    if (id === "siteSettings" && path === "/businessSchema.address") return o;
    for (const k of Object.keys(o)) o[k] = walk(o[k], id, `${path}/${k}`);
  }
  return v;
}

for (const d of docs) {
  walk(d, d._id as string, "");
  if (d._id === "siteSettings" && typeof d.businessSchema === "string") {
    const bs = JSON.parse(d.businessSchema);
    if (bs.address && bs.address.streetAddress !== "1813 Peck Ln") {
      bs.address = { "@type": "PostalAddress", streetAddress: "1813 Peck Ln", addressLocality: "Cheshire", addressRegion: "CT", postalCode: "06410", addressCountry: "US" };
      d.businessSchema = JSON.stringify(bs, null, 2);
      log.push("siteSettings businessSchema.address: New Haven 06510 -> 1813 Peck Ln, Cheshire, CT 06410");
    }
  }
}

console.log(log.join("\n"));
console.log(`\n${log.length} change(s) ${apply ? "written to content/seed.json" : "found (dry run, nothing written; add --apply)"}.`);
if (apply && log.length) writeFileSync(FILE, JSON.stringify(docs, null, 1));
