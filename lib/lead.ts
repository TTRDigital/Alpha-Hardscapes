import "server-only";

/**
 * Delivers a website form submission. Every destination is optional and
 * configured with environment variables (see .env.example):
 * - GHL_WEBHOOK_URL: GoHighLevel inbound webhook (flat JSON)
 * - RESEND_API_KEY + LEAD_EMAIL_TO (+ LEAD_EMAIL_FROM): email notification
 */

export type Lead = {
  form: string;
  fields: Record<string, string>;
  page: string;
  tag?: string;
};

function clean(v: string | undefined) {
  return v?.trim().replace(/^["']|["']$/g, "").trim() || "";
}

async function post(url: string, init: RequestInit) {
  let last: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(8000), cache: "no-store" });
      if (res.ok) return;
      last = new Error(`${url} answered ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`);
      if (res.status !== 429 && res.status < 500) break;
    } catch (err) {
      last = err;
    }
    await new Promise((r) => setTimeout(r, 600));
  }
  throw last;
}

function phoneE164(raw = "") {
  const d = raw.replace(/\D/g, "");
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  return raw.trim();
}

/** First field whose label matches. */
function pick(fields: Record<string, string>, re: RegExp) {
  const key = Object.keys(fields).find((k) => re.test(k));
  return key ? fields[key] : "";
}

export async function deliverLead(lead: Lead) {
  const f = lead.fields;
  const name = pick(f, /^(full )?name$/i) || f.name || "";
  const phone = pick(f, /phone/i);
  const email = pick(f, /e-?mail/i);
  const address = pick(f, /address/i);
  const zip = pick(f, /zip|postal/i);
  const service = pick(f, /service/i);
  const [first, ...rest] = name.trim().split(/\s+/);
  const tasks: Promise<void>[] = [];

  const webhook = clean(process.env.GHL_WEBHOOK_URL);
  if (/^https?:\/\//.test(webhook)) {
    tasks.push(
      post(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "Website form",
          form: lead.form,
          tags: ["website-lead", ...(lead.tag ? [lead.tag] : [])],
          submitted_at: new Date().toISOString(),
          name,
          first_name: first || "",
          last_name: rest.join(" "),
          email,
          phone: phoneE164(phone),
          phone_raw: phone,
          address,
          postal_code: zip,
          service_needed: service,
          page_url: lead.page,
          fields: f,
        }),
      }),
    );
  }

  const resendKey = clean(process.env.RESEND_API_KEY);
  const to = clean(process.env.LEAD_EMAIL_TO);
  if (resendKey && to) {
    const rows = Object.entries(f)
      .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0"><b>${esc(k)}</b></td><td>${esc(v)}</td></tr>`)
      .join("");
    tasks.push(
      post("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: clean(process.env.LEAD_EMAIL_FROM) || "Alpha Hardscapes Website <onboarding@resend.dev>",
          to: to.split(/[,;]\s*/),
          reply_to: email || undefined,
          subject: `New ${lead.form || "website"} submission${name ? ` from ${name}` : ""}`,
          html: `<p>New submission on <a href="${esc(lead.page)}">${esc(lead.page)}</a></p><table>${rows}</table>`,
        }),
      }),
    );
  }

  if (!tasks.length) {
    console.warn("[lead] No delivery configured (GHL_WEBHOOK_URL or RESEND_API_KEY + LEAD_EMAIL_TO). Lead:", JSON.stringify(lead));
    return false;
  }
  const results = await Promise.allSettled(tasks);
  const failed = results.filter((r) => r.status === "rejected");
  for (const r of failed) console.error("[lead] delivery failed", (r as PromiseRejectedResult).reason);
  return failed.length < results.length;
}

function esc(s: string) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function verifyRecaptcha(token: string | null, ip?: string | null) {
  const secret = clean(process.env.RECAPTCHA_SECRET_KEY);
  if (!secret) return true; // not configured: accept (Elementor still shows the checkbox)
  if (!token) return false;
  const body = new URLSearchParams({ secret, response: token, ...(ip ? { remoteip: ip } : {}) });
  try {
    const res = await fetch("https://www.google.com/recaptcha/api/siteverify", { method: "POST", body, signal: AbortSignal.timeout(6000) });
    const json = (await res.json()) as { success?: boolean };
    return Boolean(json.success);
  } catch {
    return true; // Google unreachable: do not lose the lead
  }
}
