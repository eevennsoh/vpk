import peopleData from "./people.json";
import type { DirectoryVisual } from "./types";

/**
 * People directory data layer. This module owns the canonical `AgentPerson`
 * interface (faithfully mirrored from the agent Users screen's original
 * `components/blocks/agent-user/data/users.ts`) and sources its catalog from
 * `people.json` as the single source of truth, matching the loader pattern used
 * by `skills.ts`.
 */

export type AgentUserRole = "manager" | "editor" | "user";

export interface AgentRoleOption {
	value: AgentUserRole;
	label: string;
	description: string;
}

export interface AgentPerson {
	id: string;
	name: string;
	avatarSrc?: string;
	/** Owner is surfaced as a lozenge next to the name and can't be removed. */
	isOwner?: boolean;
	role: AgentUserRole;
}

/** Roles a person can hold on an agent, in descending order of permission. */
export const AGENT_ROLE_OPTIONS: readonly AgentRoleOption[] = [
	{
		value: "manager",
		label: "Manager",
		description: "Permission to edit or delete the agent and invite collaborators.",
	},
	{
		value: "editor",
		label: "Editor",
		description: "Permission to edit the agent's configuration but not delete it.",
	},
	{
		value: "user",
		label: "User",
		description: "Permission to use the agent but not change its configuration.",
	},
] as const;

export const DEFAULT_AGENT_ROLE: AgentUserRole = "manager";

export function getRoleOption(role: AgentUserRole): AgentRoleOption {
	return AGENT_ROLE_OPTIONS.find((option) => option.value === role) ?? AGENT_ROLE_OPTIONS[0];
}

/**
 * The complete people directory catalog, sourced from `people.json` as the
 * single source of truth. The JSON is structurally an `AgentPerson[]`; we assert
 * the type here so callers get full typing without the loader re-declaring the
 * data inline.
 */
export const SAMPLE_AGENT_PEOPLE: readonly AgentPerson[] =
	peopleData as readonly AgentPerson[];

/** The agent owner — mirrors the default state of a freshly created agent. */
export const SAMPLE_AGENT_OWNER: AgentPerson = SAMPLE_AGENT_PEOPLE[0];

/**
 * Derives the JSON-serializable mention-token visual for a person. People render
 * as rounded (circle) avatars so composer/editor surfaces can rehydrate them via
 * `resolveDirectoryVisual`.
 */
export function getPersonDirectoryVisual(person: AgentPerson): DirectoryVisual {
	return {
		kind: "avatar",
		shape: "circle",
		src: person.avatarSrc ?? "",
	};
}
