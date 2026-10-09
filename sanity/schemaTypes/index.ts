import { itemTypes, nodeTypes, richText, wpImage } from "./content";
import { archivePage, author, category, elementorTemplate, formSetting, notFoundPage, page, post, seo, siteSettings } from "./documents";

export const schemaTypes = [
  siteSettings,
  page,
  post,
  archivePage,
  notFoundPage,
  elementorTemplate,
  author,
  category,
  seo,
  formSetting,
  wpImage,
  richText,
  ...nodeTypes,
  ...itemTypes,
];

/** Documents that exist once and cannot be created, duplicated or deleted. */
export const singletonTypes = new Set(["siteSettings", "notFoundPage"]);
