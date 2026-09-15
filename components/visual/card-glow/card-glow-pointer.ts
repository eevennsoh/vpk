"use client";

import { useCallback, useEffect, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

/**
 * Pointer position at rest, in the normalized [-1, 1] space the glow gradient
 * reads. Far enough outside the surface that both the stroke and the bloom are
 * fully transparent, so an untouched card pays nothing for the effect.
 */
const CARD_GLOW_POINTER_REST = "-10";

/** Centre of the surface — the static reading used when motion is reduced. */
const CARD_GLOW_POINTER_CENTRE = "0";

/**
 * Default distance outside the plane at which surfaces start reacting, and the
 * default proximity falloff. Horizontal reach is wide enough to cover roughly a
 * neighbouring board column; vertical is about two rows, so approaching a list
 * lights the part of it you are heading for rather than all of it.
 */
export const CARD_GLOW_PROXIMITY_REACH_PX = 320;
export const CARD_GLOW_PROXIMITY_FALLOFF: CardGlowFalloff = { x: 320, y: 140 };

function writeCardGlowPointer(element: HTMLElement, x: string, y: string) {
	element.style.setProperty("--card-glow-pointer-x", x);
	element.style.setProperty("--card-glow-pointer-y", y);
}

/** Park the pointer vars so the surface returns to its resting chrome. */
export function resetCardGlowPointer(element: HTMLElement) {
	writeCardGlowPointer(element, CARD_GLOW_POINTER_REST, CARD_GLOW_POINTER_REST);
}

/** Pin the glow to the surface centre without tracking the pointer. */
export function centreCardGlowPointer(element: HTMLElement) {
	writeCardGlowPointer(element, CARD_GLOW_POINTER_CENTRE, CARD_GLOW_POINTER_CENTRE);
}

function normalize(pointer: number, start: number, size: number): number {
	return (pointer - (start + size / 2)) / (size / 2);
}

function distanceOutsideBox(
	left: number,
	top: number,
	right: number,
	bottom: number,
	clientX: number,
	clientY: number,
): number {
	const dx = Math.max(left - clientX, clientX - right, 0);
	const dy = Math.max(top - clientY, clientY - bottom, 0);
	return Math.hypot(dx, dy);
}

/**
 * How far a surface still reacts, per axis.
 *
 * Two numbers rather than one radius because a stacked list is anisotropic.
 * Horizontally the reach should be generous — that is the axis the cursor
 * crosses when it approaches a column from the board beside it. Vertically it
 * must be tight, or every row in the column lights at once and the strokes read
 * as horizontal rules between rows instead of an arc tracing one card.
 *
 * Distance is measured to the surface's box horizontally (zero anywhere inside
 * its width) but to its centre vertically. Flush-stacked rows are ~0px apart, so
 * box distance cannot tell the row under the pointer from the one above it.
 */
export interface CardGlowFalloff {
	x: number;
	y: number;
}

/** The subset of a rect the proximity maths needs, so it is testable without a DOM. */
export interface CardGlowSurfaceBox {
	height: number;
	left: number;
	right: number;
	top: number;
}

/**
 * How strongly a surface should react to a pointer at (`clientX`, `clientY`),
 * from 1 under the pointer to 0 at the edge of its reach.
 */
export function cardGlowProximity(
	box: Readonly<CardGlowSurfaceBox>,
	clientX: number,
	clientY: number,
	falloff: Readonly<CardGlowFalloff>,
): number {
	const dx = Math.max(box.left - clientX, clientX - box.right, 0) / falloff.x;
	const dy = Math.abs(clientY - (box.top + box.height / 2)) / falloff.y;
	return Math.max(0, Math.min(1, 1 - Math.hypot(dx, dy)));
}

/**
 * Measure every surface, then write every surface — never interleaved.
 *
 * A read/write per element forces the browser to re-resolve layout between each
 * pair. With one bento of five tiles that is invisible; with a column of fifty
 * session rows it is fifty synchronous layouts per frame.
 *
 * `falloff` opts a surface set into proximity fading: each surface also gets
 * `--card-glow-proximity`. Omit it and the var is never written, so the stroke
 * stays at full strength — the behaviour every non-proximity consumer had.
 */
function applyPointerToSurfaces(
	surfaces: readonly HTMLElement[],
	clientX: number,
	clientY: number,
	falloff?: CardGlowFalloff,
) {
	const rects = surfaces.map((surface) => surface.getBoundingClientRect());
	for (const [index, surface] of surfaces.entries()) {
		const rect = rects[index];
		if (rect === undefined || rect.width === 0 || rect.height === 0) {
			continue;
		}
		writeCardGlowPointer(
			surface,
			normalize(clientX, rect.left, rect.width).toFixed(3),
			normalize(clientY, rect.top, rect.height).toFixed(3),
		);
		if (falloff !== undefined) {
			surface.style.setProperty(
				"--card-glow-proximity",
				cardGlowProximity(rect, clientX, clientY, falloff).toFixed(3),
			);
		}
	}
}

interface PendingPointer {
	clientX: number;
	clientY: number;
	resolveSurfaces: () => readonly HTMLElement[];
}

/**
 * Latest-wins pointer coalescing: at most one measure/write pass per frame,
 * however many `pointermove` events the browser delivers. Every card glow goes
 * through this — a raw handler measures each surface on every event.
 */
function usePointerFrame() {
	const frameRef = useRef<number | null>(null);
	const pendingRef = useRef<PendingPointer | null>(null);

	useEffect(() => () => {
		if (frameRef.current !== null) {
			cancelAnimationFrame(frameRef.current);
			frameRef.current = null;
		}
		pendingRef.current = null;
	}, []);

	const cancel = useCallback(() => {
		if (frameRef.current !== null) {
			cancelAnimationFrame(frameRef.current);
			frameRef.current = null;
		}
		pendingRef.current = null;
	}, []);

	const schedule = useCallback((pending: PendingPointer) => {
		pendingRef.current = pending;
		if (frameRef.current !== null) {
			return;
		}
		frameRef.current = requestAnimationFrame(() => {
			frameRef.current = null;
			const latest = pendingRef.current;
			pendingRef.current = null;
			if (latest === null) {
				return;
			}
			applyPointerToSurfaces(latest.resolveSurfaces(), latest.clientX, latest.clientY);
		});
	}, []);

	return { cancel, schedule };
}

/**
 * Pointer tracking for a single glow surface — only the element under the
 * pointer does any work, and the glow stops at its own edge.
 *
 * Under reduced motion the glow still appears on hover, pinned to the surface
 * centre: the affordance survives, the sweeping motion does not. VPK's duration
 * and easing tokens do not collapse themselves, so this is explicit.
 *
 * Spread the returned handlers onto the element whose box defines the surface.
 * The vars are written there and inherit down to {@link CardGlowLayers}, so the
 * handlers and the layers do not have to live on the same node — useful when
 * the layer host already spreads third-party pointer handlers such as a drag
 * binding.
 */
export function useCardGlowPointer(
	options?: Readonly<{ reduceMotion?: boolean | null }>,
) {
	const reduceMotion = options?.reduceMotion ?? false;
	const { cancel, schedule } = usePointerFrame();

	const onPointerEnter = useCallback((event: ReactPointerEvent<HTMLElement>) => {
		if (reduceMotion) {
			centreCardGlowPointer(event.currentTarget);
		}
	}, [reduceMotion]);

	const onPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
		if (reduceMotion) {
			return;
		}
		// A touch "hover" is really a tap: tracking it lights the card up under
		// the finger and leaves it lit after the finger goes.
		if (event.pointerType === "touch") {
			cancel();
			resetCardGlowPointer(event.currentTarget);
			return;
		}
		const surface = event.currentTarget;
		schedule({
			clientX: event.clientX,
			clientY: event.clientY,
			resolveSurfaces: () => [surface],
		});
	}, [cancel, reduceMotion, schedule]);

	const onPointerLeave = useCallback((event: ReactPointerEvent<HTMLElement>) => {
		cancel();
		resetCardGlowPointer(event.currentTarget);
	}, [cancel]);

	return { onPointerEnter, onPointerMove, onPointerLeave };
}

/**
 * Pointer tracking for a group of glow surfaces that share one pointer plane —
 * the shape a bento grid wants. Every registered tile is updated from the same
 * move, so the accent keeps tracking across the gaps between tiles instead of
 * snapping off at each tile boundary.
 *
 * Register tiles with the returned ref callback; React 19 ref cleanup removes
 * them, so a filtered or unmounted tile cannot be measured after it is gone.
 */
export function useCardGlowPointerGroup() {
	const tilesRef = useRef<Set<HTMLElement>>(new Set());
	const { cancel, schedule } = usePointerFrame();

	const registerTile = useCallback((node: HTMLElement | null) => {
		if (node === null) {
			return;
		}
		const tiles = tilesRef.current;
		tiles.add(node);
		return () => {
			tiles.delete(node);
		};
	}, []);

	const resetTiles = useCallback(() => {
		cancel();
		for (const tile of tilesRef.current) {
			resetCardGlowPointer(tile);
		}
	}, [cancel]);

	const onPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
		if (event.pointerType === "touch") {
			resetTiles();
			return;
		}
		schedule({
			clientX: event.clientX,
			clientY: event.clientY,
			resolveSurfaces: () => [...tilesRef.current],
		});
	}, [resetTiles, schedule]);

	return { onPointerLeave: resetTiles, onPointerMove, registerTile };
}

function distanceOutsideRect(rect: DOMRect, clientX: number, clientY: number): number {
	return distanceOutsideBox(rect.left, rect.top, rect.right, rect.bottom, clientX, clientY);
}

/**
 * Proximity tracking for a column or list of glow surfaces.
 *
 * The difference from {@link useCardGlowPointerGroup} is where the pointer is
 * allowed to be. A group listens on an ancestor, so the cursor has to be inside
 * that ancestor's box before anything lights up. A plane listens on the window
 * and gates on distance, so surfaces begin reacting while the cursor is still
 * approaching from outside — the continuity a bento grid gets for free from its
 * own generous padding, given to a narrow column that has none.
 *
 * Cost is bounded by the gate: while the pointer is further than `reachPx` from
 * the plane, a frame costs one rect read for the plane itself and nothing per
 * surface, and the surfaces are parked exactly once on the way out.
 *
 * Returns nothing under reduced motion — sweeping an accent across a whole
 * column from a distance is precisely the large-area motion that setting asks
 * to avoid. Consumers keep their own hover-only fallback for that case.
 */
export function useCardGlowProximityPlane(
	options?: Readonly<{ enabled?: boolean; falloff?: CardGlowFalloff; reachPx?: number }>,
) {
	const enabled = options?.enabled ?? true;
	const reachPx = options?.reachPx ?? CARD_GLOW_PROXIMITY_REACH_PX;
	const falloffX = options?.falloff?.x ?? CARD_GLOW_PROXIMITY_FALLOFF.x;
	const falloffY = options?.falloff?.y ?? CARD_GLOW_PROXIMITY_FALLOFF.y;
	const planeRef = useRef<HTMLElement | null>(null);
	const surfacesRef = useRef<Set<HTMLElement>>(new Set());
	// Whether the last frame actually lit anything, so leaving the reach parks
	// the surfaces once instead of rewriting the same vars every frame.
	const engagedRef = useRef(false);
	// Last pointer seen, so a scroll can re-resolve the glow without a move:
	// wheeling the list slides rows under a stationary cursor, and without this
	// every row keeps the reading it had before the scroll.
	const pointerRef = useRef<{ clientX: number; clientY: number } | null>(null);
	const frameRef = useRef<number | null>(null);

	const registerSurface = useCallback((node: HTMLElement | null) => {
		if (node === null) {
			return;
		}
		const surfaces = surfacesRef.current;
		surfaces.add(node);
		return () => {
			surfaces.delete(node);
		};
	}, []);

	const setPlaneRef = useCallback((node: HTMLElement | null) => {
		planeRef.current = node;
	}, []);

	useEffect(() => {
		if (!enabled) {
			return;
		}

		const park = () => {
			if (!engagedRef.current) {
				return;
			}
			engagedRef.current = false;
			for (const surface of surfacesRef.current) {
				resetCardGlowPointer(surface);
				surface.style.setProperty("--card-glow-proximity", "0");
			}
		};

		const resolve = () => {
			const plane = planeRef.current;
			const pointer = pointerRef.current;
			if (plane === null || pointer === null) {
				return;
			}
			// One read before any write, and the only read at all when the pointer
			// is nowhere near this column.
			const planeRect = plane.getBoundingClientRect();
			if (
				planeRect.width === 0
				|| distanceOutsideRect(planeRect, pointer.clientX, pointer.clientY) > reachPx
			) {
				park();
				return;
			}
			engagedRef.current = true;
			const surfaces = [...surfacesRef.current].filter((surface) => surface.isConnected);
			applyPointerToSurfaces(surfaces, pointer.clientX, pointer.clientY, {
				x: falloffX,
				y: falloffY,
			});
		};

		const schedule = () => {
			if (frameRef.current !== null) {
				return;
			}
			frameRef.current = requestAnimationFrame(() => {
				frameRef.current = null;
				resolve();
			});
		};

		const onPointerMove = (event: PointerEvent) => {
			if (event.pointerType === "touch") {
				pointerRef.current = null;
				park();
				return;
			}
			pointerRef.current = { clientX: event.clientX, clientY: event.clientY };
			schedule();
		};
		const onPointerOut = (event: PointerEvent) => {
			// `relatedTarget === null` on the document means the pointer left the
			// window entirely; a plain move between elements must not park.
			if (event.relatedTarget === null) {
				pointerRef.current = null;
				park();
			}
		};
		const onScroll = () => {
			if (pointerRef.current !== null) {
				schedule();
			}
		};

		window.addEventListener("pointermove", onPointerMove, { passive: true });
		document.addEventListener("pointerout", onPointerOut, { passive: true });
		// Capture, because the list that moves under the cursor is a descendant
		// scrollport and its scroll event does not bubble.
		window.addEventListener("scroll", onScroll, { capture: true, passive: true });

		return () => {
			window.removeEventListener("pointermove", onPointerMove);
			document.removeEventListener("pointerout", onPointerOut);
			window.removeEventListener("scroll", onScroll, { capture: true });
			if (frameRef.current !== null) {
				cancelAnimationFrame(frameRef.current);
				frameRef.current = null;
			}
			pointerRef.current = null;
			park();
		};
	}, [enabled, falloffX, falloffY, reachPx]);

	return { registerSurface, setPlaneRef };
}
