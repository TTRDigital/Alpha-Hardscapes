import { defineArrayMember, defineField, defineType, type FieldDefinition } from "sanity";

/**
 * Building blocks of every page. Each block keeps the exact markup the
 * WordPress site printed in its template (Developer section, read-only),
 * so editing a text, link or image changes only that text, link or image
 * and the design stays identical. Duplicate a block to add a similar one.
 */

const DEV = "dev";
const devFieldset = { name: DEV, title: "Developer (layout template)", options: { collapsible: true, collapsed: true } };

/** Read-only fields that hold the layout. */
export const devFields: FieldDefinition[] = [
  defineField({ name: "tpl", title: "Template", type: "text", rows: 4, fieldset: DEV, readOnly: true }),
  defineField({ name: "elId", title: "Element ID", type: "string", fieldset: DEV, readOnly: true }),
  defineField({ name: "widget", title: "Widget", type: "string", fieldset: DEV, readOnly: true }),
  defineField({ name: "mergedIds", title: "Merged wrapper IDs", type: "array", of: [{ type: "string" }], fieldset: DEV, readOnly: true }),
];

/** A text field plus its HTML twin (used when the original text had inline markup). */
function textPair(name: string, title: string, rows = 1): FieldDefinition[] {
  return [
    rows > 1
      ? defineField({ name, title, type: "text", rows, hidden: ({ parent }) => Boolean(parent?.[`${name}Html`]) })
      : defineField({ name, title, type: "string", hidden: ({ parent }) => Boolean(parent?.[`${name}Html`]) }),
    defineField({
      name: `${name}Html`,
      title: `${title} (HTML)`,
      type: "text",
      rows: Math.max(rows, 2),
      description: "This text contains formatting (bold, links, line breaks), so it is edited as HTML.",
      hidden: ({ parent }) => !parent?.[`${name}Html`],
    }),
  ];
}

const link = (name = "link", title = "Link") =>
  defineField({ name, title, type: "string", description: "A page path like /masonry/, a full URL, tel: or mailto:." });

export const NODE_TYPES = [
  "elContainer",
  "elHeading",
  "elText",
  "elRichText",
  "elImage",
  "elButton",
  "elIconBox",
  "elIconList",
  "elSocialIcons",
  "elIcon",
  "elVideo",
  "elMap",
  "elAccordion",
  "elReviews",
  "elCarousel",
  "elImageGallery",
  "elGallery",
  "elNavMenu",
  "elEmbed",
  "elHtmlCode",
  "elForm",
  "elRaw",
] as const;

export const nodesField = (name: string, title: string) =>
  defineField({ name, title, type: "array", of: NODE_TYPES.map((type) => defineArrayMember({ type })) });

/** First readable text inside a block, for list previews. */
function firstText(value: unknown, depth = 0): string | undefined {
  if (!value || depth > 8) return undefined;
  if (Array.isArray(value)) {
    for (const v of value) {
      const t = firstText(v, depth + 1);
      if (t) return t;
    }
    return undefined;
  }
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    for (const k of ["title", "text", "label", "name"]) if (typeof o[k] === "string" && (o[k] as string).trim()) return (o[k] as string).trim();
    for (const k of ["titleHtml", "textHtml"]) if (typeof o[k] === "string") return (o[k] as string).replace(/<[^>]+>/g, "").trim();
    if (o._type === "span" && typeof o.text === "string") return o.text;
    for (const k of ["children", "content", "items", "body"]) {
      const t = firstText(o[k], depth + 1);
      if (t) return t;
    }
  }
  return undefined;
}

const PREVIEW_SELECT = Object.fromEntries(
  ["title", "titleHtml", "text", "textHtml", "label", "name", "link", "widget", "image", "children", "content", "items", "body"].map((k) => [k, k]),
);

const short = (s?: string, n = 70) => (s && s.length > n ? `${s.slice(0, n)}…` : s);

function block(name: string, title: string, fields: FieldDefinition[], previewText?: (v: Record<string, unknown>) => string | undefined) {
  return defineType({
    name,
    title,
    type: "object",
    fieldsets: [devFieldset],
    fields: [...fields, ...devFields],
    preview: {
      select: PREVIEW_SELECT,
      prepare(v: Record<string, unknown>) {
        return { title: short(previewText?.(v) || firstText(v)) || title, subtitle: title };
      },
    },
  });
}

const imageField = (name = "image", title = "Image") => defineField({ name, title, type: "wpImage" });

export const nodeTypes = [
  block("elContainer", "Section", [nodesField("children", "Content")], (v) => {
    const t = firstText(v.children);
    return t ? `Section: ${t}` : "Section";
  }),
  block("elHeading", "Heading", [...textPair("title", "Text"), link()]),
  block("elText", "Text", [
    defineField({ name: "body", title: "Text", type: "richText", hidden: ({ parent }) => Boolean(parent?.bodyHtml) }),
    defineField({ name: "bodyHtml", title: "Text (HTML)", type: "text", rows: 8, hidden: ({ parent }) => !parent?.bodyHtml }),
  ]),
  block("elRichText", "Article text", [defineField({ name: "body", title: "Text", type: "richText" })]),
  block("elImage", "Image", [imageField(), link(), ...textPair("caption", "Caption")], (v) => (v.image as { alt?: string })?.alt || "Image"),
  block("elButton", "Button", [...textPair("text", "Label"), link()]),
  block("elIconBox", "Icon box", [...textPair("title", "Title"), link(), link("iconLink", "Icon link"), ...textPair("description", "Description", 3)]),
  block("elIconList", "Icon list", [defineField({ name: "items", title: "Items", type: "array", of: [defineArrayMember({ type: "iconListItem" })] })]),
  block("elSocialIcons", "Social icons", [defineField({ name: "items", title: "Icons", type: "array", of: [defineArrayMember({ type: "socialIconsItem" })] })]),
  block("elIcon", "Icon", [link()], () => "Icon"),
  block("elVideo", "Video", [defineField({ name: "videoUrl", title: "Video file URL", type: "string" })], () => "Video"),
  block("elMap", "Google map", [
    defineField({ name: "mapTitle", title: "Place", type: "string" }),
    defineField({ name: "mapUrl", title: "Map embed URL", type: "string" }),
  ]),
  block("elAccordion", "FAQ / accordion", [defineField({ name: "items", title: "Questions", type: "array", of: [defineArrayMember({ type: "accordionItem" })] })]),
  block("elReviews", "Reviews slider", [defineField({ name: "items", title: "Reviews", type: "array", of: [defineArrayMember({ type: "reviewsItem" })] })], () => "Reviews"),
  block("elCarousel", "Image slider", [defineField({ name: "items", title: "Slides", type: "array", of: [defineArrayMember({ type: "carouselItem" })] })], () => "Image slider"),
  block("elImageGallery", "Image grid", [defineField({ name: "items", title: "Images", type: "array", of: [defineArrayMember({ type: "imageGalleryItem" })] })], () => "Image grid"),
  block("elGallery", "Filterable gallery", [defineField({ name: "items", title: "Photos", type: "array", of: [defineArrayMember({ type: "galleryItem" })] })], () => "Gallery"),
  block("elNavMenu", "Menu", [defineField({ name: "items", title: "Menu items", type: "array", of: [defineArrayMember({ type: "navItem" })] })], () => "Menu"),
  block("elEmbed", "Shared section", [nodesField("children", "Content")]),
  block("elHtmlCode", "HTML code", [defineField({ name: "html", title: "HTML", type: "text", rows: 6 })], () => "HTML code"),
  block("elForm", "Quote form", [], () => "Quote form (fields are part of the layout)"),
  block("elRaw", "Layout element", [], (v) => (v.widget ? `Layout element (${v.widget})` : "Layout element")),
];

function item(name: string, title: string, fields: FieldDefinition[], previewText?: (v: Record<string, unknown>) => string | undefined) {
  return defineType({
    name,
    title,
    type: "object",
    fieldsets: [devFieldset],
    fields: [...fields, defineField({ name: "tpl", title: "Template", type: "text", rows: 3, fieldset: DEV, readOnly: true })],
    preview: {
      select: PREVIEW_SELECT,
      prepare(v: Record<string, unknown>) {
        return { title: short(previewText?.(v) || firstText(v)) || title };
      },
    },
  });
}

export const itemTypes = [
  item("iconListItem", "List item", [...textPair("text", "Text"), link()]),
  item("socialIconsItem", "Social icon", [defineField({ name: "label", title: "Network", type: "string" }), link()]),
  item("accordionItem", "Question", [...textPair("title", "Question"), nodesField("content", "Answer")]),
  item("reviewsItem", "Review", [
    defineField({ name: "name", title: "Name", type: "string" }),
    defineField({ name: "title", title: "Subtitle", type: "string" }),
    defineField({ name: "text", title: "Review", type: "text", rows: 4 }),
    imageField("image", "Photo"),
    link("link", "Link (e.g. Google review)"),
  ], (v) => v.name as string),
  item("carouselItem", "Slide", [imageField(), link()], (v) => (v.image as { alt?: string })?.alt || "Slide"),
  item("imageGalleryItem", "Image", [imageField(), link("link", "Full-size image URL")], (v) => (v.image as { alt?: string })?.alt || "Image"),
  item("galleryItem", "Photo", [
    defineField({ name: "thumbnail", title: "Thumbnail URL", type: "string" }),
    defineField({ name: "link", title: "Full-size image URL", type: "string" }),
  ], (v) => String(v.link || "").split("/").pop()),
  defineType({
    name: "navItem",
    title: "Menu item",
    type: "object",
    fieldsets: [devFieldset],
    fields: [
      defineField({ name: "label", title: "Label", type: "string" }),
      link(),
      defineField({ name: "children", title: "Sub-menu", type: "array", of: [defineArrayMember({ type: "navItem" })] }),
      defineField({ name: "classes", title: "Item classes", type: "string", fieldset: DEV, readOnly: true }),
      defineField({ name: "linkClasses", title: "Link classes", type: "string", fieldset: DEV, readOnly: true }),
      defineField({ name: "pageId", title: "WordPress page ID", type: "number", fieldset: DEV, readOnly: true }),
      defineField({ name: "wpId", title: "WordPress menu item ID", type: "number", fieldset: DEV, readOnly: true }),
      defineField({ name: "tpl", title: "Template", type: "text", rows: 3, fieldset: DEV, readOnly: true }),
      defineField({ name: "tplDropdown", title: "Template (mobile menu)", type: "text", rows: 3, fieldset: DEV, readOnly: true }),
    ],
    preview: { select: { title: "label", subtitle: "link" } },
  }),
];

/** Image: the original WordPress file, replaceable by uploading a new one. */
export const wpImage = defineType({
  name: "wpImage",
  title: "Image",
  type: "object",
  fieldsets: [{ name: "file", title: "Original file", options: { collapsible: true, collapsed: true } }],
  fields: [
    defineField({
      name: "upload",
      title: "Replace image",
      type: "image",
      description: "Upload a new image to replace the current one. It is shown at the same size and crop as before.",
    }),
    defineField({ name: "alt", title: "Alt text", type: "string" }),
    defineField({ name: "src", title: "Current file", type: "string", fieldset: "file" }),
    defineField({ name: "srcset", title: "Sizes (srcset)", type: "text", rows: 2, fieldset: "file", readOnly: true }),
    defineField({ name: "sizes", title: "sizes attribute", type: "string", fieldset: "file", readOnly: true }),
    defineField({ name: "width", title: "Width", type: "string", fieldset: "file", readOnly: true }),
    defineField({ name: "height", title: "Height", type: "string", fieldset: "file", readOnly: true }),
    defineField({ name: "attrs", title: "Other attributes", type: "string", fieldset: "file", readOnly: true }),
  ],
  preview: {
    select: { alt: "alt", src: "src", upload: "upload" },
    prepare({ alt, src, upload }) {
      return { title: alt || String(src || "").split("/").pop() || "Image", media: upload };
    },
  },
});

/** Rich text: the formatting the old site used (headings, lists, bold, links). */
export const richText = defineType({
  name: "richText",
  title: "Rich text",
  type: "array",
  of: [
    defineArrayMember({
      type: "block",
      styles: [
        { title: "Paragraph", value: "normal" },
        { title: "Heading 2", value: "h2" },
        { title: "Heading 3", value: "h3" },
        { title: "Heading 4", value: "h4" },
        { title: "Heading 5", value: "h5" },
        { title: "Heading 6", value: "h6" },
        { title: "Heading 1", value: "h1" },
        { title: "Text without paragraph", value: "bare" },
      ],
      lists: [
        { title: "Bullets", value: "bullet" },
        { title: "Numbers", value: "number" },
      ],
      marks: {
        decorators: [
          { title: "Bold", value: "strong" },
          { title: "Italic", value: "em" },
          { title: "Underline", value: "underline" },
          { title: "Bold (b)", value: "b" },
          { title: "Italic (i)", value: "i" },
        ],
        annotations: [
          defineArrayMember({
            name: "link",
            type: "object",
            title: "Link",
            fields: [
              defineField({ name: "href", title: "URL", type: "string" }),
              defineField({ name: "target", title: "Target", type: "string", description: "_blank opens a new tab" }),
              defineField({ name: "rel", title: "rel", type: "string" }),
              defineField({ name: "extra", title: "Other attributes", type: "string", readOnly: true }),
            ],
          }),
          defineArrayMember({
            name: "inlineStyle",
            type: "object",
            title: "Inline style",
            fields: [
              defineField({ name: "tag", title: "Tag", type: "string" }),
              defineField({ name: "style", title: "CSS", type: "string" }),
              defineField({ name: "extra", title: "Other attributes", type: "string", readOnly: true }),
            ],
          }),
        ],
      },
    }),
    defineArrayMember({
      name: "htmlBlock",
      title: "HTML (table, buttons)",
      type: "object",
      fields: [defineField({ name: "html", title: "HTML", type: "text", rows: 8 })],
      preview: {
        select: { html: "html" },
        prepare: ({ html }) => ({ title: String(html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "HTML", subtitle: "HTML" }),
      },
    }),
  ],
});
