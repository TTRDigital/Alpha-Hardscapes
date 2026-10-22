export const dynamic = "force-static";

/** llms.txt: what the business is and where its main pages are, for AI search. */
export function GET() {
  const origin = (process.env.NEXT_PUBLIC_SITE_URL || "https://alphahardscapes.com").replace(/\/$/, "");
  const body = `# Alpha Hardscapes

> Hardscaping, masonry and landscaping contractor serving New Haven, Hartford and Fairfield counties in Connecticut: patios and walkways, retaining walls, stone steps, outdoor kitchens and fire features, outdoor living packages, pool and deck building, chimney work, landscaping, repairs and seasonal clean-up. Phone +1-475-227-6896.

## Main pages
- [Home](${origin}/)
- [About us](${origin}/about-us/)
- [Reviews](${origin}/reviews/)
- [Gallery](${origin}/gallery/)
- [Frequently asked questions](${origin}/frequently-asked-questions/)
- [Contact](${origin}/contact/)
- [Service areas](${origin}/service-areas/)

## Services
- [Masonry](${origin}/masonry/)
- [Walkways and patios](${origin}/walkway-patio-connecticut/)
- [Retaining walls](${origin}/retaining-walls-connecticut/)
- [Stone steps](${origin}/stone-steps-connecticut/)
- [Thinstone](${origin}/thinstone-connecticut/)
- [Outdoor kitchens](${origin}/outdoor-kitchens-connecticut/)
- [Fire features](${origin}/fire-features-connecticut/)
- [Outdoor living packages](${origin}/outdoor-living-packages-connecticut/)
- [Pool builders](${origin}/pool-builders-south-connecticut/)
- [Deck builders](${origin}/deck-builders-connecticut/)
- [Chimney installation and repair](${origin}/chimney-installation-and-repair-connecticut/)
- [Landscaping](${origin}/landscaping/)
- [Repairs and maintenance](${origin}/repairs-maintenance-connecticut/)
- [Seasonal clean-up](${origin}/seasonal-clean-up/)

## Areas
- [Hartford County](${origin}/hartford-county-ct/)
- [New Haven County](${origin}/new-haven-county-ct/)
- [Fairfield County](${origin}/fairfield-county-ct/)
- [Locations](${origin}/locations/)

## More
- [Blog](${origin}/blog/)
- [Sitemap](${origin}/sitemap_index.xml)
`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=UTF-8" } });
}
