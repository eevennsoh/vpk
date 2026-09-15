"use client";

import { AgentAvatarVisual } from "@/components/ui-custom/agent-avatar-visual";
import { HumanAgentAvatar, type HumanAgentAvatarOrder, type HumanAgentAvatarProps } from "@/components/ui-custom/human-agent-avatar";
import {
	Avatar,
	AvatarFallback,
	AvatarGroup,
	AvatarImage,
	type AvatarProps,
} from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

import { actorInitials } from "./agent-list-actor";
import type { AgentListAgent, AgentListInvoker } from "./agent-list-types";

export type AgentListAttributionOrder = HumanAgentAvatarOrder;

function orderAttributionAvatars<T>(
	attributionOrder: AgentListAttributionOrder,
	agentAvatar: T,
	personAvatar: T,
): readonly T[] {
	return attributionOrder === "agent-first"
		? [agentAvatar, personAvatar]
		: [personAvatar, agentAvatar];
}

/** The two leading-avatar footprints the row uses, as Avatar size tokens. */
const PX_TO_PERSON_AVATAR_SIZE: Record<number, NonNullable<AvatarProps["size"]>> = {
	16: "xs",
	24: "sm",
	32: "default",
};

export function AgentListAttributionAvatarGroup({
	agent,
	animate,
	attributedBy,
	attributionOrder = "human-first",
	className,
	sizePx,
}: Readonly<{
	agent: AgentListAgent;
	animate?: boolean;
	attributedBy: AgentListInvoker;
	attributionOrder?: AgentListAttributionOrder;
	className?: string;
	sizePx: number;
}>) {
	const personAvatar = (
		<Avatar
			key="person"
			label=""
			size={PX_TO_PERSON_AVATAR_SIZE[sizePx] ?? "default"}
		>
			{attributedBy.avatarSrc ? (
				<AvatarImage alt="" src={attributedBy.avatarSrc} />
			) : null}
			<AvatarFallback>{actorInitials(attributedBy.name)}</AvatarFallback>
		</Avatar>
	);
	const agentAvatar = (
		<AgentAvatarVisual
			animate={animate}
			key="agent"
			avatarSrc={agent.avatarSrc}
			brandName={agent.brandName}
			label=""
			sizePx={sizePx}
			vpkLogo={agent.vpkLogo}
		/>
	);

	return (
		<AvatarGroup
			className={cn("shrink-0", className)}
			label={`${agent.name}, used by ${attributedBy.name}`}
			size={PX_TO_PERSON_AVATAR_SIZE[sizePx] ?? "default"}
		>
			{orderAttributionAvatars(attributionOrder, agentAvatar, personAvatar)}
		</AvatarGroup>
	);
}

/**
 * The row's leading identity. Agents keep the shared hexagon agent visual;
 * people get the circular photo avatar the rest of Jira uses, so a mixed list —
 * agents waiting on an answer beside teammates who @mentioned you — is
 * separable at a glance without reading a word. Attributed identities default
 * to human-first for owned work; callers representing untracked work can
 * explicitly restore the agent-first composition.
 */
export function AgentListIdentity({
	agent,
	animate,
	attributedBy,
	attributionOrder = "human-first",
	className,
	motion,
	onAnimationComplete,
	sizePx,
}: Readonly<{
	agent: AgentListAgent;
	attributedBy?: AgentListInvoker;
	attributionOrder?: AgentListAttributionOrder;
	className?: string;
	sizePx: number;
} & Pick<HumanAgentAvatarProps, "animate" | "motion" | "onAnimationComplete">>) {
	if (attributedBy !== undefined && agent.kind !== "person") {
		return (
			<HumanAgentAvatar
				agent={agent}
				human={attributedBy}
				attributionOrder={attributionOrder}
				className={className}
				sizePx={sizePx}
				animate={animate}
				motion={motion}
				onAnimationComplete={onAnimationComplete}
			/>
		);
	}

	if (agent.kind === "person") {
		return (
			<Avatar
				className={className}
				label={agent.name}
				size={PX_TO_PERSON_AVATAR_SIZE[sizePx] ?? "default"}
			>
				{agent.avatarSrc ? <AvatarImage alt="" src={agent.avatarSrc} /> : null}
				<AvatarFallback>{actorInitials(agent.name)}</AvatarFallback>
			</Avatar>
		);
	}

	return (
		<AgentAvatarVisual
			avatarClassName={className}
			avatarSrc={agent.avatarSrc}
			brandName={agent.brandName}
			label={agent.name}
			sizePx={sizePx}
			vpkLogo={agent.vpkLogo}
		/>
	);
}
