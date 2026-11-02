"use client";

import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { motion } from "motion/react";
import AddIcon from "@atlaskit/icon/core/add";
import PersonIcon from "@atlaskit/icon/core/person";
import TaskToDoIcon from "@atlaskit/icon/core/task-to-do";
import { Popover, PopoverContent } from "@/components/ui/popover";
import { PROJECT_BUTTER_RELATED_SEARCH_ITEMS } from "@/components/blocks/jira-work-item/project-butter/related-data";
import { relatedSearchText, relatedWorkItemKey, type ProjectButterRelatedAddRequest, type ProjectButterRelatedItem, type ProjectButterRelatedListEditor } from "@/components/blocks/jira-work-item/project-butter/related-model";
import { RelatedPriorityGlyph, RelatedRelationshipField } from "@/components/blocks/jira-work-item/project-butter/related-row-fields";
import { cn } from "@/lib/utils";
import { motionDuration, motionEase } from "@/lib/motion";

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
	const listboxId = useId();
	const anchorRef = useRef<HTMLLIElement>(null);
	const [highlight, setHighlight] = useState({ query: "", index: 0 });
	const [showMatches, setShowMatches] = useState(true);
	const dismissOutside = useEffectEvent((event: PointerEvent) => {
		const target = event.target;
		const row = anchorRef.current;
		if (!(target instanceof Element) || !row || row.contains(target) || target.closest("[data-related-create-matches], [data-related-add], [role=menu], [role=listbox]")) return;
		const dialog = target.closest('[role="dialog"]');
		if (dialog && dialog !== row.closest('[role="dialog"]')) return;
		onChange({ composerOpen: false });
	});
	useEffect(() => {
		document.addEventListener("pointerdown", dismissOutside);
		return () => document.removeEventListener("pointerdown", dismissOutside);
	}, []);
	const query = relatedSearchText(editor.query);
	const excluded = new Set(items.map((item) => item.key));
	const matches = query ? PROJECT_BUTTER_RELATED_SEARCH_ITEMS.filter((item) => !excluded.has(item.key) && (linked || item.workType === "Subtask") && `${item.key} ${item.summary}`.toLowerCase().includes(query.toLowerCase())).slice(0, 6) : [];
	const exact = matches.find((item) => item.key === query.toUpperCase());
	const choices: Choice[] = matches.map((item) => ({ kind: "existing", id: item.key, item }));
	if (query && !exact && !excluded.has(relatedWorkItemKey(query) ?? "")) choices.push({ kind: "create", id: "create", summary: query });
	const activeIndex = highlight.query === editor.query ? Math.min(highlight.index, choices.length - 1) : 0;
	const active = choices[activeIndex];
	function select(choice: Choice) {
		onAdd(choice.kind === "existing" ? { kind: "existing", item: choice.item, ...(linked ? { relationship: editor.relationship } : {}) } : { kind: "create", summary: choice.summary, ...(linked ? { relationship: editor.relationship } : {}) });
		onChange({ query: "", composerOpen: false });
	}
	return (
		<motion.li animate={{ opacity: 1 }} className={cn("relative", dimmed && "pointer-events-none")} exit={{ opacity: 0, transition: { duration: motionDuration.fast, ease: motionEase.in } }} inert={dimmed || undefined} initial={{ opacity: 0 }} ref={anchorRef} transition={{ duration: motionDuration.medium, ease: motionEase.outPractical }}>
			<form aria-label={linked ? "Add linked work" : "Create child work item"} className={cn("flex h-10 min-w-0 items-center gap-1.5 px-4", dimmed && "opacity-(--opacity-disabled)")} onSubmit={(event) => { event.preventDefault(); if (active) select(active); }}>
				{linked ? <RelatedRelationshipField label="Relationship for the new linked work item" onChange={(relationship) => onChange({ relationship })} value={editor.relationship} /> : null}
				<span aria-hidden className="flex size-6 shrink-0 items-center justify-center text-icon-subtle"><TaskToDoIcon label="" size="small" /></span>
				<input aria-activedescendant={showMatches && active ? `${listboxId}-${active.id}` : undefined} aria-autocomplete="list" aria-controls={showMatches && choices.length ? listboxId : undefined} aria-expanded={showMatches && choices.length > 0} aria-label={linked ? "Add linked work" : "Create child work item"} autoFocus className="min-w-0 flex-1 rounded-sm bg-transparent py-1 text-sm text-text outline-none placeholder:text-text-disabled focus-visible:ring-2 focus-visible:ring-ring" onChange={(event) => { onChange({ query: event.currentTarget.value }); setShowMatches(true); }} onFocus={() => setShowMatches(true)} onKeyDown={(event) => {
					if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); if (editor.query) onChange({ query: "" }); else onDismiss(); }
					if ((event.key === "ArrowDown" || event.key === "ArrowUp") && choices.length) { event.preventDefault(); setShowMatches(true); setHighlight({ query: editor.query, index: (activeIndex + (event.key === "ArrowDown" ? 1 : -1) + choices.length) % choices.length }); }
				}} onPaste={(event) => { const key = relatedWorkItemKey(event.clipboardData.getData("text")); if (key) { event.preventDefault(); onChange({ query: key }); setShowMatches(true); } }} placeholder="Create new, search or paste existing" role="combobox" value={editor.query} />
				<span aria-hidden className="flex shrink-0 items-center gap-3 text-icon-subtle"><RelatedPriorityGlyph value="Medium" /><PersonIcon label="" size="small" /></span>
			</form>
			<Popover onOpenChange={(open) => { if (!open) setShowMatches(false); }} open={!dimmed && showMatches && choices.length > 0}>
				<PopoverContent align="start" anchor={anchorRef} className="w-[min(32rem,calc(100vw-3rem))] gap-0 p-1" finalFocus={false} initialFocus={false} onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); setShowMatches(false); } }} positionerClassName="z-[650]">
					<div aria-label="Matching work items" data-related-create-matches id={listboxId} role="listbox">{choices.map((choice, index) => <button aria-selected={index === activeIndex} className={cn("flex w-full min-w-0 items-center gap-2 rounded-sm px-3 py-2 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring", index === activeIndex ? "bg-bg-neutral-subtle-hovered" : "hover:bg-bg-neutral-subtle-hovered")} id={`${listboxId}-${choice.id}`} key={choice.id} onClick={() => select(choice)} onMouseDown={(event) => event.preventDefault()} onPointerMove={() => setHighlight({ query: editor.query, index })} role="option" tabIndex={-1} type="button">{choice.kind === "create" ? <><AddIcon label="" size="small" /><span className="min-w-0 truncate">Create “{choice.summary}”</span></> : <><TaskToDoIcon label="" size="small" /><span className="shrink-0 text-text-subtle">{choice.item.key}</span><span className="min-w-0 truncate">{choice.item.summary}</span></>}</button>)}</div>
				</PopoverContent>
			</Popover>
		</motion.li>
	);
}
