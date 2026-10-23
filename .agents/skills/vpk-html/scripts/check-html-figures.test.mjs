// check-html figure-paint rules owned by ws3 (S1, integration §3 check-html item 2; R15 keeps the
// SMIL paint collector ws0's): url(#id) paint is legal only for a <pattern> in the same SVG, and SMIL
// paint values are token-checked. Kept out of the shared build.test.js.
import assert from "node:assert/strict";
import test from "node:test";
import { ALLOWED_FIGURE_TOKENS, collectColorTokenIssues, collectSvgGrammarIssues, isAllowedFigureColorValue, validateHtmlString } from "./check-html.mjs";

const svg = body => `<svg viewBox="0 0 10 10" aria-label="x" fill="none">${body}</svg>`;
const PATTERN = '<defs><pattern id="vpk-x" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="var(--ill-tone1)"/><path d="M0 6L6 0" stroke="var(--ill-hatch)" stroke-width="1"/></pattern></defs>';
const grammar = html => collectSvgGrammarIssues(html).join("\n");

test("url(#id) paint passes only for a local <pattern>", () => {
	assert.equal(grammar(svg(`${PATTERN}<path d="M0 0L5 5Z" fill="url(#vpk-x)"/>`)), "");
	assert.equal(grammar(svg(`${PATTERN}<path d="M0 0L5 5" stroke="url(#vpk-x)"/>`)), "");
	assert.equal(grammar(svg(`${PATTERN}<path d="M0 0L5 5Z" style="fill: url(#vpk-x)"/>`)), "", "style attribute");
	assert.equal(grammar(svg(`${PATTERN}<style>.cut { fill: url(#vpk-x); }</style><path class="cut" d="M0 0L5 5Z"/>`)), "", "style block");
	assert.match(grammar(svg('<path d="M0 0L5 5Z" fill="url(#vpk-x)"/>')), /fill references url\(#vpk-x\) that is not a local <pattern>/);
	assert.match(grammar(svg('<path d="M0 0L5 5" stroke="url(#vpk-y)"/>')), /stroke references url\(#vpk-y\) that is not a local <pattern>/);
	assert.match(grammar(`${svg(PATTERN)}${svg('<path d="M0 0L5 5Z" fill="url(#vpk-x)"/>')}`), /not a local <pattern>/, "a pattern in another SVG does not count");
	const gradient = grammar(svg('<defs><linearGradient id="g"><stop offset="0" stop-color="var(--ink)"/></linearGradient></defs><path d="M0 0L5 5Z" fill="url(#g)"/>'));
	assert.match(gradient, /must not use gradients/);
	assert.match(gradient, /fill references url\(#g\) that is not a local <pattern>/);
	assert.match(grammar(svg(`${PATTERN}<path d="M0 0L5 5Z" stop-color="url(#vpk-x)"/>`)), /stop-color="url\(#vpk-x\)" must use grayscale figure tokens/, "only fill/stroke may reference a pattern");
});

test("SMIL paint values are token-checked (ws0 collectSmilPaintIssues, R15)", () => {
	assert.match(grammar(svg('<rect width="5" height="5" fill="var(--ill-tone1)"><animate attributeName="fill" values="var(--ill-tone1);red" dur="1s" begin="indefinite" data-vpk-begin="0s" fill="freeze"/></rect>')), /value "red" must use grayscale figure tokens/);
	const black = svg('<rect width="5" height="5" fill="var(--ill-tone1)"><set attributeName="fill" to="#000000" begin="indefinite" data-vpk-begin="0s"/></rect>');
	assert.match(grammar(black), /value "#000000" must use grayscale figure tokens/);
	assert.deepEqual(collectColorTokenIssues(black), [], "V19: the whole-file scan skips digit-only hex on markup lines, so the SMIL rule is the guard");
	assert.equal(grammar(svg('<rect width="5" height="5" fill="var(--ill-tone1)"><animate attributeName="fill" values="var(--ill-tone1);var(--ill-tone2)" dur="1s" begin="indefinite" data-vpk-begin="0s" fill="freeze"/></rect>')), "");
});

test("data-vpk-external-asset SVGs stay outside the grammar (unchanged behaviour)", () => {
	assert.equal(grammar('<svg data-vpk-external-asset aria-label="logo"><path d="M0 0L1 1Z" fill="url(#elsewhere)"/></svg>'), "");
});

test("exports for the iso palette tests (S1c)", () => {
	assert.ok(ALLOWED_FIGURE_TOKENS instanceof Set && ALLOWED_FIGURE_TOKENS.has("--ill-tone1"));
	assert.equal(isAllowedFigureColorValue("var(--ill-tone3)"), true);
	assert.equal(isAllowedFigureColorValue("url(#vpk-x)"), false, "url() is decided by the SVG context, not the value");
	assert.equal(isAllowedFigureColorValue("color-mix(in srgb, var(--ill-line) 45%, var(--paper))"), true);
});

test("validateHtmlString reports the url rule through its SVG grammar failure", () => {
	const page = `<!doctype html><html><head><style>x{}</style></head><body><main>${svg('<path d="M0 0L5 5Z" fill="url(#vpk-x)"/>')}</main></body></html>`;
	assert.ok(validateHtmlString(page).failures.some(failure => /that is not a local <pattern>/.test(failure)));
});
