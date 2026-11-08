"use client";

import { motion, useMotionValue, useReducedMotion, useTransform, type MotionValue } from "motion/react";

import { ScrubberMark } from "@/components/blocks/scrubber/components/scrubber-mark";
import { useScrubberNavigation } from "@/components/blocks/scrubber/hooks/use-scrubber-navigation";
import { useScrubberPointer } from "@/components/blocks/scrubber/hooks/use-scrubber-pointer";
import type { ScrubberEntry } from "@/components/blocks/scrubber/lib/scrubber-entries";
import { toMarkState, toNearestEntryIndex, toResolvedIndex } from "@/components/blocks/scrubber/lib/scrubber-geometry";
import { cn } from "@/lib/utils";

/**
 * How the rail paints itself against the surface behind it.
 *
 * `default` is the light-surface treatment: near-black rules and a black pill.
 * `inverse` is the same contrast, flipped, for a rail embedded in a dark surface
 * (the Omnibar's `background.neutral.bold` bar) — where the default rules and
 * the black pill would both disappear into the fill.
 *
 * Only the rail root carries a colour: the rules are `bg-current` and inherit
 * it, so a new tone means one entry here rather than a prop threaded through
 * every mark.
 */
export type ScrubberTone = "default" | "inverse";

const RAIL_TONE: Record<ScrubberTone, string> = {
	default: "text-text",
	inverse: "text-text-inverse",
};

const PILL =
	"inline-flex items-center rounded-md px-2 py-1.5 text-[11px] leading-none font-medium whitespace-nowrap";

const PILL_TONE: Record<ScrubberTone, string> = {
	default: "bg-bg-neutral-bold text-text-inverse",
	inverse: "bg-surface text-text",
};

/**
 * One pill names the active entry, and slides rather than reappearing so the
 * rail reads as one surface you are moving along.
 *
 * On a horizontal rail `left` places its leading edge at the offset and
 * `translateX` pulls it back by the same share of its own width, so the pill
 * pins itself inside both ends instead of overhanging them. Those two must share
 * one duration and easing or the position and the self-offset animate out of
 * step and the pill visibly wobbles — hence a single `transition-[left,transform]`
 * carrying one `duration-*`/`ease-*` pair. `motion-reduce:transition-none` is the
 * guard: VPK's duration tokens keep playing otherwise, and unlike a JS check it
 * also holds on the pre-hydration render.
 */
function ScrubberPill({ axis, entry, tone }: Readonly<{ axis: "x" | "y"; entry: ScrubberEntry; tone: ScrubberTone }>) {
	const percent = `${entry.offset * 100}%`;
	return (
		<div
			data-slot="scrubber-pill"
			style={
				axis === "y"
					? { top: percent, transform: "translateY(-50%)" }
					: { left: percent, transform: `translateX(-${percent})` }
			}
			className={cn(
				"duration-medium ease-in-out absolute motion-reduce:transition-none",
				axis === "y" ? "left-0 transition-[top]" : "top-0 transition-[left,transform]",
			)}
		>
			<span className={cn(PILL, PILL_TONE[tone])}>{entry.heading}</span>
		</div>
	);
}

export interface ScrubberRailProps {
	/** The rail, in reading order and already ascending by offset. */
	entries: readonly ScrubberEntry[];
	/** Index into `entries` of the committed entry. Out-of-range is tolerated. */
	activeIndex: number;
	/** Continuous playhead position, independent of the selected keyboard option. */
	activeOffset?: MotionValue<number>;
	onSelect: (id: string) => void;
	/** Seek continuously on pointer input while preserving discrete keyboard navigation. */
	onSeek?: (offset: number) => void;
	/** Nearest entry under the pointer, or `null` once it leaves. */
	onHoverChange?: (id: string | null) => void;
	/** Same preview channel, driven by keyboard focus. */
	onFocusChange?: (id: string | null) => void;
	axis?: "x" | "y";
	ariaLabel: string;
	className?: string;
	showPill?: boolean;
	/** Which surface the rail is painted on. `inverse` for a dark host. */
	tone?: ScrubberTone;
	appearance?: "notches" | "dots";
	selectionMode?: "hover" | "drag";
}

function noop() {}

/**
 * A scrubbable notch rail: two ranks of marks that swell around the pointer,
 * plus one pill naming where you are.
 *
 * Moving along the rail selects the nearest mark at frame rate; click and the
 * keyboard commit too, which is what touch and assistive tech use. Every mark
 * is a target, majors and minors alike, so there are no dead zones.
 *
 * GEOMETRY WARNING: the marks overflow the rail on purpose. A 24px tap target
 * is bottom-anchored to a 14px rail and a major's rule swells to 46px, so a
 * horizontal rail needs roughly 32px of clear headroom above it, and no
 * ancestor between the rail and that headroom may clip — `overflow-hidden`
 * there removes the swell and half the focus ring.
 */
export function ScrubberRail({
	activeIndex,
	activeOffset,
	ariaLabel,
	axis = "x",
	className,
	entries,
	onFocusChange = noop,
	onHoverChange = noop,
	onSelect,
	onSeek,
	showPill = true,
	tone = "default",
	appearance = "notches",
	selectionMode = "hover",
}: Readonly<ScrubberRailProps>) {
	const shouldReduceMotion = useReducedMotion();
	const defaultOffset = useMotionValue(0);
	const playheadPosition = useTransform(activeOffset ?? defaultOffset, (value) => `${Math.min(1, Math.max(0, value)) * 100}%`);
	// One resolved index for everything downstream. An `activeIndex` that
	// overflows a shortened rail would otherwise blank the pill, leave no option
	// `aria-selected`, and make the pointer hook re-commit on every pointermove.
	const resolvedIndex = toResolvedIndex(activeIndex, entries.length);
	const { handleKeyDown, markRefs, moveTo } = useScrubberNavigation(entries, resolvedIndex, onSelect);
	const { handlePointerLeave, handlePointerMove, magnify, pointerOffset, railRef, railSizeRef } = useScrubberPointer({
		activeIndex: resolvedIndex,
		axis,
		entries,
		onHoverChange,
		onSelect,
		onSeek,
		shouldReduceMotion: shouldReduceMotion === true,
		selectOnHover: selectionMode === "hover",
	});

	// The hover plate snaps to the dot it would select, so it never sits half over a dot.
	const hoverPosition = useTransform(pointerOffset, (value) => {
		const nearest = toNearestEntryIndex(entries, Math.min(1, Math.max(0, value)));
		return `${(nearest === null ? Math.min(1, Math.max(0, value)) : entries[nearest]!.offset) * 100}%`;
	});
	const hoverOpacity = useTransform(pointerOffset, (value) => value < 0 ? 0 : 1);
	const activeEntry = entries[resolvedIndex] ?? null;
	// Clamped rather than tied to `isActive`: roving tabindex only works if
	// exactly one mark carries `tabIndex={0}`, and a rail with nothing committed
	// yet (a negative index) would otherwise be unreachable by Tab.
	const focusIndex = Math.max(resolvedIndex, 0);

	return (
		<div
			data-slot="scrubber"
			className={cn("flex min-w-0", RAIL_TONE[tone], axis === "y" ? "h-full gap-1.5" : "flex-col gap-1.5", className)}
		>
			<div
				ref={railRef}
				data-slot="scrubber-rail"
				role="listbox"
				aria-label={ariaLabel}
				aria-orientation={axis === "y" ? "vertical" : "horizontal"}
				onKeyDown={handleKeyDown}
				onPointerMove={handlePointerMove}
				onPointerDown={selectionMode === "drag" ? (event) => { if (event.button !== 0) return; event.currentTarget.setPointerCapture(event.pointerId); handlePointerMove(event); } : undefined}
				onPointerUp={selectionMode === "drag" ? (event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); } : undefined}
				onPointerCancel={selectionMode === "drag" ? handlePointerLeave : undefined}
				onPointerLeave={handlePointerLeave}
				className={cn("relative min-w-0", onSeek && "cursor-grab active:cursor-grabbing", axis === "y" ? "h-full w-6 shrink-0" : "h-3.5 w-full", selectionMode === "drag" && "touch-none")}
			>
				{appearance === "dots" ? <span aria-hidden className={cn("pointer-events-none absolute border-dashed border-border", axis === "y" ? "inset-y-0 left-1/2 -translate-x-1/2 border-l" : "inset-x-0 top-1/2 -translate-y-1/2 border-t")} /> : null}
				{entries.map((entry, index) => (
					<ScrubberMark
						key={entry.id}
						axis={axis}
						appearance={appearance}
						entry={entry}
						isActive={index === resolvedIndex}
						showActiveIndicator={activeOffset === undefined}
						magnify={magnify}
						markRef={(node) => {
							markRefs.current[index] = node;
						}}
						onFocusChange={onFocusChange}
						onSelect={(event) => { if (onSeek === undefined || event.detail === 0) moveTo(index); }}
						pointerOffset={pointerOffset}
						railSizeRef={railSizeRef}
						state={toMarkState(entry.muted === true, index === resolvedIndex)}
						tabbable={index === focusIndex}
					/>
				))}
				{appearance === "dots" && activeOffset !== undefined && entries.length > 0 ? <motion.span
					aria-hidden
					className={cn("pointer-events-none absolute flex size-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-bg-neutral", axis === "y" ? "left-1/2" : "top-1/2")}
					data-slot="scrubber-hover"
					style={axis === "y" ? { top: hoverPosition, opacity: hoverOpacity } : { left: hoverPosition, opacity: hoverOpacity }}
				><span className="size-1.5 rounded-full bg-current" /></motion.span> : null}
				{appearance === "dots" && activeOffset !== undefined && entries.length > 0 ? <motion.span
					aria-hidden
					className={cn("pointer-events-none absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current", axis === "y" ? "left-1/2" : "top-1/2")}
					data-slot="scrubber-playhead"
					style={axis === "y" ? { top: playheadPosition } : { left: playheadPosition }}
				/> : null}
			</div>
			{showPill ? (
				// A reserved row rather than an overlay: the pill changing width can
				// never reflow whatever the rail is embedded in. Hidden from assistive
				// tech because `aria-selected` already speaks the active mark.
				<div
					aria-hidden="true"
					className={cn("pointer-events-none relative min-w-0", axis === "y" ? "flex-1" : "h-[22px] w-full")}
				>
					{activeEntry === null ? null : <ScrubberPill axis={axis} entry={activeEntry} tone={tone} />}
				</div>
			) : null}
		</div>
	);
}
