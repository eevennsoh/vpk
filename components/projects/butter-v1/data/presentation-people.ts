import { PULSE_TIMELINE } from "@/components/blocks/jira-kanban/experimental/pulse/data/pulse-timeline";
import { PAY_STORY_PEOPLE } from "@/components/blocks/jira-work-item/project-butter/people";

export { PAY_STORY_PEOPLE };

const PAY_STORY_PEOPLE_BY_SESSION_MEMBER_ID: Readonly<Record<string, { avatarSrc: string }>> = {
	diego: PAY_STORY_PEOPLE.diego,
	jordan: PAY_STORY_PEOPLE.jordan,
	maya: PAY_STORY_PEOPLE.maya,
	priya: PAY_STORY_PEOPLE.priya,
};

/** Keep session attribution on the same stable face and color as every PAY story surface. */
export const BUTTER_PAY_SESSION_MEMBERS = PULSE_TIMELINE.members.map((member) => {
	const person = PAY_STORY_PEOPLE_BY_SESSION_MEMBER_ID[member.id];
	return person ? { ...member, avatarSrc: person.avatarSrc } : member;
});
