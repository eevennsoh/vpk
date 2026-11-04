"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion, useTransform } from "motion/react";
import { ProjectButterAttachmentCard } from "@/components/blocks/jira-work-item/project-butter/attachment-card";
import type { AttachmentPile, ProjectButterAttachment } from "@/components/blocks/jira-work-item/project-butter/attachment-data";
import { useAttachmentPilePointer, type AttachmentPilePointer } from "@/components/blocks/jira-work-item/project-butter/use-attachment-pile-pointer";
import { motionDuration, motionEase } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * The count rolls one number at a time: up for an increase, down for a decrease, `normal` per step
 * (`fast` past seven steps). Reduced motion swaps the number. The toggle already names the final count.
 */
function PileCount({ count }: Readonly<{ count: number }>) {
	const reducedMotion = useReducedMotion();
	const [shown, setShown] = useState(count);
	const [direction, setDirection] = useState(1);
	const steps = Math.abs(count - shown);
	const stepSeconds = steps > 7 ? motionDuration.fast : motionDuration.normal;
	useEffect(() => {
		if (shown === count) return undefined;
		const next = shown + Math.sign(count - shown);
		const timer = window.setTimeout(() => { setDirection(Math.sign(count - shown)); setShown(next); }, reducedMotion ? 0 : stepSeconds * 1000);
		return () => window.clearTimeout(timer);
	}, [count, reducedMotion, shown, stepSeconds]);
	const value = reducedMotion ? count : shown;
	return <span aria-hidden className="relative inline-grid h-4 overflow-hidden font-normal text-text-subtle tabular-nums">
		<span className="invisible">{count}</span>
		<AnimatePresence initial={false} mode="popLayout"><motion.span animate={{ y: "0%" }} className="absolute inset-0" exit={{ y: direction > 0 ? "-100%" : "100%" }} initial={{ y: direction > 0 ? "100%" : "-100%" }} key={value} transition={{ duration: stepSeconds, ease: motionEase.outPractical }}>{value}</motion.span></AnimatePresence>
	</span>;
}

function PileCard({ item, index, count, piled, pointer, onRemove, arriving }: Readonly<{
	item: ProjectButterAttachment; index: number; count: number; piled: boolean; pointer: AttachmentPilePointer;
	onRemove: (item: ProjectButterAttachment) => void;
	arriving: (item: ProjectButterAttachment) => ReactNode;
}>) {
	const rest = piled ? { x: index === 0 ? 0 : index === 1 ? 4 : -4, y: index === 0 ? 0 : 2, rotate: index === 0 ? 0 : index === 1 ? 4 : -5 } : { x: 0, y: 0, rotate: 0 };
	// The front card swings left; back cards fan out toward their own side.
	const fan = !piled ? 0 : index === 0 ? -0.7 : rest.x < 0 ? -1 : 1;
	const live = piled ? 1 : 0;
	const opening = () => live * fan * pointer.spread.get() * (1 + Math.max(0, pointer.lean.get() * fan) * 0.5);
	const x = useTransform(() => opening() * 3);
	const y = useTransform(() => live * Math.abs(fan) * pointer.spread.get() * -1);
	const rotate = useTransform(() => opening() * 3);
	const overlay = arriving(item);
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
			<motion.div aria-hidden={overlay ? true : undefined} className={cn(overlay ? "opacity-0" : undefined)} inert={Boolean(overlay) || undefined} style={{ x, y, rotate, originY: 1, willChange: "transform" }}><ProjectButterAttachmentCard item={item} onRemove={piled || overlay ? undefined : onRemove} /></motion.div>
			{overlay}
		</motion.div>
	);
}

/**
 * A type with 2+ attachments. Opening keeps the front card and its name in place; the others join the
 * grid flow after it. Open state is owned by the piles so Escape can close the right one.
 */
export function ProjectButterAttachmentStack({ arriving, forming, onRemove, onToggle, open, pile }: Readonly<{
	arriving: (item: ProjectButterAttachment) => ReactNode;
	/** Just went from one card to a stack: the single card relocates into the pile. */
	forming: boolean;
	onRemove: (item: ProjectButterAttachment) => void;
	onToggle: () => void;
	open: boolean;
	pile: AttachmentPile;
}>) {
	const pointer = useAttachmentPilePointer();
	const first = pile.items[0];
	if (!first) return null;
	const cardProps = { arriving, count: pile.items.length, onRemove, pointer };
	return (
		<div aria-label={`${pile.label}, ${pile.items.length} attachments`} className="contents" data-attachment-pile={pile.type} role="group">
			<motion.div className="relative min-w-0" data-attachment-stack={pile.type} data-expanded={open} data-forming={forming || undefined} layout transition={{ layout: { duration: open || forming ? motionDuration.slow : motionDuration.medium, ease: motionEase.outPractical } }}>
				<div className="relative h-29">
					<PileCard {...cardProps} index={0} item={first} piled={!open} />
					{open ? null : pile.items.slice(1).map((item, index) => <PileCard {...cardProps} index={index + 1} item={item} key={item.id} piled />)}
				</div>
				<button
					aria-expanded={open}
					aria-label={open ? `Close ${pile.label.toLowerCase()}` : `${pile.label}, ${pile.items.length} attachments`}
					className={cn("mt-4 flex h-4 w-full items-baseline gap-1 rounded-sm text-left text-xs font-medium text-text outline-none focus-visible:ring-2 focus-visible:ring-ring", !open && "after:absolute after:inset-0 after:z-20 after:rounded-sm focus-visible:ring-0 focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-offset-2")}
					data-pile-toggle={pile.type}
					onBlur={(event) => pointer.blur(event.currentTarget)}
					onClick={() => { pointer.reset(); onToggle(); }}
					onFocus={() => { if (!open) pointer.enter(); }}
					onPointerEnter={(event) => { if (!open && event.pointerType !== "touch") pointer.enter(); }}
					onPointerLeave={pointer.reset}
					onPointerMove={(event) => { if (!open) pointer.move(event); }}
					type="button"
				><span>{pile.label}</span><PileCount count={pile.items.length} /></button>
			</motion.div>
			{open ? pile.items.slice(1).map((item, index) => <PileCard {...cardProps} index={index + 1} item={item} key={item.id} piled={false} />) : null}
		</div>
	);
}
