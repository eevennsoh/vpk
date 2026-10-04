"use client";

import { motion, useReducedMotion, type Variants } from "motion/react";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import type { SkillsDirectorySkill } from "@/app/data/directory";
import type { AgentSelectorAgent } from "@/components/blocks/agent-selector";
import type { AgentSession } from "@/components/blocks/jira-work-item/data/session-state";
import { ActivityComposerAgentContextPill } from "@/components/blocks/jira-work-item/experimental-v5/components/activity-composer-agent-context-pill";
import { ActivityComposerSkillContextPill } from "@/components/blocks/jira-work-item/experimental-v5/components/activity-composer-skill-context-pill";
import { NEEDS_INPUT_STATUS_LABEL, WorkingSessionActivityByline } from "@/components/blocks/jira-work-item/experimental-v5/components/agent-session-activity-byline";
import { AgentAvatarVisual } from "@/components/ui-custom/agent-avatar-visual";
import { ContextBarPill } from "@/components/ui-custom/context-bar";
import { PixelLoader } from "@/components/ui-custom/pixel-loader";
import { Shimmer } from "@/components/ui-custom/shimmer";
import {
	RichTextSuggestionMenu,
	type RichTextSuggestionMenuItem,
} from "@/components/ui-custom/rich-text-editor";
import { motionEase } from "@/lib/motion";


const PILL_GROUP_VARIANTS = {
	hidden: {},
	visible: {
		transition: {
			delayChildren: 0.25, // duration-slow: let the composer finish repositioning first
			staggerChildren: 0.05, // duration-xxshort
		},
	},
} satisfies Variants;

const PILL_REVEAL_VARIANTS = {
	hidden: { opacity: 0, y: 8 },
	visible: {
		opacity: 1,
		y: 0,
		transition: {
			duration: 0.15,
			ease: motionEase.outPractical,
		}, // duration-normal + ease-out-practical
	},
} satisfies Variants;

interface ActivityComposerContextPillsProps {
	/** Host-owned context bar (e.g. PR chips). */
	contextBar?: ReactNode;
	onInvokeAgent: (agent: Pick<AgentSelectorAgent, "id" | "name" | "avatarSrc" | "brandName">) => void;
	onInvokeSkill: (skill: SkillsDirectorySkill) => void;
	onOpenAgentChat?: (agentId: string, sessionId: string) => void;
	workingSessions: readonly AgentSession[];
}

function WorkingSessionsList({
	onClose,
	onOpenAgentChat,
	sessions,
}: Readonly<{
	onClose: (restoreFocus: boolean) => void;
	onOpenAgentChat: (agentId: string, sessionId: string) => void;
	sessions: readonly AgentSession[];
}>) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const items: readonly RichTextSuggestionMenuItem[] = sessions.map((session, sessionIndex) => ({
		id: session.id,
		icon: null,
		label: session.agentName,
		inlineMetadata: (
			<WorkingSessionActivityByline
				session={session}
				sessionIndex={sessionIndex}
			/>
		),
		leadingVisual: (
			<AgentAvatarVisual
				avatarSrc={session.agentAvatarSrc}
				brandName={session.agentBrandName}
				fallbackText={session.agentName}
				sizePx={24}
				vpkLogo={session.agentName === "Rovo" ? "rovo" : undefined}
			/>
		),
		trailing: session.status === "waiting"
			? (
				<span className="text-xs text-text-subtle">
					{session.waitingOn?.kind === "user" ? NEEDS_INPUT_STATUS_LABEL : "Waiting"}
				</span>
			)
			: null,
	}));

	const openSession = (item: RichTextSuggestionMenuItem) => {
		const session = sessions.find((candidate) => candidate.id === item.id);
		if (!session) return;
		onClose(false);
		onOpenAgentChat(session.agentId, session.id);
	};

	useEffect(() => {
		containerRef.current?.focus();

		const handlePointerDown = (event: PointerEvent) => {
			if (event.target instanceof Node && !containerRef.current?.contains(event.target)) {
				onClose(false);
			}
		};
		const handleDismissKeyDown = (event: globalThis.KeyboardEvent) => {
			if (event.key === "Escape") {
				event.preventDefault();
				onClose(true);
			}
		};

		window.addEventListener("pointerdown", handlePointerDown, true);
		window.addEventListener("keydown", handleDismissKeyDown);
		return () => {
			window.removeEventListener("pointerdown", handlePointerDown, true);
			window.removeEventListener("keydown", handleDismissKeyDown);
		};
	}, [onClose]);

	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (event.key === "ArrowDown" || event.key === "ArrowUp") {
			event.preventDefault();
			const step = event.key === "ArrowDown" ? 1 : -1;
			setSelectedIndex((index) => (index + step + items.length) % items.length);
		} else if (event.key === "Enter") {
			event.preventDefault();
			openSession(items[selectedIndex]);
		}
	};

	return (
		<div
			className="w-full outline-none"
			onKeyDown={handleKeyDown}
			ref={containerRef}
			tabIndex={-1}
		>
			<RichTextSuggestionMenu
				className="rich-text-command-menu-borderless w-full!"
				emptyLabel="No agents working"
				items={items}
				onHover={setSelectedIndex}
				onSelect={openSession}
				selectedIndex={selectedIndex}
				title="Working agents"
			/>
		</div>
	);
}

function RevealingPill({ children }: Readonly<{ children: ReactNode }>) {
	const [isAnimating, setIsAnimating] = useState(false);

	return (
		<motion.div
			className="flex items-center"
			onAnimationComplete={() => setIsAnimating(false)}
			onAnimationStart={() => setIsAnimating(true)}
			style={isAnimating ? { willChange: "transform, opacity" } : undefined}
			variants={PILL_REVEAL_VARIANTS}
		>
			{children}
		</motion.div>
	);
}

/** Context shortcuts revealed after the planner review composer becomes sticky. */
export function ActivityComposerContextPills({
	contextBar,
	onInvokeAgent,
	onInvokeSkill,
	onOpenAgentChat,
	workingSessions,
}: Readonly<ActivityComposerContextPillsProps>) {
	const shouldReduceMotion = Boolean(useReducedMotion());
	const workingTriggerRef = useRef<HTMLButtonElement>(null);
	const shouldRestoreWorkingTriggerFocusRef = useRef(false);
	const [showWorkingSessions, setShowWorkingSessions] = useState(false);
	const needsInputCount = workingSessions.filter((session) => (
		session.status === "waiting" && session.waitingOn?.kind === "user"
	)).length;
	const summaryCount = needsInputCount > 0 ? needsInputCount : workingSessions.length;
	const summaryLabel = needsInputCount > 0
		? `${summaryCount} ${summaryCount === 1 ? "agent needs" : "agents need"} input`
		: `${summaryCount} ${summaryCount === 1 ? "agent" : "agents"} working`;

	useEffect(() => {
		if (!showWorkingSessions && shouldRestoreWorkingTriggerFocusRef.current) {
			shouldRestoreWorkingTriggerFocusRef.current = false;
			workingTriggerRef.current?.focus();
		}
	}, [showWorkingSessions]);

	const closeWorkingSessions = useCallback((restoreFocus: boolean) => {
		shouldRestoreWorkingTriggerFocusRef.current = restoreFocus;
		setShowWorkingSessions(false);
	}, []);

	return (
		<motion.div
			animate="visible"
			className="mb-2 flex flex-wrap items-center gap-2"
			data-jira-work-item-context-pills
			initial={shouldReduceMotion ? false : "hidden"}
			variants={PILL_GROUP_VARIANTS}
		>
			{showWorkingSessions && onOpenAgentChat ? (
				<WorkingSessionsList
					onClose={closeWorkingSessions}
					onOpenAgentChat={onOpenAgentChat}
					sessions={workingSessions}
				/>
			) : contextBar !== undefined ? (
				<div className="flex min-h-10 min-w-0 flex-1 items-center [&_[data-context-bar]]:mb-0">
					{contextBar}
				</div>
			) : (
				<div className="flex min-w-0 flex-wrap items-center gap-2">
					{workingSessions.length > 0 && onOpenAgentChat ? (
						<RevealingPill>
							<ContextBarPill
								aria-label={summaryLabel}
								className="motion-reduce:transition-none"
								icon={(
									<PixelLoader
										className="size-3 justify-center"
										pattern={needsInputCount > 0 ? "breathing" : "diagonal-top-left"}
										shape="dot"
										size="small"
									/>
								)}
								onClick={() => setShowWorkingSessions(true)}
								ref={workingTriggerRef}
							>
								{needsInputCount > 0 ? (
									<Shimmer as="span">{summaryLabel}</Shimmer>
								) : summaryLabel}
							</ContextBarPill>
						</RevealingPill>
					) : null}
					<RevealingPill>
						<ActivityComposerAgentContextPill onInvokeAgent={onInvokeAgent} />
					</RevealingPill>
					<RevealingPill>
						<ActivityComposerSkillContextPill onInvokeSkill={onInvokeSkill} />
					</RevealingPill>
				</div>
			)}
		</motion.div>
	);
}
