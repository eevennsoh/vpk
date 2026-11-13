import type {
	FloatingRovoButtonPersistentBarSide,
	FloatingRovoButtonPlacement,
	FloatingRovoButtonPositioning,
} from "./types";

export const FLOATING_ROVO_BUTTON_EDGE_GAP = 24;
export const FLOATING_ROVO_BUTTON_SNAP_GRID_SIZE = 4;
export const FLOATING_ROVO_BUTTON_DRAG_CLICK_THRESHOLD = 6;

/**
 * Occupied trailing chrome (docked untracked-work rail, etc.). Hosts publish
 * the pixel width; `0px` when unset keeps the button in the default corner.
 */
export const FLOATING_ROVO_BUTTON_END_INSET_VAR = "--untracked-panel-width";

const DEFAULT_BUTTON_RIGHT = `calc(${FLOATING_ROVO_BUTTON_EDGE_GAP}px + var(${FLOATING_ROVO_BUTTON_END_INSET_VAR}, 0px))`;
const DEFAULT_BUTTON_BOTTOM = `${FLOATING_ROVO_BUTTON_EDGE_GAP}px`;

export interface FloatingRovoButtonSnapTarget {
	left: number;
	top: number;
}

export interface FloatingRovoButtonDragConstraints {
	bottom: number;
	left: number;
	right: number;
	top: number;
}

export interface FloatingRovoButtonDragStart {
	offsetX: number;
	offsetY: number;
	pointerId: number | null;
	x: number;
	y: number;
}

export interface FloatingRovoButtonCoordinateSpace {
	height: number;
	left: number;
	top: number;
	width: number;
}

export interface FloatingRovoButtonLocalMeasurement {
	rect: Pick<DOMRect, "height" | "left" | "top" | "width">;
	space: FloatingRovoButtonCoordinateSpace;
}

export function resolveFloatingRovoButtonPlacement(placement?: FloatingRovoButtonPlacement): Required<FloatingRovoButtonPlacement> {
	return {
		right: placement?.right ?? DEFAULT_BUTTON_RIGHT,
		bottom: placement?.bottom ?? DEFAULT_BUTTON_BOTTOM,
	};
}

export function clampFloatingRovoButtonValue(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

export function getFloatingRovoButtonCoordinateSpace(
	surface: HTMLElement,
	positioning: FloatingRovoButtonPositioning,
): FloatingRovoButtonCoordinateSpace {
	if (positioning === "container" && surface.offsetParent instanceof HTMLElement) {
		const parentRect = surface.offsetParent.getBoundingClientRect();

		return {
			left: parentRect.left,
			top: parentRect.top,
			width: surface.offsetParent.clientWidth,
			height: surface.offsetParent.clientHeight,
		};
	}

	return {
		left: 0,
		top: 0,
		width: window.innerWidth,
		height: window.innerHeight,
	};
}

export function getFloatingRovoButtonLocalMeasurement(
	surface: HTMLElement,
	positioning: FloatingRovoButtonPositioning,
): FloatingRovoButtonLocalMeasurement {
	const rect = surface.getBoundingClientRect();
	const space = getFloatingRovoButtonCoordinateSpace(surface, positioning);

	return {
		rect: {
			left: rect.left - space.left,
			top: rect.top - space.top,
			width: rect.width,
			height: rect.height,
		},
		space,
	};
}

export function getFloatingRovoButtonSafeBounds(rect: Pick<DOMRect, "width" | "height">, viewportWidth: number, viewportHeight: number) {
	const minLeft = FLOATING_ROVO_BUTTON_EDGE_GAP;
	const minTop = FLOATING_ROVO_BUTTON_EDGE_GAP;
	const maxLeft = Math.max(minLeft, viewportWidth - rect.width - FLOATING_ROVO_BUTTON_EDGE_GAP);
	const maxTop = Math.max(minTop, viewportHeight - rect.height - FLOATING_ROVO_BUTTON_EDGE_GAP);

	return { minLeft, minTop, maxLeft, maxTop };
}

export function getFloatingRovoButtonSnapTargets(
	rect: Pick<DOMRect, "width" | "height">,
	viewportWidth: number,
	viewportHeight: number,
): FloatingRovoButtonSnapTarget[] {
	const { minLeft, minTop, maxLeft, maxTop } = getFloatingRovoButtonSafeBounds(rect, viewportWidth, viewportHeight);
	const snapTargets: FloatingRovoButtonSnapTarget[] = [];

	for (let rowIndex = 0; rowIndex < FLOATING_ROVO_BUTTON_SNAP_GRID_SIZE; rowIndex += 1) {
		for (let columnIndex = 0; columnIndex < FLOATING_ROVO_BUTTON_SNAP_GRID_SIZE; columnIndex += 1) {
			const left = minLeft + ((maxLeft - minLeft) * columnIndex) / (FLOATING_ROVO_BUTTON_SNAP_GRID_SIZE - 1);
			const top = minTop + ((maxTop - minTop) * rowIndex) / (FLOATING_ROVO_BUTTON_SNAP_GRID_SIZE - 1);

			snapTargets.push({ left, top });
		}
	}

	return snapTargets;
}

export function getDefaultFloatingRovoButtonSnapTarget(
	rect: Pick<DOMRect, "width" | "height">,
	viewportWidth: number,
	viewportHeight: number,
): FloatingRovoButtonSnapTarget {
	const snapTargets = getFloatingRovoButtonSnapTargets(rect, viewportWidth, viewportHeight);

	return snapTargets[snapTargets.length - 1];
}

export function getNearestFloatingRovoButtonSnapTarget(
	rect: Pick<DOMRect, "height" | "left" | "top" | "width">,
	viewportWidth: number,
	viewportHeight: number,
) {
	const snapTargets = getFloatingRovoButtonSnapTargets(rect, viewportWidth, viewportHeight);
	const centerX = rect.left + rect.width / 2;
	const centerY = rect.top + rect.height / 2;
	let closestTarget = snapTargets[0];
	let closestDistance = Infinity;

	for (let snapIndex = 0; snapIndex < snapTargets.length; snapIndex += 1) {
		const target = snapTargets[snapIndex];
		const targetCenterX = target.left + rect.width / 2;
		const targetCenterY = target.top + rect.height / 2;
		const distance = Math.hypot(centerX - targetCenterX, centerY - targetCenterY);

		if (distance < closestDistance) {
			closestDistance = distance;
			closestTarget = target;
		}
	}

	return closestTarget;
}

export function getFloatingRovoButtonDragConstraints(
	origin: FloatingRovoButtonSnapTarget,
	rect: Pick<DOMRect, "width" | "height">,
	viewportWidth: number,
	viewportHeight: number,
): FloatingRovoButtonDragConstraints {
	const { minLeft, minTop, maxLeft, maxTop } = getFloatingRovoButtonSafeBounds(rect, viewportWidth, viewportHeight);

	return {
		left: minLeft - origin.left,
		top: minTop - origin.top,
		right: maxLeft - origin.left,
		bottom: maxTop - origin.top,
	};
}

export function getClampedFloatingRovoButtonTarget(
	rect: Pick<DOMRect, "height" | "left" | "top" | "width">,
	viewportWidth: number,
	viewportHeight: number,
): FloatingRovoButtonSnapTarget {
	const { minLeft, minTop, maxLeft, maxTop } = getFloatingRovoButtonSafeBounds(rect, viewportWidth, viewportHeight);
	const clampedLeft = clampFloatingRovoButtonValue(rect.left, minLeft, maxLeft);
	const clampedTop = clampFloatingRovoButtonValue(rect.top, minTop, maxTop);

	return { left: clampedLeft, top: clampedTop };
}

/**
 * Which edge of the button the persistent bar attaches to.
 *
 * Lives here rather than beside the rail it serves: a component module that
 * also exports a plain function costs Fast Refresh the ability to preserve
 * component state (`react-doctor/only-export-components`), and this is pure
 * geometry like everything else in this file.
 */
export function resolveFloatingRovoButtonPersistentBarSide(
	configuredSide: FloatingRovoButtonPersistentBarSide,
	targetTop: number,
	rectHeight: number,
	spaceHeight: number,
): "top" | "bottom" {
	if (configuredSide !== "auto") {
		return configuredSide;
	}

	// Button in the lower half of its space → open the bar upward, and vice versa.
	const center = targetTop + rectHeight / 2;
	return center >= spaceHeight / 2 ? "top" : "bottom";
}
