import { getSite } from "@/lib/site/data";
import { deliverLead } from "@/lib/lead";
import { checkRecaptcha, countSpam, HONEYPOT_FIELD, spamReason, TIMER_FIELD } from "@/lib/spam";
import formFields from "@/content/form-fields.json";

/**
 * The Elementor forms post here, exactly as they posted to WordPress'
 * admin-ajax.php, and get the same JSON answer back (success message or
 * redirect to the form's thank-you page set in Site settings > Forms).
 */

export const dynamic = "force-dynamic";

type Json = Record<string, unknown>;
const reply = (body: Json, status = 200) => Response.json(body, { status });

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return reply({ success: false, data: { message: "Invalid request.", errors: [], data: [] } }, 400);
  }
  if (form.get("action") !== "elementor_pro_forms_send_form") return new Response("0", { status: 400 });

  const postId = String(form.get("post_id") || "");
  const formId = String(form.get("form_id") || "");
  // Field IDs (field_89fc83e) become their labels (Phone) for the CRM and the email.
  const labels = (formFields as Record<string, Record<string, string>>)[`${postId}:${formId}`] || {};
  const fields: Record<string, string> = {};
  for (const [k, v] of form.entries()) {
    const m = /^form_fields\[([^\]]+)\]/.exec(k);
    if (!m || typeof v !== "string") continue;
    const label = labels[m[1]] && labels[m[1]] !== m[1] ? labels[m[1]] : m[1];
    fields[label] = fields[label] ? `${fields[label]}, ${v}` : v;
  }
  const page = String(form.get("referrer") || req.headers.get("referer") || "");

  // Spam protection (lib/spam.ts, TTR-2495). Elementor's own honeypot fields and ours must stay empty.
  const honeypot = Object.entries(fields).some(([k, v]) => /honeypot/i.test(k) && v) ? "filled" : form.get(HONEYPOT_FIELD);
  const token = form.get("g-recaptcha-response");
  const captcha = await checkRecaptcha(typeof token === "string" ? token : null, req.headers.get("x-forwarded-for")?.split(",")[0]);
  // A person who did not tick the box is told so (only when reCAPTCHA is set up: both keys in Vercel).
  if (captcha === "fail" && !honeypot) {
    return reply({ success: false, data: { message: "Please confirm you are not a robot and try again.", errors: [], data: [] } });
  }
  const timer = form.get(TIMER_FIELD);
  const spam = spamReason({ honeypot: typeof honeypot === "string" ? honeypot : null, timer: typeof timer === "string" ? timer : null, captcha });

  const { settings } = await getSite();
  const setting = (settings.forms || []).find((f) => f.formKey === `${postId}:${formId}`) || (settings.forms || []).find((f) => f.formKey?.endsWith(`:${formId}`) && f.formKey.startsWith(`${postId}:`));
  // Only the site's own forms, and only with a way to reach the person: bots posting an empty or
  // made-up form straight at this address do not become leads in the CRM.
  const known = Boolean(setting) || Object.keys(labels).length > 0;
  const reachable = Object.entries(fields).some(([k, v]) => /name|phone|e-?mail/i.test(k) && v.trim());
  if (!known || !reachable) {
    return reply({ success: false, data: { message: "Please add your name and a phone number or email so we can reach you.", errors: [], data: [] } }, known ? 200 : 400);
  }
  if (spam) {
    // Dropped quietly: the same answer a person gets, nothing sent to GoHighLevel, counted in the logs.
    countSpam(setting?.name || `${postId}:${formId}`, spam, page);
    return thanks();
  }
  const delivered = await deliverLead({ form: setting?.name || `${postId}:${formId}`, fields, page, tag: setting?.tag });
  if (!delivered) {
    return reply({ success: false, data: { message: "Something went wrong. Please call us at (475) 227-6896.", errors: [], data: [] } });
  }
  return thanks();

  function thanks() {
    const origin = new URL(req.url).origin;
    const data: Json = setting?.redirect ? { redirect_url: new URL(setting.redirect, origin).toString() } : {};
    return reply({ success: true, data: { message: setting?.message ?? "Your submission was successful.", data } });
  }
}
