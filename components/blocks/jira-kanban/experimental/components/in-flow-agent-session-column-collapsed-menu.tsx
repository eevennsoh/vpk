"use client";

import { useRef, useState, type ComponentProps, type PointerEvent } from "react";
import DragHandleVerticalIcon from "@atlaskit/icon/core/drag-handle-vertical";
import GrowHorizontalIcon from "@atlaskit/icon/core/grow-horizontal";
import PinIcon from "@atlaskit/icon/core/pin";
import PinFilledIcon from "@atlaskit/icon/core/pin-filled";
import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";

import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { useConeHoverIntent } from "@/components/utils/cone-safezone/use-cone-hover-intent";
import { cn } from "@/lib/utils";
import {
	inFlowCollapsedMenuPinLabel,
	shouldRestoreInFlowCollapsedMenuFocus,
} from "../lib/in-flow-agent-session-column-interaction";

const HOVER_OPEN_TRIGGER_CLASS_NAME =
	"aria-expanded:border-transparent aria-expanded:bg-bg-neutral-subtle-hovered aria-expanded:hover:bg-bg-neutral-subtle-hovered! aria-expanded:active:bg-bg-neutral-subtle-pressed! aria-expanded:text-text-subtle aria-expanded:[&_[data-slot=icon]]:text-icon-subtle aria-expanded:[&_svg]:text-icon-subtle";

export function InFlowAgentSessionColumnCollapsedMenu({
	className,
	dragging = false,
	open = false,
	onExpand,
	onOpenChange,
	onPinnedChange,
	pinned,
	title,
}: Readonly<{
	className: string;
	dragging?: boolean;
	open?: boolean;
	onExpand: () => void;
	onOpenChange: (open: boolean) => void;
	onPinnedChange: (pinned: boolean) => void;
	pinned: boolean;
	title: string;
}>) {
	const [hovered, setHovered] = useState(false);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const PinGlyph = pinned ? PinFilledIcon : PinIcon;
	const resolvedOpen = dragging ? false : open;
	const showDragHandle = dragging || resolvedOpen || hovered;
	const TriggerGlyph = showDragHandle ? DragHandleVerticalIcon : ShowMoreHorizontalIcon;
	const handleOpenChange: NonNullable<ComponentProps<typeof DropdownMenu>["onOpenChange"]> = (nextOpen) => {
		onOpenChange(dragging ? false : nextOpen);
	};
	const coneIntent = useConeHoverIntent(
		resolvedOpen,
		handleOpenChange,
		() => onOpenChange(false),
		300,
		() => triggerRef.current,
	);
	const { popupRef } = coneIntent;

	const handleTriggerPointerEnter = (event: PointerEvent<HTMLElement>) => {
		if (event.pointerType !== "touch") {
			setHovered(true);
		}
	};

	const handleTriggerPointerLeave = (event: PointerEvent<HTMLElement>) => {
		if (event.pointerType !== "touch") {
			setHovered(false);
		}
	};

	// DropdownMenuItem defaults to gap-3 plus a size-6 elemBefore slot. Match
	// QuickViewActionSubmenu: 12px glyph and gap-2, no empty indicator column.
	const itemClassName = "gap-2 [&>span:first-child]:size-3 [&_svg]:size-3";

	return (
		<DropdownMenu
			onOpenChange={coneIntent.onOpenChange}
			open={resolvedOpen}
		>
			<DropdownMenuTrigger
				delay={0}
				openOnHover
				onPointerEnter={handleTriggerPointerEnter}
				onPointerLeave={handleTriggerPointerLeave}
				render={
					<Button
						aria-label={`${title} column options`}
						className={cn(className, HOVER_OPEN_TRIGGER_CLASS_NAME)}
						data-agent-session-column-expand-control=""
						data-agent-session-column-options=""
						ref={triggerRef}
						size="icon-compact"
						style={{ width: "100%" }}
						type="button"
						variant={dragging ? "outline" : "ghost"}
					/>
				}
			>
				<Icon
					className="text-icon-subtle [&_svg]:size-3 [&_svg]:text-icon-subtle"
					data-agent-session-column-options-glyph={showDragHandle ? "drag-handle" : "more"}
					render={<TriggerGlyph color="currentColor" label="" size="small" />}
				/>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="start"
				className="min-w-0 w-max"
				finalFocus={shouldRestoreInFlowCollapsedMenuFocus}
				ref={popupRef}
				side="right"
			>
				<DropdownMenuItem
					className={itemClassName}
					elemBefore={<Icon className="text-icon-subtle" render={<PinGlyph label="" size="small" />} />}
					onSelect={() => {
						onPinnedChange(!pinned);
					}}
				>
					{inFlowCollapsedMenuPinLabel(pinned)}
				</DropdownMenuItem>
				<DropdownMenuItem
					className={itemClassName}
					elemBefore={
						<Icon
							className="text-icon-subtle"
							data-agent-session-expand-glyph="grow-horizontal"
							render={<GrowHorizontalIcon label="" size="small" />}
						/>
					}
					onSelect={onExpand}
				>
					Expand
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
