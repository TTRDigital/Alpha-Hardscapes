import { draftMode } from "next/headers";
import { safePath } from "@/lib/preview";

/** Ends draft preview and returns to the page (?path=, this site only) or the home page. */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  (await draftMode()).disable();
  const path = safePath(new URL(req.url).searchParams.get("path")) || "/";
  return new Response(null, { status: 307, headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow", Location: path } });
}
