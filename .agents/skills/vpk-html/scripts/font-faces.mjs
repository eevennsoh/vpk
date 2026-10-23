/*
 * font-faces — repair and check embedded @font-face rules and font-family declarations.
 *
 * The 2026-07 identity migration wrote `font-family: var(--font-mono)"Geist";` into @font-face
 * descriptors and `font-family: var(--font-mono)"…", …` into ordinary rules. Browsers drop both,
 * so the embedded fonts never register. repairFontFaces() strips the invalid faces, re-inserts
 * the shared Geist faces for families left without one, and collapses corrupted declarations to
 * the CSS variable the migration intended. It never adds fonts to a file that had no invalid face.
 * runtime/pipeline.mjs runs it as the `font-faces` step; check-html fails what it would repair.
 */

import { buildFontFaceBlock, SHARED_CSS_START } from "./shared.mjs";

export const REQUIRED_FONT_FAMILIES = ["Geist", "Geist Mono", "Geist Mono Numeric"];

const STYLE_BLOCK = /(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi;
const FONT_FACE_RULE = /@font-face\s*\{[^{}]*\}/g;
const CORRUPT_DECLARATION = /(font-family\s*:\s*)(var\(--[\w-]+\))\s*(["'])[^"'\n;{}<>]*\3[^;}]*/g;
const FAMILY_DESCRIPTOR = /font-family\s*:\s*([^;}]*)/i;
const REMEDY = "run build.mjs --inject-runtime <file> (artifacts) or --refresh-library (skill assets)";

function styleBlocks(html) {
	return [...html.matchAll(STYLE_BLOCK)].map(match => ({
		open: match[1],
		css: match[2],
		cssIndex: match.index + match[1].length,
	}));
}

export function isValidFontFamilyDescriptor(raw) {
	const value = String(raw ?? "").trim();
	if (!value || value.includes("var(")) return false;
	return /^(?:"[^"\\]*"|'[^'\\]*'|-?[A-Za-z_][\w-]*(?:\s+-?[A-Za-z_][\w-]*)*)$/.test(value);
}

function familyName(raw) {
	return raw.trim().replace(/^(["'])([\s\S]*)\1$/, "$2").replace(/\s+/g, " ");
}

// → [{ index, length, block, family, valid }] for every @font-face inside a <style> block.
export function listFontFaceRules(html) {
	const rules = [];
	for (const { css, cssIndex } of styleBlocks(html)) {
		for (const match of css.matchAll(FONT_FACE_RULE)) {
			const family = (FAMILY_DESCRIPTOR.exec(match[0])?.[1] ?? "").trim();
			rules.push({ index: cssIndex + match.index, length: match[0].length, block: match[0], family, valid: isValidFontFamilyDescriptor(family) });
		}
	}
	return rules;
}

export function registeredFontFamilies(html) {
	return new Set(listFontFaceRules(html).filter(rule => rule.valid).map(rule => familyName(rule.family)));
}

function corruptDeclarationsIn(css, cssIndex) {
	const faces = [...css.matchAll(FONT_FACE_RULE)].map(match => [match.index, match.index + match[0].length]);
	return [...css.matchAll(CORRUPT_DECLARATION)]
		.filter(match => !faces.some(([start, end]) => match.index >= start && match.index < end))
		.map(match => ({ index: cssIndex + match.index, text: match[0], replacement: `${match[1]}${match[2]}${/\s*$/.exec(match[0])[0]}` }));
}

// → [{ index, text, replacement }] inside <style> blocks, outside @font-face rules.
export function listCorruptFontFamilyDeclarations(html) {
	return styleBlocks(html).flatMap(({ css, cssIndex }) => corruptDeclarationsIn(css, cssIndex));
}

export function collectFontFaceIssues(html) {
	const issues = [];
	const invalid = listFontFaceRules(html).filter(rule => !rule.valid);
	if (invalid.length > 0) {
		issues.push(`@font-face rules with invalid font-family descriptors (${invalid.length}, e.g. ${invalid[0].family || "(empty)"}): browsers drop them, so the embedded fonts never load — ${REMEDY}`);
	}
	const corrupt = listCorruptFontFamilyDeclarations(html);
	if (corrupt.length > 0) {
		issues.push(`font-family declarations with a var(--…)"…" residue (${corrupt.length}, e.g. ${corrupt[0].text.trim().slice(0, 60)}): browsers drop the declaration — ${REMEDY}`);
	}
	return issues;
}

let sharedFaceRules = null;

// The shared.mjs @font-face rules keyed by family (fonts are inlined once per process).
function sharedFaceRule(family) {
	sharedFaceRules ??= new Map(buildFontFaceBlock().match(FONT_FACE_RULE).map(rule => [familyName(FAMILY_DESCRIPTOR.exec(rule)[1]), rule]));
	return sharedFaceRules.get(family);
}

function repairStyleCss(css) {
	let stripped = 0;
	let out = css.replace(/@font-face\s*\{[^{}]*\}\s*/g, rule => {
		const family = (FAMILY_DESCRIPTOR.exec(rule)?.[1] ?? "").trim();
		if (isValidFontFamilyDescriptor(family)) return rule;
		stripped += 1;
		return "";
	});
	const declarations = corruptDeclarationsIn(out, 0);
	for (const { index, text, replacement } of declarations.reverse()) {
		out = `${out.slice(0, index)}${replacement}${out.slice(index + text.length)}`;
	}
	return { css: out, stripped };
}

export function repairFontFaces(html) {
	let stripped = 0;
	const repaired = html.replace(STYLE_BLOCK, (match, open, css, close) => {
		const result = repairStyleCss(css);
		stripped += result.stripped;
		return `${open}${result.css}${close}`;
	});
	if (stripped === 0) return repaired;
	const registered = registeredFontFamilies(repaired);
	const missing = REQUIRED_FONT_FAMILIES.filter(family => !registered.has(family));
	if (missing.length === 0) return repaired;
	const rules = missing.map(sharedFaceRule).join("\n");
	const marker = repaired.indexOf(SHARED_CSS_START);
	if (marker >= 0) return `${repaired.slice(0, marker)}${rules}\n${repaired.slice(marker)}`;
	const style = /<style\b[^>]*>/i.exec(repaired);
	if (!style) return repaired;
	const at = style.index + style[0].length;
	return `${repaired.slice(0, at)}\n${rules}\n${repaired.slice(at)}`;
}

// --verify: every family must have ≥ 1 registered face, and every face must load.
export async function verifyRegisteredFonts(page, families = REQUIRED_FONT_FAMILIES) {
	return page.evaluate(async list => {
		try { await document.fonts.ready; } catch { /* noop */ }
		const results = [];
		for (const family of list) {
			const faces = [...document.fonts].filter(face => face.family.replace(/^["']|["']$/g, "") === family);
			if (faces.length === 0) {
				results.push({ family, loaded: false, error: "no @font-face registers this family" });
				continue;
			}
			try {
				await Promise.all(faces.map(face => face.load()));
			} catch (error) {
				results.push({ family, loaded: false, error: String(error) });
				continue;
			}
			results.push({ family, loaded: faces.every(face => face.status === "loaded") });
		}
		return results;
	}, families);
}
