// iso/schema — vpk-iso-brief/1 validation (split out of scene.mjs so both stay under the line budget): the brief's constants,
// the part kinds (legacy box-like kinds plus the turned, tube and ball kinds of plan § 2 L, U, S), detail (detail.mjs) and the
// repeat expansion (expand.mjs). scene.mjs re-exports everything here, so callers keep importing from scene.mjs.

import { FIGURE_CAMERA } from "../figures/camera.mjs";
import { ENTRY } from "./accent.mjs";
import { validateDetail } from "./detail.mjs";
import { expandBrief, validateExpansion } from "./expand.mjs";
import { axisVector, BOX_KINDS, isLegacy, LEGACY_KINDS, NEW_KINDS } from "./geometry.mjs";
import { normalizePolygon, selfIntersects, signedArea } from "./polygon.mjs";
import { TRAY_OPENINGS } from "./tray.mjs";
import { validateCutaway } from "./cutaway.mjs";
import { validateDims, validateMarks, validateScale } from "./manual-scene.mjs";
import { EMPHASES, KIT_STYLE } from "./palette.mjs";
import { STATE_BEHAVIORS, validateBriefStates, validatePartStates } from "./states.mjs";
import { ISO_THRESHOLDS } from "./thresholds.mjs";
import { validateTour } from "./tour.mjs";

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
// The legacy box-like kinds plus the turned, tube and ball kinds (geometry.mjs).
export const PART_KINDS = Object.freeze([...LEGACY_KINDS, ...NEW_KINDS]);
// A "new" or "active" part shares the focal's pale fill, without its outline (rule 4).
export const PART_STATES = Object.freeze(["new", "active"]);
// A part's own tone: "ink" paints its faces in the dark ink steps (black pins, dark slats); "glass" paints no face at all (its
// visible edges in the edge stroke, its hidden edges dashed, no shadow; what stands behind it shows through); "glow" paints its faces
// with a radial gradient from the accent (heat, light; plan § 2 W); omitted, the tone map.
export const PART_TONES = Object.freeze(["ink", "glass", "glow"]);
// Annotation kinds: a dimension, a motion arrow, and a plain dotted or dashed `line` between world points (projection lines, light
// rays; with `spectrum` a red, green or blue ray, plan § 2 X).
export const ANNOTATION_KINDS = Object.freeze(["dimension", "arrow", "line"]);
export const LINE_DASHES = Object.freeze(["solid", "dotted", "dashed"]);
export const SPECTRUM_KEYS = Object.freeze(["r", "g", "b"]);
// Leader labels: "leaders" (default; `labels` may also be the array of label specs itself) or "none" (no labels, no part.label).
export const LABEL_MODES = Object.freeze(["leaders", "none"]);
// Caps from checks-thresholds.json → "iso" (iso/thresholds.mjs).
export const MAX_PARTS = ISO_THRESHOLDS.partsMax;
export const WARN_PARTS = ISO_THRESHOLDS.partsWarn;
export const MAX_LABELS = ISO_THRESHOLDS.labelsMax;

// The brief's emphasis, label mode, label specs and focal ids, normalised (focal may be a string, a list or absent).
export const emphasisOf = brief => brief?.emphasis ?? "accent";
export const labelModeOf = brief => (typeof brief?.labels === "string" ? brief.labels : "leaders");
export const labelSpecsOf = brief => (Array.isArray(brief?.labels) ? brief.labels : []);
export const focalIdsOf = brief => (brief?.focal === undefined || brief?.focal === null ? [] : Array.isArray(brief.focal) ? brief.focal : [brief.focal]);

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

const vec3 = (part, key, at, push) => {
	if (!isVec(part[key])) push(`${at}.${key} must be [x, y, z]`);
};
const positive = (part, key, at, push) => {
	if (!(isNum(part[key]) && part[key] > 0)) push(`${at}.${key} must be > 0`);
};
function validateAxis(part, at, push) {
	if (part.axis !== undefined) {
		const a = axisVector(part.axis);
		if (!a || !isVec(a) || Math.hypot(...a) < 1e-9) return push(`${at}.axis must be x, y, z, -x, -y, -z or a non-zero [x, y, z]`);
		if (part.up !== undefined) {
			if (!isVec(part.up) || Math.hypot(...part.up) < 1e-9) push(`${at}.up must be a non-zero [x, y, z]`);
			else {
				const [ax, ay, az] = a;
				const [ux, uy, uz] = part.up;
				const sine = Math.hypot(ay * uz - az * uy, az * ux - ax * uz, ax * uy - ay * ux) / (Math.hypot(...a) * Math.hypot(...part.up));
				if (sine < 1e-3) push(`${at}.up must not be parallel to the axis`);
			}
		}
	} else if (part.up !== undefined) push(`${at}.up needs an axis`);
}
const distinct = (a, b) => isVec(a) && isVec(b) && Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) > 1e-6;
const pointList = (value, max = 512) => Array.isArray(value) && value.length >= 2 && value.length <= max && value.every(point => isVec(point)) && value.every((point, i) => i === 0 || distinct(point, value[i - 1]));
const LIST_NEEDS = "must be 2–512 [x, y, z] points, each different from the one before";

// The turned, tube and ball kinds (plan § 2 L, U, S). None takes `size`.
// Orientation (plan § 2 R): `yaw` is degrees about world z, finite.
const validateYaw = (part, at, push) => {
	if (part.yaw !== undefined && !(isNum(part.yaw) && Math.abs(part.yaw) <= 360)) push(`${at}.yaw must be degrees within ±360`);
};

// A prism (plan § 2 P): { at, axis?, up?, yaw?, polygon: [[u, v], …] (3–128 points, simple: no edge crosses another), depth > 0,
// round? ≥ 0 }. The polygon may be concave; the kit splits it into convex solids.
function validatePrism(part, at, push) {
	const p = part.polygon;
	if (!Array.isArray(p) || p.length < 3 || p.length > 128 || !p.every(point => isVec(point, 2))) push(`${at}.polygon must be 3–128 [u, v] points`);
	else {
		const ring = normalizePolygon(p);
		if (ring.length < 3 || Math.abs(signedArea(ring)) < 1e-6) push(`${at}.polygon has no area (its points are collinear or repeated)`);
		else if (selfIntersects(ring)) push(`${at}.polygon must be simple: two of its edges cross or touch (draw a hole as a closed tube, or split the part)`);
	}
	positive(part, "depth", at, push);
	if (part.round !== undefined && !(isNum(part.round) && part.round >= 0)) push(`${at}.round must be ≥ 0`);
	validateYaw(part, at, push);
}
function validateNewKind(part, at, push) {
	if (part.size !== undefined) push(`${at}.size does not apply to a ${part.kind} (see illustrations.md § Part kinds for its fields)`);
	const kind = part.kind;
	if (["lathe", "cone", "torus", "leg", "sphere", "pin", "prism", "glow"].includes(kind)) vec3(part, "at", at, push);
	if (["lathe", "cone", "torus", "pin", "prism", "glow"].includes(kind)) validateAxis(part, at, push);
	else if (part.axis !== undefined || part.up !== undefined) push(`${at}.axis and up do not apply to a ${kind}`);
	if (kind === "prism") validatePrism(part, at, push);
	else if (part.yaw !== undefined) push(`${at}.yaw applies to prisms, boxes, slabs and plates`);
	if (kind === "lathe") {
		const p = part.profile;
		if (!Array.isArray(p) || p.length < 2 || p.length > 64) push(`${at}.profile must be 2–64 [s, r] points`);
		else if (!p.every(point => Array.isArray(point) && (point.length === 2 || (point.length === 3 && point[2] === "soft")) && isNum(point[0]) && isNum(point[1]) && point[1] >= 0)) push(`${at}.profile points must be [s, r] or [s, r, "soft"] with r ≥ 0`);
		else if (p.some((point, i) => i && point[0] < p[i - 1][0])) push(`${at}.profile s must not decrease`);
		else if (!p.some(point => point[1] > 0)) push(`${at}.profile needs a point with r > 0`);
		else if (!(p.at(-1)[0] > p[0][0])) push(`${at}.profile must have length along the axis`);
		if (part.closed !== undefined && typeof part.closed !== "boolean") push(`${at}.closed must be true or false`);
		if (part.hole !== undefined && part.hole !== null && !(isVec(part.hole, 2) && part.hole[1] > 0)) push(`${at}.hole must be [s, r] with r > 0`);
		if (part.steps !== undefined && !(Number.isInteger(part.steps) && part.steps >= 8 && part.steps <= 160)) push(`${at}.steps must be an integer within 8–160`);
	} else if (kind === "glow") {
		// A halo (plan § 2 W): a flat disc of radius r across its axis (default z: a pool of light on the ground), filled with the
		// accent fading to transparent. No faces, no shadow, no detail.
		positive(part, "r", at, push);
		if (part.tone !== undefined) push(`${at}.tone does not apply to a glow (it is always the accent halo)`);
		if (part.detail !== undefined) push(`${at}.detail does not apply to a glow`);
	} else if (kind === "cone") {
		for (const key of ["r0", "r1"]) if (!(isNum(part[key]) && part[key] >= 0)) push(`${at}.${key} must be ≥ 0`);
		if (isNum(part.r0) && isNum(part.r1) && !(Math.max(part.r0, part.r1) > 0)) push(`${at}: a cone needs r0 or r1 > 0`);
		positive(part, "length", at, push);
	} else if (kind === "torus") {
		positive(part, "R", at, push);
		positive(part, "r", at, push);
		if (isNum(part.R) && isNum(part.r) && !(part.r < part.R)) push(`${at}: a torus needs r < R`);
	} else if (kind === "tube") {
		if (!pointList(part.points)) push(`${at}.points ${LIST_NEEDS}`);
		positive(part, "radius", at, push);
		if (part.fillet !== undefined && !(isNum(part.fillet) && part.fillet >= 0)) push(`${at}.fillet must be ≥ 0`);
		for (const key of ["closed", "caps"]) if (part[key] !== undefined && typeof part[key] !== "boolean") push(`${at}.${key} must be true or false`);
		if (part.corrugate !== undefined && !(part.corrugate && isNum(part.corrugate.every) && part.corrugate.every > 0)) push(`${at}.corrugate must be { every } with every > 0`);
	} else if (kind === "rod" || kind === "catenary" || kind === "spring") {
		if (!distinct(part.from, part.to)) push(`${at}.from and to must be two different [x, y, z] points`);
		positive(part, "radius", at, push);
		if (kind === "catenary" && part.sag !== undefined && !(isNum(part.sag) && part.sag >= 0 && part.sag <= 200)) push(`${at}.sag must be within 0–200`);
		if (kind === "spring") {
			positive(part, "wire", at, push);
			if (isNum(part.wire) && isNum(part.radius) && !(part.wire < part.radius)) push(`${at}.wire must be thinner than the coil radius`);
			if (!(isNum(part.turns) && part.turns >= 0.5 && part.turns <= 60)) push(`${at}.turns must be within 0.5–60`);
		}
		if (kind === "rod" && part.caps !== undefined && typeof part.caps !== "boolean") push(`${at}.caps must be true or false`);
	} else if (kind === "leg") {
		positive(part, "radius", at, push);
		const ground = part.ground ?? 0;
		if (!isNum(ground) || (isVec(part.at) && !(part.at[2] > ground))) push(`${at}: a leg runs down from at to the ground (ground must be a number below at's z)`);
		if (part.foot !== undefined && !(part.foot && isNum(part.foot.r) && isNum(part.foot.h) && part.foot.h > 0 && part.foot.r > (part.radius ?? 0))) push(`${at}.foot must be { r, h } with h > 0 and r wider than the leg`);
	} else if (kind === "wire") {
		if (part.points !== undefined) {
			if (!pointList(part.points)) push(`${at}.points ${LIST_NEEDS}`);
		} else if (!distinct(part.from, part.to)) push(`${at} needs points, or from and to`);
		if (part.sag !== undefined && !(isNum(part.sag) && part.sag >= 0 && part.sag <= 200)) push(`${at}.sag must be within 0–200`);
		if (part.radius !== undefined) push(`${at}.radius does not apply to a wire (a wire is a stroke; use a tube or catenary for a cable with body)`);
	} else if (kind === "sphere") positive(part, "r", at, push);
	else if (kind === "pin") {
		positive(part, "length", at, push);
		positive(part, "r", at, push);
		if (!(isNum(part.head) && part.head >= (part.r ?? 0))) push(`${at}.head must be a radius ≥ r`);
	}
}

// A tray's opening (plan § 2 O): axis is the open face, "+z" (default) or "-z", "+x", "-x", "+y", "-y" (x, y, z alias +); no up.
// dividers: { x?: [u, …], y?: [v, …], z?: [w, …] }, offsets from `at` strictly inside the box, a divider per offset.
function validateTray(part, at, push) {
	if (part.axis !== undefined && !TRAY_OPENINGS.includes(part.axis) && !["x", "y", "z"].includes(part.axis)) push(`${at}.axis is a tray's open face: one of ${TRAY_OPENINGS.join(", ")}`);
	if (part.up !== undefined) push(`${at}.up does not apply to a tray (its axis names the open face)`);
	const dividers = part.dividers;
	if (dividers === undefined) return;
	if (!dividers || typeof dividers !== "object" || Array.isArray(dividers) || !Object.keys(dividers).length) return push(`${at}.dividers must be { x?, y?, z? } lists of offsets`);
	for (const [key, list] of Object.entries(dividers)) {
		const axis = "xyz".indexOf(key);
		if (axis < 0) {
			push(`${at}.dividers.${key}: the keys are x, y and z`);
			continue;
		}
		const extent = isVec(part.size) ? part.size[axis] : Infinity;
		if (!Array.isArray(list) || !list.length || !list.every(value => isNum(value) && value > 0 && value < extent)) push(`${at}.dividers.${key} must list offsets within (0, ${extent}) from at`);
		else if (new Set(list).size !== list.length) push(`${at}.dividers.${key} lists an offset twice`);
	}
}

function validateLegacy(part, at, push) {
	if (!isVec(part.at)) push(`${at}.at must be [x, y, z]`);
	if (!isVec(part.size) || !(part.size[0] > 0) || !(part.size[1] > 0) || !(part.size[2] >= 0)) push(`${at}.size must be [w, d, h] with w, d > 0 and h ≥ 0`);
	else if ((part.kind === "gap" || part.kind === "plate") && part.size[2] > 2) push(`${at}.size: a ${part.kind} has h ≤ 2`);
	else if (["slab", "box", "cylinder", "tray"].includes(part.kind) && !(part.size[2] > 0)) push(`${at}.size: a ${part.kind} needs h > 0`);
	else if ((part.kind === "cylinder" || part.kind === "ring") && (part.size[1] !== part.size[0] || (part.kind === "ring" && part.size[2] !== 0))) push(`${at}.size: a ${part.kind} is [r, r, ${part.kind === "ring" ? 0 : "h"}] (r is the radius; \`at\` is the centre)`);
	if (part.kind === "cylinder" || part.kind === "ring") validateAxis(part, at, push);
	else if (BOX_KINDS.includes(part.kind)) {
		validateAxis(part, at, push);
		validateYaw(part, at, push);
	} else if (part.kind === "tray") validateTray(part, at, push);
	else if (part.axis !== undefined || part.up !== undefined) push(`${at}.axis and up apply to cylinders, rings, boxes, slabs, plates, trays, prisms and the turned kinds`);
	if (part.yaw !== undefined && !BOX_KINDS.includes(part.kind)) push(`${at}.yaw applies to prisms, boxes, slabs and plates`);
	if (part.dividers !== undefined && part.kind !== "tray") push(`${at}.dividers apply to trays only`);
	if (part.kind === "ring") {
		if (part.thickness !== undefined && !(isNum(part.thickness) && part.thickness > 0 && part.thickness <= 100)) push(`${at}.thickness must be within (0, 100]`);
		if (part.inner !== undefined && !(part.thickness !== undefined && isNum(part.inner) && part.inner > 0 && isVec(part.size) && part.inner < part.size[0])) push(`${at}.inner is the bore radius of a ring with thickness, within (0, r)`);
		if (part.thickness !== undefined && part.clipTo !== undefined) push(`${at}.clipTo applies to flat rings only`);
		if (part.thickness === undefined && part.axis !== undefined) push(`${at}.axis applies to a ring with thickness`);
	} else if (part.thickness !== undefined || part.inner !== undefined) push(`${at}.thickness and inner apply to rings only`);
	if (part.marks !== undefined && !(Array.isArray(part.marks) && part.marks.every(mark => Array.isArray(mark) && mark.length === 2 && mark.every(point => isVec(point, 2))))) push(`${at}.marks must be [[u, v], [u, v]] segments`);
	else if (part.marks !== undefined && isVec(part.size) && !isLegacy(part)) push(`${at}.marks apply to upright parts; use line detail on a ${part.kind} with an axis`);
}

function validatePart(part, index, push) {
	const at = `parts[${index}]`;
	if (!part || typeof part !== "object") return push(`${at} must be an object`);
	if (!FIGURE_ID.test(part.id ?? "")) push(`${at}.id ${JSON.stringify(part.id)} must match ${FIGURE_ID}`);
	if (!PART_KINDS.includes(part.kind)) return push(`${at}.kind ${JSON.stringify(part.kind)} must be one of ${PART_KINDS.join(", ")}`);
	const legacy = LEGACY_KINDS.includes(part.kind);
	if (legacy) validateLegacy(part, at, push);
	else {
		validateNewKind(part, at, push);
		if (part.marks !== undefined) push(`${at}.marks apply to the box-like kinds; use line detail on a ${part.kind}`);
	}
	if (legacy && part.r !== undefined && !(isNum(part.r) && part.r >= 0)) push(`${at}.r must be ≥ 0`);
	if (part.bevel !== undefined && !(isNum(part.bevel) && (part.bevel === 0 || (part.bevel >= 0.6 && part.bevel <= 2.2)))) push(`${at}.bevel must be 0 or within 0.6–2.2`);
	// The kit draws every side face as a plain flat face; the hatched cut face is gone, so a brief that still asks for one fails.
	if (part.cut !== undefined) push(`${at}.cut is no longer supported: the iso kit draws every side face as a plain flat face (no hatching); remove "cut" from the part`);
	if (part.label !== undefined && (typeof part.label !== "string" || part.label.length > 60)) push(`${at}.label must be a string of ≤ 60 chars`);
	if (part.explode !== undefined && !isVec(part.explode)) push(`${at}.explode must be [x, y, z]`);
	if (part.guides !== undefined && part.guides !== false) push(`${at}.guides is false or absent (false: draw no explode guides for this part)`);
	if (part.clipTo !== undefined && part.kind !== "ring") push(`${at}.clipTo is allowed on rings only`);
	if (part.clipPad !== undefined && !(part.kind === "ring" && part.clipTo !== undefined && isNum(part.clipPad) && part.clipPad >= 0 && part.clipPad <= 200)) push(`${at}.clipPad is a number within 0–200, allowed on a ring with clipTo`);
	if (part.state !== undefined && !PART_STATES.includes(part.state)) push(`${at}.state must be one of ${PART_STATES.join(", ")}`);
	if (part.tone !== undefined && !PART_TONES.includes(part.tone)) push(`${at}.tone ${JSON.stringify(part.tone)} must be one of ${PART_TONES.join(", ")}`);
	if (part.cutaway !== undefined) validateCutaway(part, at, push);
	validateDetail(part, at, push);
}

// A `line` annotation (plan § 1 rule 16, § 2 X): { from, to, via?: [[x, y, z], …] (bends, at most 16), dash?: solid | dotted | dashed
// (default dashed), spectrum?: r | g | b (a coloured ray: the root carries data-vpk-iso-spectrum), ends?: none | dot }. A plain line
// is drawn in the guide tone; it is not a part, so labels route around it like an arrow.
function validateLine(note, at, push) {
	if (note.via !== undefined && !(Array.isArray(note.via) && note.via.length >= 1 && note.via.length <= 16 && note.via.every(point => isVec(point)))) push(`${at}.via must be 1–16 [x, y, z] points`);
	if (note.dash !== undefined && !LINE_DASHES.includes(note.dash)) push(`${at}.dash must be one of ${LINE_DASHES.join(", ")}`);
	if (note.spectrum !== undefined && !SPECTRUM_KEYS.includes(note.spectrum)) push(`${at}.spectrum must be one of ${SPECTRUM_KEYS.join(", ")}`);
	if (note.ends !== undefined && !["none", "dot"].includes(note.ends)) push(`${at}.ends must be "none" or "dot"`);
	for (const key of ["text", "of", "offset"]) if (note[key] !== undefined) push(`${at}.${key} does not apply to a line`);
}

function validateInteract(interact, push) {
	if (interact === undefined || interact === null) return;
	if (!["select", "explode", "teardown", ...STATE_BEHAVIORS].includes(interact.behavior)) return push(`interact.behavior ${JSON.stringify(interact.behavior)} must be "select", "explode", "teardown", "step" or "scrub"`);
	// teardown (illustrations.md § Teardown): the brief's `at` values are the exploded pose; each part's `explode` is its travel
	// from the assembled place. An Exploded / Assembled switch, a Spread slider and part hover come with it.
	if (interact.behavior === "teardown") {
		const t = interact.teardown ?? {};
		if (typeof t !== "object" || Array.isArray(t)) return push("interact.teardown must be an object");
		if (t.step !== undefined && !(isNum(t.step) && t.step > 0 && t.step <= 1)) push("interact.teardown.step must be within (0, 1]");
		if (t.start !== undefined && !["exploded", "assembled"].includes(t.start)) push('interact.teardown.start must be "exploded" or "assembled"');
		if (t.gap !== undefined && !(isNum(t.gap) && t.gap > 0)) push("interact.teardown.gap must be a positive number (world units between layers)");
		for (const key of ["lift", "explode"]) if (interact[key] !== undefined) push(`interact.${key} does not apply to teardown`);
		return;
	}
	// step and scrub (states.mjs validateStateInteract, run from validateFlat with the parts).
	if (STATE_BEHAVIORS.includes(interact.behavior)) {
		if (interact.rest !== undefined && typeof interact.rest !== "string" && !Number.isInteger(interact.rest)) push("interact.rest must be a state index or a state name");
		return;
	}
	if (interact.lift !== undefined && !(isNum(interact.lift) && interact.lift > 0 && interact.lift <= 40)) push("interact.lift must be within (0, 40]");
	if (interact.rest !== undefined && typeof interact.rest !== "string") push("interact.rest must be a string");
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

function validateFlat(brief) {
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
	if (!Array.isArray(brief.parts) || parts.length < 1 || parts.length > MAX_PARTS) push(Number.isFinite(MAX_PARTS) ? `parts must be an array of 1–${MAX_PARTS} parts ` : "parts must be a non-empty array");
	parts.forEach((part, index) => validatePart(part, index, push));
	const ids = parts.map(part => part?.id);
	const known = new Set(ids);
	for (const id of new Set(ids.filter((id, index) => ids.indexOf(id) !== index))) push(`part id "${id}" is used more than once`);
	parts.forEach((part, index) => {
		if (part?.clipTo !== undefined && (!known.has(part.clipTo) || part.clipTo === part.id)) push(`parts[${index}].clipTo "${part.clipTo}" must name another part`);
	});
	const emphasis = emphasisOf(brief);
	if (!EMPHASES.includes(emphasis)) push(`emphasis ${JSON.stringify(brief.emphasis)} must be one of ${EMPHASES.join(", ")}`);
	const focal = brief.focal;
	const focalIds = focalIdsOf(brief);
	if (focal !== undefined && focal !== null && !(typeof focal === "string" || (Array.isArray(focal) && focal.length > 0))) push("focal must be a part id or a non-empty list of part ids");
	else if (emphasis === "none" && focalIds.length) push('focal is not allowed with emphasis "none" (no part is emphasised); remove focal or set emphasis "ink"');
	else if (emphasis === "accent" && !focalIds.length) push('focal is required with emphasis "accent" (the default): name a part or a list of parts, or set emphasis "ink" or "none"');
	else {
		for (const id of focalIds) if (!known.has(id)) push(`focal ${JSON.stringify(id)} must name a part`);
		for (const id of new Set(focalIds.filter((id, index) => focalIds.indexOf(id) !== index))) push(`focal lists "${id}" more than once`);
	}
	const labelMode = labelModeOf(brief);
	if (brief.labels !== undefined && !Array.isArray(brief.labels) && !LABEL_MODES.includes(brief.labels)) push('labels must be an array of labels, "leaders" or "none"');
	if (labelMode === "none") parts.forEach((part, index) => {
		if (part?.label !== undefined) push(`parts[${index}].label is not allowed with labels "none" (the figure draws no labels); remove it`);
	});
	const labelSpecs = labelSpecsOf(brief);
	if (labelSpecs.length > MAX_LABELS) push(`labels has ${labelSpecs.length} labels; at most ${MAX_LABELS} (A7: a dense figure crowds; prefer labels "none" and a readout)`);
	labelSpecs.forEach((label, index) => {
		if (!label || typeof label.text !== "string" || !label.text.trim() || label.text.length > 40) push(`labels[${index}].text must be a non-empty string of ≤ 40 chars`);
		if (!known.has(label?.target)) push(`labels[${index}].target ${JSON.stringify(label?.target)} must name a part`);
		if (label?.side !== undefined && !["left", "right", "auto"].includes(label.side)) push(`labels[${index}].side must be left, right or auto`);
		if (label?.anchor !== undefined && !isVec(label.anchor)) push(`labels[${index}].anchor must be [x, y, z]`);
	});
	(brief.annotations ?? []).forEach((note, index) => {
		if (!ANNOTATION_KINDS.includes(note?.kind)) return push(`annotations[${index}].kind must be one of ${ANNOTATION_KINDS.map(kind => `"${kind}"`).join(", ")}`);
		if (!isVec(note.from) || !isVec(note.to)) push(`annotations[${index}] needs from and to as [x, y, z]`);
		if (note.kind === "line") return validateLine(note, `annotations[${index}]`, push);
		if (note.kind === "dimension" && (typeof note.text !== "string" || !note.text.trim())) push(`annotations[${index}].text is required for a dimension`);
		// A motion arrow may name the part it moves (`of`): it takes the accent while that part is the focal, hovered or selected one.
		if (note.of !== undefined && (note.kind !== "arrow" || !known.has(note.of))) push(`annotations[${index}].of must name a part, on an arrow`);
	});
	const assemble = brief.assemble;
	if (assemble !== undefined && assemble !== null) {
		const layers = assemble.layers;
		if (!Array.isArray(layers) || layers.length < 1 || !layers.every(layer => Array.isArray(layer) && layer.length > 0)) push("assemble.layers must be a non-empty array of non-empty id lists");
		else {
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
	validateTour(brief.tour, known, push);
	validateBriefStates(brief, parts, push);
	parts.forEach((part, index) => {
		if (part && typeof part === "object" && PART_KINDS.includes(part.kind)) validatePartStates(part, index, push, validatePart);
	});
	if (brief.meta !== undefined && !(brief.meta && typeof brief.meta === "object" && ["margin", "corner"].every(key => brief.meta[key] === undefined || (typeof brief.meta[key] === "string" && brief.meta[key].length <= 40)))) push("meta.margin and meta.corner must be strings of ≤ 40 chars");
	return errors;
}

// vpk-iso-brief/1 validation. Repeat, instances and vary are checked first and expanded (expand.mjs); the expanded brief is then
// validated part by part, so the part cap counts instances and errors name the expanded parts (`${id}-${k}`).
export function validateBrief(brief) {
	if (!brief || typeof brief !== "object") return ["brief must be an object"];
	const errors = [];
	const parts = Array.isArray(brief.parts) ? brief.parts : [];
	const total = validateExpansion(parts, message => void errors.push(message), MAX_PARTS);
	if (errors.length) return errors;
	if (total > MAX_PARTS) return [`parts must be an array of 1–${MAX_PARTS} parts after repeat expansion, ${total} given`];
	return validateFlat(expandBrief(brief));
}
