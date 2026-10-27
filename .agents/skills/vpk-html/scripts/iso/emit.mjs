// iso/emit — scene → SVG, plate HTML and region markers (the iso-kit DOM contract, ws3 C-iso-2;
// integration K11, R20). Output is deterministic: same brief, same bytes.
//
// Guarantees (each covered by emit.test.mjs): fill paths have no stroke and use only M/L/Z; stroked
// roles have no fill (they inherit fill="none" from the root); no transform=, patternTransform,
// nested <svg>, opacity= or escape-hatch attribute; every id starts with vpk-iso-<briefId>-; the
// static art is the rest pose; static figures (no `interact`) carry no behaviour attributes,
// controls or lightbox opt-out.

import { pathOf } from "../anatomy/vendor/kit/iso-kit.mjs";
import { enterAnimation, fadeAnimation, fadeStart, layerClassAnimation } from "./motion.mjs";
import { ACCENT_TOKENS } from "./accent.mjs";
import { GLOW_STOPS, rayPaint, rolesFor } from "./palette.mjs";

// Numbered marks are 20 px ink discs (mono 500, 11 px) inside a paper ring and an ink ring; the narrow-stage tag
// is the same disc a little larger, because a phone draws the scene at about 0.6 of a desktop's scale.
export const MARK_RADIUS = 10;
export const MARK_RING = 12;
export const MARK_FONT = 11;
export const MANUAL_TAG_RADIUS = 14;
// How far past its viewBox width an svg may grow to fill a wide frame.
export const MANUAL_MAX_ZOOM = 1.5;
// The dash of a glass part's hidden edges (its creases): the hidden-line look.
export const GLASS_DASH = "2 2";
// Narrow-stage callout numeral (viewBox units): at the cropped scale (about 0.55-0.75 on a 320-390 px phone) the digit
// renders at 9-12 px.
export const TAG_FONT = 16;
// The stage's width at a 390 px phone (page gutters 2 x 20, the frame's padding and border 2 x 17) and the least size, in
// rendered px, a narrow-stage numeral may have (illustrations.md § Style, rule 5).
export const NARROW_STAGE_PX = 316;
export const NARROW_TEXT_FLOOR_PX = 9;
// How much the narrow tag and the mark disc grow so that their numerals render at the floor on a 390 px phone (1 when they already do).
export function narrowScaleVars(scene, width) {
	const unit = (NARROW_STAGE_PX * (scene.crop ? scene.crop.width / 100 : 1)) / width;
	const scale = font => Math.max(1, Math.ceil(((NARROW_TEXT_FLOOR_PX * 1.05) / (font * unit)) * 100) / 100);
	return [...(scene.tags.length ? [`--vpk-iso-tag-scale: ${scale(TAG_FONT)}`] : []), ...(scene.marks.length ? [`--vpk-iso-mark-scale: ${scale(MARK_FONT)}`] : [])];
}

const escapeText = value => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeAttr = value => escapeText(value).replace(/"/g, "&quot;");
const num = value => {
	const text = (Math.round(value * 10) / 10).toFixed(1).replace(/\.0$/, "");
	return text === "-0" ? "0" : text;
};
const vec = ([x, y]) => `${num(x)} ${num(y)}`;
const ids = scene => {
	const base = `vpk-iso-${scene.id}`;
	return { root: base, arrow: `${base}-arrow`, accent: `${base}-arrow-accent`, flow: `${base}-flow`, dots: `${base}-dots`, clip: part => `${base}-clip-${part}`, recv: part => `${base}-recv-${part}`, win: part => `${base}-win-${part}`, glow: k => `${base}-glow-${k}` };
};

export function renderDefs(scene, indent = "") {
	const id = ids(scene);
	const out = [];
	if (scene.texture) out.push(`<pattern id="${id.dots}" width="8" height="8" patternUnits="userSpaceOnUse">`, `\t<circle cx="4" cy="4" r="0.6" fill="${scene.texture}"/>`, "</pattern>");
	// Markers: the label leader's (a small ink dot on the part), the focal label's (the same dot in the accent with an ink
	// ring, like the prototype's bubble dot) and the flow arrow's head (ink, heavier through the CSS stroke width).
	if (scene.labels.length) {
		out.push(`<marker id="${id.arrow}" viewBox="0 0 8 8" refX="4" refY="4" markerWidth="5" markerHeight="5" orient="auto">`, `\t<circle cx="4" cy="4" r="3" fill="${scene.preset.ink}"/>`, "</marker>");
		if (scene.labels.some(label => isFocalTarget(scene, label.target))) out.push(`<marker id="${id.accent}" viewBox="0 0 8 8" refX="4" refY="4" markerWidth="5" markerHeight="5" orient="auto">`, `\t<circle cx="4" cy="4" r="3" fill="var(${ACCENT_TOKENS[0]})" stroke="${scene.preset.ink}" stroke-width="${scene.preset.stroke}"/>`, "</marker>");
	}
	if (scene.annotations.some(note => note.kind === "arrow" && !note.of)) {
		out.push(`<marker id="${id.flow}" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="4" markerHeight="4" orient="auto">`, `\t<path d="M0 0L8 4L0 8Z" fill="${scene.preset.edge}"/>`, "</marker>");
	}
	for (const piece of scene.pieces) {
		if (!piece.clipTo) continue;
		out.push(`<clipPath id="${id.clip(piece.partId)}">`, `\t<path d="${piece.clipD}"/>`, "</clipPath>");
	}
	// A part's top face as the window for the shadows it receives (renderReceived).
	for (const piece of scene.pieces) if (piece.received) out.push(`<clipPath id="${id.recv(piece.partId)}">`, `\t<path d="${pathOf(piece.received.clip, true)}"/>`, "</clipPath>");
	// A cutaway's front shell shows everywhere but its window: the frame less the window polygon, even-odd.
	const [w, h] = scene.viewBox;
	for (const piece of scene.pieces) if (piece.window) out.push(`<clipPath id="${id.win(piece.partId)}">`, `\t<path d="M0 0L${w} 0L${w} ${h}L0 ${h}Z${pathOf(piece.window, true)}" clip-rule="evenodd"/>`, "</clipPath>");
	// Glow (plan § 2 W): the only gradients the kit emits, ids vpk-iso-<id>-glow-<k> (check-html admits an iso root's gradients by
	// that prefix). A glowing part's gradient is centred on the part in user space (it moves with its group); the halo's is one
	// bounding-box gradient shared by every glow part. Stops: the accent pair and grey tokens only (palette GLOW_STOPS, audit A1).
	const stops = list => list.map(([offset, color]) => `\t<stop offset="${offset}" stop-color="${color}"/>`);
	for (const piece of scene.pieces) if (piece.glow) out.push(`<radialGradient id="${id.glow(piece.glow.k)}" gradientUnits="userSpaceOnUse" cx="${num(piece.glow.cx)}" cy="${num(piece.glow.cy)}" r="${num(piece.glow.r)}">`, ...stops(GLOW_STOPS.body), "</radialGradient>");
	if (scene.pieces.some(piece => piece.halo)) out.push(`<radialGradient id="${id.glow("halo")}">`, ...stops(GLOW_STOPS.halo), "</radialGradient>");
	if (!out.length) return "";
	return [`${indent}<defs>`, ...out.map(line => `${indent}\t${line}`), `${indent}</defs>`].join("\n");
}

function strokeAttrs({ stroke, width, dash }) {
	return ` stroke="${stroke}" stroke-width="${width}"${dash ? ` stroke-dasharray="${dash}"` : ""}`;
}

export function renderPart(piece, scene, indent = "") {
	const id = ids(scene);
	const part = scene.brief.parts.find(entry => entry.id === piece.partId);
	const emphasis = scene.emphasis ?? "accent";
	const roles = rolesFor({ focal: piece.focal, active: Boolean(piece.state), tone: piece.tone, emphasis, glow: piece.glow ? `url(#${id.glow(piece.glow.k)})` : null });
	const attrs = [`data-vpk-iso-part="${escapeAttr(piece.id)}"`, `data-vpk-iso-depth="${num(piece.depth)}"`];
	if (piece.of) attrs.push(`data-vpk-iso-of="${escapeAttr(piece.of)}"`);
	if (piece.state) attrs.push(`data-vpk-iso-state="${piece.state}"`);
	if (piece.explode) attrs.push(`data-vpk-iso-explode="${vec(piece.explode)}"`);
	if (piece.depth0 !== undefined) attrs.push(`data-vpk-iso-depth0="${num(piece.depth0)}"`);
	if (piece.lift) attrs.push(`data-vpk-iso-lift="${vec(piece.lift)}"`);
	if (piece.stacks) attrs.push(`data-vpk-iso-plan="${piece.plan.map(box => box.map(num).join(" ")).join(";")}"`);
	if (piece.label) attrs.push(`data-vpk-iso-label="${escapeAttr(piece.label)}"`);
	if (piece.focal) attrs.push("data-vpk-iso-focal");
	if (piece.clipTo) attrs.push(`clip-path="url(#${id.clip(piece.partId)})"`);
	// A step or scrub figure's variant or turn sample, and any piece the rest state does not show (state-runtime.mjs swaps them).
	if (piece.variant) attrs.push(`data-vpk-iso-variant="${escapeAttr(piece.variant)}"`);
	if (piece.restHidden) attrs.push('display="none"');
	// A glass part (tone "glass") paints no face; its hidden edges are dashed creases. A concave prism hits by its convex solids.
	const glass = piece.tone === "glass";
	if (glass) attrs.push('data-vpk-iso-tone="glass"');
	if (piece.hitSolids) attrs.push('data-vpk-iso-hit="solids"');
	// A cutaway's front shell: its window polygon, which the runtime's hit test leaves to the parts inside.
	if (piece.window) attrs.push(`data-vpk-iso-window="${piece.window.map(vec).join(" ")}"`);
	const lines = [`${indent}<g ${attrs.join(" ")}>`];
	const dash = part.kind === "gap" ? scene.preset.guide.dash : null;
	const solidLines = (solid, index, pad) => {
		const add = line => lines.push(`${pad}${line}`);
		// A solid with a bore (a washer, a lathe with a hole) carries the bore as a second subpath of its fill: even-odd leaves it open.
		const rule = solid.evenodd ? ' fill-rule="evenodd"' : "";
		// A glow part (kind "glow") is one halo path in the shared halo gradient; it has no faces or line work.
		if (solid.glow) add(`<path data-vpk-iso-role="glow" d="${solid.glow}" fill="url(#${id.glow("halo")})"/>`);
		if (solid.fill && !glass) add(`<path data-vpk-iso-role="fill" data-vpk-iso-tone="${roles.fill.tone}" d="${solid.fill}" fill="${roles.fill.fill}"${rule}/>`);
		if (solid.shade && roles.shade && !glass) add(`<path data-vpk-iso-role="shade" data-vpk-iso-tone="${roles.shade.tone}" d="${solid.shade}" fill="${roles.shade.fill}"/>`);
		if (solid.top && !glass) add(`<path data-vpk-iso-role="top" data-vpk-iso-tone="${roles.top.tone}" d="${solid.top}" fill="${roles.top.fill}"/>`);
		// A cutaway's cavity (the inner wall seen through the window) is a recess-tone fill; its section faces take the cut tone.
		if (solid.recess) add(`<path data-vpk-iso-role="recess" data-vpk-iso-tone="${roles.recess.tone}" d="${solid.recess}" fill="${roles.recess.fill}"/>`);
		if (solid.cut) add(`<path data-vpk-iso-role="cut" data-vpk-iso-tone="${roles.cut.tone}" d="${solid.cut}" fill="${roles.cut.fill}"/>`);
		// Section hatch is drawn in the edge stroke: the mark grey vanished on the mid-grey cut tone.
		if (solid.hatch) add(`<path data-vpk-iso-role="hatch" d="${solid.hatch}"${strokeAttrs({ ...roles.edge, width: scene.preset.stroke })}/>`);
		// Shadows from the parts above land on the first solid's top (a tray's floor), under its line work.
		if (index === (piece.received?.solid ?? 0) && piece.received) lines.push(...renderReceived(piece, scene, pad));
		if (solid.crease) add(`<path data-vpk-iso-role="crease" d="${solid.crease}"${strokeAttrs(glass ? { ...roles.crease, dash: GLASS_DASH } : roles.crease)}/>`);
		if (solid.edge) {
			// A focal part with no faces (the flash ring, a wire, a gap outline) has nowhere else to show the accent, so its 2 px stroke
			// takes it at rest (the ink under emphasis "ink"); a focal with faces shows the accent on them and keeps the neutral edge.
			const faceless = piece.focal && (glass || !piece.solids.some(item => item.fill || item.top || item.shade));
			const focalStroke = emphasis !== "accent" ? scene.preset.ink : `var(${ACCENT_TOKENS[0]})`;
			const focalWidth = scene.preset.focalStroke;
			const edge = dash ? { stroke: piece.focal ? focalStroke : scene.preset.guide.stroke, width: piece.focal ? focalWidth : roles.edge.width, dash } : faceless ? { ...roles.edge, stroke: focalStroke, width: focalWidth } : roles.edge;
			add(`<path data-vpk-iso-role="edge" d="${solid.edge}"${strokeAttrs(edge)}/>`);
		}
	};
	if (piece.window) {
		// The shell and its detail inside the window clip; the section faces after it, unclipped (they stand in the window's edges).
		lines.push(`${indent}\t<g data-vpk-iso-clipped clip-path="url(#${id.win(piece.partId)})">`);
		piece.solids.forEach((solid, index) => solid.clipped && solidLines(solid, index, `${indent}\t\t`));
		lines.push(...renderDetail(piece.detail, roles, scene, `${indent}\t\t`), `${indent}\t</g>`);
		piece.solids.forEach((solid, index) => !solid.clipped && solidLines(solid, index, `${indent}\t`));
	} else {
		piece.solids.forEach((solid, index) => solidLines(solid, index, `${indent}\t`));
		lines.push(...renderDetail(piece.detail, roles, scene, `${indent}\t`));
	}
	const add = line => lines.push(`${indent}\t${line}`);
	const index = scene.pieces.indexOf(piece);
	for (const tag of scene.tags.filter(entry => entry.piece === index)) add(renderTag(tag, scene));
	for (const mark of scene.marks.filter(entry => entry.piece === index)) add(renderMark(mark, scene));
	lines.push(`${indent}</g>`);
	return lines.join("\n");
}

// A part's detail (detail.mjs), one element per role so A19 counts it and a figure stays light: recess fills, hatch, every mark
// merged into one path (dashed lines in a second), the dots as one path of tiny closed arcs, then face text. Face text is the
// one transform the kit emits: a matrix that projects the text onto its face (A11's exception), class iso-face-text so the
// print reset and check-figures recognise it.
function renderDetail(detail, roles, scene, pad) {
	if (!detail) return [];
	const out = [];
	for (const recess of detail.recess) out.push(`${pad}<path data-vpk-iso-role="recess" data-vpk-iso-tone="${roles.recess.tone}" d="${recess.fill}" fill="${roles.recess.fill}"/>`);
	if (detail.hatch.length) out.push(`${pad}<path data-vpk-iso-role="hatch" d="${detail.hatch.join("")}"${strokeAttrs(roles.mark)}/>`);
	if (detail.mark.length) out.push(`${pad}<path data-vpk-iso-role="mark" d="${detail.mark.join("")}"${strokeAttrs(roles.mark)}/>`);
	if (detail.dash.length) out.push(`${pad}<path data-vpk-iso-role="mark" d="${detail.dash.join("")}"${strokeAttrs({ ...roles.mark, dash: "2 2" })}/>`);
	if (detail.dot.length) out.push(`${pad}<path data-vpk-iso-role="dot" d="${detail.dot.join("")}" fill="${roles.dot.fill}"/>`);
	for (const text of detail.text) {
		const anchor = text.anchor === "start" ? "" : ` text-anchor="${text.anchor}"`;
		out.push(`${pad}<text data-vpk-iso-role="face-text" class="iso-face-text" transform="${text.matrix}" font-family="${scene.preset.label.family}" font-size="${text.size}"${anchor} fill="${roles.text.fill}">${escapeText(text.text)}</text>`);
	}
	return out;
}

// A numbered callout dot on a label's anchor: hidden (display="none") until the narrow-stage CSS swaps it in for
// the label text. Inside the target's part group, so it moves and hides with the part. It is drawn as the numbered mark:
// an ink disc, the digit in paper, a paper ring.
function renderTag(tag, scene) {
	if (tag.disc) return renderGutterTag(tag, scene);
	const [x, y] = tag.point;
	const { ink, paper, label } = scene.preset;
	const disc = `<circle cx="${num(x)}" cy="${num(y)}" r="${MANUAL_TAG_RADIUS}" fill="${ink}" stroke="${paper}" stroke-width="1.5"/>`;
	return `<g data-vpk-iso-tag="${tag.n}" display="none">${disc}<text x="${num(x)}" y="${num(y + TAG_FONT * 0.35)}" text-anchor="middle" fill="${paper}" font-family="${label.family}" font-size="${TAG_FONT}" font-weight="500">${tag.n}</text></g>`;
}

// Narrow tag (r1.7/r1.8): a numbered ink disc in the free gutter on a straight 1 px leader that ends in a dot on the part.
// It rides in the labels layer, outside every part group and clip window; the runtime drags the leader's last point with the
// part (manual-runtime tagLines) and CSS scales only the disc group.
function renderGutterTag(tag, scene) {
	const { ink, paper, label, stroke } = scene.preset;
	const [x, y] = tag.disc;
	return [
		`<g data-vpk-iso-tag="${tag.n}" data-vpk-iso-tag-for="${escapeAttr(tag.target)}" display="none">`,
		`<path data-vpk-iso-role="leader" d="${pathOf([tag.start, tag.point])}" stroke="${ink}" stroke-width="${stroke}" marker-end="url(#${ids(scene).arrow})"/>`,
		"<g data-vpk-iso-tag-disc>",
		`<circle cx="${num(x)}" cy="${num(y)}" r="${MANUAL_TAG_RADIUS}" fill="${ink}" stroke="${paper}" stroke-width="1.5"/>`,
		`<text x="${num(x)}" y="${num(y + TAG_FONT * 0.35)}" text-anchor="middle" fill="${paper}" font-family="${label.family}" font-size="${TAG_FONT}" font-weight="500">${tag.n}</text>`,
		"</g>",
		"</g>",
	].join("");
}

// A brief mark: a 20 px ink disc with the number in paper (mono 500, 11 px), a 1.5 px paper ring and a 1 px ink ring,
// on a 1 px leader to its point. It rides inside its target's part group. The disc group scales up on a narrow stage (CSS).
function renderMark(mark, scene) {
	const [px, py] = mark.point;
	const [cx, cy] = mark.disc;
	const length = Math.hypot(px - cx, py - cy) || 1;
	const edge = [cx + ((px - cx) / length) * MARK_RING, cy + ((py - cy) / length) * MARK_RING];
	const { ink, paper, label } = scene.preset;
	return [
		`<g data-vpk-iso-mark="${mark.n}">`,
		`<path d="${pathOf([edge, mark.point])}" stroke="${ink}" stroke-width="${scene.preset.stroke}"/>`,
		`<g data-vpk-iso-mark-disc>`,
		`<circle cx="${num(cx)}" cy="${num(cy)}" r="${MARK_RADIUS}" fill="${ink}"/>`,
		`<circle cx="${num(cx)}" cy="${num(cy)}" r="${MARK_RADIUS + 0.75}" stroke="${paper}" stroke-width="1.5"/>`,
		`<circle cx="${num(cx)}" cy="${num(cy)}" r="${MARK_RING}" stroke="${ink}" stroke-width="${scene.preset.stroke}"/>`,
		`<text x="${num(cx)}" y="${num(cy + MARK_FONT * 0.35)}" text-anchor="middle" fill="${paper}" font-family="${label.family}" font-size="${MARK_FONT}" font-weight="500">${mark.n}</text>`,
		"</g>",
		"</g>",
	].join("");
}

function renderGuide(guide, scene, indent, fade) {
	const roles = rolesFor();
	const lines = [`${indent}<g data-vpk-iso-fade>`, `${indent}\t<path data-vpk-iso-role="guide" data-vpk-iso-from="${guide.from}" data-vpk-iso-to="${guide.to}" d="${guide.d}"${strokeAttrs(roles.guide)}/>`];
	if (fade) lines.push(`${indent}\t${fade}`);
	lines.push(`${indent}</g>`);
	return lines.join("\n");
}

function renderDimension(note, scene, indent) {
	const [ax, ay] = note.a;
	const [bx, by] = note.b;
	const length = Math.hypot(bx - ax, by - ay) || 1;
	const u = [(bx - ax) / length, (by - ay) / length];
	let n = [-u[1], u[0]];
	const xs = scene.hull.map(([x]) => x);
	const ys = scene.hull.map(([, y]) => y);
	const centre = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
	const mid = [(ax + bx) / 2, (ay + by) / 2];
	if ((mid[0] - centre[0]) * n[0] + (mid[1] - centre[1]) * n[1] < 0) n = [-n[0], -n[1]];
	const off = note.offset ?? 18;
	const at = ([x, y], k) => [x + n[0] * k, y + n[1] * k];
	const a2 = at(note.a, off);
	const b2 = at(note.b, off);
	const tick = ([x, y]) => pathOf([[x - (u[0] + n[0]) * 3, y - (u[1] + n[1]) * 3], [x + (u[0] + n[0]) * 3, y + (u[1] + n[1]) * 3]]);
	const d = [pathOf([at(note.a, 4), at(note.a, off + 4)]), pathOf([at(note.b, 4), at(note.b, off + 4)]), pathOf([a2, b2]), tick(a2), tick(b2)].join("");
	const text = at(mid, off + 12);
	const font = scene.preset.label;
	return [
		`${indent}<g data-vpk-iso-annotation="dimension">`,
		`${indent}\t<path d="${d}" stroke="${scene.preset.leader}" stroke-width="${scene.preset.stroke}"/>`,
		`${indent}\t<text x="${num(text[0])}" y="${num(text[1] + font.size * 0.35)}" text-anchor="middle" fill="${font.fill}" font-family="${font.family}" font-size="${font.size}" letter-spacing="${font.spacingEm}em">${escapeText(note.text)}</text>`,
		`${indent}</g>`,
	].join("\n");
}

// A tick-ended dimension line with a boxed mono label on its middle (paper ground, 1 px ink border, square corners).
function renderBoxedDimension(dim, scene, indent) {
	const { leader, ink, paper, stroke, label: font } = scene.preset;
	const tick = ([x, y]) => pathOf([[x - (dim.u[0] + dim.n[0]) * 3, y - (dim.u[1] + dim.n[1]) * 3], [x + (dim.u[0] + dim.n[0]) * 3, y + (dim.u[1] + dim.n[1]) * 3]]);
	const d = [pathOf(dim.extA), pathOf(dim.extB), pathOf([dim.a2, dim.b2]), tick(dim.a2), tick(dim.b2)].join("");
	const { x, y, w, h } = dim.box;
	return [
		`${indent}<g data-vpk-iso-annotation="dimension">`,
		`${indent}\t<path d="${d}" stroke="${leader}" stroke-width="${stroke}"/>`,
		`${indent}\t<rect x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}" fill="${paper}" stroke="${ink}" stroke-width="${stroke}"/>`,
		`${indent}\t<text x="${num(dim.middle[0])}" y="${num(dim.middle[1] + font.size * 0.35)}" text-anchor="middle" fill="${font.fill}" font-family="${font.family}" font-size="${font.size}" letter-spacing="${font.spacingEm}em">${escapeText(dim.text)}</text>`,
		`${indent}</g>`,
	].join("\n");
}

// The scale bar, a tick-ended line along world +x with its real length in mono at the far end.
function renderScaleBar(bar, scene, indent) {
	const { leader, stroke, label: font } = scene.preset;
	const d = [pathOf([bar.a, bar.b]), ...bar.ticks.map(points => pathOf(points))].join("");
	return [
		`${indent}<g data-vpk-iso-annotation="scale">`,
		`${indent}\t<path d="${d}" stroke="${leader}" stroke-width="${stroke}"/>`,
		`${indent}\t<text x="${num(bar.textX)}" y="${num(bar.textY)}" fill="${font.fill}" font-family="${font.family}" font-size="${font.size}" letter-spacing="${font.spacingEm}em">${escapeText(bar.text)}</text>`,
		`${indent}</g>`,
	].join("\n");
}

// A label names the focal part when its target is the focal part's id or the unit (`of`) the focal part belongs to. Only an
// accent focal takes the accent dot and arrow: under emphasis "ink" or "none" nothing is accented.
function isFocalTarget(scene, target) {
	if ((scene.emphasis ?? "accent") !== "accent") return false;
	return scene.pieces.some(piece => piece.focal && (piece.partId === target || piece.id === target || piece.of === target));
}

// Selective colour for a motion arrow that names the part it moves (`of`): its head is a filled path in the group (a marker could
// not change colour with its part), the same 8 x 8 triangle the flow marker draws at the 2 px weight. It is drawn in the accent
// when its part is the focal one; the runtime adds .is-active while its part is hovered or selected, and the CSS accents it then.
// An arrow without an owner stays neutral.
function renderOwnedArrow(note, scene, indent) {
	const accent = isFocalTarget(scene, note.of);
	const length = Math.hypot(note.b[0] - note.a[0], note.b[1] - note.a[1]) || 1;
	const u = [(note.b[0] - note.a[0]) / length, (note.b[1] - note.a[1]) / length];
	const at = (k, n) => [note.b[0] + u[0] * k - u[1] * n, note.b[1] + u[1] * k + u[0] * n];
	const paint = accent ? `var(${ACCENT_TOKENS[0]})` : scene.preset.edge;
	return [
		`${indent}<g data-vpk-iso-annotation="arrow" data-vpk-iso-arrow-for="${escapeAttr(note.of)}"${accent ? " data-vpk-iso-accent" : ""}${scene.preset.activeStroke > scene.preset.stroke ? ` data-vpk-iso-weight="${scene.preset.activeStroke}"` : ""}>`,
		`${indent}\t<path d="${pathOf([note.a, at(-6, 0)])}" stroke="${paint}" stroke-width="${scene.preset.stroke}"/>`,
		`${indent}\t<path data-vpk-iso-role="arrowhead" d="${pathOf([at(1, 0), at(-7, -4), at(-7, 4)], true)}" fill="${paint}"/>`,
		`${indent}</g>`,
	].join("\n");
}

// A `line` annotation (plan § 2 X): a polyline through its projected points, in the guide tone (dashed by default, or dotted, or
// solid), or a spectrum ray in one of the three ray tokens (role "ray", solid, on a root marked data-vpk-iso-spectrum). `ends: "dot"`
// puts a small filled dot on each end, in the line's paint.
export const LINE_DASH = Object.freeze({ dotted: "1 2", dashed: "3 3", solid: null });
function renderLine(note, scene, indent) {
	const ray = Boolean(note.spectrum);
	const paint = ray ? rayPaint(note.spectrum) : scene.preset.guide.stroke;
	const dash = ray ? null : LINE_DASH[note.dash ?? "dashed"];
	const role = ray ? "ray" : "guide-line";
	const dots = note.ends === "dot" ? [note.points[0], note.points.at(-1)].map(([x, y]) => `M${num(x + 1.5)} ${num(y)}a1.5 1.5 0 1 0 -3 0a1.5 1.5 0 1 0 3 0`).join("") : "";
	return [
		`${indent}<g data-vpk-iso-annotation="line"${ray ? ` data-vpk-iso-spectrum-key="${note.spectrum}"` : ""}>`,
		`${indent}\t<path data-vpk-iso-role="${role}" d="${pathOf(note.points)}"${strokeAttrs({ stroke: paint, width: scene.preset.stroke, dash })}/>`,
		...(dots ? [`${indent}\t<path data-vpk-iso-role="${role}-end" d="${dots}" fill="${paint}"/>`] : []),
		`${indent}</g>`,
	].join("\n");
}

// Every label text sits on a chip (label box plus CHIP_PAD, rx 2) that stays unpainted: the accent marks the part and the
// focal label's leader dot, never the text (an orange box behind a label competes with the part it names).
export const CHIP_PAD = Object.freeze([3, 2]);

export function renderLabels(scene, indent = "") {
	const id = ids(scene);
	const font = scene.preset.label;
	const lines = [];
	for (const label of scene.labels) {
		const focal = isFocalTarget(scene, label.target);
		const b = label.box;
		lines.push(
			`${indent}\t<g data-vpk-iso-label-for="${escapeAttr(label.target)}"${focal ? " data-vpk-iso-accent" : ""}>`,
			`${indent}\t\t<path data-vpk-iso-role="leader" d="${label.leader.d}" stroke="${scene.preset.leader}" stroke-width="${scene.preset.stroke}" marker-end="url(#${focal ? id.accent : id.arrow})"/>`,
			`${indent}\t\t<rect data-vpk-iso-chip x="${num(b.x - CHIP_PAD[0])}" y="${num(b.y - CHIP_PAD[1])}" width="${num(b.w + 2 * CHIP_PAD[0])}" height="${num(b.h + 2 * CHIP_PAD[1])}" rx="2" fill="none"/>`,
			`${indent}\t\t<text x="${num(label.textX)}" y="${num(label.textY)}"${label.textAnchor === "end" ? ' text-anchor="end"' : ""} fill="${font.fill}" font-family="${font.family}" font-size="${font.size}" letter-spacing="${font.spacingEm}em">${escapeText(label.text)}</text>`,
			`${indent}\t</g>`,
		);
	}
	for (const note of scene.annotations) {
		if (note.kind === "dimension") lines.push(renderDimension(note, scene, `${indent}\t`));
		else if (note.kind === "line") lines.push(renderLine(note, scene, `${indent}\t`));
		else if (note.of) lines.push(renderOwnedArrow(note, scene, `${indent}\t`));
		else lines.push(`${indent}\t<g data-vpk-iso-annotation="arrow"${scene.preset.activeStroke > scene.preset.stroke ? ` data-vpk-iso-weight="${scene.preset.activeStroke}"` : ""}>`, `${indent}\t\t<path d="${pathOf([note.a, note.b])}" stroke="${scene.preset.edge}" stroke-width="${scene.preset.stroke}" marker-end="url(#${id.flow})"/>`, `${indent}\t</g>`);
	}
	for (const dim of scene.dims) lines.push(renderBoxedDimension(dim, scene, `${indent}\t`));
	for (const tag of scene.tags.filter(entry => entry.disc)) lines.push(`${indent}\t${renderGutterTag(tag, scene)}`);
	if (scene.scaleBar) lines.push(renderScaleBar(scene.scaleBar, scene, `${indent}\t`));
	if (!lines.length) return "";
	if (scene.timing) lines.push(`${indent}\t${fadeAnimation(fadeStart(scene.timing), scene.timing)}`);
	return [`${indent}<g data-vpk-iso-labels>`, ...lines, `${indent}</g>`].join("\n");
}

// Cast shadows (illustrations.md § Shadows): one flat path per part that casts one, in one group painted before every part. The
// group carries the one shadow fill (no stroke, filter, gradient or opacity anywhere), so the paths inherit it and overlaps merge
// (one opaque fill). data-vpk-iso-cast is a shadow's screen move per unit of the figure's motion (the lift, or one Gap unit),
// which the runtime applies with its part; when every shadow moves alike (a select figure's lift) it sits on the group once. An
// assembled figure wraps each layer's shadows in a group that slides in on the ground as the layer lands.
// Received shadows (illustrations.md § Shadows): the shadows the parts above throw on this part's top face, one path per caster
// in one group clipped to the face and filled with the one received tone, so overlaps merge (runtime-css darkens the accent
// instead on an accented top). The group rides in the receiver's
// part group (it moves and is covered with it); data-vpk-iso-cast is the caster's shadow move per unit of motion and
// data-vpk-iso-cast-on the receiver's, so the runtime moves a shadow by their difference (the plane is the receiver's). An
// assembled figure hides each caster's shadow until its layer drops and slides it in from the start pose, like the ground ones.
// A shadow group waits hidden until its caster's layer drops (no accent step).
function shadowClass(layer, scene, pad) {
	const anim = layerClassAnimation(layer, scene.timing, { shadow: true });
	return anim ? [`${pad}${anim}`] : [];
}

function renderReceived(piece, scene, indent) {
	const path = entry => `<path data-vpk-iso-role="shadow" data-vpk-iso-shadow-for="${escapeAttr(entry.partId)}"${entry.cast ? ` data-vpk-iso-cast="${vec(entry.cast)}"` : ""}${entry.castOn && (entry.castOn[0] || entry.castOn[1]) ? ` data-vpk-iso-cast-on="${vec(entry.castOn)}"` : ""} d="${pathOf(entry.hit, true)}"/>`;
	const out = [`${indent}<g data-vpk-iso-received clip-path="url(#${ids(scene).recv(piece.partId)})" fill="${scene.preset.received}">`];
	for (const entry of piece.received.shadows) {
		if (!scene.timing || entry.layer === null || entry.layer === undefined) out.push(`${indent}\t${path(entry)}`);
		else out.push(`${indent}\t<g data-vpk-iso-shadow-enter="${entry.layer}">`, `${indent}\t\t${path(entry)}`, `${indent}\t\t${enterAnimation(entry.layer, scene.timing, scene.shadowOffset)}`, ...shadowClass(entry.layer, scene, `${indent}\t\t`), `${indent}\t</g>`);
	}
	out.push(`${indent}</g>`);
	return out;
}

function renderShadows(scene, indent) {
	if (!scene.shadows.length) return [];
	const casts = new Set(scene.shadows.map(entry => (entry.cast ? vec(entry.cast) : "")));
	const shared = casts.size === 1 && !casts.has("") ? ` data-vpk-iso-cast="${[...casts][0]}"` : "";
	// display="none" comes last, where the runtime re-adds it, so the rest SVG's outerHTML is the static art after any toggle (R9).
	const shadow = (entry, pad) => `${pad}<path data-vpk-iso-role="shadow" data-vpk-iso-shadow-for="${escapeAttr(entry.partId)}"${entry.variant ? ` data-vpk-iso-variant="${escapeAttr(entry.variant)}"` : ""}${entry.cast && !shared ? ` data-vpk-iso-cast="${vec(entry.cast)}"` : ""} d="${pathOf(entry.hit, true)}"${entry.restHidden ? ' display="none"' : ""}/>`;
	const out = [`${indent}<g data-vpk-iso-shadows fill="${scene.preset.shadow}"${shared}>`];
	if (!scene.timing) out.push(...scene.shadows.map(entry => shadow(entry, `${indent}\t`)));
	else for (let layer = 0; layer < scene.timing.layers; layer++) {
		const list = scene.shadows.filter(entry => entry.layer === layer);
		if (!list.length) continue;
		out.push(`${indent}\t<g data-vpk-iso-shadow-enter="${layer}">`, ...list.map(entry => shadow(entry, `${indent}\t\t`)), `${indent}\t\t${enterAnimation(layer, scene.timing, scene.shadowOffset)}`, ...shadowClass(layer, scene, `${indent}\t\t`), `${indent}\t</g>`);
	}
	out.push(`${indent}</g>`);
	return out;
}

function renderScene(scene, indent) {
	const fade = scene.timing ? fadeAnimation(fadeStart(scene.timing), scene.timing) : null;
	const out = [`${indent}<g data-vpk-iso-scene>`];
	if (scene.texture) {
		const [w, h] = scene.viewBox;
		out.push(`${indent}\t<rect data-vpk-iso-texture width="${w}" height="${h}" fill="url(#${ids(scene).dots})"/>`);
	}
	out.push(...renderShadows(scene, `${indent}\t`));
	for (const group of scene.groups) {
		const wrapped = scene.timing !== null;
		const inner = wrapped ? `${indent}\t\t` : `${indent}\t`;
		if (wrapped) out.push(`${indent}\t<g data-vpk-iso-enter="${group.layer}">`);
		for (const index of group.pieces) {
			const piece = scene.pieces[index];
			for (const guide of scene.guides.filter(entry => entry.from === piece.partId && !piece.of)) out.push(renderGuide(guide, scene, inner, fade));
			out.push(renderPart(piece, scene, inner));
		}
		// The hand-off (motion.mjs layerClassAnimation): hidden until its layer drops, accented for ENTRY.ACCENT_HOLD_MS from its start, then neutral.
		const handoff = wrapped ? layerClassAnimation(group.layer, scene.timing, { accent: (scene.emphasis ?? "accent") === "accent" }) : "";
		if (wrapped) out.push(`${indent}\t\t${enterAnimation(group.layer, scene.timing, scene.enterOffset)}`, ...(handoff ? [`${indent}\t\t${handoff}`] : []), `${indent}\t</g>`);
	}
	out.push(`${indent}</g>`);
	return out.join("\n");
}

export function renderSvg(scene, indent = "") {
	const [w, h] = scene.viewBox;
	const attrs = ["data-vpk-illustration", "data-vpk-iso", `data-vpk-iso-id="${scene.id}"`, `data-vpk-iso-style="${scene.style}"`];
	// An active part blinks once and holds a 2px ink outline (select and teardown; explode has no per-part active state).
	if (scene.behavior === "select" || scene.behavior === "teardown") attrs.push("data-vpk-iso-blink");
	attrs.push(`data-vpk-iso-zdepth="${scene.zdepth}"`);
	if (scene.behavior === "select") attrs.push(`data-vpk-iso-lift-z="${num(scene.liftWorld)}"`);
	// Emphasis "ink" or "none": no accent anywhere, so the hover CSS draws the active outline in ink (runtime-css emphasisCss).
	if (scene.emphasis && scene.emphasis !== "accent") attrs.push(`data-vpk-iso-emphasis="${scene.emphasis}"`);
	// labels "none": the figure draws no labels or tags; the audit checks none crept in.
	if (scene.labelMode === "none") attrs.push('data-vpk-iso-labels="none"');
	// A spectrum ray (a `line` with `spectrum`) admits the three ray tokens on this figure only (audit A1, check-html).
	if (scene.spectrum) attrs.push("data-vpk-iso-spectrum");
	if (scene.timing) attrs.push("data-vpk-smil-arm", 'data-vpk-smil-stagger="0"');
	// Opts the figure into the narrow-stage callouts (tags, legend, crop). A figure built before they existed has
	// no attribute, so the CSS never hides its text labels without tags to replace them.
	if (scene.tags.length) attrs.push("data-vpk-iso-narrow");
	attrs.push(`viewBox="0 0 ${w} ${h}"`, 'fill="none"', 'xmlns="http://www.w3.org/2000/svg"', 'role="img"', `aria-label="${escapeAttr(scene.brief.label)}"`);
	// The figure fills its frame, like B: the svg grows to MANUAL_MAX_ZOOM times its viewBox width (a wide page draws the 11-unit
	// labels at up to 16 px, B's size) and no further, so a small figure is not blown up. A wide viewBox draws the tags and the
	// mark discs small on a phone, so they scale up to the 9 px floor (rule 5).
	const vars = [...(scene.crop ? [`--vpk-iso-crop-w: ${num(scene.crop.width)}%`, `--vpk-iso-crop-x: ${num(scene.crop.offset)}%`] : []), `--vpk-iso-w: ${Math.round(w * MANUAL_MAX_ZOOM)}px`, ...narrowScaleVars(scene, w)];
	if (vars.length) attrs.push(`style="${vars.join("; ")}"`);
	const body = [renderDefs(scene, `${indent}\t`), renderScene(scene, `${indent}\t`), renderLabels(scene, `${indent}\t`)].filter(Boolean);
	return [`${indent}<svg ${attrs.join(" ")}>`, ...body, `${indent}</svg>`].join("\n");
}

// The camera tour's sentence, appended to the stage label (a tour-only figure: the whole label after the title).
function tourLabel(scene) {
	const n = scene.tour.s.length;
	const keys = scene.behavior ? "" : ", or focus the figure and use the arrow keys";
	return `A camera tour of ${n} steps: use the Next step and Previous step buttons${keys} to frame each step's parts; Home returns to the overview.`;
}

function stageLabel(scene) {
	const title = scene.brief.title.replace(/[.\s]+$/, "");
	if (!scene.behavior) return `${title}. ${tourLabel(scene)}`;
	const label = behaviorLabel(scene, title);
	return scene.tour ? `${label} ${tourLabel(scene)}` : label;
}

function behaviorLabel(scene, title) {
	if (scene.behavior === "step") return `${title}. Click the figure, or focus it and press Enter or the arrow keys, to step through ${scene.states.states.length} states; Home and End go to the first and last, Escape to rest.`;
	if (scene.behavior === "scrub") {
		const how = scene.states.input === "pointer-x" ? "Move the pointer across the figure" : scene.states.input === "keys" ? "Focus the figure and use the arrow keys" : "Drag across the figure";
		return `${title}. ${how} to move through ${scene.states.states.length} states, or use the arrow keys or the slider; Escape returns to rest.`;
	}
	if (scene.behavior === "teardown") return `${title}. The parts are shown taken apart. Use the Exploded and Assembled buttons or the Spread slider to put them together; point at a part, or focus the figure and use the arrow keys, to name it.`;
	if (scene.behavior === "explode") {
		const unit = scene.explode.unit;
		return `${title}. Point at the figure to separate the parts (tap on touch), or use the ${unit[0].toUpperCase()}${unit.slice(1)} slider to set it.`;
	}
	return `${title}. Move the pointer over a part, or focus the figure and use the arrow keys, to lift it and read its name; Escape returns it to rest.`;
}

// The narrow-stage key to the numbered tags (and the dimension notes, whose text is hidden with the callouts).
// `hidden` keeps it out of the page, and the accessibility tree, until the narrow-stage CSS shows it.
function renderLegend(scene, indent) {
	const notes = scene.annotations.filter(note => note.kind === "dimension" && note.text);
	if (!scene.tags.length && !notes.length) return [];
	return [
		`${indent}<ol class="vpk-iso-legend" hidden data-vpk-review-ignore>`,
		...scene.tags.map(tag => `${indent}\t<li><span aria-hidden="true">${tag.n}</span>${escapeText(tag.text)}</li>`),
		...notes.map(note => `${indent}\t<li data-vpk-iso-note>${escapeText(note.text)}</li>`),
		`${indent}</ol>`,
	];
}

export const readoutText = (scene, value) => (scene.behavior === "explode" ? `${scene.explode.unit} ${Number(value).toFixed(2)}` : String(value));

// The camera tour (tour.mjs): its caption (the step title, which fades grey to ink on a change, and the step text) rides in the
// frame's foot like a readout; the Previous step / Next step buttons and the step counter sit under the frame with the other
// controls. Both start on the Overview (step 0), which is the static art; aria-disabled keeps a button focusable at the ends.
function tourParts(scene) {
	const tour = scene.tour;
	const n = tour.s.length;
	const caption = `<div class="vpk-iso-tour__caption"><p class="vpk-iso-tour__title" data-vpk-iso-tour-title>Overview</p><p class="vpk-iso-tour__text" data-vpk-iso-tour-text>${escapeText(tour.o)}</p></div>`;
	const go = (by, text, off) => `<button type="button" class="vpk-iso-tour__go" data-vpk-iso-tour-go="${by}" aria-disabled="${off}">${text}</button>`;
	const controls = `<div class="vpk-iso-tour" role="group" aria-label="Camera tour" data-vpk-iso-tour-controls>${go(-1, "Previous step", true)}<span class="vpk-iso-tour__count" data-vpk-iso-tour-count>0 / ${n}</span>${go(1, "Next step", false)}</div>`;
	return { caption, controls };
}

export function renderPlate(scene, { indent = "", attrs = "" } = {}) {
	const brief = scene.brief;
	// A tour without another behaviour is the stage's behaviour "tour" (the runtime gives it the arrow keys).
	const behavior = scene.behavior ?? (scene.tour ? "tour" : null);
	const interactive = Boolean(behavior);
	const root = [
		'class="vpk-iso-plate"',
		`id="${ids(scene).root}"`,
		'data-vpk-engine="iso-kit"',
		`data-vpk-figure="${scene.id}"`,
		`data-vpk-fig-id="${scene.figId}"`,
		`data-vpk-camera="${scene.camera.attr}"`,
		"data-vpk-block",
	];
	if (interactive) root.push("data-vpkh-no-lightbox");
	const stage = ['class="vpk-iso-stage"', "data-vpk-iso-stage"];
	if (interactive) {
		stage.push(`data-vpk-iso-behavior="${behavior}"`, 'role="group"', 'aria-roledescription="interactive figure"', `aria-label="${escapeAttr(stageLabel(scene))}"`);
		if (behavior === "select" || behavior === "teardown" || behavior === "tour" || scene.states) stage.push('tabindex="0"');
		// The tour model for tour-runtime.mjs (JSON in one attribute, like the state model).
		if (scene.tour) stage.push(`data-vpk-iso-tour="${escapeAttr(JSON.stringify(scene.tour))}"`);
		// The state model for state-runtime.mjs (JSON in one attribute: no script island, so check-html sees no new script).
		if (scene.states) stage.push(`data-vpk-iso-states="${escapeAttr(JSON.stringify(scene.states))}"`);
	}
	stage.push("data-vpk-review-ignore");
	const readout = [];
	const control = [];
	if (interactive) {
		if (scene.states) {
			// Step and scrub: the readout starts on the rest state's text; a scrub figure also gets a slider under the frame (one stop per
			// state, continuous between), so a keyboard or switch user reaches every state without the pointer.
			const cfg = scene.states;
			const text = cfg.states[cfg.rest].text;
			readout.push(`<output class="vpk-iso-readout" data-vpk-iso-readout aria-live="off">${escapeText(text)}</output>`);
			if (scene.behavior === "scrub") control.push(`<label class="vpk-iso-control">State <input type="range" data-vpk-iso-control="scrub" min="0" max="${cfg.states.length - 1}" step="any" value="${cfg.rest}" aria-valuetext="${escapeAttr(text)}" autocomplete="off"></label>`);
		} else if (scene.behavior === "teardown") {
			// Teardown: the readout names the hovered part (or the pose); the Exploded / Assembled switch and the Spread slider sit
			// under the frame. The slider is an explode control (min 0, max 1, rest 1), so the audit sweeps its stops like a Gap.
			const e = scene.explode;
			const start = scene.teardown.start === "assembled" ? e.min : e.rest;
			readout.push(`<output class="vpk-iso-readout" data-vpk-iso-readout data-vpk-iso-rest="${start === e.min ? "assembled" : "exploded"}" aria-live="off">${start === e.min ? "assembled" : "exploded"}</output>`);
			control.push(`<div class="vpk-iso-switch" role="group" aria-label="View"><button type="button" data-vpk-iso-pose="${e.max}" aria-pressed="${start === e.max}">Exploded</button><button type="button" data-vpk-iso-pose="${e.min}" aria-pressed="${start === e.min}">Assembled</button></div>`);
			control.push(`<label class="vpk-iso-control">Spread <input type="range" data-vpk-iso-control="explode" min="${e.min}" max="${e.max}" step="${e.step}" value="${e.rest}" data-vpk-iso-start="${start}" autocomplete="off"></label>`);
		} else if (scene.behavior === "explode") {
			const e = scene.explode;
			readout.push(`<output class="vpk-iso-readout" data-vpk-iso-readout aria-live="off">${readoutText(scene, e.rest)}</output>`);
			// autocomplete="off": on Back the browser would otherwise restore the last committed value
			// after the runtime has read the slider, leaving the slider and the figure apart.
			control.push(`<label class="vpk-iso-control">${escapeText(e.unit[0].toUpperCase() + e.unit.slice(1))} <input type="range" data-vpk-iso-control="explode" min="${e.min}" max="${e.max}" step="${e.step}" value="${e.rest}" autocomplete="off"></label>`);
		} else if (scene.behavior) {
			readout.push(`<output class="vpk-iso-readout" data-vpk-iso-readout data-vpk-iso-rest="${escapeAttr(scene.interact.rest ?? "rest")}" aria-live="off">${escapeText(scene.interact.rest ?? "rest")}</output>`);
		}
		if (scene.tour) {
			const tour = tourParts(scene);
			readout.unshift(tour.caption);
			control.unshift(tour.controls);
		}
		readout.push('<p class="vpk-iso-live" data-vpk-iso-live aria-live="polite"></p>');
	}
	const foot = (items, deeper) => (items.length ? [`${deeper}<div class="vpk-iso-plate__foot" data-vpk-review-ignore>`, ...items.map(item => `${deeper}\t${item}`), `${deeper}</div>`] : []);
	const caption = brief.caption ? [`${indent}\t<figcaption data-vpk-review-ignore>${escapeText(brief.caption)}</figcaption>`] : [];
	// The frame holds the drawing, its labels, marks and dimensions, and the readout line, and nothing else (rule 12): no
	// chrome corners, and the Gap slider sits under the frame, where a keyboard reader still reaches it.
	root[0] = 'class="vpk-iso-plate vpk-iso-plate--manual"';
	return [
		`${indent}<figure ${root.join(" ")}${attrs}>`,
		`${indent}\t<div class="vpk-iso-frame" data-vpk-review-ignore>`,
		`${indent}\t\t<div ${stage.join(" ")}>`,
		renderSvg(scene, `${indent}\t\t\t`),
		`${indent}\t\t</div>`,
		...renderLegend(scene, `${indent}\t\t`),
		...foot(readout, `${indent}\t\t`),
		`${indent}\t</div>`,
		...foot(control, `${indent}\t`),
		...caption,
		`${indent}</figure>`,
	].join("\n");
}

// Region src must stay inside the artifact folder: relative, no "..", no scheme.
export function assertRegionSrc(src) {
	if (src === undefined || src === null) return;
	if (typeof src !== "string" || !src || /^[a-z][a-z0-9+.-]*:/i.test(src) || src.startsWith("/") || src.includes("\\") || src.split("/").includes("..") || /["<>]|--/.test(src)) {
		throw new Error(`region src ${JSON.stringify(src)} must be a relative path inside the artifact folder (for example _figures/<id>.iso.json)`);
	}
}

export const regionBegin = (id, src) => `<!-- vpk-figure:begin engine="iso-kit" id="${id}"${src ? ` src="${src}"` : ""} -->`;
export const regionEnd = id => `<!-- vpk-figure:end id="${id}" -->`;

// The region with its markers. The first line carries no indent so it can replace a marker in place.
export function renderRegion(scene, { src, indent = "", attrs = "" } = {}) {
	assertRegionSrc(src);
	return [regionBegin(scene.id, src), renderPlate(scene, { indent, attrs }), `${indent}${regionEnd(scene.id)}`].join("\n");
}

export function renderFigure(scene, { src, indent = "", attrs = "" } = {}) {
	const svg = renderSvg(scene);
	const region = renderRegion(scene, { src, indent, attrs });
	return { region, svg, sizes: { region: Buffer.byteLength(region), svg: Buffer.byteLength(svg) } };
}
