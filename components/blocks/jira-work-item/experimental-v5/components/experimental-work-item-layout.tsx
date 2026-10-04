"use client";

import {
	useCallback,
	useLayoutEffect,
	useMemo,
	useRef,
	type CSSProperties,
	type ReactNode,
	type RefObject,
} from "react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react";

import { useJiraWorkItemState } from "@/components/blocks/jira-work-item/experimental-v5/context-jira-work-item";
import { useSectionNavigation } from "@/components/blocks/jira-work-item/experimental-v5/context-section-navigation";
import {
	METADATA_CONTENT_COLLAPSE_TRANSITION,
	METADATA_CONTENT_EXPAND_TRANSITION,
	METADATA_CONTENT_REDUCED_MOTION_TRANSITION,
} from "@/components/blocks/jira-work-item/experimental-v5/context-panel-layout-motion";
import { usePanelLayout } from "@/components/blocks/jira-work-item/experimental-v5/context-panel-layout";
import { useHasVerticalOverflow } from "@/components/hooks/use-has-vertical-overflow";
import { StickyRowScrollFade } from "@/components/visual/scroll-mask";
import {
	buildScrollMaskBlurLayerStyles,
	buildScrollMaskStyle,
	SCROLL_MASK_DEFAULT_FADE_SIZE,
} from "@/components/visual/scroll-mask/lib";
import { cn } from "@/lib/utils";
import { motionEase } from "@/lib/motion";

interface ExperimentalWorkItemLayoutProps {
	context: (scrollContainerRef: RefObject<HTMLDivElement | null>) => ReactNode;
	metadata: ReactNode;
	metadataPanelResizing: boolean;
	metadataPanelWidth: number;
	composer: ReactNode;
	fillContainer?: boolean;
}

const NARROW_BOTTOM_SCROLL_MASK_BLUR_LAYERS = buildScrollMaskBlurLayerStyles("bottom");

const METADATA_PANEL_VARIANTS: Variants = {
	closed: {
		transform: "translateX(100%)",
		transition: { duration: 0.2, ease: motionEase.in }, // duration-medium + ease-in
	},
	open: {
		transform: "translateX(0%)",
		transition: { duration: 0.25, ease: motionEase.out }, // duration-slow + ease-out
	},
};

const REDUCED_MOTION_METADATA_PANEL_VARIANTS: Variants = {
	closed: { transform: "translateX(0%)", transition: { duration: 0 } },
	open: { transform: "translateX(0%)", transition: { duration: 0 } },
};

/**
 * Wide-column body scroll mask. Fixed chrome owns the top seam, so the
 * scrollport only needs its progressive bottom mask.
 */
function useColumnScrollMask() {
	const { ref, showBottomScrollMask, showTopScrollMask } = useHasVerticalOverflow<HTMLDivElement>();
	const style = useMemo(
		() => buildScrollMaskStyle({
			fadeTop: false,
			fadeBottom: showBottomScrollMask,
		}),
		[showBottomScrollMask],
	);
	return { ref, showTopScrollMask, style } as const;
}

function DescriptionColumnShell({
	children,
	scrollRef,
	showTopScrollMask,
	style,
	bodyStyle,
}: Readonly<{
	children: ReactNode;
	scrollRef: (element: HTMLDivElement | null) => void;
	showTopScrollMask: boolean;
	style?: CSSProperties;
	bodyStyle?: CSSProperties;
}>) {
	const { planner } = useJiraWorkItemState();
	const hasPlanner = planner.status !== "inactive" && planner.status !== "applied";

	return (
		<div
			className="order-2 contents has-[[data-jira-work-item-pull-request-detail-header]]:[&_[data-sticky-row-scroll-fade]]:hidden @[860px]/agentlayout:flex @[860px]/agentlayout:min-h-0 @[860px]/agentlayout:min-w-0 @[860px]/agentlayout:flex-1 @[860px]/agentlayout:flex-col"
			data-jira-work-item-column-shell
		>
			<div
				className="group order-1 contents @[860px]/agentlayout:relative @[860px]/agentlayout:block @[860px]/agentlayout:shrink-0 @[860px]/agentlayout:px-6"
				data-jira-work-item-column-chrome
				data-scroll-fade-visible={showTopScrollMask ? "" : undefined}
			>
				<StickyRowScrollFade
					className={cn(
						"group-data-[scroll-fade-visible]:opacity-100",
						hasPlanner ? "[&>div]:from-bg-input" : undefined,
					)}
					data-slot="jira-work-item-resource-row-scroll-fade"
				/>
			</div>
			<div
				ref={scrollRef}
				className="order-2 contents has-[[data-jira-work-item-pull-request-detail-header]]:[overflow-anchor:none] @[860px]/agentlayout:relative @[860px]/agentlayout:block @[860px]/agentlayout:min-h-0 @[860px]/agentlayout:min-w-0 @[860px]/agentlayout:flex-1 @[860px]/agentlayout:overflow-y-auto @[860px]/agentlayout:overscroll-y-none @[860px]/agentlayout:px-6 @[860px]/agentlayout:pt-6 @[860px]/agentlayout:pb-6 @[860px]/agentlayout:has-[[data-insights-work-item-split]]:flex @[860px]/agentlayout:has-[[data-insights-work-item-split]]:flex-col @[860px]/agentlayout:has-[[data-insights-work-item-split]]:overflow-hidden"
				data-jira-work-item-scroll-region
				style={style}
			>
				<div
					className="order-2 relative z-0 min-w-0 @[860px]/agentlayout:mx-auto @[860px]/agentlayout:flex @[860px]/agentlayout:w-full @[860px]/agentlayout:flex-col @[860px]/agentlayout:gap-y-6 @[860px]/agentlayout:has-[[data-insights-work-item-split]]:min-h-0 @[860px]/agentlayout:has-[[data-insights-work-item-split]]:flex-1"
					data-jira-work-item-column-body
					style={bodyStyle}
				>
					{children}
				</div>
			</div>
		</div>
	);
}

export function ExperimentalWorkItemLayout({
	context,
	metadata,
	metadataPanelResizing,
	metadataPanelWidth,
	composer,
	fillContainer = false,
}: Readonly<ExperimentalWorkItemLayoutProps>) {
	const { planner } = useJiraWorkItemState();
	const { metadataCollapsed } = usePanelLayout();
	const { insightsSelected, setNarrowScrollContainer, setWideScrollContainer } = useSectionNavigation();
	const shouldReduceMotion = useReducedMotion() ?? false;
	const showStickyComposer = planner.status === "inactive" || planner.status === "applied";
	const {
		ref: narrowOverflowRef,
		showBottomScrollMask: showNarrowBottomScrollMask,
	} = useHasVerticalOverflow<HTMLDivElement>();
	const {
		ref: leftScrollMaskRef,
		showTopScrollMask: showLeftTopScrollMask,
		style: leftScrollMaskStyle,
	} = useColumnScrollMask();
	const leftScrollContainerRef = useRef<HTMLDivElement | null>(null);
	const setLeftScrollContainerRef = useCallback((element: HTMLDivElement | null) => {
		leftScrollContainerRef.current = element;
		leftScrollMaskRef(element);
		// Wide-mode scroller. Below 860px this element is `display: contents` and
		// does not scroll, so the section spy falls back to the narrow one.
		setWideScrollContainer(element);
	}, [leftScrollMaskRef, setWideScrollContainer]);
	useLayoutEffect(() => {
		if (insightsSelected) return;
		if (leftScrollContainerRef.current) {
			setWideScrollContainer(leftScrollContainerRef.current);
		}
	}, [insightsSelected, setWideScrollContainer]);
	const setNarrowScrollRef = useCallback((element: HTMLDivElement | null) => {
		narrowOverflowRef(element);
		setNarrowScrollContainer(element);
	}, [narrowOverflowRef, setNarrowScrollContainer]);
	const contentLayoutTransition = shouldReduceMotion
		? METADATA_CONTENT_REDUCED_MOTION_TRANSITION
		: metadataCollapsed
			? METADATA_CONTENT_COLLAPSE_TRANSITION
			: METADATA_CONTENT_EXPAND_TRANSITION;
	const contentStyle = {
		"--metadata-panel-offset": metadataCollapsed ? "0px" : `${metadataPanelWidth}px`,
	} as CSSProperties;
	const metadataPanelStyle = {
		"--metadata-panel-width": `${metadataPanelWidth}px`,
		willChange: shouldReduceMotion ? undefined : "transform",
	} as CSSProperties;
	const constrainedColumnStyle = {
		maxWidth: metadataCollapsed ? "800px" : "100%",
	} as CSSProperties;
	const contentColumnStyle = fillContainer ? undefined : constrainedColumnStyle;
	const innerColumnStyle = fillContainer ? constrainedColumnStyle : undefined;

	return (
		<div className="@container/agentlayout group/metadata-rail h-full min-h-0 min-w-0">
			<div
				ref={setNarrowScrollRef}
				className="flex h-full min-h-0 min-w-0 flex-col gap-6 overflow-y-auto overscroll-y-none p-6 data-[fill-container]:pb-0 @[860px]/agentlayout:relative @[860px]/agentlayout:grid @[860px]/agentlayout:grid-cols-1 @[860px]/agentlayout:grid-rows-[minmax(0,1fr)] @[860px]/agentlayout:gap-0 @[860px]/agentlayout:overflow-hidden @[860px]/agentlayout:p-0"
				data-fill-container={fillContainer ? "" : undefined}
			>
				{/* Description-scope hover group: left column only (not metadata). */}
				<div className="group/description-scope contents">
					<div
						className="contents @[860px]/agentlayout:flex @[860px]/agentlayout:min-h-0 @[860px]/agentlayout:min-w-0 @[860px]/agentlayout:flex-1 @[860px]/agentlayout:flex-col @[860px]/agentlayout:[grid-area:1/1] @[860px]/agentlayout:[margin-right:var(--metadata-panel-offset)] motion-reduce:transition-none"
						style={contentStyle}
					>
						{/* Only metadata width changes may project the column and docked composer. */}
						<motion.div
							className="contents @[860px]/agentlayout:mx-auto @[860px]/agentlayout:flex @[860px]/agentlayout:min-h-0 @[860px]/agentlayout:w-full @[860px]/agentlayout:flex-1 @[860px]/agentlayout:flex-col motion-reduce:transition-none"
							data-jira-work-item-content-column
							layout={shouldReduceMotion || metadataPanelResizing ? false : "position"}
							layoutDependency={metadataCollapsed}
							style={contentColumnStyle}
							transition={contentLayoutTransition}
						>
							<DescriptionColumnShell
								scrollRef={setLeftScrollContainerRef}
								showTopScrollMask={showLeftTopScrollMask}
								style={leftScrollMaskStyle}
								bodyStyle={innerColumnStyle}
							>
								{context(leftScrollContainerRef)}
							</DescriptionColumnShell>
							{showStickyComposer ? (
								<div
									className="order-5 min-w-0 sticky bottom-0 z-10 bg-surface-overlay px-4 pt-3 pb-4 @[860px]/agentlayout:static @[860px]/agentlayout:shrink-0 @[860px]/agentlayout:bg-transparent @[860px]/agentlayout:px-0 @[860px]/agentlayout:pt-4 @[860px]/agentlayout:pb-6"
									data-jira-work-item-composer-dock
								>
									{showNarrowBottomScrollMask ? (
										<div
											aria-hidden
											className="pointer-events-none absolute inset-x-0 bottom-full @[860px]/agentlayout:hidden"
											data-jira-work-item-narrow-scroll-mask
											style={{ height: SCROLL_MASK_DEFAULT_FADE_SIZE }}
										>
											{NARROW_BOTTOM_SCROLL_MASK_BLUR_LAYERS.map((layerStyle, index) => (
												<div key={index} style={layerStyle} />
											))}
											<div className="absolute inset-0 bg-linear-to-b from-transparent to-surface-overlay" />
										</div>
									) : null}
									<div
										className="contents @[860px]/agentlayout:mx-auto @[860px]/agentlayout:block @[860px]/agentlayout:w-full @[860px]/agentlayout:px-6"
										style={innerColumnStyle}
									>
										{composer}
									</div>
								</div>
							) : null}
						</motion.div>
					</div>
				</div>
				<AnimatePresence initial={false}>
					{metadataCollapsed ? null : (
						<motion.div
							animate="open"
							className={cn(
								"group/metadata-panel order-3 min-w-0",
								// Column positioning shell: the parent grid owns clipping while
								// MetadataRail owns the sticky chrome + body scroll chain.
								// Stays a real box in narrow (not `contents`) so order-3 keeps
								// Resources → Context → Metadata → Composer.
								"@[860px]/agentlayout:z-20 @[860px]/agentlayout:flex @[860px]/agentlayout:w-[var(--metadata-panel-width)] @[860px]/agentlayout:min-h-0 @[860px]/agentlayout:flex-col @[860px]/agentlayout:justify-self-end @[860px]/agentlayout:self-stretch @[860px]/agentlayout:overflow-visible @[860px]/agentlayout:px-6 @[860px]/agentlayout:pt-6 @[860px]/agentlayout:[grid-area:1/1]",
							)}
							exit="closed"
							id="experimental-work-item-metadata-panel"
							initial="closed"
							style={metadataPanelStyle}
							variants={shouldReduceMotion ? REDUCED_MOTION_METADATA_PANEL_VARIANTS : METADATA_PANEL_VARIANTS}
						>
							{/* min-h-0 flex-1: keep the chrome→scrollport height chain intact. */}
							<div className="flex min-h-0 min-w-0 flex-1 flex-col" data-jira-work-item-metadata-slot>
								{metadata}
							</div>
						</motion.div>
					)}
				</AnimatePresence>
			</div>
		</div>
	);
}
