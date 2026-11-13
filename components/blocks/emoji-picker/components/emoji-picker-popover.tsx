"use client";

import EmojiAddIcon from "@atlaskit/icon/core/emoji-add";
import dynamic from "next/dynamic";
import { isValidElement, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { EmojiQuickBar } from "./emoji-quick-bar";

// Deferred so neither the picker library nor its emojibase JSON is touched
// until the viewer actually asks for the full picker via the "…" disclosure.
const EmojiPickerPanel = dynamic(() => import("./emoji-picker-panel"), {
	ssr: false,
	loading: () => (
		<div className="flex h-24 items-center justify-center text-sm text-text-subtlest">
			Loading emoji…
		</div>
	),
});

export interface EmojiPickerPopoverProps {
	onSelect: (emoji: string) => void;
	trigger?: ReactNode;
	triggerLabel?: string;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	align?: "start" | "center" | "end";
	side?: "top" | "bottom" | "left" | "right";
	defaultView?: "quick" | "full";
	frequent?: readonly string[];
	positionerClassName?: string;
	className?: string;
}

/**
 * Primary export of the block: an "Add reaction" popover that opens on the
 * six-emoji quick bar and discloses the full searchable picker on demand.
 *
 * Fully controlled with respect to reactions — it only emits `onSelect`; the
 * toggle math lives in the consumer.
 */
export function EmojiPickerPopover({
	onSelect,
	trigger,
	triggerLabel = "Add reaction",
	open,
	onOpenChange,
	align = "start",
	side = "bottom",
	defaultView = "quick",
	frequent,
	positionerClassName = "z-[502]",
	className,
}: Readonly<EmojiPickerPopoverProps>) {
	const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
	const [view, setView] = useState<"quick" | "full">(defaultView);
	const isOpen = open ?? uncontrolledOpen;
	const isFullView = view === "full";

	function handleOpenChange(nextOpen: boolean): void {
		if (open === undefined) {
			setUncontrolledOpen(nextOpen);
		}
		onOpenChange?.(nextOpen);
		// Reopening always starts from the requested view rather than wherever the
		// viewer left off.
		if (!nextOpen) {
			setView(defaultView);
		}
	}

	function handleSelect(emoji: string): void {
		onSelect(emoji);
	}

	const triggerElement = isValidElement(trigger) ? (
		trigger
	) : (
		<Button
			aria-label={triggerLabel}
			className="rounded-sm"
			size="icon-compact"
			type="button"
			variant="ghost"
		>
			{trigger ?? <EmojiAddIcon color="currentColor" label="" />}
		</Button>
	);

	return (
		<Popover onOpenChange={handleOpenChange} open={isOpen}>
			<PopoverTrigger render={triggerElement} />
			<PopoverContent
				align={align}
				// PopoverContent defaults to `gap-2.5 p-2.5`, which is too airy around a
				// row of icon buttons that carry their own hit padding. Both views use a
				// 4px frame; the full panel then owns its internal padding and width.
				className={cn(isFullView ? "w-72 gap-0 p-0" : "w-auto gap-0 p-1", className)}
				positionerClassName={positionerClassName}
				side={side}
				sideOffset={6}
			>
				{/*
				 * The quick bar stays mounted when the full panel opens. Unmounting it
				 * would destroy the "…" button that holds focus at that exact moment,
				 * stranding keyboard users on <body> outside a portalled, non-modal
				 * popup. Keeping it also makes its `aria-expanded` state truthful
				 * instead of permanently "false".
				 */}
				<EmojiQuickBar
					className={isFullView ? "p-1" : undefined}
					frequent={frequent}
					onSelect={handleSelect}
					onShowMore={() => setView(isFullView ? "quick" : "full")}
					showMoreExpanded={isFullView}
				/>
				{isFullView ? <div className="px-1 [--menu-inset:var(--ds-space-050,0.25rem)]"><DropdownMenuSeparator /></div> : null}
				{isFullView ? <EmojiPickerPanel onSelect={handleSelect} /> : null}
			</PopoverContent>
		</Popover>
	);
}
