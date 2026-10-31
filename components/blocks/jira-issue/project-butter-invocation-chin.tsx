"use client";

// oxlint-disable react-doctor/no-layout-property-animation -- Vohmann's 40px slot and -4px inset must reserve real space for adjacent cards; browser tests measure the reveal and handoff geometry.

import { useEffect, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import AiAgentIcon from "@atlaskit/icon/core/ai-agent";
import { AgentAvatarVisual } from "@/components/ui-custom/agent-avatar-visual";
import { BUTTER_INVOCATION_CYCLE, BUTTER_INVOCATION_HANDOFF, BUTTER_INVOCATION_REVEAL } from "./project-butter-invocation-motion";
import {
	useProjectButterInvocationActions,
	useProjectButterInvocationPhase,
	useProjectButterInvocationPreview,
} from "./project-butter-invocation";

function InvocationPreview({ handoff = false }: Readonly<{ handoff?: boolean }>) {
	const { agent, previousAgent, direction, sequence } = useProjectButterInvocationPreview();
	const reduce = useReducedMotion();
	const animate = !reduce && !handoff && sequence > 0 && agent?.id !== previousAgent?.id;
	const identity = "perspective(160px) translate3d(0, 0px, 0px) scale(1)";
	return (
		<div
			aria-hidden="true"
			data-slot="jira-issue-agent-invocation-preview"
			data-agent-id={agent?.id ?? "default"}
			data-direction={direction === 1 ? "forward" : "backward"}
			className="pointer-events-none flex h-8 w-full min-w-0 items-center gap-2 py-1 pl-2 pr-3"
		>
			<span className="flex size-6 shrink-0 items-center justify-center">
				{agent ? (
					(agent.visual ?? (
						<AgentAvatarVisual
							avatarSrc={agent.avatarSrc}
							brandName={agent.brandName}
							logoName={agent.logoName}
							vpkLogo={agent.vpkLogo}
							label=""
							sizePx={16}
							animate={false}
						/>
					))
				) : (
					<AiAgentIcon label="" size="small" color="currentColor" />
				)}
			</span>
			<span className="-ml-0.5 flex h-5 min-w-0 flex-1 items-center pr-2 text-sm text-text">
				Add&nbsp;
				<span className="relative h-5 min-w-0 flex-1 overflow-hidden text-left">
					{animate ? (
						<span key={sequence}>
							<motion.span
								data-preview-layer="outgoing"
								className="absolute inset-0 origin-left truncate backface-hidden"
								initial={{ opacity: 1, transform: identity }}
								animate={{
									opacity: 0,
									transform: `perspective(160px) translate3d(0, ${-direction * 12}px, -24px) scale(0.92)`,
								}}
								transition={BUTTER_INVOCATION_CYCLE}
							>
								{previousAgent?.name ?? "agent"}
							</motion.span>
							<motion.span
								data-preview-layer="incoming"
								className="absolute inset-0 origin-left truncate backface-hidden"
								initial={{
									opacity: 0,
									transform: `perspective(160px) translate3d(0, ${direction * 12}px, -24px) scale(0.92)`,
								}}
								animate={{ opacity: 1, transform: identity }}
								transition={BUTTER_INVOCATION_CYCLE}
							>
								{agent?.name ?? "agent"}
							</motion.span>
						</span>
					) : (
						<span className="block truncate">{agent?.name ?? "agent"}</span>
					)}
				</span>
			</span>
		</div>
	);
}

export function ProjectButterInvocationChin({
	hasChin,
	children,
}: Readonly<{ hasChin: boolean; children: ReactNode }>) {
	const phase = useProjectButterInvocationPhase();
	const actions = useProjectButterInvocationActions();
	const preview = useProjectButterInvocationPreview();
	const reduce = useReducedMotion();
	const previewing = phase === "choosing" || phase === "handoff";
	useEffect(() => {
		if (phase !== "handoff" || !hasChin || !actions) return;
		const timer = setTimeout(
			() => actions.settle(preview.sequence),
			reduce ? 0 : BUTTER_INVOCATION_CYCLE.duration * 1000,
		);
		return () => clearTimeout(timer);
	}, [actions, hasChin, phase, preview.sequence, reduce]);
	if (phase === null) return children;
	return (
		<motion.div
			data-slot="jira-issue-agent-invocation-chin"
			className="relative overflow-hidden has-[:focus-visible]:overflow-visible"
			initial={false}
			animate={{ height: previewing ? 40 : hasChin ? "auto" : 0, marginTop: previewing || hasChin ? -4 : 0 }}
			transition={reduce ? { duration: 0 } : BUTTER_INVOCATION_REVEAL}
		>
			<motion.div
				data-slot="jira-issue-agent-invocation-actual"
				initial={false}
				animate={{ opacity: hasChin ? 1 : 0, transform: hasChin ? "translateY(0px)" : "translateY(20px)" }}
				transition={reduce ? { duration: 0 } : BUTTER_INVOCATION_HANDOFF}
			>
				{children}
			</motion.div>
			<AnimatePresence initial={false}>
				{previewing ? (
					<motion.div
						key="preview"
						className="pointer-events-none absolute inset-x-0 top-0 px-1 py-1"
						initial={false}
						animate={
							phase === "handoff" && hasChin
								? { opacity: 0, transform: "translateY(-20px)" }
								: { opacity: 1, transform: "translateY(0px)" }
						}
						exit={{ opacity: 0 }}
						transition={reduce ? { duration: 0 } : BUTTER_INVOCATION_HANDOFF}
					>
						<InvocationPreview handoff={phase === "handoff"} />
					</motion.div>
				) : null}
			</AnimatePresence>
		</motion.div>
	);
}
