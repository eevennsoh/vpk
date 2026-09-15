"use client";

import {
	AgentAvatarVisual,
	type AgentAvatarVisualProps,
} from "@/components/ui-custom/agent-avatar-visual";
import { HumanAgentAvatarMotion } from "@/components/ui-custom/human-agent-avatar-motion";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
	type AvatarProps,
} from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/use-media-query";

import type { HumanAgentAvatarMotionOptions } from "@/components/ui-custom/human-agent-avatar-motion-config";

export type { HumanAgentAvatarMotionOptions } from "@/components/ui-custom/human-agent-avatar-motion-config";

export type HumanAgentAvatarOrder = "agent-first" | "human-first";

export interface HumanAgentAvatarProps {
	agent: Pick<
		AgentAvatarVisualProps,
		"avatarSrc" | "brandName" | "logoName" | "vpkLogo" | "fallbackText"
	> & { name: string };
	human: { name: string; avatarSrc?: string };
	/** Swap the human and agent, hold, then return. Static by default. */
	animate?: boolean;
	/** Controlled destination; horizontal groups hold instead of looping. */
	composition?: "compact" | "horizontal-group";
	motion?: Partial<HumanAgentAvatarMotionOptions>;
	attributionOrder?: HumanAgentAvatarOrder;
	/** Default footprint: 32px, containing a 24px agent and a 16px human. */
	sizePx?: number;
	className?: string;
}

const PX_TO_IDENTITY_FRAME_CLASS_NAME: Record<number, string> = {
	16: "size-4",
	20: "size-5",
	24: "size-6",
	32: "size-8",
	40: "size-10",
	48: "size-12",
};
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

/** A human photo and agent hexagon sharing one stable, accessible footprint. */
export function HumanAgentAvatar({
	agent,
	human,
	animate = false,
	composition,
	motion,
	attributionOrder = "agent-first",
	sizePx = 32,
	className,
}: Readonly<HumanAgentAvatarProps>) {
	const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)", true);
	const shouldAnimate = animate && !reducedMotion;
	const frameClassName = PX_TO_IDENTITY_FRAME_CLASS_NAME[sizePx] ?? "size-8";
	const agentSizePx = PX_TO_ATTRIBUTED_AGENT_SIZE[sizePx] ?? sizePx;
	const personAvatarSize = PX_TO_ATTRIBUTED_PERSON_AVATAR_SIZE[sizePx] ?? "xs";
	const agentFirst = attributionOrder === "agent-first";
	const label = `${agent.name}, used by ${human.name}`;
	const frameClass = cn("relative block shrink-0", frameClassName, className);
	const humanAvatar = (outline?: AvatarProps["outline"]) => (
		<Avatar
			animate={false}
			outline={outline}
			className={outline ? undefined : "ring-2 ring-background"}
			label=""
			size={personAvatarSize}
		>
			{human.avatarSrc ? <AvatarImage alt="" src={human.avatarSrc} /> : null}
			<AvatarFallback>
				{human.name
					.split(" ")
					.filter(Boolean)
					.slice(0, 2)
					.map((word) => word[0]?.toUpperCase())
					.join("") || "?"}
			</AvatarFallback>
		</Avatar>
	);
	const agentAvatar = (sizePx = agentSizePx) => (
		<AgentAvatarVisual {...agent} animate={false} label="" sizePx={sizePx} />
	);

	if (shouldAnimate || composition === "horizontal-group") {
		return (
			<HumanAgentAvatarMotion
				options={motion}
				animate={shouldAnimate}
				composition={composition}
				agent={agentAvatar}
				human={humanAvatar}
				agentFirst={agentFirst}
				frameSize={PX_TO_IDENTITY_FRAME_CLASS_NAME[sizePx] ? sizePx : 32}
				agentSize={agentSizePx}
				humanSize={personAvatarSize === "sm" ? 24 : 16}
				className={frameClass}
				label={label}
			/>
		);
	}

	const personPositionClassName = agentFirst
		? "absolute bottom-0 right-0"
		: "absolute left-0 top-0";
	const agentPositionClassName = agentFirst
		? "absolute left-0 top-0"
		: "absolute bottom-0 right-0";
	const humanSlot = (
		<span
			aria-hidden="true"
			className={personPositionClassName}
			data-avatar-role="human"
			key="human"
		>
			{humanAvatar()}
		</span>
	);
	const agentSlot = (
		<span
			aria-hidden="true"
			className={agentPositionClassName}
			data-avatar-role="agent"
			key="agent"
		>
			{agentAvatar()}
		</span>
	);

	return (
		<span
			aria-label={label}
			className={frameClass}
			data-animated="false"
			data-slot="human-agent-avatar"
			role="img"
		>
			{agentFirst ? [agentSlot, humanSlot] : [humanSlot, agentSlot]}
		</span>
	);
}
