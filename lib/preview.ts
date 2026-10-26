import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Draft preview for TTR OS's page fixer, which reads a page's unpublished
 * Sanity changes before publishing them. Same contract as the Beverly Hills
 * Dental Arts site, so TTR OS treats both alike:
 *
 *   GET /api/preview?path=<path>&exp=<unix seconds>&sig=<hex HMAC-SHA256 of "<path>\n<exp>">
 *
 * signed with PREVIEW_SECRET (or SANITY_PREVIEW_SECRET). A valid link turns on
 * draft mode and goes to the path; pages then read Sanity's drafts with
 * SANITY_READ_TOKEN (lib/site/data.ts). Without the secret the route refuses,
 * without the token pages read published content: the site works as before.
 */

/** Signed links are good for at most this long. */
export const PREVIEW_MAX_DAYS = 31;

export const NOT_SET_UP = "Previews are not set up on this site.";
const EXPIRED = "This preview link has expired. Ask TTR for a new one.";
const INVALID = "This preview link is not valid.";
const BAD_PATH = "That page address is not valid.";

/** A page path on this site: "/" then URL-safe characters, never "//host". */
const PATH = /^\/(?!\/)[A-Za-z0-9\-._~/]*$/;

export type PreviewLink = { path?: string | null; exp?: string | null; sig?: string | null };
export type PreviewCheck = { ok: true; path: string } | { ok: false; why: string };

export function previewSecret(): string {
  return process.env.PREVIEW_SECRET || process.env.SANITY_PREVIEW_SECRET || "";
}

export function checkPreviewLink(link: PreviewLink, secret: string, now = Date.now()): PreviewCheck {
  if (!secret) return { ok: false, why: NOT_SET_UP };
  const path = link.path || "";
  const exp = link.exp || "";
  const sig = link.sig || "";
  if (path.length > 300 || !PATH.test(path)) return { ok: false, why: BAD_PATH };
  if (!/^\d{9,11}$/.test(exp)) return { ok: false, why: INVALID };
  const seconds = Number(exp);
  const nowSeconds = Math.floor(now / 1000);
  if (seconds < nowSeconds) return { ok: false, why: EXPIRED };
  if (seconds > nowSeconds + PREVIEW_MAX_DAYS * 86400) return { ok: false, why: INVALID };
  if (!/^[0-9a-f]{64}$/.test(sig)) return { ok: false, why: INVALID };
  const expected = createHmac("sha256", secret).update(`${path}\n${exp}`).digest();
  if (!timingSafeEqual(Buffer.from(sig, "hex"), expected)) return { ok: false, why: INVALID };
  return { ok: true, path };
}

/** True while this request is in draft mode. Only on Vercel; false anywhere else and on any error. */
export async function isPreview(): Promise<boolean> {
  if (!process.env.VERCEL) return false;
  try {
    const { draftMode } = await import("next/headers");
    return (await draftMode()).isEnabled;
  } catch {
    return false;
  }
}

/** Headers on every preview route response. */
export const PREVIEW_HEADERS = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };
