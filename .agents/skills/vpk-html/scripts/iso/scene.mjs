// iso/scene — brief validation (vpk-iso-brief/1), camera presets and fit, and the scene graph:
// painter order, motion groups, guides, labels and behaviour vectors (illustrations.md § Using the
// kit). Projection is the vendored anatomy iso()/fitProjection(), so the camera is the one figure
// camera (figures/camera.mjs FIGURE_CAMERA, integration K12).

import { cameraAttr, FIGURE_CAMERA } from "../figures/camera.mjs";
import { fitProjection, iso } from "../anatomy/vendor/kit/iso-kit.mjs";
import { hull, parsePolyPath, pointInPolygon } from "./core.mjs";
import { clipConvex, dimGeometry, gutterWidthsNear, placeLabelsNear, segmentBoxes, textWidth } from "./layout.mjs";
import { buildMarks, fitHeight, fitNear, homePiece, narrowTagLayout, scaleGeometry, validateDims, validateMarks, validateScale } from "./manual-scene.mjs";
import { manualTiming, MAX_LAYERS } from "./motion.mjs";
import { KIT_STYLE, presetFor } from "./palette.mjs";
import { ENTRY } from "./accent.mjs";
import { castShadow, castsShadow, clipWindowPath, receivingTop, depthKey, guideCorners, guideSegments, shadowMove, shadowStep, solidFor } from "./solids.mjs";

export const BRIEF_SCHEMA_ID = "vpk-iso-brief/1";
export const ENGINE_ID = "iso-kit";
export const FIGURE_ID = /^[a-z][a-z0-9-]{0,39}$/;
export const FIG_ID = /^FIG_\d{3}$/;
export const DEFAULT_VIEWBOX = Object.freeze([720, 450]);
export const DEFAULT_PAD = 24;
export const CROP_PAD = 16;
export const MIN_CROP_ZOOM = 1.15;
// Landings drop from ENTRY.DROP_Z above (rule 10; iso/accent.mjs, shared with the 3D prototype). The camera fit counts only the
// first FIT_FROM_Z of that drop, so a long drop does not shrink the drawing: a part may start above the frame and fall into it,
// as in the reference videos.
export const MANUAL_FROM = Object.freeze([0, 0, ENTRY.DROP_Z]);
export const FIT_FROM_Z = 14;
const SCALE_GAP = 14;
export const PART_KINDS = Object.freeze(["slab", "box", "plate", "cylinder", "tray", "ring", "gap"]);
// A "new" or "active" part shares the focal's pale fill, without its outline (rule 4).
export const PART_STATES = Object.freeze(["new", "active"]);
// How a selected part answers the hover (select figures): "raise" lifts the whole part; "grow" keeps its base where it stands
// and raises only its top, like a bar extending (vertical prisms only: a box, slab, plate or cylinder).
export const LIFT_MODES = Object.freeze(["raise", "grow"]);
const GROW_KINDS = Object.freeze(["box", "slab", "plate", "cylinder"]);

export const CAMERA_PRESETS = Object.freeze({
	dimetric: Object.freeze({ ...FIGURE_CAMERA }),
	"true-iso": Object.freeze({ azimuth: 45, elevation: 35.26 }),
	front: Object.freeze({ azimuth: 90, elevation: 0 }),
	top: Object.freeze({ azimuth: 90, elevation: 90 }),
});

export class BriefError extends Error {
	constructor(errors) {
		super(`invalid iso brief:\n  - ${errors.join("\n  - ")}`);
		this.name = "BriefError";
		this.errors = errors;
	}
}

const isNum = value => typeof value === "number" && Number.isFinite(value);
const isVec = (value, n = 3) => Array.isArray(value) && value.length === n && value.every(isNum);
const round = (value, step = 10) => Math.round(value * step) / step;

export function resolveCamera(camera = {}) {
	const preset = camera?.preset ?? "dimetric";
	const base = CAMERA_PRESETS[preset] ?? CAMERA_PRESETS.dimetric;
	return {
		preset,
		azimuth: camera?.azimuth ?? base.azimuth,
		elevation: camera?.elevation ?? base.elevation,
		scale: camera?.scale ?? "fit",
		pad: camera?.pad ?? DEFAULT_PAD,
	};
}

// "fit" (default): fit the points into the viewBox minus the label gutters; a number keeps that
// scale and centres the points' projected box in the gutter-reduced frame.
export function projectionFor(camera, [width, height], points, [gutterLeft, gutterRight] = [0, 0]) {
	const cam = resolveCamera(camera);
	const inner = width - gutterLeft - gutterRight;
	if (cam.scale === "fit") {
		const fitted = fitProjection(points, inner, height, { pad: cam.pad, azimuth: cam.azimuth, elevation: cam.elevation });
		return { ...fitted, origin: [fitted.origin[0] + gutterLeft, fitted.origin[1]] };
	}
	const unit = { origin: [0, 0], scale: cam.scale, azimuth: cam.azimuth, elevation: cam.elevation };
	const flat = points.map(point => iso(point, unit));
	const xs = flat.map(([x]) => x);
	const ys = flat.map(([, y]) => y);
	return {
		origin: [gutterLeft + inner / 2 - (Math.min(...xs) + Math.max(...xs)) / 2, height / 2 - (Math.min(...ys) + Math.max(...ys)) / 2],
		scale: cam.scale,
		azimuth: cam.azimuth,
		elevation: cam.elevation,
	};
}

export const cameraAttrOf = projection => cameraAttr({ azimuth: projection.azimuth, elevation: projection.elevation });

function validatePart(part, index, push) {
	const at = `parts[${index}]`;
	if (!part || typeof part !== "object") return push(`${at} must be an object`);
	if (!FIGURE_ID.test(part.id ?? "")) push(`${at}.id ${JSON.stringify(part.id)} must match ${FIGURE_ID}`);
	if (!PART_KINDS.includes(part.kind)) push(`${at}.kind ${JSON.stringify(part.kind)} must be one of ${PART_KINDS.join(", ")}`);
	if (!isVec(part.at)) push(`${at}.at must be [x, y, z]`);
	if (!isVec(part.size) || !(part.size[0] > 0) || !(part.size[1] > 0) || !(part.size[2] >= 0)) push(`${at}.size must be [w, d, h] with w, d > 0 and h ≥ 0`);
	else if ((part.kind === "gap" || part.kind === "plate") && part.size[2] > 2) push(`${at}.size: a ${part.kind} has h ≤ 2`);
	else if (["slab", "box", "cylinder", "tray"].includes(part.kind) && !(part.size[2] > 0)) push(`${at}.size: a ${part.kind} needs h > 0`);
	else if ((part.kind === "cylinder" || part.kind === "ring") && (part.size[1] !== part.size[0] || (part.kind === "ring" && part.size[2] !== 0))) push(`${at}.size: a ${part.kind} is [r, r, ${part.kind === "ring" ? 0 : "h"}] (r is the radius; \`at\` is the centre)`);
	if (part.r !== undefined && !(isNum(part.r) && part.r >= 0)) push(`${at}.r must be ≥ 0`);
	if (part.bevel !== undefined && !(isNum(part.bevel) && (part.bevel === 0 || (part.bevel >= 0.6 && part.bevel <= 2.2)))) push(`${at}.bevel must be 0 or within 0.6–2.2`);
	// The kit draws every side face as a plain flat face; the hatched cut face is gone, so a brief that still asks for one fails.
	if (part.cut !== undefined) push(`${at}.cut is no longer supported: the iso kit draws every side face as a plain flat face (no hatching); remove "cut" from the part`);
	if (part.marks !== undefined && !(Array.isArray(part.marks) && part.marks.every(mark => Array.isArray(mark) && mark.length === 2 && mark.every(point => isVec(point, 2))))) push(`${at}.marks must be [[u, v], [u, v]] segments`);
	if (part.label !== undefined && (typeof part.label !== "string" || part.label.length > 60)) push(`${at}.label must be a string of ≤ 60 chars`);
	if (part.explode !== undefined && !isVec(part.explode)) push(`${at}.explode must be [x, y, z]`);
	if (part.clipTo !== undefined && part.kind !== "ring") push(`${at}.clipTo is allowed on rings only`);
	if (part.clipPad !== undefined && !(part.kind === "ring" && part.clipTo !== undefined && isNum(part.clipPad) && part.clipPad >= 0 && part.clipPad <= 200)) push(`${at}.clipPad is a number within 0–200, allowed on a ring with clipTo`);
	if (part.state !== undefined && !PART_STATES.includes(part.state)) push(`${at}.state must be one of ${PART_STATES.join(", ")}`);
	if (part.fixed !== undefined && typeof part.fixed !== "boolean") push(`${at}.fixed must be true or false`);
	if (part.liftMode !== undefined && !LIFT_MODES.includes(part.liftMode)) push(`${at}.liftMode must be one of ${LIFT_MODES.join(", ")}`);
	else if (part.liftMode === "grow" && !GROW_KINDS.includes(part.kind)) push(`${at}.liftMode "grow" needs a vertical prism (${GROW_KINDS.join(", ")}), not a ${part.kind}`);
	if (part.fixed === true && part.liftMode !== undefined) push(`${at}: a fixed part never lifts, so it takes no liftMode`);
}

function validateInteract(interact, push) {
	if (interact === undefined || interact === null) return;
	if (!["select", "explode"].includes(interact.behavior)) return push(`interact.behavior ${JSON.stringify(interact.behavior)} must be "select" or "explode"`);
	if (interact.lift !== undefined && !(isNum(interact.lift) && interact.lift > 0 && interact.lift <= 40)) push("interact.lift must be within (0, 40]");
	if (interact.rest !== undefined && typeof interact.rest !== "string") push("interact.rest must be a string");
	if (interact.guides !== undefined && (interact.behavior !== "select" || typeof interact.guides !== "boolean")) push("interact.guides must be true or false, on a select figure (an explode figure always draws its guides)");
	if (interact.liftMode !== undefined && (interact.behavior !== "select" || !LIFT_MODES.includes(interact.liftMode))) push(`interact.liftMode must be one of ${LIFT_MODES.join(", ")}, on a select figure`);
	if (interact.behavior === "explode") {
		const e = interact.explode;
		if (!e || ![e.rest, e.min, e.max, e.step].every(isNum)) return push("interact.explode needs numeric rest, min, max and step");
		if (!(e.min <= e.rest && e.rest <= e.max && e.min < e.max)) push("interact.explode needs min ≤ rest ≤ max and min < max");
		if (!(e.step > 0 && e.step <= e.max - e.min)) push("interact.explode.step must be > 0 and ≤ max − min");
		else if (e.min <= e.rest && e.rest <= e.max) {
			// A range input snaps its value to min + n × step; an off-grid rest would load the slider
			// elsewhere, and the figure could never settle back on its static art (R9).
			const n = (e.rest - e.min) / e.step;
			if (Math.abs(n - Math.round(n)) > 1e-6) {
				const stops = [Math.floor(n), Math.floor(n) + 1].map(i => Math.round((e.min + i * e.step) * 1e6) / 1e6).filter(gap => gap <= e.max + 1e-9);
				push(`interact.explode.rest ${e.rest} is off the slider's step grid (min + n × step): use ${stops.join(" or ")}, or change min or step`);
			}
		}
		if (e.unit !== undefined && !/^[a-z][a-z0-9-]{0,15}$/.test(e.unit)) push("interact.explode.unit must be one short lowercase word (no spaces)");
	}
}

export function validateBrief(brief) {
	const errors = [];
	const push = message => void errors.push(message);
	if (!brief || typeof brief !== "object") return ["brief must be an object"];
	if (brief.schema !== BRIEF_SCHEMA_ID) push(`schema must be "${BRIEF_SCHEMA_ID}"`);
	if (!FIGURE_ID.test(brief.id ?? "")) push(`id ${JSON.stringify(brief.id)} must match ${FIGURE_ID}`);
	if (!FIG_ID.test(brief.figId ?? "")) push(`figId ${JSON.stringify(brief.figId)} must match ${FIG_ID}`);
	if (typeof brief.title !== "string" || !brief.title.trim() || brief.title.length > 48) push("title must be a non-empty string of ≤ 48 chars");
	if (typeof brief.label !== "string" || !brief.label.trim() || brief.label.length > 240) push("label must be a non-empty string of ≤ 240 chars");
	if (brief.caption !== undefined && typeof brief.caption !== "string") push("caption must be a string");
	if (brief.style !== undefined && brief.style !== KIT_STYLE) push(`style ${JSON.stringify(brief.style)} is not supported; the iso kit has one style: "${KIT_STYLE}"`);
	const camera = brief.camera;
	if (camera !== undefined) {
		if (!camera || typeof camera !== "object") push("camera must be an object");
		else {
			if (camera.preset !== undefined && !(camera.preset in CAMERA_PRESETS)) push(`camera.preset ${JSON.stringify(camera.preset)} must be one of ${Object.keys(CAMERA_PRESETS).join(", ")}`);
			if (camera.azimuth !== undefined && !(isNum(camera.azimuth) && Math.abs(camera.azimuth) <= 360)) push("camera.azimuth must be within ±360");
			if (camera.elevation !== undefined && !(isNum(camera.elevation) && camera.elevation >= 0 && camera.elevation <= 90)) push("camera.elevation must be within 0–90");
			if (camera.scale !== undefined && camera.scale !== "fit" && !(isNum(camera.scale) && camera.scale > 0)) push('camera.scale must be "fit" or a positive number');
			if (camera.pad !== undefined && !(isNum(camera.pad) && camera.pad >= 0)) push("camera.pad must be ≥ 0");
		}
	}
	if (brief.viewBox !== undefined && !(isVec(brief.viewBox, 2) && brief.viewBox.every(value => Number.isInteger(value) && value >= 120 && value <= 4000))) push("viewBox must be [w, h] integers within 120–4000");
	if (brief.texture !== undefined && !["none", "dots"].includes(brief.texture)) push('texture must be "none" or "dots"');
	const parts = Array.isArray(brief.parts) ? brief.parts : [];
	if (!Array.isArray(brief.parts) || parts.length < 1 || parts.length > 160) push("parts must be an array of 1–160 parts");
	parts.forEach((part, index) => validatePart(part, index, push));
	const ids = parts.map(part => part?.id);
	const known = new Set(ids);
	for (const id of new Set(ids.filter((id, index) => ids.indexOf(id) !== index))) push(`part id "${id}" is used more than once`);
	parts.forEach((part, index) => {
		if (part?.clipTo !== undefined && (!known.has(part.clipTo) || part.clipTo === part.id)) push(`parts[${index}].clipTo "${part.clipTo}" must name another part`);
	});
	if (!known.has(brief.focal)) push(`focal ${JSON.stringify(brief.focal)} must name a part`);
	(brief.labels ?? []).forEach((label, index) => {
		if (!label || typeof label.text !== "string" || !label.text.trim() || label.text.length > 40) push(`labels[${index}].text must be a non-empty string of ≤ 40 chars`);
		if (!known.has(label?.target)) push(`labels[${index}].target ${JSON.stringify(label?.target)} must name a part`);
		if (label?.side !== undefined && !["left", "right", "auto"].includes(label.side)) push(`labels[${index}].side must be left, right or auto`);
		if (label?.anchor !== undefined && !isVec(label.anchor)) push(`labels[${index}].anchor must be [x, y, z]`);
	});
	(brief.annotations ?? []).forEach((note, index) => {
		if (!["dimension", "arrow"].includes(note?.kind)) return push(`annotations[${index}].kind must be "dimension" or "arrow"`);
		if (!isVec(note.from) || !isVec(note.to)) push(`annotations[${index}] needs from and to as [x, y, z]`);
		if (note.kind === "dimension" && (typeof note.text !== "string" || !note.text.trim())) push(`annotations[${index}].text is required for a dimension`);
		// A motion arrow may name the part it moves (`of`): it takes the accent while that part is the focal, hovered or selected one.
		if (note.of !== undefined && (note.kind !== "arrow" || !known.has(note.of))) push(`annotations[${index}].of must name a part, on an arrow`);
	});
	const assemble = brief.assemble;
	if (assemble !== undefined && assemble !== null) {
		const layers = assemble.layers;
		if (!Array.isArray(layers) || layers.length < 1 || !layers.every(layer => Array.isArray(layer) && layer.length > 0)) push("assemble.layers must be a non-empty array of non-empty id lists");
		else {
			if (layers.length > MAX_LAYERS) push(`assemble.layers has ${layers.length} layers; at most ${MAX_LAYERS}`);
			const listed = layers.flat();
			for (const id of listed) if (!known.has(id)) push(`assemble.layers names unknown part "${id}"`);
			for (const id of new Set(listed.filter((id, index) => listed.indexOf(id) !== index))) push(`assemble.layers lists "${id}" more than once`);
			for (const id of ids) if (known.has(id) && !listed.includes(id)) push(`assemble.layers must list every part; "${id}" is missing`);
		}
		for (const key of ["staggerMs", "partMs"]) if (assemble[key] !== undefined && !(isNum(assemble[key]) && assemble[key] > 0)) push(`assemble.${key} must be a positive number`);
		if (assemble.from !== undefined && !isVec(assemble.from)) push("assemble.from must be [x, y, z]");
	}
	validateMarks(brief.marks, known, push);
	validateDims(brief.dims, push);
	validateScale(brief.scale, push);
	validateInteract(brief.interact, push);
	if (parts.some(part => part?.liftMode !== undefined) && brief.interact?.behavior !== "select") push("parts[].liftMode needs interact.behavior \"select\"");
	if (brief.interact && parts.length && parts.every(part => part?.fixed === true)) push("every part is fixed, so the figure has nothing to select or separate; drop interact or unfix a part");
	if (brief.meta !== undefined && !(brief.meta && typeof brief.meta === "object" && ["margin", "corner"].every(key => brief.meta[key] === undefined || (typeof brief.meta[key] === "string" && brief.meta[key].length <= 40)))) push("meta.margin and meta.corner must be strings of ≤ 40 chars");
	return errors;
}

function partCorners(part) {
	const [x, y, z] = part.at;
	const [w, d, h] = part.size;
	if (part.kind === "cylinder" || part.kind === "ring") return [[x - w, y - w], [x + w, y - w], [x + w, y + w], [x - w, y + w]].flatMap(([px, py]) => [[px, py, z], [px, py, z + h]]);
	return [[x, y], [x + w, y], [x + w, y + d], [x, y + d]].flatMap(([px, py]) => [[px, py, z], [px, py, z + h]]);
}

// The part a clipped ring shows inside: its target, grown by `clipPad` world units on every side of the plan.
export function clipWindowPart(part, byId) {
	const target = byId.get(part.clipTo);
	const pad = part.clipPad ?? 0;
	if (!pad) return target;
	if (target.kind === "cylinder" || target.kind === "ring") return { ...target, size: [target.size[0] + pad, target.size[0] + pad, target.size[2]] };
	return { ...target, at: [target.at[0] - pad, target.at[1] - pad, target.at[2]], size: [target.size[0] + 2 * pad, target.size[1] + 2 * pad, target.size[2]] };
}

const topZ = part => part.at[2] + (part.kind === "ring" || part.kind === "gap" ? 0 : part.size[2]);
const planBox = part => (part.kind === "cylinder" || part.kind === "ring"
	? [part.at[0] - part.size[0], part.at[1] - part.size[0], part.at[0] + part.size[0], part.at[1] + part.size[0]]
	: [part.at[0], part.at[1], part.at[0] + part.size[0], part.at[1] + part.size[1]]);
// Plan containment with a half-unit tolerance (circles by radius, everything else by its box).
function contains(part, [px, py], tolerance = 0.5) {
	if (part.kind === "cylinder" || part.kind === "ring") return Math.hypot(px - part.at[0], py - part.at[1]) <= part.size[0] + tolerance;
	const [x0, y0, x1, y1] = planBox(part);
	return px >= x0 - tolerance && px <= x1 + tolerance && py >= y0 - tolerance && py <= y1 + tolerance;
}

// Candidate anchor points on the visible faces of a part (top grid plus the sides facing the viewer).
function anchorCandidates(part, P) {
	const [x0, y0, x1, y1] = planBox(part);
	const zTop = topZ(part);
	const steps = [0.15, 0.35, 0.5, 0.65, 0.85];
	const points = [];
	for (const u of steps) for (const v of steps) points.push([x0 + (x1 - x0) * u, y0 + (y1 - y0) * v, zTop]);
	const h = zTop - part.at[2];
	if (h >= 2) {
		const zMid = part.at[2] + h / 2;
		const cosA = Math.cos((P.azimuth * Math.PI) / 180);
		const sinA = Math.sin((P.azimuth * Math.PI) / 180);
		for (const s of steps) {
			if (cosA > 0.01) points.push([x1, y0 + (y1 - y0) * s, zMid]);
			if (sinA > 0.01) points.push([x0 + (x1 - x0) * s, y1, zMid]);
		}
	}
	return points.map(point => iso(point, P));
}

function distanceToPolygon([px, py], poly) {
	let best = Infinity;
	for (let i = 0; i < poly.length; i++) {
		const [ax, ay] = poly[i];
		const [bx, by] = poly[(i + 1) % poly.length];
		const dx = bx - ax;
		const dy = by - ay;
		const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
		best = Math.min(best, Math.hypot(px - (ax + t * dx), py - (ay + t * dy)));
	}
	return best;
}

// A visible point of the target nearest the label side; falls back to the top centre.
function chooseAnchor(part, side, pieces, P, override) {
	if (override) return { point: iso(override, P), visible: true };
	const own = pieces.filter(piece => piece.partId === part.id);
	const lastOwn = Math.max(...own.map(piece => pieces.indexOf(piece)));
	const covering = pieces.slice(lastOwn + 1).filter(piece => piece.partId !== part.id).map(piece => piece.hit);
	const ownHull = hull(own.flatMap(piece => piece.hit));
	const visible = anchorCandidates(part, P).filter(point => pointInPolygon(point, ownHull) && distanceToPolygon(point, ownHull) >= 3
		&& covering.every(poly => !pointInPolygon(point, poly) && distanceToPolygon(point, poly) >= 4));
	if (!visible.length) {
		const [x0, y0, x1, y1] = planBox(part);
		return { point: iso([(x0 + x1) / 2, (y0 + y1) / 2, topZ(part)], P), visible: false };
	}
	visible.sort((a, b) => (side === "left" ? a[0] - b[0] : b[0] - a[0]) || a[1] - b[1]);
	return { point: visible[0], visible: true };
}

// A select figure's support: the one lowest part (not the focal, not line work) whose plan holds every other part's plan, like a
// plinth under a terrain or a tray under its cards. It holds the figure up, so it is fixed by default (`fixed: false` opts out).
export function supportOf(brief) {
	const solids = brief.parts.filter(part => !["ring", "gap"].includes(part.kind));
	const low = Math.min(...solids.map(part => part.at[2]));
	const lowest = solids.filter(part => part.at[2] === low);
	if (lowest.length !== 1 || lowest[0].id === brief.focal) return null;
	const [x0, y0, x1, y1] = planBox(lowest[0]);
	const inside = part => {
		const [a0, b0, a1, b1] = planBox(part);
		return a0 >= x0 - 0.5 && b0 >= y0 - 0.5 && a1 <= x1 + 0.5 && b1 <= y1 + 0.5;
	};
	return brief.parts.every(part => part === lowest[0] || inside(part)) ? lowest[0].id : null;
}

// A grown part (liftMode "grow") is drawn by the runtime from its rest paths: every point on its top face rides the lift and every
// other point stays put. That is exact when the solid `lift` taller is the rest solid with its top-face points moved by the
// screen lift, point for point; this checks it, so a solid the rule cannot draw raises instead of drawing a wrong shape.
const POINT = /(-?[\d.]+) (-?[\d.]+)/g;
export function growsInPlace(piece, grown, lift) {
	if (!grown || !lift || piece.solids.length !== 1 || grown.solids.length !== 1 || !piece.solids[0].top) return false;
	const [rest] = piece.solids;
	const [tall] = grown.solids;
	const top = new Set(rest.top.match(POINT));
	const moved = d => d.replace(POINT, (pair, x, y) => (top.has(pair) ? `${Number(x) + lift[0]} ${Number(y) + lift[1]}` : pair));
	const shape = d => d.replace(POINT, "#");
	const numbers = d => (d.match(/-?[\d.]+/g) ?? []).map(Number);
	return ["fill", "shade", "top", "crease", "edge"].every(role => {
		if (!rest[role] || !tall[role]) return !rest[role] && !tall[role];
		const [a, b] = [moved(rest[role]), tall[role]];
		const [na, nb] = [numbers(a), numbers(b)];
		return shape(a) === shape(b) && na.length === nb.length && na.every((value, index) => Math.abs(value - nb[index]) <= 0.15);
	});
}

function layerIndexMap(brief) {
	const map = new Map();
	(brief.assemble?.layers ?? []).forEach((layer, index) => layer.forEach(id => map.set(id, index)));
	return map;
}

function screenVector(world, P) {
	const a = iso([0, 0, 0], P);
	const b = iso(world, P);
	return [round(b[0] - a[0]), round(b[1] - a[1])];
}

// A figure is built, then fitted to its frame: gutters first, then the viewBox height.
export function buildScene(brief, { style = brief?.style } = {}) {
	const scene = buildSceneAt(brief, style, null);
	const rebuild = (gutters, viewBox) => buildSceneAt(brief, style, gutters, viewBox);
	return fitHeight(scene.labels.length ? fitNear(scene, rebuild) : scene, rebuild);
}

function buildSceneAt(brief, style, gutterOverride, viewBoxOverride = null) {
	const errors = validateBrief({ ...brief, style });
	if (errors.length) throw new BriefError(errors);
	const preset = presetFor(style);
	style = KIT_STYLE;
	const warnings = [];
	const viewBox = viewBoxOverride ?? brief.viewBox ?? DEFAULT_VIEWBOX;
	const cam = resolveCamera(brief.camera);
	const interact = brief.interact ?? null;
	const behavior = interact?.behavior ?? null;
	const explode = behavior === "explode" ? { unit: "gap", ...interact.explode } : null;
	const liftWorld = behavior === "select" ? interact.lift ?? 8 : 0;
	const layers = layerIndexMap(brief);
	const zRank = new Map([...brief.parts].sort((a, b) => a.at[2] - b.at[2]).map((part, index) => [part.id, index]));
	// A fixed part (a plinth, a base, a housing) is scenery: it never lifts or separates, takes no hover outline, is no keyboard stop
	// and cannot be selected. `fixed: true` marks one; a select figure's support (supportOf) is fixed unless it says `fixed: false`.
	const support = behavior === "select" ? supportOf(brief) : null;
	const isFixed = part => part.fixed ?? part.id === support;
	const vectorOf = part => (isFixed(part) ? [0, 0, 0] : part.explode ?? [0, 0, (layers.get(part.id) ?? zRank.get(part.id)) * 12]);
	const liftOf = part => (liftWorld && !isFixed(part) ? [0, 0, liftWorld] : null);
	const growOf = part => Boolean(liftOf(part)) && GROW_KINDS.includes(part.kind) && (part.liftMode ?? interact.liftMode) === "grow";
	const assemble = brief.assemble ?? null;
	const from = assemble?.from ?? MANUAL_FROM;

	const byId = new Map(brief.parts.map(part => [part.id, part]));
	// Cast shadows fall on the figure's ground, the lowest base of a part that casts one (illustrations.md § Shadows): one plane,
	// so the shadow group paints first, under every part.
	const casters = brief.parts.filter(castsShadow);
	const ground = casters.length ? Math.min(...casters.map(part => part.at[2])) : 0;
	const step = shadowStep();
	const shadowCorners = (part, [mx, my, mz] = [0, 0, 0]) => partCorners(part).map(([x, y, z]) => [x + mx + (z + mz - ground) * step[0], y + my + (z + mz - ground) * step[1], ground]);
	// Fit every pose the figure can reach (explode, lift, assembly start). A clipped ring shows only inside its clip window,
	// so its fit extent is the window's (a flash ring several times the column would shrink the column to a speck).
	const poses = [];
	const shadowPoses = [];
	for (const part of brief.parts) {
		const corners = partCorners(part.kind === "ring" && part.clipTo ? clipWindowPart(part, byId) : part);
		poses.push(...corners);
		if (explode) {
			const e = vectorOf(part);
			for (const k of [explode.min - explode.rest, explode.max - explode.rest]) poses.push(...corners.map(([x, y, z]) => [x + e[0] * k, y + e[1] * k, z + e[2] * k]));
		}
		if (liftOf(part)) poses.push(...corners.map(([x, y, z]) => [x, y, z + liftWorld]));
		if (assemble) poses.push(...corners.map(([x, y, z]) => [x + from[0], y + from[1], z + Math.min(from[2], FIT_FROM_Z)]));
		// The rest pose's shadows are fitted; a lifted or exploded shadow may run past the frame, which clips it (the stage clips).
		if (castsShadow(part)) shadowPoses.push(...shadowCorners(part));
	}
	const solidPoses = poses.length;
	poses.push(...shadowPoses);
	for (const note of brief.annotations ?? []) poses.push(note.from, note.to);

	// A `dimension` annotation is drawn as a boxed label on a tick-ended line, like a `dims` entry.
	const dimSpecs = [...(brief.dims ?? []), ...(brief.annotations ?? []).filter(note => note.kind === "dimension")];
	const markSpecs = brief.marks ?? [];
	const scaleSpec = brief.scale ?? null;
	for (const spec of dimSpecs) poses.push(spec.from, spec.to);
	let scaleAt = null;
	if (scaleSpec) {
		const solids = brief.parts.filter(part => part.kind !== "ring");
		scaleAt = scaleSpec.at ?? [Math.min(...solids.map(part => planBox(part)[0])), Math.max(...solids.map(part => planBox(part)[3])) + SCALE_GAP, 0];
		poses.push(scaleAt, [scaleAt[0] + scaleSpec.length, scaleAt[1], scaleAt[2]]);
	}

	const font = { size: preset.label.size, spacingEm: preset.label.spacingEm };
	const labelSpecs = brief.labels ?? [];
	const P0 = projectionFor(cam, viewBox, poses);
	const flat0 = poses.map(point => iso(point, P0)[0]);
	const centre0 = (Math.min(...flat0) + Math.max(...flat0)) / 2;
	const sides = labelSpecs.map(label => {
		if (label.side === "left" || label.side === "right") return label.side;
		const [x0, y0, x1, y1] = planBox(byId.get(label.target));
		return iso([(x0 + x1) / 2, (y0 + y1) / 2, topZ(byId.get(label.target))], P0)[0] < centre0 ? "left" : "right";
	});
	const labelItems = labelSpecs.map((label, index) => ({ text: label.text, side: sides[index] }));
	const gutters = gutterOverride ?? gutterWidthsNear(labelItems, font);
	const P = projectionFor(cam, viewBox, poses, [gutters.left, gutters.right]);

	const pieces = [];
	for (const part of brief.parts) {
		for (const piece of solidFor(part, P, preset)) {
			const points = piece.solids.flatMap(solid => parsePolyPath(solid.fill ?? solid.edge) ?? []);
			pieces.push({ ...piece, partId: part.id, label: part.label, z: part.at[2], depth: depthKey(piece, P), hit: hull(points) });
		}
	}
	pieces.sort((a, b) => a.depth - b.depth || a.z - b.z || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
	for (const piece of pieces) {
		const part = byId.get(piece.partId);
		piece.focal = part.id === brief.focal;
		piece.state = piece.focal ? null : part.state ?? null;
		piece.layer = assemble ? layers.get(part.id) : null;
		if (explode) piece.explode = screenVector(vectorOf(part), P);
		if (liftOf(part)) piece.lift = screenVector(liftOf(part), P);
		if (isFixed(part)) piece.fixed = true;
		if (growOf(part)) {
			if (growsInPlace(piece, solidFor({ ...part, size: [part.size[0], part.size[1], part.size[2] + liftWorld] }, P, preset).find(other => other.id === piece.id), piece.lift)) piece.grow = true;
			else warnings.push(`part "${part.id}": its grown solid is not its rest solid with the top raised, so it raises instead of growing`);
		}
		if (part.clipTo) piece.clipTo = part.clipTo;
	}
	// The parts that grow as built (growOf asks; growsInPlace may have sent a part back to raising).
	const grown = new Set(pieces.filter(piece => piece.grow).map(piece => piece.partId));
	// One flat shadow per part that casts one, in painter order of its first piece; `cast` is the screen move of the shadow per
	// unit of the figure's motion (the lift for select, a Gap unit for explode), so the runtime moves it with its part.
	const shadows = [];
	for (const piece of pieces) {
		const part = byId.get(piece.partId);
		if (!castsShadow(part) || shadows.some(entry => entry.partId === part.id)) continue;
		const move = explode ? vectorOf(part) : liftOf(part);
		shadows.push({
			partId: part.id,
			layer: piece.layer,
			hit: castShadow(part, P, { ground, r: part.r ?? preset.radius, step }),
			cast: move && !grown.has(part.id) ? screenVector(shadowMove(move, step), P) : null,
		});
	}
	// Shadows on the parts below (illustrations.md § Shadows): one light, so a point on a part's top face is in shadow when any
	// part above it blocks the light, and the union of those casters' projections onto the face's plane is its shadow. Each pair
	// is the caster's full shadow on that plane, clipped live to the face (the emitter's clipPath), kept when it touches the face
	// at some reachable pose; it moves by the caster's cast times its motion less the receiver's (runtime place()).
	// A growing caster's shadows hold still: its base stays put, so a moved shadow would come loose from it (the grown top's longer
	// shadow is not drawn). A growing receiver's top rises like a raised one, so the shadows on it ride with it (castOn).
	const castOf = (part, onTop = false) => {
		const move = explode ? vectorOf(part) : liftOf(part);
		return move && (onTop || !grown.has(part.id)) ? screenVector(shadowMove(move, step), P) : null;
	};
	const reach = explode ? [explode.min - explode.rest, 0, explode.max - explode.rest].map(k => [k, k]) : liftWorld ? [[0, 0], [1, 0]] : [[0, 0]];
	const area = poly => Math.abs(poly.reduce((sum, [x, y], i) => sum + x * poly[(i + 1) % poly.length][1] - poly[(i + 1) % poly.length][0] * y, 0)) / 2;
	for (const receiver of casters) {
		const top = receivingTop(receiver, receiver.r ?? preset.radius);
		const face = top.ring.map(([x, y]) => iso([x, y, top.z], P));
		const castOn = castOf(receiver, true);
		const list = [];
		for (const caster of casters) {
			if (caster === receiver || caster.at[2] < top.z - 1e-6) continue;
			const hit = castShadow(caster, P, { ground: top.z, r: caster.r ?? preset.radius, step });
			const cast = castOf(caster);
			const off = (v, k) => (v ? [v[0] * k, v[1] * k] : [0, 0]);
			const touches = reach.some(([kc, kr]) => {
				const [cx, cy] = off(cast, kc);
				const [rx, ry] = off(castOn, kr);
				return area(clipConvex(hit.map(([x, y]) => [x + cx - rx, y + cy - ry]), face)) > 1;
			});
			if (touches) list.push({ partId: caster.id, hit, cast, castOn, layer: assemble ? layers.get(caster.id) : null });
		}
		const home = pieces.find(piece => piece.id === (receiver.kind === "tray" ? `${receiver.id}:back` : receiver.id));
		if (list.length && home) home.received = { clip: face, shadows: list };
	}
	// A clipped piece shows only inside its clip window: its target's top face, or that plan grown by `clipPad`. That
	// window is its silhouette and hit polygon, and the emitted clipPath is the same path (`clipD`).
	for (const piece of pieces) {
		if (!piece.clipTo) continue;
		const part = byId.get(piece.partId);
		const target = pieces.find(other => other.partId === piece.clipTo && other.solids[0]?.top) ?? pieces.find(other => other.partId === piece.clipTo);
		piece.clipD = part.clipPad ? clipWindowPath(part, clipWindowPart(part, byId), P) : target.solids[0].top ?? target.solids[0].fill ?? target.solids[0].edge;
		const clipped = clipConvex(piece.hit, parsePolyPath(piece.clipD) ?? []);
		if (clipped.length >= 3) piece.hit = clipped;
	}

	// Explode guides: each extreme base corner drops to the highest part whose footprint lies under it. A select figure draws them
	// too with `interact.guides`, so a floating layer shows what it hovers over; the upper end rides its part's lift.
	const guides = [];
	if (explode || interact?.guides) {
		for (const part of brief.parts) {
			if (["ring", "gap", "tray"].includes(part.kind)) continue;
			const byTarget = new Map();
			for (const corner of guideCorners(part, P, part.r ?? preset.radius)) {
				const below = brief.parts
					.filter(other => other !== part && other.kind !== "gap" && topZ(other) <= part.at[2] + 1e-6 && contains(other, corner))
					.sort((a, b) => topZ(b) - topZ(a) || (a.id < b.id ? -1 : 1))[0];
				if (!below) continue;
				if (!byTarget.has(below.id)) byTarget.set(below.id, { below, corners: [] });
				byTarget.get(below.id).corners.push(corner);
			}
			for (const { below, corners } of byTarget.values()) {
				const segment = guideSegments(corners, part.at[2], topZ(below), P);
				if (segment) guides.push({ from: part.id, to: below.id, ...segment });
			}
		}
	}

	const groups = [];
	pieces.forEach((piece, index) => {
		const last = groups.at(-1);
		if (last && last.layer === piece.layer) last.pieces.push(index);
		else groups.push({ layer: piece.layer, pieces: [index] });
	});

	const sceneHull = hull(pieces.flatMap(piece => piece.hit));
	const xs = sceneHull.map(([x]) => x);
	const hullBox = { minX: Math.min(...xs), maxX: Math.max(...xs) };
	const anchors = labelSpecs.map((label, index) => {
		const choice = chooseAnchor(byId.get(label.target), sides[index], pieces, P, label.anchor);
		if (!choice.visible) warnings.push(`label "${label.text}": no visible point on "${label.target}"; anchored at its top centre (set labels[${index}].anchor)`);
		return choice.point;
	});
	// Boxed dimension labels and the scale bar are placed first, because they do not move and the labels route around them.
	const hullCentre = [(hullBox.minX + hullBox.maxX) / 2, (Math.min(...sceneHull.map(([, y]) => y)) + Math.max(...sceneHull.map(([, y]) => y))) / 2];
	const dims = dimSpecs.map(spec => ({ ...dimGeometry({ a: iso(spec.from, P), b: iso(spec.to, P), text: spec.text, offset: spec.offset, centre: hullCentre }, font), text: spec.text }));
	const scaleBar = scaleSpec ? scaleGeometry(scaleSpec, scaleAt, P, font) : null;
	// A motion arrow is not a part, but a label that sat on it would read as its caption; labels route around its line.
	const arrowBoxes = (brief.annotations ?? []).filter(note => note.kind === "arrow").flatMap(note => segmentBoxes(iso(note.from, P), iso(note.to, P)));
	const avoid = [...dims.map(dim => dim.box), ...(scaleBar ? [scaleBar.box] : []), ...arrowBoxes];
	const labelRows = labelSpecs.map((label, index) => ({ text: label.text, target: label.target, side: sides[index], anchor: anchors[index] }));
	const labels = placeLabelsNear({ viewBox, hull: sceneHull, pad: cam.pad, avoid }, labelRows, font);

	const annotations = [];
	for (const note of brief.annotations ?? []) {
		if (note.kind === "dimension") continue;
		annotations.push({ ...note, a: iso(note.from, P), b: iso(note.to, P), text: note.text });
	}

	// Narrow stages (illustrations.md § Narrow stages, G2 J4): 11-unit callout text renders near 4 px on a phone, so below
	// 720 px the callouts give way to numbered tags (on the target's anchor, inside its part group) plus an HTML legend, and
	// the empty label gutters are cropped. `tags` and `crop` carry the data; the emitter writes it, runtime-css switches it on.
	let tags = labels.map((label, index) => {
		const point = label.leader.points.at(-1);
		const home = homePiece(pieces, label.target, point);
		return { n: index + 1, text: label.text, target: label.target, point, piece: home ? home[1] : -1 };
	});
	const marks = buildMarks(markSpecs, { pieces, hullCentre, warnings, anchorFor: spec => chooseAnchor(byId.get(spec.target), "right", pieces, P, spec.at) });
	let crop = null;
	if (labels.length || dims.length) {
		// The narrow-stage crop spans the drawing, not its shadows: a shadow's tail may fall outside the cropped stage, which keeps
		// the parts and their tags at full size on a phone.
		const xs = poses.filter((_, index) => index < solidPoses || index >= solidPoses + shadowPoses.length).map(point => iso(point, P)[0]);
		const x0 = Math.max(0, Math.min(...xs) - CROP_PAD);
		const x1 = Math.min(viewBox[0], Math.max(...xs) + CROP_PAD);
		if (viewBox[0] / (x1 - x0) >= MIN_CROP_ZOOM) crop = { width: round((viewBox[0] / (x1 - x0)) * 100), offset: round((-x0 / (x1 - x0)) * 100) };
		if (labels.length) ({ tags, crop } = narrowTagLayout({ tags, labels, hull: sceneHull, width: viewBox[0], height: viewBox[1], xs, cropPad: CROP_PAD, minZoom: MIN_CROP_ZOOM }));
	}

	let timing = null;
	if (assemble) timing = manualTiming({ layers: assemble.layers.length });
	return {
		brief,
		id: brief.id,
		figId: brief.figId,
		style,
		preset,
		viewBox,
		pad: cam.pad,
		P,
		camera: { preset: cam.preset, azimuth: P.azimuth, elevation: P.elevation, attr: cameraAttrOf(P) },
		zdepth: Math.round(Math.sin((P.elevation * Math.PI) / 180) * 1000) / 1000,
		liftWorld,
		behavior,
		explode,
		interact,
		pieces,
		groups,
		shadows,
		ground,
		guides,
		labels,
		tags,
		crop,
		font,
		annotations,
		dims,
		marks,
		scaleBar,
		timing,
		enterOffset: timing ? screenVector(from, P) : null,
		// A landing part's shadow slides in on the ground from where the start pose casts it.
		shadowOffset: timing ? screenVector(shadowMove(from, step), P) : null,
		texture: preset.texture && brief.texture === "dots" ? preset.texture : null,
		hull: sceneHull,
		poseYs: poses.map(point => iso(point, P)[1]),
		gutters,
		warnings,
		widthOf: text => textWidth(text, font),
	};
}
