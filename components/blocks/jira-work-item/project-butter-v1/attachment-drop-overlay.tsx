"use client";

import type { RefObject } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { motion } from "motion/react";
import type { ProjectButterContent } from "@/components/blocks/jira-work-item/project-butter-v1/use-project-butter-content";
import { useAttachmentDrop } from "@/components/blocks/jira-work-item/project-butter-v1/use-attachment-drop";
import { motionDuration, motionEase } from "@/lib/motion";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

const CARDS = [
	{ key: "back", swatch: "bg-bg-accent-blue-subtlest", rotate: -12, x: -12, y: -8 },
	{ key: "mid", swatch: "bg-bg-accent-purple-subtlest", rotate: 8, x: 12, y: 4 },
	{ key: "front", swatch: "bg-bg-accent-gray-subtler", rotate: -3, x: 0, y: 6 },
] as const;

/**
 * Drop feedback for the left column (reference AttachmentImageDrop with `cursorHint`): a translucent blue
 * wash over the visible part of the column, a small stack of cards at 42% of that view, and a "Drop to
 * upload" pill under the pointer. Both are fixed and portalled (pointer-events none); the drop hook
 * re-measures the zone's visible rect on each coalesced dragover, so scrolling never hides the cards.
 * `targetRef` is the scrolling column wrapper, so its gutters are part of the zone.
 */
export function AttachmentDropZone({ content, targetRef }: Readonly<{ content: ProjectButterContent; targetRef: RefObject<HTMLElement | null> }>) {
	const { announcement, clearGhost, ghost, hintRef, over, washRef } = useAttachmentDrop(targetRef, content);
	return (
		<>
			{over ? createPortal(
				<div aria-hidden className="pointer-events-none fixed z-[640] bg-bg-accent-blue-subtle/20" data-attachment-drop-wash ref={washRef}>
					<div className="absolute top-[42%] left-1/2 h-16 w-20">
						{CARDS.map((card) => (
							<motion.span
								animate={{ opacity: 1, x: card.x, y: card.y, rotate: card.rotate, scale: 1 }}
								className={cn("absolute inset-0 rounded-lg bg-surface", card.key === "front" && "z-[1]")}
								initial={{ opacity: 0, x: card.x, y: card.y + 12, rotate: card.rotate, scale: 0.8 }}
								key={card.key}
								style={{ boxShadow: token("elevation.shadow.overlay") }}
								transition={{ duration: motionDuration.medium, ease: motionEase.outPractical }}
							>
								<span className={cn("absolute inset-1.5 rounded-xs", card.swatch)} />
							</motion.span>
						))}
					</div>
				</div>,
				document.body,
			) : null}
			{over ? createPortal(
				<span aria-hidden className="pointer-events-none fixed z-[641] -translate-x-1/2 -translate-y-1/2 rounded-sm bg-surface px-2 py-1 text-xs font-medium whitespace-nowrap text-text" ref={hintRef} style={{ boxShadow: token("elevation.shadow.overlay") }}>Drop to upload</span>,
				document.body,
			) : null}
			{ghost ? createPortal(
				<motion.div
					animate={{ x: ghost.to.x, y: ghost.to.y, scale: ghost.scale, opacity: [1, 1, 0] }}
					aria-hidden
					className="pointer-events-none fixed top-0 left-0 z-[660] size-30 origin-top-left overflow-hidden rounded-lg"
					initial={{ x: ghost.from.x, y: ghost.from.y, scale: 1, opacity: 1 }}
					onAnimationComplete={clearGhost}
					style={{ boxShadow: token("elevation.shadow.overlay") }}
					transition={{ duration: motionDuration.slower, ease: motionEase.out, opacity: { duration: motionDuration.slower, times: [0, 0.7, 1] } }}
				>
					<Image alt="" className="size-full object-cover" height={120} src={ghost.src} unoptimized={ghost.src.startsWith("blob:")} width={120} />
				</motion.div>,
				document.body,
			) : null}
			<span aria-live="polite" className="sr-only" role="status">{announcement}</span>
		</>
	);
}
