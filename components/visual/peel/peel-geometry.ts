/**
 * Peel — pointer/sheet geometry.
 *
 * Split out of `peel-scene.tsx` so that file exports nothing but its component:
 * mixing non-component exports into a component module stops Fast Refresh
 * preserving state across edits, and this is the only shared geometry the
 * wrapper and the scene both need.
 */

/** Raw pointer sample, written by the DOM handlers and read once per frame. */
export interface PeelPointerSample {
	clientX: number;
	clientY: number;
	/** False when the pointer has never been over the sheet. */
	valid: boolean;
}

/** The sheet's unrotated CSS size and its resting angle, in radians. */
export interface PeelBox {
	width: number;
	height: number;
	rotation: number;
}

/**
 * Maps client coordinates to sheet UV, shared by hover and grab so both derive
 * the same point.
 *
 * The element may be rotated, and `getBoundingClientRect` reports the
 * axis-aligned box of a rotated element — wider and shorter than the sheet
 * really is. Its *centre*, though, is still the sheet's centre, so the offset
 * from that centre can simply be rotated back into the sheet's own frame and
 * divided by the known CSS size. That keeps this exact at any angle and costs
 * no extra layout reads.
 *
 * `swing` is the live in-plane lean, on top of the resting angle. It has to be
 * included or the sheen anchor drifts while the sheet is leaning. In practice
 * it is 0 at both call sites today — `readPointer` bails while the sheet is
 * held, and a resting sheet has no swing — but keeping the two rotations
 * derived from one total is what stops them diverging.
 */
export function resolvePeelUv(
	element: HTMLElement,
	box: PeelBox,
	clientX: number,
	clientY: number,
	swing = 0,
): { u: number; v: number } {
	if (box.width === 0 || box.height === 0) {
		return { u: 0.5, v: 0.5 };
	}

	const rect = element.getBoundingClientRect();
	const dx = clientX - (rect.left + rect.width / 2);
	const dy = clientY - (rect.top + rect.height / 2);

	const angle = box.rotation + swing;
	const cos = Math.cos(-angle);
	const sin = Math.sin(-angle);
	const localX = dx * cos - dy * sin;
	const localY = dx * sin + dy * cos;

	return {
		u: localX / box.width + 0.5,
		// Plane UV runs bottom-up; client coordinates run top-down.
		v: 0.5 - localY / box.height,
	};
}
