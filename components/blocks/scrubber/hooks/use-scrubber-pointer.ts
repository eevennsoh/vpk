"use client";

import { useRef, type PointerEvent, type RefObject } from "react";
import { animate, useMotionValue, type MotionValue } from "motion/react";

import type { ScrubberEntry } from "@/components/blocks/scrubber/lib/scrubber-entries";
import { POINTER_AWAY, toNearestEntryIndex } from "@/components/blocks/scrubber/lib/scrubber-geometry";
import { SCRUBBER_MAGNIFY_IN, SCRUBBER_MAGNIFY_OUT } from "@/components/blocks/scrubber/scrubber-motion";

export interface ScrubberPointerOptions {
	/** The rail, in reading order. Only `id` and `offset` are read here. */
	entries: readonly ScrubberEntry[];
	/** Index of the committed entry, so a sweep does not re-commit per pixel. */
	activeIndex: number;
	axis: "x" | "y";
	onSelect: (id: string) => void;
	onSeek?: (offset: number) => void;
	onHoverChange: (id: string | null) => void;
	shouldReduceMotion: boolean;
	selectOnHover?: boolean;
}

export interface ScrubberPointer {
	railRef: RefObject<HTMLDivElement | null>;
	/** Live rail length in px. Read non-reactively by every rule's falloff. */
	railSizeRef: RefObject<number>;
	pointerOffset: MotionValue<number>;
	magnify: MotionValue<number>;
	handlePointerMove: (event: PointerEvent<HTMLDivElement>) => void;
	handlePointerLeave: () => void;
}

/**
 * Pointer scrubbing plus the swell, sharing one pointer position.
 *
 * Two cadences on purpose. `pointerOffset` updates every frame and drives the
 * rules through motion values, which write straight to the DOM — a rail of
 * twenty-eight rules re-rendering through React on every mouse pixel would
 * stall the row it sits in. The consumer only hears about a change when the
 * *nearest entry* actually changes, so a fast sweep does not strobe.
 *
 * `magnify` is animated separately so the swell fades out on leave rather than
 * snapping. It is a plain 0–1 scalar and the parked pointer is a finite -1: an
 * Infinity or NaN written into a motion value poisons it permanently.
 */
export function useScrubberPointer({
	activeIndex,
	axis,
	entries,
	onHoverChange,
	onSelect,
	onSeek,
	shouldReduceMotion,
	selectOnHover = true,
}: Readonly<ScrubberPointerOptions>): ScrubberPointer {
	const railRef = useRef<HTMLDivElement | null>(null);
	// Never 0: the rules multiply by it, and a zero rail would flatten the swell.
	const railSizeRef = useRef(1);
	const hoveredEntryIdRef = useRef<string | null>(null);
	const pointerOffset = useMotionValue(POINTER_AWAY);
	const magnify = useMotionValue(0);

	function readOffset(event: PointerEvent<HTMLDivElement>): number | null {
		const rail = railRef.current;
		if (!rail) {
			return null;
		}
		const rect = rail.getBoundingClientRect();
		const size = axis === "y" ? rect.height : rect.width;
		if (size <= 0) {
			return null;
		}
		// Written before the offset is published, so the falloff that reads this
		// ref on the very next frame is already measuring against a fresh rail.
		railSizeRef.current = size;
		const position = axis === "y" ? event.clientY - rect.top : event.clientX - rect.left;
		return Math.min(Math.max(position / size, 0), 1);
	}

	function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
		// Touch has no hover: a finger sliding here is a page scroll, and
		// scrubbing under it would hijack the gesture. Tap still commits.
		if (event.pointerType === "touch" && selectOnHover) {
			return;
		}
		const offset = readOffset(event);
		if (offset === null) {
			return;
		}
		pointerOffset.set(offset);
		const nearest = toNearestEntryIndex(entries, offset);
		const hoveredEntryId = nearest === null ? null : entries[nearest].id;
		if (hoveredEntryIdRef.current !== hoveredEntryId) {
			hoveredEntryIdRef.current = hoveredEntryId;
			onHoverChange(hoveredEntryId);
		}
		// Reduced motion keeps the hover *preview* — that is information, not
		// decoration — but drops both the swell and scrub-to-select, because a
		// zero-duration swell would still let a sweep commit at frame rate.
		if (shouldReduceMotion && selectOnHover) {
			return;
		}
		if (!shouldReduceMotion && magnify.get() !== 1) {
			animate(magnify, 1, SCRUBBER_MAGNIFY_IN);
		}
		if (onSeek && event.buttons === 1) {
			onSeek(offset);
		} else if (nearest !== null && nearest !== activeIndex && (selectOnHover || event.buttons === 1)) {
			onSelect(entries[nearest].id);
		}
	}

	function handlePointerLeave() {
		if (hoveredEntryIdRef.current !== null) {
			hoveredEntryIdRef.current = null;
			onHoverChange(null);
		}
		if (shouldReduceMotion) {
			pointerOffset.set(POINTER_AWAY);
			return;
		}
		// Selection is sticky on leave — rewinding here would snap the consumer
		// back every time the pointer crossed off the rail. The pointer parks
		// only once the fade resolves: the falloff answers 0 for a parked
		// pointer, so parking first would cut the fade off at its first frame.
		animate(magnify, 0, SCRUBBER_MAGNIFY_OUT).then(() => {
			pointerOffset.set(POINTER_AWAY);
		});
	}

	return { handlePointerLeave, handlePointerMove, magnify, pointerOffset, railRef, railSizeRef };
}
