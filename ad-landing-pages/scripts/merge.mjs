// Sanity doc -> same shape as content/*.json, then merged over the committed fallback.
const SECTION = (t) => (t || "").replace(/^lp/, "").replace(/^./, (c) => c.toLowerCase());
const META = new Set(["_id", "_rev", "_type", "_createdAt", "_updatedAt", "_key", "slug", "seoNote"]);

function clean(v) {
  if (Array.isArray(v)) return v.map(clean);
  if (v && typeof v === "object") {
    const o = {};
    for (const [k, x] of Object.entries(v)) if (!META.has(k) && x !== null && x !== undefined) o[k] = clean(x);
    if (v._type && /^lp[A-Z]/.test(v._type)) o.type = SECTION(v._type);
    return o;
  }
  return v;
}
export function normalizeSanityDoc(d) {
  const o = clean(d);
  if (o.sections && !Array.isArray(o.sections)) throw new Error("sections is not a list");
  return o;
}
// Objects merge field by field; lists and text replace. An empty string or empty list in Sanity does not wipe the fallback.
export function merge(base, over) {
  if (Array.isArray(over)) return over.length ? over : base;
  if (over && typeof over === "object" && base && typeof base === "object" && !Array.isArray(base)) {
    const o = { ...base };
    for (const [k, v] of Object.entries(over)) o[k] = k in base ? merge(base[k], v) : v;
    return o;
  }
  return over === "" || over === undefined ? base : over;
}
