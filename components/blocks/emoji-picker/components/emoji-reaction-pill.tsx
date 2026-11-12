"use client";

import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import TextMorphing from "@/components/visual/text-morphing";
import type { TextMorphConfig } from "@/components/visual/text-morphing/data";
import { cn } from "@/lib/utils";

import { emojiLabel, formatReactionActorNames } from "../data/emoji-frequent";

/**
 * Count morphing for a reaction chip. `number` rolls each digit in the direction
 * of the change — up as a reaction is added, down as it is removed — which is
 * exactly the signal a toggle wants. `snappy` is the variant's own default (see
 * `defaultAnimationForVariant`), and `autoSize` eases the chip's width on the
 * 9 → 10 digit gain so the row doesn't jump. `initial: false` keeps pills that
 * mount with an existing count from rolling in on first paint.
 *
 * `TextMorphing` degrades to static text under `prefers-reduced-motion`, so this
 * needs no separate reduced-motion guard.
 */
const REACTION_COUNT_MORPH: TextMorphConfig = {
	variant: "number",
	animation: "snappy",
	driftX: 0,
	driftY: 0,
	trend: 0,
	stagger: 0.02,
	initial: false,
	autoSize: true,
};

export interface EmojiReactionPillProps {
	emoji: string;
	count: number;
	pressed?: boolean;
	confirmed?: boolean;
	label?: string;
	reactorNames?: readonly string[];
	onToggle?: (emoji: string) => void;
	className?: string;
}

/**
 * A single reaction chip. Selected styling comes entirely from `aria-pressed`,
 * which the shared Button base already maps to the selected token set — this
 * component must never hand-roll those colors.
 *
 * Geometry matches `components/ui/tag.tsx`: the squarish `rounded-sm` corner and
 * 12px `text-xs` label, so a reaction chip reads as the same family as a Tag.
 * The glyph is a plain span, so the button's font-size sizes it and the count
 * together.
 */
export function EmojiReactionPill({
	emoji,
	count,
	pressed = false,
	confirmed = false,
	label,
	reactorNames,
	onToggle,
	className,
}: Readonly<EmojiReactionPillProps>) {
	const pill = (
		<Button
			// The glyph is `aria-hidden` below, so the name must spell it out —
			// interpolating the raw codepoint here would put it straight back in.
			// The visible count is kept in the name to satisfy WCAG 2.5.3 Label in Name.
			aria-label={label ?? `${count} reacted with ${emojiLabel(emoji)}`}
			aria-pressed={pressed}
			className={cn(
				"gap-1 rounded-sm px-2 text-xs font-normal tabular-nums duration-fast ease-out-practical motion-reduce:transition-none",
				confirmed && "aria-pressed:bg-bg-selected-hovered",
				className,
			)}
			onClick={() => onToggle?.(emoji)}
			size="compact"
			type="button"
			variant="outline"
		>
			<span aria-hidden="true">{emoji}</span>
			{/*
			 * The button's `aria-label` already speaks the count, so the morphing
			 * digits stay out of the accessibility tree — otherwise every rolling
			 * digit would be an extra exposed node churning mid-animation.
			 */}
			<span aria-hidden="true">
				<TextMorphing config={REACTION_COUNT_MORPH} text={String(count)} />
			</span>
		</Button>
	);

	if (!reactorNames?.length) return pill;

	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger render={pill} />
				<TooltipContent className="flex max-w-64 flex-col items-center pb-3 text-center">
					<h1 aria-hidden="true" className="p-3 text-4xl leading-none">
						{emoji}
					</h1>
					<p>
						{formatReactionActorNames(reactorNames)}{" "}
						<span>
							reacted with <span aria-hidden="true">{emoji}</span>
							<span className="sr-only">{emojiLabel(emoji)}</span>
						</span>
					</p>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}
