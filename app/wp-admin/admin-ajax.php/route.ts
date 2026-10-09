import { getSite } from "@/lib/site/data";
import { deliverLead, verifyRecaptcha } from "@/lib/lead";
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

  // Honeypot fields (Elementor "honeypot" type) must stay empty.
  const honeypot = Object.entries(fields).some(([k, v]) => /honeypot/i.test(k) && v);
  const captcha = form.get("g-recaptcha-response");
  const human = !honeypot && (await verifyRecaptcha(typeof captcha === "string" ? captcha : null, req.headers.get("x-forwarded-for")?.split(",")[0]));
  if (!human) {
    return reply({ success: false, data: { message: "Please confirm you are not a robot and try again.", errors: [], data: [] } });
  }

  const { settings } = await getSite();
  const setting = (settings.forms || []).find((f) => f.formKey === `${postId}:${formId}`) || (settings.forms || []).find((f) => f.formKey?.endsWith(`:${formId}`) && f.formKey.startsWith(`${postId}:`));
  const delivered = await deliverLead({ form: setting?.name || `${postId}:${formId}`, fields, page, tag: setting?.tag });
  if (!delivered && (process.env.GHL_WEBHOOK_URL || process.env.RESEND_API_KEY)) {
    return reply({ success: false, data: { message: "Something went wrong. Please call us at (475) 227-6896.", errors: [], data: [] } });
  }
  const origin = new URL(req.url).origin;
  const data: Json = setting?.redirect ? { redirect_url: new URL(setting.redirect, origin).toString() } : {};
  return reply({ success: true, data: { message: setting?.message ?? "Your submission was successful.", data } });
}
