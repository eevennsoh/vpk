"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion, useTransform } from "motion/react";
import { ProjectButterAttachmentCard, type AttachmentCardActions } from "@/components/blocks/jira-work-item/project-butter/attachment-card";
import type { AttachmentPile, ProjectButterAttachment } from "@/components/blocks/jira-work-item/project-butter/attachment-data";
import { useAttachmentPilePointer, type AttachmentPilePointer } from "@/components/blocks/jira-work-item/project-butter/use-attachment-pile-pointer";
import { motionDuration, motionEase } from "@/lib/motion";
import { cn } from "@/lib/utils";

function PileCount({ count }: Readonly<{ count: number }>) {
	return <span aria-hidden className="relative inline-grid h-4 overflow-hidden font-normal text-text-subtle tabular-nums">
		<span className="invisible">{count}</span>
		<AnimatePresence initial={false} mode="popLayout"><motion.span animate={{ y: "0%" }} className="absolute inset-0" exit={{ y: "-100%" }} initial={{ y: "100%" }} key={count} transition={{ duration: motionDuration.normal, ease: motionEase.outPractical }}>{count}</motion.span></AnimatePresence>
	</span>;
}

function PileCard({ item, index, count, piled, pointer, onPreview, onRemove }: Readonly<AttachmentCardActions & {
	item: ProjectButterAttachment; index: number; count: number; piled: boolean; pointer: AttachmentPilePointer;
}>) {
	const rest = piled ? { x: index === 0 ? 0 : index === 1 ? 4 : -4, y: index === 0 ? 0 : 2, rotate: index === 0 ? 0 : index === 1 ? 4 : -5 } : { x: 0, y: 0, rotate: 0 };
	// Fan direction and strength: the top card swings left a little less than the back cards swing out.
	const fan = !piled ? 0 : index === 0 ? -0.7 : rest.x < 0 ? -1 : 1;
	const live = piled ? 1 : 0;
	// Every card fans away on its own side, opening wider when the pointer is over that side.
	const opening = () => live * fan * pointer.spread.get() * (1 + Math.max(0, pointer.lean.get() * fan) * 0.5);
	const x = useTransform(() => opening() * 3);
	const y = useTransform(() => live * Math.abs(fan) * pointer.spread.get() * -1);
	const rotate = useTransform(() => opening() * 3);
	return (
		<motion.div
			animate={rest}
			aria-hidden={piled || undefined}
			className={cn("min-w-0", piled || index === 0 ? "absolute inset-0" : "relative")}
			data-attachment-card={item.id}
			inert={piled}
			layout
			layoutId={item.id}
			style={{ zIndex: count - index, pointerEvents: piled ? "none" : undefined, willChange: "transform" }}
			transition={{ duration: piled ? motionDuration.medium : motionDuration.slow, ease: motionEase.outPractical }}
		>
			<motion.div style={{ x, y, rotate, originY: 1, willChange: "transform" }}><ProjectButterAttachmentCard item={item} onPreview={onPreview} onRemove={onRemove} /></motion.div>
		</motion.div>
	);
}

export function ProjectButterAttachmentStack({ pile, onPreview, onRemove }: Readonly<AttachmentCardActions & { pile: AttachmentPile }>) {
	const [open, setOpen] = useState(false);
	const toggle = useRef<HTMLButtonElement>(null);
	const pointer = useAttachmentPilePointer();
	const first = pile.items[0];
	if (!first) return null;
	return (
		<div aria-label={`${pile.label}, ${pile.items.length} attachments`} className="contents" onKeyDownCapture={(event) => {
			if (!open || event.key !== "Escape" || (event.target instanceof Element && event.target.closest('[role="menu"]'))) return;
			event.preventDefault(); event.stopPropagation(); pointer.reset(); setOpen(false); toggle.current?.focus();
		}} role="group">
			<motion.div className="relative min-w-0" data-attachment-stack={pile.type} data-expanded={open} layout transition={{ layout: { duration: open ? motionDuration.slow : motionDuration.medium, ease: motionEase.outPractical } }}>
				<div className="relative h-29">
					<PileCard count={pile.items.length} index={0} item={first} onPreview={onPreview} onRemove={onRemove} piled={!open} pointer={pointer} />
					{open ? null : pile.items.slice(1).map((item, index) => <PileCard count={pile.items.length} index={index + 1} item={item} key={item.id} onPreview={onPreview} onRemove={onRemove} piled pointer={pointer} />)}
				</div>
				<button
					aria-expanded={open}
					aria-label={open ? `Close ${pile.label.toLowerCase()}` : `${pile.label}, ${pile.items.length} attachments`}
					className={cn("mt-4 flex h-4 w-full items-baseline gap-1 rounded-sm text-left text-xs font-medium text-text outline-none focus-visible:ring-2 focus-visible:ring-ring", !open && "after:absolute after:inset-0 after:z-20 after:rounded-sm focus-visible:ring-0 focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-offset-2")}
					onBlur={pointer.reset}
					onClick={() => { pointer.reset(); setOpen((value) => !value); }}
					onFocus={() => { if (!open) pointer.enter(); }}
					onPointerEnter={() => { if (!open) pointer.enter(); }}
					onPointerLeave={pointer.reset}
					onPointerMove={(event) => { if (!open) pointer.move(event); }}
					ref={toggle}
					type="button"
				><span>{pile.label}</span><PileCount count={pile.items.length} /></button>
			</motion.div>
			{open ? pile.items.slice(1).map((item, index) => <PileCard count={pile.items.length} index={index + 1} item={item} key={item.id} onPreview={onPreview} onRemove={onRemove} piled={false} pointer={pointer} />) : null}
		</div>
	);
}
