/**
 * People options for the experimental Jira Work Item metadata rail.
 *
 * Presentation-only fixtures for the assignee / reporter pickers — NOT reducer
 * state. Deterministic (no clock / randomness) and shaped as `WorkItemPerson`
 * so the rail can seed directly from `meta.workItem.assignee` / `.reporter`.
 *
 * The roster mirrors the rich-text editor's "People and team" palette so the
 * assignee picker offers the same full directory of people. The palette humans
 * come from `SAMPLE_AGENT_PEOPLE`; we map them to `WorkItemPerson` and drop the
 * permission `role` (manager/editor/user) since it isn't a meaningful subtitle
 * in an assignee picker. A small curated set of role-titled people is appended
 * for names the work-item fixtures reference that aren't in the directory.
 */

import { SAMPLE_AGENT_PEOPLE } from "@/app/data/directory/people";
import type { WorkItemPerson } from "@/app/contexts/context-work-item-modal";

/**
 * Curated role-titled people referenced by the work-item fixtures (e.g. the
 * seeded assignee / reporter) that don't exist in the shared directory. Kept so
 * those named values still render with a title in the picker.
 */
const CURATED_PEOPLE: readonly WorkItemPerson[] = [
	{ name: "Maya Chen", avatarUrl: "/avatar-user/andrea-wilson/color/asow-service-yellow.png", role: "Proposal manager" },
	{ name: "Jordan Lee", avatarUrl: "/avatar-user/andrew-park/color/asow-dev-lime.png", role: "Account executive" },
	{ name: "Priya Narayanan", avatarUrl: "/avatar-user/priya-hansra/color/asow-service-yellow.png", role: "Deal desk lead" },
	{ name: "Sam Rivera", avatarUrl: "/avatar-user/raul-gonzalez/color/asow-strategy-orange.png", role: "Security reviewer" },
	// Deliberately long name to exercise label truncation in the picker + trigger.
	{ name: "Alexandra Constantinopoulos", avatarUrl: "/avatar-user/veronica-rodriguez/color/asow-service-yellow.png", role: "Partner enablement lead" },
];

/** Directory roster mapped to `WorkItemPerson` (name + avatar, no permission role). */
const DIRECTORY_PEOPLE: readonly WorkItemPerson[] = SAMPLE_AGENT_PEOPLE.map((person) => ({
	name: person.name,
	avatarUrl: person.avatarSrc,
}));

/**
 * The assignee / reporter picker roster: the curated named people first (so the
 * seeded work-item values keep their titles), then the full directory of people
 * the "People and team" palette provides. De-duplicated by name.
 */
export const METADATA_PEOPLE: readonly WorkItemPerson[] = (() => {
	const byName = new Map<string, WorkItemPerson>();
	for (const person of [...CURATED_PEOPLE, ...DIRECTORY_PEOPLE]) {
		if (!byName.has(person.name)) {
			byName.set(person.name, person);
		}
	}
	return [...byName.values()];
})();

/** Find a seeded person by name (used to reconcile seeded work-item people). */
export function getMetadataPerson(name: string): WorkItemPerson | undefined {
	return METADATA_PEOPLE.find((person) => person.name === name);
}
