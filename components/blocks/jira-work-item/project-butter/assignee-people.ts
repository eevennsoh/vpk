import { METADATA_PEOPLE } from "@/components/blocks/jira-work-item/data/metadata-people";
import { TEAM_EU26_PEOPLE } from "@/components/blocks/jira-work-item/team-eu26/data/team-eu26-vita-one";
import { PROJECT_BUTTER_UNASSIGNED, PROJECT_BUTTER_VIEWER, projectButterPersonAvatar } from "./people";

const butterPeople = Object.values(TEAM_EU26_PEOPLE)
	.filter((person) => person.name !== "Automatic")
	.map((person) => ({ ...person, avatarUrl: projectButterPersonAvatar(person.name) }));

/** The viewer leads the list, so assigning yourself is one pick away. */
export const PROJECT_BUTTER_PEOPLE = [
	{ name: PROJECT_BUTTER_VIEWER.name, avatarUrl: PROJECT_BUTTER_VIEWER.avatarSrc },
	...butterPeople,
	...METADATA_PEOPLE.filter((person) => !butterPeople.some((existing) => existing.name === person.name)),
];

export const PROJECT_BUTTER_ASSIGNEES = [PROJECT_BUTTER_UNASSIGNED, ...PROJECT_BUTTER_PEOPLE];
