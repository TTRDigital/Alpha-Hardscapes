import { draftMode } from "next/headers";
import { checkPreviewRequest } from "@/lib/preview";

/**
 * Draft preview for TTR OS (lib/preview.ts): a valid, unexpired signed link turns on draft mode and
 * redirects to the page, which then shows Sanity's unpublished changes. Anything else is refused,
 * and without PREVIEW_SECRET and SANITY_API_READ_TOKEN the route answers 503.
 */
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

export async function GET(req: Request) {
  const check = checkPreviewRequest(new URL(req.url).searchParams);
  if (!check.ok) return new Response(check.reason, { status: check.status, headers: { ...NO_STORE, "Content-Type": "text/plain; charset=UTF-8" } });
  (await draftMode()).enable();
  return new Response(null, { status: 307, headers: { ...NO_STORE, Location: check.path } });
}
