/**
 * Loads content/seed.json into Sanity.
 *
 *   SANITY_WRITE_TOKEN=... npm run seed              # only adds missing documents
 *   SANITY_WRITE_TOKEN=... npm run seed -- --force   # overwrites the CMS with the built-in content
 *   npm run seed -- --dry-run                        # validates without writing
 *
 * Images stay where they are (public/wp-content/uploads, same URLs as the
 * old site); editors replace an image with the "Replace image" upload.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
import { dataset, projectId } from "../sanity/env.ts";
const token = process.env.SANITY_WRITE_TOKEN;
const force = process.argv.includes("--force");
const dryRun = process.argv.includes("--dry-run");

if (!token && !dryRun) {
  console.error("Set SANITY_WRITE_TOKEN (an Editor token from sanity.io/manage > API > Tokens).");
  process.exit(1);
}

const docs: { _id: string; _type: string }[] = JSON.parse(readFileSync(join(ROOT, "content/seed.json"), "utf8"));
const url = `https://api.sanity.io/v2024-01-01/projects/${projectId}/datasets/${dataset}/mutate${dryRun ? "?dryRun=true" : ""}`;

// Keep each request well under Sanity's payload limit.
const batches: unknown[][] = [];
let current: unknown[] = [];
let size = 0;
for (const doc of docs) {
  const m = force ? { createOrReplace: doc } : { createIfNotExists: doc };
  const s = JSON.stringify(m).length;
  if (current.length && size + s > Number(process.env.SEED_BATCH_BYTES || 2_000_000)) {
    batches.push(current);
    current = [];
    size = 0;
  }
  current.push(m);
  size += s;
}
if (current.length) batches.push(current);

let n = 0;
for (const mutations of batches) {
  if (dryRun && !token) {
    n += mutations.length;
    continue;
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ mutations }),
  });
  if (!res.ok) {
    console.error(`Sanity answered ${res.status}: ${(await res.text()).slice(0, 500)}`);
    process.exit(1);
  }
  n += mutations.length;
  console.log(`${dryRun ? "checked" : force ? "wrote" : "added (if missing)"} ${n}/${docs.length}`);
}
console.log(`Done: ${docs.length} documents ${dryRun ? "validated" : "sent"} to ${projectId}/${dataset}.`);
