// iso/expand — repeat, instances and vary (plan § 2 A). expandBrief(brief) runs before the brief's counts are validated and
// returns a brief whose parts are plain parts, one per instance, with ids `${id}-${k}`:
//   "repeat": { "linear": { "count": 16, "step": [6, 0, 0] } }
//   "repeat": { "grid": { "count": [13, 13], "step": [3, 3] } }                       (or 3-D: count [nx, ny, nz], step [sx, sy, sz])
//   "repeat": { "polar": { "count": 30, "centre": [x, y], "radius": 20, "from": 0, "span": 300, "face": true } }
//   "vary": { "field": "size.2", "values": [...] } | { "field": "length", "fn": "gauss", "sigma": 4, "floor": 1 } | { "size": [[...], ...] }
//   "instances": [{ "at": [...], "tone": "ink" }, ...]                                 (each merged over the base part)
// A polar instance moves the part's anchor (at, else from, else points[0]) onto the circle; with face: true it also turns the
// part about its anchor towards the angle (turned and tube kinds by their axis; boxes, slabs, plates and prisms by yaw). References
// to a base id expand: focal lists and assemble layers name every instance, and labels, marks, arrows and clipTo name the first.

import { YAW_KINDS, yawPart } from "./geometry.mjs";

const isNum = value => typeof value === "number" && Number.isFinite(value);
const isVec = (value, n = 3) => Array.isArray(value) && value.length === n && value.every(isNum);
const RAD = Math.PI / 180;
const ROTATABLE = new Set(["lathe", "cone", "torus", "tube", "rod", "leg", "spring", "catenary", "wire", "sphere", "pin", "cylinder", ...YAW_KINDS]);
const VARY_KEYS = new Set(["field", "values", "fn", "sigma", "floor"]);
const BASE_KEYS = ["repeat", "vary", "instances"];

export const hasExpansion = part => BASE_KEYS.some(key => part && part[key] !== undefined);

// The instance count of one part's repeat or instances (0 when it has neither); errors go to push.
function countOf(part, at, push, max) {
	if (part.instances !== undefined) {
		if (part.repeat !== undefined) push(`${at}: use repeat or instances, not both`);
		if (!Array.isArray(part.instances) || part.instances.length < 1 || part.instances.length > max) push(Number.isFinite(max) ? `${at}.instances must be a list of 1–${max} overrides` : `${at}.instances must be a non-empty list of overrides`);
		else part.instances.forEach((item, k) => {
			if (!item || typeof item !== "object" || Array.isArray(item)) push(`${at}.instances[${k}] must be an object`);
			else for (const key of ["id", "kind", ...BASE_KEYS]) if (item[key] !== undefined) push(`${at}.instances[${k}].${key} cannot be overridden`);
		});
		return Array.isArray(part.instances) ? part.instances.length : 0;
	}
	const repeat = part.repeat;
	if (repeat === undefined) return 0;
	const kinds = repeat && typeof repeat === "object" ? Object.keys(repeat) : [];
	if (kinds.length !== 1 || !["linear", "grid", "polar"].includes(kinds[0])) {
		push(`${at}.repeat must hold exactly one of linear, grid or polar`);
		return 0;
	}
	const spec = repeat[kinds[0]] ?? {};
	const integer = value => Number.isInteger(value) && value >= 1;
	if (kinds[0] === "linear") {
		if (!integer(spec.count) || !isVec(spec.step)) push(`${at}.repeat.linear needs an integer count ≥ 1 and step [x, y, z]`);
		return integer(spec.count) ? spec.count : 0;
	}
	if (kinds[0] === "grid") {
		const n = Array.isArray(spec.count) ? spec.count.length : 0;
		if (!(n === 2 || n === 3) || !spec.count.every(integer) || !isVec(spec.step, n)) {
			push(`${at}.repeat.grid needs count [nx, ny] (or [nx, ny, nz]) of integers ≥ 1 and a step of the same length`);
			return 0;
		}
		return spec.count.reduce((a, b) => a * b, 1);
	}
	if (!integer(spec.count) || !isVec(spec.centre, 2) || !(isNum(spec.radius) && spec.radius >= 0)) push(`${at}.repeat.polar needs an integer count ≥ 1, centre [x, y] and radius ≥ 0`);
	if (spec.from !== undefined && !isNum(spec.from)) push(`${at}.repeat.polar.from must be degrees`);
	if (spec.span !== undefined && !(isNum(spec.span) && spec.span > 0 && spec.span <= 360)) push(`${at}.repeat.polar.span must be degrees within (0, 360]`);
	if (spec.face !== undefined && typeof spec.face !== "boolean") push(`${at}.repeat.polar.face must be true or false`);
	if (spec.face && !ROTATABLE.has(part.kind)) push(`${at}.repeat.polar.face turns the part, which a ${part.kind} cannot do yet (use a box-like part, a prism, a lathe, tube, rod, pin or other turned kind, or face: false)`);
	return integer(spec.count) ? spec.count : 0;
}

const varyList = vary => (Array.isArray(vary) ? vary : [vary]).map(entry => {
	if (!entry || typeof entry !== "object") return entry;
	if (entry.field !== undefined) return entry;
	const keys = Object.keys(entry).filter(key => !VARY_KEYS.has(key));
	return keys.length === 1 ? { field: keys[0], values: entry[keys[0]] } : entry;
});

// Structural checks on every part's repeat, instances and vary (run before expansion). Returns the instance total.
export function validateExpansion(parts, push, max) {
	let total = 0;
	parts.forEach((part, index) => {
		if (!part || typeof part !== "object") return void (total += 1);
		const at = `parts[${index}]`;
		const count = countOf(part, at, push, max);
		if (part.vary !== undefined) {
			if (!count) push(`${at}.vary needs a repeat or instances`);
			for (const [k, entry] of varyList(part.vary).entries()) {
				const where = `${at}.vary${Array.isArray(part.vary) ? `[${k}]` : ""}`;
				if (!entry || typeof entry.field !== "string" || !/^[a-zA-Z]+(\.\d+)?$/.test(entry.field)) push(`${where}.field must name a part field, optionally with an index (for example "size.2" or "length")`);
				else if (entry.fn !== undefined) {
					if (entry.fn !== "gauss" || !(isNum(entry.sigma) && entry.sigma > 0)) push(`${where}: fn must be "gauss" with sigma > 0`);
					if (entry.floor !== undefined && !isNum(entry.floor)) push(`${where}.floor must be a number`);
				} else if (!Array.isArray(entry.values) || entry.values.length !== count) push(`${where}.values must list ${count} values, one per instance`);
			}
		}
		total += count || 1;
	});
	return total;
}

const add = (a, b) => a.map((value, i) => value + (b[i] ?? 0));
const turn = ([x, y, ...rest], [cx, cy], angle) => {
	const c = Math.cos(angle);
	const s = Math.sin(angle);
	return [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c, ...rest];
};
const AXIS = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1], "-x": [-1, 0, 0], "-y": [0, -1, 0], "-z": [0, 0, -1] };

export const anchorOf = part => part.at ?? part.from ?? part.points?.[0] ?? [0, 0, 0];

function translated(part, t) {
	const out = { ...part };
	for (const key of ["at", "from", "to"]) if (isVec(out[key])) out[key] = add(out[key], t);
	if (Array.isArray(out.points)) out.points = out.points.map(point => add(point, t));
	return out;
}

function rotated(part, anchor, angle) {
	if (!angle) return part;
	// Boxes, slabs, plates and prisms turn through yaw (geometry.mjs yawPart), baked into at and yaw.
	if (YAW_KINDS.includes(part.kind)) return yawPart(part, anchor, angle / RAD);
	const out = { ...part };
	for (const key of ["at", "from", "to"]) if (isVec(out[key])) out[key] = turn(out[key], anchor, angle);
	if (Array.isArray(out.points)) out.points = out.points.map(point => turn(point, anchor, angle));
	for (const key of ["axis", "up"]) {
		if (out[key] === undefined) continue;
		const v = Array.isArray(out[key]) ? out[key] : AXIS[out[key]];
		if (!v || (Math.abs(v[0]) < 1e-9 && Math.abs(v[1]) < 1e-9)) continue;
		out[key] = turn(v, [0, 0], angle).map(c => Math.round(c * 1e9) / 1e9);
	}
	return out;
}

function setField(part, field, value) {
	const [key, index] = field.split(".");
	if (index === undefined) return { ...part, [key]: value };
	const list = Array.isArray(part[key]) ? part[key].slice() : [];
	list[Number(index)] = value;
	return { ...part, [key]: list };
}
const getField = (part, field) => {
	const [key, index] = field.split(".");
	return index === undefined ? part[key] : part[key]?.[Number(index)];
};

// The instances of one part: [{ part, coords }] where coords are the instance's grid index (for gauss).
function instancesOf(part) {
	const { repeat, instances, vary, ...base } = part;
	if (instances) return instances.map((override, k) => ({ part: { ...base, ...override }, coords: [k], dims: [instances.length] }));
	const [kind] = Object.keys(repeat);
	const spec = repeat[kind];
	if (kind === "linear") return Array.from({ length: spec.count }, (_, k) => ({ part: translated(base, spec.step.map(v => v * k)), coords: [k], dims: [spec.count] }));
	if (kind === "grid") {
		const [nx, ny, nz = 1] = spec.count;
		const out = [];
		for (let iz = 0; iz < nz; iz++) for (let iy = 0; iy < ny; iy++) for (let ix = 0; ix < nx; ix++) {
			out.push({ part: translated(base, [ix * spec.step[0], iy * spec.step[1], iz * (spec.step[2] ?? 0)]), coords: spec.count.length === 3 ? [ix, iy, iz] : [ix, iy], dims: spec.count });
		}
		return out;
	}
	const span = (spec.span ?? 360) * RAD;
	const closed = Math.abs(span - Math.PI * 2) < 1e-9;
	const anchor = anchorOf(base);
	return Array.from({ length: spec.count }, (_, k) => {
		const angle = (spec.from ?? 0) * RAD + (spec.count === 1 ? 0 : (k / (closed ? spec.count : spec.count - 1)) * span);
		const target = [spec.centre[0] + spec.radius * Math.cos(angle), spec.centre[1] + spec.radius * Math.sin(angle)];
		const moved = translated(base, [target[0] - anchor[0], target[1] - anchor[1], 0]);
		return { part: spec.face ? rotated(moved, target, angle) : moved, coords: [k], dims: [spec.count] };
	});
}

function applyVary(list, vary, base) {
	for (const entry of varyList(vary)) {
		list.forEach((item, k) => {
			let value;
			if (entry.fn === "gauss") {
				const d2 = item.coords.reduce((sum, c, i) => sum + (c - (item.dims[i] - 1) / 2) ** 2, 0);
				const start = getField(base, entry.field);
				const floor = entry.floor ?? 0;
				value = Math.round((floor + (start - floor) * Math.exp(-d2 / (2 * entry.sigma ** 2))) * 1000) / 1000;
			} else value = entry.values[k];
			item.part = setField(item.part, entry.field, value);
		});
	}
}

// The brief with every repeat, instances and vary expanded and base-id references rewritten. Validate first
// (validateExpansion); this assumes the shapes are well formed.
export function expandBrief(brief) {
	const parts = Array.isArray(brief?.parts) ? brief.parts : [];
	if (!parts.some(hasExpansion)) return brief;
	const groups = new Map();
	const flat = [];
	for (const part of parts) {
		if (!hasExpansion(part)) {
			flat.push(part);
			continue;
		}
		const list = instancesOf(part);
		if (part.vary !== undefined) applyVary(list, part.vary, part);
		const ids = list.map((item, k) => `${part.id}-${k}`);
		groups.set(part.id, ids);
		list.forEach((item, k) => flat.push({ ...item.part, id: ids[k] }));
	}
	const all = id => groups.get(id) ?? [id];
	const first = id => (groups.has(id) ? groups.get(id)[0] : id);
	const out = { ...brief, parts: flat.map(part => (part.clipTo !== undefined ? { ...part, clipTo: first(part.clipTo) } : part)) };
	if (typeof brief.focal === "string" && groups.has(brief.focal)) out.focal = all(brief.focal);
	else if (Array.isArray(brief.focal)) out.focal = brief.focal.flatMap(all);
	if (brief.assemble?.layers) out.assemble = { ...brief.assemble, layers: brief.assemble.layers.map(layer => (Array.isArray(layer) ? layer.flatMap(all) : layer)) };
	if (Array.isArray(brief.labels)) out.labels = brief.labels.map(label => (label && groups.has(label.target) ? { ...label, target: first(label.target) } : label));
	if (Array.isArray(brief.marks)) out.marks = brief.marks.map(mark => (mark && groups.has(mark.target) ? { ...mark, target: first(mark.target) } : mark));
	if (Array.isArray(brief.annotations)) out.annotations = brief.annotations.map(note => (note && groups.has(note.of) ? { ...note, of: first(note.of) } : note));
	return out;
}
