import {
	createLatestAnimationFrame,
	// @ts-expect-error Node's strip-types runner requires the explicit .ts extension.
} from "../../../../../lib/latest-animation-frame.ts";

/** A small approach margin around the future well, rather than the former 120px reach. */
export const CREATE_WORK_ITEM_PROXIMITY_HOVER_AREA_PX = 24;

function isWithinHoverArea(
	pointer: Readonly<ExclusiveProximityPointer>,
	rect: Readonly<ExclusiveProximityRect>,
	hoverArea: number,
): boolean {
	return pointer.x >= rect.left - hoverArea
		&& pointer.x <= rect.right + hoverArea
		&& pointer.y >= rect.top - hoverArea
		&& pointer.y <= rect.bottom + hoverArea;
}

export interface ExclusiveProximityPointer {
	x: number;
	y: number;
}

export interface ExclusiveProximityRect {
	bottom: number;
	left: number;
	right: number;
	top: number;
}

export interface ExclusiveProximityWell {
	id: string;
	rect: ExclusiveProximityRect;
}

/** Coalesce pointer events while leaving geometry reads until the next frame. */
export function createExclusiveProximityScheduler({
	requestFrame,
	cancelFrame,
	onPointer,
	onClear,
}: Readonly<{
	requestFrame: (callback: () => void) => number;
	cancelFrame: (id: number) => void;
	onPointer: (pointer: Readonly<ExclusiveProximityPointer>) => void;
	onClear: () => void;
}>) {
	let disposed = false;
	const scheduler = createLatestAnimationFrame({ requestFrame, cancelFrame, onFrame: onPointer });
	const clear = () => {
		scheduler.cancel();
		if (!disposed) onClear();
	};

	return {
		move(pointer: Readonly<ExclusiveProximityPointer>, pointerType: string) {
			if (disposed) return;
			if (pointerType === "touch") {
				clear();
				return;
			}
			scheduler.schedule(pointer);
		},
		clear,
		dispose() {
			disposed = true;
			scheduler.dispose();
		},
	};
}

export function distanceFromPointToRect(
	pointer: Readonly<ExclusiveProximityPointer>,
	rect: Readonly<ExclusiveProximityRect>,
): number {
	const dx = pointer.x < rect.left
		? rect.left - pointer.x
		: pointer.x > rect.right
			? pointer.x - rect.right
			: 0;
	const dy = pointer.y < rect.top
		? rect.top - pointer.y
		: pointer.y > rect.bottom
			? pointer.y - rect.bottom
			: 0;
	return Math.hypot(dx, dy);
}

/**
 * Among wells whose magnetic relation is not `outside`, pick the closest
 * actual rect. Equal distance prefers the leftmost well, then first registered.
 */
export function resolveExclusiveProximityWinner(
	pointer: Readonly<ExclusiveProximityPointer>,
	wells: readonly ExclusiveProximityWell[],
	hoverArea: number = CREATE_WORK_ITEM_PROXIMITY_HOVER_AREA_PX,
): string | null {
	let winnerId: string | null = null;
	let winnerDistance = Number.POSITIVE_INFINITY;
	let winnerLeft = Number.POSITIVE_INFINITY;

	for (const well of wells) {
		if (!isWithinHoverArea(pointer, well.rect, hoverArea)) continue;

		const distance = distanceFromPointToRect(pointer, well.rect);
		const isCloser = distance < winnerDistance;
		const isTiePreferLeft = distance === winnerDistance && well.rect.left < winnerLeft;
		if (winnerId === null || isCloser || isTiePreferLeft) {
			winnerId = well.id;
			winnerDistance = distance;
			winnerLeft = well.rect.left;
		}
	}

	return winnerId;
}
