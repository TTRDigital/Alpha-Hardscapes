/**
 * Code pages (lib/site/codepages.ts, TTR-2432): the drafted text is on the page, nothing else is added.
 *   npm test
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { CODE_ARTICLES, codePage, markdownToBlocks } from "../lib/site/codepages.ts";
import { buildSiteData, resolvePath, type SeedDoc } from "../lib/site/local.ts";
import { renderDocument } from "../lib/site/render.ts";

const docs = JSON.parse(readFileSync("content/seed.json", "utf8")) as SeedDoc[];
const data = buildSiteData(docs);
const opts = { projectId: "7ysj6im9", dataset: "production", origin: "https://alphahardscapes.com" };
const load = async (p: string) => resolvePath(docs, p);
const plain = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "")
    .replace(/<\/(p|h[1-6]|li|div|ul|ol)>/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;|&#x27;|&apos;/g, "'")
    .replace(/\s+/g, " ");

for (const a of CODE_ARTICLES) {
  test(`${a.path} prints the drafted text, the title and no byline`, async () => {
    const r = await codePage(a.path, load);
    assert.ok(r && r.kind === "post");
    const html = renderDocument(r, data, a.path, opts);
    const text = plain(html);
    assert.match(html, new RegExp(`<h1 class="entry-title">${a.title.replace(/[()]/g, "\\$&")}</h1>`));
    assert.match(html, /<title>[^<]*<\/title>/);
    assert.ok(html.includes(a.seoTitle));
    assert.ok(!html.includes('class="entry-meta"'), "no author line");
    // Every paragraph of the draft is on the page, word for word.
    const md = readFileSync(`content/code-pages/${a.file}`, "utf8");
    for (const line of md.split("\n").filter((l) => l.trim())) {
      const want = line.replace(/^## |^- /, "").replace(/\*\*/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\s+/g, " ").trim();
      assert.ok(text.includes(want), `missing: ${want.slice(0, 60)}`);
    }
    assert.ok(!/\bpool/i.test(md) && !/\$\d/.test(md));
  });
}

test("masonry text is one new section on /masonry/, before the FAQ", async () => {
  const base = await load("/masonry/");
  const r = await codePage("/masonry/", load);
  assert.ok(base && base.kind === "page" && r && r.kind === "page");
  assert.equal((r.doc.content as unknown[]).length, (base.doc.content as unknown[]).length + 1);
  const html = renderDocument(r, data, "/masonry/", opts);
  const text = plain(html);
  const md = readFileSync("content/code-pages/masonry-section.md", "utf8");
  for (const line of md.split("\n").filter((l) => l.trim())) {
    const want = line.replace(/^## |^- /, "").replace(/\*\*/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\s+/g, " ").trim();
    assert.ok(text.includes(want), `missing: ${want.slice(0, 60)}`);
  }
  assert.ok(text.indexOf("Masonry Contractor in Connecticut") < text.indexOf("Do you repair old masonry?") );
  assert.equal((html.match(/<h1[ >]/g) || []).length, (renderDocument(base, data, "/masonry/", opts).match(/<h1[ >]/g) || []).length, "no second h1");
});

test("other paths are left alone", async () => {
  assert.equal(await codePage("/southington/", load), null);
});

test("markdown: links are relative, bold and bullets work", () => {
  const b = markdownToBlocks("- [A](https://alphahardscapes.com/x/) and **b**");
  assert.equal(b.length, 1);
  assert.deepEqual((b[0] as { markDefs: { href: string }[] }).markDefs.map((m) => m.href), ["/x/"]);
});
