"use client";

// oxlint-disable react-doctor/no-layout-property-animation -- Vohmann's 40px slot and -4px inset must reserve real space for adjacent cards; browser tests measure the reveal and handoff geometry.

import { useEffect, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import AiAgentIcon from "@atlaskit/icon/core/ai-agent";
import { AgentAvatarVisual } from "@/components/ui-custom/agent-avatar-visual";
import { cn } from "@/lib/utils";
import { motionDuration } from "@/lib/motion";
import { getJiraIssueAgentRowInset } from "./agent-activity-avatar";
import type { JiraIssueIconScale } from "./types";
import { BUTTER_INVOCATION_CYCLE, BUTTER_INVOCATION_HANDOFF, BUTTER_INVOCATION_PUZZLE_DURATION, BUTTER_INVOCATION_REVEAL } from "./project-butter-invocation-motion";
import { matchesInvocationAgent } from "./project-butter-invocation-model";
import {
	useProjectButterInvocationActions,
	useProjectButterInvocationPhase,
	useProjectButterInvocationPreview,
} from "./project-butter-invocation";

/** Chin avatar sizes. A host passes the same size its attached rows render, so browsing, handoff, and the added row never change size. */
export type InvocationAvatarSize = 16 | 20 | 24;

function InvocationPreviewAvatar({ agent, defaultIcon, sizePx }: Readonly<{ agent: ReturnType<typeof useProjectButterInvocationPreview>["agent"]; defaultIcon?: ReactNode; sizePx: InvocationAvatarSize }>) {
	if (!agent && defaultIcon) return defaultIcon;
	return (
		<span className={cn("flex shrink-0 items-center justify-center", sizePx === 16 ? "size-4" : "size-6")}>
			{agent ? agent.visual ?? (
				<AgentAvatarVisual appearance="coding" avatarSrc={agent.avatarSrc} brandName={agent.brandName} logoName={agent.logoName} vpkLogo={agent.vpkLogo} label="" sizePx={sizePx} animate={false} />
			) : <span className="flex text-icon-subtle"><AiAgentIcon label="" color="currentColor" /></span>}
		</span>
	);
}

export function ProjectButterInvocationPreview({ avatarSizePx = 24, className, defaultIcon, flush = false, iconScale }: Readonly<{ avatarSizePx?: InvocationAvatarSize; className?: string; defaultIcon?: ReactNode; flush?: boolean; iconScale?: JiraIssueIconScale }>) {
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
			className={cn("pointer-events-none flex h-8 w-full min-w-0 items-center gap-2 py-1", !flush && (iconScale === undefined ? "pl-2 pr-3" : cn("border border-transparent", getJiraIssueAgentRowInset(iconScale))), className)}
		>
			<InvocationPreviewAvatar agent={agent} defaultIcon={defaultIcon} sizePx={avatarSizePx} />
			<span className={cn("flex h-5 min-w-0 flex-1 items-center text-sm leading-5 text-text", iconScale === undefined && !flush && "-ml-0.5 pr-2")}>
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

/**
 * The selected agent holds its browsing size while the label rolls to Working; only the invoker's
 * dot scales in, as soon as the agent is chosen. It renders the attached row's own identity, so settling into
 * the real row swaps nothing visible.
 */
function InvocationHandoff({ avatarSizePx, className, iconScale, identity, showStatus }: Readonly<{ avatarSizePx: InvocationAvatarSize; className?: string; iconScale?: JiraIssueIconScale; identity?: ReactNode; showStatus: boolean }>) {
	const { agent } = useProjectButterInvocationPreview();
	if (!agent) return null;
	return (
		<div aria-hidden="true" className={cn("pointer-events-none flex h-8 w-full min-w-0 items-center gap-2 py-1", iconScale === undefined ? "pl-2 pr-3" : cn("border border-transparent", getJiraIssueAgentRowInset(iconScale)), className)} data-agent-id={agent.id} data-slot="jira-issue-agent-invocation-handoff">
			<span
				className={cn("flex shrink-0 items-center justify-center", avatarSizePx === 16 ? "size-4" : "size-6")}
				data-slot="jira-issue-agent-invocation-handoff-avatar"
			>
				{identity ?? agent.visual ?? <AgentAvatarVisual appearance="coding" avatarSrc={agent.avatarSrc} brandName={agent.brandName} logoName={agent.logoName} vpkLogo={agent.vpkLogo} label="" sizePx={avatarSizePx} animate={false} />}
			</span>
			{showStatus ? <JiraIssueAgentHandoffLabel name={agent.name}>Working</JiraIssueAgentHandoffLabel> : null}
		</div>
	);
}

export function JiraIssueAgentHandoffLabel({ name, children }: Readonly<{ name: string; children: ReactNode }>) {
	return (
		<span aria-hidden="true" className="relative block h-5 min-w-0 flex-1 overflow-hidden text-sm leading-5 text-text" data-slot="jira-issue-agent-handoff-label">
			<span className="agent-handoff-label-out absolute inset-0 truncate" data-handoff-label="outgoing">Add {name}</span>
			<span className="agent-handoff-label-in absolute inset-0 truncate" data-handoff-label="incoming">{children}</span>
		</span>
	);
}

export function ProjectButterInvocationChin<TActivity extends Readonly<{ id: string; name: string }>>({
	hasChin,
	iconScale,
	activities,
	avatarSizePx = 24,
	renderIdentity,
	allowPuzzle = false,
	retainCompletedContent = false,
	flushPreview = false,
	children,
}: Readonly<{ hasChin: boolean; iconScale?: JiraIssueIconScale; activities?: readonly TActivity[]; /** Size of the host's attached-row avatars; browsing and handoff match it. */ avatarSizePx?: InvocationAvatarSize; /** The attached row's identity for an activity, so the handoff ends on exactly what the row shows. */ renderIdentity?: (activity: TActivity, sizePx: InvocationAvatarSize, badgeEntrance: boolean) => ReactNode; allowPuzzle?: boolean; retainCompletedContent?: boolean; flushPreview?: boolean; children: ReactNode }>) {
	const phase = useProjectButterInvocationPhase();
	const actions = useProjectButterInvocationActions();
	const preview = useProjectButterInvocationPreview();
	const reduce = useReducedMotion();
	const previewing = phase === "choosing" || phase === "handoff";
	const selectedAgent = preview.agent;
	const selectedActivity = selectedAgent ? activities?.find((activity) => matchesInvocationAgent(activity, selectedAgent)) : undefined;
	const selectedAttached = selectedAgent && activities ? selectedActivity !== undefined : hasChin;
	const intoPuzzle = Boolean(phase === "handoff" && allowPuzzle && selectedAttached && activities && activities.length > 1);
	useEffect(() => {
		if (phase !== "handoff" || !actions) return;
		const timer = setTimeout(
			() => selectedAttached ? actions.settle(preview.sequence) : actions.abort(preview.sequence),
			selectedAttached ? (reduce ? 0 : (intoPuzzle ? BUTTER_INVOCATION_PUZZLE_DURATION + motionDuration.xxshort : BUTTER_INVOCATION_CYCLE.duration + BUTTER_INVOCATION_HANDOFF.duration) * 1000) : 3000,
		);
		return () => clearTimeout(timer);
	}, [actions, phase, preview.sequence, reduce, selectedAttached, intoPuzzle]);
	if (phase === null) return children;
	return (
		<motion.div
			data-slot="jira-issue-agent-invocation-chin"
			className="relative overflow-hidden has-[:focus-visible]:overflow-visible"
			initial={false}
			animate={{ height: previewing ? (flushPreview ? 32 : 40) : hasChin ? "auto" : 0, marginTop: previewing || hasChin ? -4 : 0 }}
			transition={reduce ? { duration: 0 } : BUTTER_INVOCATION_REVEAL}
		>
			<motion.div
				data-slot="jira-issue-agent-invocation-actual"
				aria-hidden={phase === "choosing" || undefined}
				inert={phase === "choosing" || undefined}
				initial={false}
				animate={{ opacity: (hasChin || retainCompletedContent) && phase !== "choosing" ? 1 : 0, transform: flushPreview || hasChin || retainCompletedContent ? "translateY(0px)" : "translateY(20px)" }}
				transition={reduce || phase === "handoff" ? { duration: 0 } : BUTTER_INVOCATION_HANDOFF}
			>
				{children}
			</motion.div>
			{previewing && !intoPuzzle ? <div className={cn("pointer-events-none absolute inset-x-0 top-0", !flushPreview && "p-1")}>
				{phase === "choosing" ? <ProjectButterInvocationPreview avatarSizePx={avatarSizePx} iconScale={iconScale} flush={flushPreview} /> : <InvocationHandoff avatarSizePx={avatarSizePx} identity={selectedActivity && renderIdentity ? renderIdentity(selectedActivity, avatarSizePx, true) : undefined} iconScale={iconScale} className={flushPreview ? "px-0" : undefined} showStatus={!activities?.length} />}
			</div> : null}
		</motion.div>
	);
}
