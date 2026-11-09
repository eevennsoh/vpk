"use client";

import {
	useCallback,
	useEffect,
	useId,
	useRef,
	useState,
	type KeyboardEvent,
	type MouseEvent,
	type PointerEvent,
} from "react";
import { useReducedMotion } from "motion/react";

import type { JiraInsightCheckpoint } from "@/components/blocks/jira-insight/jira-insight-types";
import {
	buildJiraInsightTimelineTicks,
	findNearestVisibleTimelineButtonIndex,
	getTimelineKeyTargetIndex,
	getTimelineTickHeight,
	getTimelineWheelDelta,
} from "@/components/blocks/jira-insight/components/jira-insight-timeline-model";
import { useJiraInsightTimelineDrag } from "@/components/blocks/jira-insight/components/use-jira-insight-timeline-drag";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const MIN_TRACK_WIDTH_PX = 720;
const TRACK_EDGE_PADDING_PX = 56;
const TIMELINE_TICK_SPACING_PX = 32;
const ACTIVE_TICK_HEIGHT_PX = 34;

const TIMELINE_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
	day: "numeric",
	hour: "numeric",
	minute: "2-digit",
	month: "short",
	timeZone: "Australia/Sydney",
});

export interface JiraInsightTimelineRailProps {
	activeCheckpointId: string | null;
	activityTimestamps?: readonly number[];
	checkpoints: readonly JiraInsightCheckpoint[];
	className?: string;
	getCheckpointImportance?: (checkpoint: JiraInsightCheckpoint, index: number) => number;
	onCheckpointSelect: (id: string) => void;
}

function formatTimelineDate(capturedAtMs: number): string {
	return TIMELINE_DATE_FORMATTER.format(new Date(capturedAtMs));
}

function getButtonCenter(
	viewport: HTMLDivElement,
	viewportLeft: number,
	button: HTMLButtonElement,
): number {
	const buttonRect = button.getBoundingClientRect();
	return viewport.scrollLeft + buttonRect.left - viewportLeft + buttonRect.width / 2;
}

export function JiraInsightTimelineRail({
	activeCheckpointId,
	activityTimestamps = [],
	checkpoints,
	className,
	getCheckpointImportance,
	onCheckpointSelect,
}: Readonly<JiraInsightTimelineRailProps>) {
	const shouldReduceMotion = Boolean(useReducedMotion());
	const instructionsId = useId();
	const viewportRef = useRef<HTMLDivElement>(null);
	const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
	const scrollSelectionFrameRef = useRef<number | null>(null);
	const programmaticScrollTargetRef = useRef<number | null>(null);
	const activeCheckpointIdRef = useRef(activeCheckpointId);
	const [viewportWidth, setViewportWidth] = useState(0);
	const activeIndex = Math.max(0, checkpoints.findIndex((checkpoint) => checkpoint.id === activeCheckpointId));
	const activeCheckpoint = checkpoints[activeIndex];
	const timelineTicks = buildJiraInsightTimelineTicks(checkpoints, activityTimestamps);
	const timelineEdgePadding = Math.max(TRACK_EDGE_PADDING_PX, viewportWidth / 2);
	const trackWidth = Math.max(
		MIN_TRACK_WIDTH_PX,
		Math.max(1, timelineTicks.length - 1) * TIMELINE_TICK_SPACING_PX + timelineEdgePadding * 2,
	);
	const getTickPosition = useCallback((tickIndex: number) => {
		if (timelineTicks.length <= 1) return trackWidth / 2;
		const usableWidth = trackWidth - timelineEdgePadding * 2;
		return timelineEdgePadding + (tickIndex / (timelineTicks.length - 1)) * usableWidth;
	}, [timelineEdgePadding, timelineTicks.length, trackWidth]);

	useEffect(() => {
		activeCheckpointIdRef.current = activeCheckpointId;
	}, [activeCheckpointId]);

	useEffect(() => {
		const viewport = viewportRef.current;
		if (!viewport || typeof ResizeObserver === "undefined") return undefined;
		const syncViewportWidth = () => {
			setViewportWidth((currentWidth) => (
				currentWidth === viewport.clientWidth ? currentWidth : viewport.clientWidth
			));
		};
		syncViewportWidth();
		const observer = new ResizeObserver(syncViewportWidth);
		observer.observe(viewport);
		return () => observer.disconnect();
	}, []);

	const findNearestVisibleIndex = useCallback(() => {
		const viewport = viewportRef.current;
		if (!viewport) return null;
		return findNearestVisibleTimelineButtonIndex(viewport, buttonRefs.current);
	}, []);

	const selectNearestVisibleCheckpoint = useCallback(() => {
		if (programmaticScrollTargetRef.current != null) return;
		const index = findNearestVisibleIndex();
		const checkpoint = index == null ? undefined : checkpoints[index];
		if (checkpoint && checkpoint.id !== activeCheckpointIdRef.current) {
			onCheckpointSelect(checkpoint.id);
		}
	}, [checkpoints, findNearestVisibleIndex, onCheckpointSelect]);

	const drag = useJiraInsightTimelineDrag(viewportRef, selectNearestVisibleCheckpoint);

	const scrollIndexIntoView = useCallback((index: number) => {
		const viewport = viewportRef.current;
		const button = buttonRefs.current[index];
		if (!viewport || !button) return;
		const viewportLeft = viewport.getBoundingClientRect().left;
		const targetLeft = getButtonCenter(viewport, viewportLeft, button) - viewport.clientWidth / 2;
		const maxScrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
		const nextScrollLeft = Math.min(maxScrollLeft, Math.max(0, targetLeft));
		programmaticScrollTargetRef.current = Math.abs(viewport.scrollLeft - nextScrollLeft) <= 1
			? null
			: nextScrollLeft;
		viewport.scrollTo({
			behavior: shouldReduceMotion ? "auto" : "smooth",
			left: nextScrollLeft,
		});
	}, [shouldReduceMotion]);

	useEffect(() => {
		if (!activeCheckpoint) return;
		scrollIndexIntoView(activeIndex);
	}, [activeCheckpoint, activeIndex, scrollIndexIntoView]);

	useEffect(() => () => {
		if (scrollSelectionFrameRef.current != null) cancelAnimationFrame(scrollSelectionFrameRef.current);
	}, []);

	const handleScroll = useCallback(() => {
		if (scrollSelectionFrameRef.current != null) return;
		scrollSelectionFrameRef.current = requestAnimationFrame(selectNearestVisibleCheckpoint);
		requestAnimationFrame(() => {
			scrollSelectionFrameRef.current = null;
		});
	}, [selectNearestVisibleCheckpoint]);

	const handleWheel = useCallback((event: globalThis.WheelEvent) => {
		const viewport = viewportRef.current;
		if (!viewport) return;
		programmaticScrollTargetRef.current = null;
		const rawDelta = getTimelineWheelDelta(event);
		if (rawDelta === 0) return;
		const maxScrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
		if (maxScrollLeft === 0) return;
		const scale = event.deltaMode === WheelEvent.DOM_DELTA_LINE
			? 16
			: event.deltaMode === WheelEvent.DOM_DELTA_PAGE
				? viewport.clientWidth
				: 1;
		const nextScrollLeft = Math.min(
			maxScrollLeft,
			Math.max(0, viewport.scrollLeft + rawDelta * scale),
		);
		if (nextScrollLeft === viewport.scrollLeft) return;
		event.preventDefault();
		viewport.scrollLeft = nextScrollLeft;
	}, []);

	useEffect(() => {
		const viewport = viewportRef.current;
		if (!viewport) return undefined;
		viewport.addEventListener("wheel", handleWheel, { passive: false });
		return () => viewport.removeEventListener("wheel", handleWheel);
	}, [handleWheel]);

	const handlePointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
		programmaticScrollTargetRef.current = null;
		drag.onPointerDown(event);
	}, [drag]);

	const selectIndex = useCallback((index: number, focus = false) => {
		const checkpoint = checkpoints[index];
		if (!checkpoint) return;
		onCheckpointSelect(checkpoint.id);
		if (focus) buttonRefs.current[index]?.focus({ preventScroll: true });
		scrollIndexIntoView(index);
	}, [checkpoints, onCheckpointSelect, scrollIndexIntoView]);

	const handleTickKeyDown = useCallback((event: KeyboardEvent<HTMLButtonElement>, index: number) => {
		const targetIndex = getTimelineKeyTargetIndex(event.key, index, checkpoints.length);
		if (targetIndex == null) return;
		event.preventDefault();
		selectIndex(targetIndex, true);
	}, [checkpoints.length, selectIndex]);

	const handleTrackClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
		if (drag.wasDraggedRef.current || (event.target as HTMLElement).closest("button")) return;
		const viewport = viewportRef.current;
		if (!viewport) return;
		const viewportRect = viewport.getBoundingClientRect();
		const position = event.clientX - viewportRect.left + viewport.scrollLeft;
		let nearestIndex: number | null = null;
		let nearestDistance = Number.POSITIVE_INFINITY;
		for (let index = 0; index < buttonRefs.current.length; index += 1) {
			const button = buttonRefs.current[index];
			if (!button) continue;
			const distance = Math.abs(getButtonCenter(viewport, viewportRect.left, button) - position);
			if (distance < nearestDistance) {
				nearestDistance = distance;
				nearestIndex = index;
			}
		}
		if (nearestIndex != null) selectIndex(nearestIndex, true);
	}, [drag.wasDraggedRef, selectIndex]);

	if (!activeCheckpoint) return null;

	return (
		<section
			aria-label={`Decision timeline: ${activeCheckpoint.title}`}
			className={cn("min-w-0 rounded-lg bg-surface px-2 pb-1 pt-2", className)}
			data-jira-insight-timeline-rail
		>
			<p className="sr-only" id={instructionsId}>
				Decision {activeIndex + 1} of {checkpoints.length}. Use Left and Right Arrow keys to move between decisions. Scroll or drag the timeline to scrub.
			</p>
			<TooltipProvider delay={100}>
				<div
					aria-describedby={instructionsId}
					aria-label="Decision timeline"
					className={cn(
						"overflow-x-auto overscroll-x-contain [scrollbar-gutter:stable] touch-pan-x select-none",
						drag.isDragging ? "cursor-grabbing" : "cursor-grab",
					)}
					data-jira-insight-timeline-viewport
					onClick={handleTrackClick}
					onLostPointerCapture={drag.onLostPointerCapture}
					onPointerDown={handlePointerDown}
					onPointerLeave={drag.onPointerLeave}
					onPointerMove={drag.onPointerMove}
					onPointerUp={drag.onPointerUp}
					onScroll={handleScroll}
					ref={viewportRef}
					role="region"
				>
					<div className="relative h-28" style={{ width: trackWidth }}>
						<span aria-hidden className="absolute inset-x-0 bottom-3 h-px bg-border" />
						{timelineTicks.map((tick, tickIndex) => tick.kind === "activity" ? (
							<span
								aria-hidden
								className="absolute bottom-3 h-1.5 w-px bg-border-bold opacity-50"
								key={`activity-${tick.capturedAtMs}-${tickIndex}`}
								style={{ left: getTickPosition(tickIndex) }}
							/>
						) : null)}
						<ol className="absolute inset-0">
							{timelineTicks.map((tick, tickIndex) => {
								if (tick.kind === "activity") return null;
								const index = tick.checkpointIndex;
								const checkpoint = checkpoints[index];
								if (!checkpoint) return null;
								const isActive = checkpoint.id === activeCheckpoint.id;
								const tickHeight = isActive
									? ACTIVE_TICK_HEIGHT_PX
									: getTimelineTickHeight(
										checkpoints,
										index,
										getCheckpointImportance?.(checkpoint, index),
									);
								const formattedDate = formatTimelineDate(checkpoint.capturedAtMs);
								return (
									<li
										className="absolute inset-y-0 w-28 -translate-x-1/2"
										key={checkpoint.id}
										style={{ left: getTickPosition(tickIndex) }}
									>
									{isActive ? (
										<span
											aria-hidden
											className="pointer-events-none absolute bottom-[3.25rem] left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-bg-selected-bold px-3 py-1 text-xs font-medium tabular-nums text-text-inverse"
											data-jira-insight-active-marker
										>
											{formattedDate}
										</span>
									) : null}
									<Tooltip>
										<TooltipTrigger
											render={
												<button
													aria-current={isActive ? "step" : undefined}
													aria-label={`${formattedDate}: ${checkpoint.title}`}
													className="group absolute bottom-3 left-1/2 flex h-14 w-11 -translate-x-1/2 items-end justify-center rounded-sm outline-hidden focus-visible:ring-2 focus-visible:ring-border-focused focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised"
													onClick={() => {
														if (!drag.wasDraggedRef.current) selectIndex(index);
													}}
													onKeyDown={(event) => handleTickKeyDown(event, index)}
													ref={(node) => { buttonRefs.current[index] = node; }}
													tabIndex={isActive ? 0 : -1}
													type="button"
												/>
											}
										>
											<span
												aria-hidden
												className={cn(
													"absolute bottom-0 left-1/2 w-0.5 -translate-x-1/2 origin-bottom transition-[background-color,transform] duration-fast ease-out-practical motion-reduce:transition-none",
													isActive
														? "bg-bg-selected-bold"
														: "bg-border-bold group-hover:scale-y-110 group-hover:bg-text-subtle group-focus-visible:bg-text-subtle",
												)}
												style={{ height: tickHeight }}
											/>
										</TooltipTrigger>
										<TooltipContent className="max-w-64 px-3 py-2" side="top" sideOffset={10}>
											<p className="font-medium">{checkpoint.title}</p>
											<time className="mt-0.5 block tabular-nums text-text-inverse/80" dateTime={new Date(checkpoint.capturedAtMs).toISOString()}>
												{formattedDate}
											</time>
										</TooltipContent>
									</Tooltip>
									</li>
								);
							})}
						</ol>
					</div>
				</div>
			</TooltipProvider>
		</section>
	);
}
