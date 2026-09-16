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

function smoothstep(value: number): number {
	const t = Math.max(0, Math.min(1, value));
	return t * t * (3 - 2 * t);
}

/**
 * Sweep a cylindrical fold from the grabbed corner to the opposite corner.
 * Adapted from jaksenc.com/about's photo-stamp scene: travel ends at 78%,
 * then the curl relaxes and the detached sheet rises. Arc length is preserved
 * through both the curved section and its tangent flap. UVs never change.
 * All distances are in sheet-heights; buffers are reused on every frame.
 */
export function deformPeelSheet(
	original: Float32Array,
	positions: Float32Array,
	normals: Float32Array,
	aspect: number,
	progress: number,
	angle: number,
	curlAngle: number,
	liftHeight: number,
): void {
	const dx = Math.cos(angle);
	const dy = Math.sin(angle);
	const span = Math.abs(dx) * aspect + Math.abs(dy);
	const crease = span * (0.5 - smoothstep(progress / 0.78));
	const relaxation = 1 - smoothstep((progress - 0.78) / 0.22);
	const lift = liftHeight * smoothstep((progress - 0.78) / 0.16);
	const radius = span * 0.22;
	const bendLimit = radius * Math.max(0, Math.min(curlAngle, Math.PI / 2));

	for (let i = 0; i < original.length; i += 3) {
		const x = original[i];
		const y = original[i + 1];
		const travel = Math.max(0, x * dx + y * dy - crease);
		const curved = Math.min(travel, bendLimit);
		const flap = travel - curved;
		const turn = (curved / radius) * relaxation;
		const sin = Math.sin(turn);
		const cos = Math.cos(turn);
		const arcRadius = radius / Math.max(relaxation, 1e-6);
		const projected = relaxation < 1e-6 ? travel : arcRadius * sin + flap * cos;
		const height = relaxation < 1e-6 ? 0 : arcRadius * (1 - cos) + flap * sin;
		const gather = projected - travel;

		positions[i] = x + dx * gather;
		positions[i + 1] = y + dy * gather + lift * 0.5;
		positions[i + 2] = height + lift;
		normals[i] = -dx * sin;
		normals[i + 1] = -dy * sin;
		normals[i + 2] = cos;
	}
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
