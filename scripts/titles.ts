/**
 * Page titles and meta descriptions on every indexable page: titles of 50 to 60
 * characters, descriptions of 120 to 160. Proposed in the website audit of
 * October 22, 2026 (TTR-530) and approved by Kia the same day.
 *
 *   npm run titles                 # writes the texts into content/seed.json (idempotent) and prints what changed
 *   npm run titles -- --publish    # also sends those SEO fields to Sanity (SANITY_WRITE_TOKEN, an Editor token)
 *
 * What changes on a page: the title tag, the meta description, the Open Graph
 * title and description, and the page's own node in the JSON-LD graph (WebPage,
 * CollectionPage or ProfilePage: its name, and its description when it repeated
 * the old one). Body text, H1s and post titles (Article.headline) stay as they are.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dataset, projectId } from "../sanity/env.ts";

type Seo = Record<string, unknown> & { title?: string; description?: string; ogTitle?: string; ogDescription?: string; schema?: string; robots?: string };
type Doc = Record<string, unknown> & { _id: string; _type: string; path?: string; seo?: Seo };
type Node = Record<string, unknown>;
type Text = { title?: string; description?: string };

const ROOT = new URL("..", import.meta.url).pathname;
const SITE = "https://alphahardscapes.com";
const file = join(ROOT, "content/seed.json");
const publish = process.argv.includes("--publish");

/** Wording approved as written although one character over 60 (Kia, Oct 22, 2026). */
const APPROVED_LENGTH: Record<string, number> = { "/": 61 };

const TEXTS: Record<string, Text> = {
  /* Kia's yes, exact wording. */
  "/": { title: "Landscaping & Hardscaping Contractor in CT | Alpha Hardscapes" },
  "/walkway-patio-connecticut/": { title: "Walkway & Patio Pavers in Cheshire, CT | Alpha Hardscapes" },
  "/outdoor-living-packages-connecticut/": {
    title: "Outdoor Living Packages in Connecticut | Alpha Hardscapes",
    description: "Outdoor living design and build packages in Connecticut from Alpha Hardscapes: a custom patio paired with features like an outdoor kitchen, fire pit or pool.",
  },
  "/contact/": { title: "Contact Alpha Hardscapes | Free Quote in Cheshire, CT" },
  "/gallery/": {
    title: "Patio, Walkway & Masonry Gallery | Alpha Hardscapes",
    description: "Photos of patios, walkways, retaining walls, steps and outdoor living projects built by Alpha Hardscapes in Fairfield and New Haven County, CT.",
  },
  "/reviews/": { title: "Alpha Hardscapes Reviews | Hardscaping in Connecticut" },
  "/seasonal-clean-up/snow-removal/": {
    title: "Snow Removal in Fairfield & New Haven, CT | Alpha Hardscapes",
    description: "Snow removal for homes and businesses in New Haven and Fairfield County, CT. Alpha Hardscapes clears driveways, walkways and steps all winter long.",
  },

  /* Blog posts: the " | Alpha Hardscapes" suffix dropped. Four were still over 60 and are shortened with the same meaning. */
  "/blog/backyard-remodel-ideas-connecticut/": { title: "Backyard Remodel Ideas Connecticut: Patio & Outdoor Plans" },
  "/blog/best-patio-materials-connecticut/": { title: "Best Patio Materials Connecticut: Pavers, Bluestone" },
  "/blog/hardscaping-pavers-contractor-complete-guide-to-planning-installation-and-maintenance/": { title: "Hardscaping & Pavers: Planning, Installation & Maintenance" },
  "/blog/hardscaping-pavers-planning-your-outdoor-space/": { title: "Hardscaping Pavers Guide: Planning Your Outdoor Space" },
  "/blog/natural-stone-vs-wall-block/": { title: "Natural Stone vs Wall Block Retaining Walls: How to Choose" },
  "/blog/outdoor-kitchen-cost-connecticut/": { title: "Outdoor Kitchen Cost Connecticut: Complete Budget Guide" },
  "/blog/patio-and-walkway-maintenance-checklist/": { title: "Patio and Walkway Maintenance Checklist for Connecticut" },
  "/blog/patio-installation-cost-connecticut-cost-guide/": { title: "Patio Installation Cost Connecticut: Complete Cost Guide" },
  "/blog/pool-patio-materials-connecticut/": { title: "Pool Patio Materials Connecticut: Pavers, Stone, Concrete" },
  "/blog/prepare-patio-for-winter-connecticut/": { title: "Prepare Patio for Winter Connecticut: Step-by-Step Guide" },
  "/blog/small-backyard-patio-ideas-connecticut/": { title: "Small Backyard Patio Ideas Connecticut: 15 Designs Guide" },
  "/uncategorized/fire-pit-vs-outdoor-fireplace-connecticut-guide/": { title: "Fire Pit vs Outdoor Fireplace: Connecticut Guide 2026" },
  "/uncategorized/hardscape-upgrades-before-fall/": { title: "Hardscape Upgrades Before Fall Connecticut: 2026 Checklist" },
  "/uncategorized/how-long-does-a-paver-patio-last/": { title: "How Long Does a Paver Patio Last in Connecticut? Guide" },
  "/uncategorized/patio-around-outdoor-kitchen-ct/": { title: "Patio Around Outdoor Kitchen: CT Design & Layout Guide" },
  // Not changed: /uncategorized/paver-patio-vs-natural-stone-patio-connecticut/ (53, never had the suffix) and
  // /uncategorized/how-do-i-automation-my-facebook-ad/ (53 with the suffix, 34 without; its future is Kia's call).

  /* Pages whose title was over 60 characters: service, then the town or Connecticut, then the brand. */
  "/about-us/": {
    title: "About Alpha Hardscapes | Landscaping & Masonry in CT",
    description: "Meet Alpha Hardscapes, a landscaping and masonry team in Southern Connecticut that designs and builds patios, walkways, retaining walls, fire pits and more.",
  },
  "/berlin/": {
    title: "Masonry Contractor in Berlin, CT | Alpha Hardscapes",
    description: "Alpha Hardscapes LLC is a reliable masonry contractor in Berlin, CT delivering durable brick and stone work for patios, walls and steps. Call now!",
  },
  "/chimney-installation-and-repair-connecticut/": { title: "Chimney Installation & Repair in CT | Alpha Hardscapes" },
  "/deck-builders-connecticut/": { title: "Custom Deck Builders in Connecticut | Alpha Hardscapes" },
  "/fairfield-county-ct/": { title: "Masonry Contractor, Fairfield County, CT | Alpha Hardscapes" },
  "/glastonbury/": { title: "Masonry Contractor in Glastonbury, CT | Alpha Hardscapes" },
  "/hartford-county-ct/": { title: "Masonry Contractor in Hartford County, CT | Alpha Hardscapes" },
  "/landscaping/": { title: "Landscaping in Fairfield & New Haven, CT | Alpha Hardscapes" },
  "/masonry/": {
    title: "Masonry in Fairfield & New Haven, CT | Alpha Hardscapes",
    description: "Masonry services in Fairfield and New Haven County, CT from Alpha Hardscapes: stone walls, steps, veneer, chimneys, patios and walkways. Free quotes.",
  },
  "/new-haven-county-ct/": { title: "Masonry Contractor, New Haven County, CT | Alpha Hardscapes" },
  "/outdoor-kitchens-connecticut/": { title: "Custom Outdoor Kitchens in Connecticut | Alpha Hardscapes" },
  "/pool-builders-south-connecticut/": {
    title: "Swimming Pool Builders in Connecticut | Alpha Hardscapes",
    description: "Pool builders in Cheshire and across Fairfield and New Haven County, CT. Alpha Hardscapes designs and installs in-ground and above-ground swimming pools.",
  },
  "/repairs-maintenance-connecticut/": { title: "Paver Repair & Maintenance in Connecticut | Alpha Hardscapes" },
  "/seasonal-clean-up/leaf-removal/": {
    title: "Leaf Removal in New Haven & Fairfield, CT | Alpha Hardscapes",
    description: "Leaf removal and fall cleanup in New Haven and Fairfield County, CT. Alpha Hardscapes clears leaves and debris from lawns, beds, walkways and patios.",
  },
  "/service-areas/": { title: "Service Areas: Masonry Contractor in CT | Alpha Hardscapes" },
  "/southington/": { title: "Masonry Contractor in Southington, CT | Alpha Hardscapes" },
  "/stone/": { title: "Stone Retaining Walls in Cheshire, CT | Alpha Hardscapes" },
  "/thinstone-connecticut/": {
    title: "Thinstone Installation in Connecticut | Alpha Hardscapes",
    description: "Alpha Hardscapes LLC provides expert thinstone installation in Connecticut: durable stone veneer finishes for walls, chimneys and fireplaces. Call now!",
  },
  "/wall-block/": { title: "Wall Block Installations in Cheshire, CT | Alpha Hardscapes" },

  /* Author pages: the founder's title was 70 characters; the other four had a stray comma and a missing space, and one
   * description shared by all four. Each gets its own. */
  "/author/sebastian/": {
    title: "Articles by Sebastian Ullrich, Founder | Alpha Hardscapes",
    description: "Articles by Sebastian Ullrich, founder of Alpha Hardscapes in Connecticut, on patios, walkways, retaining walls, outdoor kitchens and fire features.",
  },
  "/author/grok/": {
    title: "Hardscaping Articles by Grok Bot | Alpha Hardscapes",
    description: "Author page for Grok Bot on the Alpha Hardscapes blog. Hardscaping, patio and outdoor living articles for Connecticut homeowners appear here once published.",
  },
  "/author/kia/": {
    title: "Hardscaping Articles by Kia kha | Alpha Hardscapes",
    description: "Author page for Kia kha on the Alpha Hardscapes blog. Articles on patios, walkways, stone walls and outdoor living in Connecticut appear here once published.",
  },
  "/author/ryan/": {
    title: "Hardscaping Articles by Ryan Spark | Alpha Hardscapes",
    description: "Author page for Ryan Spark on the Alpha Hardscapes blog. Hardscaping, paver and masonry articles for Connecticut homeowners appear here once published.",
  },
  "/author/ttrdigital/": {
    title: "Hardscaping Articles by ttrdigital | Alpha Hardscapes",
    description: "Articles by the ttrdigital team on the Alpha Hardscapes blog, including masonry in West Hartford, CT and marketing tips for local service businesses.",
  },

  /* Pages whose title was under 50 characters. */
  "/blog/": { title: "Hardscaping & Landscaping Blog for CT | Alpha Hardscapes" },
  "/category/blog/": { title: "Blog Archive: Hardscaping Articles | Alpha Hardscapes" },
  "/category/uncategorized/": {
    title: "Uncategorized Archive: More Articles | Alpha Hardscapes",
    description: "More articles from Alpha Hardscapes on patios, pavers, fire features, outdoor kitchens and outdoor living for Connecticut homes, with tips and guides.",
  },
  "/frequently-asked-questions/": { title: "Frequently Asked Questions: Hardscaping | Alpha Hardscapes" },
  "/masonry/retaining-walls/stone-3/": { title: "Stone Retaining Walls in Fairfield & New Haven County, CT" },
  "/masonry/retaining-walls/wall-block-2/": { title: "Wall Block Retaining Walls in Fairfield & New Haven, CT" },

  /* Title and description cut short in the WordPress export (they ended in "..."). */
  "/fire-features-connecticut/": {
    title: "Outdoor Fire Features in Connecticut | Alpha Hardscapes",
    description: "Outdoor fire features in Connecticut by Alpha Hardscapes LLC: masonry fire pits and outdoor fireplaces, wood or gas, built for patios and backyards.",
  },
  "/uncategorized/west-hartford/": {
    title: "Masonry Contractor in West Hartford, CT | Alpha Hardscapes",
    description: "Alpha Hardscapes LLC is a masonry contractor serving West Hartford, CT with custom patios, walkways, retaining walls and hardscapes. Call for a free quote.",
  },

  /* Unchanged description: its JSON-LD copy (WebPage.description) still had an older text. */
  "/uncategorized/paver-patio-vs-natural-stone-patio-connecticut/": { description: "Paver patio vs natural stone patio in Connecticut: compare cost, durability, freeze-thaw performance, maintenance and style." },

  /* Descriptions only: over 160 or under 120 characters. */
  "/locations/": { description: "Where Alpha Hardscapes works: landscaping, hardscaping and masonry in New Haven and Fairfield County, CT, with custom patios, walkways and retaining walls." },
  "/seasonal-clean-up/": { description: "Seasonal clean-up in Southern Connecticut from Alpha Hardscapes: fall leaf and debris removal, spring clean-up and winter snow removal for your property." },
  "/stone-steps-connecticut/": { description: "Alpha Hardscapes LLC builds natural stone steps in Connecticut with durable masonry and precise installation for entries, patios and slopes. Call now!" },
};

/* ---------------- checks on the texts themselves ---------------- */

for (const [path, t] of Object.entries(TEXTS)) {
  for (const [field, max] of [["title", 60], ["description", 160]] as const) {
    const v = t[field];
    if (v === undefined) continue;
    const min = field === "title" ? 50 : 120;
    const allowed = field === "title" ? APPROVED_LENGTH[path] || max : max;
    if (v.length < min || v.length > allowed) throw new Error(`${field} for ${path} is ${v.length} characters (${min} to ${allowed}): ${v}`);
    if (/[—–]/.test(v)) throw new Error(`${field} for ${path} has a dash character: ${v}`);
    if (v !== v.trim() || /\s{2}/.test(v)) throw new Error(`${field} for ${path} has stray spaces: ${v}`);
  }
}

/* ---------------- apply to the seed ---------------- */

const docs: Doc[] = JSON.parse(readFileSync(file, "utf8"));
const byPath = new Map(docs.filter((d) => d.path).map((d) => [d.path!, d]));
const log: string[] = [];

/** Yoast stored a few names with HTML entities ("&amp;", "&#038;"); compare them as text. */
const decode = (s: string) =>
  s
    .replace(/&amp;|&#0*38;/g, "&")
    .replace(/&#8217;|&rsquo;/g, "’")
    .replace(/&#8216;|&lsquo;/g, "‘")
    .replace(/&quot;|&#0*34;/g, '"')
    .replace(/&nbsp;|&#160;/g, " ");
const same = (a: unknown, b: unknown) => typeof a === "string" && typeof b === "string" && decode(a) === decode(b);

const PAGE_TYPES = new Set(["WebPage", "CollectionPage", "ProfilePage", "ItemPage", "AboutPage", "ContactPage"]);

/** The page's own node in the Yoast graph: @id is the page URL (or the URL plus #webpage). */
function isPageNode(node: Node, path: string) {
  const types = Array.isArray(node["@type"]) ? (node["@type"] as string[]) : [String(node["@type"])];
  const id = String(node["@id"] || "").replace(/^https?:\/\/(www\.)?alphahardscapes\.com/, "");
  return types.some((t) => PAGE_TYPES.has(t)) && (id === path || id === `${path}#webpage`);
}

function updateSchema(seo: Seo, path: string, old: Text, next: Text): boolean {
  if (typeof seo.schema !== "string") return false;
  let graph: { "@graph"?: Node[] };
  try {
    graph = JSON.parse(seo.schema) as { "@graph"?: Node[] };
  } catch {
    log.push(`${path}: schema is not JSON, left as is`);
    return false;
  }
  let changed = false;
  for (const node of graph["@graph"] || []) {
    const page = isPageNode(node, path);
    if (next.title && typeof node.name === "string" && (page || same(node.name, old.title)) && node.name !== next.title) {
      node.name = next.title;
      changed = true;
    }
    if (next.description && typeof node.description === "string" && (page || same(node.description, old.description)) && node.description !== next.description) {
      node.description = next.description;
      changed = true;
    }
  }
  if (changed) seo.schema = JSON.stringify(graph);
  return changed;
}

const report: string[] = [];
for (const [path, t] of Object.entries(TEXTS)) {
  const d = byPath.get(path);
  if (!d) throw new Error(`No document for ${path}`);
  const seo = (d.seo ||= {});
  const old: Text = { title: seo.title, description: seo.description };
  const lines = [path];
  if (t.title && t.title !== seo.title) {
    lines.push(`  title: "${old.title}" (${old.title?.length ?? 0}) -> "${t.title}" (${t.title.length})`);
    if (seo.ogTitle && !same(seo.ogTitle, old.title)) log.push(`${path}: og:title was different from the title ("${seo.ogTitle}"), now the new title`);
    seo.title = t.title;
    seo.ogTitle = t.title;
  }
  if (t.description && t.description !== seo.description) {
    lines.push(`  description: "${old.description}" (${old.description?.length ?? 0}) -> "${t.description}" (${t.description.length})`);
    if (seo.ogDescription && !same(seo.ogDescription, old.description)) log.push(`${path}: og:description was different from the description, now the new description`);
    seo.description = t.description;
    seo.ogDescription = t.description;
  }
  const schemaChanged = updateSchema(seo, path, old, t);
  if (lines.length > 1) report.push(lines.join("\n"));
  else if (schemaChanged) log.push(`${path}: title and description unchanged; the page's JSON-LD node now repeats them`);
}

writeFileSync(file, JSON.stringify(docs, null, 1));

/* ---------------- the whole site after the change ---------------- */

const indexable = docs.filter((d) => ["page", "post", "archivePage"].includes(d._type) && d.path && !/noindex/.test(d.seo?.robots || ""));
const outOfRange: string[] = [];
for (const d of indexable) {
  const t = d.seo?.title || "";
  const desc = d.seo?.description || "";
  const maxT = APPROVED_LENGTH[d.path!] || 60;
  if (t.length < 50 || t.length > maxT) outOfRange.push(`${d.path} title ${t.length}: ${t}`);
  if (desc.length < 120 || desc.length > 160) outOfRange.push(`${d.path} description ${desc.length}: ${desc}`);
}

console.log(report.length ? report.join("\n") : "Nothing to change: content/seed.json already has these texts.");
if (log.length) console.log(`\nNotes:\n${log.join("\n")}`);
console.log(`\n${indexable.length} indexable pages checked after the change: ${outOfRange.length ? `out of range:\n${outOfRange.join("\n")}` : "every title 50 to 60 and every description 120 to 160"}`);
console.log(Object.keys(APPROVED_LENGTH).map((p) => `(${p}: ${APPROVED_LENGTH[p]} characters approved as written)`).join("\n"));

/* ---------------- Sanity ---------------- */

if (publish) {
  const token = process.env.SANITY_WRITE_TOKEN;
  if (!token) {
    console.error("Set SANITY_WRITE_TOKEN (an Editor token from sanity.io/manage > API > Tokens).");
    process.exit(1);
  }
  const mutations = Object.keys(TEXTS).map((path) => {
    const seo = byPath.get(path)!.seo!;
    const set: Record<string, string> = {};
    for (const k of ["title", "ogTitle", "description", "ogDescription", "schema"] as const) if (typeof seo[k] === "string") set[`seo.${k}`] = seo[k] as string;
    return { patch: { id: byPath.get(path)!._id, set } };
  });
  const res = await fetch(`https://api.sanity.io/v2024-01-01/projects/${projectId}/datasets/${dataset}/mutate?returnIds=true`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ mutations }),
  });
  if (!res.ok) {
    console.error(`Sanity answered ${res.status}: ${(await res.text()).slice(0, 500)}`);
    process.exit(1);
  }
  console.log(`\nSent the SEO fields of ${mutations.length} documents to Sanity ${projectId}/${dataset}. The site refreshes within 5 minutes (or at once through the publish webhook).`);
}
