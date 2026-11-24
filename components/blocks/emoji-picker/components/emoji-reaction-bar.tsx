"use client";

import { useEffect, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

import type { EmojiReactionSummary } from "../data/emoji-frequent";
import { EmojiPickerPopover } from "./emoji-picker-popover";
import { EmojiReactionPill } from "./emoji-reaction-pill";

const CONFIRMATION_HOLD_MS = 250;

export interface EmojiReactionBarProps {
	reactions: readonly EmojiReactionSummary[];
	onToggleReaction: (emoji: string) => void;
	showAddReaction?: boolean;
	leading?: ReactNode;
	trailing?: ReactNode;
	frequent?: readonly string[];
	"aria-label"?: string;
	className?: string;
}

/**
 * The composed action row: leading slot (e.g. Reply), the reaction pills, the
 * add-reaction popover, then a trailing slot (e.g. Edit / More).
 *
 * Reaction data stays controlled — the consumer's reducer owns the toggle.
 * This row owns only the brief confirmation treatment for an active picker
 * choice; picker choices never remove reactions.
 */
export function EmojiReactionBar({
	reactions,
	onToggleReaction,
	showAddReaction = true,
	leading,
	trailing,
	frequent,
	"aria-label": ariaLabel = "Reactions",
	className,
}: Readonly<EmojiReactionBarProps>) {
	const [confirmedReaction, setConfirmedReaction] = useState<string | null>(null);

	useEffect(() => {
		if (!confirmedReaction) return;
		const timeoutId = window.setTimeout(
			() => setConfirmedReaction(null),
			CONFIRMATION_HOLD_MS,
		);
		return () => window.clearTimeout(timeoutId);
	}, [confirmedReaction]);

	function handlePickerSelect(emoji: string): void {
		const alreadyReacted = reactions.some(
			(reaction) => reaction.emoji === emoji && reaction.reacted,
		);
		if (alreadyReacted) {
			setConfirmedReaction(emoji);
			return;
		}
		onToggleReaction(emoji);
	}

	return (
		<div
			aria-label={ariaLabel}
			className={cn("flex flex-wrap items-center gap-1", className)}
			role="group"
		>
			{leading}
			{reactions.map((reaction) => (
				<EmojiReactionPill
					count={reaction.count}
					confirmed={confirmedReaction === reaction.emoji}
					emoji={reaction.emoji}
					key={reaction.emoji}
					label={reaction.label}
					onToggle={onToggleReaction}
					pressed={reaction.reacted}
					reactorNames={reaction.reactorNames}
				/>
			))}
			{showAddReaction ? (
				<EmojiPickerPopover
					frequent={frequent}
					onSelect={handlePickerSelect}
				/>
			) : null}
			{/*
			 * Trailing controls sit inline after the add-reaction button rather than
			 * being pushed to the far edge — the row reads as one continuous group.
			 * A consumer that wants them right-aligned can pass `ml-auto` itself.
			 */}
			{trailing ? <div className="flex items-center gap-1 empty:hidden">{trailing}</div> : null}
		</div>
	);
}
