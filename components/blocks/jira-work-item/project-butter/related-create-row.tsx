"use client";

import AddIcon from "@atlaskit/icon/core/add";
import PersonIcon from "@atlaskit/icon/core/person";
import TaskToDoIcon from "@atlaskit/icon/core/task-to-do";
import { PROJECT_BUTTER_RELATED_SEARCH_ITEMS } from "@/components/blocks/jira-work-item/project-butter/related-data";
import { RelatedComposer } from "@/components/blocks/jira-work-item/project-butter/related-composer";
import { relatedSearchText, relatedWorkItemKey, type ProjectButterRelatedAddRequest, type ProjectButterRelatedItem, type ProjectButterRelatedListEditor } from "@/components/blocks/jira-work-item/project-butter/related-model";
import { RelatedPriorityGlyph, RelatedRelationshipField } from "@/components/blocks/jira-work-item/project-butter/related-row-fields";

type Choice = { kind: "existing"; id: string; item: ProjectButterRelatedItem } | { kind: "create"; id: string; summary: string };

export function ProjectButterRelatedCreateRow({ dimmed, editor, items, linked, onAdd, onChange, onDismiss }: Readonly<{
	dimmed: boolean;
	editor: ProjectButterRelatedListEditor;
	items: readonly ProjectButterRelatedItem[];
	linked: boolean;
	onAdd: (request: ProjectButterRelatedAddRequest) => void;
	onChange: (patch: Partial<ProjectButterRelatedListEditor>) => void;
	onDismiss: () => void;
}>) {
	const query = relatedSearchText(editor.query);
	const excluded = new Set(items.map((item) => item.key));
	const matches = query ? PROJECT_BUTTER_RELATED_SEARCH_ITEMS.filter((item) => !excluded.has(item.key) && (linked || item.workType === "Subtask") && `${item.key} ${item.summary}`.toLowerCase().includes(query.toLowerCase())).slice(0, 6) : [];
	const exact = matches.find((item) => item.key === query.toUpperCase());
	const choices: Choice[] = matches.map((item) => ({ kind: "existing", id: item.key, item }));
	if (query && !exact && !excluded.has(relatedWorkItemKey(query) ?? "")) choices.push({ kind: "create", id: "create", summary: query });
	const label = linked ? "Add linked work" : "Create child work item";
	function select(choice: Choice | undefined) {
		if (!choice) return;
		onAdd(choice.kind === "existing" ? { kind: "existing", item: choice.item, ...(linked ? { relationship: editor.relationship } : {}) } : { kind: "create", summary: choice.summary, ...(linked ? { relationship: editor.relationship } : {}) });
		onChange({ query: "", composerOpen: false });
	}
	return (
		<RelatedComposer
			choices={choices}
			createSignal={editor.createSignal}
			dimmed={dimmed}
			label={label}
			leading={<>{linked ? <RelatedRelationshipField label="Relationship for the new linked work item" onChange={(relationship) => onChange({ relationship })} value={editor.relationship} /> : null}<span aria-hidden className="flex size-6 shrink-0 items-center justify-center text-icon-subtle"><TaskToDoIcon label="" size="small" /></span></>}
			listboxLabel="Matching work items"
			liveMessage={`${matches.length} matching work item${matches.length === 1 ? "" : "s"}`}
			onCommit={select}
			onDismiss={(reason) => reason === "escape" ? onDismiss() : onChange({ composerOpen: false })}
			onPasteText={relatedWorkItemKey}
			onQueryChange={(value) => onChange({ query: value })}
			query={editor.query}
			renderChoice={(choice) => choice.kind === "create"
				? <><AddIcon label="" size="small" /><span className="min-w-0 truncate">Create “{choice.summary}”</span></>
				: <><TaskToDoIcon label="" size="small" /><span className="shrink-0 text-text-subtlest">{choice.item.key}</span><span className="min-w-0 truncate">{choice.item.summary}</span></>}
			trailing={<><RelatedPriorityGlyph value="Medium" /><PersonIcon label="" size="small" /></>}
		/>
	);
}
