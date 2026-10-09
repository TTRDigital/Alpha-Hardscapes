export const dynamic = "force-static";

export function GET() {
  const origin = (process.env.NEXT_PUBLIC_SITE_URL || "https://alphahardscapes.com").replace(/\/$/, "");
  return new Response(`User-agent: *\nDisallow:\n\nSitemap: ${origin}/sitemap_index.xml\n`, { headers: { "Content-Type": "text/plain" } });
}
