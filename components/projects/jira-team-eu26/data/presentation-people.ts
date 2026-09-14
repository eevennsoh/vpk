import { PULSE_TIMELINE } from "@/components/blocks/jira-kanban/experimental/pulse/data/pulse-timeline";

/** Shared PAY-story people, adapted by each presentation surface as needed. */
export const PAY_STORY_PEOPLE = {
	diego: {
		id: "diego-santos",
		name: "Diego Santos",
		avatarSrc: "/avatar-user/dev-rana/color/asow-dev-lime-64.png",
	},
	jordan: {
		id: "jordan-okafor",
		name: "Jordan Okafor",
		avatarSrc: "/avatar-user/issac-varghese/color/asow-product-purple-64.png",
	},
	maya: {
		id: "maya-ferreira",
		name: "Maya Ferreira",
		avatarSrc: "/avatar-user/chloe-lee/color/asow-teamwork-blue-64.png",
	},
	priya: {
		id: "priya-raman",
		name: "Priya Raman",
		avatarSrc: "/avatar-user/ting-chen/color/asow-strategy-orange-64.png",
	},
} as const;

const PAY_STORY_PEOPLE_BY_SESSION_MEMBER_ID: Readonly<Record<string, { avatarSrc: string }>> = {
	diego: PAY_STORY_PEOPLE.diego,
	jordan: PAY_STORY_PEOPLE.jordan,
	maya: PAY_STORY_PEOPLE.maya,
	priya: PAY_STORY_PEOPLE.priya,
};

/** Keep session attribution on the same stable face and color as every PAY story surface. */
export const JIRA_TEAM_EU26_PAY_SESSION_MEMBERS = PULSE_TIMELINE.members.map((member) => {
	const person = PAY_STORY_PEOPLE_BY_SESSION_MEMBER_ID[member.id];
	return person ? { ...member, avatarSrc: person.avatarSrc } : member;
});
