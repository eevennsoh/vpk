// Scoped, token-mapped anatomy CSS (ws4b spec section 4.3).
//
// anatomyCss() derives the hero stylesheet from the vendored kit's ISO_CSS with a small brace-depth parser:
// the hex palettes are replaced by the vpk token blocks (tokens.mjs, K13), status hues, halos and blur are
// dropped, flow and pulse animations ship only when a hero uses them, opacity that print would reset becomes
// fill-opacity, every selector is scoped to the hero root so bare `.iso-*` classes never leak, and vendored
// declarations the vpk overrides make dead are dropped (both blocks stay within budgetBytes with flow and pulse, T11).
// No file reads at import (R28); the vendored module is a plain string export.
import { ISO_CSS } from "./vendor/kit/iso-kit.mjs";
import { ANATOMY_DARK_TOKEN_MAP, ANATOMY_TOKEN_MAP, FORBIDDEN_TONES, tokenDeclarations } from "./tokens.mjs";

export const HERO_SCOPE = ':where([data-vpk-engine="anatomy-hero"])';
const DARK_SCOPE = `[data-theme="dark"] ${HERO_SCOPE}`;
const HEADER = "/* anatomy kit CSS — MIT License, Copyright (c) 2026 Ryan, github.com/wheresryan22/anatomy @ dbf697a; scoped and token-mapped by vpk-html */";
const TONE_SELECTOR = new RegExp(`data-(?:tone|mark)="(?:${FORBIDDEN_TONES.join("|")})"`);

// Top-level `prelude { body }` blocks; nested blocks stay inside `body`.
export function parseCssBlocks(css) {
	const blocks = [];
	let index = 0;
	for (;;) {
		const open = css.indexOf("{", index);
		if (open < 0) break;
		let depth = 1;
		let close = open + 1;
		for (; close < css.length && depth > 0; close++) {
			if (css[close] === "{") depth += 1;
			else if (css[close] === "}") depth -= 1;
		}
		if (depth !== 0) throw new Error("anatomy CSS: unbalanced braces");
		blocks.push({ prelude: css.slice(index, open).trim(), body: css.slice(open + 1, close - 1) });
		index = close;
	}
	if (css.slice(index).trim()) throw new Error("anatomy CSS: trailing text after the last block");
	return blocks;
}

const splitSelectors = prelude => prelude.split(",").map(selector => selector.trim()).filter(Boolean);
const isFlowRule = body => /animation\s*:\s*iso-flow\b/.test(body);
const isPulseRule = body => /animation\s*:\s*iso-pulse\b/.test(body);

function keepSelector(selector, { flow, pulse, reducedMotion }) {
	if (TONE_SELECTOR.test(selector)) return false;
	if (reducedMotion) {
		if (/\[data-flow\]/.test(selector) && !flow) return false;
		if (/\[data-pulse\]/.test(selector) && !pulse) return false;
	}
	return true;
}

function rewriteBody(selectors, body) {
	let out = body;
	if (selectors.some(selector => /^\.iso-halo\b/.test(selector))) return "display:none";
	out = out.replace(/stroke-width:\.4(5?)(?![\d])/g, "stroke-width:.5");
	if (selectors.some(selector => /\.iso-dots\b/.test(selector))) out = out.replace(/(^|[;{\s])opacity:/g, "$1fill-opacity:");
	return out;
}

const declarationsOf = body => body.split(";").map(declaration => declaration.trim()).filter(Boolean);
const propertyOf = declaration => declaration.slice(0, declaration.indexOf(":")).trim();
// Every corner is position:static under the overrides (their grid places them), so vendored offsets on a corner are inert.
const STATIC_CORNER = /^\.iso-plate-corner(?:\[[^\]]*\])*$/;
const OFFSETS = new Set(["top", "right", "bottom", "left"]);

// Properties each vpk override sets, keyed by CSS level ("" or the @-rule prelude) and scoped selector.
function overrideProperties() {
	const map = new Map();
	const walk = (blocks, level) => {
		for (const { prelude, body } of blocks) {
			if (prelude.startsWith("@")) walk(parseCssBlocks(body), prelude);
			else for (const selector of splitSelectors(prelude)) map.set(`${level}\n${selector}`, new Set(declarationsOf(body).map(propertyOf)));
		}
	};
	walk(parseCssBlocks(VPK_OVERRIDES.join("")), "");
	return map;
}

// Drops the vendored declarations the overrides make dead: a property an override sets on the identical selector at
// the same level (equal specificity, later in the sheet, so the override always wins), and offsets on a static corner.
// Computed styles and boxes stay the same; T3 pins the dropped list. A rule left empty is dropped by the caller.
function liveBody(body, selectors, level, overrides) {
	if (!overrides) return body;
	const dead = declaration => selectors.every(selector => {
		const name = propertyOf(declaration);
		return overrides.get(`${level}\n${HERO_SCOPE} ${selector}`)?.has(name) || (OFFSETS.has(name) && STATIC_CORNER.test(selector));
	});
	const all = declarationsOf(body);
	const kept = all.filter(declaration => !dead(declaration));
	return kept.length === all.length ? body : kept.join(";");
}

// Scoped rule list for one CSS level (top level or the inside of an @media block).
function scopeRules(blocks, options, level = "") {
	const out = [];
	for (const { prelude, body } of blocks) {
		if (prelude.startsWith("@keyframes")) {
			const name = prelude.split(/\s+/)[1];
			if (name === "iso-flow" && !options.flow) continue;
			if (name === "iso-pulse" && !options.pulse) continue;
			const frames = name === "iso-pulse" ? body.replace(/opacity:/g, "fill-opacity:") : body;
			out.push(`${prelude}{${frames}}`);
			continue;
		}
		if (prelude.startsWith("@media")) {
			const reducedMotion = /prefers-reduced-motion/.test(prelude);
			const inner = scopeRules(parseCssBlocks(body), { ...options, reducedMotion }, prelude);
			if (inner.length) out.push(`${prelude}{${inner.join("")}}`);
			continue;
		}
		if (prelude === ".iso" || prelude === '.iso[data-theme="light"]') continue;
		if (isFlowRule(body) && !options.flow) continue;
		if (isPulseRule(body) && !options.pulse) continue;
		const selectors = splitSelectors(prelude).filter(selector => keepSelector(selector, options));
		if (!selectors.length) continue;
		const live = liveBody(rewriteBody(selectors, body), selectors, level, options.overrides);
		if (live) out.push(`${selectors.map(selector => `${HERO_SCOPE} ${selector}`).join(",")}{${live}}`);
	}
	return out;
}

// The vendored rules, scoped and rewritten (no token blocks, no vpk overrides). With `prune`, the declarations the vpk
// overrides make dead are dropped too (what anatomyCss ships).
export function scopeIsoCss({ flow = false, pulse = false, prune = false } = {}) {
	return scopeRules(parseCssBlocks(ISO_CSS), { flow, pulse, reducedMotion: false, overrides: prune ? overrideProperties() : null });
}

const VPK_OVERRIDES = [
	// !important: the template identity block (scripts/migrate-identity.mjs, 27 templates) sets figure{display:flex;
	// align-items:center;margin:0 0 30px;text-align:center} unlayered and !important, which shrank the plate to 50px and
	// the width:auto drawing to 0x0. The scoped class (0,1,0) outranks that type selector and every non-important rule.
	`${HERO_SCOPE} .iso-figure{display:block!important;margin:32px 0 36px!important;text-align:left!important}`,
	`${HERO_SCOPE} .iso-legend{text-align:left;max-width:none}`,
	// Keyboard focus scrolls the plate into view with this margin, so its corners (19px inside the border) clear the
	// shell's 72px scroll fades and the docnav pill: 80px where the plate fits with it, 60px on short viewports.
	`${HERO_SCOPE} .iso-plate{border:1px solid var(--rule);border-radius:6px;box-shadow:none;scroll-margin:clamp(60px,50vh - 190px,80px) 0}`,
	`${HERO_SCOPE} .iso-stage{touch-action:pan-y}`,
	// The drawing scales down to fit the viewport height with the plate chrome and fades (920px wide at most, as
	// ws3's figures), so the readout and corners stay on screen with the stage; width:auto keeps the viewBox ratio.
	// Below 540px (200% zoom, phone landscape) the plate plus its margins still fits (chrome <= 120px), down to a
	// 120px drawing at 360px.
	`${HERO_SCOPE} .iso-svg{width:auto;max-width:min(100%,920px);max-height:max(120px,min(240px,100vh - 240px),100vh - 300px)}`,
	// Corners on a grid instead of absolute offsets: the hint wraps beside a long readout and inside the plate on
	// narrow screens, where the vendored nowrap corner ran under the readout and past the frame. The fig corner
	// auto-places into the first free cell (top left); at <= 560px the hint stacks above the readout.
	`${HERO_SCOPE} .iso-plate-corners{display:grid;grid-template:"fig title" ". ." minmax(0,1fr) "hint readout"/minmax(0,1fr) auto;gap:4px 24px;align-items:end}`,
	`${HERO_SCOPE} .iso-plate-corner{position:static;line-height:1.4}`,
	`${HERO_SCOPE} .iso-plate-corner[data-corner="title"]{grid-area:title;justify-self:end}`,
	`${HERO_SCOPE} .iso-plate-corner[data-corner="hint"]{grid-area:hint;white-space:normal}`,
	`${HERO_SCOPE} .iso-plate-corner[data-corner="readout"]{grid-area:readout;justify-self:end}`,
	`@media (max-width:560px){${HERO_SCOPE} .iso-plate-corners{grid-template:"fig title" ". ." minmax(0,1fr) "hint hint" "readout readout"/minmax(0,1fr) auto}}`,
	`${HERO_SCOPE} .iso-stage:focus-visible{outline:1px solid var(--focus-ring);outline-offset:6px}`,
	`@media print{${HERO_SCOPE} .iso-plate-corner[data-corner="hint"]{display:none}${HERO_SCOPE} .iso-face-text{display:none}${HERO_SCOPE} .iso-figure{break-inside:avoid}}`,
];

// The whole hero stylesheet text (without the <style> tag). Deterministic for a given flag pair.
export function anatomyCss({ flow = false, pulse = false } = {}) {
	return [
		HEADER,
		`${HERO_SCOPE}{${tokenDeclarations(ANATOMY_TOKEN_MAP)}}`,
		`${DARK_SCOPE}{${tokenDeclarations(ANATOMY_DARK_TOKEN_MAP)}}`,
		...scopeIsoCss({ flow, pulse, prune: true }),
		...VPK_OVERRIDES,
	].join("\n");
}
