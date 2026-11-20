/**
 * Sends only the named documents from content/seed.json to Sanity, nothing else.
 * Use it to put approved blog posts live without touching the rest of the CMS
 * (`npm run seed` would add every document Sanity is missing).
 *
 *   npm run publish-posts -- post-5106 post-5107 --dry-run   # checks, writes nothing
 *   SANITY_WRITE_TOKEN=... npm run publish-posts -- post-5106 post-5107
 *   SANITY_WRITE_TOKEN=... npm run publish-posts -- post-5106 --replace   # overwrite a copy already in Sanity
 *
 * Without --replace a document that already exists in Sanity is left as it is
 * (createIfNotExists), so edits made in the Studio are never lost. The live site
 * picks the posts up within 5 minutes (ISR), or at once through the publish webhook.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dataset, projectId } from "../sanity/env.ts";

const ROOT = new URL("..", import.meta.url).pathname;
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const replace = args.includes("--replace");
const ids = args.filter((a) => !a.startsWith("--"));
const token = process.env.SANITY_WRITE_TOKEN;

if (!ids.length) {
  console.error("Name the documents to send, e.g. npm run publish-posts -- post-5106 post-5107");
  process.exit(1);
}
if (!token && !dryRun) {
  console.error("Set SANITY_WRITE_TOKEN (an Editor token from sanity.io/manage > API > Tokens), or add --dry-run.");
  process.exit(1);
}

type Doc = { _id: string; _type: string; path?: string; title?: string; author?: { _ref?: string }; categories?: { _ref?: string }[] };
const docs: Doc[] = JSON.parse(readFileSync(join(ROOT, "content/seed.json"), "utf8"));
const byId = new Map(docs.map((d) => [d._id, d]));

const chosen: Doc[] = [];
for (const id of ids) {
  const doc = byId.get(id);
  if (!doc) {
    console.error(`${id} is not in content/seed.json`);
    process.exit(1);
  }
  // A post must point at an author and categories that exist, or it renders without them.
  const refs = [doc.author?._ref, ...(doc.categories || []).map((c) => c._ref)].filter(Boolean) as string[];
  const missing = refs.filter((r) => !byId.has(r));
  if (missing.length) {
    console.error(`${id} refers to documents that are not in content/seed.json: ${missing.join(", ")}`);
    process.exit(1);
  }
  chosen.push(doc);
  console.log(`${id}  ${doc._type}  ${doc.path ?? ""}  ${doc.title ?? ""}`);
}

const mutations = chosen.map((doc) => (replace ? { createOrReplace: doc } : { createIfNotExists: doc }));
if (dryRun && !token) {
  console.log(`Checked ${chosen.length} document(s); nothing sent (--dry-run without a token).`);
  process.exit(0);
}
const url = `https://${projectId}.api.sanity.io/v2024-01-01/data/mutate/${dataset}?returnIds=true${dryRun ? "&dryRun=true" : ""}`;
const res = await fetch(url, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ mutations }),
});
if (!res.ok) {
  console.error(`Sanity answered ${res.status}: ${(await res.text()).slice(0, 500)}`);
  process.exit(1);
}
const out = (await res.json()) as { results?: { id: string; operation: string }[] };
for (const r of out.results || []) console.log(`${dryRun ? "would " : ""}${r.operation}: ${r.id}`);
console.log(`Done: ${chosen.length} document(s) ${dryRun ? "checked against" : "sent to"} ${projectId}/${dataset}.`);
