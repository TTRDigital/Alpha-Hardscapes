// Seeds content/*.json into Sanity project 7ysj6im9 as "landingPage" documents. Never overwrites.
//
//   node scripts/seed-sanity.mjs                 DRY RUN (default): validates, prints what would be created. With a token it also checks which ids already exist.
//   SANITY_WRITE_TOKEN=... node scripts/seed-sanity.mjs --write
//                                                creates only documents whose id does not exist yet (createIfNotExists). Existing documents are never touched.
//
// There is no --force on purpose. To change a page that is already in Sanity, edit it in the Studio.
// The token (Editor) comes from sanity.io/manage > API > Tokens and goes in the environment only, never in code or commits.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const PROJECT = "7ysj6im9", DATASET = process.env.ALPHA_SANITY_DATASET || "production", API = "2025-02-19";
const token = process.env.SANITY_WRITE_TOKEN, write = process.argv.includes("--write");
if (write && !token) { console.error("--write needs SANITY_WRITE_TOKEN in the environment. Nothing written."); process.exit(1); }

const cap = (s) => s[0].toUpperCase() + s.slice(1);
const key = (slug, i) => `${slug}-${i}`;
function toDoc(c) {
  const { slug, sections, ...rest } = c;
  return {
    _id: `landingPage.${slug}`, _type: "landingPage", slug: { _type: "slug", current: slug }, ...rest,
    sections: sections.map(({ type, ...s }, i) => ({ _type: `lp${cap(type)}`, _key: key(slug, i), ...s })),
  };
}
const docs = readdirSync(join(ROOT, "content")).filter((f) => f.endsWith(".json")).map((f) => toDoc(JSON.parse(readFileSync(join(ROOT, "content", f), "utf8"))));

for (const d of docs) {
  if (!d.slug.current || !d.title || !d.hero || !d.sections.length) throw new Error(`${d._id}: incomplete`);
  console.log(`${d._id}  "${d.title}"  ${d.sections.length} sections  ${(JSON.stringify(d).length / 1024).toFixed(1)} KB`);
}

const base = `https://${PROJECT}.api.sanity.io/v${API}`;
const auth = token ? { authorization: `Bearer ${token}` } : null;
let existing = null;
if (auth) {
  const q = encodeURIComponent(`*[_id in ${JSON.stringify(docs.map((d) => d._id))}]._id`);
  const r = await fetch(`${base}/data/query/${DATASET}?query=${q}`, { headers: auth });
  if (!r.ok) { console.error(`Could not read Sanity (HTTP ${r.status}). Nothing written.`); process.exit(1); }
  existing = new Set((await r.json()).result);
}
const todo = docs.filter((d) => !(existing && existing.has(d._id)));
for (const d of docs) console.log(`  ${existing ? (existing.has(d._id) ? "EXISTS, left alone" : "would create") : "would create (existence not checked, no token)"}: ${d._id}`);

if (!write) { console.log(`\nDRY RUN. Nothing written. Re-run with SANITY_WRITE_TOKEN set and --write to create ${existing ? todo.length : docs.length} document(s).`); process.exit(0); }
if (!todo.length) { console.log("Nothing to create."); process.exit(0); }
const r = await fetch(`${base}/data/mutate/${DATASET}`, {
  method: "POST", headers: { ...auth, "content-type": "application/json" },
  body: JSON.stringify({ mutations: todo.map((d) => ({ createIfNotExists: d })) }),
});
console.log(r.ok ? `Created ${todo.length} document(s).` : `Sanity refused the write (HTTP ${r.status}): ${(await r.text()).slice(0, 300)}`);
process.exit(r.ok ? 0 : 1);
