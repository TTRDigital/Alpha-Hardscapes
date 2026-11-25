/**
 * Client project photos (Nov 2026): front entry with lit stone steps and a
 * granite walkway. Added to existing galleries and swapped into existing image
 * slots only, so no section changes shape:
 *
 * - /gallery/: the five photos first in the filterable gallery (Paths, Stairs, Patios)
 * - /walkway-patio-connecticut/: four photos added to "Featured Patio & Walkway
 *   Projects" (one more row of four)
 * - /stone-steps-connecticut/: the two illustrations replaced with real step
 *   photos cropped to the same 4:5 shape
 *
 *   npm run client-photos              # content/seed.json (preview deployments)
 *   npm run client-photos -- --publish # also patch those three pages in Sanity
 *
 * Idempotent. --publish reads each page from Sanity and changes only these
 * blocks, so other edits made in the CMS are kept.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dataset, projectId } from "../sanity/env.ts";

type Node = Record<string, unknown>;
type Doc = Node & { _id: string; _type: string; path?: string };

const ROOT = new URL("..", import.meta.url).pathname;
const NEW = "/wp-content/uploads/2026/11/";

const PHOTOS = [
  { base: "front-entry-paver-walkway-stone-steps-connecticut", w: 1500, h: 1125, tags: "2,3", alt: "Front entry paver walkway and natural stone steps with step lights in Connecticut" },
  { base: "paver-walkway-lit-stone-steps-connecticut", w: 1760, h: 1320, tags: "2,3", alt: "Paver walkway, landing and lit granite steps at a Connecticut home" },
  { base: "stone-steps-lighting-paver-walkway-night-connecticut", w: 2000, h: 1500, tags: "2,3", alt: "Stone steps with built-in lighting and paver walkway at night" },
  { base: "front-entry-paver-walkway-granite-steps-connecticut", w: 1500, h: 1125, tags: "2,3", alt: "New paver walkway and granite steps at a Connecticut front entry" },
  { base: "granite-walkway-patio-connecticut", w: 1125, h: 1500, tags: "0,2", alt: "Granite slab walkway and patio along a Connecticut home" },
];
type Photo = (typeof PHOTOS)[number];

const STEP_SWAPS: Record<string, { base: string; alt: string }> = {
  "244ed5cf": { base: "natural-stone-steps-connecticut-front-entry-project", alt: "Natural stone steps with lighting and paver walkway at a Connecticut front entry" },
  "360a82da": { base: "natural-stone-steps-connecticut-lighting-project", alt: "Granite stone steps with built-in step lights at night in Connecticut" },
};

/** WordPress-style sizes written next to each photo: the "large" (1024 px), 768 px and 300 px copies. */
function scaled(p: Photo, longest: number) {
  const s = longest / Math.max(p.w, p.h);
  return { w: Math.round(p.w * s), h: Math.round(p.h * s) };
}
const file = (p: Photo, size?: { w: number; h: number }) => `${NEW}${p.base}${size ? `-${size.w}x${size.h}` : ""}.jpg`;

function lightboxHash(url: string, slideshow: string, id: number) {
  const settings = JSON.stringify({ id, url, slideshow }).replace(/\//g, "\\/");
  return `#elementor-action%3Aaction%3Dlightbox%26settings%3D${encodeURIComponent(Buffer.from(settings).toString("base64"))}`;
}

function walk(n: unknown, cb: (node: Node) => void) {
  if (Array.isArray(n)) n.forEach((v) => walk(v, cb));
  else if (n && typeof n === "object") {
    cb(n as Node);
    for (const v of Object.values(n as Node)) walk(v, cb);
  }
}

function find(root: unknown, pred: (n: Node) => boolean): Node | undefined {
  let found: Node | undefined;
  walk(root, (n) => {
    if (!found && pred(n)) found = n;
  });
  return found;
}

/** Applies the changes to one page document; returns what changed. */
export function applyClientPhotos(doc: Doc): string[] {
  const log: string[] = [];
  if (doc.path === "/gallery/") {
    const g = find(doc, (n) => n._type === "elGallery");
    const items = (g?.items as Node[]) || [];
    if (g && items.length && !items.some((i) => String(i.link).startsWith(NEW))) {
      const proto = String(items[0].tpl);
      const added = PHOTOS.map((p, i) => {
        const large = scaled(p, 1024);
        const tpl = proto
          .replace(/data-e-gallery-tags="[^"]*"/, `data-e-gallery-tags="${p.tags}"`)
          .replace(/data-elementor-lightbox-title="[^"]*"/, `data-elementor-lightbox-title="${p.alt}"`)
          .replace(/data-e-action-hash="[^"]*"/, `data-e-action-hash="${lightboxHash(file(p), "4598457", 990001 + i)}"`)
          .replace(/data-width="\d+"/, `data-width="${large.w}"`)
          .replace(/data-height="\d+"/, `data-height="${large.h}"`)
          .replace(/aria-label="[^"]*"/, `aria-label="${p.alt}"`);
        return { _type: "galleryItem", _key: `nov26g${i}`, link: file(p), thumbnail: file(p, large), tpl };
      });
      g.items = [...added, ...items];
      log.push(`gallery: ${added.length} photos added first`);
    }
  }
  if (doc.path === "/walkway-patio-connecticut/") {
    const ig = find(doc, (n) => n._type === "elImageGallery");
    const items = (ig?.items as Node[]) || [];
    if (ig && items.length && !items.some((i) => String(i.link).startsWith(NEW))) {
      const proto = String(items[0].tpl);
      const added = [PHOTOS[4], PHOTOS[0], PHOTOS[2], PHOTOS[3]].map((p, i) => {
        const [large, mid] = [scaled(p, 1024), scaled(p, 768)];
        const small = p.w >= p.h ? { w: 300, h: Math.round((300 * p.h) / p.w) } : { w: Math.round((300 * p.w) / p.h), h: 300 };
        const tpl = proto
          .replace(/gallery-icon (landscape|portrait)/, `gallery-icon ${p.w >= p.h ? "landscape" : "portrait"}`)
          .replace(/data-elementor-lightbox-title="[^"]*"/, `data-elementor-lightbox-title="${p.alt}"`)
          .replace(/data-e-action-hash="[^"]*"/, `data-e-action-hash="${lightboxHash(file(p), "17831526", 990101 + i)}"`);
        const image = {
          ...(items[0].image as Node),
          src: file(p),
          width: String(p.w),
          height: String(p.h),
          alt: p.alt,
          sizes: `(max-width: ${p.w}px) 100vw, ${p.w}px`,
          srcset: [`${file(p)} ${p.w}w`, `${file(p, large)} ${large.w}w`, `${file(p, mid)} ${mid.w}w`, `${file(p, small)} ${small.w}w`].join(", "),
        };
        delete (image as Node).upload;
        return { _type: "imageGalleryItem", _key: `nov26w${i}`, link: file(p), image, tpl };
      });
      ig.items = [...items, ...added];
      log.push(`walkway page: ${added.length} photos added to Featured Patio & Walkway Projects`);
    }
  }
  if (doc.path === "/stone-steps-connecticut/") {
    walk(doc, (n) => {
      const swap = n._type === "elImage" ? STEP_SWAPS[String(n.elId)] : undefined;
      const img = n.image as Node | undefined;
      if (!swap || !img || String(img.src).startsWith(NEW)) return;
      const url = `${NEW}${swap.base}.jpg`;
      Object.assign(img, {
        src: url,
        width: "1000",
        height: "1250",
        alt: swap.alt,
        sizes: "(max-width: 1000px) 100vw, 1000px",
        srcset: `${url} 1000w, ${NEW}${swap.base}-666x832.jpg 666w, ${NEW}${swap.base}-240x300.jpg 240w`,
      });
      delete img.upload;
      log.push(`stone steps: image ${n.elId} is now ${swap.base}`);
    });
  }
  return log;
}

const PATHS = ["/gallery/", "/walkway-patio-connecticut/", "/stone-steps-connecticut/"];

if (import.meta.url === `file://${process.argv[1]}`) {
  const seedFile = join(ROOT, "content/seed.json");
  const docs: Doc[] = JSON.parse(readFileSync(seedFile, "utf8"));
  for (const d of docs.filter((x) => PATHS.includes(String(x.path)))) {
    for (const line of applyClientPhotos(d)) console.log(`seed: ${line}`);
  }
  writeFileSync(seedFile, JSON.stringify(docs, null, 1));

  if (process.argv.includes("--publish")) {
    const token = process.env.SANITY_WRITE_TOKEN;
    const base = `https://api.sanity.io/v2024-01-01/projects/${projectId}/datasets/${dataset}`;
    const headers: Record<string, string> = { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    const query = encodeURIComponent(`*[_type == "page" && path in $paths]`);
    const res = await fetch(`${base}/query?query=${query}&$paths=${encodeURIComponent(JSON.stringify(PATHS))}&perspective=raw`, { headers });
    if (!res.ok) throw new Error(`Sanity query answered ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const live: Doc[] = ((await res.json()) as { result: Doc[] }).result;
    const mutations: unknown[] = [];
    for (const d of live) {
      const changes = applyClientPhotos(d);
      if (!changes.length) continue;
      for (const k of ["_createdAt", "_updatedAt", "_rev"]) delete d[k];
      mutations.push({ createOrReplace: d });
      for (const line of changes) console.log(`sanity ${d._id}: ${line}`);
    }
    if (!mutations.length) console.log("Sanity: nothing to change");
    else {
      const m = await fetch(`${base}/mutate`, { method: "POST", headers, body: JSON.stringify({ mutations }) });
      if (!m.ok) throw new Error(`Sanity mutate answered ${m.status}: ${(await m.text()).slice(0, 300)}`);
      console.log(`Sanity: ${mutations.length} document(s) updated`);
    }
  }
}
