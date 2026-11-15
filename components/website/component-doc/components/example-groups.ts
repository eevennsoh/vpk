import type { ExampleDefinition } from "@/app/data/component-detail-types";

/** Anchor id for an example group heading, kept apart from example ids. */
export function exampleGroupId(group: string) {
	return `${group.replace(/\s+/g, "-").toLowerCase()}-examples`;
}

export type ExampleRow<T> =
	| { kind: "group"; group: string }
	| ({ kind: "example"; example: ExampleDefinition } & T);

/** Insert a group heading row wherever the example group changes; ungrouped examples get none. */
export function toExampleRows<T extends object>(
	entries: ReadonlyArray<{ example: ExampleDefinition } & T>,
): ExampleRow<T>[] {
	const rows: ExampleRow<T>[] = [];
	let currentGroup: string | undefined;
	for (const entry of entries) {
		const { group } = entry.example;
		if (group && group !== currentGroup) {
			rows.push({ kind: "group", group });
		}
		currentGroup = group;
		rows.push({ ...entry, kind: "example" });
	}
	return rows;
}
