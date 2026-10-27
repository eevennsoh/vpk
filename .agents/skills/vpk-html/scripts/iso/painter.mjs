// iso/painter — painter order from the vendored signed-distance depth audit (plan § 2, cross-cutting: painter order). The old
// order sorted pieces by one depth point each, which mis-orders long, curved and offset solids (a horizontal shaft between two
// posts, a tube passing behind and in front, a long card beside a small box: the "z-index issue with some cards"). Each piece
// carries the vendored shapes of its solids (vendor/kit/audit.mjs box, body, prism, tube, ball); overlapsOf rasterises every
// pair whose screen hulls overlap and finds which one is in front, and orderKeys moves the depth keys the least so every such
// pair is ordered. Pairs that never overlap keep the old key, so a scene of separate parts sorts as before. The kit is imported,
// never edited (MIT © 2026 Ryan, scripts/anatomy/vendor/LICENSE).

import { orderKeys, overlapsOf } from "../anatomy/vendor/kit/audit.mjs";
import { convexOverlap } from "./core.mjs";

// Raster step in viewBox units, depth tolerance in world units, least front region in square viewBox units.
export const PAINTER = Object.freeze({ step: 1, tolerance: 0.3, least: 1.5 });

// Pieces of one part are ordered by their builder (a tray's back before its front, a pin's rod before its head), except tube
// chunks, which are ordered among themselves unless they are neighbours along the tube (they share a joint), and an open tray's
// walls and dividers (separate boxes that only touch), which the audit orders like any other pieces: otherwise, once contents
// move some divider keys and not others, a shelf and the divider in front of it tie and sort by id (tray.mjs).
function sameRun(a, b) {
	if (a.partId !== b.partId) return false;
	if (a.kind === "tray" && b.kind === "tray" && a.of && b.of) return false;
	if (a.chunk === undefined || b.chunk === undefined) return true;
	const gap = Math.abs(a.chunk - b.chunk);
	return gap <= 1 || (a.loop && gap === a.chunks - 1);
}

// Depth keys for `pieces` (each with depth, hit, shapes, partId), and the cycles orderKeys had to break. The keys stay in depth
// units (the old key, moved by at least `gap` past what each piece must cover), so the runtime's lift re-sort still mixes them
// with lift heights.
export function painterKeys(pieces, P) {
	const items = pieces.map(piece => ({ name: piece.id, key: piece.depth, shapes: piece.shapes ?? [], piece }));
	if (items.filter(item => item.shapes.length).length < 2) return { keys: items.map(item => item.key), cycles: [] };
	const skip = (a, b) => sameRun(a.piece, b.piece) || !(a.piece.hit.length >= 3 && b.piece.hit.length >= 3 && convexOverlap(a.piece.hit, b.piece.hit));
	const overlaps = overlapsOf(items, P, { step: PAINTER.step, tolerance: PAINTER.tolerance, least: PAINTER.least, skip });
	const solved = orderKeys(items, overlaps);
	return { keys: solved.keys, cycles: solved.cycles.map(pair => [items[pair.a].name, items[pair.b].name]) };
}
