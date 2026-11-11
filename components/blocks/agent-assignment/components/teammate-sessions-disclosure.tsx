"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { TeammateSessionAvatars } from "@/components/blocks/agent-assignment/components/teammate-session-avatars";
import type { AgentSessionItem } from "@/components/blocks/agent-session/agent-session-types";
import { AGENT_SESSION_VIEWER_HINT } from "@/components/blocks/agent-session/agent-session-viewer-hint";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { motionRecipe } from "@/lib/motion";

export function TeammateSessionsDisclosure({ children, items }: Readonly<{
	children: ReactNode;
	items: readonly AgentSessionItem[];
}>) {
	const [open, setOpen] = useState(false);
	const reducedMotion = useReducedMotion();
	const trigger = useRef<HTMLButtonElement>(null);
	const panel = useRef<HTMLDivElement>(null);
	const hintId = useId();

	return (
		<Collapsible open={open} onOpenChange={(nextOpen) => {
			if (!nextOpen && panel.current?.contains(document.activeElement)) trigger.current?.focus({ preventScroll: true });
			setOpen(nextOpen);
		}} onKeyDown={(event) => {
			// React portal events bubble here too. Leave their Escape handling to
			// the tooltip/menu owner, and honor an inner surface's consumed Escape.
			if (event.key !== "Escape" || !open || event.defaultPrevented || !event.currentTarget.contains(event.target as Node)) return;
			event.preventDefault();
			event.stopPropagation();
			trigger.current?.focus({ preventScroll: true });
			setOpen(false);
		}}>
			<CollapsibleTrigger
				ref={trigger}
				aria-describedby={hintId}
				className={cn("relative flex w-full flex-col gap-1 rounded-lg px-3 pt-1 text-left text-text-subtle hover:bg-bg-neutral-subtle-hovered focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring", open ? "pb-1" : "pb-2")}
			>
				<span className="flex w-full min-w-0 items-center gap-2">
					<span className="min-w-0 flex-1 text-xs font-medium">Sessions from your teammates</span>
					<span aria-hidden="true" className="grid size-6 shrink-0 place-items-center" data-teammate-disclosure-chevron="">
						<Icon className={cn("size-3 text-icon-subtle motion-safe:transition-transform motion-safe:duration-fast motion-safe:ease-out-practical", open ? "rotate-90" : null)} render={<ChevronRightIcon label="" size="small" />} />
					</span>
				</span>
				<AnimatePresence initial={false} mode="popLayout">
					{open ? null : (
						<motion.span
							key="teammate-avatars"
							className="inline-flex self-start"
							initial={reducedMotion ? false : { opacity: 0, transform: "translateY(8px)" }}
							animate={{ opacity: 1, transform: "translateY(0px)", transition: { ...motionRecipe.popup.enter, duration: reducedMotion ? 0 : motionRecipe.popup.enter.duration } }}
							exit={{ opacity: 0, transform: reducedMotion ? "none" : "translateY(8px)", transition: { ...motionRecipe.popup.exit, duration: reducedMotion ? 0 : motionRecipe.popup.exit.duration } }}
						>
							<TeammateSessionAvatars items={items} />
						</motion.span>
					)}
				</AnimatePresence>
			</CollapsibleTrigger>
			<p id={hintId} className="sr-only">{AGENT_SESSION_VIEWER_HINT}</p>
			<CollapsibleContent
				ref={panel}
				hiddenUntilFound={false}
				aria-hidden={!open}
				inert={!open}
				className="h-(--collapsible-panel-height) overflow-hidden motion-safe:transition-[height] motion-safe:duration-normal motion-safe:ease-out-practical data-starting-style:h-0 data-ending-style:h-0 motion-safe:data-ending-style:duration-fast motion-safe:data-ending-style:ease-in has-[:focus-visible]:overflow-visible"
			>
				{children}
			</CollapsibleContent>
		</Collapsible>
	);
}
