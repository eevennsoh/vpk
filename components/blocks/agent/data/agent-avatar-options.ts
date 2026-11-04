import { AGENT_AVATAR_SRCS } from "@/lib/agent-avatars";

export interface AgentAvatarOption {
	label: string;
	src: string;
}

export interface AgentAvatarOptionGroup {
	id: string;
	label: string;
	options: readonly AgentAvatarOption[];
}

export const AGENT_AVATAR_OPTION_GROUPS: readonly AgentAvatarOptionGroup[] = [
	"lime", "purple", "yellow", "orange", "blue",
].map((color) => ({
	id: color,
	label: color.charAt(0).toUpperCase() + color.slice(1),
	options: AGENT_AVATAR_SRCS.filter((src) => src.startsWith(`/avatar-agent-new/${color}/`)).map((src) => ({
		label: src.slice(src.lastIndexOf("/") + 1, -4).split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" "),
		src,
	})),
}));

export const AGENT_AVATAR_OPTION_SRCS = AGENT_AVATAR_SRCS;
