import { defineArrayMember, defineField, defineType, type FieldDefinition } from "sanity";
import { nodesField } from "./content";

const DEV = "dev";
const devFieldset = { name: DEV, title: "Developer (page layout)", options: { collapsible: true, collapsed: true } };

/** Read-only fields shared by every routed document. */
const layoutFields: FieldDefinition[] = [
  defineField({ name: "wpId", title: "WordPress ID", type: "number", fieldset: DEV, readOnly: true }),
  defineField({ name: "bodyClass", title: "Body classes", type: "text", rows: 2, fieldset: DEV }),
  defineField({ name: "frameTpl", title: "Page template", type: "text", rows: 4, fieldset: DEV, readOnly: true }),
  defineField({
    name: "shell",
    title: "Page skeleton",
    type: "string",
    fieldset: DEV,
    description: "Key of the stylesheet/script skeleton in lib/generated/shells.json. New pages: copy it from a page with the same design.",
  }),
  defineField({ name: "popups", title: "Popup order", type: "array", of: [defineArrayMember({ type: "number" })], fieldset: DEV, readOnly: true }),
];

const pathField = defineField({
  name: "path",
  title: "URL path",
  type: "string",
  description: "Starts and ends with a slash, e.g. /masonry/ (the home page is /). Changing it changes the page address.",
  validation: (r) => r.required().regex(/^\/([a-z0-9-]+\/)*$/, { name: "path like /masonry/" }),
});

const seoField = defineField({ name: "seo", title: "SEO", type: "seo", options: { collapsible: true, collapsed: false } });

export const seo = defineType({
  name: "seo",
  title: "SEO",
  type: "object",
  fieldsets: [
    { name: "social", title: "Social sharing (Open Graph)", options: { collapsible: true, collapsed: true } },
    { name: "advanced", title: "Advanced", options: { collapsible: true, collapsed: true } },
  ],
  fields: [
    defineField({ name: "title", title: "Title tag", type: "string", validation: (r) => r.max(70).warning("Google shows about 60 characters") }),
    defineField({ name: "description", title: "Meta description", type: "text", rows: 3, validation: (r) => r.max(170).warning("Google shows about 155 characters") }),
    defineField({ name: "canonical", title: "Canonical URL", type: "url" }),
    defineField({ name: "robots", title: "Robots", type: "string", initialValue: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" }),
    defineField({ name: "ogTitle", title: "Share title", type: "string", fieldset: "social" }),
    defineField({ name: "ogDescription", title: "Share description", type: "text", rows: 2, fieldset: "social" }),
    defineField({ name: "ogImage", title: "Share image URL", type: "string", fieldset: "social" }),
    defineField({ name: "ogImageWidth", title: "Share image width", type: "string", fieldset: "social" }),
    defineField({ name: "ogImageHeight", title: "Share image height", type: "string", fieldset: "social" }),
    defineField({ name: "ogImageType", title: "Share image type", type: "string", fieldset: "social" }),
    defineField({ name: "ogType", title: "og:type", type: "string", fieldset: "social" }),
    defineField({ name: "ogUrl", title: "og:url", type: "string", fieldset: "social" }),
    defineField({ name: "ogLocale", title: "og:locale", type: "string", fieldset: "social" }),
    defineField({ name: "ogSiteName", title: "og:site_name", type: "string", fieldset: "social" }),
    defineField({ name: "articlePublisher", title: "article:publisher", type: "string", fieldset: "social" }),
    defineField({ name: "articleAuthor", title: "article:author", type: "string", fieldset: "social" }),
    defineField({ name: "publishedTime", title: "Published time", type: "string", fieldset: "advanced" }),
    defineField({ name: "modifiedTime", title: "Modified time", type: "string", fieldset: "advanced" }),
    defineField({ name: "author", title: "Author meta", type: "string", fieldset: "advanced" }),
    defineField({ name: "twitterCard", title: "Twitter card", type: "string", fieldset: "advanced" }),
    defineField({
      name: "twitterMisc",
      title: "Twitter labels",
      type: "array",
      fieldset: "advanced",
      of: [defineArrayMember({ type: "object", fields: [defineField({ name: "label", type: "string" }), defineField({ name: "data", type: "string" })] })],
    }),
    defineField({ name: "schema", title: "Schema (JSON-LD)", type: "text", rows: 6, fieldset: "advanced" }),
  ],
});

export const page = defineType({
  name: "page",
  title: "Page",
  type: "document",
  fieldsets: [devFieldset],
  groups: [
    { name: "content", title: "Content", default: true },
    { name: "seo", title: "SEO" },
  ],
  fields: [
    defineField({ name: "title", title: "Title", type: "string", group: "content", validation: (r) => r.required() }),
    { ...pathField, group: "content" },
    { ...nodesField("content", "Content"), group: "content" },
    { ...seoField, group: "seo" },
    defineField({
      name: "ancestorPaths",
      title: "Parent page paths",
      type: "array",
      of: [defineArrayMember({ type: "string" })],
      fieldset: DEV,
      description: "Used to highlight the parent menu item.",
    }),
    defineField({ name: "wpTemplate", title: "WordPress template", type: "string", fieldset: DEV, readOnly: true }),
    ...layoutFields,
  ],
  preview: { select: { title: "title", subtitle: "path" } },
  orderings: [{ title: "Path", name: "path", by: [{ field: "path", direction: "asc" }] }],
});

export const post = defineType({
  name: "post",
  title: "Blog post",
  type: "document",
  fieldsets: [devFieldset],
  groups: [
    { name: "content", title: "Content", default: true },
    { name: "seo", title: "SEO" },
  ],
  fields: [
    defineField({ name: "title", title: "Title", type: "string", group: "content", validation: (r) => r.required() }),
    { ...pathField, group: "content", description: "e.g. /blog/my-new-post/" },
    defineField({ name: "date", title: "Published", type: "datetime", group: "content", validation: (r) => r.required() }),
    defineField({ name: "modified", title: "Updated", type: "datetime", group: "content" }),
    defineField({ name: "author", title: "Author", type: "reference", to: [{ type: "author" }], group: "content" }),
    defineField({ name: "categories", title: "Categories", type: "array", of: [defineArrayMember({ type: "reference", to: [{ type: "category" }] })], group: "content" }),
    defineField({ name: "featuredImage", title: "Featured image", type: "wpImage", group: "content" }),
    defineField({ name: "excerpt", title: "Excerpt (blog grid)", type: "text", rows: 3, group: "content" }),
    { ...nodesField("content", "Content (page builder)"), group: "content", hidden: ({ document }: { document?: Record<string, unknown> }) => Boolean(document?.body && !document?.content) },
    defineField({ name: "body", title: "Text", type: "richText", group: "content", hidden: ({ document }) => Boolean(document?.content && !document?.body) }),
    defineField({ name: "bodyHtml", title: "Text (HTML)", type: "text", rows: 10, group: "content", hidden: ({ document }) => !document?.bodyHtml }),
    { ...seoField, group: "seo" },
    defineField({ name: "featuredMedium", title: "Featured image (300px)", type: "wpImage", fieldset: DEV }),
    defineField({ name: "articleClass", title: "Article classes", type: "string", fieldset: DEV }),
    defineField({ name: "cardClass", title: "Blog card classes", type: "string", fieldset: DEV }),
    defineField({ name: "wpTemplate", title: "WordPress template", type: "string", fieldset: DEV, readOnly: true }),
    ...layoutFields,
  ],
  preview: { select: { title: "title", subtitle: "path", media: "featuredImage.upload" } },
  orderings: [{ title: "Newest", name: "dateDesc", by: [{ field: "date", direction: "desc" }] }],
});

export const archivePage = defineType({
  name: "archivePage",
  title: "Blog listing",
  type: "document",
  fieldsets: [devFieldset],
  fields: [
    defineField({ name: "title", title: "Title", type: "string" }),
    defineField({ name: "kind", title: "Lists", type: "string", options: { list: ["blog", "category", "author"] }, readOnly: true }),
    pathField,
    defineField({ name: "author", title: "Author", type: "reference", to: [{ type: "author" }], hidden: ({ document }) => document?.kind !== "author" }),
    defineField({ name: "category", title: "Category", type: "reference", to: [{ type: "category" }], hidden: ({ document }) => document?.kind !== "category" }),
    nodesField("content", "Content (Elementor archive)"),
    seoField,
    ...layoutFields,
  ],
  preview: { select: { title: "title", subtitle: "path" } },
});

export const notFoundPage = defineType({
  name: "notFoundPage",
  title: "404 page",
  type: "document",
  fieldsets: [devFieldset],
  fields: [defineField({ name: "title", title: "Title", type: "string" }), seoField, ...layoutFields],
});

export const elementorTemplate = defineType({
  name: "elementorTemplate",
  title: "Header, footer & popups",
  type: "document",
  fieldsets: [devFieldset],
  fields: [
    defineField({ name: "title", title: "Name", type: "string" }),
    defineField({ name: "kind", title: "Type", type: "string", readOnly: true }),
    nodesField("content", "Content"),
    defineField({ name: "wpId", title: "Elementor ID", type: "number", fieldset: DEV, readOnly: true }),
    defineField({ name: "tpl", title: "Template", type: "text", rows: 4, fieldset: DEV, readOnly: true }),
  ],
  preview: { select: { title: "title", subtitle: "kind" } },
});

export const author = defineType({
  name: "author",
  title: "Author",
  type: "document",
  fields: [
    defineField({ name: "name", title: "Name", type: "string", validation: (r) => r.required() }),
    defineField({ name: "slug", title: "Slug", type: "slug", options: { source: "name" }, validation: (r) => r.required() }),
    defineField({ name: "description", title: "Bio", type: "text", rows: 3 }),
    defineField({ name: "avatar", title: "Avatar URL", type: "string" }),
    defineField({ name: "wpId", title: "WordPress ID", type: "number", readOnly: true }),
  ],
});

export const category = defineType({
  name: "category",
  title: "Category",
  type: "document",
  fields: [
    defineField({ name: "name", title: "Name", type: "string", validation: (r) => r.required() }),
    defineField({ name: "slug", title: "Slug", type: "slug", options: { source: "name" }, validation: (r) => r.required() }),
    defineField({ name: "description", title: "Description", type: "text", rows: 2 }),
    defineField({ name: "wpId", title: "WordPress ID", type: "number", readOnly: true }),
  ],
});

export const formSetting = defineType({
  name: "formSetting",
  title: "Form",
  type: "object",
  fields: [
    defineField({ name: "name", title: "Form name", type: "string" }),
    defineField({
      name: "formKey",
      title: "Form ID",
      type: "string",
      description: "post_id:form_id of the Elementor form, e.g. 4223:d854bea",
      validation: (r) => r.required(),
    }),
    defineField({ name: "redirect", title: "Thank-you page", type: "string", description: "Path to open after a successful submission, e.g. /thank-you-pavers/" }),
    defineField({ name: "message", title: "Success message", type: "string", description: "Shown when there is no thank-you page." }),
    defineField({ name: "tag", title: "Lead tag", type: "string", description: "Sent to GoHighLevel with the lead." }),
  ],
  preview: { select: { title: "name", subtitle: "redirect" } },
});

export const siteSettings = defineType({
  name: "siteSettings",
  title: "Site settings",
  type: "document",
  fields: [
    defineField({ name: "title", title: "Site name", type: "string" }),
    defineField({ name: "siteUrl", title: "Site URL", type: "url" }),
    defineField({ name: "header", title: "Header", type: "reference", to: [{ type: "elementorTemplate" }] }),
    defineField({ name: "footer", title: "Footer", type: "reference", to: [{ type: "elementorTemplate" }] }),
    defineField({ name: "popups", title: "Popups", type: "array", of: [defineArrayMember({ type: "reference", to: [{ type: "elementorTemplate" }] })] }),
    defineField({ name: "postsPerPage", title: "Posts per blog page", type: "number", initialValue: 10 }),
    defineField({ name: "forms", title: "Forms", description: "Where each website form sends visitors after they submit.", type: "array", of: [defineArrayMember({ type: "formSetting" })] }),
  ],
  preview: { prepare: () => ({ title: "Site settings" }) },
});
