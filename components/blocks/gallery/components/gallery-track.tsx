"use client";

import { useCallback, useRef, type CSSProperties, type JSX, type PointerEvent } from "react";
import { motion, useReducedMotion } from "motion/react";

import { useHasHorizontalOverflow } from "@/components/hooks/use-has-horizontal-overflow";
import { buildScrollMaskBlurLayerStyles } from "@/components/visual/scroll-mask/lib";
import { cn } from "@/lib/utils";

import type { GalleryItem } from "../data/gallery-items";
import type { GallerySelectionOrigin, GallerySelectionVisual } from "../lib/gallery-selection";
import { useDockPointer } from "../hooks/use-dock-magnification";
import { useDragScroll } from "../hooks/use-drag-scroll";
import { GalleryCard } from "./gallery-card";
import type { GalleryPalette } from "../lib/gallery-palette";

// Local edge-mask builder — deliberately NOT the bento one, which composites a
// permanent bottom fade via `mask-composite: intersect`. Gallery wants left/right
// fades only, so this is a single `linear-gradient(to right, …)` (no composite).
const GALLERY_EDGE_FADE = "48px";

function buildGalleryEdgeMask(canScrollLeft: boolean, canScrollRight: boolean): string {
	const left = canScrollLeft ? `transparent 0, #000 ${GALLERY_EDGE_FADE}` : "#000 0";
	const right = canScrollRight
		? `#000 calc(100% - ${GALLERY_EDGE_FADE}), transparent 100%`
		: "#000 100%";
	return `linear-gradient(to right, ${left}, ${right})`;
}

type GalleryEdgeMaskStyle = CSSProperties & Record<"--gallery-edge-mask", string>;

function getGalleryEdgeMaskStyle(
	canScrollLeft: boolean,
	canScrollRight: boolean,
): GalleryEdgeMaskStyle {
	return { "--gallery-edge-mask": buildGalleryEdgeMask(canScrollLeft, canScrollRight) };
}

// Card entrance/exit is orchestrated HERE — the track is the direct motion parent of
// the cards, so its variant transition owns their stagger. The active label ("hidden"
// /"visible"/"exit") arrives from the strip via variant propagation; these container
// variants add only the sequencing (the per-card values live on the card). Exit runs
// in reverse (staggerDirection:-1) so the dock empties from the outside in, and its
// stagger is deliberately TIGHTER than the enter — a quick reverse ripple out rather
// than a slow drawn-out one (asymmetric-exit rule).
const TRACK_CONTAINER = {
	hidden: {},
	visible: { transition: { staggerChildren: 0.045, delayChildren: 0.03 } },
	exit: { transition: { staggerChildren: 0.02, staggerDirection: -1 } },
} as const;
const TRACK_CONTAINER_REDUCED = {
	hidden: {},
	visible: { transition: { staggerChildren: 0.025 } },
	exit: { transition: { staggerChildren: 0.015, staggerDirection: -1 } },
} as const;

// Progressive edge blur — the horizontal counterpart of ScrollMask's vertical edge builder,
// which owns the layered-veil technique in @/components/visual/scroll-mask. The overlay width
// is a dock-specific layout value, so it stays local here.
const GALLERY_EDGE_BLUR_SIZE = "72px";

// Static per edge → build once at module scope (no per-render allocation).
const LEFT_BLUR_LAYERS = buildScrollMaskBlurLayerStyles("left");
const RIGHT_BLUR_LAYERS = buildScrollMaskBlurLayerStyles("right");

function getSelectionVisual(
	itemId: string,
	activeVisual: GallerySelectionVisual | null,
	exitingVisual: GallerySelectionVisual | null,
): GallerySelectionVisual | null {
	if (activeVisual?.id === itemId) return activeVisual;
	if (exitingVisual?.id === itemId) return exitingVisual;
	return null;
}

export interface GalleryTrackProps {
	items: readonly GalleryItem[];
	selectedId: string | null;
	activeVisual: GallerySelectionVisual | null;
	exitingVisual: GallerySelectionVisual | null;
	palette?: GalleryPalette;
	selectedColor?: string;
	onSelect: (id: string, origin: GallerySelectionOrigin) => void;
	className?: string;
}

export function GalleryTrack({
	items,
	selectedId,
	activeVisual,
	exitingVisual,
	palette,
	selectedColor,
	onSelect,
	className,
}: Readonly<GalleryTrackProps>): JSX.Element {
	const shouldReduceMotion = useReducedMotion();
	const containerVariants = shouldReduceMotion ? TRACK_CONTAINER_REDUCED : TRACK_CONTAINER;
	const { ref: overflowRef, canScrollLeft, canScrollRight } =
		useHasHorizontalOverflow<HTMLDivElement>({ reduceMotion: shouldReduceMotion ?? false });

	// Own RefObject (drag + dock read `.current`); merge with the hook's callback ref.
	const scrollRef = useRef<HTMLDivElement | null>(null);
	const setScrollRef = useCallback(
		(node: HTMLDivElement | null) => {
			scrollRef.current = node;
			overflowRef(node);
		},
		[overflowRef],
	);

	const pointerX = useDockPointer();
	const drag = useDragScroll(scrollRef);

	const handlePointerDown = useCallback(
		(event: PointerEvent<HTMLDivElement>) => {
			drag.onPointerDown(event);
		},
		[drag],
	);

	const handlePointerMove = useCallback(
		(event: PointerEvent<HTMLDivElement>) => {
			drag.onPointerMove(event);
			// Pause the dock (park cards at rest) the instant a press becomes a pan;
			// `wasDraggedRef` is updated synchronously inside `onPointerMove`.
			pointerX.set(drag.wasDraggedRef.current ? Number.POSITIVE_INFINITY : event.clientX);
		},
		[drag, pointerX],
	);

	const handlePointerUp = useCallback(
		(event: PointerEvent<HTMLDivElement>) => {
			drag.onPointerUp(event);
			pointerX.set(event.clientX);
		},
		[drag, pointerX],
	);

	const handlePointerLeave = useCallback(
		(event: PointerEvent<HTMLDivElement>) => {
			drag.onPointerLeave(event);
			pointerX.set(Number.POSITIVE_INFINITY);
		},
		[drag, pointerX],
	);
	const handleLostPointerCapture = useCallback(
		(event: PointerEvent<HTMLDivElement>) => {
			drag.onLostPointerCapture(event);
		},
		[drag],
	);

	return (
		// Relative wrapper hosts the scroller plus the fixed edge-blur overlays. It is a
		// plain div, so Motion's variant state still propagates through it (context) from
		// the strip down to the scroller/cards.
		<div className="relative">
			<motion.div
				ref={setScrollRef}
				variants={containerVariants}
				role="group"
				aria-label="Gallery items"
				onPointerDown={handlePointerDown}
				onPointerMove={handlePointerMove}
				onPointerUp={handlePointerUp}
				onPointerCancel={handlePointerUp}
				onPointerLeave={handlePointerLeave}
				onLostPointerCapture={handleLostPointerCapture}
				className={cn(
					// Bottom-aligned scroll strip with top headroom so magnified cards
					// grow upward without clipping. Scrollbar hidden; edge fades via mask.
					// `justify-center-safe` centers the cards when they fit; once they
					// overflow, `safe` falls back to start alignment so none are clipped
					// past the scroll origin and the strip stays fully scrollable.
					"relative flex items-end justify-center-safe gap-3 overflow-x-auto px-6 pt-24 pb-4",
					"[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
					"[mask-image:var(--gallery-edge-mask)] [-webkit-mask-image:var(--gallery-edge-mask)]",
					drag.dragging ? "cursor-grabbing select-none" : "cursor-grab",
					className,
				)}
				style={getGalleryEdgeMaskStyle(canScrollLeft, canScrollRight)}
			>
				{items.map((item) => (
					<GalleryCard
						key={item.id}
						item={item}
						pointerX={pointerX}
						scrollContainerRef={scrollRef}
						wasDraggedRef={drag.wasDraggedRef}
						dragging={drag.dragging}
						isSelected={selectedId === item.id}
						selectionVisual={getSelectionVisual(item.id, activeVisual, exitingVisual)}
						palette={palette}
						selectedColor={selectedColor}
						onSelect={onSelect}
					/>
				))}
			</motion.div>

			{/* Progressive blur pinned to each edge that actually has hidden content, so
			    cards soften into the fade instead of only turning transparent. */}
			{canScrollLeft ? (
				<div
					aria-hidden="true"
					className="pointer-events-none absolute inset-y-0 left-0"
					style={{ width: GALLERY_EDGE_BLUR_SIZE }}
				>
					{LEFT_BLUR_LAYERS.map((layerStyle, index) => (
						<div key={index} style={layerStyle} />
					))}
				</div>
			) : null}
			{canScrollRight ? (
				<div
					aria-hidden="true"
					className="pointer-events-none absolute inset-y-0 right-0"
					style={{ width: GALLERY_EDGE_BLUR_SIZE }}
				>
					{RIGHT_BLUR_LAYERS.map((layerStyle, index) => (
						<div key={index} style={layerStyle} />
					))}
				</div>
			) : null}
		</div>
	);
}
