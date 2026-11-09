// Lead form of the ad pages (outdoor. season-end page and go., Kia, Nov 6-8). Sends each request to the GoHighLevel inbound webhook (GHL_SEASON_WEBHOOK_URL in
// Vercel, set by a person, never in the page) and to TTR OS (the client's Leads page), so a lead is never lost to one side being down. The visitor
// gets a thank-you when either side took it. Never blocks on one side failing; each call gives up after 5 seconds.
const SITE_KEY = process.env.NEXT_PUBLIC_TTR_SITE_KEY || "8ntBK6QgvLkKLHNYnBTF8Q";
const OS_URL = process.env.TTR_OS_URL || "https://portal.ttrdigitalmarketing.com";
const ORIGIN = "https://alphahardscapes.com";
const clean = (v: FormDataEntryValue | null, n: number) => String(v ?? "").replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, n);

export async function POST(req: Request) {
  let form: FormData;
  try { form = await req.formData(); } catch { return Response.json({ ok: false, error: "Bad request." }, { status: 400 }); }
  if (clean(form.get("website"), 50)) return Response.json({ ok: true }); // honeypot: a person never fills this
  const name = clean(form.get("fullName"), 120), email = clean(form.get("email"), 160), phone = clean(form.get("phone"), 40), address = clean(form.get("projectAddress"), 240);
  const source = clean(form.get("source"), 80) || "Google Ads - Season End 2026";
  const page = clean(form.get("page"), 20) === "go" ? "go" : "outdoor";
  const path = page === "go" ? "/go/" : "/patios-walkways/";
  const campaign = page === "go" ? "go-landing" : "season-end-2026";
  const digits = phone.replace(/\D/g, "");
  if (name.length < 2 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || digits.length < 10) return Response.json({ ok: false, error: "Please check your name, email and phone." }, { status: 400 });
  const ua = req.headers.get("user-agent") || "", ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
  const tasks: Promise<boolean>[] = [];
  const hook = process.env.GHL_SEASON_WEBHOOK_URL;
  if (hook && /^https:\/\//.test(hook)) {
    tasks.push(fetch(hook, { method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(5000), body: JSON.stringify({ fullName: name, email, phone, projectAddress: address, source, page }) }).then((r) => r.ok).catch(() => false));
  }
  const os = new URLSearchParams({ k: SITE_KEY, p: path, r: req.headers.get("referer") || "", u: `${ORIGIN}${path}?utm_source=google&utm_medium=cpc&utm_campaign=${campaign}`, f_name: name, f_phone: phone, f_email: email, f_message: `${address ? `Project address: ${address}. ` : ""}${source}` });
  tasks.push(fetch(`${OS_URL}/api/site/form`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": ua || "Mozilla/5.0 (alphahardscapes.com form)", "x-forwarded-for": ip, origin: ORIGIN }, body: os, signal: AbortSignal.timeout(5000) }).then((r) => r.status < 500).catch(() => false));
  const done = await Promise.all(tasks);
  if (!done.some(Boolean)) return Response.json({ ok: false, error: "We could not send that. Please call (472) 203-3284." }, { status: 502 });
  return Response.json({ ok: true });
}
