"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState, type JSX, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import { useLatestRef } from "@/lib/use-latest-ref";

import type { GalleryItem } from "../data/gallery-items";
import {
	DEFAULT_GALLERY_SELECTION_ORIGIN,
	GALLERY_SELECTION_SHADER_EXIT_OVERLAP_MS,
	type GallerySelectionOrigin,
	type GallerySelectionVisual,
} from "../lib/gallery-selection";
import { GalleryBackdrop } from "./gallery-backdrop";
import {
	GallerySelectedStage,
	type GalleryStagePosition,
} from "./gallery-selected-stage";
import { GalleryToggle, type GalleryTheme } from "./gallery-toggle";
import type { GalleryPalette } from "../lib/gallery-palette";
import { GalleryTrack } from "./gallery-track";

// The pinned strip is a pure ORCHESTRATION node: it carries no visual style of its
// own, only the active variant LABEL ("hidden"/"visible"/"exit") which propagates
// through the track down to each card AND into the backdrop's veil fade. Crucially it
// does NOT fade — a parent opacity fade multiplies its children, which previously
// MASKED the per-card reverse-stagger on close (the whole strip just dissolved as one
// block). With the fade owned by the backdrop layer (see gallery-backdrop.tsx), the
// cards' staggered rise/sink is the sole focal motion, and AnimatePresence still keeps
// the strip mounted until every descendant's exit completes. A card re-mounting after
// an expand→collapse does NOT replay the entrance (the parent is already at rest in
// "visible"); only the layout morph runs.
const STRIP = { hidden: {}, visible: {}, exit: {} } as const;

interface GalleryVisualState {
	active: GallerySelectionVisual | null;
	exiting: GallerySelectionVisual | null;
}

function createInitialVisualState(selectedId: string | null): GalleryVisualState {
	if (!selectedId) {
		return { active: null, exiting: null };
	}

	return {
		active: {
			id: selectedId,
			key: 0,
			origin: DEFAULT_GALLERY_SELECTION_ORIGIN,
			phase: "settled",
		},
		exiting: null,
	};
}

function resolveSelectedId(
	items: readonly GalleryItem[],
	selectedId: string | null | undefined,
): string | null {
	if (selectedId && items.some((item) => item.id === selectedId)) return selectedId;
	return items[0]?.id ?? null;
}

function renderDefaultSelectedItem(item: GalleryItem): ReactNode {
	return (
		<h2 className="text-center font-semibold text-4xl tracking-tight text-text sm:text-6xl">
			{item.title}
		</h2>
	);
}

export interface GalleryProps {
	items: readonly GalleryItem[];
	/** Label displayed in the Gallery control bar. */
	title?: string;
	/** Optional content centered in the Gallery control bar, such as a compact button group. */
	topBarCenter?: ReactNode;
	/** Optional compact center control shown below the large viewport breakpoint. */
	topBarCenterCompact?: ReactNode;
	/** Shows a 1px semantic border below the Gallery control bar. */
	showTopBarBorder?: boolean;
	/** Positions selected content below the 48px top bar; the bottom dock remains an overlay. */
	stagePosition?: GalleryStagePosition;
	/** Controlled visibility of the pinned strip. */
	open?: boolean;
	/** Uncontrolled initial visibility (default true). */
	defaultOpen?: boolean;
	onOpenChange?: (open: boolean) => void;
	selectedId?: string;
	defaultSelectedId?: string;
	onSelectedChange?: (selectedId: string) => void;
	renderSelectedItem?: (item: GalleryItem) => ReactNode;
	className?: string;
	/** Palette used for selected-card liquid highlights. Defaults to the standard blue treatment. */
	palette?: GalleryPalette;
	/** Solid selected-card color; omitting it uses the liquid gradient. */
	selectedColor?: string;
	/** Called after the selected prototype is reset to its initial mounted state. */
	onReset?: (item: GalleryItem) => void;
	/** Optional route-owned theme displayed by the Gallery theme control. */
	theme?: GalleryTheme;
	/** Cycles the optional route-owned theme. */
	onThemeCycle?: () => void;
}

export function Gallery({
	items,
	title = "Gallery",
	topBarCenter,
	topBarCenterCompact,
	showTopBarBorder = false,
	stagePosition = "top",
	open,
	defaultOpen = true,
	onOpenChange,
	selectedId,
	defaultSelectedId,
	onSelectedChange,
	renderSelectedItem = renderDefaultSelectedItem,
	className,
	palette,
	selectedColor,
	onReset,
	theme,
	onThemeCycle,
}: Readonly<GalleryProps>): JSX.Element {
	const shouldReduceMotion = useReducedMotion();
	const [internalOpen, setInternalOpen] = useState(defaultOpen);
	const [internalSelectedId, setInternalSelectedId] = useState<string | null>(() =>
		resolveSelectedId(items, defaultSelectedId),
	);
	const [visualState, setVisualState] = useState<GalleryVisualState>(() =>
		createInitialVisualState(resolveSelectedId(items, selectedId ?? defaultSelectedId)),
	);
	const [resetKey, setResetKey] = useState(0);
	const isOpenRef = useLatestRef(open ?? internalOpen);
	const selectionOriginsRef = useRef<Map<string, GallerySelectionOrigin>>(new Map());
	const visualKeyRef = useRef(1);

	const isOpen = open ?? internalOpen;
	// A single card has nothing to browse — keep the stage, collapse the bottom picker.
	const showCarouselPicker = items.length >= 2;
	const resolvedSelectedId = resolveSelectedId(items, selectedId ?? internalSelectedId);
	const selectedItem =
		resolvedSelectedId ? (items.find((item) => item.id === resolvedSelectedId) ?? null) : null;

	useEffect(() => {
		if (selectedId !== undefined) return;
		const nextSelectedId = resolveSelectedId(items, internalSelectedId);
		if (nextSelectedId !== internalSelectedId) {
			setInternalSelectedId(nextSelectedId);
		}
	}, [internalSelectedId, items, selectedId]);

	const handleToggle = useCallback(() => {
		const next = !isOpenRef.current;
		isOpenRef.current = next;
		if (open === undefined) setInternalOpen(next);
		onOpenChange?.(next);
	}, [isOpenRef, open, onOpenChange]);

	const handleSelect = useCallback(
		(id: string, origin: GallerySelectionOrigin) => {
			if (id === resolvedSelectedId) return;
			selectionOriginsRef.current.set(id, origin);
			if (selectedId === undefined) setInternalSelectedId(id);
			onSelectedChange?.(id);
		},
		[onSelectedChange, resolvedSelectedId, selectedId],
	);

	const handleReset = useCallback(() => {
		if (!selectedItem) return;
		setResetKey((current) => current + 1);
		onReset?.(selectedItem);
	}, [onReset, selectedItem]);

	useEffect(() => {
		if (!resolvedSelectedId) {
			setVisualState({ active: null, exiting: null });
			return;
		}
		const origin =
			selectionOriginsRef.current.get(resolvedSelectedId) ?? DEFAULT_GALLERY_SELECTION_ORIGIN;
		const nextVisualKey = visualKeyRef.current;
		visualKeyRef.current += 1;
		setVisualState((current) => {
			if (current.active?.id === resolvedSelectedId) {
				return current.active.origin === origin
					? current
					: { ...current, active: { ...current.active, origin } };
			}
			const nextActive: GallerySelectionVisual = {
				id: resolvedSelectedId,
				key: nextVisualKey,
				origin,
				phase: current.active ? "enter" : "settled",
			};
			return {
				active: nextActive,
				exiting:
					current.active && current.active.id !== resolvedSelectedId
						? { ...current.active, phase: "exit" }
						: null,
			};
		});
	}, [resolvedSelectedId]);

	useEffect(() => {
		if (!visualState.exiting) return;
		const exitingKey = visualState.exiting.key;
		const timeout = window.setTimeout(() => {
			setVisualState((current) =>
				current.exiting?.key === exitingKey ? { ...current, exiting: null } : current,
			);
		}, shouldReduceMotion ? 0 : GALLERY_SELECTION_SHADER_EXIT_OVERLAP_MS);
		return () => window.clearTimeout(timeout);
	}, [shouldReduceMotion, visualState.exiting]);

	return (
		// `h-full` (never a viewport-height class) so the Gallery fills whatever box it
		// is mounted in — the standalone route sizes that box to the viewport, while the
		// catalog demo shell sizes it to a fixed preview height. Consumers must give this
		// element a parent with a definite height.
		//
		// `@container/gallery-stage` publishes that box width as the container-query
		// basis for full-bleed stages, which break out of GallerySelectedStage's
		// `max-w-3xl` column with `left-1/2 w-[100cqw] -translate-x-1/2`. Using `100cqw`
		// rather than `100vw` keeps the breakout the width of the Gallery instead of the
		// window, so stages stay inside the demo shell instead of being clipped by it.
		<div
			className={cn(
				"@container/gallery-stage flex h-full min-h-0 flex-col overflow-hidden",
				className,
			)}
		>
			<GalleryToggle
				title={title}
				centerContent={topBarCenter}
				compactCenterContent={topBarCenterCompact}
				showBottomBorder={showTopBarBorder}
				open={isOpen}
				showOpenToggle={showCarouselPicker}
				onToggle={handleToggle}
				onReset={handleReset}
				theme={theme}
				onThemeCycle={onThemeCycle}
			/>

			{selectedItem ? (
				<GallerySelectedStage
					item={selectedItem}
					position={stagePosition}
					resetKey={resetKey}
					renderSelectedItem={renderSelectedItem}
				/>
			) : null}
			<AnimatePresence>
				{isOpen && showCarouselPicker ? (
					<motion.div
						key="gallery-strip"
						className="fixed inset-x-0 bottom-0 z-40"
						variants={STRIP}
						initial="hidden"
						animate="visible"
						exit="exit"
					>
						<GalleryBackdrop />
						<GalleryTrack
							items={items}
							selectedId={resolvedSelectedId}
							activeVisual={visualState.active}
							exitingVisual={visualState.exiting}
							palette={palette}
							selectedColor={selectedColor}
							onSelect={handleSelect}
						/>
					</motion.div>
				) : null}
			</AnimatePresence>
		</div>
	);
}
