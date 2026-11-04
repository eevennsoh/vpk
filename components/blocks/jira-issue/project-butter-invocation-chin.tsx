"use client";

// oxlint-disable react-doctor/no-layout-property-animation -- Vohmann's 40px slot and -4px inset must reserve real space for adjacent cards; browser tests measure the reveal and handoff geometry.

import { useEffect, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import AiAgentIcon from "@atlaskit/icon/core/ai-agent";
import { AgentAvatarVisual } from "@/components/ui-custom/agent-avatar-visual";
import { cn } from "@/lib/utils";
import { motionDuration, motionEase, motionRecipe } from "@/lib/motion";
import { getJiraIssueAgentAvatarSize, getJiraIssueAgentRowInset } from "./agent-activity-avatar";
import type { JiraIssueIconScale } from "./types";
import { BUTTER_INVOCATION_CYCLE, BUTTER_INVOCATION_HANDOFF, BUTTER_INVOCATION_PUZZLE_DURATION, BUTTER_INVOCATION_PUZZLE_ENTER, BUTTER_INVOCATION_PUZZLE_HOLD, BUTTER_INVOCATION_REVEAL } from "./project-butter-invocation-motion";
import { matchesInvocationAgent } from "./project-butter-invocation-model";
import {
	useProjectButterInvocationActions,
	useProjectButterInvocationPhase,
	useProjectButterInvocationPreview,
} from "./project-butter-invocation";

function InvocationPreview({ iconScale }: Readonly<{ iconScale?: JiraIssueIconScale }>) {
	const { agent, previousAgent, direction, sequence } = useProjectButterInvocationPreview();
	const reduce = useReducedMotion();
	const animate = !reduce && sequence > 0 && agent?.id !== previousAgent?.id;
	const identity = "perspective(160px) translate3d(0, 0px, 0px) scale(1)";
	return (
		<div
			aria-hidden="true"
			data-slot="jira-issue-agent-invocation-preview"
			data-agent-id={agent?.id ?? "default"}
			data-direction={direction === 1 ? "forward" : "backward"}
			className={cn("pointer-events-none flex h-8 w-full min-w-0 items-center gap-2 py-1", iconScale === undefined ? "pl-2 pr-3" : cn("border border-transparent", getJiraIssueAgentRowInset(iconScale)))}
		>
			<span className="flex size-6 shrink-0 items-center justify-center">
				{agent ? (
					(agent.visual ?? (
						<AgentAvatarVisual
							appearance="coding"
							avatarSrc={agent.avatarSrc}
							brandName={agent.brandName}
							logoName={agent.logoName}
							vpkLogo={agent.vpkLogo}
							label=""
							sizePx={getJiraIssueAgentAvatarSize(agent.brandName, agent.avatarSrc)}
							animate={false}
						/>
					))
				) : (
					<AiAgentIcon label="" size="small" color="currentColor" />
				)}
			</span>
			<span className={cn("flex h-5 min-w-0 flex-1 items-center text-sm leading-5 text-text", iconScale === undefined && "-ml-0.5 pr-2")}>
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

function InvocationHandoff({ iconScale, showStatus, intoPuzzle }: Readonly<{ iconScale?: JiraIssueIconScale; showStatus: boolean; intoPuzzle: boolean }>) {
	const { agent } = useProjectButterInvocationPreview();
	const reduce = useReducedMotion();
	if (!agent) return null;
	const avatarSize = getJiraIssueAgentAvatarSize(agent.brandName, agent.avatarSrc);
	const puzzleScale = 16 / avatarSize;
	return (
		<div aria-hidden="true" className={cn("pointer-events-none flex h-8 w-full min-w-0 items-center gap-2 py-1", iconScale === undefined ? "pl-2 pr-3" : cn("border border-transparent", getJiraIssueAgentRowInset(iconScale)))} data-agent-id={agent.id} data-slot="jira-issue-agent-invocation-handoff">
			<motion.span className="flex size-6 shrink-0 items-center justify-center" initial={reduce ? false : { opacity: 0, transform: "scale(0.9)" }} animate={{ opacity: reduce && intoPuzzle ? 0 : 1, transform: "scale(1)" }} transition={reduce ? { duration: 0 } : motionRecipe.avatar.enter} style={{ willChange: "transform, opacity" }}>
				<motion.span className="flex size-6 items-center justify-center" data-slot="jira-issue-agent-puzzle-transition" initial={reduce ? false : { opacity: 1, transform: "translate(0px, 0px) scale(1)" }} animate={intoPuzzle && !reduce ? { opacity: 0, transform: `translate(-4px, -4px) scale(${puzzleScale})` } : { opacity: 1, transform: "translate(0px, 0px) scale(1)" }} transition={intoPuzzle && !reduce ? { transform: { delay: BUTTER_INVOCATION_PUZZLE_ENTER + BUTTER_INVOCATION_PUZZLE_HOLD, duration: motionDuration.slow, ease: motionEase.inOut }, opacity: { delay: BUTTER_INVOCATION_PUZZLE_DURATION - motionDuration.fast, duration: motionDuration.fast, ease: motionEase.inOut } } : { duration: 0 }} style={{ willChange: "transform, opacity" }}>
				{agent.visual ?? <AgentAvatarVisual appearance="coding" avatarSrc={agent.avatarSrc} brandName={agent.brandName} logoName={agent.logoName} vpkLogo={agent.vpkLogo} label="" sizePx={getJiraIssueAgentAvatarSize(agent.brandName, agent.avatarSrc)} animate={false} />}
				</motion.span>
			</motion.span>
			{showStatus ? <span className="min-w-0 truncate text-sm leading-5 text-text">Working</span> : null}
		</div>
	);
}

export function ProjectButterInvocationChin({
	hasChin,
	iconScale,
	activities,
	children,
}: Readonly<{ hasChin: boolean; iconScale?: JiraIssueIconScale; activities?: readonly Readonly<{ id: string; name: string }>[]; children: ReactNode }>) {
	const phase = useProjectButterInvocationPhase();
	const actions = useProjectButterInvocationActions();
	const preview = useProjectButterInvocationPreview();
	const reduce = useReducedMotion();
	const previewing = phase === "choosing" || phase === "handoff";
	const selectedAgent = preview.agent;
	const selectedAttached = selectedAgent && activities ? activities.some((activity) => matchesInvocationAgent(activity, selectedAgent)) : hasChin;
	const intoPuzzle = Boolean(selectedAttached && activities && activities.length > 1);
	useEffect(() => {
		if (phase !== "handoff" || !actions) return;
		const timer = setTimeout(
			() => selectedAttached ? actions.settle(preview.sequence) : actions.abort(preview.sequence),
			selectedAttached ? (reduce ? 0 : (intoPuzzle ? BUTTER_INVOCATION_PUZZLE_DURATION : BUTTER_INVOCATION_CYCLE.duration) * 1000) : 3000,
		);
		return () => clearTimeout(timer);
	}, [actions, phase, preview.sequence, reduce, selectedAttached, intoPuzzle]);
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
				aria-hidden={phase === "choosing" || undefined}
				inert={phase === "choosing" || undefined}
				initial={false}
				animate={{ opacity: hasChin && phase !== "choosing" ? 1 : 0, transform: hasChin ? "translateY(0px)" : "translateY(20px)" }}
				transition={reduce || phase === "handoff" ? { duration: 0 } : BUTTER_INVOCATION_HANDOFF}
			>
				{children}
			</motion.div>
			{previewing ? <div className="pointer-events-none absolute inset-x-0 top-0 px-1 py-1">
				{phase === "choosing" ? <InvocationPreview iconScale={iconScale} /> : <InvocationHandoff iconScale={iconScale} showStatus={!activities?.length} intoPuzzle={intoPuzzle} />}
			</div> : null}
		</motion.div>
	);
}
