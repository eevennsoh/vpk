"use client";

import { PROJECT_BUTTER_RELATED_SEARCH_ITEMS } from "@/components/blocks/jira-work-item/project-butter-v1/related-data";
import { RelatedComposer, type RelatedComposerDismissReason } from "@/components/blocks/jira-work-item/project-butter-v1/related-composer";
import { relatedComposerChoices, relatedWorkItemKey, type ProjectButterRelatedAddRequest, type ProjectButterRelatedItem, type ProjectButterRelatedListEditor, type ProjectButterRelatedSearchItem, type ProjectButterRelatedWorkType, type RelatedWorkChoice } from "@/components/blocks/jira-work-item/project-butter-v1/related-model";
import { RelatedAssigneeAvatar, RelatedPriorityGlyph, RelatedRelationshipField } from "@/components/blocks/jira-work-item/project-butter-v1/related-row-fields";
import { RelatedStatusIcon } from "@/components/blocks/jira-work-item/project-butter-v1/related-status-field";

export function ProjectButterRelatedCreateRow({ catalog = PROJECT_BUTTER_RELATED_SEARCH_ITEMS, dimmed, editor, items, linked, onAdd, onChange, onDismiss, ownKey, parentType }: Readonly<{
	/** Work items the composer can match; the host passes its own project (Butter board cards). */
	catalog?: readonly ProjectButterRelatedSearchItem[];
	dimmed: boolean;
	editor: ProjectButterRelatedListEditor;
	items: readonly ProjectButterRelatedItem[];
	linked: boolean;
	onAdd: (request: ProjectButterRelatedAddRequest) => void;
	onChange: (patch: Partial<ProjectButterRelatedListEditor>) => void;
	/** The composer closed without adding (Escape on an empty query or a pointerdown outside). */
	onDismiss: (reason: RelatedComposerDismissReason) => void;
	/** The open work item's key, never offered as a match. */
	ownKey: string;
	parentType?: ProjectButterRelatedWorkType;
}>) {
	const { choices, matchCount } = relatedComposerChoices({
		catalog,
		existingKeys: new Set(items.map((item) => item.key)),
		kind: linked ? "linked" : "children",
		ownKey,
		parentType,
		query: editor.query,
	});
	const label = linked ? "Add linked work" : "Create child work item";
	const relationship = linked ? { relationship: editor.relationship } : {};
	function select(choice: RelatedWorkChoice | undefined) {
		if (!choice) return;
		onChange({ query: "", composerOpen: false });
		onAdd(choice.kind === "existing" ? { kind: "existing", item: choice.item, ...relationship } : { kind: "create", summary: choice.summary, ...relationship });
	}
	return (
		<RelatedComposer
			choices={choices}
			createSignal={editor.createSignal}
			dimmed={dimmed}
			label={label}
			leading={<>{linked ? <RelatedRelationshipField label={`Relationship for the new linked work item: ${editor.relationship}. Edit`} onChange={(value) => onChange({ relationship: value })} value={editor.relationship} /> : null}<span aria-hidden className="flex size-6 shrink-0 items-center justify-center"><RelatedStatusIcon status="To do" /></span></>}
			listboxLabel="Matching work items"
			liveMessage={`${matchCount} matching work item${matchCount === 1 ? "" : "s"}`}
			onCommit={select}
			onDismiss={(reason) => {
				// Reference parity: leaving the composer drops the uncommitted query.
				onChange({ query: "", composerOpen: false });
				onDismiss(reason);
			}}
			onPasteText={relatedWorkItemKey}
			onQueryChange={(value) => onChange({ query: value })}
			query={editor.query}
			renderChoice={(choice) => choice.kind === "create"
				? <><RelatedStatusIcon status="To do" /><span className="min-w-0 truncate">Create “{choice.summary}”</span></>
				: <><RelatedStatusIcon status={choice.item.status} /><span className="shrink-0 text-text-subtlest">{choice.item.key}</span><span className="min-w-0 truncate">{choice.item.summary}</span></>}
			trailing={<><RelatedPriorityGlyph value="Medium" /><RelatedAssigneeAvatar /></>}
		/>
	);
}
