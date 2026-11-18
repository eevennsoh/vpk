"use client";

import * as React from "react";
import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import ThumbsDownIcon from "@atlaskit/icon/core/thumbs-down";
import ThumbsUpIcon from "@atlaskit/icon/core/thumbs-up";
import { toast } from "sonner";

import {
	Bubble,
	BubbleContent,
	BubbleGroup,
	BubbleReactions,
} from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Icon } from "@/components/ui/icon";
import { Marker, MarkerContent } from "@/components/ui/marker";
import { SonnerToast, Toaster } from "@/components/ui/sonner";

const longText = `The accessibility review found two focus states that were visually too subtle in dark mode.

I checked the dialog, menu, and drawer paths because each one renders focusable controls inside a layered surface.

The dialog and drawer are fine. The menu needs the hover and focus tokens split so keyboard focus stays visible when the pointer is not involved.

I also recommend keeping the change in the style file instead of the primitive so the other themes can choose their own focus treatment later.`;

const previewLength = 180;

const quickReplies = [
	{
		label: "I need help with my account.",
		message: "I need help with my account.",
	},
	{
		label: "I forgot my password.",
		message: "I forgot my password.",
	},
	{
		label: "I have another question. I'd like to talk to a human. Can you help me?",
		message: "I have another question.",
	},
];

export default function BubbleDemo() {
	return <BubbleDemoSizes />;
}

export function BubbleDemoSizes() {
	return (
		<div className="mx-auto flex w-full max-w-md flex-col gap-8">
			<Bubble align="end">
				<BubbleContent>This is a one line bubble.</BubbleContent>
			</Bubble>
			<Bubble align="end">
				<BubbleContent>
					This bubble has multiple lines. It should wrap to the next line and
					you should see a different radius on the corners.
				</BubbleContent>
			</Bubble>
			<Bubble align="end">
				<BubbleContent className="flex flex-col gap-2">
					<p>This bubble has multiple lines.</p>
					<p>
						It should wrap to the next line and you should see a different
						radius on the corners.
					</p>
					<p>Here is some more text to see how it wraps.</p>
				</BubbleContent>
			</Bubble>
		</div>
	);
}

export function BubbleDemoVariants() {
	return (
		<div className="mx-auto flex w-full max-w-md flex-col gap-8">
			<Bubble>
				<BubbleContent>
					Default bubbles use the neutral VPK message surface.
				</BubbleContent>
			</Bubble>
			<Bubble variant="primary">
				<BubbleContent>Primary bubbles use the emphasized brand surface.</BubbleContent>
			</Bubble>
			<Bubble variant="secondary">
				<BubbleContent>
					Secondary bubbles are the standard neutral surface for assistant and
					conversation content.
				</BubbleContent>
			</Bubble>
			<Bubble variant="muted">
				<BubbleContent>
					Muted bubbles lower the emphasis for quiet system notes or supporting
					content.
				</BubbleContent>
			</Bubble>
			<Bubble variant="tinted" align="end">
				<BubbleContent>
					Tinted bubbles use a softer primary tint when primary fill is too
					strong.
				</BubbleContent>
			</Bubble>
			<Bubble variant="outline">
				<BubbleContent>
					Outline bubbles can be used to frame message content and give it a
					border.
				</BubbleContent>
			</Bubble>
			<Bubble variant="destructive">
				<BubbleContent>
					Destructive bubbles flag errors or failed actions in a conversation.
				</BubbleContent>
			</Bubble>
			<Bubble variant="ghost">
				<BubbleContent>
					<span className="whitespace-pre-wrap">
						{`Ghost bubbles work for assistant text and other content that should not be framed.

This is perfect for assistant messages that should not have a frame and can take the full width of the container.

Ghost bubbles are full width and can take the full width of the container.`}
					</span>
				</BubbleContent>
			</Bubble>
		</div>
	);
}

export function BubbleDemoAlignment() {
	return (
		<div className="mx-auto flex w-full max-w-md flex-col gap-8">
			<Bubble variant="muted">
				<BubbleContent>This bubble is aligned to the start.</BubbleContent>
			</Bubble>
			<Bubble align="end">
				<BubbleContent>This bubble is aligned to the end.</BubbleContent>
			</Bubble>
			<Bubble variant="muted">
				<BubbleContent>
					This multiline bubble is aligned to the start. The corners should
					adjust when the text wraps to show the grouped side of the
					conversation.
				</BubbleContent>
			</Bubble>
			<Bubble align="end">
				<BubbleContent>
					This multiline bubble is aligned to the end. It should sit on the
					opposite side with the matching corner radius for wrapped text.
				</BubbleContent>
			</Bubble>
		</div>
	);
}

export function BubbleDemoGrouped() {
	return (
		<div className="mx-auto flex w-full max-w-md flex-col gap-8">
			<BubbleGroup>
				<Bubble variant="secondary">
					<BubbleContent>I finished the audit pass.</BubbleContent>
				</Bubble>
				<Bubble variant="secondary">
					<BubbleContent>
						The registry output looks clean, but I found one stale route.
					</BubbleContent>
				</Bubble>
				<Bubble variant="secondary">
					<BubbleContent>Want me to remove it now?</BubbleContent>
				</Bubble>
			</BubbleGroup>
			<BubbleGroup>
				<Bubble variant="tinted" align="end">
					<BubbleContent>Yes, clean that up.</BubbleContent>
				</Bubble>
				<Bubble variant="tinted" align="end">
					<BubbleContent>Then rerun the registry build.</BubbleContent>
				</Bubble>
			</BubbleGroup>
		</div>
	);
}

export function BubbleDemoCollapsible() {
	const [open, setOpen] = React.useState(false);
	const isLong = longText.length > previewLength;
	const preview = `${longText.slice(0, previewLength)}...`;

	return (
		<div className="mx-auto flex w-full max-w-md flex-col gap-8">
			<Collapsible open={open} onOpenChange={setOpen}>
				<Bubble variant="muted" align="end">
					<BubbleContent className="whitespace-pre-line">
						<div>{open || !isLong ? longText : preview}</div>
						{isLong ? (
							<CollapsibleTrigger
								render={
									<Button
										variant="link"
										className="h-auto gap-1 p-0 text-muted-foreground"
									/>
								}
							>
								{open ? "Show less" : "Show more"}
								<Icon
									render={<ChevronDownIcon label="" size="small" />}
									label=""
									className={open ? "rotate-180" : undefined}
								/>
							</CollapsibleTrigger>
						) : null}
					</BubbleContent>
				</Bubble>
			</Collapsible>
			<Bubble variant="ghost">
				<BubbleContent>
					<span className="whitespace-pre-wrap">
						{`Ghost bubbles work for assistant text and other content that should not be framed.

This is perfect for assistant messages that should not have a frame and can take the full width of the container.

Use this for content that needs the whole row.`}
					</span>
				</BubbleContent>
			</Bubble>
		</div>
	);
}

export function BubbleDemoButtonLinks() {
	return (
		<div className="mx-auto flex w-full max-w-md flex-col gap-8">
			<Bubble>
				<BubbleContent render={<a href="#button-links" />}>
					This bubble is a link.
				</BubbleContent>
			</Bubble>
			<Bubble variant="secondary">
				<BubbleContent
					render={
						<button
							type="button"
							onClick={() => toast("You clicked the bubble button")}
						/>
					}
				>
					This one is a button you can click.
				</BubbleContent>
			</Bubble>
			<Bubble variant="muted">
				<BubbleContent
					render={
						<button
							type="button"
							onClick={() => toast("You clicked the multiline bubble button")}
						/>
					}
				>
					You can also do tinted buttons. Even ones that are multilines.
				</BubbleContent>
			</Bubble>
			<Marker variant="separator">
				<MarkerContent>Chat Suggestions</MarkerContent>
			</Marker>
			<Bubble>
				<BubbleContent>How can I help you today?</BubbleContent>
			</Bubble>
			<BubbleGroup>
				{quickReplies.map((reply) => (
					<Bubble key={reply.label} variant="outline" align="end">
						<BubbleContent
							className="border-dashed border-primary"
							render={
								<button
									type="button"
									onClick={() => toast(reply.message)}
								/>
							}
						>
							{reply.label}
						</BubbleContent>
					</Bubble>
				))}
			</BubbleGroup>
		</div>
	);
}

export function BubbleDemoReactionPlacement() {
	return (
		<div className="mx-auto flex w-full max-w-md flex-col gap-12">
			<Marker variant="separator">
				<MarkerContent>side=bottom align=end</MarkerContent>
			</Marker>
			<Bubble>
				<BubbleContent>This is a one line message.</BubbleContent>
				<BubbleReactions side="bottom" align="end" role="img" aria-label="Reaction: thumbs up">
					<span>👍</span>
				</BubbleReactions>
			</Bubble>
			<Bubble variant="secondary" align="end">
				<BubbleContent>
					A longer message that wraps across lines so the reaction offset is
					easier to inspect.
				</BubbleContent>
				<BubbleReactions side="bottom" align="start" role="img" aria-label="Reactions: thumbs up and surprised">
					<span>👍</span>
					<span>😮</span>
				</BubbleReactions>
			</Bubble>
			<Bubble variant="tinted">
				<BubbleContent>
					A longer message that wraps across lines so the reaction offset is
					easier to inspect.
				</BubbleContent>
				<BubbleReactions side="bottom" align="end" role="img" aria-label="Reactions: thumbs up, surprised, fire, eyes, and 8 more">
					<span>👍</span>
					<span>😮</span>
					<span>🔥</span>
					<span>👀</span>
					<span>+8</span>
				</BubbleReactions>
			</Bubble>
			<Marker variant="separator">
				<MarkerContent>side=bottom align=start</MarkerContent>
			</Marker>
			<Bubble variant="secondary">
				<BubbleContent>This is a one line message.</BubbleContent>
				<BubbleReactions side="bottom" align="start" role="img" aria-label="Reaction: fire">
					<span>🔥</span>
				</BubbleReactions>
			</Bubble>
			<Bubble variant="secondary">
				<BubbleContent>
					A longer message that wraps across lines so the reaction offset is
					easier to inspect.
				</BubbleContent>
				<BubbleReactions side="bottom" align="start" role="img" aria-label="Reactions: thumbs up, surprised, fire, and eyes">
					<span>👍</span>
					<span>😮</span>
					<span>🔥</span>
					<span>👀</span>
				</BubbleReactions>
			</Bubble>
			<Marker variant="separator">
				<MarkerContent>side=top align=start</MarkerContent>
			</Marker>
			<Bubble variant="secondary">
				<BubbleContent>This is a one line message.</BubbleContent>
				<BubbleReactions side="top" align="start" role="img" aria-label="Reaction: fire">
					<span>🔥</span>
				</BubbleReactions>
			</Bubble>
			<Bubble variant="muted">
				<BubbleContent>
					A longer message that wraps across lines so the reaction offset is
					easier to inspect.
				</BubbleContent>
				<BubbleReactions side="top" align="end" role="img" aria-label="Reactions: thumbs up, surprised, fire, and eyes">
					<span>👍</span>
					<span>😮</span>
					<span>🔥</span>
					<span>👀</span>
				</BubbleReactions>
			</Bubble>
		</div>
	);
}

export function BubbleDemoReactionsButtons() {
	const toasterId = React.useId();
	const showReaction = (title: string) => {
		toast.custom(() => <SonnerToast title={title} />, { toasterId });
	};

	return (
		<div className="mx-auto flex w-full max-w-md flex-col gap-8">
			<Toaster id={toasterId} />
			<Bubble variant="destructive">
				<BubbleContent>Are you sure I can run this command?</BubbleContent>
				<BubbleReactions>
					<Button
						variant="ghost"
						size="compact"
						shape="circle"
						onClick={() => showReaction("You clicked yes, running command...")}
					>
						Yes, run it
					</Button>
				</BubbleReactions>
			</Bubble>
			<Bubble align="end">
				<BubbleContent>This is a one line message.</BubbleContent>
				<BubbleReactions align="start">
					<Button
						variant="ghost"
						size="icon-compact"
						shape="circle"
						aria-label="Celebrate"
						onClick={() => showReaction("Confetti!")}
					>
						🎉
					</Button>
				</BubbleReactions>
			</Bubble>
			<Bubble variant="tinted">
				<BubbleContent>
					We are going to the movies first then dinner. Are you in?
				</BubbleContent>
				<BubbleReactions className="gap-1 bg-background">
					<Button
						variant="secondary"
						size="icon-compact"
						shape="circle"
						aria-label="Thumbs up"
						onClick={() => showReaction("You agree!")}
					>
						<Icon render={<ThumbsUpIcon label="" size="small" />} label="" />
					</Button>
					<Button
						variant="secondary"
						size="icon-compact"
						shape="circle"
						aria-label="Thumbs down"
						onClick={() => showReaction("You disagree!")}
					>
						<Icon render={<ThumbsDownIcon label="" size="small" />} label="" />
					</Button>
				</BubbleReactions>
			</Bubble>
		</div>
	);
}
