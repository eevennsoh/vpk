"use client";

import { motion, useReducedMotion, useTransform, type MotionValue } from "motion/react";
import {
	useCallback,
	useLayoutEffect,
	useMemo,
	useRef,
	type KeyboardEvent,
	type PointerEvent,
	type RefObject,
} from "react";

import Squircle from "@/components/website/demos/visual/shaders/squircle";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

import type { GalleryItem } from "../data/gallery-items";
import { useDockScale } from "../hooks/use-dock-magnification";
import { useFitText } from "../hooks/use-fit-text";
import {
	DEFAULT_GALLERY_SELECTION_ORIGIN,
	getGallerySelectionOriginFromPoint,
	type GallerySelectionOrigin,
	type GallerySelectionVisual,
} from "../lib/gallery-selection";
import type { GalleryPalette } from "../lib/gallery-palette";
import { GallerySelectedSurface } from "./gallery-selected-surface";
import { GalleryTitleLines } from "./gallery-title-lines";

// Three fixed footprints (bottom-aligned in the track). Squircle needs pixel
// dimensions, so these are numbers rather than Tailwind size classes. Cards grow
// UPWARD when magnified (transformOrigin "bottom center") so they never push
// their neighbors.
const SIZE_DIMS: Record<GalleryItem["size"], { width: number; height: number }> = {
	portrait: { width: 144, height: 208 },
	landscape: { width: 224, height: 128 },
	"1x1": { width: 112, height: 112 },
};

const EASE_IN = [0.6, 0, 0.8, 0.6] as const; // --ease-in (practical EXIT)
const DUR_MEDIUM = 0.2; // --duration-medium
const DUR_FAST = 0.1; // --duration-fast

// Smooth glide-in for the staggered entrance. A bounce:0 spring (no overshoot)
// decelerates naturally — much smoother than the bold ADS ease-out cubic-bezier,
// whose front-loaded curve makes cards snap to size. This matches the established
// smooth staggered-reveal idiom in chat-greeting.tsx. `visualDuration` is the time
// the card appears to take to land; the track spaces each card's start (stagger).
const CARD_ENTER = { type: "spring", bounce: 0, visualDuration: 0.28 } as const;

// Faster, interrupt-friendly EXIT. The toggle can be spammed, so the card sinks back
// down (y→40) on a bounce:0 spring: springs resolve gracefully from any in-flight
// position/velocity, whereas the old duration/ease tween restarted abruptly and left
// cards stranded mid-travel when open→close→open interrupted it. Opacity rides a short
// ease-in tween. The reverse-order stagger (dock empties outside-in) is owned by the
// track; this is deliberately quicker than the enter per the asymmetric-exit rule.
const CARD_EXIT = {
	y: { type: "spring", bounce: 0, visualDuration: 0.16 },
	opacity: { duration: DUR_FAST, ease: EASE_IN },
} as const;

// Per-card entrance/exit. The strip is pinned to the BOTTOM of the viewport, so cards
// RISE in from below (y:40→0, bottom-to-top) and SINK back down on exit (0→40),
// spatially anchored to the dock they belong to. The rise emerges from just beneath
// the strip; opacity is ~0 at the start of the travel so the brief clip at the bottom
// edge reads as the card surfacing into place. `y` is an INDEPENDENT transform, and it
// lives on the wrapper (below), NOT on the button — the button's `transform` is owned
// by the dock `scale` MotionValue, which would otherwise clobber the entrance `y`.
// Smooth spring ENTER, faster spring EXIT (asymmetric-exit rule). Stagger is owned by
// the track.
const CARD_ITEM = {
	hidden: { opacity: 0, y: 40 },
	visible: { opacity: 1, y: 0, transition: CARD_ENTER },
	exit: { opacity: 0, y: 40, transition: CARD_EXIT },
} as const;
// Reduced motion: fade only, no rise.
const CARD_ITEM_REDUCED = {
	hidden: { opacity: 0 },
	visible: { opacity: 1, transition: { duration: DUR_MEDIUM } },
	exit: { opacity: 0, transition: { duration: DUR_MEDIUM } },
} as const;

export interface GalleryCardProps {
	item: GalleryItem;
	pointerX: MotionValue<number>;
	scrollContainerRef: RefObject<HTMLDivElement | null>;
	/** Read to bail the click that ends a drag. */
	wasDraggedRef: RefObject<boolean>;
	/** Pauses dock magnification while the track is being panned. */
	dragging: boolean;
	isSelected: boolean;
	selectionVisual: GallerySelectionVisual | null;
	palette?: GalleryPalette;
	selectedColor?: string;
	onSelect: (id: string, origin: GallerySelectionOrigin) => void;
}

export function GalleryCard({
	item,
	pointerX,
	scrollContainerRef,
	wasDraggedRef,
	dragging,
	isSelected,
	selectionVisual,
	palette,
	selectedColor,
	onSelect,
}: Readonly<GalleryCardProps>) {
	const { width, height } = SIZE_DIMS[item.size];
	const cardRef = useRef<HTMLButtonElement | null>(null);
	const highlightTextRef = useRef<HTMLSpanElement | null>(null);
	const pendingOriginRef = useRef<GallerySelectionOrigin>(DEFAULT_GALLERY_SELECTION_ORIGIN);
	const scale = useDockScale({ pointerX, cardRef, scrollContainerRef, disabled: dragging });
	const scaledWidth = useTransform(() => width * scale.get());
	const prefersReducedMotion = useReducedMotion();
	const itemVariants = prefersReducedMotion ? CARD_ITEM_REDUCED : CARD_ITEM;
	const titleLayoutText = item.titleLines?.join("\n") ?? item.title;
	const syncTextRefs = useMemo(() => [highlightTextRef], []);
	const { containerRef, textRef } = useFitText<HTMLDivElement, HTMLSpanElement>(titleLayoutText, {
		syncTextRefs,
	});

	useLayoutEffect(() => {
		if (!selectionVisual || !textRef.current || !highlightTextRef.current) return;
		highlightTextRef.current.style.fontSize = textRef.current.style.fontSize;
	}, [selectionVisual, textRef]);

	const setRef = useCallback((node: HTMLButtonElement | null) => {
		cardRef.current = node;
	}, []);

	const setPointerOrigin = useCallback((clientX: number, clientY: number) => {
		const rect = cardRef.current?.getBoundingClientRect();
		if (!rect) {
			pendingOriginRef.current = DEFAULT_GALLERY_SELECTION_ORIGIN;
			return;
		}
		pendingOriginRef.current = getGallerySelectionOriginFromPoint(
			rect.width,
			rect.height,
			clientX,
			clientY,
			rect.left,
			rect.top,
		);
	}, []);

	const handleClick = useCallback(() => {
		if (wasDraggedRef.current) return;
		if (isSelected) return;
		onSelect(item.id, pendingOriginRef.current);
	}, [isSelected, item.id, onSelect, wasDraggedRef]);

	const handlePointerDown = useCallback(
		(event: PointerEvent<HTMLButtonElement>) => {
			setPointerOrigin(event.clientX, event.clientY);
		},
		[setPointerOrigin],
	);

	const handleKeyDown = useCallback((event: KeyboardEvent<HTMLButtonElement>) => {
		if (event.key !== "Enter" && event.key !== " ") return;
		pendingOriginRef.current = DEFAULT_GALLERY_SELECTION_ORIGIN;
	}, []);

	return (
		<motion.div
			variants={itemVariants}
			className="flex shrink-0 items-end justify-center"
			style={{ width: scaledWidth, height, willChange: "transform, opacity" }}
		>
			<motion.div
				style={{ scale, transformOrigin: "bottom center", willChange: "transform" }}
			>
				<button
					ref={setRef}
					type="button"
					aria-label={`Select ${item.title}`}
					aria-pressed={isSelected ? true : undefined}
					onClick={handleClick}
					onPointerDown={handlePointerDown}
					onKeyDown={handleKeyDown}
					className={cn(
						"relative block rounded-3xl text-left outline-none",
						"focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
					)}
					style={{ width, height }}
				>
					<Squircle
						width={width}
						height={height}
						strokeWidth={0}
						fillColor={token("elevation.surface.sunken")}
						contentClassName="relative h-full w-full overflow-hidden"
						style={{ boxShadow: token("elevation.shadow.raised") }}
					>
						{selectionVisual ? (
							<GallerySelectedSurface
								key={selectionVisual.key}
								itemId={item.id}
								title={item.title}
								titleLines={item.titleLines}
								width={width}
								height={height}
								visual={selectionVisual}
								palette={palette}
								selectedColor={selectedColor}
								highlightTextRef={highlightTextRef}
							/>
						) : null}
						<div
							aria-hidden="true"
							className="pointer-events-none absolute inset-0 z-0 p-6"
						>
							<div ref={containerRef} className="flex h-full w-full flex-col justify-end">
								<GalleryTitleLines
									title={item.title}
									lines={item.titleLines}
									textRef={textRef}
									className="text-text"
								/>
							</div>
						</div>
					</Squircle>
				</button>
			</motion.div>
		</motion.div>
	);
}
