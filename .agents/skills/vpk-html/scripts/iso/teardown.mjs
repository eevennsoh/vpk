// iso/teardown — the teardown behaviour's geometry (illustrations.md § Teardown; after the MIT `teardown` skill,
// github.com/jakubkrehel/skills, Copyright (c) 2026 Jakub Krehel: one model, an assembled view and an exploded view along the
// assembly paths, parts named on hover). A brief is written ASSEMBLED, every part in its real place. Each part's travel is its
// own `explode` vector or, when it has none, the travel of the part it rests on (screws ride their board, keys their deck), or
// else its assembly layer times `interact.teardown.gap` straight up. explodedBrief moves every part by its travel, so the
// static art is the exploded drawing (spread 1) and the Spread slider at 0 puts every part back exactly where the brief says.

import { boundsOf, contains, planCentre } from "./geometry.mjs";
import { castsShadow, supportZs } from "./solids.mjs";

export const TEARDOWN_GAP = 18;
const isVec = value => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

export const isTeardown = brief => brief?.interact?.behavior === "teardown";

// Travel per part id, from the assembled brief.
export function teardownTravel(brief) {
	const gap = brief.interact?.teardown?.gap ?? TEARDOWN_GAP;
	const layers = new Map();
	(brief.assemble?.layers ?? []).forEach((layer, index) => layer.forEach(id => layers.set(id, index)));
	// Without assemble.layers a part's layer is the rank of its bottom height among the distinct heights of the parts that take
	// layer travel (no explode vector of their own): parts at one height (a row of keys, a grid of chips) share a layer and lift
	// together, not one gap apart each.
	const heights = [...new Set(brief.parts.filter(part => !isVec(part.explode)).map(part => Math.round(boundsOf(part).bottom * 1e6) / 1e6))].sort((a, b) => a - b);
	const zRank = new Map(brief.parts.map(part => [part.id, Math.max(0, heights.indexOf(Math.round(boundsOf(part).bottom * 1e6) / 1e6))]));
	const restsOn = part => brief.parts.find(other => other !== part && supportZs(other).some(z => Math.abs(z - boundsOf(part).bottom) < 1e-6) && contains(other, planCentre(part)));
	const travel = new Map();
	const layerOf = part => layers.get(part.id) ?? zRank.get(part.id);
	// A part rides the part it rests on only when both are in the same assembly layer (a key on its deck, a chip on its board);
	// a part in a later layer lifts off its support by its own layer's travel, so the stack opens.
	const of = (part, seen = new Set()) => {
		if (isVec(part.explode)) return part.explode;
		if (travel.has(part.id)) return travel.get(part.id);
		const below = castsShadow(part) && !seen.has(part.id) ? restsOn(part) : null;
		const support = below && layerOf(below) === layerOf(part) ? below : null;
		const vector = support && !seen.has(support.id) ? of(support, seen.add(part.id)) : [0, 0, layerOf(part) * gap];
		travel.set(part.id, vector);
		return vector;
	};
	for (const part of brief.parts) travel.set(part.id, of(part));
	return travel;
}

function moved(part, t) {
	const out = { ...part, explode: t };
	for (const key of ["at", "from", "to"]) if (isVec(out[key])) out[key] = add(out[key], t);
	if (Array.isArray(out.points)) out.points = out.points.map(point => add(point, t));
	return out;
}

// The assembled brief as drawn for the assembled painter order: no entry assembly (the teardown is the motion).
export function assembledBrief(brief) {
	if (!isTeardown(brief)) return brief;
	const { assemble, ...rest } = brief;
	return rest;
}

// The exploded brief: every part moved by its travel and carrying it as its explode vector. Label anchors and mark points ride
// their target, so an author writes them on the assembled object too; free annotations, dims and the scale stay where written.
// `assemble.layers` only feeds the travel: a teardown has no entry drop (the Exploded / Assembled switch is its motion), and one
// painter group lets the runtime reorder every part for the assembled pose.
export function explodedBrief(brief) {
	if (!isTeardown(brief)) return brief;
	const travel = teardownTravel(brief);
	const ride = (target, point) => (isVec(point) && travel.has(target) ? add(point, travel.get(target)) : point);
	const out = { ...assembledBrief(brief), parts: brief.parts.map(part => moved(part, travel.get(part.id))) };
	if (Array.isArray(brief.labels)) out.labels = brief.labels.map(label => (label?.anchor ? { ...label, anchor: ride(label.target, label.anchor) } : label));
	if (Array.isArray(brief.marks)) out.marks = brief.marks.map(mark => (mark?.at ? { ...mark, at: ride(mark.target, mark.at) } : mark));
	return out;
}
