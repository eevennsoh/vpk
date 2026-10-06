import { PULSE_TIMELINE } from "@/components/blocks/jira-kanban/experimental/pulse/data/pulse-timeline";
import { JIRA_TEAM_EU26_END_PRESENTERS } from "./keynote-presenters";

/** Legacy story aliases reuse the keynote's canonical presenter identities. */
export const PAY_STORY_PEOPLE = {
	diego: JIRA_TEAM_EU26_END_PRESENTERS.mike,
	jordan: JIRA_TEAM_EU26_END_PRESENTERS.tamar,
	maya: JIRA_TEAM_EU26_END_PRESENTERS.sherif,
	priya: JIRA_TEAM_EU26_END_PRESENTERS.taroon,
} as const;

const PAY_STORY_PEOPLE_BY_SESSION_MEMBER_ID: Readonly<Record<string, { id: string; name: string; avatarSrc: string }>> = {
	diego: PAY_STORY_PEOPLE.diego,
	jordan: PAY_STORY_PEOPLE.jordan,
	maya: PAY_STORY_PEOPLE.maya,
	priya: PAY_STORY_PEOPLE.priya,
	venn: JIRA_TEAM_EU26_END_PRESENTERS.mike,
};

export const JIRA_TEAM_EU26_END_SESSION_MEMBER_ID_BY_LEGACY_ID: Readonly<Record<string, string>> = Object.fromEntries(
	Object.entries(PAY_STORY_PEOPLE_BY_SESSION_MEMBER_ID).map(([id, person]) => [id, person.id]),
);

/** Keep one human roster entry per presenter so avatar filters match session member ids. */
export const JIRA_TEAM_EU26_PAY_SESSION_MEMBERS = PULSE_TIMELINE.members.map((member) => {
	const person = PAY_STORY_PEOPLE_BY_SESSION_MEMBER_ID[member.id];
	return person ? {
		...member,
		id: person.id,
		name: person.name,
		avatarSrc: person.avatarSrc,
	} : member;
}).filter((member, index, members) => members.findIndex((candidate) => candidate.id === member.id) === index);
