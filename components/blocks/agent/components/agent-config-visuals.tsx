import type { ReactNode } from "react";

import {
	DEFAULT_SKILLS,
	getSkillCollectionId,
	getSkillIcon,
} from "@/app/data/directory/skills";
import type { TagColor } from "@/components/ui/tag";
import type { SkillTagColor } from "@/components/ui-custom/skill-tag";
import { getSkillConfigLabel } from "@/components/blocks/agent/lib/agent-config-model";

// Maps each agent avatar family (the `<group>` segment in `/avatar-agent/<group>/...`)
// to the Tag color that matches its brand accent (see AGENT_AVATAR_GROUP_ACCENTS).
const agentAvatarGroupToTagColor: Readonly<Record<string, TagColor>> = {
	"dev-agents": "lime",
	lime: "lime",
	"product-agents": "purple",
	purple: "purple",
	"service-agents": "yellow",
	yellow: "yellow",
	"strategy-agents": "orange",
	orange: "orange",
	"teamwork-agents": "blue",
	blue: "blue",
};

export const tagColorToMenuIconClassName: Partial<Record<TagColor, string>> = {
	blue: "text-blue-500 [&_svg]:text-blue-500!",
	blueLight: "text-blue-500 [&_svg]:text-blue-500!",
	discovery: "text-icon-discovery [&_svg]:text-icon-discovery!",
	green: "text-green-400 [&_svg]:text-green-400!",
	greenLight: "text-green-400 [&_svg]:text-green-400!",
	gray: "text-neutral-500 [&_svg]:text-neutral-500!",
	grayLight: "text-neutral-500 [&_svg]:text-neutral-500!",
	grey: "text-neutral-500 [&_svg]:text-neutral-500!",
	greyLight: "text-neutral-500 [&_svg]:text-neutral-500!",
	lime: "text-lime-400 [&_svg]:text-lime-400!",
	limeLight: "text-lime-400 [&_svg]:text-lime-400!",
	magenta: "text-pink-500 [&_svg]:text-pink-500!",
	magentaLight: "text-pink-500 [&_svg]:text-pink-500!",
	orange: "text-orange-400 [&_svg]:text-orange-400!",
	orangeLight: "text-orange-400 [&_svg]:text-orange-400!",
	purple: "text-purple-500 [&_svg]:text-purple-500!",
	purpleLight: "text-purple-500 [&_svg]:text-purple-500!",
	red: "text-red-600 [&_svg]:text-red-600!",
	redLight: "text-red-600 [&_svg]:text-red-600!",
	standard: "text-neutral-500 [&_svg]:text-neutral-500!",
	teal: "text-teal-400 [&_svg]:text-teal-400!",
	tealLight: "text-teal-400 [&_svg]:text-teal-400!",
	yellow: "text-yellow-400 [&_svg]:text-yellow-400!",
	yellowLight: "text-yellow-400 [&_svg]:text-yellow-400!",
};

export function getAgentCollectionIconClassName(tagColor: TagColor | undefined): string {
	return tagColorToMenuIconClassName[tagColor ?? "gray"] ?? tagColorToMenuIconClassName.gray ?? "";
}

export function getSkillForConfigLabel(label: string) {
	const normalized = getSkillConfigLabel(label);
	return DEFAULT_SKILLS.find((entry) => entry.id === normalized || getSkillConfigLabel(entry.name) === normalized);
}

export function getSkillTagPropsForLabel(label: string): { color: SkillTagColor; icon: ReactNode } {
	const skill = getSkillForConfigLabel(label);
	return {
		color: skill ? getSkillCollectionId(skill) : "default",
		icon: getSkillIcon(skill?.icon ?? "page"),
	};
}

export function getTagColorForAgentAvatar(avatarSrc: string | undefined): TagColor | undefined {
	const group = avatarSrc?.match(/\/avatar-agent(?:-new)?\/([^/]+)\//u)?.[1];
	return group ? agentAvatarGroupToTagColor[group] : undefined;
}
