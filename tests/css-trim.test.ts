import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error plain JavaScript build script, no types
import { keepSelector, trimCss, wordsOf } from "../scripts/css-trim.mjs";

const words = wordsOf(['<div class="hero banner-wrapper" id="main"><a class="btn">x</a></div>', "el.classList.add('is-open')"], new Set());

test("a selector stays when all its classes and ids are on the page or in a script", () => {
  assert.equal(keepSelector(".hero .btn", words), true);
  assert.equal(keepSelector("#main > .banner-wrapper", words), true);
  assert.equal(keepSelector(".hero.is-open", words), true);
  assert.equal(keepSelector(".elementor-element-abc123 .btn", words), false);
});

test("states, pseudo-elements and attributes stay with their rule", () => {
  assert.equal(keepSelector(".btn:hover", words), true);
  assert.equal(keepSelector(".btn:not(.disabled)::before", words), true);
  assert.equal(keepSelector('.btn[aria-expanded="true"]', words), true);
});

test("element-only selectors, fonts, keyframes and variables are kept", () => {
  const css = "@font-face{font-family:X;src:url(x.woff2)}:root{--c:red}body{margin:0}@keyframes fade{from{opacity:0}to{opacity:1}}.gone{color:red}";
  const out = trimCss(css, words);
  for (const part of ["@font-face", "--c:red", "body{margin:0}", "@keyframes fade", "from{opacity:0}"]) assert.ok(out.includes(part), part);
  assert.ok(!out.includes(".gone"));
});

test("unused selectors leave a list; an emptied media query goes", () => {
  const out = trimCss(".hero,.gone{color:red}@media (max-width:767px){.gone{display:none}}", words);
  assert.equal(out, ".hero{color:red}");
});
