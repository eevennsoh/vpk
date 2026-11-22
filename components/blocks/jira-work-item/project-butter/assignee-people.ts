import { METADATA_PEOPLE } from "@/components/blocks/jira-work-item/data/metadata-people";
import { TEAM_EU26_PEOPLE } from "@/components/blocks/jira-work-item/team-eu26/data/team-eu26-vita-one";
import { PROJECT_BUTTER_UNASSIGNED, projectButterPersonAvatar } from "./people";

const butterPeople = Object.values(TEAM_EU26_PEOPLE)
	.filter((person) => person.name !== "Automatic")
	.map((person) => ({ ...person, avatarUrl: projectButterPersonAvatar(person.name) }));

export const PROJECT_BUTTER_PEOPLE = [
	...butterPeople,
	...METADATA_PEOPLE.filter((person) => !butterPeople.some((existing) => existing.name === person.name)),
];

export const PROJECT_BUTTER_ASSIGNEES = [PROJECT_BUTTER_UNASSIGNED, ...PROJECT_BUTTER_PEOPLE];
