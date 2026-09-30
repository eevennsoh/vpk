"use client";

import { useMemo, type CSSProperties, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react";

import { useJiraWorkItemState } from "@/components/blocks/jira-work-item/experimental/context-jira-work-item";
import { useHasActivity } from "@/components/blocks/jira-work-item/experimental/components/activity-panel";
import {
	METADATA_CONTENT_COLLAPSE_TRANSITION,
	METADATA_CONTENT_EXPAND_TRANSITION,
	METADATA_CONTENT_REDUCED_MOTION_TRANSITION,
} from "@/components/blocks/jira-work-item/experimental/context-panel-layout-motion";
import { usePanelLayout } from "@/components/blocks/jira-work-item/experimental/context-panel-layout";
import { useHasVerticalOverflow } from "@/components/hooks/use-has-vertical-overflow";
import {
	buildScrollMaskBlurLayerStyles,
	buildScrollMaskStyle,
	SCROLL_MASK_DEFAULT_FADE_SIZE,
} from "@/components/visual/scroll-mask/lib";
import { motionEase } from "@/lib/motion";

interface ExperimentalWorkItemLayoutProps {
	context: ReactNode;
	activity: ReactNode;
	metadata: ReactNode;
	composer: ReactNode;
	fillContainer?: boolean;
}

const METADATA_PANEL_WIDTH = "clamp(320px, 34vw, 408px)";
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
 * Responsive 4-slot layout for the experimental work item dialog body.
 *
 * Wide (container >= 860px): two scroll columns. The left column is a flex column
 * whose Context + Activity stack scrolls (`flex-1 overflow-y-auto`) while the
 * `composer` appears in a `shrink-0` footer after planner review, pinned to the
 * bottom of that column so it stays visible as the activity feed scrolls. The
 * right rail (clamp 320-408px) holds Metadata and scrolls independently.
 *
 * Narrow (< 860px): the columns collapse (`display: contents`) into a single
 * scroll flow ordered Context -> Activity -> Metadata -> Composer via
 * `order`. The composer becomes `sticky bottom-0` on a translucent, blurred dock so
 * it stays visible at the bottom of the single scroll. That outer scrollport owns a
 * matching progressive bottom mask while more content remains below. The same order
 * values also keep each wide column stacked correctly, so no slot is rendered twice.
 * The wide Context + Activity scrollport keeps its own top and bottom masks.
 *
 * Container-query driven (not viewport) so it reacts to the dialog's actual
 * body width rather than the screen.
 */
export function ExperimentalWorkItemLayout({
	context,
	activity,
	metadata,
	composer,
	fillContainer = false,
}: Readonly<ExperimentalWorkItemLayoutProps>) {
	const { planner } = useJiraWorkItemState();
	const hasActivity = useHasActivity();
	const { metadataCollapsed } = usePanelLayout();
	const shouldReduceMotion = useReducedMotion() ?? false;
	const showStickyComposer = planner.status === "inactive" || planner.status === "applied";
	const {
		ref: narrowScrollRef,
		showBottomScrollMask: showNarrowBottomScrollMask,
	} = useHasVerticalOverflow<HTMLDivElement>();
	const { ref: leftScrollRef, showTopScrollMask, showBottomScrollMask } = useHasVerticalOverflow<HTMLDivElement>();
	const leftScrollMaskStyle = useMemo(
		() => buildScrollMaskStyle({ fadeTop: showTopScrollMask, fadeBottom: showBottomScrollMask }),
		[showTopScrollMask, showBottomScrollMask],
	);
	const contentLayoutTransition = shouldReduceMotion
		? METADATA_CONTENT_REDUCED_MOTION_TRANSITION
		: metadataCollapsed
			? METADATA_CONTENT_COLLAPSE_TRANSITION
			: METADATA_CONTENT_EXPAND_TRANSITION;
	const contentStyle = {
		"--metadata-panel-offset": metadataCollapsed ? "0px" : METADATA_PANEL_WIDTH,
	} as CSSProperties;
	const constrainedColumnStyle = {
		maxWidth: metadataCollapsed ? "800px" : "100%",
	} as CSSProperties;
	const contentColumnStyle = fillContainer ? undefined : constrainedColumnStyle;
	const innerColumnStyle = fillContainer ? constrainedColumnStyle : undefined;

	return (
		<div className="@container/agentlayout h-full min-h-0 min-w-0">
			<div
				ref={narrowScrollRef}
				className="flex h-full min-h-0 min-w-0 flex-col gap-6 overflow-y-auto p-6 data-[fill-container]:pb-0 @[860px]/agentlayout:relative @[860px]/agentlayout:grid @[860px]/agentlayout:grid-cols-1 @[860px]/agentlayout:grid-rows-[minmax(0,1fr)] @[860px]/agentlayout:gap-0 @[860px]/agentlayout:overflow-hidden @[860px]/agentlayout:p-0"
				data-fill-container={fillContainer ? "" : undefined}
			>
				<div
					className="contents @[860px]/agentlayout:flex @[860px]/agentlayout:min-h-0 @[860px]/agentlayout:min-w-0 @[860px]/agentlayout:flex-1 @[860px]/agentlayout:flex-col @[860px]/agentlayout:[grid-area:1/1] @[860px]/agentlayout:[margin-right:var(--metadata-panel-offset)] motion-reduce:transition-none"
					style={contentStyle}
				>
					<motion.div
						className="contents @[860px]/agentlayout:mx-auto @[860px]/agentlayout:flex @[860px]/agentlayout:min-h-0 @[860px]/agentlayout:w-full @[860px]/agentlayout:flex-1 @[860px]/agentlayout:flex-col motion-reduce:transition-none"
						data-jira-work-item-content-column
						layout={shouldReduceMotion ? false : "position"}
						style={contentColumnStyle}
						transition={contentLayoutTransition}
					>
						<div
							ref={leftScrollRef}
							className="contents @[860px]/agentlayout:flex @[860px]/agentlayout:min-h-0 @[860px]/agentlayout:min-w-0 @[860px]/agentlayout:flex-1 @[860px]/agentlayout:flex-col @[860px]/agentlayout:overflow-y-auto @[860px]/agentlayout:pb-6"
							data-jira-work-item-scroll-region
							style={leftScrollMaskStyle}
						>
							<div
								className="contents @[860px]/agentlayout:mx-auto @[860px]/agentlayout:flex @[860px]/agentlayout:w-full @[860px]/agentlayout:flex-col @[860px]/agentlayout:gap-y-6 @[860px]/agentlayout:px-6"
								style={innerColumnStyle}
							>
								<div className="order-1 min-w-0">{context}</div>
								{hasActivity ? <div className="order-2 min-w-0">{activity}</div> : null}
							</div>
						</div>
						{showStickyComposer ? (
							<div
								className="order-5 min-w-0 sticky bottom-0 z-10 bg-transparent px-4 pt-3 pb-4 @[860px]/agentlayout:static @[860px]/agentlayout:shrink-0 @[860px]/agentlayout:px-0 @[860px]/agentlayout:pt-4 @[860px]/agentlayout:pb-6"
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
										<div className="absolute inset-0 bg-linear-to-b from-transparent to-background" />
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
				<AnimatePresence initial={false}>
					{metadataCollapsed ? null : (
						<motion.div
							animate="open"
							className="order-3 min-w-0 @[860px]/agentlayout:z-20 @[860px]/agentlayout:flex @[860px]/agentlayout:w-[clamp(320px,34vw,408px)] @[860px]/agentlayout:flex-col @[860px]/agentlayout:gap-4 @[860px]/agentlayout:justify-self-end @[860px]/agentlayout:self-stretch @[860px]/agentlayout:overflow-y-auto @[860px]/agentlayout:pr-6 @[860px]/agentlayout:pb-8 @[860px]/agentlayout:pl-2 @[860px]/agentlayout:[grid-area:1/1]"
							exit="closed"
							id="experimental-work-item-metadata-panel"
							initial="closed"
							style={{ willChange: shouldReduceMotion ? undefined : "transform" }}
							variants={shouldReduceMotion ? REDUCED_MOTION_METADATA_PANEL_VARIANTS : METADATA_PANEL_VARIANTS}
						>
							<div className="min-w-0">{metadata}</div>
						</motion.div>
					)}
				</AnimatePresence>
			</div>
		</div>
	);
}
