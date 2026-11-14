"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { token } from "@/lib/tokens";
import type { ScreenAssistantTranscriptEntry } from "./types";

// ---------------------------------------------------------------------------
// Live-chat transcript — compact panel showing the realtime voice conversation
// (completed turns) plus any in-flight user/assistant streaming text.
// ---------------------------------------------------------------------------

interface ScreenAssistantTranscriptProps {
	transcript: ReadonlyArray<ScreenAssistantTranscriptEntry>;
	liveUserTranscript?: string;
	liveAssistantTranscript?: string;
	statusLabel?: string | null;
	className?: string;
}

const ROLE_ALIGNMENT: Record<ScreenAssistantTranscriptEntry["role"], string> = {
	user: "self-end bg-bg-brand-bold text-text-inverse",
	assistant: "self-start bg-bg-neutral text-text",
	system: "self-center bg-bg-neutral-subtle text-text-subtle italic",
};

export function ScreenAssistantTranscript({
	transcript,
	liveUserTranscript = "",
	liveAssistantTranscript = "",
	statusLabel = null,
	className,
}: Readonly<ScreenAssistantTranscriptProps>) {
	const scrollRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const node = scrollRef.current;
		if (node) {
			node.scrollTop = node.scrollHeight;
		}
	}, [transcript.length, liveUserTranscript, liveAssistantTranscript]);

	const isEmpty =
		transcript.length === 0 && !liveUserTranscript && !liveAssistantTranscript;

	return (
		<div
			className={cn(
				"flex w-80 flex-col gap-2 rounded-xl bg-surface-raised p-3",
				className,
			)}
			style={{ boxShadow: token("elevation.shadow.overlay") }}
		>
			<div className="flex items-center justify-between">
				<span className="text-[10px] font-semibold text-text-subtlest">
					Live chat
				</span>
				{statusLabel ? (
					<span className="text-[10px] font-medium text-text-subtle">{statusLabel}</span>
				) : null}
			</div>

			<div
				ref={scrollRef}
				className="flex max-h-64 flex-col gap-1.5 overflow-y-auto"
			>
				{isEmpty ? (
					<p className="py-6 text-center text-xs text-text-subtlest">
						Start the live chat or use the harness controls to see the conversation here.
					</p>
				) : null}

				<AnimatePresence initial={false}>
					{transcript.map((entry) => (
						<motion.div
							key={entry.id}
							className={cn(
								"max-w-[85%] rounded-lg px-2.5 py-1.5 text-xs leading-relaxed",
								ROLE_ALIGNMENT[entry.role],
							)}
							initial={{ opacity: 0, y: 6 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.15 }}
						>
							{entry.content}
						</motion.div>
					))}
				</AnimatePresence>

				{liveUserTranscript ? (
					<div className="max-w-[85%] self-end rounded-lg bg-bg-brand-bold/70 px-2.5 py-1.5 text-xs leading-relaxed text-text-inverse">
						{liveUserTranscript}
					</div>
				) : null}

				{liveAssistantTranscript ? (
					<div className="max-w-[85%] self-start rounded-lg bg-bg-neutral/70 px-2.5 py-1.5 text-xs leading-relaxed text-text">
						{liveAssistantTranscript}
					</div>
				) : null}
			</div>
		</div>
	);
}
