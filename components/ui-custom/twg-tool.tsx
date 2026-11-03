"use client";

import type { ComponentProps, CSSProperties, ReactNode } from "react";
import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";

import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Icon } from "@/components/ui/icon";
import { CyclingByline } from "@/components/ui-custom/chain-of-thought";
import {
	TwgToolSourceStack,
	type TwgToolSource,
} from "@/components/ui-custom/twg-appstack";
import { TWGLoader } from "@/components/ui-custom/twg-loader";
import PatternTile, { type PatternStrokeOptions } from "@/components/website/demos/visual/pattern-tile";
import { cn } from "@/lib/utils";

export {
	TWGAppstack,
	TwgToolSourceIcon,
	TwgToolSourceStack,
	type TWGAppstackProps,
	type TwgToolSource,
	type TwgToolSourceIconProps,
	type TwgToolSourceIconSize,
	type TwgToolSourceProvider,
	type TwgToolSourceStackProps,
	type TwgToolThirdPartyProvider,
} from "@/components/ui-custom/twg-appstack";

export type TwgToolStatus = "active" | "complete" | "pending";
export type TwgToolBannerBackgroundFadeDirection = "horizontal" | "vertical";

export type TwgToolProps = Omit<ComponentProps<typeof Collapsible>, "children"> & {
	title?: ReactNode;
	status?: TwgToolStatus;
	description?: ReactNode;
	sources?: ReadonlyArray<TwgToolSource>;
	loader?: ReactNode;
	showChevron?: boolean;
	showLoader?: boolean;
	chevronOpen?: boolean;
	onBannerClick?: () => void;
	contentClassName?: string;
	children?: ReactNode;
};

export interface TwgToolBannerBackgroundProps {
	fadeDirection?: TwgToolBannerBackgroundFadeDirection;
	gridMaskPosition?: CSSProperties["maskPosition"];
}

const bannerGridStroke = {
	width: 1,
} satisfies PatternStrokeOptions;

const bannerGridFadeStyles = {
	horizontal: {
		backgroundImage:
			"linear-gradient(90deg, var(--color-surface-raised) 0%, color-mix(in srgb, var(--color-surface-raised) 18%, transparent) 44%)",
	},
	vertical: {
		backgroundImage:
			"linear-gradient(to bottom, var(--color-surface-raised) 0%, color-mix(in srgb, var(--color-surface-raised) 18%, transparent) 44%)",
	},
} satisfies Record<TwgToolBannerBackgroundFadeDirection, CSSProperties>;

export function TwgToolBannerBackground({
	fadeDirection = "horizontal",
	gridMaskPosition,
}: Readonly<TwgToolBannerBackgroundProps>) {
	return (
		<div aria-hidden="true" className="pointer-events-none absolute inset-0">
			<PatternTile
				className="text-border"
				patternType="grid"
				front="currentColor"
				back="transparent"
				scale={24}
				stroke={bannerGridStroke}
				fill="tile"
				opacity={0.72}
				style={{ maskPosition: gridMaskPosition }}
			/>
			<div className="absolute inset-0" style={bannerGridFadeStyles[fadeDirection]} />
		</div>
	);
}

export function TwgTool({
	className,
	children,
	description,
	chevronOpen,
	loader,
	onBannerClick,
	contentClassName,
	showChevron = true,
	showLoader = true,
	sources = [],
	status = "active",
	title = "Searching Teamwork Graph",
	...props
}: TwgToolProps) {
	const hasExpandableContent = children != null && showChevron;
	const shouldRenderButtonBanner = !hasExpandableContent && onBannerClick != null;
	const shouldRotateChevron = chevronOpen ?? false;
	const bannerPaddingClassName = showLoader ? "pl-1" : "";
	const bannerContent = (
		<>
			{showLoader ? (
				loader ?? (
					<span className="relative z-10 flex size-8 shrink-0 items-center justify-center">
						<TWGLoader label="Teamwork Graph" size="small" />
					</span>
				)
			) : null}
			<span className="relative z-10 grid min-w-0 flex-1 gap-0.5 text-sm text-text-subtle">
				<span className="inline-flex min-w-0 items-start gap-1.5">
					<span className="min-w-0 truncate">{title}</span>
					{showChevron ? (
						<Icon
							aria-hidden
							render={<ChevronRightIcon label="" size="small" spacing="none" />}
							className={cn(
								"mt-0.5 size-4 shrink-0 text-icon-subtle transition-transform duration-medium",
								hasExpandableContent
									? "group-data-[open]/twg:rotate-90"
									: shouldRotateChevron
										? "rotate-90"
										: null
							)}
						/>
					) : null}
				</span>
				{description ? (
					<CyclingByline>{description}</CyclingByline>
				) : null}
			</span>
			<TwgToolSourceStack
				sources={sources}
				className="relative z-10 max-w-[44%]"
			/>
		</>
	);

	return (
		<Collapsible
			className={cn("group/twg not-prose w-full", className)}
			data-status={status}
			{...props}
		>
			{hasExpandableContent ? (
				<CollapsibleTrigger
					className={cn("relative flex h-12 min-w-0 flex-1 items-center justify-between gap-3 overflow-hidden rounded-lg bg-surface-sunken pr-2 text-left outline-none transition-colors hover:bg-surface-raised-hovered focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3", bannerPaddingClassName)}
				>
					<TwgToolBannerBackground />
					{bannerContent}
				</CollapsibleTrigger>
			) : shouldRenderButtonBanner ? (
				<button
					aria-expanded={chevronOpen}
					className={cn("relative flex h-12 min-w-0 flex-1 items-center justify-between gap-3 overflow-hidden rounded-lg bg-surface-sunken pr-2 text-left outline-none transition-colors hover:bg-surface-raised-hovered focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3", bannerPaddingClassName)}
					onClick={onBannerClick}
					type="button"
				>
					<TwgToolBannerBackground />
					{bannerContent}
				</button>
			) : (
				<div
					className={cn("relative flex h-12 min-w-0 flex-1 items-center justify-between gap-3 overflow-hidden rounded-lg bg-surface-sunken pr-2", bannerPaddingClassName)}
				>
					<TwgToolBannerBackground />
					{bannerContent}
				</div>
			)}
			{hasExpandableContent ? (
				<CollapsibleContent
					className={cn(
						"mt-2 pl-12 overflow-hidden text-xs leading-5 text-text-subtle",
						"h-(--collapsible-panel-height) outline-none transition-[height,opacity] duration-medium ease-out data-starting-style:h-0 data-starting-style:opacity-0 data-ending-style:h-0 data-ending-style:opacity-0",
						contentClassName,
					)}
				>
					{children}
				</CollapsibleContent>
			) : null}
		</Collapsible>
	);
}
