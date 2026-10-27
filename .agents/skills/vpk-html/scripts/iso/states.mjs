// iso/states — step and scrub figures at build time (plan § 2 I): interact.states validation, part variants and rotate sampling,
// the per-state world moves, and the stage's state model (data-vpk-iso-states, read by state-runtime.mjs) with one painter order
// per state. Split out of scene.mjs and schema.mjs, which call it at three points: validation, the drawn geometry of a part, and
// the finished scene.
//
//   "interact": { "behavior": "step" | "scrub", "input"?, "rest"?: 0 | "name", "loop"?, "values"?: { key: [per state] },
//                 "readout"?: "{name} · {kN:0.1} kN", "states": [{ "name", "readout"?, "values"?, "parts"?: { id: spec } }] }
//   spec = { "variant"?: name | "base", "hidden"?: true, "move"?: [x, y, z], "turn"?: degrees }
//   part.variants = { name: { ...geometry overrides } }   part.rotate = { axis, about?, deg: [a0, a1], samples? }
//
// The rest state is the static art: its parts take no move (the brief's geometry is the rest pose), and its hidden parts and
// variants are what the static SVG shows. A variant is drawn as its own pieces (`<id>@<name>`, data-vpk-iso-variant) beside
// the base pieces (data-vpk-iso-variant="base"), and the ones the rest state does not show carry display="none". A rotating part
// is drawn only as its turn samples (`turn-<i>`); a state's turn picks the nearest one.

import { painterKeys } from "./painter.mjs";
import { depthOf, iso } from "../anatomy/vendor/kit/iso-kit.mjs";
import * as A from "../anatomy/vendor/kit/audit.mjs";
import { axisVector, frameFor, isLegacy, YAW_KINDS, yawPart } from "./geometry.mjs";
import { anchorOf } from "./expand.mjs";
import { stateText } from "./state-runtime.mjs";

export const STATE_BEHAVIORS = Object.freeze(["step", "scrub"]);
export const STATE_INPUTS = Object.freeze({ step: ["click", "keys"], scrub: ["drag", "pointer-x", "keys"] });
const RESERVED = new Set(["name", "n", "count", "t"]);
const VARIANT_NAME = /^[a-z][a-z0-9-]{0,23}$/;
const NO_OVERRIDE = ["id", "kind", "variants", "rotate", "repeat", "instances", "vary", "label", "explode", "clipTo", "clipPad"];
const SPEC_KEYS = new Set(["variant", "hidden", "move", "turn"]);
// Kinds a rotate can turn: everything with an axis, a centreline or a centre (boxes turn with yaw in a later phase; a leg stands).
const TURNABLE = new Set(["cylinder", "lathe", "cone", "torus", "tube", "rod", "spring", "catenary", "wire", "sphere", "pin"]);
const PLACEHOLDER = /\{([A-Za-z]\w*)(?::\d+(?:\.\d+)?)?\}/g;

const isNum = value => typeof value === "number" && Number.isFinite(value);
const isVec = (value, n = 3) => Array.isArray(value) && value.length === n && value.every(isNum);
const round6 = value => Math.round(value * 1e6) / 1e6;

export const isStateBehavior = interact => Boolean(interact) && STATE_BEHAVIORS.includes(interact.behavior);

// The rest state's index (interact.rest is a state index or name; default 0), or -1 when it names no state.
export function restIndexOf(interact) {
	const rest = interact.rest ?? 0;
	if (typeof rest === "string") return interact.states.findIndex(state => state?.name === rest);
	return Number.isInteger(rest) && rest >= 0 && rest < interact.states.length ? rest : -1;
}

// Rodrigues: `point` turned `deg` degrees about the line through `about` along `axis`.
function turnPoint(point, about, axis, deg) {
	const len = Math.hypot(...axis);
	const [kx, ky, kz] = axis.map(v => v / len);
	const [x, y, z] = [point[0] - about[0], point[1] - about[1], point[2] - about[2]];
	const a = (deg * Math.PI) / 180;
	const c = Math.cos(a);
	const s = Math.sin(a);
	const dot = kx * x + ky * y + kz * z;
	const out = [
		x * c + (ky * z - kz * y) * s + kx * dot * (1 - c),
		y * c + (kz * x - kx * z) * s + ky * dot * (1 - c),
		z * c + (kx * y - ky * x) * s + kz * dot * (1 - c),
	];
	return out.map((v, i) => round6(v + about[i]));
}
const turnVector = (v, axis, deg) => turnPoint(v, [0, 0, 0], axis, deg);

// The part turned `deg` about its rotate axis (a copy; the turned kinds keep their own axis and up, so detail turns with them).
export function rotatePart(part, deg) {
	const { rotate, variants, ...base } = part;
	const axis = axisVector(rotate.axis ?? "z");
	const about = rotate.about ?? anchorOf(part);
	// Boxes, slabs, plates and prisms turn about a vertical axis only, through yaw (geometry.mjs yawPart).
	if (YAW_KINDS.includes(part.kind)) return yawPart(base, about, axis[2] < 0 ? -deg : deg);
	const out = { ...base };
	for (const key of ["at", "from", "to"]) if (isVec(out[key])) out[key] = turnPoint(out[key], about, axis, deg);
	if (Array.isArray(out.points)) out.points = out.points.map(point => turnPoint(point, about, axis, deg));
	if (["cylinder", "lathe", "cone", "torus", "pin"].includes(part.kind) || (part.kind === "ring" && part.thickness)) {
		const own = axisVector(part.axis ?? "z");
		const up = part.up ?? frameFor(part.at, own).u;
		out.axis = turnVector(own, axis, deg);
		out.up = turnVector(up, axis, deg);
	}
	return out;
}

// The sample angles of a rotating part.
export function turnSamples(rotate) {
	const [a0, a1] = rotate.deg;
	const n = rotate.samples ?? 12;
	return Array.from({ length: n }, (_, i) => round6(a0 + ((a1 - a0) * i) / (n - 1)));
}

// What a part draws: [{ geom, variant }]. A plain part draws itself (variant null); a part with variants draws its base and each
// variant; a rotating part draws its turn samples only.
const drawMemo = new WeakMap();
export function drawEntries(part) {
	if (drawMemo.has(part)) return drawMemo.get(part);
	let out;
	if (part.rotate) out = turnSamples(part.rotate).map((deg, i) => ({ geom: rotatePart(part, deg), variant: `turn-${i}` }));
	else if (!part.variants) out = [{ geom: part, variant: null }];
	else {
		const { variants, ...base } = part;
		out = [{ geom: base, variant: "base" }, ...Object.entries(variants).map(([name, override]) => ({ geom: { ...base, ...override }, variant: name }))];
	}
	drawMemo.set(part, out);
	return out;
}

// The geometry a part shows in the rest pose (the scene's fit, supports, anchors and received shadows use it).
export function restGeometry(part, model) {
	const entries = drawEntries(part);
	if (entries.length === 1 || !model) return entries[0].geom;
	const view = viewIn(model, model.rest, part);
	return (entries.find(entry => entry.variant === view.variant) ?? entries[0]).geom;
}

export const hasVariants = part => Boolean(part.variants || part.rotate);

// --- validation ---------------------------------------------------------------------------------------------------------

// A part's variants and rotate (validatePart is schema.mjs's, passed in to avoid an import cycle).
export function validatePartStates(part, index, push, validatePart) {
	const at = `parts[${index}]`;
	if (part.variants !== undefined) {
		if (!part.variants || typeof part.variants !== "object" || Array.isArray(part.variants) || !Object.keys(part.variants).length) push(`${at}.variants must be an object of named geometry overrides`);
		else for (const [name, override] of Object.entries(part.variants)) {
			const where = `${at}.variants.${name}`;
			if (!VARIANT_NAME.test(name) || name === "base" || name.startsWith("turn-")) push(`${where}: a variant name matches ${VARIANT_NAME} and is not "base" or "turn-…"`);
			if (!override || typeof override !== "object" || Array.isArray(override)) {
				push(`${where} must be an object`);
				continue;
			}
			for (const key of NO_OVERRIDE) if (override[key] !== undefined) push(`${where}.${key} cannot be overridden`);
			const { variants, rotate, ...base } = part;
			validatePart({ ...base, ...override, id: part.id, kind: part.kind }, index, message => push(message.replace(at, where)));
		}
	}
	if (part.rotate !== undefined) {
		const r = part.rotate;
		const where = `${at}.rotate`;
		if (part.variants !== undefined) push(`${at}: use variants or rotate, not both`);
		if (!r || typeof r !== "object") return push(`${where} must be { axis, about?, deg: [a0, a1], samples? }`);
		const yawing = YAW_KINDS.includes(part.kind);
		if (!yawing && (!TURNABLE.has(part.kind) || (part.kind === "ring" && !part.thickness))) push(`${where}: a ${part.kind} cannot turn yet (use a cylinder, lathe, cone, torus, tube, rod, spring, catenary, wire, sphere, pin, prism or a box-like part)`);
		const axis = axisVector(r.axis ?? "z");
		if (!axis || !isVec(axis) || Math.hypot(...axis) < 1e-9) push(`${where}.axis must be x, y, z, -x, -y, -z or a non-zero [x, y, z]`);
		else if (yawing && (Math.abs(axis[0]) > 1e-9 || Math.abs(axis[1]) > 1e-9)) push(`${where}.axis: a ${part.kind} turns about a vertical axis only (z or -z; it turns through yaw)`);
		if (r.about !== undefined && !isVec(r.about)) push(`${where}.about must be [x, y, z]`);
		if (!(isVec(r.deg, 2) && r.deg[0] !== r.deg[1])) push(`${where}.deg must be [a0, a1] in degrees, a0 ≠ a1`);
		if (r.samples !== undefined && !(Number.isInteger(r.samples) && r.samples >= 2)) push(`${where}.samples must be an integer ≥ 2`);
	}
}

// interact for step and scrub; `parts` is the expanded part list.
export function validateStateInteract(interact, parts, push) {
	const byId = new Map(parts.map(part => [part?.id, part]));
	const states = interact.states;
	const inputs = STATE_INPUTS[interact.behavior];
	if (interact.input !== undefined && !inputs.includes(interact.input)) push(`interact.input ${JSON.stringify(interact.input)} must be one of ${inputs.join(", ")} for ${interact.behavior}`);
	if (interact.loop !== undefined && typeof interact.loop !== "boolean") push("interact.loop must be true or false");
	for (const key of ["lift", "explode"]) if (interact[key] !== undefined) push(`interact.${key} applies to ${key === "lift" ? "select" : "explode"}, not ${interact.behavior}`);
	if (!Array.isArray(states) || states.length < 2) return push(`interact.states must list at least two states for ${interact.behavior}`);
	const valueKeys = new Set();
	if (interact.values !== undefined) {
		if (!interact.values || typeof interact.values !== "object" || Array.isArray(interact.values)) push("interact.values must be an object of per-state number lists");
		else for (const [key, list] of Object.entries(interact.values)) {
			valueKeys.add(key);
			if (!/^[A-Za-z]\w{0,23}$/.test(key) || RESERVED.has(key)) push(`interact.values key "${key}" must be a short word other than name, n, count and t`);
			if (!(Array.isArray(list) && list.length === states.length && list.every(isNum))) push(`interact.values.${key} must list ${states.length} numbers, one per state`);
		}
	}
	const names = states.map(state => state?.name);
	for (const name of new Set(names.filter((name, i) => names.indexOf(name) !== i))) push(`interact.states name "${name}" is used more than once`);
	states.forEach((state, k) => {
		const at = `interact.states[${k}]`;
		if (!state || typeof state !== "object") return push(`${at} must be an object`);
		if (typeof state.name !== "string" || !state.name.trim() || state.name.length > 40) push(`${at}.name must be a non-empty string of ≤ 40 chars`);
		if (state.readout !== undefined && (typeof state.readout !== "string" || !state.readout.trim() || state.readout.length > 120)) push(`${at}.readout must be a non-empty string of ≤ 120 chars`);
		if (state.values !== undefined) {
			if (!state.values || typeof state.values !== "object" || Array.isArray(state.values)) push(`${at}.values must be an object of numbers`);
			else for (const [key, value] of Object.entries(state.values)) {
				valueKeys.add(key);
				if (!/^[A-Za-z]\w{0,23}$/.test(key) || RESERVED.has(key)) push(`${at}.values key "${key}" must be a short word other than name, n, count and t`);
				if (!isNum(value)) push(`${at}.values.${key} must be a number`);
			}
		}
		if (state.parts === undefined) return;
		if (!state.parts || typeof state.parts !== "object" || Array.isArray(state.parts)) return push(`${at}.parts must be an object keyed by part id`);
		for (const [id, spec] of Object.entries(state.parts)) {
			const where = `${at}.parts.${id}`;
			const part = byId.get(id);
			if (!part) {
				push(`${where} names no part`);
				continue;
			}
			if (!spec || typeof spec !== "object" || Array.isArray(spec)) {
				push(`${where} must be { variant?, hidden?, move?, turn? }`);
				continue;
			}
			for (const key of Object.keys(spec)) if (!SPEC_KEYS.has(key)) push(`${where}.${key} is not a state field (variant, hidden, move, turn)`);
			if (spec.hidden !== undefined && typeof spec.hidden !== "boolean") push(`${where}.hidden must be true or false`);
			if (spec.move !== undefined && !isVec(spec.move)) push(`${where}.move must be [x, y, z]`);
			if (spec.variant !== undefined && !(spec.variant === "base" || (part.variants && Object.hasOwn(part.variants, spec.variant)))) push(`${where}.variant ${JSON.stringify(spec.variant)} must be "base" or one of the part's variants${part.variants ? ` (${Object.keys(part.variants).join(", ")})` : " (it has none)"}`);
			if (spec.turn !== undefined) {
				if (!part.rotate) push(`${where}.turn needs part.rotate`);
				else if (!isNum(spec.turn) || !isVec(part.rotate.deg, 2) || spec.turn < Math.min(...part.rotate.deg) - 1e-9 || spec.turn > Math.max(...part.rotate.deg) + 1e-9) push(`${where}.turn must be degrees within rotate.deg`);
			}
		}
	});
	const rest = restIndexOf(interact);
	if (interact.rest !== undefined && rest < 0) push(`interact.rest must be a state index (0–${states.length - 1}) or a state name`);
	else if (rest >= 0) for (const [id, spec] of Object.entries(states[rest]?.parts ?? {})) {
		if (isVec(spec?.move) && spec.move.some(v => v !== 0)) push(`interact.states[${rest}].parts.${id}.move: the rest state is the brief's geometry (the static art); move the part in the brief and give the other states the difference`);
	}
	if (interact.readout !== undefined) {
		if (typeof interact.readout !== "string" || !interact.readout.trim() || interact.readout.length > 120) push("interact.readout must be a template string of ≤ 120 chars");
		else for (const [, key] of interact.readout.matchAll(PLACEHOLDER)) if (!RESERVED.has(key) && !valueKeys.has(key)) push(`interact.readout names {${key}}, which is not name, n, count, t or a values key`);
	}
}

// Variants, rotate and the step/scrub interact at brief level: variants and rotate need a step or scrub figure.
export function validateBriefStates(brief, parts, push) {
	const interact = brief.interact;
	const stateful = isStateBehavior(interact);
	if (!stateful) parts.forEach((part, index) => {
		if (part?.variants !== undefined || part?.rotate !== undefined) push(`parts[${index}].${part.variants !== undefined ? "variants" : "rotate"} needs interact.behavior "step" or "scrub"`);
	});
	if (interact && !stateful && interact.states !== undefined) push(`interact.states applies to step and scrub, not ${interact.behavior}`);
	if (stateful) validateStateInteract(interact, parts, push);
}

// --- the scene ------------------------------------------------------------------------------------------------------------

const decimalsOf = value => (String(value).split(".")[1] ?? "").length;

// The state model before projection: per state, each unit's world move, hidden flag, variant and turn; values and texts.
export function stateModelOf(brief) {
	const interact = brief.interact;
	if (!isStateBehavior(interact)) return null;
	const n = interact.states.length;
	const rest = restIndexOf(interact);
	const byId = new Map(brief.parts.map(part => [part.id, part]));
	const turning = brief.parts.filter(part => part.rotate);
	const states = interact.states.map((state, k) => {
		const values = {};
		for (const [key, list] of Object.entries(interact.values ?? {})) values[key] = list[k];
		Object.assign(values, state.values ?? {});
		const moves = new Map();
		const views = new Map();
		for (const [id, spec] of Object.entries(state.parts ?? {})) {
			if (spec.move && spec.move.some(v => v !== 0)) moves.set(id, spec.move);
			views.set(id, { hidden: Boolean(spec.hidden), variant: spec.variant ?? null });
		}
		const turns = new Map(turning.map(part => {
			const [a0, a1] = part.rotate.deg;
			return [part.id, state.parts?.[part.id]?.turn ?? round6(a0 + ((a1 - a0) * k) / (n - 1))];
		}));
		return { name: state.name, readout: state.readout ?? null, values, moves, views, turns };
	});
	const d = {};
	for (const state of states) for (const [key, value] of Object.entries(state.values)) d[key] = Math.max(d[key] ?? 0, decimalsOf(value));
	return { behavior: interact.behavior, input: interact.input ?? (interact.behavior === "step" ? "click" : "drag"), loop: interact.loop, rest, states, template: interact.readout ?? null, d, byId };
}

// The variant a unit shows in state k (null for a plain part; "turn-<i>" for a rotating part), and whether it is hidden.
export function viewIn(model, k, part) {
	const state = model.states[k];
	const spec = state.views.get(part.id) ?? { hidden: false, variant: null };
	if (part.rotate) {
		return { hidden: spec.hidden, variant: `turn-${nearestSample(turnSamples(part.rotate), state.turns.get(part.id))}` };
	}
	return { hidden: spec.hidden, variant: part.variants ? spec.variant ?? "base" : null };
}

// Whether a piece shows in state k.
export const pieceShows = (model, k, piece, part) => {
	const view = viewIn(model, k, part);
	return !view.hidden && (piece.variant === null || piece.variant === undefined || piece.variant === view.variant);
};

// Every world point a state can move a part's corners to (the camera fit covers every state).
export function statePoses(model, part, corners) {
	if (!model) return [];
	const out = [];
	for (const state of model.states) {
		const m = state.moves.get(part.id);
		if (m) out.push(...corners.map(([x, y, z]) => [x + m[0], y + m[1], z + m[2]]));
	}
	return out;
}

// The painter order of a pose: piece indices, back to front. `moves` maps a unit to its world move, `shows(piece, part)` says
// whether a piece shows; hidden pieces keep their rest key and order nothing.
function poseOrder(scene, { moves, shows }, { byId, screen, P }) {
	const items = scene.pieces.map((piece, index) => {
		const part = byId.get(piece.partId);
		const m = moves.get(part.id);
		const on = shows(piece, part);
		const [sx, sy] = m ? screen(m) : [0, 0];
		return {
			index,
			id: piece.id,
			partId: piece.partId,
			chunk: piece.chunk,
			chunks: piece.chunks,
			loop: piece.loop,
			z: piece.z + (m ? m[2] : 0),
			depth: m ? depthOf([piece.depthPoint[0] + m[0], piece.depthPoint[1] + m[1], piece.depthPoint[2] + m[2]], P) : piece.baseDepth,
			hit: m ? piece.hit.map(([x, y]) => [x + sx, y + sy]) : piece.hit,
			shapes: on ? (m ? (piece.allShapes ?? []).map(shape => A.moved(shape, m)) : piece.allShapes ?? []) : [],
		};
	});
	const byOld = (a, b) => a.depth - b.depth || a.z - b.z || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
	items.sort(byOld);
	const keys = painterKeys(items, P).keys;
	items.forEach((item, i) => (item.depth = keys[i]));
	items.sort(byOld);
	return items.map(item => item.index);
}

// The painter order of state k.
export function stateOrder(scene, k, ctx) {
	const model = scene.stateModel;
	return poseOrder(scene, { moves: model.states[k].moves, shows: (piece, part) => pieceShows(model, k, piece, part) }, ctx);
}

const nearestSample = (samples, r) => {
	let best = 0;
	samples.forEach((deg, i) => {
		if (Math.abs(deg - r) < Math.abs(samples[best] - r) - 1e-9) best = i;
	});
	return best;
};

// Where a scrub segment's order can change, as fractions 0–1 of the segment from state a to a + 1: the midpoint (the discrete
// parts switch there), every point where a rotating unit's nearest turn sample switches, and eighth steps so a part moving
// past another is reordered on the way.
export function segmentBreaks(model, a) {
	const out = new Set([0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875]);
	const [A0, B0] = [model.states[a], model.states[a + 1]];
	for (const [id, ra] of A0.turns) {
		const rb = B0.turns.get(id);
		if (rb === ra) continue;
		const samples = turnSamples(model.byId.get(id).rotate);
		for (let j = 0; j + 1 < samples.length; j++) {
			const f = ((samples[j] + samples[j + 1]) / 2 - ra) / (rb - ra);
			if (f > 1e-6 && f < 1 - 1e-6) out.add(round6(f));
		}
	}
	return [...out].sort((x, y) => x - y);
}

// The painter orders across the scrub segment from state a to a + 1: [[f, order], …], each from its fraction f up to the next
// entry's (computed at the middle of the interval: interpolated moves and turns, the nearer state's hidden parts and variants).
// Consecutive equal orders are merged; the runtime uses the states' own orders exactly on a state.
export function segmentOrders(scene, a, ctx) {
	const model = scene.stateModel;
	const [A0, B0] = [model.states[a], model.states[a + 1]];
	const breaks = segmentBreaks(model, a);
	const out = [];
	breaks.forEach((f0, i) => {
		const f = (f0 + (breaks[i + 1] ?? 1)) / 2;
		const near = f < 0.5 ? a : a + 1;
		const moves = new Map();
		for (const id of new Set([...A0.moves.keys(), ...B0.moves.keys()])) {
			const p = A0.moves.get(id) ?? [0, 0, 0];
			const q = B0.moves.get(id) ?? [0, 0, 0];
			moves.set(id, p.map((v, k) => v + (q[k] - v) * f));
		}
		const shows = (piece, part) => {
			const view = viewIn(model, near, part);
			if (view.hidden) return false;
			if (piece.variant === null || piece.variant === undefined) return true;
			if (!part.rotate) return piece.variant === view.variant;
			const r = A0.turns.get(part.id) + (B0.turns.get(part.id) - A0.turns.get(part.id)) * f;
			return piece.variant === `turn-${nearestSample(turnSamples(part.rotate), r)}`;
		};
		const o = poseOrder(scene, { moves, shows }, ctx).join(" ");
		if (!out.length || out[out.length - 1][1] !== o) out.push([f0, o]);
	});
	return out;
}

// The stage's state model (data-vpk-iso-states): see state-runtime.mjs for the shape.
export function stateConfig(scene, { byId, screen, shadowScreen, P }) {
	const model = scene.stateModel;
	const units = [...new Set(scene.pieces.map(piece => piece.partId))];
	const turns = {};
	for (const id of units) if (byId.get(id).rotate) turns[id] = turnSamples(byId.get(id).rotate);
	const cfg = { rest: model.rest, input: model.input, states: [] };
	if (model.loop === false) cfg.loop = false;
	if (model.template) cfg.template = model.template;
	if (Object.keys(model.d).length) cfg.d = model.d;
	if (Object.keys(turns).length) cfg.turns = turns;
	model.states.forEach((state, k) => {
		const out = { name: state.name };
		if (state.readout) out.readout = state.readout;
		if (Object.keys(state.values).length) out.values = state.values;
		const m = {};
		for (const [id, move] of state.moves) m[id] = [...screen(move), ...shadowScreen(move)];
		if (Object.keys(m).length) out.m = m;
		const p = {};
		for (const id of units) {
			const part = byId.get(id);
			const view = viewIn(model, k, part);
			const spec = {};
			if (view.hidden) spec.h = 1;
			if (part.variants && view.variant !== "base") spec.v = view.variant;
			if (part.rotate) spec.r = state.turns.get(id);
			if (Object.keys(spec).length) p[id] = spec;
		}
		if (Object.keys(p).length) out.p = p;
		out.o = k === model.rest ? scene.pieces.map((_, index) => index).join(" ") : stateOrder(scene, k, { byId, screen, P }).join(" ");
		// Scrub passes through the poses between states: their orders, per segment (state-runtime.mjs orderOf).
		if (model.behavior === "scrub" && k + 1 < model.states.length) out.s = segmentOrders(scene, k, { byId, screen, P });
		cfg.states.push(out);
	});
	cfg.states.forEach((state, k) => (state.text = stateText(cfg, k)));
	return cfg;
}

// The 2-D screen point of a world point (used by tests and the fit).
export const screenOf = (point, P) => iso(point, P);
export { isLegacy };
