"use client";

import { AgentAvatarVisual } from "@/components/ui-custom/agent-avatar-visual";
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

export type AgentListAttributionOrder = "agent-first" | "human-first";

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

/** The human + agent attribution frame keeps the composite at the row footprint. */
const PX_TO_IDENTITY_FRAME_CLASS_NAME: Record<number, string> = {
	16: "size-4",
	20: "size-5",
	24: "size-6",
	32: "size-8",
	40: "size-10",
	48: "size-12",
};

/** The composite keeps the agent mark one step smaller than its attribution frame. */
const PX_TO_ATTRIBUTED_AGENT_SIZE: Record<number, number> = {
	24: 16,
	32: 24,
	40: 32,
	48: 40,
};

const PX_TO_ATTRIBUTED_PERSON_AVATAR_SIZE: Record<
	number,
	NonNullable<AvatarProps["size"]>
> = {
	24: "xs",
	32: "xs",
	40: "sm",
	48: "sm",
};

export function AgentListAttributionAvatarGroup({
	agent,
	attributedBy,
	attributionOrder = "human-first",
	className,
	sizePx,
}: Readonly<{
	agent: AgentListAgent;
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
	attributedBy,
	attributionOrder = "human-first",
	className,
	sizePx,
}: Readonly<{
	agent: AgentListAgent;
	attributedBy?: AgentListInvoker;
	attributionOrder?: AgentListAttributionOrder;
	className?: string;
	sizePx: number;
}>) {
	if (attributedBy !== undefined && agent.kind !== "person") {
		const frameClassName = PX_TO_IDENTITY_FRAME_CLASS_NAME[sizePx] ?? "size-8";
		const agentSizePx = PX_TO_ATTRIBUTED_AGENT_SIZE[sizePx] ?? sizePx;
		const personAvatarSize = PX_TO_ATTRIBUTED_PERSON_AVATAR_SIZE[sizePx] ?? "xs";
		const agentFirst = attributionOrder === "agent-first";
		const personPositionClassName = agentFirst
			? "absolute bottom-0 right-0 ring-2 ring-background"
			: "absolute left-0 top-0 ring-2 ring-background";
		const agentPositionClassName = agentFirst
			? "absolute left-0 top-0"
			: "absolute bottom-0 right-0";
		const personAvatar = (
			<Avatar
				aria-hidden="true"
				className={personPositionClassName}
				key="person"
				label=""
				size={personAvatarSize}
			>
				{attributedBy.avatarSrc ? (
					<AvatarImage alt="" src={attributedBy.avatarSrc} />
				) : null}
				<AvatarFallback>{actorInitials(attributedBy.name)}</AvatarFallback>
			</Avatar>
		);
		const agentAvatar = (
			<span aria-hidden="true" className={agentPositionClassName} key="agent">
				<AgentAvatarVisual
					avatarSrc={agent.avatarSrc}
					brandName={agent.brandName}
					label=""
					sizePx={agentSizePx}
					vpkLogo={agent.vpkLogo}
				/>
			</span>
		);

		return (
			<span
				aria-label={`${agent.name}, used by ${attributedBy.name}`}
				className={cn("relative block shrink-0", frameClassName, className)}
				role="img"
			>
				{orderAttributionAvatars(attributionOrder, agentAvatar, personAvatar)}
			</span>
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
