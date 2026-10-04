"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion, type MotionStyle, type Transition } from "motion/react";

import {
	AgentAvatarVisual,
	type AgentAvatarVisualProps,
} from "@/components/ui-custom/agent-avatar-visual";
import {
	areAllAgentLoadingAgentsFinished,
	getAgentLoadingSlots,
	getAgentLoadingSlotStyle,
	listAgentLoadingSlots,
	shouldCycleAgentLoading,
	type AgentLoadingSize,
	type AgentLoadingSlotName,
	type AgentLoadingStatus,
} from "@/components/ui-custom/agent-loading-model";
import { cn } from "@/lib/utils";
import { motionEase } from "@/lib/motion";

const AGENT_LOADING_HOLD_MS = 2_000;
const AGENT_LOADING_SWAP_MS = 600; // duration-slowest
const AGENT_LOADING_MOTION_SWAP: Transition = { duration: 0.6, ease: motionEase.inOut }; // duration-slowest + ease-in-out
const AGENT_LOADING_MOTION_EXIT: Transition = { duration: 0.4, ease: motionEase.in }; // duration-slower + ease-in
const AGENT_LOADING_MOTION_REDUCED: Transition = { duration: 0 };
const AGENT_LOADING_SLOT_STYLE: MotionStyle = {
	originX: 0,
	originY: 0,
	willChange: "transform, opacity",
};
const AGENT_LOADING_HIDDEN_EXIT = {
	opacity: 0,
	scale: 0.25,
	y: 20,
} as const;

type AgentLoadingAvatar = Omit<
	AgentAvatarVisualProps,
	"avatarClassName" | "children" | "label" | "sizePx" | "status"
>;

export type { AgentLoadingSize };

export interface AgentLoadingAgent {
	id: string;
	name: string;
	status: AgentLoadingStatus;
	avatar: AgentLoadingAvatar;
}

export interface AgentLoadingProps {
	agents: readonly AgentLoadingAgent[];
	/** Optional visible status copy rendered beside the cycling agents. */
	label?: ReactNode;
	/** Overrides the derived live-region announcement. */
	"aria-label"?: string;
	/** Set false when an enclosing control already announces the agent state. */
	announce?: boolean;
	className?: string;
	/** `default` is the authored 24×24 canvas; `small` scales it to 16×16. */
	size?: AgentLoadingSize;
}

function renderAgentLoadingAvatar(
	agent: AgentLoadingAgent,
	slot: AgentLoadingSlotName,
	shouldReduceMotion: boolean | null,
) {
	const slotStyle = getAgentLoadingSlotStyle(slot);
	const transition = shouldReduceMotion ? AGENT_LOADING_MOTION_REDUCED : AGENT_LOADING_MOTION_SWAP;

	return (
		<motion.span
			animate={{
				opacity: slotStyle.opacity,
				scale: slotStyle.scale,
				x: slotStyle.x,
				y: slotStyle.y,
				zIndex: slotStyle.zIndex,
			}}
			aria-hidden="true"
			className="pointer-events-none absolute top-0 left-0 size-4 origin-top-left"
			data-agent-id={agent.id}
			data-agent-loading-slot={slot}
			exit={shouldReduceMotion ? undefined : { ...AGENT_LOADING_HIDDEN_EXIT, transition: AGENT_LOADING_MOTION_EXIT }}
			initial={false}
			key={agent.id}
			style={AGENT_LOADING_SLOT_STYLE}
			transition={transition}
		>
			<AgentAvatarVisual
				{...agent.avatar}
				avatarClassName="size-4"
				label={undefined}
				loading={agent.avatar.loading ?? "eager"}
				sizePx={16}
			/>
		</motion.span>
	);
}

function getAgentLoadingAnnouncement(
	agents: readonly AgentLoadingAgent[],
	finished: boolean,
): string {
	const countLabel = `${agents.length} ${agents.length === 1 ? "agent" : "agents"}`;
	const stateLabel = finished ? "finished" : "working";
	const names = agents.map((agent) => agent.name).filter(Boolean).join(", ");

	return [`${countLabel} ${stateLabel}`, names].filter(Boolean).join(". ");
}

function AgentLoadingAnnouncementText({
	announce,
	customLabel,
	announcement,
}: Readonly<{ announce: boolean; customLabel?: string; announcement: string }>) {
	if (!announce || customLabel) return null;

	return <span className="sr-only">{announcement}. </span>;
}

function useAgentLoadingReducedMotion(resyncKey: string): boolean {
	const motionPreference = useReducedMotion();
	const [mediaPreference, setMediaPreference] = useState(false);

	useEffect(() => {
		const media = window.matchMedia("(prefers-reduced-motion: reduce)");
		const sync = () => {
			setMediaPreference(media.matches);
		};

		sync();
		media.addEventListener("change", sync);
		return () => media.removeEventListener("change", sync);
	}, [resyncKey]);

	return motionPreference === true || mediaPreference;
}

/**
 * A compact agent-presence indicator harvested from the wiv-v2 TeamEU Ferris
 * visual. Multiple agents rotate through front, back, and hidden slots until
 * every agent reaches the finished state.
 */
export function AgentLoading({
	agents,
	label,
	"aria-label": ariaLabel,
	announce = true,
	className,
	size = "default",
}: Readonly<AgentLoadingProps>) {
	const [frontAgentId, setFrontAgentId] = useState<string | null>(
		() => agents[0]?.id ?? null,
	);
	const [isSwapping, setIsSwapping] = useState(false);
	const agentsRef = useRef(agents);
	const agentStateKey = useMemo(
		() => JSON.stringify(agents.map((agent) => [agent.id, agent.status])),
		[agents],
	);
	const shouldReduceMotion = useAgentLoadingReducedMotion(agentStateKey);
	const finished = areAllAgentLoadingAgentsFinished(agents);
	const canCycle = shouldCycleAgentLoading(agents) && !shouldReduceMotion;
	const resolvedFrontIndex = Math.max(
		0,
		agents.findIndex((agent) => agent.id === frontAgentId),
	);
	const slots = getAgentLoadingSlots(agents, resolvedFrontIndex);
	const slottedAgents = slots ? listAgentLoadingSlots(slots) : [];

	useEffect(() => {
		agentsRef.current = agents;
	}, [agents]);

	useEffect(() => {
		if (!canCycle) {
			setIsSwapping(false);
			return undefined;
		}

		let holdTimer = 0;
		let swapTimer = 0;
		let cancelled = false;

		const queueHold = () => {
			holdTimer = window.setTimeout(() => {
				if (cancelled) return;
				setIsSwapping(true);
				setFrontAgentId((currentId) => {
					const currentAgents = agentsRef.current;
					if (currentAgents.length === 0) return null;
					const currentIndex = currentAgents.findIndex((agent) => agent.id === currentId);
					const nextIndex = (Math.max(0, currentIndex) + 1) % currentAgents.length;
					return currentAgents[nextIndex]?.id ?? null;
				});
				swapTimer = window.setTimeout(() => {
					if (cancelled) return;
					setIsSwapping(false);
					queueHold();
				}, AGENT_LOADING_SWAP_MS);
			}, AGENT_LOADING_HOLD_MS);
		};

		queueHold();

		return () => {
			cancelled = true;
			window.clearTimeout(holdTimer);
			window.clearTimeout(swapTimer);
		};
	}, [agentStateKey, canCycle]);

	if (!slots) return null;

	const announcement = ariaLabel ?? getAgentLoadingAnnouncement(agents, finished);

	return (
		<span
			aria-label={announce ? ariaLabel : undefined}
			aria-live={announce ? "polite" : undefined}
			className={cn("inline-flex min-w-0 items-center gap-2", className)}
			role={announce ? "status" : undefined}
		>
			<AgentLoadingAnnouncementText
				announce={announce}
				announcement={announcement}
				customLabel={ariaLabel}
			/>
			<span
				aria-hidden="true"
				className="agent-loading"
				data-cycling={agents.length > 2 ? "true" : undefined}
				data-reduced-motion={shouldReduceMotion ? "true" : undefined}
				data-size={size}
				data-swapping={canCycle && isSwapping ? "true" : undefined}
			>
				<span data-agent-loading-canvas="">
					<AnimatePresence initial={false}>
						{slottedAgents.map(({ agent, slot }) => (
							renderAgentLoadingAvatar(agent, slot, shouldReduceMotion)
						))}
					</AnimatePresence>
				</span>
			</span>
			{label ? (
				<span className="min-w-0 self-center whitespace-nowrap text-sm text-text">
					{label}
				</span>
			) : null}
		</span>
	);
}
