// Sanity schema for the ad landing pages (document type "landingPage") in Alpha's own project 7ysj6im9.
// Register it in the Studio (sanity/schemaTypes/index.ts of the main site): import { landingPageTypes } from "../ad-landing-pages/sanity/landingPage"
// and add ...landingPageTypes to schemaTypes. Field names mirror content/*.json one to one, so the build and the seed script need no mapping.
// Text marks: a new line is a line break, **bold**, [[highlight]]. Images are paths on the ad pages site (/images/...).
import { defineArrayMember, defineField, defineType } from "sanity";

const str = (name: string, title = name, rows = 0) => defineField({ name, title, type: rows ? "text" : "string", ...(rows ? { rows } : {}) });
const strs = (name: string, title = name) => defineField({ name, title, type: "array", of: [{ type: "string" }] });
const obj = (name: string, title: string, fields: any[]) => defineType({ name, title, type: "object", fields } as any);

const icon = defineField({ name: "icon", title: "Icon", type: "string", options: { list: ["house", "leaf", "users", "wrench", "sun", "star", "pin", "shield", "drops", "cal", "check"] } });

export const landingPageTypes = [
  obj("lpBar", "Services bar", [strs("items", "Items")]),
  obj("lpAbout", "About text", [str("heading"), str("text", "Text", 6)]),
  obj("lpSplit", "Image and text", [
    str("imageSide", "Image side (left or right)"), str("imageStyle", "Image style (img-a or img-b)"), str("image", "Image path"), str("imageAlt", "Image alt text"),
    defineField({ name: "first", type: "boolean" }), str("heading", "Heading", 2), strs("paragraphs"), str("listIntro", "List intro"), strs("items", "List items"), str("cta", "Call button text"),
  ]),
  obj("lpSeason", "Season band", [str("heading", "Heading", 2), strs("paragraphs"), str("primaryCta"), str("callCta"), strs("steps")]),
  obj("lpBenefits", "Benefits grid", [str("heading", "Heading", 2), str("intro", "Intro", 3), defineField({ name: "items", type: "array", of: [defineArrayMember({ type: "object", fields: [icon, str("title"), str("text", "Text", 3)] })] }), str("closing", "Closing text", 3), str("cta")]),
  obj("lpProjects", "Project gallery", [str("heading", "Heading", 2), defineField({ name: "images", type: "array", of: [defineArrayMember({ type: "object", fields: [str("image", "Image path"), str("alt", "Alt text")] })] })]),
  obj("lpWhy", "Why choose us", [str("backgroundImage"), str("markImage"), str("markAlt"), str("heading", "Heading", 2), str("intro", "Intro", 3), defineField({ name: "cards", type: "array", of: [defineArrayMember({ type: "object", fields: [icon, str("title"), str("text", "Text", 3)] })] })]),
  obj("lpReviews", "Reviews / testimonials", [str("heading"), str("intro"), str("moreLabel"), str("moreUrl"), defineField({ name: "items", type: "array", of: [defineArrayMember({ type: "object", fields: [str("initial"), str("name"), str("image", "Avatar image path"), defineField({ name: "stars", type: "boolean", description: "Leave empty to show stars when there is a name; set to false to hide" }), str("text", "Review text", 4)] })] })]),
  obj("lpArea", "Service area", [str("heading"), str("text", "Text", 4), str("pill")]),
  obj("lpFaq", "FAQ", [str("heading"), defineField({ name: "items", type: "array", of: [defineArrayMember({ type: "object", fields: [str("q", "Question"), str("a", "Answer", 4), defineField({ name: "open", type: "boolean" })] })] })]),
  obj("lpFinal", "Final call-to-action and footer", [str("image"), str("imageAlt"), str("heading", "Heading", 2), str("text", "Text", 4), str("primaryCta"), str("callCta"), str("footerLogo"), strs("footerLinks"), str("copyright"), str("privacyUrl"), str("privacyLabel"), str("address", "Business address"), str("email", "Customer email")]),
  defineType({
    name: "landingPage",
    title: "Ad landing page",
    type: "document",
    fields: [
      defineField({ name: "slug", type: "slug", options: { source: "title" }, validation: (r: any) => r.required() }),
      str("title", "Browser title"), str("description", "Meta description", 3), str("ogTitle"), str("ogDescription"), str("ogImage", "Share image path"),
      defineField({ name: "phone", type: "object", description: "Shown text and digits. The live call number comes from number.js (tracking number swap), this is the fallback.", fields: [str("display"), str("tel")] }),
      defineField({ name: "header", type: "object", fields: [str("ctaLong"), str("ctaShort"), str("logo"), str("logoAlt")] }),
      defineField({ name: "hero", type: "object", fields: [str("image"), str("imageAlt"), str("eyebrow"), str("headline", "Headline", 3), strs("paragraphs"), defineField({ name: "heroButtons", type: "boolean" }), str("galleryLabel"), str("formTitle"), str("button"), str("note", "Note under the form", 2), str("consent", "Consent line under the form", 2), str("source", "Lead source tag"), str("thanks", "Thank-you text ({phone} = number)", 2)] }),
      defineField({ name: "sections", type: "array", of: ["lpBar", "lpAbout", "lpSplit", "lpSeason", "lpBenefits", "lpProjects", "lpWhy", "lpReviews", "lpArea", "lpFaq", "lpFinal"].map((type) => defineArrayMember({ type })) }),
      defineField({ name: "mobileBar", type: "object", fields: [str("call"), str("quote")] }),
    ],
    preview: { select: { title: "title", subtitle: "slug.current" } },
  }),
];
