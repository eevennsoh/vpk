"use client";

// oxlint-disable react-doctor/jsx-no-jsx-as-prop -- These components intentionally use slot/render-node props for icons, triggers, and adornments.

import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
	Plan,
	PlanAvatar,
	PlanContent,
	PlanDescription,
	PlanFooter,
	PlanHeader,
	PlanTitle,
	type PlanTask,
} from "@/components/ui/plan";
import {
	resolvePlanDisplayTitle,
	resolvePlanVisualIdentity,
	sanitizePlanDescription,
} from "@/components/projects/shared/lib/plan-identity";
import { runPlanBuildAndCollapse } from "@/components/projects/shared/lib/plan-widget-build-action";
import { PlanTabContent } from "@/components/projects/shared/lib/plan-card-utils";
import { VisualIdentityTile } from "@/components/projects/shared/components/visual-identity-tile";
import type { VisualIdentity } from "@/components/projects/shared/lib/visual-identity";
import { Button } from "@/components/ui/button";
import { Shimmer } from "@/components/ui-custom/shimmer";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";



interface CollapsedPlanBubbleProps {
	visualIdentity: VisualIdentity;
	onExpand: () => void;
	title: string;
}

function CollapsedPlanBubble({
	visualIdentity,
	onExpand,
	title,
}: Readonly<CollapsedPlanBubbleProps>) {
	return (
		<button
			type="button"
			aria-expanded={false}
			onClick={onExpand}
			className="group flex w-full items-center gap-3 rounded-xl bg-surface-raised shadow-xs px-4 py-3 text-left transition-colors hover:bg-surface-raised-hovered focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3 outline-none"
		>
			<VisualIdentityTile decorative label={title} visualIdentity={visualIdentity} />
			<span className="min-w-0 flex-1 truncate text-sm font-semibold text-text">{title}</span>
			<span
				aria-hidden="true"
				className="flex size-8 shrink-0 items-center justify-center rounded-full text-icon-subtle"
			>
				<ChevronRightIcon label="" size="small" />
			</span>
		</button>
	);
}

export interface PlanWidgetInlineCardProps {
	title: string;
	tasks: PlanTask[];
	description?: string;
	markdown?: string;
	shortDescription?: string;
	isStreaming?: boolean;
	isMetadataPending?: boolean;
	collapsed?: boolean;
	footer?: ReactNode;
	className?: string;
	onBuild?: () => void | Promise<void>;
	onOpenPreview?: () => void;
	isBuildDisabled?: boolean;
	buildDisabledReason?: string;
	shouldAutoCollapse?: boolean;
}

export function PlanWidgetInlineCard({
	title,
	tasks,
	description,
	markdown,
	shortDescription,
	isStreaming = false,
	isMetadataPending = false,
	collapsed: controlledCollapsed,
	footer = null,
	className,
	onBuild,
	onOpenPreview,
	isBuildDisabled = false,
	buildDisabledReason,
	shouldAutoCollapse = false,
}: Readonly<PlanWidgetInlineCardProps>): React.ReactElement | null {
	const [isOpen, setIsOpen] = useState(true);
	const [internalCollapsed, setInternalCollapsed] = useState(false);
	const isCollapsed = controlledCollapsed ?? internalCollapsed;
	const prevShouldAutoCollapseRef = useRef(false);

	useEffect(() => {
		const wasAutoCollapsed = prevShouldAutoCollapseRef.current;
		prevShouldAutoCollapseRef.current = shouldAutoCollapse;
		if (shouldAutoCollapse && !wasAutoCollapsed) {
			const timerId = window.setTimeout(() => {
				setInternalCollapsed(true);
			}, 0);
			return () => window.clearTimeout(timerId);
		}
	}, [shouldAutoCollapse]);

	const displayTitle = resolvePlanDisplayTitle(title, tasks);
	const displayDescription = sanitizePlanDescription(
		shortDescription?.trim() || description,
		tasks.length,
	);
	const displayVisualIdentity = resolvePlanVisualIdentity(displayTitle);
	const displayTitleNode = isMetadataPending ? (
		<Shimmer
			key={displayTitle}
			as="span"
			duration={1}
			className="block max-w-full truncate motion-safe:animate-[sd-blurIn_160ms_ease-out_both] motion-reduce:animate-none"
		>
			{displayTitle}
		</Shimmer>
	) : (
		displayTitle
	);
	const displayDescriptionNode = isMetadataPending ? (
		<Shimmer
			key={displayDescription}
			as="span"
			duration={1}
			className="block max-w-full truncate motion-safe:animate-[sd-blurIn_160ms_ease-out_both] motion-reduce:animate-none"
		>
			{displayDescription}
		</Shimmer>
	) : (
		displayDescription
	);
	const handleBuild = useCallback(async () => {
		try {
			await runPlanBuildAndCollapse(onBuild, () => {
				setInternalCollapsed(true);
			});
		} catch (error) {
			console.error("[PlanWidgetInlineCard] Failed to start build:", error);
		}
	}, [onBuild]);

	if (!title.trim()) {
		return null;
	}

	if (isCollapsed) {
		return (
			<CollapsedPlanBubble
				visualIdentity={displayVisualIdentity}
				onExpand={() => setInternalCollapsed(false)}
				title={displayTitle}
			/>
		);
	}

	return (
		<div className={cn("w-full", className)}>
			<Plan
				className="w-full gap-0 py-0 shadow-xs"
				open={isOpen}
				onOpenChange={setIsOpen}
				isStreaming={isStreaming}
			>
				<PlanHeader
					leading={<PlanAvatar><VisualIdentityTile decorative label="Plan" visualIdentity={displayVisualIdentity} /></PlanAvatar>}
					title={<PlanTitle className="truncate text-sm leading-5 font-semibold text-text">{displayTitleNode}</PlanTitle>}
					description={<PlanDescription className="truncate text-xs leading-4 text-text-subtlest">{displayDescriptionNode}</PlanDescription>}
				/>

				<PlanContent className="px-0 pb-0 pt-4">
					<PlanTabContent
						description={description ?? ""}
						markdown={markdown ?? ""}
					/>
					{onBuild ? (
						<PlanFooter className="border-t border-border flex-wrap px-4 py-4">
							<div className="flex items-center justify-end gap-2">
								{onOpenPreview ? (
									<Button
										disabled={isStreaming}
										onClick={onOpenPreview}
										type="button"
										variant="outline"
									>
										Open plan
									</Button>
								) : null}
								{isBuildDisabled && buildDisabledReason ? (
									<Tooltip>
										<TooltipTrigger render={<span className="inline-flex" />}>
											<Button
												disabled
												type="button"
											>
												Build
											</Button>
										</TooltipTrigger>
										<TooltipContent>{buildDisabledReason}</TooltipContent>
									</Tooltip>
								) : (
									<Button
										disabled={isBuildDisabled || isStreaming}
										onClick={() => {
											void handleBuild();
										}}
										type="button"
									>
										Build
									</Button>
								)}
							</div>
						</PlanFooter>
					) : footer ? (
						<PlanFooter className="border-t border-border px-4 py-3">{footer}</PlanFooter>
					) : null}
				</PlanContent>
				</Plan>
			</div>
		);
	}
