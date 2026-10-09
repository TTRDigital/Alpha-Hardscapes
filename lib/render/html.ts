/** Escaping helpers shared by the renderer and the migration scripts. */

/** "{year}" in any text field prints the current year (e.g. the footer copyright). */
export function withYear(text: string): string {
  return text.replace(/\{year\}/g, String(new Date().getUTCFullYear()));
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function escapeAttr(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Old WordPress host, rewritten to root-relative links everywhere. */
export const LEGACY_ORIGIN = "https://alphahardscapes.com";

/** Turns links to the old WordPress host into root-relative links. */
export function relativeUrl(url: string): string {
  return url
    .replace(/^https?:\/\/(www\.)?alphahardscapes\.com(?=\/|$)/i, "")
    .replace(/^\/\/(www\.)?alphahardscapes\.com(?=\/|$)/i, "") || "/";
}
