/**
 * checkPreviewLink (lib/preview.ts), the TTR OS draft-preview contract.
 *   npm test
 */
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { checkPreviewLink, NOT_SET_UP, PREVIEW_MAX_DAYS } from "../lib/preview.ts";

const SECRET = "test-secret-only-for-these-tests";
const NOW = Date.UTC(2026, 9, 26, 12, 0, 0);
const nowSeconds = Math.floor(NOW / 1000);
const sign = (path: string, exp: string, secret = SECRET) => createHmac("sha256", secret).update(`${path}\n${exp}`).digest("hex");
const link = (path: string, exp: number, secret = SECRET) => ({ path, exp: String(exp), sig: sign(path, String(exp), secret) });

test("a good link opens its path", () => {
  assert.deepEqual(checkPreviewLink(link("/walkway-patio-connecticut/", nowSeconds + 600), SECRET, NOW), { ok: true, path: "/walkway-patio-connecticut/" });
  assert.deepEqual(checkPreviewLink(link("/", nowSeconds + 600), SECRET, NOW), { ok: true, path: "/" });
});

test("no secret: previews are not set up", () => {
  assert.deepEqual(checkPreviewLink(link("/", nowSeconds + 600), "", NOW), { ok: false, why: NOT_SET_UP });
});

test("an expired link is refused", () => {
  const r = checkPreviewLink(link("/", nowSeconds - 1), SECRET, NOW);
  assert.equal(r.ok, false);
  assert.match(!r.ok ? r.why : "", /expired/);
});

test("a link more than 31 days ahead is refused", () => {
  assert.equal(checkPreviewLink(link("/", nowSeconds + PREVIEW_MAX_DAYS * 86400), SECRET, NOW).ok, true);
  assert.deepEqual(checkPreviewLink(link("/", nowSeconds + PREVIEW_MAX_DAYS * 86400 + 1), SECRET, NOW), { ok: false, why: "This preview link is not valid." });
});

test("a bad signature is refused", () => {
  const good = link("/contact/", nowSeconds + 600);
  const cases = [
    { ...good, sig: sign("/contact/", good.exp, "another-secret") },
    { ...good, path: "/about-us/" },
    { ...good, exp: String(nowSeconds + 601) },
    { ...good, sig: good.sig.toUpperCase() },
    { ...good, sig: good.sig.slice(0, 63) },
    { ...good, sig: "" },
  ];
  for (const c of cases) assert.deepEqual(checkPreviewLink(c, SECRET, NOW), { ok: false, why: "This preview link is not valid." });
});

test("a bad path is refused, even when signed", () => {
  for (const path of ["//evil.com", "//evil.com/", "https://evil.com/", "/\\evil.com", "contact/", "", "/a b/", "/a?x=1", `/${"a".repeat(300)}`]) {
    assert.deepEqual(checkPreviewLink(link(path, nowSeconds + 600), SECRET, NOW), { ok: false, why: "That page address is not valid." }, path);
  }
});

test("a malformed exp is refused", () => {
  for (const exp of ["", "12345678", "123456789012", "17929988a2", "-1"]) {
    assert.deepEqual(checkPreviewLink({ path: "/", exp, sig: sign("/", exp) }, SECRET, NOW), { ok: false, why: "This preview link is not valid." }, exp);
  }
});
