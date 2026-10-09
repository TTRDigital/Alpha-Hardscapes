/**
 * Editorial and SEO fixes on top of the migrated content (content/seed.json).
 * Run after `npm run extract`, then `npm run seed -- --force` to publish.
 *
 *   npm run fixes
 *
 * Every fix is idempotent. Social images (public/og/*.jpg) are generated here.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

type Doc = Record<string, unknown> & { _id: string; _type: string; path?: string; seo?: Record<string, unknown> };
type Node = Record<string, unknown>;

const ROOT = new URL("..", import.meta.url).pathname;
const SITE = "https://alphahardscapes.com";
const file = join(ROOT, "content/seed.json");
const docs: Doc[] = JSON.parse(readFileSync(file, "utf8"));
const byId = new Map(docs.map((d) => [d._id, d]));
const byPath = new Map(docs.filter((d) => d.path).map((d) => [d.path!, d]));
const log: string[] = [];

function walk(n: unknown, cb: (node: Node, parent: unknown[] | null) => void, parent: unknown[] | null = null) {
  if (Array.isArray(n)) n.forEach((v) => walk(v, cb, n));
  else if (n && typeof n === "object") {
    cb(n as Node, parent);
    for (const v of Object.values(n as Node)) walk(v, cb, null);
  }
}

const strip = (html: string) => html.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const firstTag = (tpl: unknown) => /^<[^>]+>/.exec(String(tpl || ""))?.[0] || "";

/* 1. Sections hidden on desktop, tablet and mobile: invisible duplicates, removed. */
function removeHiddenEverywhere(n: unknown) {
  if (Array.isArray(n)) {
    for (let i = n.length - 1; i >= 0; i--) {
      const x = n[i] as Node;
      const tag = firstTag(x?.tpl);
      if (x?._type === "elContainer" && ["desktop", "tablet", "mobile"].every((d) => tag.includes(`elementor-hidden-${d}`))) {
        n.splice(i, 1);
        log.push(`removed hidden section ${x.elId}`);
      } else removeHiddenEverywhere(x);
    }
  } else if (n && typeof n === "object") for (const v of Object.values(n)) removeHiddenEverywhere(v);
}
for (const d of docs) removeHiddenEverywhere(d);

/* 2. Quote headings copied from the paver repair page. */
const CTA: Record<string, string> = {
  "/avon/": "Avon Hardscaping &amp; Masonry",
  "/berlin/": "Berlin Hardscaping &amp; Masonry",
  "/farmington/": "Farmington Hardscaping &amp; Masonry",
  "/glastonbury/": "Glastonbury Hardscaping &amp; Masonry",
  "/southington/": "Southington Hardscaping &amp; Masonry",
  "/uncategorized/west-hartford/": "West Hartford Hardscaping &amp; Masonry",
  "/fairfield-county-ct/": "Fairfield County Hardscaping &amp; Masonry",
  "/hartford-county-ct/": "Hartford County Hardscaping &amp; Masonry",
  "/new-haven-county-ct/": "New Haven County Hardscaping &amp; Masonry",
  "/service-areas/": "Hardscaping &amp; Masonry",
  "/chimney-installation-and-repair-connecticut/": "Chimney Installation &amp; Repair",
  "/fire-features-connecticut/": "Fire Pit &amp; Fireplace",
  "/outdoor-kitchens-connecticut/": "Outdoor Kitchen",
  "/stone-steps-connecticut/": "Stone Steps",
  "/thinstone-connecticut/": "Thin Stone Veneer",
};
for (const [path, label] of Object.entries(CTA)) {
  const d = byPath.get(path);
  if (!d) throw new Error(`No page ${path}`);
  walk(d, (n) => {
    if (n._type === "elHeading" && typeof n.titleHtml === "string" && n.titleHtml.includes("Paver Repair &amp; Maintenance</span> Quote")) {
      n.titleHtml = n.titleHtml.replace(/Paver Repair &amp; Maintenance(?=<\/span> Quote)/, label);
      log.push(`quote heading on ${path}`);
    }
  });
}

/* 3. Retaining walls: H1 matches the title (Fairfield & New Haven). */
walk(byPath.get("/retaining-walls-connecticut/"), (n) => {
  if (n._type === "elHeading" && n.title === "Beautiful Retaining Walls in Cheshire, Connecticut") {
    n.title = "Beautiful Retaining Walls in Fairfield & New Haven County, CT";
    log.push("retaining walls H1");
  }
});

/* 4. Alt text. Decorative graphics keep alt="" (correct for screen readers). */
const DECORATIVE = /\/(alpha\.png|filled-bg|dot-grahpic|alphahardscapes-logo-icon|frame-\d+|[a-z-]*-icon\.svg|graphic|step-\d+\.svg|banner-bottom)/i;
const LOGO = /(alpha-hardscapes-logo|alphahardscapes-logo|logo-with-bg|alpha-footer-logo)/i;
const looksLikeFilename = (alt: string) => !/\s/.test(alt) && /[-_.]/.test(alt);

function altFromFile(src: string): string | null {
  const base = src.split("/").pop()!.replace(/\.\w+$/, "").replace(/-(\d+x\d+|scaled|e\d{10,})(?=-|$)/g, "");
  const words = base.split(/[-_]+/).filter((w) => /^[a-z]{2,}$/i.test(w) && !/^(img|image|photo|copy|comp|bna|final|new|edited)$/i.test(w));
  if (words.length < 3) return null;
  const proper = new Set(["avon", "berlin", "farmington", "glastonbury", "southington", "hartford", "haven", "new", "fairfield", "cheshire", "connecticut", "west", "county"]);
  const s = words
    .map((w) => (/^ct$/i.test(w) ? "CT" : proper.has(w.toLowerCase()) ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase()))
    .join(" ");
  return s[0].toUpperCase() + s.slice(1);
}

function pageTopic(d: Doc): string {
  let h1 = "";
  walk(d, (n) => {
    if (!h1 && n._type === "elHeading" && /<h1\b/.test(String(n.tpl))) h1 = String(n.title || strip(String(n.titleHtml || "")));
  });
  return (h1 || String(d.title || (d.seo?.title as string) || "").split("|")[0]).trim();
}

// Blog hero images: the post title.
for (const d of docs.filter((x) => x._type === "post")) {
  for (const f of ["featuredImage", "featuredMedium"]) {
    const img = d[f] as Node | undefined;
    if (img && !String(img.alt || "").trim()) img.alt = String(d.title);
  }
}
for (const d of docs) {
  const topic = d._type === "post" ? String(d.title) : pageTopic(d);
  const used = new Map<string, number>();
  walk(d, (n) => {
    if (n._type !== "wpImage") return;
    const src = String(n.src || "");
    const alt = String(n.alt ?? "").trim();
    if (alt && !looksLikeFilename(alt)) return;
    let next: string;
    if (LOGO.test(src) || /logo/i.test(alt)) next = "Alpha Hardscapes";
    else if (DECORATIVE.test(src)) next = "";
    else if (/southern-connecticut-map/.test(src)) next = "Map of the Alpha Hardscapes service area in Southern Connecticut";
    else if (/fairfield-county-map/.test(src)) next = "Map of Fairfield County, CT";
    else {
      const base = altFromFile(src) || (topic ? `${topic} project by Alpha Hardscapes` : "Hardscaping project by Alpha Hardscapes");
      const k = (used.get(base) || 0) + 1;
      used.set(base, k);
      next = k > 1 ? `${base} (photo ${k})` : base;
    }
    if (next !== alt) {
      n.alt = next;
      log.push(`alt ${d._id}: ${src.split("/").pop()} -> "${next}"`);
    }
  });
}
// Header / footer / popup logos
for (const d of docs.filter((x) => x._type === "elementorTemplate")) {
  walk(d, (n) => {
    if (n._type === "wpImage" && (LOGO.test(String(n.src)) || /logo/i.test(String(n.alt)))) n.alt = "Alpha Hardscapes";
  });
}

/* 5. Blog index heading and meta descriptions. */
const blog = byId.get("archive-blog")!;
blog.heading = "Hardscaping & Landscaping Blog";
if (!String(blog.frameTpl).includes("[[@text:heading]]")) {
  blog.frameTpl = String(blog.frameTpl).replace(
    '<main id="main" class="site-main">',
    '<section class="ast-archive-description"><h1 class="page-title ast-archive-title">[[@text:heading]]</h1></section><main id="main" class="site-main">',
  );
}
const DESCRIPTIONS: Record<string, string> = {
  "/blog/": "Hardscaping, patio, paver and landscaping tips for Connecticut homeowners from the Alpha Hardscapes team: costs, materials, design ideas and maintenance.",
  "/category/blog/": "Articles from Alpha Hardscapes on patios, pavers, retaining walls, outdoor kitchens and landscaping for Connecticut homes.",
  "/category/uncategorized/": "More articles from Alpha Hardscapes on patios, pavers, fire features and outdoor living in Connecticut.",
  "/masonry/retaining-walls/stone-3/": "Natural stone retaining walls built to handle Connecticut freeze-thaw. Alpha Hardscapes designs and installs stone walls for slopes, beds and patios.",
  "/masonry/retaining-walls/wall-block-2/": "Segmental wall block retaining walls for Connecticut properties: engineered for drainage and durability. Get a free quote from Alpha Hardscapes.",
  "/masonry/walkway-patio-masonry-optin/": "Custom paver and natural stone patios and walkways in Connecticut. Request your free estimate from Alpha Hardscapes today.",
  "/privacy-policy/": "Privacy policy for alphahardscapes.com: how Alpha Hardscapes collects, uses and protects information submitted through our website and forms.",
  "/terms-and-conditions/": "Terms and conditions for using alphahardscapes.com and requesting quotes from Alpha Hardscapes, a Connecticut hardscaping and masonry contractor.",
  "/blog/prepare-patio-for-winter-connecticut/": "Step-by-step guide to preparing your patio for a Connecticut winter: cleaning, sealing, joint sand, drainage and safe de-icing for pavers and stone.",
  "/blog/natural-stone-vs-wall-block/": "Natural stone vs wall block retaining walls: compare cost, look, strength and lifespan to choose the right wall for your Connecticut yard.",
  "/blog/patio-and-walkway-maintenance-checklist/": "A seasonal patio and walkway maintenance checklist for Connecticut homeowners: cleaning, sealing, re-sanding joints and fixing heaved pavers.",
  "/uncategorized/how-do-i-automation-my-facebook-ad/": "How to automate Facebook ads to save time, cut wasted spend and scale results, with practical steps for small local service businesses.",
  "/uncategorized/hardscape-upgrades-before-fall/": "Hardscape upgrades to finish before fall in Connecticut: patios, walkways, retaining walls and fire features worth scheduling now.",
  "/uncategorized/how-long-does-a-paver-patio-last/": "How long does a paver patio last in Connecticut? Typical lifespan, what shortens it, and the maintenance that keeps pavers looking new for decades.",
  "/uncategorized/paver-patio-vs-natural-stone-patio-connecticut/": "Paver patio vs natural stone patio in Connecticut: compare cost, durability, freeze-thaw performance, maintenance and style.",
  "/uncategorized/patio-around-outdoor-kitchen-ct/": "How to plan the patio around an outdoor kitchen in Connecticut: layout, materials, base, drainage and spacing for cooking and dining.",
  "/uncategorized/fire-pit-vs-outdoor-fireplace-connecticut-guide/": "Fire pit vs outdoor fireplace in Connecticut: compare cost, heat, space, permits and style to pick the right fire feature for your yard.",
  "/blog/small-backyard-patio-ideas-connecticut/": "Small backyard patio ideas for Connecticut homes: space-saving layouts, materials, seating, lighting and planting that make a small yard feel bigger.",
  "/blog/pool-patio-materials-connecticut/": "Choosing pool patio materials in Connecticut: pavers, natural stone and concrete compared for slip resistance, heat, durability and cost.",
  "/blog/backyard-remodel-ideas-connecticut/": "Backyard remodel ideas for Connecticut: patios, outdoor kitchens, fire features, retaining walls and planting, with tips on budget and timing.",
  "/blog/outdoor-kitchen-cost-connecticut/": "What does an outdoor kitchen cost in Connecticut? Price ranges by size and materials, what drives the budget, and how to plan your project.",
  "/blog/best-patio-materials-connecticut/": "The best patio materials for Connecticut: pavers, bluestone, natural stone and concrete compared for freeze-thaw durability, cost and upkeep.",
  "/blog/patio-installation-cost-connecticut-cost-guide/": "Patio installation cost in Connecticut: typical price per square foot for pavers, stone and concrete, and what affects your final quote.",
  "/blog/hardscaping-pavers-planning-your-outdoor-space/": "Planning hardscaping and pavers for your outdoor space: layout, materials, drainage and budget tips from Connecticut paver contractors.",
  "/blog/hardscaping-pavers-contractor-complete-guide-to-planning-installation-and-maintenance/": "Complete guide to hardscaping and pavers: planning, base preparation, installation and long-term maintenance from a Connecticut paver contractor.",
};
for (const [path, desc] of Object.entries(DESCRIPTIONS)) {
  const d = byPath.get(path);
  if (!d) throw new Error(`No document for ${path}`);
  d.seo = { ...(d.seo || {}), description: desc, ogDescription: desc };
  if (desc.length > 160) throw new Error(`Description too long for ${path}`);
}
blog.seo = { ...(blog.seo || {}), title: "Hardscaping & Landscaping Blog | Alpha Hardscapes", ogTitle: "Hardscaping & Landscaping Blog | Alpha Hardscapes" };

/* 6. Wrong link in the outdoor kitchen cost post. */
walk(byPath.get("/blog/outdoor-kitchen-cost-connecticut/"), (n) => {
  if (n._type !== "block") return;
  const kids = (n.children as Node[]) || [];
  for (const span of kids.filter((k) => k.text === "Walkway & Patio Connecticut")) {
    for (const m of (span.marks as string[]) || []) {
      const def = ((n.markDefs as Node[]) || []).find((x) => x._key === m && x._type === "link");
      if (def && def.href !== "/walkway-patio-connecticut/") {
        def.href = "/walkway-patio-connecticut/";
        log.push("fixed Walkway & Patio Connecticut link");
      }
    }
  }
});

/* 7. Menus point at the final URLs (no redirect hops, same page in header and footer). */
const MENU_FIX: Record<string, { link: string; pageId: number }> = {
  "/landscaping-connecticut/": { link: "/landscaping/", pageId: 727 },
  "/locations/": { link: "/service-areas/", pageId: 4438 },
};
for (const id of ["template-61", "template-102"]) {
  walk(byId.get(id), (n) => {
    if (n._type === "navItem" && MENU_FIX[String(n.link)]) {
      log.push(`menu ${id}: ${n.label} ${n.link} -> ${MENU_FIX[String(n.link)].link}`);
      Object.assign(n, MENU_FIX[String(n.link)]);
    }
  });
}

/* 8. Copyright year follows the calendar. */
walk(byId.get("template-102"), (n) => {
  if (n._type === "span" && typeof n.text === "string" && /Copyright © \d{4}/.test(n.text)) n.text = n.text.replace(/© \d{4}/, "© {year}");
});

/* 9. Business details for structured data (Site settings > Business schema). */
const towns = ["New Haven", "Hamden", "North Haven", "West Haven", "Cheshire", "Wallingford", "Branford", "Guilford", "Madison", "Milford", "Orange", "Woodbridge", "Shelton", "Trumbull", "Fairfield", "Stratford", "Avon", "Berlin", "Farmington", "Glastonbury", "Southington", "West Hartford"];
const business = {
  "@type": ["HomeAndConstructionBusiness", "Organization"],
  name: "Alpha Hardscapes",
  url: `${SITE}/`,
  logo: { "@type": "ImageObject", url: `${SITE}/icon-512.png`, contentUrl: `${SITE}/icon-512.png`, width: 512, height: 512, caption: "Alpha Hardscapes" },
  image: `${SITE}/og/home.jpg`,
  telephone: "+1-475-227-6896",
  email: "alphahardscapes1@gmail.com",
  priceRange: "$$",
  description: "Hardscaping, paver and masonry contractor serving New Haven, Fairfield and Hartford Counties in Connecticut: patios, walkways, retaining walls, outdoor kitchens, fire features, landscaping and seasonal cleanups.",
  address: { "@type": "PostalAddress", addressLocality: "New Haven", addressRegion: "CT", postalCode: "06510", addressCountry: "US" },
  geo: { "@type": "GeoCoordinates", latitude: 41.3083, longitude: -72.9279 },
  openingHoursSpecification: [
    { "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], opens: "08:00", closes: "17:00" },
    { "@type": "OpeningHoursSpecification", dayOfWeek: "Saturday", opens: "09:00", closes: "13:00" },
  ],
  areaServed: [
    ...["New Haven County", "Fairfield County", "Hartford County"].map((name) => ({ "@type": "AdministrativeArea", name: `${name}, CT` })),
    ...towns.map((name) => ({ "@type": "City", name: `${name}, CT` })),
  ],
  sameAs: ["https://www.facebook.com/AlphaHardscapes", "https://www.instagram.com/alphahardscapes/"],
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "Hardscaping & Landscaping Services",
    itemListElement: [
      ["Patios & Walkways", "/walkway-patio-connecticut/"],
      ["Retaining Walls", "/retaining-walls-connecticut/"],
      ["Masonry", "/masonry/"],
      ["Paver Repairs & Maintenance", "/repairs-maintenance-connecticut/"],
      ["Outdoor Kitchens", "/outdoor-kitchens-connecticut/"],
      ["Fire Features", "/fire-features-connecticut/"],
      ["Stone Steps", "/stone-steps-connecticut/"],
      ["Chimney Installation & Repair", "/chimney-installation-and-repair-connecticut/"],
      ["Landscaping", "/landscaping/"],
      ["Seasonal Clean-Up", "/seasonal-clean-up/"],
      ["Snow Removal", "/seasonal-clean-up/snow-removal/"],
      ["Leaf Removal", "/seasonal-clean-up/leaf-removal/"],
    ].map(([name, path]) => ({ "@type": "Offer", itemOffered: { "@type": "Service", name, url: `${SITE}${path}` } })),
  },
};
byId.get("siteSettings")!.businessSchema = JSON.stringify(business, null, 2);

/* 10. Social images: 1200x630 photo per page (was a 136x118 background graphic). */
const OG_DIR = join(ROOT, "public/og");
mkdirSync(OG_DIR, { recursive: true });

function firstPhoto(d: Doc): string | null {
  const feat = (d.featuredImage as Node | undefined)?.src as string | undefined;
  if (feat) return feat;
  let found: string | null = null;
  walk(d, (n) => {
    if (found || n._type !== "wpImage") return;
    const src = String(n.src || "");
    if (!src || DECORATIVE.test(src) || LOGO.test(src) || /map|\.svg$/i.test(src)) return;
    if (Number(n.width || 0) && Number(n.width) < 500) return;
    found = src;
  });
  return found;
}

async function ogFor(d: Doc, fallback?: string): Promise<string | null> {
  const src = firstPhoto(d) || fallback;
  if (!src) return null;
  const local = join(ROOT, "public", decodeURIComponent(src.split("?")[0]));
  if (!existsSync(local)) return null;
  const slug = d.path === "/" ? "home" : d.path!.split("/").filter(Boolean).join("-");
  const out = join(OG_DIR, `${slug}.jpg`);
  if (!existsSync(out)) {
    await sharp(local).rotate().resize(1200, 630, { fit: "cover", position: "attention" }).jpeg({ quality: 82, mozjpeg: true }).toFile(out);
  }
  return `${SITE}/og/${slug}.jpg`;
}

const homeImg = firstPhoto(byPath.get("/")!)!;
for (const d of docs.filter((x) => ["page", "post", "archivePage"].includes(x._type) && x.path)) {
  const url = await ogFor(d, homeImg);
  if (!url) continue;
  const seo = (d.seo ||= {});
  const oldImg = seo.ogImage as string | undefined;
  Object.assign(seo, { ogImage: url, ogImageWidth: "1200", ogImageHeight: "630", ogImageType: "image/jpeg" });
  // Keep the schema's primary image in step with the social image.
  if (typeof seo.schema === "string") {
    try {
      const g = JSON.parse(seo.schema) as { "@graph": Node[] };
      for (const node of g["@graph"]) {
        if (node["@type"] === "ImageObject" && String(node["@id"]).endsWith("#primaryimage") && (!oldImg || node.url === oldImg) && /filled-bg/.test(String(node.url))) {
          Object.assign(node, { url, contentUrl: url, width: 1200, height: 630 });
        }
        if (node["@type"] === "WebPage" && /filled-bg/.test(String(node.thumbnailUrl))) node.thumbnailUrl = url;
      }
      seo.schema = JSON.stringify(g);
    } catch {
      /* leave unparsable schema as is */
    }
  }
}

writeFileSync(file, JSON.stringify(docs, null, 1));
console.log(log.filter((l) => !l.startsWith("alt ")).join("\n"));
console.log(`${log.filter((l) => l.startsWith("alt ")).length} alt texts written`);
