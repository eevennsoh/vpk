"use client";

import { useMemo, useId, useState, type FocusEvent } from "react";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

export interface ChatTimelineItem {
	id: string;
	label: string;
	text: string;
	timestampLabel?: string | null;
}

interface ChatTimelineNavigatorProps {
	activeItemId: string | null;
	appearance?: "surface" | "inverse";
	className?: string;
	/**
	 * Classes applied to the expanded flyout's stable pointer bridge (e.g.
	 * `pl-4` for a 16px inset). Use padding so the collapsed minimap's gutter
	 * remains inside the hover target while the flyout animates.
	 */
	expandedOffsetClassName?: string;
	/** Side of the collapsed minimap that the expanded flyout occupies. */
	flyoutSide?: "left" | "right";
	/** Order of the supplied items. Chat timelines default to newest-first data. */
	itemOrder?: "chronological" | "reverse-chronological";
	items: ReadonlyArray<ChatTimelineItem>;
	onSelectItem: (id: string) => void;
}

const BAR_HEIGHT_PX = 2;
const BAR_GAP_PX = 12;
const MINIMAP_PADDING_Y_PX = 12;
const MINIMAP_PADDING_X_PX = 4;
const MINIMAP_WIDTH_PX = 32;
const MINIMAP_MAX_BAR_WIDTH_PX = 24;

const TIMELINE_OPEN_HEIGHT_PX = 492;
const TIMELINE_OPEN_WIDTH_PX = 240;

function getBarWidth(text: string): number {
	const length = text.length;
	if (length < 40) return 8;
	if (length <= 120) return 16;
	return MINIMAP_MAX_BAR_WIDTH_PX;
}

function toSnippet(text: string, maxLength = 78): string {
	const normalized = text.replace(/\s+/gu, " ").trim();
	if (normalized.length <= maxLength) {
		return normalized;
	}

	return `${normalized.slice(0, maxLength - 1).trimEnd()}...`;
}

export function ChatTimelineNavigator({
	activeItemId,
	appearance = "surface",
	className,
	expandedOffsetClassName,
	flyoutSide = "left",
	itemOrder = "reverse-chronological",
	items,
	onSelectItem,
}: Readonly<ChatTimelineNavigatorProps>) {
	const navigatorId = useId();
	const [isNavigatorOpen, setIsNavigatorOpen] = useState(false);
	const isInverseAppearance = appearance === "inverse";

	const chronologicalItems = useMemo(
		() => itemOrder === "chronological" ? items : [...items].reverse(),
		[itemOrder, items],
	);
	const closedHeight =
		2 * MINIMAP_PADDING_Y_PX +
		chronologicalItems.length * BAR_HEIGHT_PX +
		Math.max(0, chronologicalItems.length - 1) * BAR_GAP_PX;
	const openHeight = Math.min(
		16 + items.length * 32 + Math.max(0, items.length - 1) * 2,
		TIMELINE_OPEN_HEIGHT_PX,
	);

	if (items.length <= 1) {
		return null;
	}

	function handleBlur(event: FocusEvent<HTMLDivElement>) {
		if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
			return;
		}

		setIsNavigatorOpen(false);
	}

	const shellBackgroundColor = isInverseAppearance ? "rgba(42,37,36,0.95)" : "var(--ds-surface-overlay)";
	const shellBoxShadow = isInverseAppearance
		? "0 32px 80px rgba(0,0,0,0.48)"
		: token("elevation.shadow.overlay");

	return (
		<div
			className={cn("relative", className)}
			onBlur={handleBlur}
			onFocusCapture={() => setIsNavigatorOpen(true)}
			style={{
				width: MINIMAP_WIDTH_PX,
				height: closedHeight,
			}}
		>
			{/* Minimap bars (collapsed state) */}
			<button
				aria-controls={navigatorId}
				aria-expanded={isNavigatorOpen}
				aria-label="Open prompt timeline"
				className={cn(
					"absolute inset-0 flex flex-col items-center justify-start transition-opacity focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none",
					isNavigatorOpen
						? "pointer-events-none opacity-0 duration-fast ease-in"
						: "pointer-events-auto opacity-100 duration-normal ease-out-practical",
					isInverseAppearance
						? "focus-visible:ring-white/35"
						: "focus-visible:ring-border-selected",
				)}
				onClick={() => setIsNavigatorOpen(true)}
				onMouseEnter={() => setIsNavigatorOpen(true)}
				style={{
					paddingTop: MINIMAP_PADDING_Y_PX,
					paddingBottom: MINIMAP_PADDING_Y_PX,
					paddingLeft: MINIMAP_PADDING_X_PX,
					paddingRight: MINIMAP_PADDING_X_PX,
					gap: BAR_GAP_PX,
				}}
				type="button"
			>
				{chronologicalItems.map((item) => {
					const isActive = item.id === activeItemId;
					return (
						<div
							className={cn(
								"shrink-0 rounded-full transition-colors",
								"duration-normal",
								isActive
									? (isInverseAppearance ? "bg-white/80" : "bg-icon-subtle")
									: (isInverseAppearance ? "bg-white/20" : "bg-icon-disabled"),
							)}
							key={item.id}
							style={{
								width: getBarWidth(item.text),
								height: BAR_HEIGHT_PX,
							}}
						/>
					);
				})}
			</button>

			{/* Stable pointer bridge; only the surface inside it moves. */}
			<div
				aria-hidden={!isNavigatorOpen}
				className={cn(
					"absolute top-1/2 -translate-y-1/2 transition-opacity motion-reduce:transition-none",
					flyoutSide === "right" ? "left-0" : "right-0",
					expandedOffsetClassName,
					isNavigatorOpen
						? "pointer-events-auto opacity-100 duration-normal ease-out-practical"
						: "pointer-events-none opacity-0 duration-fast ease-in",
				)}
				id={navigatorId}
				inert={!isNavigatorOpen ? true : undefined}
				onMouseLeave={() => setIsNavigatorOpen(false)}
			>
				<div
					className={cn(
						"relative flex origin-left flex-col overflow-hidden p-2 text-left transition-transform motion-reduce:translate-x-0 motion-reduce:transition-none",
						isNavigatorOpen
							? "translate-x-0 duration-normal ease-out-practical"
							: cn(
								flyoutSide === "right" ? "-translate-x-2" : "translate-x-2",
								"duration-fast ease-in",
							),
					)}
					style={{
						boxSizing: "border-box",
						width: TIMELINE_OPEN_WIDTH_PX,
						height: openHeight,
						borderRadius: 12,
						backgroundColor: shellBackgroundColor,
						boxShadow: shellBoxShadow,
					}}
				>
					<div className="min-h-0 flex-1 overflow-y-auto">
						<div className="flex flex-col gap-0.5">
							{chronologicalItems.map((item, index) => {
								const isActive = item.id === activeItemId;
								const isFirst = index === 0;
								const isLast = index === chronologicalItems.length - 1;
								return (
									<button
										className={cn(
											"flex w-full items-center p-2 text-left transition-colors ease-out",
											"duration-normal",
											isActive
												? (
													isInverseAppearance
														? "bg-white/[0.09] text-white"
														: "bg-bg-selected text-text-selected"
												)
												: (
													isInverseAppearance
														? "bg-transparent text-white/72 hover:bg-white/[0.06]"
														: "bg-surface text-text-subtle hover:bg-surface-hovered"
												),
										)}
										key={item.id}
										onClick={() => onSelectItem(item.id)}
										style={{
											borderRadius: isFirst
												? "8px 8px 4px 4px"
												: isLast
													? "4px 4px 8px 8px"
													: "4px",
										}}
										type="button"
									>
										<span className="truncate text-xs leading-4">
											{toSnippet(item.text)}
										</span>
									</button>
								);
							})}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
