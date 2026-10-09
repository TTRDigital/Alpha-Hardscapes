import type { StructureResolver } from "sanity/structure";

export const structure: StructureResolver = (S) =>
  S.list()
    .title("Alpha Hardscapes")
    .items([
      S.listItem().title("Pages").schemaType("page").child(S.documentTypeList("page").title("Pages").defaultOrdering([{ field: "path", direction: "asc" }])),
      S.listItem().title("Blog posts").schemaType("post").child(S.documentTypeList("post").title("Blog posts").defaultOrdering([{ field: "date", direction: "desc" }])),
      S.divider(),
      S.listItem().title("Header, footer & popups").schemaType("elementorTemplate").child(S.documentTypeList("elementorTemplate").title("Header, footer & popups")),
      S.listItem().title("Blog listings").schemaType("archivePage").child(S.documentTypeList("archivePage").title("Blog listings")),
      S.listItem().title("Authors").schemaType("author").child(S.documentTypeList("author")),
      S.listItem().title("Categories").schemaType("category").child(S.documentTypeList("category")),
      S.divider(),
      S.listItem().title("Site settings").id("siteSettings").child(S.document().schemaType("siteSettings").documentId("siteSettings")),
      S.listItem().title("404 page").id("notFound").child(S.document().schemaType("notFoundPage").documentId("notFound")),
    ]);
