"use client";

import { useRef, useState } from "react";
import AddIcon from "@atlaskit/icon/core/add";
import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface JiraListColumnBoundaryProps {
	anchorLabel: string;
	anchorSide: "left" | "right";
	boundaryIndex: number;
	hasStickyFooter: boolean;
	isTargeted: boolean;
	positionAnchor: string;
	positionLabel: string;
}

export function JiraListColumnBoundary({
	anchorLabel,
	anchorSide,
	boundaryIndex,
	hasStickyFooter,
	isTargeted,
	positionAnchor,
	positionLabel,
}: Readonly<JiraListColumnBoundaryProps>) {
	const [isHovered, setIsHovered] = useState(false);
	const [isFocused, setIsFocused] = useState(false);
	const markerRef = useRef<HTMLSpanElement>(null);
	const isLineActive = isTargeted || isHovered || isFocused;

	return (
		<div
			className={cn("pointer-events-none absolute top-0 z-40 w-0 overflow-visible", hasStickyFooter ? "bottom-10" : "bottom-0")}
			data-anchor-label={anchorLabel}
			data-testid={`jira-list-column-boundary-${boundaryIndex}`}
			style={{
				left: anchorSide === "left" ? "anchor(left)" : "anchor(right)",
				positionAnchor,
				top: 0,
			}}
		>
			<span
				aria-hidden="true"
				className={cn(
					"pointer-events-none absolute inset-y-0 left-0 w-0.5 -translate-x-1/2 bg-border-selected opacity-0 transition-opacity duration-fast",
					isLineActive && "opacity-100",
				)}
				data-boundary-line
			/>
			<Tooltip>
				<TooltipTrigger
					render={<Button
						aria-label={`Add column ${positionLabel}`}
						className="group/column-boundary pointer-events-auto absolute inset-y-0 -left-2.5 h-auto w-5 rounded-none border-0 bg-transparent! p-0 focus-visible:ring-0"
						data-boundary-control
						onBlur={() => setIsFocused(false)}
						onFocus={() => setIsFocused(true)}
						onPointerEnter={() => setIsHovered(true)}
						onPointerLeave={() => setIsHovered(false)}
						variant="ghost"
					/>}
				>
					<span
						className={cn(
							"pointer-events-auto fixed z-50 grid size-5 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-border bg-surface-overlay text-icon-subtle opacity-0 group-hover/column-boundary:bg-surface-overlay-hovered group-active/column-boundary:bg-surface-overlay-pressed group-focus-visible/column-boundary:ring-3 group-focus-visible/column-boundary:ring-ring/50",
							isLineActive && "opacity-100",
						)}
						data-boundary-marker
						ref={markerRef}
						style={{
							left: anchorSide === "left" ? "anchor(left, -100vw)" : "anchor(right, -100vw)",
							positionAnchor,
							positionVisibility: "anchors-visible",
							top: "anchor(top, -100vh)",
						}}
					>
						<Icon render={<AddIcon label="" size="small" />} />
					</span>
				</TooltipTrigger>
				<TooltipContent anchor={markerRef}>Add column</TooltipContent>
			</Tooltip>
		</div>
	);
}

export function JiraListColumnActions({ label }: Readonly<{ label: string }>) {
	const actionLabel = `More actions for ${label}`;

	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<Button
						aria-label={actionLabel}
						className="ml-auto size-7 shrink-0 rounded-md bg-surface-sunken opacity-0 transition-[opacity,background-color] duration-fast hover:opacity-100 focus-visible:opacity-100 group-hover/column-header:opacity-100 group-has-[:focus-visible]/column-header:opacity-100"
						data-column-action
						size="icon-compact"
						variant="ghost"
					/>
				}
			>
				<Icon render={<ShowMoreHorizontalIcon label="" size="small" />} />
			</TooltipTrigger>
			<TooltipContent>{actionLabel}</TooltipContent>
		</Tooltip>
	);
}
