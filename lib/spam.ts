/**
 * Spam protection for every form on the site (TTR-2495).
 *
 * Part 1, always on, nothing for a visitor to see:
 * - a hidden "honeypot" field (HONEYPOT_FIELD) a person never sees or fills, bots do;
 * - a minimum fill time: the page counts how long it was open before the form was sent
 *   (TIMER_FIELD, milliseconds, measured on the visitor's own clock so clock differences do not matter).
 *   Under MIN_FILL_MS is a bot. No timer at all means the form was posted without the page's script
 *   (a bot posting straight at the address), unless reCAPTCHA vouched for the visitor.
 * Spam is dropped quietly: the bot gets the same success answer as a person, nothing is sent to
 * GoHighLevel or TTR OS, and the drop is counted in the logs ("[spam]" lines, see countSpam).
 *
 * Part 2, only when both RECAPTCHA_SITE_KEY and RECAPTCHA_SECRET_KEY are set: Google reCAPTCHA v2
 * ("I'm not a robot" checkbox) on every form, verified on the server. With either key missing the
 * forms work exactly as with Part 1 alone.
 */

export const HONEYPOT_FIELD = "website";
export const TIMER_FIELD = "ah_t";
export const MIN_FILL_MS = 3000;

export type SpamReason = "honeypot" | "too-fast" | "no-timer";
export type Captcha = "off" | "pass" | "fail" | "unreachable";

function clean(v: string | undefined | null) {
  return (v ?? "").trim().replace(/^["']|["']$/g, "").trim();
}

/** The reCAPTCHA keys, only when both are set (a site key without its secret, or the reverse, cannot work). */
export function recaptchaKeys(env: Record<string, string | undefined> = process.env) {
  const siteKey = clean(env.RECAPTCHA_SITE_KEY);
  const secret = clean(env.RECAPTCHA_SECRET_KEY);
  return siteKey && secret ? { siteKey, secret } : null;
}

/**
 * Part 1. `honeypot`: the hidden field's value. `timer`: the TIMER_FIELD value (null when the form did
 * not send one). `captcha`: the reCAPTCHA result; a visitor Google vouched for is never dropped for a
 * missing timer. Returns why it is spam, or null for a person.
 */
export function spamReason(input: { honeypot?: string | null; timer?: string | null; captcha?: Captcha }): SpamReason | null {
  if (clean(input.honeypot)) return "honeypot";
  const raw = clean(input.timer);
  if (!raw || !/^\d{1,12}$/.test(raw)) return input.captcha === "pass" ? null : "no-timer";
  if (Number(raw) < MIN_FILL_MS) return "too-fast";
  return null;
}

const counts = new Map<string, number>();

/** Counts a dropped submission: one "[spam]" log line (searchable in Vercel's logs) and a running count. */
export function countSpam(form: string, reason: SpamReason, page = "") {
  const key = `${reason}`;
  const total = (counts.get(key) || 0) + 1;
  counts.set(key, total);
  console.warn(`[spam] dropped ${JSON.stringify({ form, reason, page: page.slice(0, 200), countSinceStart: total })}`);
  return total;
}

/** Running counts since this server instance started, by reason. */
export function spamCounts() {
  return Object.fromEntries(counts);
}

/** Part 2: checks a reCAPTCHA v2 token with Google. "off" when the keys are not both set. */
export async function checkRecaptcha(token: string | null | undefined, ip?: string | null, env: Record<string, string | undefined> = process.env): Promise<Captcha> {
  const keys = recaptchaKeys(env);
  if (!keys) return "off";
  if (!clean(token)) return "fail";
  const body = new URLSearchParams({ secret: keys.secret, response: clean(token), ...(ip ? { remoteip: ip } : {}) });
  try {
    const res = await fetch("https://www.google.com/recaptcha/api/siteverify", { method: "POST", body, signal: AbortSignal.timeout(6000), cache: "no-store" });
    if (!res.ok) return "unreachable";
    const json = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    if (json.success) return "pass";
    // A wrong secret is our mistake, not the visitor's: never lose the lead over it (Part 1 still applies).
    if (json["error-codes"]?.some((c) => c === "invalid-input-secret" || c === "missing-input-secret")) {
      console.error("[recaptcha] RECAPTCHA_SECRET_KEY is not valid: check it in Vercel", json["error-codes"]);
      return "unreachable";
    }
    return "fail";
  } catch {
    return "unreachable"; // Google unreachable: do not lose the lead
  }
}

const escAttr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** The hidden fields added to every form: the honeypot (off screen, skipped by keyboard and screen readers) and the timer. */
export const HIDDEN_FIELDS =
  `<input type="text" name="${HONEYPOT_FIELD}" value="" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;top:auto;width:1px;height:1px;opacity:0;overflow:hidden">` +
  `<input type="hidden" name="${TIMER_FIELD}" value="">`;

/** Sets TIMER_FIELD to how long the page has been open, just before any form is sent (capture phase: before Elementor reads the form). */
export const TIMER_SCRIPT =
  `<script id="ah-form-timer">(function(){var t0=Date.now();function set(f){if(!f||!f.querySelectorAll)return;var i=f.querySelectorAll('input[name="${TIMER_FIELD}"]');for(var k=0;k<i.length;k++)i[k].value=String(Date.now()-t0)}` +
  `document.addEventListener('submit',function(e){set(e.target)},true);` +
  `document.addEventListener('click',function(e){var b=e.target&&e.target.closest&&e.target.closest('button[type="submit"],input[type="submit"]');if(b)set(b.form)},true);})();</script>`;

const ELEMENTOR_FORM = /<form class="elementor-form"[^>]*>/g;
const SITEKEY = /(class="elementor-g-recaptcha" data-sitekey=")[^"]*(")/g;
const SUBMIT_GROUP = /<div class="elementor-field-group elementor-column elementor-field-type-submit/;
const RECAPTCHA_API = 'id="elementor-recaptcha-api-js';

function recaptchaField(siteKey: string) {
  return (
    `<div class="elementor-field-type-recaptcha elementor-field-group elementor-column elementor-field-group-ah_recaptcha elementor-col-100">` +
    `<div class="elementor-field" id="form-field-ah_recaptcha"><div class="elementor-g-recaptcha" data-sitekey="${escAttr(siteKey)}" data-type="v2_checkbox" data-theme="light" data-size="normal"></div></div></div>`
  );
}

/**
 * Adds the spam protection to every Elementor form of a rendered page: the hidden fields and the timer
 * script (Part 1), and with `siteKey` (Part 2) the "I'm not a robot" checkbox with that key on every form,
 * including the forms WordPress printed without one, plus Google's script when the page had none.
 * Without `siteKey` the reCAPTCHA markup is left exactly as it was.
 */
export function protectForms(html: string, opts: { siteKey?: string | null } = {}): string {
  if (!html.includes('<form class="elementor-form"')) return html;
  let out = html.replace(ELEMENTOR_FORM, (tag) => tag + HIDDEN_FIELDS);
  const siteKey = opts.siteKey ? clean(opts.siteKey) : "";
  if (siteKey) {
    out = out.replace(SITEKEY, (_m, a: string, b: string) => `${a}${escAttr(siteKey)}${b}`);
    // Forms without the checkbox get one just above their submit button.
    out = out.replace(/<form class="elementor-form"[\s\S]*?<\/form>/g, (form) =>
      form.includes("elementor-g-recaptcha") || !SUBMIT_GROUP.test(form) ? form : form.replace(SUBMIT_GROUP, (m) => recaptchaField(siteKey) + m),
    );
    if (!out.includes(RECAPTCHA_API)) {
      // Same loader as lib/site/tune.ts: Google's script after the first interaction; Elementor renders the checkbox once it is there.
      const load = `var s=document.createElement('script');s.id='elementor-recaptcha-api-js';s.async=true;s.src='https://www.google.com/recaptcha/api.js?render=explicit';document.head.appendChild(s);`;
      const loader = `<script id="elementor-recaptcha-api-js-loader">(function(){var done=false;function load(){if(done)return;done=true;${load}}['pointerdown','keydown','scroll','touchstart','mousemove','wheel'].forEach(function(e){addEventListener(e,load,{once:true,passive:true})});setTimeout(load,10000);})();</script>`;
      out = out.replace("</body>", `${loader}</body>`);
    }
  }
  return out.includes("</body>") ? out.replace("</body>", `${TIMER_SCRIPT}</body>`) : out + TIMER_SCRIPT;
}
