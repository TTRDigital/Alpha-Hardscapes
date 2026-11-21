import { recaptchaKeys } from "@/lib/spam";

/**
 * Public form settings for pages that are plain HTML files (public/patios-walkways/): the reCAPTCHA
 * site key, only when both RECAPTCHA_SITE_KEY and RECAPTCHA_SECRET_KEY are set, else null (then the
 * page shows no checkbox and the server does not ask for one). The site key is public by design.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    { recaptchaSiteKey: recaptchaKeys()?.siteKey ?? null },
    { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } },
  );
}
