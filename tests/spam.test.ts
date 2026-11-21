/**
 * Spam protection (lib/spam.ts, TTR-2495).
 *   npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkRecaptcha, HIDDEN_FIELDS, protectForms, recaptchaKeys, spamReason, TIMER_SCRIPT } from "../lib/spam.ts";

const FORM = (extra = "") =>
  `<form class="elementor-form" method="post" name="Quote"> <input type="hidden" name="post_id" value="1"><div class="x">${extra}</div>` +
  `<div class="elementor-field-group elementor-column elementor-field-type-submit elementor-col-100 e-form__buttons"><button type="submit">Send</button></div></form>`;
const WIDGET = `<div class="elementor-g-recaptcha" data-sitekey="OLDKEY" data-type="v2_checkbox"></div>`;
const PAGE = (body: string, head = "") => `<html><head>${head}</head><body>${body}</body></html>`;
const API = `<script id="elementor-recaptcha-api-js-loader"></script>`;

test("a person: honeypot empty, page open 3 seconds or more", () => {
  assert.equal(spamReason({ honeypot: "", timer: "3000" }), null);
  assert.equal(spamReason({ honeypot: null, timer: "45000", captcha: "off" }), null);
});

test("honeypot filled is spam, whatever else", () => {
  assert.equal(spamReason({ honeypot: "http://spam.example", timer: "60000", captcha: "pass" }), "honeypot");
});

test("sent in under 3 seconds is spam", () => {
  assert.equal(spamReason({ timer: "2999" }), "too-fast");
  assert.equal(spamReason({ timer: "0" }), "too-fast");
});

test("no timer (posted without the page) is spam unless reCAPTCHA passed", () => {
  assert.equal(spamReason({ timer: null }), "no-timer");
  assert.equal(spamReason({ timer: "" }), "no-timer");
  assert.equal(spamReason({ timer: "abc" }), "no-timer");
  assert.equal(spamReason({ timer: null, captcha: "unreachable" }), "no-timer");
  assert.equal(spamReason({ timer: null, captcha: "pass" }), null);
});

test("reCAPTCHA is on only with both keys", () => {
  assert.equal(recaptchaKeys({}), null);
  assert.equal(recaptchaKeys({ RECAPTCHA_SITE_KEY: "site" }), null);
  assert.equal(recaptchaKeys({ RECAPTCHA_SECRET_KEY: "secret" }), null);
  assert.deepEqual(recaptchaKeys({ RECAPTCHA_SITE_KEY: " site ", RECAPTCHA_SECRET_KEY: '"secret"' }), { siteKey: "site", secret: "secret" });
});

test("checkRecaptcha: off without keys, fail without a token (no call to Google)", async () => {
  assert.equal(await checkRecaptcha("token", null, {}), "off");
  assert.equal(await checkRecaptcha("", null, { RECAPTCHA_SITE_KEY: "s", RECAPTCHA_SECRET_KEY: "k" }), "fail");
});

test("checkRecaptcha asks Google and never loses a lead to a wrong secret or an outage", async () => {
  const env = { RECAPTCHA_SITE_KEY: "s", RECAPTCHA_SECRET_KEY: "k" };
  const real = globalThis.fetch;
  const answer = (body: unknown, status = 200) => (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;
  try {
    globalThis.fetch = answer({ success: true });
    assert.equal(await checkRecaptcha("t", "1.2.3.4", env), "pass");
    globalThis.fetch = answer({ success: false, "error-codes": ["invalid-input-response"] });
    assert.equal(await checkRecaptcha("t", null, env), "fail");
    globalThis.fetch = answer({ success: false, "error-codes": ["invalid-input-secret"] });
    assert.equal(await checkRecaptcha("t", null, env), "unreachable");
    globalThis.fetch = answer({}, 500);
    assert.equal(await checkRecaptcha("t", null, env), "unreachable");
    globalThis.fetch = (async () => { throw new Error("offline"); }) as typeof fetch;
    assert.equal(await checkRecaptcha("t", null, env), "unreachable");
  } finally {
    globalThis.fetch = real;
  }
});

test("protectForms without keys: hidden fields and timer only, reCAPTCHA markup untouched", () => {
  const html = PAGE(FORM(WIDGET) + FORM());
  const out = protectForms(html);
  assert.equal(out.split(HIDDEN_FIELDS).length - 1, 2);
  assert.equal(out.split(TIMER_SCRIPT).length - 1, 1);
  assert.ok(out.includes('data-sitekey="OLDKEY"'));
  assert.equal(out.split("elementor-g-recaptcha").length - 1, 1);
  assert.ok(!out.includes("recaptcha/api.js"));
});

test("protectForms with the site key: every form gets the checkbox with that key", () => {
  const out = protectForms(PAGE(FORM(WIDGET) + FORM(), API), { siteKey: "NEWKEY" });
  assert.ok(!out.includes("OLDKEY"));
  assert.equal(out.split('data-sitekey="NEWKEY"').length - 1, 2);
  assert.ok(out.indexOf("form-field-ah_recaptcha") < out.lastIndexOf("elementor-field-type-submit"));
  assert.ok(!out.includes("recaptcha/api.js?render=explicit"), "the page already loads Google's script");
});

test("protectForms adds Google's script when the page had none", () => {
  const out = protectForms(PAGE(FORM()), { siteKey: "NEWKEY" });
  assert.ok(out.includes("https://www.google.com/recaptcha/api.js?render=explicit"));
});

test("pages without a form are unchanged", () => {
  const html = PAGE("<p>Hello</p>");
  assert.equal(protectForms(html, { siteKey: "NEWKEY" }), html);
});
