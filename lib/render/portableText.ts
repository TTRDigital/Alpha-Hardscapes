import { escapeAttr, escapeHtml, withYear } from "./html.ts";

/**
 * Portable Text as used by the rich text fields (Elementor "Text editor"
 * widgets). The HTML produced here matches the markup WordPress printed:
 * paragraphs, headings, lists, bold/italic/underline, links and the odd
 * inline style. Anything richer (tables, button blocks) is kept as an
 * `htmlBlock` and printed as is.
 */

export type PtSpan = { _type: "span"; _key?: string; text: string; marks?: string[] };
export type PtMarkDef =
  | { _type: "link"; _key: string; href?: string; target?: string; rel?: string; extra?: string }
  | { _type: "inlineStyle"; _key: string; tag?: string; style?: string; extra?: string };
export type PtTextBlock = {
  _type: "block";
  _key?: string;
  style?: string;
  listItem?: "bullet" | "number";
  level?: number;
  markDefs?: PtMarkDef[];
  children: PtSpan[];
};
export type PtHtmlBlock = { _type: "htmlBlock"; _key?: string; html: string };
export type PtBlock = PtTextBlock | PtHtmlBlock;

const DECORATORS: Record<string, string> = { strong: "strong", em: "em", underline: "u", b: "b", i: "i" };

function openMark(mark: string, defs: Map<string, PtMarkDef>): [string, string] {
  if (DECORATORS[mark]) return [`<${DECORATORS[mark]}>`, `</${DECORATORS[mark]}>`];
  const def = defs.get(mark);
  if (!def) return ["", ""];
  if (def._type === "link") {
    const attrs = [
      def.href != null ? ` href="${escapeAttr(def.href)}"` : "",
      def.target ? ` target="${escapeAttr(def.target)}"` : "",
      def.rel ? ` rel="${escapeAttr(def.rel)}"` : "",
      def.extra ? ` ${def.extra}` : "",
    ].join("");
    return [`<a${attrs}>`, "</a>"];
  }
  const tag = def.tag || "span";
  return [`<${tag}${def.style ? ` style="${escapeAttr(def.style)}"` : ""}${def.extra ? ` ${def.extra}` : ""}>`, `</${tag}>`];
}

function spanText(text: string): string {
  return escapeHtml(withYear(text)).replace(/\n/g, "<br>");
}

/** Renders spans, nesting shared marks the way they were nested originally. */
function renderSpans(spans: PtSpan[], defs: Map<string, PtMarkDef>, depth = 0): string {
  let out = "";
  let i = 0;
  while (i < spans.length) {
    const marks = spans[i].marks || [];
    const mark = marks[depth];
    if (mark === undefined) {
      out += spanText(spans[i].text);
      i++;
      continue;
    }
    let j = i;
    while (j < spans.length && (spans[j].marks || [])[depth] === mark && sameUpTo(spans[i], spans[j], depth)) j++;
    const [open, close] = openMark(mark, defs);
    out += open + renderSpans(spans.slice(i, j), defs, depth + 1) + close;
    i = j;
  }
  return out;
}

function sameUpTo(a: PtSpan, b: PtSpan, depth: number) {
  for (let d = 0; d < depth; d++) if ((a.marks || [])[d] !== (b.marks || [])[d]) return false;
  return true;
}

function renderBlockInner(block: PtTextBlock) {
  const defs = new Map((block.markDefs || []).map((d) => [d._key, d]));
  return renderSpans(block.children || [], defs);
}

function blockTag(style?: string) {
  if (!style || style === "normal") return "p";
  if (/^h[1-6]$/.test(style)) return style;
  if (style === "blockquote") return "blockquote";
  return "";
}

export function renderPortableText(blocks: PtBlock[] | undefined | null): string {
  if (!blocks?.length) return "";
  let out = "";
  let i = 0;
  while (i < blocks.length) {
    const block = blocks[i];
    if (block._type === "htmlBlock") {
      out += block.html;
      i++;
      continue;
    }
    if (block.listItem) {
      const [html, next] = renderList(blocks, i, block.level || 1);
      out += html;
      i = next;
      continue;
    }
    const tag = blockTag(block.style);
    out += tag ? `<${tag}>${renderBlockInner(block)}</${tag}>` : renderBlockInner(block);
    i++;
  }
  return out;
}

/** Renders consecutive list items starting at `start` for the given level. */
function renderList(blocks: PtBlock[], start: number, level: number): [string, number] {
  const first = blocks[start] as PtTextBlock;
  const tag = first.listItem === "number" ? "ol" : "ul";
  let out = `<${tag}>`;
  let i = start;
  while (i < blocks.length) {
    const b = blocks[i];
    if (b._type !== "block" || !b.listItem) break;
    const lvl = b.level || 1;
    if (lvl < level) break;
    if (lvl === level && b.listItem !== first.listItem) break;
    if (lvl > level) {
      // Nested list without a parent item (should not happen); render inline.
      const [html, next] = renderList(blocks, i, lvl);
      out += html;
      i = next;
      continue;
    }
    out += `<li>${renderBlockInner(b)}`;
    i++;
    const nxt = blocks[i];
    if (nxt && nxt._type === "block" && nxt.listItem && (nxt.level || 1) > level) {
      const [html, next] = renderList(blocks, i, (nxt.level || 1));
      out += html;
      i = next;
    }
    out += "</li>";
  }
  return [out + `</${tag}>`, i];
}
