import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Draft preview for TTR OS's page fixer, which reads a page's unpublished
 * Sanity changes before publishing them. It opens
 *
 *   GET /api/preview?path=<path>&exp=<unix seconds>&sig=<hex HMAC-SHA256 of "<path>\n<exp>" with PREVIEW_SECRET>
 *
 * and, when the signature is valid and not expired, gets draft mode and is
 * sent to the path, where pages read Sanity's drafts with SANITY_API_READ_TOKEN.
 * Both are server-only environment variables; without them preview is off and
 * the site works exactly as before.
 */

/** Signed links are short-lived: one that expires later than this is refused. */
const MAX_LIFETIME_SECONDS = 24 * 60 * 60;

export function previewConfigured(): boolean {
  return Boolean(process.env.PREVIEW_SECRET && process.env.SANITY_API_READ_TOKEN);
}

/** The Sanity read token for drafts, or undefined when preview is not set up. */
export function draftToken(): string | undefined {
  return previewConfigured() ? process.env.SANITY_API_READ_TOKEN : undefined;
}

/** A path on this site only: "/..." but not "//host" or "/\host", so the redirect cannot leave the site. */
export function safePath(path: string | null): string | null {
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\") || /[\r\n]/.test(path)) return null;
  return path;
}

export type PreviewCheck = { ok: true; path: string } | { ok: false; status: number; reason: string };

export function checkPreviewRequest(params: URLSearchParams, now = Date.now()): PreviewCheck {
  const secret = process.env.PREVIEW_SECRET;
  if (!secret || !process.env.SANITY_API_READ_TOKEN) return { ok: false, status: 503, reason: "Preview is not set up on this site." };

  const path = safePath(params.get("path"));
  const exp = params.get("exp") || "";
  const sig = (params.get("sig") || "").toLowerCase();
  if (!path || !/^\d{1,12}$/.test(exp) || !/^[0-9a-f]{64}$/.test(sig)) return { ok: false, status: 400, reason: "Missing or malformed path, exp or sig." };

  const seconds = Number(exp);
  const nowSeconds = Math.floor(now / 1000);
  if (seconds < nowSeconds) return { ok: false, status: 401, reason: "This preview link has expired." };
  if (seconds > nowSeconds + MAX_LIFETIME_SECONDS) return { ok: false, status: 401, reason: "This preview link expires too far in the future." };

  const expected = createHmac("sha256", secret).update(`${path}\n${exp}`).digest();
  const given = Buffer.from(sig, "hex");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { ok: false, status: 401, reason: "Invalid signature." };

  return { ok: true, path };
}
