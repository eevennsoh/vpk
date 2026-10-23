/*
 * runtime/define — the marked-runtime step factory. Imports only ./blocks.mjs, so an
 * adapter can define its step without importing the registry (no ESM cycle).
 *
 * apply(html) runs, in order:
 *   1. normalize?.(html)
 *   2. strip each `legacy` match (old unmarked blocks) unless it sits inside any vpk- or vpkh- marked block
 *   3. appliesTo(html) ? upsert the block in place (or before the last </body>) : remove it
 * build() returns the complete block, markers included; budgetBytes bounds its UTF-8 size.
 */

import { markedRanges, markerPair, removeMarkedBlock, upsertMarkedBlock } from "./blocks.mjs";

function insideRanges(index, ranges) {
	return ranges.some(([start, end]) => index >= start && index < end);
}

function stripLegacy(html, legacy) {
	if (!legacy) return html;
	const ranges = markedRanges(html);
	const pattern = new RegExp(legacy.source, legacy.flags.includes("g") ? legacy.flags : `${legacy.flags}g`);
	return html.replace(pattern, (...args) => {
		const match = args[0];
		const offset = args.find((value, position) => position > 0 && typeof value === "number");
		return insideRanges(offset, ranges) ? match : "";
	});
}

export function defineMarkedRuntime({ id, kinds, appliesTo, build, normalize, legacy, budgetBytes }) {
	if (!/^[a-z][a-z0-9-]*$/.test(id ?? "")) throw new Error(`defineMarkedRuntime: invalid id ${JSON.stringify(id)}`);
	if (!Array.isArray(kinds) || kinds.length === 0) throw new Error(`defineMarkedRuntime(${id}): kinds must be a non-empty array`);
	if (typeof appliesTo !== "function" || typeof build !== "function") throw new Error(`defineMarkedRuntime(${id}): appliesTo and build must be functions`);
	if (!Number.isInteger(budgetBytes) || budgetBytes <= 0) throw new Error(`defineMarkedRuntime(${id}): budgetBytes must be a positive integer`);
	const { start, end } = markerPair(id);
	let built = null;
	const block = () => (built ??= build());
	return Object.freeze({
		id,
		kinds: Object.freeze([...kinds]),
		budgetBytes,
		markers: Object.freeze({ start, end }),
		build,
		apply(html) {
			let out = normalize ? normalize(html) : html;
			out = stripLegacy(out, legacy);
			return appliesTo(out) ? upsertMarkedBlock(out, { start, end, block: block() }) : removeMarkedBlock(out, start, end);
		},
	});
}
