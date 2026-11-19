import { draftMode } from "next/headers";
import { PREVIEW_HEADERS } from "@/lib/preview";

/** Ends draft preview and returns to the home page. */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  (await draftMode()).disable();
  return new Response(null, { status: 307, headers: { ...PREVIEW_HEADERS, Location: new URL("/", req.url).toString() } });
}
