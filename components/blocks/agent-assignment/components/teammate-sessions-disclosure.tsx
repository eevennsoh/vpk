"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";
import { motion, useReducedMotion } from "motion/react";

import { TeammateSessionAvatars } from "@/components/blocks/agent-assignment/components/teammate-session-avatars";
import type { AgentSessionItem } from "@/components/blocks/agent-session/agent-session-types";
import { AGENT_SESSION_VIEWER_HINT } from "@/components/blocks/agent-session/agent-session-viewer-hint";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { motionDuration, motionRecipe } from "@/lib/motion";

export function TeammateSessionsDisclosure({ children, items }: Readonly<{
	children: ReactNode;
	items: readonly AgentSessionItem[];
}>) {
	const [open, setOpen] = useState(false);
	const reducedMotion = useReducedMotion();
	const trigger = useRef<HTMLButtonElement>(null);
	const panel = useRef<HTMLDivElement>(null);
	const hintId = useId();
	const labelBlur = reducedMotion ? "blur(0px)" : ["blur(0px)", "blur(2px)", "blur(0px)"];

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
				aria-label={open ? `${items.length} ${items.length === 1 ? "other session" : "other sessions"}` : "Other sessions"}
				className="relative flex w-full items-center rounded-lg px-3 py-1 text-left text-text-subtle hover:bg-bg-neutral-subtle-hovered focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
			>
				<motion.span
					className="inline-flex shrink-0"
					style={{ width: open ? 0 : undefined, marginRight: open ? 0 : 8 }}
					initial={false}
					animate={{ opacity: open ? 0 : 1, transform: open && !reducedMotion ? "translateY(8px)" : "translateY(0px)", transition: { ...motionRecipe.popup.enter, duration: reducedMotion ? 0 : (open ? motionRecipe.popup.enter.duration : motionDuration.slow), opacity: { duration: reducedMotion ? 0 : motionDuration.xxshort, delay: reducedMotion || open ? 0 : motionDuration.medium } } }}
				>
					<TeammateSessionAvatars items={items} />
				</motion.span>
				<motion.span className="inline-flex min-w-0 text-xs font-medium" data-teammate-disclosure-label="" layout={reducedMotion ? false : "position"} initial={false} animate={open ? "open" : "closed"} variants={{ open: { filter: labelBlur }, closed: { filter: labelBlur } }} transition={{ ...motionRecipe.popup.enter, duration: reducedMotion ? 0 : (open ? motionRecipe.popup.enter.duration : motionDuration.slow) }}>
					{open ? `${items.length} ${items.length === 1 ? "other session" : "other sessions"}` : "Other sessions"}
				</motion.span>
				<span aria-hidden="true" className="ml-auto grid size-6 shrink-0 place-items-center" data-teammate-disclosure-chevron="">
					<Icon className={cn("size-3 text-icon-subtle motion-safe:transition-transform motion-safe:duration-fast motion-safe:ease-out-practical", open ? "rotate-90" : null)} render={<ChevronRightIcon label="" size="small" />} />
				</span>
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
