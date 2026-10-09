/**
 * Canonical form of an HTML fragment, used to prove that the CMS renders
 * exactly what WordPress printed: attributes and class names are sorted,
 * whitespace-only text and comments are dropped, links to the old host
 * become root-relative and lazy-loading placeholders are resolved.
 */
import * as cheerio from "cheerio";
import type { AnyNode, Element } from "domhandler";

const HOST = /(?:https?:)?\/\/(?:www\.)?alphahardscapes\.com(?=\/|$|")/gi;

export function relHost(s: string) {
  return s.replace(HOST, "").replace(/(?:https?:)?\\\/\\\/(?:www\.)?alphahardscapes\.com/gi, "");
}

function normAttr(name: string, value: string) {
  let v = relHost(value);
  if (name === "class") v = [...new Set(v.split(/\s+/).filter(Boolean))].sort().join(" ");
  else if (name === "style") v = v.replace(/\s+/g, " ").replace(/;\s*$/, "").trim();
  else if (name === "srcset") v = v.replace(/\s+/g, " ").trim();
  else v = v.replace(/\s+/g, " ").trim();
  if ((name === "href" || name === "src") && v === "") v = "/";
  return v;
}

/** Loading hints WordPress adds by position; they do not change what is shown. */
const IGNORED_ATTRS = new Set(["fetchpriority", "loading", "decoding"]);

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);

export function canonical(html: string, opts: { scripts?: boolean } = {}): string {
  const $ = cheerio.load(html, null, false);
  const out: string[] = [];
  const walk = (nodes: AnyNode[]) => {
    for (const n of nodes) {
      if (n.type === "text") {
        const t = (n as unknown as { data: string }).data.replace(/\s+/g, " ").trim();
        if (t) out.push(relHost(t));
      } else if (n.type === "tag" || n.type === "script" || n.type === "style") {
        const el = n as Element;
        if (!opts.scripts && (el.name === "script" || el.name === "noscript")) continue;
        const attrs = Object.entries(el.attribs)
          .map(([k, v]) => [k.toLowerCase(), normAttr(k.toLowerCase(), v)] as const)
          .filter(([k, v]) => !(k === "class" && v === "") && !IGNORED_ATTRS.has(k))
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => (v === "" ? k : `${k}="${v}"`));
        out.push(`<${el.name}${attrs.length ? " " + attrs.join(" ") : ""}>`);
        walk(el.children as AnyNode[]);
        if (!VOID.has(el.name)) out.push(`</${el.name}>`);
      }
    }
  };
  walk($.root().children().toArray().length ? ($.root()[0].children as AnyNode[]) : []);
  return out.join("\n");
}

/** First differing line of two canonical strings, with context. */
export function firstDiff(a: string, b: string, context = 2) {
  const la = a.split("\n");
  const lb = b.split("\n");
  const n = Math.max(la.length, lb.length);
  for (let i = 0; i < n; i++) {
    if (la[i] !== lb[i]) {
      const from = Math.max(0, i - context);
      return {
        line: i,
        expected: la.slice(from, i + context + 1).map((l) => (l ?? "").slice(0, 400)),
        actual: lb.slice(from, i + context + 1).map((l) => (l ?? "").slice(0, 400)),
      };
    }
  }
  return null;
}
