"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, type Transition } from "motion/react";

import type { WorkItemSuggestion } from "@/components/blocks/jira-work-item/suggestion-canvas/data/suggestions";
import { motionDuration, motionEase, motionRecipe } from "@/lib/motion";
import { token } from "@/lib/tokens";

import { edgeFadeStyle, useScrollEdges } from "./use-scroll-edges";
import { WhyPaneContent } from "./why-pane";

/** Position, height and the crossfade share one curve, so following another row reads as one settle rather than a jump. */
const SETTLE: Transition = { duration: motionDuration.medium, ease: motionEase.inOut };
const FADE_OUT = { duration: motionDuration.fast, ease: motionEase.in };
const INSTANT: Transition = { duration: 0 };

/** How far the drawer tucks beneath the popover, so the join has no seam. */
export const DRAWER_TUCK = 12;

export interface PeekDrawerProps {
	suggestion: WorkItemSuggestion | undefined;
	/** Why a follow-up appeared, already resolved against the current decisions. */
	arrival: string | undefined;
	/** How far below the popover's top the drawer sits, so it reads beside the row it explains. */
	offset: number;
	pinned: boolean;
	/** The popover's height: the drawer never grows past it. */
	cap: number | null;
	id: string;
	titleId: string;
	onUnpin: () => void;
	onPointerEnter: () => void;
	/** Reports the drawer's visible height so the popover can square the corners it shares with it. */
	onHeight: (height: number | null) => void;
}

/**
 * The explanation drawer. It slides out from beneath the popover's left edge, sized to its content and capped at the
 * popover's height, and rides beside the row it explains. Moving between rows eases its position and height on one
 * curve while the content crossfades.
 */
export function PeekDrawer({ suggestion, arrival, offset, pinned, cap, id, titleId, onUnpin, onPointerEnter, onHeight }: Readonly<PeekDrawerProps>) {
	return (
		<AnimatePresence onExitComplete={() => onHeight(null)}>
			{suggestion ? (
				<FollowRail key="drawer" offset={offset}>
					{/* 304px with the tuck puts the drawer's outer edge on the main column's content gutter. */}
					<motion.aside
						animate={{ opacity: 1, x: 0, transition: motionRecipe.popup.enter }}
						aria-labelledby={titleId}
						className="relative w-[304px] rounded-xl bg-surface-overlay"
						exit={{ opacity: 0, x: 16, transition: motionRecipe.popup.exit }}
						id={id}
						initial={{ opacity: 0, x: 16 }}
						onPointerEnter={onPointerEnter}
						style={{ paddingRight: DRAWER_TUCK, boxShadow: token("elevation.shadow.overlay"), willChange: "transform, opacity" }}
					>
						<DrawerBody arrival={arrival} cap={cap} onHeight={onHeight} onUnpin={onUnpin} pinned={pinned} suggestion={suggestion} titleId={titleId} />
						{/* One hairline on the join, exactly on the popover's edge, so the two read as one surface in light and dark. */}
						<span aria-hidden="true" className="absolute top-0 bottom-0 w-px bg-border" style={{ right: DRAWER_TUCK }} />
					</motion.aside>
				</FollowRail>
			) : null}
		</AnimatePresence>
	);
}

/**
 * Carries the drawer's vertical position on its own element, so the aside keeps to two properties (fade and slide).
 * The first placement lands instantly; only later moves between rows ease.
 */
function FollowRail({ offset, children }: Readonly<{ offset: number; children: ReactNode }>) {
	const [placed, setPlaced] = useState(false);
	useEffect(() => {
		const frame = requestAnimationFrame(() => setPlaced(true));
		return () => cancelAnimationFrame(frame);
	}, []);
	return (
		<motion.div
			animate={{ y: offset }}
			className="absolute top-0 z-0"
			initial={{ y: offset }}
			style={{ right: `calc(100% - ${DRAWER_TUCK}px)`, willChange: "transform" }}
			transition={placed ? SETTLE : INSTANT}
		>
			{children}
		</motion.div>
	);
}

function DrawerBody({ suggestion, arrival, pinned, cap, titleId, onUnpin, onHeight }: Readonly<Omit<PeekDrawerProps, "id" | "onPointerEnter" | "offset"> & { suggestion: WorkItemSuggestion }>) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const layerRef = useRef<HTMLDivElement>(null);
	const [content, setContent] = useState<number | null>(null);
	const edges = useScrollEdges(scrollRef);

	useLayoutEffect(() => {
		const layer = layerRef.current;
		if (!layer) return undefined;
		const measure = () => setContent(layer.offsetHeight);
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(layer);
		return () => observer.disconnect();
	}, [suggestion.id]);

	useLayoutEffect(() => {
		scrollRef.current?.scrollTo({ top: 0 });
	}, [suggestion.id]);

	const height = content == null ? null : cap == null ? content : Math.min(content, cap);
	useLayoutEffect(() => {
		onHeight(height);
	}, [height, onHeight]);

	return (
		<motion.div animate={{ height: height ?? "auto" }} className="overflow-hidden" initial={false} transition={SETTLE}>
			<div className="h-full overflow-y-auto overscroll-contain" ref={scrollRef} style={edgeFadeStyle(edges)}>
				<div className="relative">
					<AnimatePresence initial={false} mode="popLayout">
						<motion.div
							animate={{ opacity: 1, transition: SETTLE }}
							className="w-full"
							exit={{ opacity: 0, transition: FADE_OUT }}
							initial={{ opacity: 0 }}
							key={suggestion.id}
							ref={layerRef}
							style={{ willChange: "opacity" }}
						>
							<WhyPaneContent arrival={arrival} onUnpin={onUnpin} pinned={pinned} suggestion={suggestion} titleId={titleId} />
						</motion.div>
					</AnimatePresence>
				</div>
			</div>
		</motion.div>
	);
}
