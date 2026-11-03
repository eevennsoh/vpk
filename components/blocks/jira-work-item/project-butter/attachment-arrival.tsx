"use client";

import { useEffect, useEffectEvent, useState } from "react";
import Image from "next/image";
import { motion } from "motion/react";
import CheckMarkIcon from "@atlaskit/icon/core/check-mark";
import UploadIcon from "@atlaskit/icon/core/upload";
import type { ProjectButterAttachment } from "@/components/blocks/jira-work-item/project-butter/attachment-data";
import { attachmentKindLabel } from "@/components/blocks/jira-work-item/project-butter/attachment-model";
import { motionDuration, motionEase } from "@/lib/motion";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

type ArrivalPhase = "enter" | "progress" | "done" | "leave";

const RING_LENGTH = 94.2;
const ms = (seconds: number) => seconds * 1000;
/** Slide (slow), ring fill (slowest), hold before leaving (normal + medium + slow), fade (medium). */
const PROGRESS_AT = ms(motionDuration.slow);
const DONE_AT = PROGRESS_AT + ms(motionDuration.slowest);
const LEAVE_AT = DONE_AT + ms(motionDuration.normal + motionDuration.medium + motionDuration.slow);
const FINISH_AT = LEAVE_AT + ms(motionDuration.medium);
const ease = motionEase.outPractical;

/**
 * Entrance for a grid card that was just added (reference AttachmentArrival): the file slides into a
 * dashed zone, a ring fills while it is "added", then chips settle on the bottom edge and the real card
 * takes over. Decorative (aria-hidden); the piles announce the addition. Only mounted when motion is allowed.
 */
export function AttachmentArrival({ item, onDone }: Readonly<{ item: ProjectButterAttachment; onDone: () => void }>) {
	const [phase, setPhase] = useState<ArrivalPhase>("enter");
	const [percent, setPercent] = useState(0);
	const finish = useEffectEvent(onDone);
	useEffect(() => {
		const timers = [
			window.setTimeout(() => setPhase("progress"), PROGRESS_AT),
			...[1, 2, 3, 4].map((step) => window.setTimeout(() => setPercent(step * 25), PROGRESS_AT + (ms(motionDuration.slowest) * step) / 4)),
			window.setTimeout(() => setPhase("done"), DONE_AT),
			window.setTimeout(() => setPhase("leave"), LEAVE_AT),
			window.setTimeout(() => finish(), FINISH_AT),
		];
		return () => timers.forEach((timer) => window.clearTimeout(timer));
	}, []);
	const extension = item.kind === "file" || item.kind === "image" || item.kind === "video" ? item.extension?.toUpperCase() : undefined;
	const kind = attachmentKindLabel(item);
	const chips = [...(extension ? [extension] : []), kind, "Added"];
	const done = phase === "done" || phase === "leave";
	const entered = phase !== "enter";
	return (
		<motion.div animate={{ opacity: phase === "leave" ? 0 : 1 }} aria-hidden className="pointer-events-none absolute inset-0 z-[3] flex p-2" data-attachment-arrival initial={false} transition={{ duration: motionDuration.medium, ease }}>
			<div className="relative flex min-w-0 flex-1 items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-surface-raised">
				<motion.span
					animate={entered ? { x: "30%", y: "-50%", scale: 0.8, opacity: 0 } : { x: "0%", y: "-50%", scale: 1, opacity: 1 }}
					className="absolute top-1/2 left-3 flex w-12 flex-col items-center gap-1 rounded-md bg-surface-raised p-1 text-text"
					initial={{ x: "-120%", y: "-50%", opacity: 0 }}
					style={{ boxShadow: token("elevation.shadow.raised") }}
					transition={{ duration: motionDuration.slow, ease }}
				>
					{item.previewSrc ? <Image alt="" className="h-6 w-8 rounded-xs object-cover" height={24} src={item.previewSrc} unoptimized={item.previewSrc.startsWith("blob:")} width={32} /> : <span className="h-6 w-8 rounded-xs bg-bg-neutral" />}
					<span className="max-w-full truncate text-xs">{item.name}</span>
				</motion.span>
				<motion.div animate={entered ? { opacity: 1, y: 0 } : { opacity: 0, y: 4 }} className="flex flex-col items-center gap-1" initial={false} transition={{ duration: motionDuration.medium, ease }}>
					<span className={cn("relative grid size-10 place-items-center", done ? "text-icon-inverse" : "text-icon")}>
						{done ? (
							<motion.span animate={{ scale: 1 }} className="absolute inset-0.5 rounded-full bg-bg-neutral-bold" initial={{ scale: 0.8 }} transition={{ duration: motionDuration.normal, ease }} />
						) : (
							<svg className="absolute inset-0 size-full -rotate-90" viewBox="0 0 36 36">
								<circle className="stroke-border" cx="18" cy="18" fill="none" r="15" strokeWidth="1.5" />
								<motion.circle animate={{ strokeDashoffset: entered ? 0 : RING_LENGTH }} className="stroke-icon" cx="18" cy="18" fill="none" initial={{ strokeDashoffset: RING_LENGTH }} r="15" strokeDasharray={RING_LENGTH} strokeLinecap="round" strokeWidth="1.5" transition={{ duration: motionDuration.slowest, ease: motionEase.linear }} />
							</svg>
						)}
						<span className="relative flex">{done ? <CheckMarkIcon color="currentColor" label="" size="small" /> : <UploadIcon color="currentColor" label="" size="small" />}</span>
					</span>
					<span className="text-xs text-text-subtle">{done ? `${extension ?? kind} added` : `Adding · ${percent}%`}</span>
				</motion.div>
				{done ? (
					<div className="absolute inset-x-0 bottom-1.5 flex justify-center gap-1">
						{chips.map((chip, index) => (
							<motion.span animate={{ y: 0, opacity: 1 }} className="rounded-full bg-bg-neutral-bold px-1.5 py-0.5 text-xs leading-4 text-text-inverse" initial={{ y: 8, opacity: 0 }} key={chip} transition={{ duration: motionDuration.medium, ease, delay: [0, 0.1, 0.15][index] ?? 0.15 }}>{chip}</motion.span>
						))}
					</div>
				) : null}
			</div>
		</motion.div>
	);
}
