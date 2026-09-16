export type MagneticPointerRelation = "outside" | "near" | "target";

interface MagneticPointerPoint {
	x: number;
	y: number;
}

interface MagneticTargetRect {
	bottom: number;
	left: number;
	right: number;
	top: number;
}

/** Keep the approach halo from amplifying the target's peak magnetic distance. */
export function resolveMagneticAxisOffset(delta: number, halfSize: number, distance: number): number {
	return halfSize > 0 ? Math.max(-1, Math.min(1, delta / halfSize)) * distance : 0;
}

export function resolveMagneticPointerRelation(
	pointer: Readonly<MagneticPointerPoint>,
	rect: Readonly<MagneticTargetRect>,
	hoverArea: number,
): MagneticPointerRelation {
	const withinTarget = pointer.x >= rect.left
		&& pointer.x <= rect.right
		&& pointer.y >= rect.top
		&& pointer.y <= rect.bottom;
	if (withinTarget) return "target";

	const withinProximity = pointer.x >= rect.left - hoverArea
		&& pointer.x <= rect.right + hoverArea
		&& pointer.y >= rect.top - hoverArea
		&& pointer.y <= rect.bottom + hoverArea;
	return withinProximity ? "near" : "outside";
}
