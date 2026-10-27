#!/usr/bin/env node
// iso/audit — static audit of iso-kit figures (illustrations.md § Acceptance checks, ws3 C-iso-10).
//   node .agents/skills/vpk-html/scripts/iso/audit.mjs <file.html> [--json] [--strict]
//   node .agents/skills/vpk-html/scripts/build.mjs --check-iso <file.html> [--strict]
// auditHtml(html) → { figures, findings: { rule: "A1"…"A21", figure, severity, message }[] }.
// Advisory by default; exit 1 on errors only under --strict. build-figure.mjs treats errors as fatal.
// A13/A14 (pointer, loop) are browser checks: tests/vpk-html/iso-runtime*.spec.ts.

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseCameraAttr } from "../figures/camera.mjs";
import { convexOverlap, hull, parsePolyPath, parseVec, pointInPolygon } from "./core.mjs";
import { ancestor, attr, has, norm, parseAttrs, parseMarkup, partOf, pointsOf, unitName } from "./audit-markup.mjs";
import { auditLabelPoses, dimStrokes, boxPolygon, clipConvex, labelBox, nearPolygon, scenePoses, segmentHitsBox } from "./layout.mjs";
import { auditDetailBudget, auditFocalVisible, auditLeaderInk, auditShadows, FOCAL_MIN_VISIBLE, paintedValue } from "./manual-audit.mjs";
import { MAX_TOTAL_MS, staggerFor } from "./motion.mjs";
import { ACCENT_TOKENS } from "./accent.mjs";
import { EMPHASES, isAccentPaint, isInkFace, ISO_PRESET, isAllowedIsoPaint, KIT_STYLE, RAY_ISO_TOKENS, rolesFor, STROKE_SET } from "./palette.mjs";
import { ISO_THRESHOLDS } from "./thresholds.mjs";

// A17 (checks-thresholds.json → iso): file size does not block parity. A figure's SVG warns above SVG_WARN_BYTES and fails only
// above SVG_FAIL_BYTES. The old data-vpk-iso-dense attribute is tolerated as a no-op.
export const SVG_WARN_BYTES = ISO_THRESHOLDS.svgWarnBytes;
export const SVG_FAIL_BYTES = ISO_THRESHOLDS.svgFailBytes;
// A2: distinct face fills (top, light, dark, pale, accent, ink, recess, glow; a pattern or gradient fill counts once).
export const MAX_FILLS = ISO_THRESHOLDS.fillsMax;
export { FOCAL_MIN_VISIBLE, parseMarkup };
const PAINT_ATTRS = ["fill", "stroke", "stop-color", "color", "flood-color", "lighting-color"];
const SMIL = new Set(["animate", "animateTransform", "animateMotion", "set"]);
const FACE_ROLES = new Set(["fill", "shade", "top"]);
// Detail fills a focal part paints in the accent family: its recesses (the darker accent face).
const FOCAL_DETAIL_FILLS = new Set(["recess"]);
// The one transform the kit emits: face text projected onto its face (detail.mjs faceMatrix).
const FACE_TEXT_MATRIX = /^matrix\((?:\s*-?[\d.]+(?:e-?\d+)?){6}\s*\)$/;
const decimals = d => /\d\.\d{2,}/.test(d);

// The explode range a plate's Gap slider exposes ({ rest, min, max, step, unit }), or null. A hand-edited
// step far below the brief limit is widened so the stop sweep stays bounded.
const INPUT_TAG = /<input\b([^>]*)>/gi;
const MAX_SLIDER_STOPS = 2000;

function sliderOf(plateHtml = "") {
	for (const match of plateHtml.matchAll(INPUT_TAG)) {
		const attrs = parseAttrs(match[1]);
		if (attrs.get("data-vpk-iso-control") !== "explode") continue;
		// A teardown's Spread slider (data-vpk-iso-start): its labels show only in the exploded pose, so only that pose is checked.
		if (attrs.has("data-vpk-iso-start")) return null;
		const [min, max, step, rest] = ["min", "max", "step", "value"].map(name => Number(attrs.get(name)));
		if (![min, max, step, rest].every(Number.isFinite) || step <= 0 || max <= min) return null;
		// The unit is the label text in front of the input ("Gap ").
		const unit = plateHtml.slice(plateHtml.lastIndexOf(">", match.index) + 1, match.index).trim().toLowerCase() || "gap";
		return { rest, min, max, step: Math.max(step, (max - min) / MAX_SLIDER_STOPS), unit };
	}
	return null;
}

function isIdentityValue(name, attributeName, value) {
	if (name === "animateTransform") return (value.trim().split(/[\s,]+/).map(Number).every(n => n === 0));
	if (attributeName === "opacity") return Number(value) === 1;
	return true;
}

/**
 * Audits one iso SVG (string). `context` = { figure, figId, rootTag, plateHtml }.
 * Returns findings without the document-wide uniqueness checks (auditHtml adds those).
 */
export function auditSvg(svgSource, context = {}) {
	const findings = [];
	const { all } = parseMarkup(svgSource);
	const svg = all[0];
	const label = context.figId || context.figure || "figure";
	const push = (rule, message, severity = "error") => void findings.push({ rule, figure: label, severity, message });
	if (!svg || svg.name !== "svg") return [{ rule: "A9", figure: label, severity: "error", message: "no <svg> root" }];
	const style = attr(svg, "data-vpk-iso-style");
	if (style === undefined) push("A4", `svg has no data-vpk-iso-style; audited as "${KIT_STYLE}", the kit's one style`, "warning");
	else if (style !== KIT_STYLE) push("A4", `data-vpk-iso-style="${style}" is not supported; the iso kit has one style: "${KIT_STYLE}" (rebuild with build-figure.mjs)`);
	const preset = ISO_PRESET;
	const figure = attr(svg, "data-vpk-iso-id") ?? context.figure;
	const elements = all.slice(1);
	const patterns = new Set(elements.filter(el => el.name === "pattern" && has(el, "id")).map(el => attr(el, "id")));
	// Glow gradients (plan § 2 W): radialGradient paint servers whose ids are vpk-iso-<figure>-glow-<k>; their stops are the accent
	// pair and grey tokens (A1 reads every stop-color), and they may paint the accent under any emphasis (A3: glow is heat, not focus).
	const gradients = elements.filter(el => /^(?:radialGradient|linearGradient)$/.test(el.name));
	const glowIds = new Set(gradients.map(el => attr(el, "id")).filter(id => new RegExp(`^vpk-iso-${figure}-glow-[\\w-]+$`).test(id ?? "")));
	for (const el of gradients) if (!glowIds.has(attr(el, "id"))) push("A15", `<${el.name} id="${attr(el, "id") ?? ""}"> is not a glow gradient (ids are vpk-iso-${figure}-glow-<k>)`);
	for (const el of gradients) for (const name of ["gradientTransform", "href", "xlink:href"]) if (has(el, name)) push("A15", `glow gradient ${attr(el, "id")} carries ${name}`);
	const paintServers = new Set([...patterns, ...glowIds]);
	const inGlow = el => Boolean(ancestor(el, item => glowIds.has(attr(item, "id"))));
	// Spectrum rays (plan § 2 X): the three ray tokens, only as the paint of a ray (role "ray" or its end dots) on a root marked
	// data-vpk-iso-spectrum.
	const spectrum = has(svg, "data-vpk-iso-spectrum");
	const isRay = el => ["ray", "ray-end"].includes(attr(el, "data-vpk-iso-role"));
	const rayValue = value => RAY_ISO_TOKENS.has(/^var\((--[\w-]+)\)$/.exec(String(value).trim())?.[1]);

	// A1 paint values (and A15 url targets)
	for (const el of elements) {
		for (const name of PAINT_ATTRS) {
			if (!has(el, name)) continue;
			if (SMIL.has(el.name) && name === "fill") continue;
			const value = attr(el, name);
			const url = /^url\(#([\w-]+)\)$/.exec(value.trim());
			if (rayValue(value)) {
				if (!spectrum || !isRay(el)) push("A1", `<${el.name} ${name}="${value}"> paints a spectrum ray token ${spectrum ? "outside a ray" : "on a figure without data-vpk-iso-spectrum"}`);
			} else if (url && !paintServers.has(url[1])) push("A15", `${name}="${value}" does not resolve to a <pattern> or glow gradient in this figure`);
			else if (url && glowIds.has(url[1]) && !["fill", "shade", "top", "glow"].includes(attr(el, "data-vpk-iso-role"))) push("A15", `${name}="${value}": a glow gradient paints only faces and glow halos`);
			else if (!isAllowedIsoPaint(value, { localIds: paintServers })) push("A1", `<${el.name} ${name}="${value}"> is not a grayscale iso token`);
		}
		for (const css of [attr(el, "style") ?? "", el.name === "style" ? el.text : ""]) {
			for (const m of css.matchAll(/\b(fill|stroke|stop-color|color)\s*:\s*([^;}]+)/gi)) {
				if (!isAllowedIsoPaint(m[2], { localIds: paintServers })) push("A1", `${m[1]}: ${m[2].trim()} is not a grayscale iso token`);
			}
		}
		if (SMIL.has(el.name) && PAINT_ATTRS.includes(attr(el, "attributeName") ?? "")) {
			const values = (attr(el, "values") ?? "").split(";").concat(["from", "to", "by"].map(key => attr(el, key) ?? "")).map(v => v.trim()).filter(Boolean);
			for (const value of values) if (!isAllowedIsoPaint(value)) push("A1", `SMIL ${el.attrs.get("attributeName")} value "${value}" is not a grayscale iso token`);
		}
		if (el.name === "pattern" && has(el, "patternTransform")) push("A15", `pattern ${attr(el, "id")} uses patternTransform (bake the diagonals into the tile)`);
		// Hatched side faces were removed from the kit: every side face is a plain flat face. The cut role survives only as a cutaway's
		// section faces (plan § 2 C), inside the front shell of a part that opens a window (data-vpk-iso-window); a hatch pattern is stale.
		const cutOutside = attr(el, "data-vpk-iso-role") === "cut" && !has(partOf(el) ?? svg, "data-vpk-iso-window");
		if (cutOutside || (el.name === "pattern" && /-hatch(?:-sparse)?$/.test(attr(el, "id") ?? ""))) push("A15", `${el.name === "pattern" ? `pattern ${attr(el, "id")}` : "a data-vpk-iso-role=\"cut\" face"} is a hatched cut face outside a cutaway; the kit draws side faces flat (rebuild with build-figure.mjs)`);
		if (attr(el, "data-vpk-iso-role") === "cut" && !cutOutside && /^url\(/.test(attr(el, "fill") ?? "")) push("A15", "a cutaway section face is one flat tone (its hatch is line work, never a pattern fill)");
	}
	if (/\bdata-vpk-(?:external-asset|raw-colors-allowed)\b/.test(context.plateHtml ?? svgSource)) push("A1", "escape-hatch attribute (data-vpk-external-asset / data-vpk-raw-colors-allowed) inside an iso plate");

	// Parts, faces and hulls
	// A step or scrub figure emits the variants, turn samples and hidden parts its rest state does not show with display="none"; the
	// rest-pose geometry checks (A5, A7, A18, A20, A21) read only what is drawn. Paint, transform and opacity checks still cover them.
	const parts = elements.filter(el => has(el, "data-vpk-iso-part") && attr(el, "display") !== "none");
	const faces = elements.filter(el => el.name === "path" && FACE_ROLES.has(attr(el, "data-vpk-iso-role")));
	const facePart = new Map(faces.map(el => [el, partOf(el)]));
	// A clipped part (the flash ring) shows only inside its <clipPath>: the window polygon, or null for an unclipped part.
	const clipOf = part => {
		const clip = /^url\(#([\w-]+)\)$/.exec(attr(part, "clip-path") ?? "")?.[1];
		const clipPath = clip ? elements.find(el => el.name.toLowerCase() === "clippath" && attr(el, "id") === clip)?.children.find(el => el.name === "path") : null;
		return clipPath ? parsePolyPath(attr(clipPath, "d") ?? "") ?? [] : null;
	};
	const hullOf = new Map(parts.map(part => {
		const fills = elements.filter(el => partOf(el) === part && attr(el, "data-vpk-iso-role") === "fill");
		const source = fills.length ? fills : elements.filter(el => partOf(el) === part && attr(el, "data-vpk-iso-role") === "edge");
		const silhouette = hull(source.flatMap(pointsOf));
		const window = clipOf(part);
		const clipped = window ? clipConvex(silhouette, window) : [];
		return [part, clipped.length >= 3 ? clipped : silhouette];
	}));
	// A cutaway's front shell (data-vpk-iso-window): the open part of its hull, which covers nothing inside it (A7, A18).
	const windowOf = part => {
		const nums = (attr(part, "data-vpk-iso-window") ?? "").trim().split(/\s+/).map(Number);
		return nums.length >= 6 && nums.every(Number.isFinite) ? nums.flatMap((v, k) => (k % 2 ? [] : [[v, nums[k + 1]]])) : null;
	};

	// A2 distinct face fills (a pattern fill counts once, and so do the accent faces and the three ink faces: one tone each)
	const fillKey = value => (/^url\(/.test(value) ? (glowIds.has(/#([\w-]+)/.exec(value)?.[1]) ? "glow" : "pattern") : isAccentPaint(value) ? "accent" : isInkFace(value) ? "ink" : norm(value));
	const fills = new Set([...faces, ...elements.filter(el => ["recess", "cut"].includes(attr(el, "data-vpk-iso-role")))].map(el => fillKey(attr(el, "fill") ?? "none")));
	if (fills.size > MAX_FILLS) push("A2", `${fills.size} distinct face fills (${[...fills].join(", ")}); at most ${MAX_FILLS}`);

	// A3 emphasis (data-vpk-iso-emphasis on the root; absent means "accent"). Under "accent" at least one part carries
	// data-vpk-iso-focal (a list is a group drawn alike), each drawn with the accent faces (top, near side, far side:
	// preset.accent); a part in state "new" or "active" takes the pale fill. The accent appears nowhere else in the rest art
	// except the focal label's leader dot and, for a faceless focal (the ring, a wire, a gap outline), its 2 px edge: a focal with
	// faces keeps the neutral line work of every part, and its accent outline is runtime CSS on hover, never markup. Under
	// "ink" the focal parts (if any) keep their faces with a 2 px ink outline and no accent paints anywhere; "none" has no focal.
	const emphasis = attr(svg, "data-vpk-iso-emphasis") ?? "accent";
	if (!EMPHASES.includes(emphasis)) push("A3", `data-vpk-iso-emphasis="${emphasis}" must be one of ${EMPHASES.join(", ")}`);
	const accented = emphasis === "accent";
	const focalUnits = new Set(parts.filter(part => has(part, "data-vpk-iso-focal")).map(unitName));
	if (accented && focalUnits.size < 1) push("A3", "no focal part; with the accent emphasis at least one part carries data-vpk-iso-focal (or set emphasis \"ink\" or \"none\")");
	if (emphasis === "none" && focalUnits.size) push("A3", `${focalUnits.size} focal part(s) under emphasis "none"; no part carries data-vpk-iso-focal`);
	const accentRole = { top: "top", fill: "light", shade: "dark" };
	for (const face of faces) {
		const part = facePart.get(face);
		const isFocal = part && has(part, "data-vpk-iso-focal") && accented;
		const role = attr(face, "data-vpk-iso-role");
		const fill = norm(attr(face, "fill") ?? "");
		if (isFocal && fill !== preset.accent[accentRole[role]]) push("A3", `focal part "${unitName(part)}" face ${role} is ${fill}, not the accent face ${preset.accent[accentRole[role]]}`);
		else if (!isFocal && part && has(part, "data-vpk-iso-state") && fill !== preset.tones.pale && !/^url\(/.test(fill)) push("A3", `new or active part "${unitName(part)}" face ${role} is ${fill}, not ${preset.tones.pale}`);
	}
	const accentMarker = el => el.name === "circle" && ancestor(el, item => item.name === "marker");
	for (const el of elements) {
		if (SMIL.has(el.name) || inGlow(el) || !PAINT_ATTRS.some(name => isAccentPaint(attr(el, name) ?? ""))) continue;
		if (!accented) {
			push("A3", `<${el.name}${attr(el, "data-vpk-iso-role") ? ` data-vpk-iso-role="${attr(el, "data-vpk-iso-role")}"` : ""}> paints the accent under emphasis "${emphasis}"; no accent anywhere`);
			continue;
		}
		const part = partOf(el);
		const focalPart = part && has(part, "data-vpk-iso-focal");
		const onFocalFace = focalPart && FACE_ROLES.has(attr(el, "data-vpk-iso-role"));
		const onFacelessEdge = focalPart && attr(el, "data-vpk-iso-role") === "edge" && !faces.some(face => facePart.get(face) === part);
		const onFocalDetail = focalPart && FOCAL_DETAIL_FILLS.has(attr(el, "data-vpk-iso-role")) && norm(attr(el, "fill") ?? "") === preset.accent.dark && !has(el, "stroke");
		// A motion arrow that names the focal part as the one it moves (data-vpk-iso-arrow-for) is drawn in the accent too.
		const arrow = ancestor(el, item => has(item, "data-vpk-iso-arrow-for"));
		const onFocalArrow = arrow && focalUnits.has(attr(arrow, "data-vpk-iso-arrow-for"));
		if (!onFocalFace && !onFacelessEdge && !onFocalDetail && !onFocalArrow && !accentMarker(el)) push("A3", `<${el.name}${attr(el, "data-vpk-iso-role") ? ` data-vpk-iso-role="${attr(el, "data-vpk-iso-role")}"` : ""}> paints the accent; only the focal part's faces (or a faceless focal's edge), its motion arrow and the focal leader dot may`);
	}
	// At rest no part with faces carries an accent outline: a focal part's edge under "accent" is the neutral 1 px edge of every
	// part (its accent outline is hover-only CSS). A faceless focal, which has nothing else to show the accent, keeps a 2 px accent
	// stroke; under "ink" every focal edge is the 2 px ink outline. Any other edge is the 1 px stroke.
	for (const el of elements.filter(item => attr(item, "data-vpk-iso-role") === "edge")) {
		const part = partOf(el);
		const isFocal = part && has(part, "data-vpk-iso-focal");
		const faceless = isFocal && !faces.some(face => facePart.get(face) === part);
		const width = Number(attr(el, "stroke-width"));
		if (isFocal && (!accented || faceless)) {
			const want = !accented ? preset.ink : `var(${ACCENT_TOKENS[0]})`;
			if (width !== preset.focalStroke || norm(attr(el, "stroke") ?? "") !== want) push("A3", `focal part "${unitName(part)}" edge must be a ${preset.focalStroke}px ${want} outline`);
		} else if (width > preset.stroke) push("A3", `part "${part ? unitName(part) : "?"}" has a ${attr(el, "stroke-width")}px outline at rest; only an ink focal or a faceless accent focal does (the accent outline is hover only)`);
	}

	// A4 stroke widths
	const widths = STROKE_SET;
	for (const el of elements) {
		if (!has(el, "stroke-width")) continue;
		const width = Number(attr(el, "stroke-width"));
		if (!widths.includes(width)) push("A4", `stroke-width="${attr(el, "stroke-width")}" on <${el.name}>; the kit uses ${widths.join(" | ")} (width 2 comes only from CSS)`);
	}

	// A5 painter order over overlapping rest hulls
	for (let i = 0; i < parts.length; i++) {
		for (let j = i + 1; j < parts.length; j++) {
			const a = parts[i];
			const b = parts[j];
			if (unitName(a) === unitName(b)) continue;
			const da = Number(attr(a, "data-vpk-iso-depth"));
			const db = Number(attr(b, "data-vpk-iso-depth"));
			if (da > db + 0.05 && convexOverlap(hullOf.get(a), hullOf.get(b))) push("A5", `"${attr(b, "data-vpk-iso-part")}" (depth ${db}) is painted after "${attr(a, "data-vpk-iso-part")}" (depth ${da}) but they overlap`);
		}
	}

	// A6 guides precede their plate; A16 guide grammar
	const role = preset.guide;
	for (const guide of elements.filter(el => attr(el, "data-vpk-iso-role") === "guide")) {
		const from = attr(guide, "data-vpk-iso-from");
		const plate = elements.find(el => attr(el, "data-vpk-iso-role") === "fill" && attr(partOf(el) ?? svg, "data-vpk-iso-part") === from);
		if (!plate) push("A6", `guide from "${from}" names no part`);
		else if (guide.index > plate.index) push("A6", `guide from "${from}" comes after its plate`);
		if (!has(ancestor(guide, n => has(n, "data-vpk-iso-fade")) ?? svg, "data-vpk-iso-fade")) push("A6", `guide from "${from}" is not wrapped in g[data-vpk-iso-fade]`);
		if (norm(attr(guide, "stroke-dasharray") ?? "") !== role.dash || norm(attr(guide, "stroke") ?? "") !== role.stroke || Number(attr(guide, "stroke-width")) !== preset.stroke) {
			push("A16", `guide from "${from}" must be stroke ${role.stroke}, width ${preset.stroke}, dash "${role.dash}"`);
		}
	}

	// A7 labels outside the scene, leaders onto their targets; A8 label type
	const sceneHull = hull([...hullOf.values()].flat());
	const boxes = [];
	for (const g of elements.filter(el => has(el, "data-vpk-iso-label-for") || has(el, "data-vpk-iso-annotation"))) {
		const text = g.children.find(el => el.name === "text");
		if (!text) continue;
		const size = Number(attr(text, "font-size")) || 11;
		const spacing = attr(text, "letter-spacing") ?? "0";
		const spacingEm = /em$/.test(spacing) ? Number.parseFloat(spacing) : Number.parseFloat(spacing) / size || 0;
		const content = text.text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
		const box = labelBox({ x: Number(attr(text, "x")), y: Number(attr(text, "y")) - size * 0.35, text: content, anchor: attr(text, "text-anchor") ?? "start" }, { size, spacingEm });
		boxes.push({ g, box, content });
		// Sentence case: a label of four or more letters with no lowercase letter is shouting (short acronyms such as "API" pass).
		if ((content.match(/\p{L}/gu) ?? []).length >= 4 && content === content.toUpperCase()) push("A8", `label "${content}" is all capitals; write it in sentence case`);
		if (!/Geist Mono/i.test(attr(text, "font-family") ?? "")) push("A8", `label "${content}" is not set in Geist Mono`);
		if (size < 10 || size > 12) push("A8", `label "${content}" font-size ${size} is outside 10–12`);
		if (convexOverlap(boxPolygon(box), sceneHull)) push("A7", `label "${content}" overlaps the figure (labels sit outside the scene)`);
	}
	for (const { g, box, content } of boxes) {
		if (!has(g, "data-vpk-iso-label-for")) continue;
		const leader = g.children.find(el => attr(el, "data-vpk-iso-role") === "leader");
		if (!leader) {
			push("A7", `label "${content}" has no leader`);
			continue;
		}
		const pts = pointsOf(leader);
		const target = attr(g, "data-vpk-iso-label-for");
		const silhouette = hull(parts.filter(part => unitName(part) === target || attr(part, "data-vpk-iso-part") === target).flatMap(part => hullOf.get(part)));
		if (pts.length < 2) push("A7", `label "${content}" leader is not a polyline`);
		else {
			if (!nearPolygon(pts.at(-1), silhouette, 2)) push("A7", `label "${content}" leader ends outside "${target}"`);
			if (!nearPolygon(pts[0], boxPolygon({ x: box.x - 2, y: box.y - 2, w: box.w + 4, h: box.h + 4 }), 0.5)) push("A7", `label "${content}" leader does not start at its label`);
			for (const other of boxes) {
				if (other.g === g) continue;
				for (let k = 1; k < pts.length; k++) if (segmentHitsBox(pts[k - 1], pts[k], other.box)) push("A7", `label "${content}" leader crosses label "${other.content}"`);
			}
		}
	}

	// A7 narrow-stage callouts (G2 J4): the SVG labels render near 4 px on a phone, so each label has a numbered tag
	// on its target that the narrow-stage CSS swaps in. A figure built before tags existed only warns.
	const labelGroups = elements.filter(el => has(el, "data-vpk-iso-label-for"));
	const tagGroups = elements.filter(el => has(el, "data-vpk-iso-tag"));
	// labels "none" (data-vpk-iso-labels="none" on the root): the figure draws no labels and no tags; A7, A8 and A20 have nothing to read.
	if (attr(svg, "data-vpk-iso-labels") === "none" && (labelGroups.length || tagGroups.length)) push("A7", `${labelGroups.length} label(s) and ${tagGroups.length} tag(s) on a figure built with labels "none"`);
	if (labelGroups.length && !tagGroups.length) push("A7", `${labelGroups.length} label(s) but no numbered narrow-stage tags; the labels render near 4 px on a phone (rebuild with build-figure.mjs)`, "warning");
	else if (tagGroups.length || labelGroups.length) {
		if (tagGroups.length !== labelGroups.length) push("A7", `${tagGroups.length} numbered tags for ${labelGroups.length} labels; each label has one tag`);
		if (tagGroups.length && !has(svg, "data-vpk-iso-narrow")) push("A7", "numbered tags without data-vpk-iso-narrow on the root <svg>; the narrow-stage CSS would never show them");
		for (const tag of tagGroups) {
			const n = Number(attr(tag, "data-vpk-iso-tag"));
			const gutter = has(tag, "data-vpk-iso-tag-for");
			const circle = gutter ? elements.find(el => el.name === "circle" && ancestor(el, node => node === tag)) : tag.children.find(el => el.name === "circle");
			const target = labelGroups[n - 1] && attr(labelGroups[n - 1], "data-vpk-iso-label-for");
			const silhouette = hull(parts.filter(part => unitName(part) === target).flatMap(part => hullOf.get(part)));
			if (gutter) {
				// A gutter tag sits in the labels layer (not in a part group or clip), on a leader that ends on its target.
				const leader = tag.children.find(el => attr(el, "data-vpk-iso-role") === "leader");
				const pts = leader ? pointsOf(leader) : [];
				if (!target || !circle || pts.length < 2) push("A7", `tag ${n} names no label or has no leader and disc`);
				else {
					if (attr(tag, "data-vpk-iso-tag-for") !== target) push("A7", `tag ${n} is for "${attr(tag, "data-vpk-iso-tag-for")}", its label is for "${target}"`);
					if (partOf(tag)) push("A7", `tag ${n} sits inside part "${unitName(partOf(tag))}"; gutter tags belong to the labels layer`);
					if (!nearPolygon(pts.at(-1), silhouette, 2)) push("A7", `tag ${n} leader ends outside "${target}"`);
					if (pointInPolygon([Number(attr(circle, "cx")), Number(attr(circle, "cy"))], sceneHull)) push("A7", `tag ${n} disc sits on the figure; it belongs in the gutter`);
				}
			} else if (!target || !circle) push("A7", `tag ${attr(tag, "data-vpk-iso-tag")} names no label or has no dot`);
			else if (!nearPolygon([Number(attr(circle, "cx")), Number(attr(circle, "cy"))], silhouette, 2)) push("A7", `tag ${n} is not on its target "${target}"`);
			else if (partOf(tag) && unitName(partOf(tag)) !== target) push("A7", `tag ${n} sits in part "${unitName(partOf(tag))}", not in its target "${target}"`);
		}
	}

	// A7 at every Gap slider stop (B2 decision 17b). The emitted SVG holds the rest pose only, so read the
	// pose model back from it (rest hulls, each part's screen explode vector, the labels with their
	// leaders, and the slider's range) and run the check the model audit runs before emitting.
	const slider = sliderOf(context.plateHtml);
	const poseLabels = boxes.flatMap(({ g, box, content }) => {
		const leader = has(g, "data-vpk-iso-label-for") ? g.children.find(el => attr(el, "data-vpk-iso-role") === "leader") : null;
		const points = leader ? pointsOf(leader) : [];
		return points.length >= 2 ? [{ text: content, target: attr(g, "data-vpk-iso-label-for"), box, points }] : [];
	});
	// Boxed dimensions (g[data-vpk-iso-annotation=dimension] with a <rect>): box, and the line = third subpath of the path.
	const poseDims = elements.filter(el => attr(el, "data-vpk-iso-annotation") === "dimension" && el.children.some(c => c.name === "rect")).map(g => {
		const rect = g.children.find(c => c.name === "rect");
		const points = pointsOf(g.children.find(c => c.name === "path"));
		const [x, y, w, h] = ["x", "y", "width", "height"].map(k => Number(attr(rect, k)));
		return { text: g.children.find(c => c.name === "text")?.text.trim() ?? "dimension", box: { x, y, w, h }, line: points.length >= 6 ? [points[4], points[5]] : null, strokes: Array.from({ length: Math.floor(points.length / 2) }, (_, i) => [points[2 * i], points[2 * i + 1]]) };
	});
	if (slider && (poseLabels.length || poseDims.length)) {
		const pieces = parts.map(part => ({ partId: unitName(part), paints: faces.some(face => facePart.get(face) === part && paintedValue(attr(face, "fill"))), hit: hullOf.get(part), window: windowOf(part), explode: parseVec(attr(part, "data-vpk-iso-explode")) ?? undefined }));
		findings.push(...auditLabelPoses({ figure: label, explode: slider, hull: sceneHull, pieces, labels: poseLabels, dims: poseDims }));
	}

	// A9 ids; A10 camera; A11 static art
	for (const el of elements) {
		const id = attr(el, "id");
		if (id !== undefined && !id.startsWith(`vpk-iso-${figure}-`)) push("A9", `svg id "${id}" must start with vpk-iso-${figure}-`);
	}
	if (context.figure !== undefined && context.figure !== figure) push("A9", `data-vpk-figure "${context.figure}" differs from data-vpk-iso-id "${figure}"`);
	if (context.rootTag !== undefined) {
		const cameras = context.rootTag.match(/\sdata-vpk-camera=/g) ?? [];
		const camera = parseCameraAttr(/\sdata-vpk-camera="([^"]*)"/.exec(context.rootTag)?.[1] ?? "");
		if (cameras.length !== 1 || !camera) push("A10", "the plate root must carry exactly one valid data-vpk-camera");
		else {
			const zdepth = Number(attr(svg, "data-vpk-iso-zdepth"));
			if (Number.isFinite(zdepth) && Math.abs(Math.sin((camera.elevation * Math.PI) / 180) - zdepth) > 0.002) push("A10", `data-vpk-camera "${camera.azimuth} ${camera.elevation}" disagrees with data-vpk-iso-zdepth ${zdepth}`);
		}
	}
	if (elements.some(el => has(el, "data-vpk-camera"))) push("A10", "parts carry no camera; data-vpk-camera belongs on the plate root only");
	for (const el of elements) {
		// Face text alone may carry one projection matrix (rule 17: label text never rotates; face text lies on its face).
		const faceText = el.name === "text" && attr(el, "data-vpk-iso-role") === "face-text" && attr(el, "class") === "iso-face-text" && FACE_TEXT_MATRIX.test(attr(el, "transform") ?? "");
		if (has(el, "transform") && !SMIL.has(el.name) && !faceText) push("A11", `<${el.name}> has a transform attribute; static art is the rest pose${el.name === "text" ? " (face text carries one matrix(...) with data-vpk-iso-role=\"face-text\" class=\"iso-face-text\")" : ""}`);
		if (el.name === "svg") push("A11", "nested <svg>");
		// No opacity below 1 anywhere: the kit draws no entry ghost or arrow (the user's redline), so no group is exempt.
		if (has(el, "opacity") && Number(attr(el, "opacity")) < 1) push("A11", `<${el.name}> has opacity="${attr(el, "opacity")}"`);
	}

	// A12 SMIL
	const anims = elements.filter(el => SMIL.has(el.name));
	if (!anims.length && has(svg, "data-vpk-smil-arm")) push("A12", "data-vpk-smil-arm on a figure with no SMIL", "warning");
	if (anims.length) {
		if (!has(svg, "data-vpk-smil-arm")) push("A12", "assembled figures carry data-vpk-smil-arm on the root <svg>");
		const durs = new Set(anims.map(el => attr(el, "dur")));
		const dur = Number.parseFloat([...durs][0]) * (/ms$/.test([...durs][0] ?? "") ? 1 : 1000);
		if (durs.size !== 1) push("A12", `${durs.size} different dur values; one shared dur per figure`);
		else if (!(dur > 0 && dur <= MAX_TOTAL_MS)) push("A12", `dur ${[...durs][0]} exceeds ${MAX_TOTAL_MS} ms`);
		const holds = new Set();
		for (const el of anims) {
			if (attr(el, "begin") !== "indefinite" || attr(el, "data-vpk-begin") !== "0s") push("A12", `<${el.name}> must be begin="indefinite" data-vpk-begin="0s"`);
			if (has(el, "repeatCount") || has(el, "repeatDur")) push("A12", `<${el.name}> repeats; assembly is one-shot`);
			const values = (attr(el, "values") ?? "").split(";").map(v => v.trim());
			const times = (attr(el, "keyTimes") ?? "").split(";").map(Number);
			if (values.length !== times.length) push("A12", `<${el.name}> has ${values.length} values but ${times.length} keyTimes`);
			if (times.some((t, k) => !(t >= 0 && t <= 1) || (k && t < times[k - 1]))) push("A12", `<${el.name}> keyTimes must be non-decreasing within [0, 1]`);
			if (attr(el, "calcMode") === "spline" && (attr(el, "keySplines") ?? "").split(";").length !== times.length - 1) push("A12", `<${el.name}> needs one keySpline per segment`);
			if (!isIdentityValue(el.name, attr(el, "attributeName"), values.at(-1) ?? "")) push("A12", `<${el.name}> must end at the rest pose (last value ${values.at(-1)})`);
			if (el.name === "animateTransform" && Number.isFinite(dur)) {
				let k = 0;
				while (k + 1 < values.length && values[k + 1] === values[0]) k++;
				holds.add(Math.round(times[k] * dur));
			}
		}
		const layers = [...holds].sort((a, b) => a - b);
		// Layers start on an even, overlapping stagger: every gap is staggerFor(layers), 180 ms shrinking with no floor
		// so the whole assembly still ends by MAX_TOTAL_MS.
		const step = staggerFor(layers.length);
		for (let k = 1; k < layers.length; k++) {
			const gap = layers[k] - layers[k - 1];
			if (Math.abs(gap - step) > 2) push("A12", `layer stagger ${gap} ms; every gap is ${step} ms for ${layers.length} layers`);
		}
	}

	// A18 the focal part renders something a reader can see; A19 the detail budget; A20 leader ink (manual-audit.mjs).
	const ctx = { elements, parts, faces, facePart, hullOf, clipOf, windowOf, focalUnits, push };
	auditFocalVisible(ctx);
	auditDetailBudget(ctx);
	auditShadows(ctx);
	auditLeaderInk({ ...ctx, labels: poseLabels.map(({ text, target, points }) => ({ text, target, end: points.at(-1) })) });

	// A17 weight and precision
	const bytes = Buffer.byteLength(svgSource);
	if (bytes > SVG_FAIL_BYTES) push("A17", `SVG is ${bytes} B; it fails above ${SVG_FAIL_BYTES} B (merge each part's line work into one path per role, split the figure)`);
	else if (bytes > SVG_WARN_BYTES) push("A17", `SVG is ${bytes} B, above the ${SVG_WARN_BYTES} B warning (it fails above ${SVG_FAIL_BYTES} B)`, "warning");
	for (const el of elements) if (el.name === "path" && decimals(attr(el, "d") ?? "")) {
		push("A17", "path coordinates use more than one decimal");
		break;
	}
	return findings;
}

/** Document audit: every iso-kit plate, plus document-wide id uniqueness (A9). */
export function auditHtml(html) {
	const findings = [];
	const plates = [...html.matchAll(/<figure\b[^>]*\bdata-vpk-engine=["']iso-kit["'][^>]*>[\s\S]*?<\/figure>/gi)];
	const figIds = new Map();
	const svgIds = new Map();
	for (const match of plates) {
		const plate = match[0];
		const rootTag = /^<figure\b[^>]*>/i.exec(plate)[0];
		const figure = /\sdata-vpk-figure="([^"]*)"/.exec(rootTag)?.[1];
		const figId = /\sdata-vpk-fig-id="([^"]*)"/.exec(rootTag)?.[1];
		const label = figId || figure || "figure";
		if (!figId || !/^FIG_\d{3}$/.test(figId)) findings.push({ rule: "A9", figure: label, severity: "error", message: `data-vpk-fig-id "${figId ?? ""}" must match FIG_nnn` });
		if (figId) figIds.set(figId, (figIds.get(figId) ?? 0) + 1);
		const svg = /<svg\b[^>]*\bdata-vpk-iso\b[\s\S]*?<\/svg>/i.exec(plate)?.[0];
		if (!svg) {
			findings.push({ rule: "A9", figure: label, severity: "error", message: "iso-kit plate without an svg[data-vpk-iso]" });
			continue;
		}
		for (const id of svg.matchAll(/\sid="([^"]+)"/g)) svgIds.set(id[1], (svgIds.get(id[1]) ?? 0) + 1);
		findings.push(...auditSvg(svg, { figure, figId, rootTag, plateHtml: plate }));
	}
	for (const [figId, count] of figIds) if (count > 1) findings.push({ rule: "A9", figure: figId, severity: "error", message: `${figId} is used by ${count} figures` });
	for (const [id, count] of svgIds) if (count > 1) findings.push({ rule: "A9", figure: id, severity: "error", message: `svg id "${id}" appears ${count} times` });
	return { figures: plates.length, findings };
}

export function auditHtmlFile(file) {
	return { file, ...auditHtml(fs.readFileSync(file, "utf8")) };
}

// The pose geometry and auditLabelPoses live in layout.mjs; re-exported for the callers and tests of this module.
export { auditLabelPoses, scenePoses };

/**
 * Model-level audit on a built scene, before emitting: the label poses (A7, auditLabelPoses), the
 * viewBox, the focal part and the tone count.
 */
export function auditScene(scene) {
	const findings = auditLabelPoses({
		figure: scene.figId,
		explode: scene.teardown ? null : scene.explode,
		hull: scene.hull,
		pieces: scene.pieces.map(piece => ({ ...piece, paints: piece.solids.some(solid => solid.fill) })),
		labels: scene.labels.map(label => ({ text: label.text, target: label.target, box: label.box, points: label.leader.points })),
		dims: scene.dims.map(dim => ({ text: dim.text, box: dim.box, line: [dim.a2, dim.b2], strokes: dimStrokes(dim) })),
	});
	const push = (rule, message) => void findings.push({ rule, figure: scene.figId, severity: "error", message });
	const [w, h] = scene.viewBox;
	for (const label of scene.labels) {
		const b = label.box;
		if (b.x < 0 || b.y < 0 || b.x + b.w > w || b.y + b.h > h) push("A7", `label "${label.text}" leaves the viewBox`);
	}
	// The accent faces and the three ink faces each count as one tone (A2 in auditSvg counts them the same way).
	const emphasis = scene.emphasis ?? "accent";
	const tones = new Set(scene.pieces.flatMap(piece => {
		const roles = rolesFor({ focal: piece.focal, active: Boolean(piece.state), tone: piece.tone, emphasis });
		if (piece.focal && emphasis === "accent") return ["accent"];
		return [roles.fill, roles.top, roles.shade].map(role => (isInkFace(role.fill) ? "ink" : role.fill));
	}));
	if (tones.size > MAX_FILLS) push("A2", `${tones.size} face tones; at most ${MAX_FILLS}`);
	// Painter cycles (painter.mjs): two solids that each cover the other, so no painter order is right; they keep the depth-point order.
	const cycles = scene.painterCycles ?? [];
	if (cycles.length) findings.push({ rule: "A5", figure: scene.figId, severity: "warning", message: `${cycles.length} painter cycle(s), e.g. "${cycles[0][0]}" and "${cycles[0][1]}" each cover the other (interpenetrating solids); split one into pieces or move it clear` });
	return findings;
}

export function formatFindings(result, { label = result.file ?? "document" } = {}) {
	const errors = result.findings.filter(f => f.severity === "error");
	const warnings = result.findings.filter(f => f.severity !== "error");
	const lines = result.findings.map(f => `${f.severity === "error" ? "✗" : "⚠"} ${f.rule} ${f.figure}: ${f.message}`);
	const name = path.relative(process.cwd(), label) || label;
	lines.push(errors.length
		? `✗ iso audit: ${name}: ${result.figures} figure(s), ${errors.length} error(s), ${warnings.length} warning(s)`
		: `✓ iso audit: ${name}: ${result.figures} figure(s), 0 errors${warnings.length ? `, ${warnings.length} warning(s)` : ""}`);
	return lines.join("\n");
}

// The same finding reported by the model audit and the document audit appears once.
export function uniqueFindings(findings) {
	const seen = new Set();
	return findings.filter(finding => {
		const key = `${finding.rule}\u0000${finding.figure}\u0000${finding.severity}\u0000${finding.message}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

/**
 * The --check-iso runner (build.mjs --check-iso and this file's CLI). Returns an exit code:
 * 0 ok (also with errors unless --strict), 1 errors under --strict, 2 usage error or unreadable file.
 */
export function runCheckIso({ file, strict = false, json = false } = {}) {
	if (!file) {
		console.error("Usage: --check-iso <file.html> [--strict] [--json]");
		return 2;
	}
	const abs = path.resolve(file);
	let result;
	try {
		result = auditHtmlFile(abs);
	} catch (error) {
		console.error(error.code === "ENOENT" ? `File not found: ${abs}` : `Cannot read ${abs}: ${error.code === "EISDIR" ? "it is a directory" : error.message}`);
		return 2;
	}
	console.log(json ? JSON.stringify(result, null, "\t") : formatFindings(result));
	return strict && result.findings.some(f => f.severity === "error") ? 1 : 0;
}

function main(argv = process.argv.slice(2)) {
	const file = argv.find(arg => !arg.startsWith("--"));
	if (!file) {
		console.error("Usage: iso/audit.mjs <file.html> [--json] [--strict]");
		return 2;
	}
	return runCheckIso({ file, strict: argv.includes("--strict"), json: argv.includes("--json") });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) process.exitCode = main();
