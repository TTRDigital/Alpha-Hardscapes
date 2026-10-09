/**
 * Migration check: renders every crawled URL from content/seed.json and
 * compares it with the WordPress HTML (canonical form, see lib/normalize).
 *
 *   npm run verify -- <crawl-dir> [file-filter]
 */
import * as cheerio from "cheerio";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderDocument } from "../lib/site/render.ts";
import { buildSiteData, resolvePath, type SeedDoc } from "../lib/site/local.ts";
import { resolveLazy } from "./lib/convert.ts";
import { canonical, firstDiff } from "./lib/normalize.ts";

const SRC = process.argv[2];
const SERVER = process.argv.find((a) => a.startsWith("--server="))?.slice(9);
const FILTER = process.argv.slice(3).find((a) => !a.startsWith("--"));
if (!SRC) throw new Error("Usage: npm run verify -- <crawl-dir> [filter]");
const ROOT = new URL("..", import.meta.url).pathname;
const docs: SeedDoc[] = JSON.parse(readFileSync(join(ROOT, "content/seed.json"), "utf8"));
const data = buildSiteData(docs);

function prep(html: string) {
  const $ = cheerio.load(html);
  resolveLazy($);
  $('input[name="queried_id"], input[name="referer_title"]').attr("value", "");
  return $;
}

const htmlDir = join(SRC, "html");
let ok = 0;
const failures: string[] = [];
for (const file of readdirSync(htmlDir).filter((f) => f.endsWith(".html")).sort()) {
  if (FILTER && !file.includes(FILTER)) continue;
  const base = file.replace(/\.html$/, "");
  const path = base === "home" ? "/" : base === "_404" ? "/this-page-does-not-exist-xyz/" : `/${base.replace(/__/g, "/")}/`;
  let html: string;
  if (SERVER) {
    // Full check of a running site (reads the CMS like production does).
    html = await (await fetch(SERVER + path)).text();
  } else {
    const resolved = resolvePath(docs, path);
    if (!resolved) {
      failures.push(`${path}: not resolved`);
      continue;
    }
    html = renderDocument(resolved, data, path, { projectId: "7ysj6im9", dataset: "production" });
  }
  const a = prep(readFileSync(join(htmlDir, file), "utf8"));
  const b = prep(html);
  const ca = canonical(a("body").html() || "");
  const cb = canonical(b("body").html() || "");
  const bodyClassOk = a("body").attr("class") === b("body").attr("class");
  const d = firstDiff(ca, cb, 3);
  if (!d && bodyClassOk) {
    ok++;
    continue;
  }
  failures.push(`${path}: ${!bodyClassOk ? "body class differs; " : ""}${d ? `line ${d.line}\n  expected:\n    ${d.expected.join("\n    ")}\n  actual:\n    ${d.actual.join("\n    ")}` : ""}`);
  if (FILTER) {
    writeFileSync(`${process.env.VERIFY_OUT || "/tmp"}/verify-expected.txt`, ca);
    writeFileSync(`${process.env.VERIFY_OUT || "/tmp"}/verify-actual.txt`, cb);
  }
}
console.log(failures.join("\n\n"));
console.log(`\n${ok} identical, ${failures.length} different`);
